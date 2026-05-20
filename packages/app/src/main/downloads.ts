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

interface DownloadFile {
  url: string;
  filename: string;
  expectedBytes?: number;
}

interface DownloadSpec {
  files: DownloadFile[];
}

const REGISTRY: Record<string, DownloadSpec> = {
  'whisper-local-tiny': {
    files: [
      {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        filename: 'whisper/ggml-tiny.bin',
        expectedBytes: 77_700_000,
      },
    ],
  },
  'whisper-local-base': {
    files: [
      {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        filename: 'whisper/ggml-base.bin',
        expectedBytes: 147_900_000,
      },
    ],
  },
  'whisper-local-small': {
    files: [
      {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        filename: 'whisper/ggml-small.bin',
        expectedBytes: 487_600_000,
      },
    ],
  },
  'whisper-local-medium': {
    files: [
      {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        filename: 'whisper/ggml-medium.bin',
        expectedBytes: 1_530_000_000,
      },
    ],
  },
  'kokoro-local': {
    files: [
      {
        url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx',
        filename: 'kokoro/model.onnx',
        expectedBytes: 325_000_000,
      },
      {
        url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_bella.bin',
        filename: 'kokoro/voices/af_bella.bin',
        expectedBytes: 524_000,
      },
      {
        url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/am_adam.bin',
        filename: 'kokoro/voices/am_adam.bin',
        expectedBytes: 524_000,
      },
      {
        url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/bf_emma.bin',
        filename: 'kokoro/voices/bf_emma.bin',
        expectedBytes: 524_000,
      },
    ],
  },
  'piper-local': {
    files: [
      {
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx',
        filename: 'piper/en_US-amy-medium.onnx',
        expectedBytes: 63_200_000,
      },
      {
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json',
        filename: 'piper/en_US-amy-medium.onnx.json',
        expectedBytes: 5_200,
      },
    ],
  },
};

export function modelsDir(): string {
  return join(app.getPath('userData'), 'models');
}

export async function isDownloaded(providerId: string): Promise<boolean> {
  const spec = REGISTRY[providerId];
  if (spec === undefined) return false;
  for (const file of spec.files) {
    try {
      const s = await stat(join(modelsDir(), file.filename));
      if (!s.isFile() || s.size === 0) return false;
    } catch {
      return false;
    }
  }
  return true;
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

  const totalExpected = spec.files.reduce((acc, f) => acc + (f.expectedBytes ?? 0), 0);
  onProgress({ state: 'started', bytesTotal: totalExpected });

  let receivedAcrossFiles = 0;

  for (const file of spec.files) {
    const finalPath = join(modelsDir(), file.filename);
    const tmpPath = `${finalPath}.part`;
    await mkdir(dirname(finalPath), { recursive: true });

    let res: Response;
    try {
      res = await fetch(file.url);
    } catch (err) {
      onProgress({ state: 'error', message: (err as Error).message });
      throw err;
    }
    if (!res.ok || res.body === null) {
      onProgress({ state: 'error', message: `HTTP ${res.status} for ${file.url}` });
      throw new Error(`Download failed: HTTP ${res.status}`);
    }

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
            receivedAcrossFiles += value.byteLength;
            const now = Date.now();
            if (now - lastEmit > 120) {
              lastEmit = now;
              onProgress({
                state: 'progress',
                bytesReceived: receivedAcrossFiles,
                bytesTotal: totalExpected,
              });
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

  onProgress({ state: 'done', bytesReceived: receivedAcrossFiles, bytesTotal: totalExpected });
}
