import { useCallback, useState } from 'react';
import { ChatView } from './components/ChatView';
import { LiveView } from './components/LiveView';
import { SettingsView } from './components/SettingsView';
import { TitleBar, type Route } from './components/TitleBar';

export function App(): JSX.Element {
  const [route, setRoute] = useState<Route>('live');
  const [resetTick, setResetTick] = useState(0);

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
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {route === 'live' && <LiveView />}
        {route === 'chat' && (
          <ChatView key={resetTick} onOpenSettings={() => setRoute('settings')} />
        )}
        {route === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
