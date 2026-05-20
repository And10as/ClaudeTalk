export type Route = 'live' | 'chat' | 'settings';

interface Props {
  route: Route;
  onNavigate: (route: Route) => void;
  onResetChat?: () => void;
}

export function TitleBar({ route, onNavigate, onResetChat }: Props): JSX.Element {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        userSelect: 'none',
        height: 40,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'var(--accent)',
            display: 'inline-block',
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 13 }}>ClaudeTalk</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {route === 'chat' && onResetChat !== undefined && (
          <button
            onClick={onResetChat}
            title="Start ny samtale"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              marginRight: 4,
            }}
          >
            Ny samtale
          </button>
        )}
        <TabButton active={route === 'live'} onClick={() => onNavigate('live')}>
          Live
        </TabButton>
        <TabButton active={route === 'chat'} onClick={() => onNavigate('chat')}>
          Chat
        </TabButton>
        <TabButton active={route === 'settings'} onClick={() => onNavigate('settings')}>
          Settings
        </TabButton>
      </nav>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        border: 'none',
        borderRadius: 6,
        fontWeight: active ? 600 : 500,
        fontSize: 12,
      }}
    >
      {children}
    </button>
  );
}
