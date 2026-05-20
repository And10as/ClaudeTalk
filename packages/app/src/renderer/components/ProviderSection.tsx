import { useState } from 'react';
import type { UiProvider } from '../data/mockProviders';
import { ProviderCard } from './ProviderCard';

interface Props {
  title: string;
  description: string;
  providers: UiProvider[];
  kind: 'stt' | 'tts';
}

export function ProviderSection({ title, description, providers, kind }: Props): JSX.Element {
  const [activeId, setActiveId] = useState<string>(providers[0]?.id ?? '');

  const handleSelect = async (id: string): Promise<void> => {
    setActiveId(id);
    try {
      await window.claudetalk.mcp.setProvider(kind, id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('setProvider failed', err);
    }
  };

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'inherit', fontWeight: 600 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0 0' }}>{description}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            active={p.id === activeId}
            onSelect={() => {
              void handleSelect(p.id);
            }}
          />
        ))}
      </div>
    </section>
  );
}
