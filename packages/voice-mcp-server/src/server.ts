import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { playPcm, type PlaybackHandle } from './audio/play-audio.js';
import { recordWithSox } from './audio/sox-record.js';
import { logEvent } from './event-log.js';
import { TtsEchoFilter, filterHallucinations } from './filters.js';
import { ConversationFsm } from './fsm.js';
import { registry } from './providers/registry.js';

const ListenInput = z.object({
  maxDurationSec: z.number().int().positive().max(60).optional(),
  silenceDurationSec: z.number().positive().max(10).optional(),
  language: z.string().optional(),
});

const SpeakInput = z.object({
  text: z.string().min(1),
  voiceId: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
});

const SetProviderInput = z.object({
  kind: z.enum(['stt', 'tts']),
  providerId: z.string(),
});

export interface VoiceServerOptions {
  fsm: ConversationFsm;
}

interface ListenSession {
  abort: AbortController;
}

export function createVoiceMcpServer(opts: VoiceServerOptions): Server {
  const { fsm } = opts;
  const echo = new TtsEchoFilter();
  let activeListen: ListenSession | null = null;
  let activePlayback: PlaybackHandle | null = null;

  const server = new Server(
    { name: 'claudetalk-voice', version: '0.0.1' },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'listen',
        description:
          'Open the microphone, capture a user utterance until silence is detected, transcribe it with the active STT provider, and return the transcript. Use this when you want to hear what the user has to say.',
        inputSchema: {
          type: 'object',
          properties: {
            maxDurationSec: {
              type: 'integer',
              minimum: 1,
              maximum: 60,
              description: 'Hard cutoff for the recording (default 30 s).',
            },
            silenceDurationSec: {
              type: 'number',
              minimum: 0.3,
              maximum: 10,
              description: 'How long silence must persist before the utterance is considered finished (default 1.5 s).',
            },
            language: {
              type: 'string',
              description: 'BCP-47 language hint, e.g. "no", "en". Optional.',
            },
          },
        },
      },
      {
        name: 'speak',
        description:
          'Synthesize text with the active TTS provider and play it through the user’s speakers. Use this to actually say something out loud to the user.',
        inputSchema: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1 },
            voiceId: { type: 'string', description: 'Provider-specific voice id. Falls back to a sensible default.' },
            speed: { type: 'number', minimum: 0.5, maximum: 2.0 },
          },
        },
      },
      {
        name: 'stop_speaking',
        description: 'Immediately stop any in-progress TTS playback.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'cancel_listening',
        description: 'Abort the current listen() call without returning a transcript.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'set_provider',
        description: 'Switch the active STT or TTS provider.',
        inputSchema: {
          type: 'object',
          required: ['kind', 'providerId'],
          properties: {
            kind: { type: 'string', enum: ['stt', 'tts'] },
            providerId: { type: 'string' },
          },
        },
      },
      {
        name: 'list_providers',
        description: 'Return all available STT and TTS providers with current status + downloadable voices.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    switch (req.params.name) {
      case 'listen': {
        const args = ListenInput.parse(req.params.arguments ?? {});
        if (activeListen !== null) activeListen.abort.abort();

        const abort = new AbortController();
        activeListen = { abort };
        fsm.send({ type: 'session.start', at: Date.now() });
        fsm.send({ type: 'vad.speech_started', at: Date.now() });

        const sttId = registry.activeStt().descriptor.id;
        await logEvent('listen.start', { provider: sttId, ...args });

        const t0 = Date.now();
        try {
          const recOpts: Parameters<typeof recordWithSox>[0] = { signal: abort.signal };
          if (args.maxDurationSec !== undefined) recOpts.maxDurationSec = args.maxDurationSec;
          if (args.silenceDurationSec !== undefined) recOpts.silenceDurationSec = args.silenceDurationSec;
          const { pcm, sampleRate } = await recordWithSox(recOpts);
          fsm.send({ type: 'vad.speech_ended', at: Date.now() });
          await logEvent('listen.recorded', {
            samples: pcm.length,
            seconds: +(pcm.length / sampleRate).toFixed(2),
            ms: Date.now() - t0,
          });

          if (pcm.length === 0) {
            await logEvent('listen.empty');
            return { content: [{ type: 'text', text: '' }] };
          }

          const stt = registry.activeStt();
          const sttOpts: { sampleRate: number; language?: string } = { sampleRate };
          if (args.language !== undefined) sttOpts.language = args.language;
          const sttStart = Date.now();
          const result = await stt.transcribe(pcm, sttOpts);
          await logEvent('listen.transcribed', {
            ms: Date.now() - sttStart,
            chars: result.text.length,
            text: result.text.slice(0, 200),
          });
          const cleaned = filterHallucinations(result.text);
          if (cleaned === null) {
            await logEvent('listen.rejected', { reason: 'hallucination', raw: result.text }, 'warn');
            return { content: [{ type: 'text', text: '' }] };
          }
          if (echo.isLikelyEcho(cleaned)) {
            await logEvent('listen.rejected', { reason: 'echo', text: cleaned }, 'warn');
            return { content: [{ type: 'text', text: '' }] };
          }

          fsm.send({ type: 'turn.complete', at: Date.now() });
          await logEvent('listen.done', { text: cleaned });
          return { content: [{ type: 'text', text: cleaned }] };
        } catch (err) {
          await logEvent('listen.error', { message: (err as Error).message }, 'error');
          return {
            content: [{ type: 'text', text: `listen failed: ${(err as Error).message}` }],
            isError: true,
          };
        } finally {
          activeListen = null;
        }
      }

      case 'speak': {
        const args = SpeakInput.parse(req.params.arguments ?? {});
        const tts = registry.activeTts();

        if (activePlayback !== null) {
          activePlayback.stop();
          activePlayback = null;
        }

        const abort = new AbortController();
        fsm.send({ type: 'response.first_token', at: Date.now() });
        echo.recordSpoken(args.text);

        const voiceId = args.voiceId ?? defaultVoiceFor(tts.descriptor.id);
        await logEvent('speak.start', {
          provider: tts.descriptor.id,
          voice: voiceId,
          chars: args.text.length,
          preview: args.text.slice(0, 120),
        });

        const t0 = Date.now();
        try {
          const chunks: Float32Array[] = [];
          let sampleRate = 24_000;
          const synthOpts: Parameters<typeof tts.synthesize>[1] = {
            voiceId,
            signal: abort.signal,
          };
          if (args.speed !== undefined) synthOpts.speed = args.speed;

          for await (const chunk of tts.synthesize(args.text, synthOpts)) {
            chunks.push(chunk.pcm);
            sampleRate = chunk.sampleRate;
          }
          const merged = concatFloat32(chunks);

          await logEvent('speak.synthesized', {
            samples: merged.length,
            seconds: +(merged.length / sampleRate).toFixed(2),
            ms: Date.now() - t0,
          });

          if (merged.length === 0) {
            // Provider handled playback itself (e.g. macOS say in direct mode).
            await logEvent('speak.done', { mode: 'direct', ms: Date.now() - t0 });
            return { content: [{ type: 'text', text: 'played' }] };
          }

          const playback = playPcm(merged, sampleRate);
          activePlayback = playback;
          await playback.finished;
          fsm.send({ type: 'tts.finished', at: Date.now() });
          await logEvent('speak.done', { ms: Date.now() - t0 });
          return {
            content: [{ type: 'text', text: `Played ${merged.length / sampleRate}s of audio.` }],
          };
        } catch (err) {
          await logEvent('speak.error', { message: (err as Error).message }, 'error');
          return {
            content: [{ type: 'text', text: `speak failed: ${(err as Error).message}` }],
            isError: true,
          };
        } finally {
          if (activePlayback !== null && activePlayback.finished !== undefined) {
            activePlayback = null;
          }
        }
      }

      case 'stop_speaking': {
        activePlayback?.stop();
        activePlayback = null;
        fsm.send({ type: 'barge_in', at: Date.now() });
        await logEvent('stop_speaking');
        return { content: [{ type: 'text', text: 'stopped' }] };
      }

      case 'cancel_listening': {
        activeListen?.abort.abort();
        activeListen = null;
        await logEvent('cancel_listening');
        return { content: [{ type: 'text', text: 'cancelled' }] };
      }

      case 'set_provider': {
        const { kind, providerId } = SetProviderInput.parse(req.params.arguments ?? {});
        if (kind === 'stt') registry.setActiveStt(providerId);
        else registry.setActiveTts(providerId);
        await logEvent('set_provider', { kind, providerId });
        return { content: [{ type: 'text', text: `Active ${kind} → ${providerId}` }] };
      }

      case 'list_providers': {
        const stt = await Promise.all(
          registry.listStt().map(async (p) => ({
            descriptor: p.descriptor,
            status: await p.status(),
          })),
        );
        const tts = await Promise.all(
          registry.listTts().map(async (p) => ({
            descriptor: p.descriptor,
            status: await p.status(),
            voices: await p.voices(),
          })),
        );
        return { content: [{ type: 'text', text: JSON.stringify({ stt, tts }, null, 2) }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
          isError: true,
        };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: 'voice://state', name: 'Conversation state', mimeType: 'application/json' },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === 'voice://state') {
      return {
        contents: [
          {
            uri: req.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify({ state: fsm.state }),
          },
        ],
      };
    }
    throw new Error(`Unknown resource: ${req.params.uri}`);
  });

  return server;
}

function defaultVoiceFor(providerId: string): string {
  if (providerId === 'openai-tts') return 'nova';
  if (providerId === 'mac-say') return process.env.CLAUDETALK_SAY_VOICE ?? 'Samantha';
  return 'default';
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
