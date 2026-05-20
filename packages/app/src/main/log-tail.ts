import type { WebContents } from 'electron';
import { eventsLogPath, type VoiceEventLogEntry } from '@claudetalk/voice-mcp-server';
import { mkdir, open, stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Streams every new line written to events.jsonl to the renderer as
 * `voice:logEvent` IPC messages. Polls via fs.watch + position tracking so we
 * don't need a third-party tail lib.
 */
export class EventLogTail {
  #wc: WebContents | null = null;
  #watcher: FSWatcher | null = null;
  #position = 0;
  #pending = false;
  #pollingTimer: NodeJS.Timeout | null = null;

  async start(wc: WebContents): Promise<void> {
    this.#wc = wc;
    const path = eventsLogPath();
    await mkdir(dirname(path), { recursive: true });
    try {
      const s = await stat(path);
      this.#position = Math.max(0, s.size - 16 * 1024); // tail last 16KB on start
    } catch {
      this.#position = 0;
    }

    await this.#drain();

    try {
      this.#watcher = watch(path, () => {
        void this.#drain();
      });
    } catch {
      // File may not exist yet; fall back to polling.
      this.#pollingTimer = setInterval(() => {
        void this.#drain();
      }, 1_000);
    }
  }

  stop(): void {
    this.#wc = null;
    this.#watcher?.close();
    this.#watcher = null;
    if (this.#pollingTimer !== null) {
      clearInterval(this.#pollingTimer);
      this.#pollingTimer = null;
    }
  }

  async #drain(): Promise<void> {
    if (this.#pending) return;
    this.#pending = true;
    try {
      const path = eventsLogPath();
      let s;
      try {
        s = await stat(path);
      } catch {
        return;
      }
      if (s.size < this.#position) {
        // File rotated or truncated.
        this.#position = 0;
      }
      if (s.size === this.#position) return;

      const handle = await open(path, 'r');
      try {
        const length = s.size - this.#position;
        const buf = Buffer.alloc(length);
        await handle.read(buf, 0, length, this.#position);
        this.#position = s.size;
        const text = buf.toString('utf8');
        const lines = text.split('\n').filter((l) => l.length > 0);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as VoiceEventLogEntry;
            this.#wc?.send('voice:logEvent', entry);
          } catch {
            /* skip malformed lines */
          }
        }
      } finally {
        await handle.close();
      }
    } finally {
      this.#pending = false;
    }
  }
}
