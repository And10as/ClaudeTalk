# ClaudeTalk

Local voice chat with Claude. A macOS menubar app that lets you talk to Claude the way you'd talk to a coworker — push the hotkey, speak naturally, get a streamed spoken reply. Built MCP-first so the voice pipeline can be reused by Claude Desktop, Claude Code, or any other MCP client.

## Status

Early. The end-to-end loop is wired up (mic → Silero VAD → Whisper → Claude streaming → OpenAI TTS / macOS say → speakers, with barge-in and an AEC warmup gate) and the Electron shell + settings UI in Claude's design language are in place. Local Whisper.cpp, Kokoro, and Piper are stubbed pending model-download scaffolding. Smart-turn v3 semantic endpointing comes next.

## Architecture

```
packages/voice-mcp-server   MCP server (stdio) exposing listen / speak /
                            stop_speaking / cancel_listening / set_provider /
                            list_providers. Also publishes a library entry
                            point so the Electron app embeds providers
                            directly while external MCP clients can still
                            attach to the same surface.

packages/app                Electron menubar app:
                              main/       hotkey, tray, MCP host, secrets,
                                          ConversationSession orchestrator
                              renderer/   React UI, Silero VAD via
                                          @ricky0123/vad-web, PCM playback
                              preload/    typed IPC bridge
```

The conversation FSM lives in the voice-mcp-server library so the same state machine drives the embedded engine and any external MCP consumer.

## Voice providers

| Kind | Provider | Status |
|------|----------|--------|
| STT  | OpenAI Whisper API | wired |
| STT  | whisper.cpp · small / medium | stub (downloader pending) |
| TTS  | OpenAI `tts-1` (streaming PCM) | wired |
| TTS  | macOS `say` | wired |
| TTS  | Kokoro (local ONNX) | stub |
| TTS  | Piper (local ONNX) | stub |

Each provider is registered against a common interface. The settings UI groups them into cards with a status badge, a download CTA when applicable, and a per-voice play-preview button.

## Secrets

API keys are kept in the OS keychain via Electron's `safeStorage`. They never touch disk in plaintext and they never leave your machine. The voice-mcp-server child receives them only as env vars at spawn time.

## Run it

```bash
pnpm install
pnpm build
pnpm --filter @claudetalk/app dev
```

You'll need at least an **Anthropic** API key to talk to Claude, plus either **OpenAI** (Whisper STT + tts-1) or run on macOS to use the built-in `say` voice. Add keys in the Settings tab.

## Roadmap

- Smart-turn v3 semantic endpointing on top of Silero VAD
- Local-model download manager (Whisper.cpp, Kokoro, Piper)
- Voice preview clips bundled with the app
- Native AVAudioSession voice-processing addon for rock-solid AEC on Mac
- Persisted conversation history
- ElevenLabs TTS provider
- Conversation export

## License

MIT
