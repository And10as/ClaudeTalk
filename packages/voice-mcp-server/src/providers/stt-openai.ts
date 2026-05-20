import type { ProviderDescriptor, ProviderStatus, SttProvider, SttResult } from './types.js';

export class OpenAiWhisperApiStt implements SttProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'openai-whisper-api',
    kind: 'stt',
    displayName: 'OpenAI Whisper API',
    vendor: 'OpenAI',
    local: false,
    languages: ['*'],
  };

  async status(): Promise<ProviderStatus> {
    return process.env.OPENAI_API_KEY ? { state: 'ready' } : { state: 'needs-api-key' };
  }

  async transcribe(
    _audio: Float32Array,
    _opts: { sampleRate: number; language?: string },
  ): Promise<SttResult> {
    throw new Error('OpenAiWhisperApiStt.transcribe is not yet wired — pending milestone 2.');
  }
}
