export class PcmPlayer {
  #ctx: AudioContext | null = null;
  #nextStart = 0;
  #activeSources = new Set<AudioBufferSourceNode>();

  enqueue(pcm: ArrayBuffer, sampleRate: number): void {
    const ctx = this.#ensureContext();
    const samples = new Float32Array(pcm);
    if (samples.length === 0) return;

    const buf = ctx.createBuffer(1, samples.length, sampleRate);
    buf.copyToChannel(samples, 0);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, this.#nextStart);
    src.start(startAt);
    this.#nextStart = startAt + buf.duration;

    this.#activeSources.add(src);
    src.addEventListener('ended', () => this.#activeSources.delete(src), { once: true });
  }

  stop(): void {
    for (const src of this.#activeSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.#activeSources.clear();
    if (this.#ctx !== null) this.#nextStart = this.#ctx.currentTime;
  }

  async dispose(): Promise<void> {
    this.stop();
    if (this.#ctx !== null) {
      await this.#ctx.close();
      this.#ctx = null;
    }
  }

  #ensureContext(): AudioContext {
    if (this.#ctx === null) {
      this.#ctx = new AudioContext();
      this.#nextStart = this.#ctx.currentTime;
    }
    return this.#ctx;
  }
}
