import { useEffect, useState } from 'react';
import type { UiProvider } from '../data/mockProviders';
import { adaptProvidersResult } from '../data/providerAdapter';
import { ApiKeysSection } from './ApiKeysSection';
import { McpHint } from './McpHint';
import { ProviderSection } from './ProviderSection';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; stt: UiProvider[]; tts: UiProvider[] }
  | { kind: 'error'; message: string };

export function SettingsView(): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const result = await window.claudetalk.mcp.listProviders();
        if (cancelled) return;
        const adapted = adaptProvidersResult(result);
        setState({ kind: 'ready', stt: adapted.stt, tts: adapted.tts });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: 'error', message: (err as Error).message });
      }
    };

    void refresh();

    const unsub = window.claudetalk.models.onProgress((evt) => {
      if (evt.state === 'done') void refresh();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Velg hvilke stemmer og transkripsjons-modeller du vil bruke. Lokale modeller lastes ned
          første gang du aktiverer dem.
        </p>
      </header>

      {state.kind === 'loading' && <LoadingHint />}
      {state.kind === 'error' && <ErrorHint message={state.message} />}
      {state.kind === 'ready' && (
        <>
          <ApiKeysSection />
          <ProviderSection
            title="Speech-to-text"
            description="Hvordan ClaudeTalk forstår det du sier."
            providers={state.stt}
            kind="stt"
          />
          <ProviderSection
            title="Text-to-speech"
            description="Hvordan Claude høres ut når den snakker til deg."
            providers={state.tts}
            kind="tts"
          />
          <McpHint />
        </>
      )}
    </div>
  );
}

function LoadingHint(): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        color: 'var(--text-muted)',
        fontSize: 13,
      }}
    >
      Kobler til voice-MCP-serveren…
    </div>
  );
}

function ErrorHint({ message }: { message: string }): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--bg-subtle)',
        border: '1px solid var(--danger)',
        borderRadius: 12,
        color: 'var(--danger)',
        fontSize: 13,
      }}
    >
      <strong>Klarte ikke å snakke med voice-MCP-serveren.</strong>
      <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{message}</div>
    </div>
  );
}
