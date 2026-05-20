import type { ClaudeTalkApi } from '../shared/ipc-types';

declare global {
  interface Window {
    claudetalk: ClaudeTalkApi;
  }
}

export {};
