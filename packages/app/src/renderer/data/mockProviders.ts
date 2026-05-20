export type UiStatus =
  | { kind: 'ready' }
  | { kind: 'needs-download'; sizeBytes: number }
  | { kind: 'downloading'; progress: number }
  | { kind: 'needs-api-key' }
  | { kind: 'unavailable'; reason: string };

export interface UiVoice {
  id: string;
  displayName: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  previewUrl: string;
}

export interface UiProvider {
  id: string;
  displayName: string;
  vendor: string;
  local: boolean;
  status: UiStatus;
  voices?: UiVoice[];
}

const MB = 1024 * 1024;

export const MOCK_PROVIDERS: { stt: UiProvider[]; tts: UiProvider[] } = {
  stt: [
    {
      id: 'openai-whisper-api',
      displayName: 'OpenAI Whisper API',
      vendor: 'OpenAI',
      local: false,
      status: { kind: 'needs-api-key' },
    },
    {
      id: 'whisper-local-small',
      displayName: 'Whisper.cpp · small',
      vendor: 'ggerganov/whisper.cpp',
      local: true,
      status: { kind: 'needs-download', sizeBytes: 466 * MB },
    },
    {
      id: 'whisper-local-medium',
      displayName: 'Whisper.cpp · medium',
      vendor: 'ggerganov/whisper.cpp',
      local: true,
      status: { kind: 'needs-download', sizeBytes: 1500 * MB },
    },
  ],
  tts: [
    {
      id: 'openai-tts',
      displayName: 'OpenAI TTS (tts-1)',
      vendor: 'OpenAI',
      local: false,
      status: { kind: 'needs-api-key' },
      voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((id) => ({
        id,
        displayName: id.charAt(0).toUpperCase() + id.slice(1),
        language: 'multi',
        previewUrl: `voice-preview://openai/${id}`,
      })),
    },
    {
      id: 'kokoro-local',
      displayName: 'Kokoro (local)',
      vendor: 'hexgrad/Kokoro-82M',
      local: true,
      status: { kind: 'needs-download', sizeBytes: 325 * MB },
      voices: [
        { id: 'af_bella', displayName: 'Bella', language: 'en-US', gender: 'female', previewUrl: 'voice-preview://kokoro/af_bella' },
        { id: 'am_adam', displayName: 'Adam', language: 'en-US', gender: 'male', previewUrl: 'voice-preview://kokoro/am_adam' },
        { id: 'bf_emma', displayName: 'Emma', language: 'en-GB', gender: 'female', previewUrl: 'voice-preview://kokoro/bf_emma' },
      ],
    },
    {
      id: 'piper-local',
      displayName: 'Piper (local)',
      vendor: 'rhasspy/piper',
      local: true,
      status: { kind: 'needs-download', sizeBytes: 64 * MB },
      voices: [
        { id: 'no_NO-talesyntese-medium', displayName: 'Talesyntese', language: 'no-NO', gender: 'neutral', previewUrl: 'voice-preview://piper/no_NO-talesyntese-medium' },
        { id: 'en_US-amy-medium', displayName: 'Amy', language: 'en-US', gender: 'female', previewUrl: 'voice-preview://piper/en_US-amy-medium' },
      ],
    },
    {
      id: 'mac-say',
      displayName: 'macOS · say',
      vendor: 'Apple',
      local: true,
      status: { kind: 'ready' },
      voices: [
        { id: 'Nora', displayName: 'Nora', language: 'no-NO', gender: 'female', previewUrl: 'voice-preview://say/Nora' },
        { id: 'Henrik', displayName: 'Henrik', language: 'no-NO', gender: 'male', previewUrl: 'voice-preview://say/Henrik' },
        { id: 'Samantha', displayName: 'Samantha', language: 'en-US', gender: 'female', previewUrl: 'voice-preview://say/Samantha' },
      ],
    },
  ],
};
