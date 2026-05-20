export type ConversationState =
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'user_endpointing'
  | 'thinking'
  | 'speaking'
  | 'interrupted';

export type VoiceEvent =
  | { type: 'state'; state: ConversationState }
  | { type: 'finalTranscript'; text: string }
  | { type: 'rejectedTranscript'; reason: 'hallucination' | 'echo' | 'empty' }
  | { type: 'assistantToken'; text: string }
  | { type: 'assistantDone'; fullText: string }
  | { type: 'ttsChunk'; pcm: ArrayBuffer; sampleRate: number; isFinal: boolean }
  | { type: 'error'; message: string };

export interface VoiceSessionApi {
  start: () => Promise<void>;
  endTurn: (audio: ArrayBuffer, sampleRate: number) => Promise<void>;
  stop: () => Promise<void>;
  bargeIn: () => Promise<void>;
  onEvent: (cb: (e: VoiceEvent) => void) => () => void;
}
