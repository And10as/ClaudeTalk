import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { app } from 'electron';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDownloaded } from './downloads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ProviderEntry {
  descriptor: {
    id: string;
    kind: 'stt' | 'tts';
    displayName: string;
    vendor: string;
    local: boolean;
    languages: string[];
  };
  status:
    | { state: 'ready' }
    | { state: 'needs-download'; sizeBytes: number }
    | { state: 'downloading'; progress: number }
    | { state: 'needs-api-key' }
    | { state: 'unavailable'; reason: string };
  voices?: Array<{
    id: string;
    displayName: string;
    language: string;
    gender?: 'male' | 'female' | 'neutral';
    previewUrl: string;
    sampleText: string;
  }>;
}

export interface ListProvidersResult {
  stt: ProviderEntry[];
  tts: ProviderEntry[];
}

export class VoiceMcpHost {
  #client: Client | null = null;

  async connect(): Promise<void> {
    if (this.#client !== null) return;

    const serverPath = resolveServerEntry();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        ...(process.env as Record<string, string>),
        ELECTRON_RUN_AS_NODE: '1',
      },
    });

    const client = new Client(
      { name: 'claudetalk-app', version: app.getVersion() },
      { capabilities: {} },
    );

    await client.connect(transport);
    this.#client = client;
  }

  async listProviders(): Promise<ListProvidersResult> {
    const client = this.#require();
    const result = await client.callTool({ name: 'list_providers', arguments: {} });
    const text = extractText(result);
    const raw = JSON.parse(text) as ListProvidersResult;
    return {
      stt: await Promise.all(raw.stt.map(reconcileWithDisk)),
      tts: await Promise.all(raw.tts.map(reconcileWithDisk)),
    };
  }

  async setProvider(kind: 'stt' | 'tts', providerId: string): Promise<string> {
    const client = this.#require();
    const result = await client.callTool({
      name: 'set_provider',
      arguments: { kind, providerId },
    });
    return extractText(result);
  }

  async close(): Promise<void> {
    if (this.#client === null) return;
    await this.#client.close();
    this.#client = null;
  }

  async restart(): Promise<void> {
    await this.close();
    await this.connect();
  }

  #require(): Client {
    if (this.#client === null) throw new Error('VoiceMcpHost not connected');
    return this.#client;
  }
}

function resolveServerEntry(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'voice-mcp-server', 'dist', 'index.js');
  }
  return resolve(__dirname, '../../../voice-mcp-server/dist/index.js');
}

async function reconcileWithDisk(entry: ProviderEntry): Promise<ProviderEntry> {
  if (!entry.descriptor.local) return entry;
  if (entry.status.state === 'ready' || entry.status.state === 'downloading') return entry;
  if (await isDownloaded(entry.descriptor.id)) {
    return { ...entry, status: { state: 'ready' } };
  }
  return entry;
}

function extractText(result: unknown): string {
  const r = result as { content?: Array<{ type?: string; text?: string }> };
  const first = r.content?.[0];
  if (first?.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('MCP tool returned no text content');
  }
  return first.text;
}
