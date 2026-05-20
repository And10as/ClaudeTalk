export type ConversationState =
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'user_endpointing'
  | 'thinking'
  | 'speaking'
  | 'interrupted';

export interface FsmEvent {
  type:
    | 'session.start'
    | 'session.stop'
    | 'vad.speech_started'
    | 'vad.speech_ended'
    | 'turn.complete'
    | 'turn.incomplete'
    | 'turn.timeout'
    | 'response.first_token'
    | 'tts.finished'
    | 'barge_in';
  at: number;
}

export interface FsmListener {
  (next: ConversationState, prev: ConversationState, event: FsmEvent): void;
}

const TRANSITIONS: Readonly<Record<ConversationState, Partial<Record<FsmEvent['type'], ConversationState>>>> = {
  idle: {
    'session.start': 'listening',
  },
  listening: {
    'vad.speech_started': 'user_speaking',
    'session.stop': 'idle',
  },
  user_speaking: {
    'vad.speech_ended': 'user_endpointing',
    'session.stop': 'idle',
  },
  user_endpointing: {
    'turn.complete': 'thinking',
    'turn.timeout': 'thinking',
    'turn.incomplete': 'user_speaking',
    'vad.speech_started': 'user_speaking',
    'session.stop': 'idle',
  },
  thinking: {
    'response.first_token': 'speaking',
    'barge_in': 'interrupted',
    'session.stop': 'idle',
  },
  speaking: {
    'tts.finished': 'listening',
    'barge_in': 'interrupted',
    'session.stop': 'idle',
  },
  interrupted: {
    'vad.speech_started': 'user_speaking',
    'session.stop': 'idle',
  },
};

export class ConversationFsm {
  #state: ConversationState = 'idle';
  #listeners = new Set<FsmListener>();

  get state(): ConversationState {
    return this.#state;
  }

  on(listener: FsmListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  send(event: FsmEvent): ConversationState {
    const next = TRANSITIONS[this.#state]?.[event.type];
    if (next === undefined) return this.#state;
    const prev = this.#state;
    this.#state = next;
    for (const l of this.#listeners) l(next, prev, event);
    return next;
  }
}
