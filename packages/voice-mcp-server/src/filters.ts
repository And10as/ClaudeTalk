const BRACKETED = /\[[^\]]*\]/g;
const PARENTHESIZED = /\([^)]*\)/g;
const HALLUCINATION_PHRASES = [
  /^\s*you\s*$/i,
  /^\s*thank you\.?\s*$/i,
  /^\s*thanks for watching\.?\s*$/i,
  /^\s*\.\.\.+\s*$/,
  /^\s*\[?music\]?\s*$/i,
  /^\s*\[?applause\]?\s*$/i,
];

export function filterHallucinations(text: string): string | null {
  const stripped = text.replace(BRACKETED, '').replace(PARENTHESIZED, '').trim();
  if (stripped.length === 0) return null;
  for (const p of HALLUCINATION_PHRASES) if (p.test(stripped)) return null;
  const words = stripped.split(/\s+/);
  if (words.length < 2) return null;
  return stripped;
}

const TTS_HISTORY_MS = 15_000;
const ECHO_OVERLAP_THRESHOLD = 0.4;

interface TtsHistoryEntry {
  words: Set<string>;
  at: number;
}

export class TtsEchoFilter {
  #history: TtsHistoryEntry[] = [];

  recordSpoken(text: string): void {
    const words = new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter(Boolean),
    );
    if (words.size === 0) return;
    this.#history.push({ words, at: Date.now() });
    this.#prune();
  }

  isLikelyEcho(transcript: string): boolean {
    this.#prune();
    if (this.#history.length === 0) return false;
    const trans = transcript
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean);
    if (trans.length === 0) return false;
    const merged = new Set<string>();
    for (const entry of this.#history) for (const w of entry.words) merged.add(w);
    let matches = 0;
    for (const w of trans) if (merged.has(w)) matches += 1;
    return matches / trans.length > ECHO_OVERLAP_THRESHOLD;
  }

  #prune(): void {
    const cutoff = Date.now() - TTS_HISTORY_MS;
    while (this.#history.length > 0 && this.#history[0]!.at < cutoff) this.#history.shift();
  }
}
