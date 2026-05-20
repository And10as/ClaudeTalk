import { useState } from 'react';

const CONFIG_JSON = `{
  "mcpServers": {
    "claudetalk-voice": {
      "command": "npx",
      "args": ["-y", "@claudetalk/voice-mcp-server"]
    }
  }
}`;

export function McpHint(): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(CONFIG_JSON);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'inherit', fontWeight: 600 }}>
          Bruk i Claude Desktop / Code
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0 0' }}>
          Lim inn i <code>claude_desktop_config.json</code> så Claude kan kalle{' '}
          <code>listen</code> og <code>speak</code> direkte i chat-en din. Krever{' '}
          <code>sox</code> for mikrofon-opptak (<code>brew install sox</code>).
        </p>
      </div>
      <article
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 14,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <pre
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            fontFamily: 'monospace',
            margin: 0,
            overflow: 'auto',
            color: 'var(--text)',
          }}
        >
{CONFIG_JSON}
        </pre>
        <button
          onClick={() => void copy()}
          style={{
            marginTop: 10,
            background: copied ? 'var(--success)' : 'var(--accent)',
            border: 'none',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {copied ? 'Kopiert!' : 'Kopier'}
        </button>
      </article>
    </section>
  );
}
