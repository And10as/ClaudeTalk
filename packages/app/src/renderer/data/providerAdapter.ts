import type { ListProvidersResult, ProviderEntry } from '../../shared/ipc-types';
import type { UiProvider, UiStatus, UiVoice } from './mockProviders';

export function adaptProvidersResult(result: ListProvidersResult): {
  stt: UiProvider[];
  tts: UiProvider[];
} {
  return {
    stt: result.stt.map(adaptProvider),
    tts: result.tts.map(adaptProvider),
  };
}

function adaptProvider(entry: ProviderEntry): UiProvider {
  return {
    id: entry.descriptor.id,
    displayName: entry.descriptor.displayName,
    vendor: entry.descriptor.vendor,
    local: entry.descriptor.local,
    status: adaptStatus(entry.status),
    ...(entry.voices !== undefined && { voices: entry.voices.map(adaptVoice) }),
  };
}

function adaptStatus(status: ProviderEntry['status']): UiStatus {
  switch (status.state) {
    case 'ready':
      return { kind: 'ready' };
    case 'needs-download':
      return { kind: 'needs-download', sizeBytes: status.sizeBytes };
    case 'downloading':
      return { kind: 'downloading', progress: status.progress };
    case 'needs-api-key':
      return { kind: 'needs-api-key' };
    case 'unavailable':
      return { kind: 'unavailable', reason: status.reason };
  }
}

function adaptVoice(v: NonNullable<ProviderEntry['voices']>[number]): UiVoice {
  return {
    id: v.id,
    displayName: v.displayName,
    language: v.language,
    ...(v.gender !== undefined && { gender: v.gender }),
    previewUrl: v.previewUrl,
  };
}
