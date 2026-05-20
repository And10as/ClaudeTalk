import type {
  ProviderDescriptor,
  ProviderStatus,
  TtsProvider,
  TtsSynthesisChunk,
  VoiceDescriptor,
} from './types.js';

const ENDPOINT = 'https://api.openai.com/v1/audio/speech';

const OPENAI_VOICES: ReadonlyArray<{ id: string; gender: VoiceDescriptor['gender'] }> = [
  { id: 'alloy', gender: 'neutral' },
  { id: 'echo', gender: 'male' },
  { id: 'fable', gender: 'male' },
  { id: 'onyx', gender: 'male' },
  { id: 'nova', gender: 'female' },
  { id: 'shimmer', gender: 'female' },
];

const OUTPUT_SAMPLE_RATE = 24_000;

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

  async *synthesize(
    text: string,
    opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) throw new Error('OPENAI_API_KEY is not set');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: opts.voiceId,
        response_format: 'pcm',
        speed: opts.speed ?? 1.0,
      }),
    });

    if (!res.ok || res.body === null) {
      const body = res.body !== null ? await res.text() : '';
      throw new Error(`OpenAI TTS error ${res.status}: ${body}`);
    }

    const reader = res.body.getReader();
    let leftover = new Uint8Array(0);

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (leftover.byteLength > 0) {
          yield { pcm: int16ToFloat32(leftover), sampleRate: OUTPUT_SAMPLE_RATE, isFinal: true };
        } else {
          yield { pcm: new Float32Array(0), sampleRate: OUTPUT_SAMPLE_RATE, isFinal: true };
        }
        return;
      }
      const combined = new Uint8Array(leftover.byteLength + value.byteLength);
      combined.set(leftover, 0);
      combined.set(value, leftover.byteLength);

      const alignedLength = combined.byteLength - (combined.byteLength % 2);
      const aligned = combined.subarray(0, alignedLength);
      leftover = combined.subarray(alignedLength);

      yield {
        pcm: int16ToFloat32(aligned),
        sampleRate: OUTPUT_SAMPLE_RATE,
        isFinal: false,
      };
    }
  }
}

function int16ToFloat32(bytes: Uint8Array): Float32Array {
  const out = new Float32Array(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}
