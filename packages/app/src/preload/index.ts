import { contextBridge, ipcRenderer } from 'electron';

const api = {
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  appPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('app:platform'),
} as const;

export type ClaudeTalkApi = typeof api;

contextBridge.exposeInMainWorld('claudetalk', api);
