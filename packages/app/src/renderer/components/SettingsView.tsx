import { ProviderSection } from './ProviderSection';
import { MOCK_PROVIDERS } from '../data/mockProviders';

export function SettingsView(): JSX.Element {
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Velg hvilke stemmer og transkripsjons-modeller du vil bruke. Lokale modeller lastes ned
          første gang du aktiverer dem.
        </p>
      </header>

      <ProviderSection
        title="Speech-to-text"
        description="Hvordan ClaudeTalk forstår det du sier."
        providers={MOCK_PROVIDERS.stt}
      />

      <ProviderSection
        title="Text-to-speech"
        description="Hvordan Claude høres ut når den snakker til deg."
        providers={MOCK_PROVIDERS.tts}
      />
    </div>
  );
}
