import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppPlatform,
  ClaudeTalkApi,
  DownloadProgressEvent,
  ListProvidersResult,
  SecretKey,
} from '../shared/ipc-types';
import type { VoiceEvent } from '../shared/voice-events';

const api: ClaudeTalkApi = {
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  appPlatform: () => ipcRenderer.invoke('app:platform') as Promise<AppPlatform>,
  mcp: {
    listProviders: () => ipcRenderer.invoke('mcp:listProviders') as Promise<ListProvidersResult>,
    setProvider: (kind, providerId) =>
      ipcRenderer.invoke('mcp:setProvider', kind, providerId) as Promise<string>,
  },
  secrets: {
    status: () => ipcRenderer.invoke('secrets:status') as Promise<Record<SecretKey, boolean>>,
    set: (key, value) => ipcRenderer.invoke('secrets:set', key, value) as Promise<void>,
  },
  voice: {
    start: () => ipcRenderer.invoke('voice:start') as Promise<void>,
    endTurn: (audio, sampleRate) =>
      ipcRenderer.invoke('voice:endTurn', audio, sampleRate) as Promise<void>,
    stop: () => ipcRenderer.invoke('voice:stop') as Promise<void>,
    bargeIn: () => ipcRenderer.invoke('voice:bargeIn') as Promise<void>,
    reset: () => ipcRenderer.invoke('voice:reset') as Promise<void>,
    onEvent: (cb) => {
      const handler = (_e: Electron.IpcRendererEvent, evt: VoiceEvent): void => cb(evt);
      ipcRenderer.on('voice:event', handler);
      return () => ipcRenderer.removeListener('voice:event', handler);
    },
  },
  models: {
    download: (kind, providerId) =>
      ipcRenderer.invoke('models:download', kind, providerId) as Promise<void>,
    onProgress: (cb) => {
      const handler = (_e: Electron.IpcRendererEvent, evt: DownloadProgressEvent): void => cb(evt);
      ipcRenderer.on('models:progress', handler);
      return () => ipcRenderer.removeListener('models:progress', handler);
    },
  },
};

contextBridge.exposeInMainWorld('claudetalk', api);
