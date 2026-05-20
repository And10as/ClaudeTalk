import { app, safeStorage } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export type SecretKey = 'openai' | 'anthropic' | 'elevenlabs';

const SECRET_KEYS: ReadonlyArray<SecretKey> = ['openai', 'anthropic', 'elevenlabs'];

interface SecretsFile {
  // base64-encoded encrypted blobs
  [key: string]: string | undefined;
}

function secretsPath(): string {
  return join(app.getPath('userData'), 'secrets.json');
}

async function readFileSafe(path: string): Promise<SecretsFile> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as SecretsFile;
  } catch {
    return {};
  }
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available on this platform');
  }
  const path = secretsPath();
  await mkdir(app.getPath('userData'), { recursive: true });
  const current = await readFileSafe(path);
  if (value.length === 0) {
    delete current[key];
  } else {
    current[key] = safeStorage.encryptString(value).toString('base64');
  }
  await writeFile(path, JSON.stringify(current, null, 2), 'utf8');
}

export async function getSecret(key: SecretKey): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const current = await readFileSafe(secretsPath());
  const blob = current[key];
  if (blob === undefined) return null;
  try {
    return safeStorage.decryptString(Buffer.from(blob, 'base64'));
  } catch {
    return null;
  }
}

export async function getSecretStatus(): Promise<Record<SecretKey, boolean>> {
  const current = await readFileSafe(secretsPath());
  return Object.fromEntries(SECRET_KEYS.map((k) => [k, current[k] !== undefined])) as Record<
    SecretKey,
    boolean
  >;
}

export async function loadAllToEnv(): Promise<void> {
  for (const key of SECRET_KEYS) {
    const value = await getSecret(key);
    if (value === null) continue;
    const envName = `${key.toUpperCase()}_API_KEY`;
    process.env[envName] = value;
  }
}
