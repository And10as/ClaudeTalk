import { useState } from 'react';
import { MicButton } from './MicButton';

type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export function ChatView(): JSX.Element {
  const [state, setState] = useState<SessionState>('idle');

  const toggle = (): void => {
    setState((s) => (s === 'idle' ? 'listening' : 'idle'));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 32,
        gap: 24,
      }}
    >
      <MicButton state={state} onClick={toggle} />
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>{labelFor(state)}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          {hintFor(state)}
        </p>
      </div>
      <kbd
        style={{
          padding: '4px 10px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'inherit',
          color: 'var(--text-muted)',
        }}
      >
        ⌘ ⇧ Space
      </kbd>
    </div>
  );
}

function labelFor(state: SessionState): string {
  switch (state) {
    case 'idle':
      return 'Trykk for å snakke';
    case 'listening':
      return 'Lytter…';
    case 'thinking':
      return 'Tenker…';
    case 'speaking':
      return 'Claude snakker';
  }
}

function hintFor(state: SessionState): string {
  switch (state) {
    case 'idle':
      return 'Eller bruk hurtigtasten for å starte en samtale';
    case 'listening':
      return 'Snakk fritt — pauser blir ikke avbrutt';
    case 'thinking':
      return '';
    case 'speaking':
      return 'Snakk for å avbryte';
  }
}
