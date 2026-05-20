import type {
  ProviderDescriptor,
  ProviderStatus,
  TtsProvider,
  TtsSynthesisChunk,
  VoiceDescriptor,
} from './types.js';

const KOKORO_VOICES: ReadonlyArray<Omit<VoiceDescriptor, 'previewUrl' | 'sampleText'>> = [
  { id: 'af_bella', displayName: 'Bella', language: 'en-US', gender: 'female' },
  { id: 'af_nicole', displayName: 'Nicole', language: 'en-US', gender: 'female' },
  { id: 'af_sarah', displayName: 'Sarah', language: 'en-US', gender: 'female' },
  { id: 'am_adam', displayName: 'Adam', language: 'en-US', gender: 'male' },
  { id: 'am_michael', displayName: 'Michael', language: 'en-US', gender: 'male' },
  { id: 'bf_emma', displayName: 'Emma', language: 'en-GB', gender: 'female' },
  { id: 'bm_george', displayName: 'George', language: 'en-GB', gender: 'male' },
];

const MODEL_SIZE_BYTES = 325 * 1024 * 1024;

export class KokoroTts implements TtsProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'kokoro-local',
    kind: 'tts',
    displayName: 'Kokoro (local)',
    vendor: 'hexgrad/Kokoro-82M',
    local: true,
    languages: ['en-US', 'en-GB'],
  };

  async voices(): Promise<VoiceDescriptor[]> {
    return KOKORO_VOICES.map((v) => ({
      ...v,
      previewUrl: `voice-preview://kokoro/${v.id}`,
      sampleText: `Hi, my name is ${v.displayName}.`,
    }));
  }

  async status(): Promise<ProviderStatus> {
    return {
      state: 'unavailable',
      reason: 'Inference kommer — bruk OpenAI TTS eller macOS say inntil videre',
    };
  }

  // eslint-disable-next-line require-yield
  async *synthesize(
    _text: string,
    _opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    throw new Error('KokoroTts.synthesize is not yet wired — pending milestone 3.');
  }
}
