# ClaudeTalk

Voice for Claude. Two ways to use it:

1. **In Claude Desktop / Code** (recommended) — ClaudeTalk runs as a local MCP server exposing `listen` and `speak` tools. You ask Claude to listen, Claude calls the tool, your mic records until you stop talking, Claude gets the transcript and replies; you ask Claude to say something, the audio plays through your speakers. You never leave Claude Desktop, and your existing subscription handles the LLM — **no Anthropic API key needed**.

2. **The standalone ClaudeTalk app** (optional) — Electron menubar app with its own chat surface that talks directly to the Anthropic API. Requires an Anthropic key.

## Setup for Claude Desktop (path #1)

**1. Install sox** (used for microphone capture):

```bash
brew install sox          # macOS
sudo apt install sox      # Linux
```

**2. Build the MCP server:**

```bash
pnpm install
pnpm --filter @claudetalk/voice-mcp-server build
```

**3. Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:**

```json
{
  "mcpServers": {
    "claudetalk-voice": {
      "command": "node",
      "args": [
        "/absolute/path/to/ClaudeTalk/packages/voice-mcp-server/dist/index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

`OPENAI_API_KEY` is optional — if missing, ClaudeTalk falls back to local Whisper for STT and macOS `say` for TTS.

**4. Restart Claude Desktop.** You should see `claudetalk-voice` in the MCP server list with these tools:

- `listen(silenceDurationSec?, maxDurationSec?, language?)` — records until silence, returns transcript
- `speak(text, voiceId?, speed?)` — synthesizes and plays through speakers
- `stop_speaking()` / `cancel_listening()` — interrupt either operation
- `set_provider(kind, providerId)` / `list_providers()`

Then in any Claude Desktop chat, just ask: *"Listen to what I'm about to say"* or *"Read your reply out loud"*. Claude will call the tools.

## Standalone app (path #2)

```bash
pnpm install
pnpm --filter @claudetalk/app dev
```

A 🎙 icon lands in your menubar; click it for the dropdown with chat, settings, and provider management. Requires an Anthropic API key (entered in Settings → API-nøkler).

## Architecture

```
packages/voice-mcp-server   Standalone MCP server (stdio).
                            Records mic via sox, plays audio via afplay/aplay,
                            and routes through swappable STT/TTS providers.
                            Conversation FSM, hallucination + echo filters.

packages/app                Electron menubar app — optional UI surface.
                              main/       hotkey, tray, MCP host, secrets,
                                          ConversationSession orchestrator
                              renderer/   React UI in Claude's design language
                              preload/    typed IPC bridge
```

The voice server's library entry point is reused inside the Electron app so its embedded engine and the external MCP server share one set of providers, FSM, and filters.

## Voice providers

| Kind | Provider | Status |
|------|----------|--------|
| STT  | OpenAI Whisper API | ready |
| STT  | whisper.cpp · tiny / base / small / medium | ready (via smart-whisper, Metal-accelerated on M-series) |
| TTS  | OpenAI `tts-1` (streaming PCM) | ready |
| TTS  | macOS `say` | ready |
| TTS  | Kokoro (local ONNX) | inference pending |
| TTS  | Piper (local ONNX) | inference pending |

Local model downloads are streamed from Hugging Face into `~/Library/Application Support/ClaudeTalk/models/`. Selection is persisted across launches in `settings.json`.

## Secrets

API keys live in the OS keychain via Electron's `safeStorage`. They never touch disk in plaintext and never leave your machine. The voice-mcp-server child inherits them as env vars at spawn.

## Roadmap

- Local Kokoro / Piper inference (espeak-ng phonemization + ONNX pipeline)
- Bundled voice preview clips
- Smart-turn v3 semantic endpointing on top of sox VAD
- Native AVAudioSession voice-processing addon for rock-solid AEC on Mac
- Persisted conversation history for the standalone app
- ElevenLabs TTS provider

## License

MIT
