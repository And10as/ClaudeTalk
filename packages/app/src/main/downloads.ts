import { app } from 'electron';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type DownloadKind = 'stt' | 'tts';

export interface DownloadProgress {
  state: 'started' | 'progress' | 'done' | 'error';
  bytesReceived?: number;
  bytesTotal?: number;
  message?: string;
}

interface DownloadSpec {
  url: string;
  filename: string;
  expectedBytes?: number;
}

const REGISTRY: Record<string, DownloadSpec> = {
  'whisper-local-tiny': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    filename: 'whisper/ggml-tiny.bin',
    expectedBytes: 77_700_000,
  },
  'whisper-local-base': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    filename: 'whisper/ggml-base.bin',
    expectedBytes: 147_900_000,
  },
  'whisper-local-small': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    filename: 'whisper/ggml-small.bin',
    expectedBytes: 487_600_000,
  },
  'whisper-local-medium': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    filename: 'whisper/ggml-medium.bin',
    expectedBytes: 1_530_000_000,
  },
};

export function modelsDir(): string {
  return join(app.getPath('userData'), 'models');
}

export function modelPath(providerId: string): string | null {
  const spec = REGISTRY[providerId];
  if (spec === undefined) return null;
  return join(modelsDir(), spec.filename);
}

export async function isDownloaded(providerId: string): Promise<boolean> {
  const path = modelPath(providerId);
  if (path === null) return false;
  try {
    const s = await stat(path);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

export async function startDownload(
  _kind: DownloadKind,
  providerId: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const spec = REGISTRY[providerId];
  if (spec === undefined) {
    onProgress({ state: 'error', message: `Unknown provider: ${providerId}` });
    throw new Error(`No download spec for ${providerId}`);
  }

  const finalPath = join(modelsDir(), spec.filename);
  const tmpPath = `${finalPath}.part`;
  await mkdir(dirname(finalPath), { recursive: true });

  onProgress({ state: 'started', bytesTotal: spec.expectedBytes ?? 0 });

  let res: Response;
  try {
    res = await fetch(spec.url);
  } catch (err) {
    onProgress({ state: 'error', message: (err as Error).message });
    throw err;
  }
  if (!res.ok || res.body === null) {
    onProgress({ state: 'error', message: `HTTP ${res.status}` });
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const contentLength = res.headers.get('content-length');
  const total = contentLength !== null ? Number(contentLength) : spec.expectedBytes ?? 0;
  let received = 0;
  let lastEmit = 0;

  const sink = createWriteStream(tmpPath);
  const reader = res.body.getReader();

  const source = new Readable({
    read() {
      void (async (): Promise<void> => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
            return;
          }
          received += value.byteLength;
          const now = Date.now();
          if (now - lastEmit > 120) {
            lastEmit = now;
            onProgress({ state: 'progress', bytesReceived: received, bytesTotal: total });
          }
          this.push(Buffer.from(value));
        } catch (err) {
          this.destroy(err as Error);
        }
      })();
    },
  });

  try {
    await pipeline(source, sink);
    await rename(tmpPath, finalPath);
    onProgress({ state: 'done', bytesReceived: received, bytesTotal: total });
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    onProgress({ state: 'error', message: (err as Error).message });
    throw err;
  }
}
