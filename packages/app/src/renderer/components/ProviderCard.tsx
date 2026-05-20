import { useEffect, useState } from 'react';
import type { UiProvider, UiVoice } from '../data/mockProviders';

interface Props {
  provider: UiProvider;
  active: boolean;
  onSelect: () => void;
}

interface DownloadState {
  inProgress: boolean;
  bytesReceived?: number;
  bytesTotal?: number;
  done: boolean;
  error?: string;
}

export function ProviderCard({ provider, active, onSelect }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [download, setDownload] = useState<DownloadState>({ inProgress: false, done: false });

  useEffect(() => {
    const unsub = window.claudetalk.models.onProgress((evt) => {
      if (evt.providerId !== provider.id) return;
      setDownload(() => {
        if (evt.state === 'started') {
          return {
            inProgress: true,
            done: false,
            ...(evt.bytesTotal !== undefined && { bytesTotal: evt.bytesTotal }),
          };
        }
        if (evt.state === 'progress') {
          return {
            inProgress: true,
            done: false,
            ...(evt.bytesReceived !== undefined && { bytesReceived: evt.bytesReceived }),
            ...(evt.bytesTotal !== undefined && { bytesTotal: evt.bytesTotal }),
          };
        }
        if (evt.state === 'done') {
          return { inProgress: false, done: true };
        }
        return {
          inProgress: false,
          done: false,
          ...(evt.message !== undefined && { error: evt.message }),
        };
      });
    });
    return unsub;
  }, [provider.id]);

  const handleDownload = (): void => {
    void (async () => {
      try {
        await window.claudetalk.models.download(
          provider.id.startsWith('whisper') ? 'stt' : 'tts',
          provider.id,
        );
      } catch (err) {
        setDownload({
          inProgress: false,
          done: false,
          error: (err as Error).message,
        });
      }
    })();
  };

  return (
    <article
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        boxShadow: 'var(--shadow-card)',
        padding: 14,
        position: 'relative',
        transition: 'border-color 150ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="radio"
            checked={active}
            onChange={onSelect}
            style={{ accentColor: 'var(--accent)' }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{provider.displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {provider.vendor} · {provider.local ? 'lokalt' : 'sky'}
            </div>
          </div>
        </label>
        <StatusBadge
          status={provider.status}
          download={download}
          onDownload={handleDownload}
        />
      </div>

      {download.error !== undefined && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            background: 'var(--bg-subtle)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--danger)',
          }}
        >
          {download.error}
        </div>
      )}

      {provider.voices !== undefined && provider.voices.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: 0,
            }}
          >
            {expanded ? '▾' : '▸'} {provider.voices.length} stemmer
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {provider.voices.map((v) => (
                <VoiceRow key={v.id} voice={v} />
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function StatusBadge({
  status,
  download,
  onDownload,
}: {
  status: UiProvider['status'];
  download: DownloadState;
  onDownload: () => void;
}): JSX.Element {
  const styles: React.CSSProperties = {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 999,
    fontWeight: 500,
  };

  if (download.inProgress) {
    const pct =
      download.bytesTotal !== undefined && download.bytesTotal > 0 && download.bytesReceived !== undefined
        ? Math.round((download.bytesReceived / download.bytesTotal) * 100)
        : null;
    return (
      <span style={{ ...styles, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
        {pct !== null ? `${pct}%` : 'Laster ned…'}
      </span>
    );
  }
  if (download.done && status.kind !== 'ready') {
    return (
      <span style={{ ...styles, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
        Lastet ned
      </span>
    );
  }

  switch (status.kind) {
    case 'ready':
      return (
        <span style={{ ...styles, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
          Klar
        </span>
      );
    case 'needs-download':
      return (
        <button
          onClick={onDownload}
          style={{
            ...styles,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ⬇ Last ned · {formatBytes(status.sizeBytes)}
        </button>
      );
    case 'downloading':
      return (
        <span style={{ ...styles, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
          Laster ned… {Math.round(status.progress * 100)}%
        </span>
      );
    case 'needs-api-key':
      return (
        <span style={{ ...styles, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
          Krever API-nøkkel
        </span>
      );
    case 'unavailable':
      return (
        <span style={{ ...styles, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
          {status.reason}
        </span>
      );
  }
}

function VoiceRow({ voice }: { voice: UiVoice }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        background: 'var(--bg-subtle)',
        borderRadius: 8,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{voice.displayName}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {voice.language}
          {voice.gender !== undefined ? ` · ${voice.gender}` : ''}
        </div>
      </div>
      <button
        onClick={() => {
          // eslint-disable-next-line no-console
          console.log('preview', voice.previewUrl);
        }}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 999,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
        }}
        aria-label={`Spill av sample av ${voice.displayName}`}
      >
        ▶
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
