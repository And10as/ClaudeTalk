import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeWav } from './encode-wav.js';

export interface PlaybackHandle {
  finished: Promise<void>;
  stop: () => void;
}

/**
 * Writes the given PCM as a WAV file and plays it via the OS audio CLI.
 * - macOS: afplay
 * - Linux: aplay (falls back to paplay if available)
 * - Windows: not supported in this build.
 */
export function playPcm(pcm: Float32Array, sampleRate: number): PlaybackHandle {
  let child: ChildProcess | null = null;
  let tmpDir: string | null = null;
  let stopped = false;

  const finished = (async (): Promise<void> => {
    tmpDir = await mkdtemp(join(tmpdir(), 'claudetalk-play-'));
    const wavPath = join(tmpDir, 'out.wav');
    await writeFile(wavPath, encodeWav(pcm, sampleRate));

    const [cmd, ...args] = pickPlayer(wavPath);
    if (cmd === undefined) {
      throw new Error('No audio player available (need afplay on macOS, aplay/paplay on Linux).');
    }

    if (stopped) return;

    await new Promise<void>((resolve, reject) => {
      child = spawn(cmd, args, { stdio: 'ignore' });
      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (stopped || signal === 'SIGINT' || signal === 'SIGTERM' || code === 0) resolve();
        else reject(new Error(`Audio player exited code=${code} signal=${signal}`));
      });
    });
  })().finally(() => {
    if (tmpDir !== null) {
      const dir = tmpDir;
      setTimeout(() => {
        rm(dir, { recursive: true, force: true }).catch(() => {
          /* ignore */
        });
      }, 2_000);
    }
  });

  return {
    finished,
    stop: () => {
      stopped = true;
      child?.kill('SIGTERM');
    },
  };
}

function pickPlayer(wavPath: string): string[] {
  if (process.platform === 'darwin') return ['afplay', wavPath];
  if (process.platform === 'linux') return ['aplay', '-q', wavPath];
  return [];
}
