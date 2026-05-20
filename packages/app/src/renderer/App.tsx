import { useState } from 'react';
import { ChatView } from './components/ChatView';
import { SettingsView } from './components/SettingsView';
import { TitleBar } from './components/TitleBar';

type Route = 'chat' | 'settings';

export function App(): JSX.Element {
  const [route, setRoute] = useState<Route>('chat');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
      }}
    >
      <TitleBar route={route} onNavigate={setRoute} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {route === 'chat' ? <ChatView /> : <SettingsView />}
      </main>
    </div>
  );
}
