import type {
  ProviderDescriptor,
  ProviderStatus,
  TtsProvider,
  TtsSynthesisChunk,
  VoiceDescriptor,
} from './types.js';

const MAC_SAY_VOICES: ReadonlyArray<Omit<VoiceDescriptor, 'previewUrl' | 'sampleText'>> = [
  { id: 'Nora', displayName: 'Nora', language: 'no-NO', gender: 'female' },
  { id: 'Henrik', displayName: 'Henrik', language: 'no-NO', gender: 'male' },
  { id: 'Alex', displayName: 'Alex', language: 'en-US', gender: 'male' },
  { id: 'Samantha', displayName: 'Samantha', language: 'en-US', gender: 'female' },
  { id: 'Daniel', displayName: 'Daniel', language: 'en-GB', gender: 'male' },
];

export class MacSayTts implements TtsProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'mac-say',
    kind: 'tts',
    displayName: 'macOS · say',
    vendor: 'Apple',
    local: true,
    languages: ['no-NO', 'en-US', 'en-GB'],
  };

  async voices(): Promise<VoiceDescriptor[]> {
    return MAC_SAY_VOICES.map((v) => ({
      ...v,
      previewUrl: `voice-preview://say/${v.id}`,
      sampleText:
        v.language === 'no-NO'
          ? `Hei, jeg heter ${v.displayName}, og jeg snakker norsk.`
          : `Hi, my name is ${v.displayName}.`,
    }));
  }

  async status(): Promise<ProviderStatus> {
    return process.platform === 'darwin'
      ? { state: 'ready' }
      : { state: 'unavailable', reason: 'macOS only' };
  }

  // eslint-disable-next-line require-yield
  async *synthesize(
    _text: string,
    _opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    throw new Error('MacSayTts.synthesize is not yet wired — pending milestone 2.');
  }
}
