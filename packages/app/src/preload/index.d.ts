import type { ClaudeTalkApi } from './index';

declare global {
  interface Window {
    claudetalk: ClaudeTalkApi;
  }
}

export {};
