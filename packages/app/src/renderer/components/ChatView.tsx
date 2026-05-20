import { useEffect, useRef, useState } from 'react';
import type { ConversationState, VoiceEvent } from '../../shared/voice-events';
import { audioToArrayBuffer, startMic, type MicSession } from '../audio/mic-vad';
import { PcmPlayer } from '../audio/playback';
import { MicButton } from './MicButton';

interface TranscriptItem {
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  onOpenSettings: () => void;
}

export function ChatView({ onOpenSettings }: Props): JSX.Element {
  const [state, setState] = useState<ConversationState>('idle');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState<boolean>(false);
  const [activeProviders, setActiveProviders] = useState<{ stt: string; tts: string } | null>(null);
  const micRef = useRef<MicSession | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const status = await window.claudetalk.secrets.status();
        setMissingKey(!status.anthropic);
        const list = await window.claudetalk.mcp.listProviders();
        const stt = list.stt.find((p) => p.status.state === 'ready')?.descriptor.displayName
          ?? list.stt[0]?.descriptor.displayName ?? '—';
        const tts = list.tts.find((p) => p.status.state === 'ready')?.descriptor.displayName
          ?? list.tts[0]?.descriptor.displayName ?? '—';
        setActiveProviders({ stt, tts });
      } catch {
        setMissingKey(true);
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = window.claudetalk.voice.onEvent((evt) => handleEvent(evt));
    return () => {
      unsub();
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEvent = (evt: VoiceEvent): void => {
    switch (evt.type) {
      case 'state':
        setState(evt.state);
        if (evt.state === 'speaking') {
          micRef.current?.notifyTtsStarted();
          setErrorMsg(null);
        } else if (evt.state === 'listening' || evt.state === 'idle') {
          micRef.current?.notifyTtsStopped();
        } else if (evt.state === 'thinking') {
          setErrorMsg(null);
        }
        break;
      case 'finalTranscript':
        setTranscript((t) => [...t, { role: 'user', text: evt.text }]);
        break;
      case 'rejectedTranscript':
        // silent — UI just stays in listening
        break;
      case 'assistantToken':
        setTranscript((t) => {
          const last = t[t.length - 1];
          if (last !== undefined && last.role === 'assistant') {
            return [...t.slice(0, -1), { role: 'assistant', text: last.text + evt.text }];
          }
          return [...t, { role: 'assistant', text: evt.text }];
        });
        break;
      case 'assistantDone':
        break;
      case 'ttsChunk':
        if (playerRef.current === null) playerRef.current = new PcmPlayer();
        playerRef.current.enqueue(evt.pcm, evt.sampleRate);
        break;
      case 'error':
        setErrorMsg(evt.message);
        break;
    }
  };

  const teardown = async (): Promise<void> => {
    await micRef.current?.destroy();
    micRef.current = null;
    await playerRef.current?.dispose();
    playerRef.current = null;
  };

  const togglePtt = async (): Promise<void> => {
    if (state === 'idle') {
      try {
        await window.claudetalk.voice.start();
        micRef.current = await startMic({
          onSpeechStart: () => {
            // Main FSM owns truth; renderer just stops audio for snappy UX.
          },
          onSpeechEnd: (audio, sr) => {
            void window.claudetalk.voice.endTurn(audioToArrayBuffer(audio), sr);
          },
          onBargeIn: () => {
            void window.claudetalk.voice.bargeIn();
            playerRef.current?.stop();
          },
          onError: (err) => setErrorMsg(`Mikrofon: ${err.message}`),
        });
      } catch (err) {
        setErrorMsg(`Kunne ikke starte mikrofon: ${(err as Error).message}`);
      }
    } else {
      await window.claudetalk.voice.stop();
      await teardown();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 24px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {missingKey && (
          <button
            onClick={onOpenSettings}
            style={{
              padding: 14,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>
              Innebygd chat krever Anthropic API-nøkkel
            </strong>
            <span style={{ color: 'var(--text-muted)' }}>
              Vil du heller snakke til Claude i Claude Desktop? Da slipper du nøkkelen — sett opp
              MCP-serveren i Settings ↘ Bruk i Claude Desktop / Code.
            </span>
          </button>
        )}
        {transcript.length === 0 && state === 'idle' && !missingKey && <EmptyHero />}
        {transcript.map((item, i) => (
          <TranscriptBubble key={i} item={item} />
        ))}
        {errorMsg !== null && (
          <div
            style={{
              padding: 12,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--danger)',
              borderRadius: 12,
              color: 'var(--danger)',
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      <footer
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 24px 24px',
          gap: 8,
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        <MicButton state={micButtonState(state)} onClick={() => void togglePtt()} />
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
            minHeight: 16,
          }}
        >
          {labelFor(state)}
        </div>
        {activeProviders !== null && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              opacity: 0.7,
              display: 'flex',
              gap: 8,
            }}
          >
            <span>🎙 {activeProviders.stt}</span>
            <span>·</span>
            <span>🔊 {activeProviders.tts}</span>
          </div>
        )}
      </footer>
    </div>
  );
}

function TranscriptBubble({ item }: { item: TranscriptItem }): JSX.Element {
  const isUser = item.role === 'user';
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: 16,
        background: isUser ? 'var(--accent)' : 'var(--bg-elevated)',
        color: isUser ? '#fff' : 'var(--text)',
        border: isUser ? 'none' : '1px solid var(--border)',
        boxShadow: isUser ? 'none' : 'var(--shadow-card)',
        fontSize: 14,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}
    >
      {item.text}
    </div>
  );
}

function EmptyHero(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        gap: 8,
        color: 'var(--text-muted)',
      }}
    >
      <h2 style={{ fontSize: 22, color: 'var(--text)', margin: 0 }}>Si hei til Claude</h2>
      <p style={{ margin: 0, maxWidth: 320 }}>
        Trykk mikrofonen — eller bruk hurtigtasten ⌘⇧Space — og snakk. Det blir en samtale.
      </p>
    </div>
  );
}

function micButtonState(s: ConversationState): 'idle' | 'listening' | 'thinking' | 'speaking' {
  if (s === 'idle') return 'idle';
  if (s === 'thinking') return 'thinking';
  if (s === 'speaking') return 'speaking';
  return 'listening';
}

function labelFor(state: ConversationState): string {
  switch (state) {
    case 'idle':
      return 'Trykk for å starte samtalen';
    case 'listening':
      return 'Lytter…';
    case 'user_speaking':
      return 'Hører deg';
    case 'user_endpointing':
      return 'Et øyeblikk…';
    case 'thinking':
      return 'Tenker…';
    case 'speaking':
      return 'Claude snakker — si noe for å avbryte';
    case 'interrupted':
      return 'Avbrutt';
  }
}
