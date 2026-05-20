interface Props {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  onClick: () => void;
}

export function MicButton({ state, onClick }: Props): JSX.Element {
  const pulsing = state === 'listening' || state === 'speaking';
  const bg = state === 'idle' ? 'var(--bg-elevated)' : 'var(--accent)';
  const color = state === 'idle' ? 'var(--accent)' : '#FFFFFF';

  return (
    <>
      <style>{keyframes}</style>
      <button
        onClick={onClick}
        aria-label="Talk to Claude"
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          transition: 'transform 120ms ease, background 200ms ease',
        }}
      >
        {pulsing && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '2px solid var(--accent)',
              animation: 'ct-pulse 1.6s ease-out infinite',
              pointerEvents: 'none',
            }}
          />
        )}
        <MicIcon />
      </button>
    </>
  );
}

const keyframes = `
@keyframes ct-pulse {
  0%   { transform: scale(1);    opacity: 0.7; }
  100% { transform: scale(1.35); opacity: 0;   }
}
`;

function MicIcon(): JSX.Element {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10a7 7 0 0 1-14 0" />
      <line x1="12" y1="17" x2="12" y2="22" />
    </svg>
  );
}
