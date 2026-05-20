import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ProviderDescriptor, ProviderStatus, SttProvider, SttResult } from './types.js';

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

const MODEL_SIZE_BYTES: Record<WhisperModelSize, number> = {
  tiny: 75 * 1024 * 1024,
  base: 142 * 1024 * 1024,
  small: 466 * 1024 * 1024,
  medium: 1_500 * 1024 * 1024,
  'large-v3': 3_094 * 1024 * 1024,
};

interface SmartWhisperLike {
  transcribe: (
    audio: Float32Array,
    opts?: { language?: string; n_threads?: number },
  ) => Promise<{ result: Promise<Array<{ text: string }>> }>;
  free: () => Promise<void>;
}

type SmartWhisperCtor = new (modelPath: string, options?: { gpu?: boolean }) => SmartWhisperLike;

let cachedCtor: SmartWhisperCtor | null = null;

async function getWhisperCtor(): Promise<SmartWhisperCtor> {
  if (cachedCtor !== null) return cachedCtor;
  const mod = (await import('smart-whisper')) as { Whisper: SmartWhisperCtor };
  cachedCtor = mod.Whisper;
  return cachedCtor;
}

function resolveModelsDir(): string {
  if (process.env.CLAUDETALK_MODELS_DIR !== undefined) {
    return process.env.CLAUDETALK_MODELS_DIR;
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'ClaudeTalk', 'models');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'ClaudeTalk', 'models');
  }
  return join(homedir(), '.config', 'ClaudeTalk', 'models');
}

export class LocalWhisperStt implements SttProvider {
  readonly descriptor: ProviderDescriptor;
  readonly #size: WhisperModelSize;
  #whisper: SmartWhisperLike | null = null;
  #loadingPath: string | null = null;

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

  #modelPath(): string {
    return join(resolveModelsDir(), 'whisper', `ggml-${this.#size}.bin`);
  }

  async status(): Promise<ProviderStatus> {
    try {
      const s = await stat(this.#modelPath());
      if (s.isFile() && s.size > 0) return { state: 'ready' };
    } catch {
      /* file missing */
    }
    return { state: 'needs-download', sizeBytes: MODEL_SIZE_BYTES[this.#size] };
  }

  async transcribe(
    audio: Float32Array,
    opts: { sampleRate: number; language?: string },
  ): Promise<SttResult> {
    if (opts.sampleRate !== 16000) {
      throw new Error(`Local Whisper requires 16 kHz audio (got ${opts.sampleRate} Hz).`);
    }

    const started = Date.now();
    const whisper = await this.#ensureLoaded();

    const transcribeOpts: { language?: string; n_threads: number } = {
      n_threads: 4,
    };
    if (opts.language !== undefined) transcribeOpts.language = opts.language;

    const task = await whisper.transcribe(audio, transcribeOpts);
    const segments = await task.result;
    const text = segments.map((r) => r.text).join(' ').trim();

    return {
      text,
      durationMs: Date.now() - started,
      isFinal: true,
    };
  }

  async #ensureLoaded(): Promise<SmartWhisperLike> {
    const path = this.#modelPath();
    if (this.#whisper !== null && this.#loadingPath === path) return this.#whisper;

    try {
      await stat(path);
    } catch {
      throw new Error(
        `Whisper model not found at ${path}. Download it from Settings first.`,
      );
    }

    if (this.#whisper !== null) {
      try {
        await this.#whisper.free();
      } catch {
        /* ignore */
      }
    }

    const Ctor = await getWhisperCtor();
    this.#whisper = new Ctor(path, { gpu: true });
    this.#loadingPath = path;
    return this.#whisper;
  }

  async dispose(): Promise<void> {
    if (this.#whisper !== null) {
      try {
        await this.#whisper.free();
      } catch {
        /* ignore */
      }
      this.#whisper = null;
      this.#loadingPath = null;
    }
  }
}
