import type { ProviderDescriptor, ProviderStatus, SttProvider, SttResult } from './types.js';

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

const MODEL_SIZE_BYTES: Record<WhisperModelSize, number> = {
  tiny: 75 * 1024 * 1024,
  base: 142 * 1024 * 1024,
  small: 466 * 1024 * 1024,
  medium: 1_500 * 1024 * 1024,
  'large-v3': 3_094 * 1024 * 1024,
};

export class LocalWhisperStt implements SttProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #size: WhisperModelSize;

  constructor(size: WhisperModelSize = 'small') {
    this.#size = size;
    this.descriptor = {
      id: `whisper-local-${size}`,
      kind: 'stt',
      displayName: `Whisper.cpp · ${size}`,
      vendor: 'OpenAI · ggerganov/whisper.cpp',
      local: true,
      languages: ['*'],
    };
  }

  async status(): Promise<ProviderStatus> {
    return { state: 'needs-download', sizeBytes: MODEL_SIZE_BYTES[this.#size] };
  }

  async transcribe(
    _audio: Float32Array,
    _opts: { sampleRate: number; language?: string },
  ): Promise<SttResult> {
    throw new Error('LocalWhisperStt.transcribe is not yet wired — pending milestone 2.');
  }
}
