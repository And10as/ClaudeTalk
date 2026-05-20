import { useCallback, useRef, useState } from 'react';
import { ChatView } from './components/ChatView';
import { SettingsView } from './components/SettingsView';
import { TitleBar } from './components/TitleBar';

type Route = 'chat' | 'settings';

export function App(): JSX.Element {
  const [route, setRoute] = useState<Route>('chat');
  const [resetTick, setResetTick] = useState(0);
  const navRef = useRef<(route: Route) => void>(setRoute);
  navRef.current = setRoute;

  const handleReset = useCallback(() => {
    void window.claudetalk.voice.reset();
    setResetTick((t) => t + 1);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
      }}
    >
      <TitleBar route={route} onNavigate={setRoute} onResetChat={handleReset} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {route === 'chat' ? (
          <ChatView key={resetTick} onOpenSettings={() => setRoute('settings')} />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
