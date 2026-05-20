import type { SttProvider, TtsProvider } from './types.js';

class ProviderRegistry {
  #stt = new Map<string, SttProvider>();
  #tts = new Map<string, TtsProvider>();
  #activeStt: string | null = null;
  #activeTts: string | null = null;

  registerStt(provider: SttProvider): void {
    this.#stt.set(provider.descriptor.id, provider);
    if (this.#activeStt === null) this.#activeStt = provider.descriptor.id;
  }

  registerTts(provider: TtsProvider): void {
    this.#tts.set(provider.descriptor.id, provider);
    if (this.#activeTts === null) this.#activeTts = provider.descriptor.id;
  }

  listStt(): SttProvider[] {
    return [...this.#stt.values()];
  }

  listTts(): TtsProvider[] {
    return [...this.#tts.values()];
  }

  setActiveStt(id: string): void {
    if (!this.#stt.has(id)) throw new Error(`Unknown STT provider: ${id}`);
    this.#activeStt = id;
  }

  setActiveTts(id: string): void {
    if (!this.#tts.has(id)) throw new Error(`Unknown TTS provider: ${id}`);
    this.#activeTts = id;
  }

  activeStt(): SttProvider {
    if (this.#activeStt === null) throw new Error('No STT provider registered');
    return this.#stt.get(this.#activeStt)!;
  }

  activeTts(): TtsProvider {
    if (this.#activeTts === null) throw new Error('No TTS provider registered');
    return this.#tts.get(this.#activeTts)!;
  }
}

export const registry = new ProviderRegistry();
