import { contextBridge, ipcRenderer } from 'electron';
import type { AppPlatform, ClaudeTalkApi, ListProvidersResult } from '../shared/ipc-types';

const api: ClaudeTalkApi = {
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  appPlatform: () => ipcRenderer.invoke('app:platform') as Promise<AppPlatform>,
  mcp: {
    listProviders: () => ipcRenderer.invoke('mcp:listProviders') as Promise<ListProvidersResult>,
    setProvider: (kind, providerId) =>
      ipcRenderer.invoke('mcp:setProvider', kind, providerId) as Promise<string>,
  },
};

contextBridge.exposeInMainWorld('claudetalk', api);
