#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConversationFsm } from './fsm.js';
import { KokoroTts } from './providers/tts-kokoro.js';
import { MacSayTts } from './providers/tts-say.js';
import { OpenAiTts } from './providers/tts-openai.js';
import { OpenAiWhisperApiStt } from './providers/stt-openai.js';
import { PiperTts } from './providers/tts-piper.js';
import { LocalWhisperStt } from './providers/stt-whisper-local.js';
import { registry } from './providers/registry.js';
import { createVoiceMcpServer } from './server.js';

function registerDefaults(): void {
  registry.registerStt(new OpenAiWhisperApiStt());
  registry.registerStt(new LocalWhisperStt('tiny'));
  registry.registerStt(new LocalWhisperStt('base'));
  registry.registerStt(new LocalWhisperStt('small'));
  registry.registerStt(new LocalWhisperStt('medium'));

  registry.registerTts(new OpenAiTts());
  registry.registerTts(new KokoroTts());
  registry.registerTts(new PiperTts());
  registry.registerTts(new MacSayTts());

  // Sensible defaults so listen/speak work out of the box.
  const preferredStt = process.env.OPENAI_API_KEY ? 'openai-whisper-api' : 'whisper-local-small';
  const preferredTts =
    process.env.OPENAI_API_KEY ? 'openai-tts' : process.platform === 'darwin' ? 'mac-say' : 'openai-tts';
  try { registry.setActiveStt(preferredStt); } catch { /* fall back below */ }
  try { registry.setActiveTts(preferredTts); } catch { /* fall back below */ }
}

async function main(): Promise<void> {
  registerDefaults();
  const fsm = new ConversationFsm();
  const server = createVoiceMcpServer({ fsm });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[claudetalk-voice] MCP server ready on stdio\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`[claudetalk-voice] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
