import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../../shared/ipc-types';

const MAX_KEEP = 300;

export function LiveView(): JSX.Element {
  const [events, setEvents] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void window.claudetalk.log.start();
    const unsub = window.claudetalk.log.onEvent((evt) => {
      setEvents((prev) => {
        const next = [...prev, evt];
        return next.length > MAX_KEEP ? next.slice(-MAX_KEEP) : next;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          padding: '12px 16px 8px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Aktivitet</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Lever-events fra MCP-serveren — uansett om kallene kommer fra Claude Desktop, Claude Code,
          eller denne appen.
        </p>
      </header>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 11.5,
          lineHeight: 1.45,
        }}
      >
        {events.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>
            Venter på events… Spør Claude Desktop om å lytte eller snakke, så dukker det opp her.
          </div>
        )}
        {events.map((e, i) => (
          <EventRow key={i} entry={e} />
        ))}
      </div>
      <footer
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{events.length} events</span>
        <button
          onClick={() => setEvents([])}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 11,
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Tøm
        </button>
      </footer>
    </div>
  );
}

function EventRow({ entry }: { entry: LogEntry }): JSX.Element {
  const colorByLevel: Record<LogEntry['level'], string> = {
    info: 'var(--text)',
    warn: '#C8902B',
    error: 'var(--danger)',
  };
  const colorByPrefix = (event: string): string => {
    if (event.startsWith('listen')) return 'var(--accent)';
    if (event.startsWith('speak')) return '#5A8F69';
    if (event.startsWith('set_provider')) return '#6B7AA8';
    return 'var(--text-muted)';
  };

  const time = entry.ts.slice(11, 23);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr',
        gap: 8,
        padding: '3px 4px',
        borderBottom: '1px dashed var(--border)',
        color: colorByLevel[entry.level],
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{time}</span>
      <div>
        <span style={{ fontWeight: 600, color: colorByPrefix(entry.event) }}>{entry.event}</span>
        {entry.details !== undefined && Object.keys(entry.details).length > 0 && (
          <span style={{ color: 'var(--text-muted)' }}> {summarize(entry.details)}</span>
        )}
      </div>
    </div>
  );
}

function summarize(d: Record<string, unknown>): string {
  return Object.entries(d)
    .map(([k, v]) => {
      if (typeof v === 'string' && v.length > 80) return `${k}=${v.slice(0, 77)}…`;
      if (typeof v === 'object') return `${k}=${JSON.stringify(v).slice(0, 80)}`;
      return `${k}=${String(v)}`;
    })
    .join(' ');
}
