import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface PersistedSettings {
  sttProviderId?: string;
  ttsProviderId?: string;
  ttsVoiceId?: string;
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

let cache: PersistedSettings | null = null;

export async function loadSettings(): Promise<PersistedSettings> {
  if (cache !== null) return cache;
  try {
    const raw = await readFile(settingsPath(), 'utf8');
    cache = JSON.parse(raw) as PersistedSettings;
  } catch {
    cache = {};
  }
  return cache;
}

export async function saveSettings(partial: Partial<PersistedSettings>): Promise<PersistedSettings> {
  const current = await loadSettings();
  const next: PersistedSettings = { ...current, ...partial };
  const path = settingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
  cache = next;
  return next;
}
