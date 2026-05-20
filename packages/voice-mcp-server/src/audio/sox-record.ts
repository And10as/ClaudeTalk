import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RecordOptions {
  sampleRate?: number;
  maxDurationSec?: number;
  silenceDurationSec?: number;
  silenceThreshold?: string;
  signal?: AbortSignal;
}

export interface RecordResult {
  pcm: Float32Array;
  sampleRate: number;
  wavPath: string;
}

/**
 * Records from the default mic via sox until either silenceDurationSec of
 * silence is detected (default 1.5 s) or maxDurationSec elapses (default 30 s).
 *
 * Requires `sox` on the PATH. On macOS: `brew install sox`.
 */
export async function recordWithSox(opts: RecordOptions = {}): Promise<RecordResult> {
  const sampleRate = opts.sampleRate ?? 16_000;
  const maxDur = opts.maxDurationSec ?? 30;
  const silenceDur = opts.silenceDurationSec ?? 1.5;
  const silenceThreshold = opts.silenceThreshold ?? '2%';

  await ensureSox();

  const dir = await mkdtemp(join(tmpdir(), 'claudetalk-rec-'));
  const wavPath = join(dir, 'rec.wav');

  const args = [
    '-d',
    '-t', 'wav',
    '-r', String(sampleRate),
    '-c', '1',
    '-b', '16',
    '-e', 'signed-integer',
    wavPath,
    'silence',
    '1', '0.2', '3%',
    '1', String(silenceDur), silenceThreshold,
    'trim', '0', String(maxDur),
  ];

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('sox', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderrBuf = '';
      child.stderr.on('data', (d: Buffer) => {
        stderrBuf += d.toString();
      });
      opts.signal?.addEventListener('abort', () => child.kill('SIGINT'), { once: true });
      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (code === 0) resolve();
        else if (signal === 'SIGINT') resolve();
        else reject(new Error(`sox exited code=${code} signal=${signal} stderr=${stderrBuf}`));
      });
    });

    const raw = await readFile(wavPath);
    const pcm = decodeWavToFloat32(raw, sampleRate);
    return { pcm, sampleRate, wavPath };
  } finally {
    // Caller may want the file path; cleanup is deferred to the caller via wavPath dir.
    // We schedule a best-effort cleanup after a short delay.
    setTimeout(() => {
      rm(dir, { recursive: true, force: true }).catch(() => {
        /* ignore */
      });
    }, 5_000);
  }
}

async function ensureSox(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('sox', ['--version'], { stdio: 'ignore' });
    child.on('error', () => {
      reject(
        new Error(
          'sox is required for microphone capture but was not found on PATH. ' +
            'Install it with `brew install sox` (macOS) or `apt-get install sox` (Linux).',
        ),
      );
    });
    child.on('exit', (code) => {
      if (code === 0 || code === 1) resolve();
      else reject(new Error(`sox --version exited ${code}`));
    });
  });
}

export function decodeWavToFloat32(buf: Buffer, expectedSampleRate: number): Float32Array {
  // Minimal WAV parser: locate the "data" chunk, read int16 LE samples.
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.byteLength) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (dataOffset === -1) throw new Error('WAV missing data chunk');

  const end = Math.min(dataOffset + dataSize, buf.byteLength);
  const numSamples = Math.floor((end - dataOffset) / 2);
  const out = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i += 1) {
    out[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  }
  // Note: we trust the caller's expectedSampleRate; sox is told to record at that rate.
  if (expectedSampleRate <= 0) {
    /* satisfy noUnused */
  }
  return out;
}
