import { encodeWav } from '../audio/encode-wav.js';
import type { ProviderDescriptor, ProviderStatus, SttProvider, SttResult } from './types.js';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

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
    audio: Float32Array,
    opts: { sampleRate: number; language?: string },
  ): Promise<SttResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) throw new Error('OPENAI_API_KEY is not set');

    const started = Date.now();
    const wav = encodeWav(audio, opts.sampleRate);

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');
    if (opts.language !== undefined) form.append('language', opts.language);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI Whisper API error ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { text: string; language?: string };
    return {
      text: json.text,
      ...(json.language !== undefined && { language: json.language }),
      durationMs: Date.now() - started,
      isFinal: true,
    };
  }
}
