export type ProviderKind = 'stt' | 'tts';

export type ProviderStatus =
  | { state: 'ready' }
  | { state: 'needs-download'; sizeBytes: number }
  | { state: 'downloading'; progress: number }
  | { state: 'needs-api-key' }
  | { state: 'unavailable'; reason: string };

export interface ProviderDescriptor {
  id: string;
  kind: ProviderKind;
  displayName: string;
  vendor: string;
  local: boolean;
  languages: string[];
}

export interface VoiceDescriptor {
  id: string;
  displayName: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  previewUrl: string;
  sampleText: string;
}

export interface SttResult {
  text: string;
  language?: string;
  durationMs: number;
  isFinal: boolean;
}

export interface SttProvider {
  readonly descriptor: ProviderDescriptor;
  status(): Promise<ProviderStatus>;
  download?(onProgress: (progress: number) => void, signal: AbortSignal): Promise<void>;
  transcribe(audio: Float32Array, opts: { sampleRate: number; language?: string }): Promise<SttResult>;
}

export interface TtsSynthesisChunk {
  pcm: Float32Array;
  sampleRate: number;
  isFinal: boolean;
}

export interface TtsProvider {
  readonly descriptor: ProviderDescriptor;
  voices(): Promise<VoiceDescriptor[]>;
  status(): Promise<ProviderStatus>;
  download?(onProgress: (progress: number) => void, signal: AbortSignal): Promise<void>;
  synthesize(
    text: string,
    opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk>;
}
