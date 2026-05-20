import { useEffect, useState } from 'react';
import type { SecretKey } from '../../shared/ipc-types';

const KEY_LABELS: Record<SecretKey, { label: string; placeholder: string; helper: string }> = {
  openai: {
    label: 'OpenAI',
    placeholder: 'sk-...',
    helper: 'For OpenAI Whisper API (STT) og tts-1 (TTS).',
  },
  anthropic: {
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    helper: 'For å snakke med Claude.',
  },
  elevenlabs: {
    label: 'ElevenLabs',
    placeholder: 'sk_...',
    helper: 'Valgfri. For ElevenLabs TTS.',
  },
};

export function ApiKeysSection(): JSX.Element {
  const [status, setStatus] = useState<Record<SecretKey, boolean> | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await window.claudetalk.secrets.status();
      setStatus(s);
    })();
  }, []);

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'inherit', fontWeight: 600 }}>API-nøkler</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0 0' }}>
          Lagret kryptert i macOS Keychain via Electron safeStorage. Forlater aldri din maskin.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(Object.keys(KEY_LABELS) as SecretKey[]).map((k) => (
          <ApiKeyRow
            key={k}
            secretKey={k}
            stored={status?.[k] ?? false}
            onSaved={() => {
              void (async () => setStatus(await window.claudetalk.secrets.status()))();
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ApiKeyRow({
  secretKey,
  stored,
  onSaved,
}: {
  secretKey: SecretKey;
  stored: boolean;
  onSaved: () => void;
}): JSX.Element {
  const meta = KEY_LABELS[secretKey];
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (value.length === 0) return;
    setSaving(true);
    try {
      await window.claudetalk.secrets.set(secretKey, value);
      setValue('');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 14,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{meta.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meta.helper}</div>
        </div>
        {stored && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
              fontWeight: 500,
            }}
          >
            Lagret
          </span>
        )}
      </div>
      <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', gap: 8 }}>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={stored ? '••••••••  (skriv for å overskrive)' : meta.placeholder}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={value.length === 0 || saving}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: value.length > 0 && !saving ? 'var(--accent)' : 'var(--bg-subtle)',
            color: value.length > 0 && !saving ? '#fff' : 'var(--text-muted)',
            cursor: value.length > 0 && !saving ? 'pointer' : 'default',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          {saving ? 'Lagrer…' : 'Lagre'}
        </button>
      </form>
    </article>
  );
}
