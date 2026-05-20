import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ConversationFsm } from './fsm.js';
import { registry } from './providers/registry.js';

const ListenInput = z.object({
  timeoutMs: z.number().int().positive().max(60_000).optional(),
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

export function createVoiceMcpServer(opts: VoiceServerOptions): Server {
  const { fsm } = opts;

  const server = new Server(
    { name: 'claudetalk-voice', version: '0.0.1' },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'listen',
        description:
          'Open the microphone, capture a user utterance using VAD + turn detection, and return the transcript.',
        inputSchema: {
          type: 'object',
          properties: {
            timeoutMs: { type: 'integer', minimum: 1, maximum: 60_000 },
            language: { type: 'string' },
          },
        },
      },
      {
        name: 'speak',
        description:
          'Synthesize text with the active TTS provider and play it through the user’s speakers. Interruptible via stop_speaking or user barge-in.',
        inputSchema: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1 },
            voiceId: { type: 'string' },
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
        ListenInput.parse(req.params.arguments ?? {});
        return {
          content: [{ type: 'text', text: '(listen: not yet wired — milestone 2)' }],
          isError: true,
        };
      }
      case 'speak': {
        SpeakInput.parse(req.params.arguments ?? {});
        return {
          content: [{ type: 'text', text: '(speak: not yet wired — milestone 2)' }],
          isError: true,
        };
      }
      case 'stop_speaking':
      case 'cancel_listening': {
        return {
          content: [{ type: 'text', text: `(${req.params.name}: not yet wired — milestone 2)` }],
          isError: true,
        };
      }
      case 'set_provider': {
        const { kind, providerId } = SetProviderInput.parse(req.params.arguments ?? {});
        if (kind === 'stt') registry.setActiveStt(providerId);
        else registry.setActiveTts(providerId);
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
      { uri: 'voice://transcript', name: 'Rolling transcript', mimeType: 'application/json' },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === 'voice://state') {
      return {
        contents: [
          { uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify({ state: fsm.state }) },
        ],
      };
    }
    if (req.params.uri === 'voice://transcript') {
      return {
        contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify({ turns: [] }) }],
      };
    }
    throw new Error(`Unknown resource: ${req.params.uri}`);
  });

  return server;
}
