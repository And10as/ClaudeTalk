import type {
  ProviderDescriptor,
  ProviderStatus,
  TtsProvider,
  TtsSynthesisChunk,
  VoiceDescriptor,
} from './types.js';

const PIPER_VOICES: ReadonlyArray<Omit<VoiceDescriptor, 'previewUrl' | 'sampleText'> & { sizeBytes: number }> = [
  { id: 'no_NO-talesyntese-medium', displayName: 'Talesyntese', language: 'no-NO', gender: 'neutral', sizeBytes: 64 * 1024 * 1024 },
  { id: 'en_US-amy-medium', displayName: 'Amy', language: 'en-US', gender: 'female', sizeBytes: 64 * 1024 * 1024 },
  { id: 'en_US-ryan-high', displayName: 'Ryan', language: 'en-US', gender: 'male', sizeBytes: 110 * 1024 * 1024 },
  { id: 'en_GB-alan-medium', displayName: 'Alan', language: 'en-GB', gender: 'male', sizeBytes: 64 * 1024 * 1024 },
];

export class PiperTts implements TtsProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'piper-local',
    kind: 'tts',
    displayName: 'Piper (local)',
    vendor: 'rhasspy/piper',
    local: true,
    languages: ['no-NO', 'en-US', 'en-GB'],
  };

  async voices(): Promise<VoiceDescriptor[]> {
    return PIPER_VOICES.map((v) => ({
      id: v.id,
      displayName: v.displayName,
      language: v.language,
      ...(v.gender !== undefined && { gender: v.gender }),
      previewUrl: `voice-preview://piper/${v.id}`,
      sampleText:
        v.language === 'no-NO'
          ? `Hei, jeg heter ${v.displayName}, og jeg snakker norsk.`
          : `Hi, my name is ${v.displayName}.`,
    }));
  }

  async status(): Promise<ProviderStatus> {
    return { state: 'needs-download', sizeBytes: 64 * 1024 * 1024 };
  }

  // eslint-disable-next-line require-yield
  async *synthesize(
    _text: string,
    _opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    throw new Error('PiperTts.synthesize is not yet wired — pending milestone 3.');
  }
}
