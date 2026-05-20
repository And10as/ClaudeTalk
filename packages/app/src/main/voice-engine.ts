import {
  ConversationFsm,
  KokoroTts,
  LocalWhisperStt,
  MacSayTts,
  OpenAiTts,
  OpenAiWhisperApiStt,
  PiperTts,
  registry,
  TtsEchoFilter,
  filterHallucinations,
  type SttProvider,
  type TtsProvider,
  type TtsSynthesisChunk,
} from '@claudetalk/voice-mcp-server';

export interface TranscriptionResult {
  text: string | null;
  rejectedReason?: 'hallucination' | 'echo' | 'empty';
}

export class VoiceEngine {
  readonly fsm = new ConversationFsm();
  readonly echo = new TtsEchoFilter();

  constructor() {
    registry.registerStt(new OpenAiWhisperApiStt());
    registry.registerStt(new LocalWhisperStt('small'));
    registry.registerStt(new LocalWhisperStt('medium'));

    registry.registerTts(new OpenAiTts());
    registry.registerTts(new MacSayTts());
    registry.registerTts(new KokoroTts());
    registry.registerTts(new PiperTts());

    if (process.env.OPENAI_API_KEY !== undefined && process.env.OPENAI_API_KEY.length > 0) {
      registry.setActiveStt('openai-whisper-api');
      registry.setActiveTts('openai-tts');
    } else if (process.platform === 'darwin') {
      registry.setActiveTts('mac-say');
    }
  }

  stt(): SttProvider {
    return registry.activeStt();
  }

  tts(): TtsProvider {
    return registry.activeTts();
  }

  async transcribe(audio: Float32Array, sampleRate: number, language?: string): Promise<TranscriptionResult> {
    if (audio.length === 0) return { text: null, rejectedReason: 'empty' };
    const result = await this.stt().transcribe(audio, {
      sampleRate,
      ...(language !== undefined && { language }),
    });
    const cleaned = filterHallucinations(result.text);
    if (cleaned === null) return { text: null, rejectedReason: 'hallucination' };
    if (this.echo.isLikelyEcho(cleaned)) return { text: null, rejectedReason: 'echo' };
    return { text: cleaned };
  }

  async *synthesize(
    text: string,
    voiceId: string,
    signal: AbortSignal,
  ): AsyncIterable<TtsSynthesisChunk> {
    this.echo.recordSpoken(text);
    yield* this.tts().synthesize(text, { voiceId, signal });
  }
}
