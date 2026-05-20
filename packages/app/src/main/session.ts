import type { WebContents } from 'electron';
import { AnthropicChat } from './anthropic.js';
import { VoiceEngine } from './voice-engine.js';
import type { ConversationState, VoiceEvent } from '../shared/voice-events.js';

const STATE_MAP: Record<string, ConversationState> = {
  idle: 'idle',
  listening: 'listening',
  user_speaking: 'user_speaking',
  user_endpointing: 'user_endpointing',
  thinking: 'thinking',
  speaking: 'speaking',
  interrupted: 'interrupted',
};

export class ConversationSession {
  readonly engine = new VoiceEngine();
  readonly chat = new AnthropicChat();
  #abortReply: AbortController | null = null;
  #abortTts: AbortController | null = null;
  #wc: WebContents | null = null;
  #spokenSoFar = '';

  constructor() {
    this.engine.fsm.on((next) => {
      this.#emit({ type: 'state', state: STATE_MAP[next] ?? 'idle' });
    });
  }

  attachRenderer(wc: WebContents): void {
    this.#wc = wc;
  }

  async start(): Promise<void> {
    this.engine.fsm.send({ type: 'session.start', at: Date.now() });
  }

  async stop(): Promise<void> {
    this.#abortAll();
    this.engine.fsm.send({ type: 'session.stop', at: Date.now() });
  }

  async bargeIn(): Promise<void> {
    this.#abortAll();
    this.engine.fsm.send({ type: 'barge_in', at: Date.now() });
    this.chat.truncateLastAssistantTo(this.#spokenSoFar.length);
  }

  async endTurn(audio: ArrayBuffer, sampleRate: number): Promise<void> {
    this.engine.fsm.send({ type: 'vad.speech_ended', at: Date.now() });
    const pcm = new Float32Array(audio);

    let transcription;
    try {
      transcription = await this.engine.transcribe(pcm, sampleRate);
    } catch (err) {
      this.#emit({ type: 'error', message: `STT: ${(err as Error).message}` });
      this.engine.fsm.send({ type: 'turn.incomplete', at: Date.now() });
      return;
    }

    if (transcription.text === null) {
      this.#emit({
        type: 'rejectedTranscript',
        reason: transcription.rejectedReason ?? 'empty',
      });
      this.engine.fsm.send({ type: 'turn.incomplete', at: Date.now() });
      return;
    }

    this.#emit({ type: 'finalTranscript', text: transcription.text });
    this.engine.fsm.send({ type: 'turn.complete', at: Date.now() });

    await this.#respond(transcription.text);
  }

  async #respond(userText: string): Promise<void> {
    this.#abortReply = new AbortController();
    this.#abortTts = new AbortController();
    this.#spokenSoFar = '';

    let pendingTtsBuf = '';
    let firstTokenSeen = false;

    const ttsVoiceId = this.#pickVoice();

    const flushTts = async (chunkText: string): Promise<void> => {
      if (chunkText.length === 0) return;
      if (this.#abortTts === null) return;
      try {
        for await (const out of this.engine.synthesize(chunkText, ttsVoiceId, this.#abortTts.signal)) {
          const slab = new ArrayBuffer(out.pcm.byteLength);
          new Uint8Array(slab).set(
            new Uint8Array(out.pcm.buffer, out.pcm.byteOffset, out.pcm.byteLength),
          );
          this.#emit({
            type: 'ttsChunk',
            pcm: slab,
            sampleRate: out.sampleRate,
            isFinal: out.isFinal,
          });
          this.#spokenSoFar += chunkText;
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          this.#emit({ type: 'error', message: `TTS: ${(err as Error).message}` });
        }
      }
    };

    try {
      for await (const token of this.chat.streamReply(userText, this.#abortReply.signal)) {
        if (!firstTokenSeen) {
          firstTokenSeen = true;
          this.engine.fsm.send({ type: 'response.first_token', at: Date.now() });
        }
        this.#emit({ type: 'assistantToken', text: token });
        pendingTtsBuf += token;
        const flushAt = findSentenceBoundary(pendingTtsBuf);
        if (flushAt > 0) {
          const slice = pendingTtsBuf.slice(0, flushAt);
          pendingTtsBuf = pendingTtsBuf.slice(flushAt);
          await flushTts(slice);
        }
      }
      if (pendingTtsBuf.length > 0) await flushTts(pendingTtsBuf);
      this.engine.fsm.send({ type: 'tts.finished', at: Date.now() });
      this.#emit({ type: 'assistantDone', fullText: this.chat.history().slice(-1)[0]?.content ?? '' });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.#emit({ type: 'error', message: `LLM: ${(err as Error).message}` });
      }
    }
  }

  #pickVoice(): string {
    const tts = this.engine.tts();
    if (tts.descriptor.id === 'openai-tts') return 'nova';
    if (tts.descriptor.id === 'mac-say') {
      return process.env.CLAUDETALK_SAY_VOICE ?? 'Samantha';
    }
    return 'default';
  }

  #abortAll(): void {
    this.#abortReply?.abort();
    this.#abortTts?.abort();
    this.#abortReply = null;
    this.#abortTts = null;
  }

  #emit(event: VoiceEvent): void {
    this.#wc?.send('voice:event', event);
  }
}

const SENTENCE_END = /[.!?…]["')\]]?\s/;

function findSentenceBoundary(text: string): number {
  const match = SENTENCE_END.exec(text);
  if (match === null) return 0;
  return match.index + match[0].length;
}
