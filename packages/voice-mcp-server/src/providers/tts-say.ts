import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const OUTPUT_SAMPLE_RATE = 22_050;

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

  async *synthesize(
    text: string,
    opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    if (process.platform !== 'darwin') throw new Error('say is macOS only');

    const dir = await mkdtemp(join(tmpdir(), 'claudetalk-say-'));
    const wavPath = join(dir, 'out.aiff');
    try {
      const wpm = opts.speed !== undefined ? Math.round(180 * opts.speed) : 180;
      const args = ['-v', opts.voiceId, '-o', wavPath, '-r', String(wpm), '--data-format=LEI16@22050', text];

      await new Promise<void>((resolve, reject) => {
        const child = spawn('say', args);
        opts.signal.addEventListener('abort', () => child.kill(), { once: true });
        child.on('error', reject);
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`say exited ${code}`))));
      });

      const raw = await readFile(wavPath);
      yield {
        pcm: parseAiffOrPcm(raw),
        sampleRate: OUTPUT_SAMPLE_RATE,
        isFinal: true,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function parseAiffOrPcm(buf: Buffer): Float32Array {
  // say with --data-format=LEI16@22050 writes raw little-endian int16 PCM
  // wrapped in an AIFF header. Strip the header by finding the SSND chunk.
  const ssndIdx = buf.indexOf('SSND');
  if (ssndIdx === -1) {
    return int16BufferToFloat32(buf);
  }
  const ssndSize = buf.readUInt32BE(ssndIdx + 4);
  const dataStart = ssndIdx + 16;
  const dataEnd = Math.min(dataStart + ssndSize - 8, buf.byteLength);
  return int16BufferToFloat32(buf.subarray(dataStart, dataEnd));
}

function int16BufferToFloat32(buf: Buffer): Float32Array {
  const out = new Float32Array(Math.floor(buf.byteLength / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = buf.readInt16LE(i * 2) / 32768;
  }
  return out;
}
