import { appendFile, mkdir, stat, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type EventLevel = 'info' | 'warn' | 'error';

export interface VoiceEventLogEntry {
  ts: string;
  level: EventLevel;
  event: string;
  details?: Record<string, unknown>;
}

const ROTATE_BYTES = 1_000_000;

function defaultLogsDir(): string {
  if (process.env.CLAUDETALK_LOGS_DIR !== undefined) return process.env.CLAUDETALK_LOGS_DIR;
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'ClaudeTalk', 'logs');
  }
  if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'ClaudeTalk',
      'logs',
    );
  }
  return join(homedir(), '.config', 'ClaudeTalk', 'logs');
}

let cachedPath: string | null = null;

function eventsPath(): string {
  if (cachedPath !== null) return cachedPath;
  cachedPath = join(defaultLogsDir(), 'events.jsonl');
  return cachedPath;
}

export async function logEvent(
  event: string,
  details?: Record<string, unknown>,
  level: EventLevel = 'info',
): Promise<void> {
  try {
    const path = eventsPath();
    await mkdir(dirname(path), { recursive: true });

    try {
      const s = await stat(path);
      if (s.size > ROTATE_BYTES) {
        await rename(path, `${path}.1`);
      }
    } catch {
      /* file may not exist yet */
    }

    const entry: VoiceEventLogEntry = {
      ts: new Date().toISOString(),
      level,
      event,
      ...(details !== undefined && { details }),
    };
    await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (err) {
    process.stderr.write(`[event-log] write failed: ${(err as Error).message}\n`);
  }
}

export function eventsLogPath(): string {
  return eventsPath();
}
