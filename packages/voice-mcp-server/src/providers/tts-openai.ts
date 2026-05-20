import type {
  ProviderDescriptor,
  ProviderStatus,
  TtsProvider,
  TtsSynthesisChunk,
  VoiceDescriptor,
} from './types.js';

const OPENAI_VOICES: ReadonlyArray<{ id: string; gender: VoiceDescriptor['gender'] }> = [
  { id: 'alloy', gender: 'neutral' },
  { id: 'echo', gender: 'male' },
  { id: 'fable', gender: 'male' },
  { id: 'onyx', gender: 'male' },
  { id: 'nova', gender: 'female' },
  { id: 'shimmer', gender: 'female' },
];

export class OpenAiTts implements TtsProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'openai-tts',
    kind: 'tts',
    displayName: 'OpenAI TTS (tts-1)',
    vendor: 'OpenAI',
    local: false,
    languages: ['*'],
  };

  async voices(): Promise<VoiceDescriptor[]> {
    return OPENAI_VOICES.map(({ id, gender }) => ({
      id,
      displayName: id.charAt(0).toUpperCase() + id.slice(1),
      language: 'multi',
      ...(gender !== undefined && { gender }),
      previewUrl: `voice-preview://openai/${id}`,
      sampleText: `Hei, jeg heter ${id}, og jeg snakker norsk for deg.`,
    }));
  }

  async status(): Promise<ProviderStatus> {
    return process.env.OPENAI_API_KEY ? { state: 'ready' } : { state: 'needs-api-key' };
  }

  // eslint-disable-next-line require-yield
  async *synthesize(
    _text: string,
    _opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    throw new Error('OpenAiTts.synthesize is not yet wired — pending milestone 2.');
  }
}
