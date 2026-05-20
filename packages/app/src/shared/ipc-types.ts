export interface ProviderEntry {
  descriptor: {
    id: string;
    kind: 'stt' | 'tts';
    displayName: string;
    vendor: string;
    local: boolean;
    languages: string[];
  };
  status:
    | { state: 'ready' }
    | { state: 'needs-download'; sizeBytes: number }
    | { state: 'downloading'; progress: number }
    | { state: 'needs-api-key' }
    | { state: 'unavailable'; reason: string };
  voices?: Array<{
    id: string;
    displayName: string;
    language: string;
    gender?: 'male' | 'female' | 'neutral';
    previewUrl: string;
    sampleText: string;
  }>;
}

export interface ListProvidersResult {
  stt: ProviderEntry[];
  tts: ProviderEntry[];
}

export type AppPlatform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd';

export type SecretKey = 'openai' | 'anthropic' | 'elevenlabs';

import type { VoiceEvent } from './voice-events';

export interface ClaudeTalkApi {
  appVersion: () => Promise<string>;
  appPlatform: () => Promise<AppPlatform>;
  mcp: {
    listProviders: () => Promise<ListProvidersResult>;
    setProvider: (kind: 'stt' | 'tts', providerId: string) => Promise<string>;
  };
  secrets: {
    status: () => Promise<Record<SecretKey, boolean>>;
    set: (key: SecretKey, value: string) => Promise<void>;
  };
  voice: {
    start: () => Promise<void>;
    endTurn: (audio: ArrayBuffer, sampleRate: number) => Promise<void>;
    stop: () => Promise<void>;
    bargeIn: () => Promise<void>;
    reset: () => Promise<void>;
    onEvent: (cb: (e: VoiceEvent) => void) => () => void;
  };
}
