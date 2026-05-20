import { spawn } from 'node:child_process';
import type {
  ProviderDescriptor,
  ProviderStatus,
  TtsProvider,
  TtsSynthesisChunk,
  VoiceDescriptor,
} from './types.js';

const MAC_SAY_VOICES: ReadonlyArray<Omit<VoiceDescriptor, 'previewUrl' | 'sampleText'>> = [
  { id: 'Nora', displayName: 'Nora', language: 'no-NO', gender: 'female' },
  { id: 'Henrik', displayName: 'Henrik', language: 'no-NO', gender: 'male' },
  { id: 'Alex', displayName: 'Alex', language: 'en-US', gender: 'male' },
  { id: 'Samantha', displayName: 'Samantha', language: 'en-US', gender: 'female' },
  { id: 'Daniel', displayName: 'Daniel', language: 'en-GB', gender: 'male' },
];

/**
 * macOS `say` is happiest when it streams straight to the speakers; piping to
 * a temp AIFF and parsing it back was fragile across macOS versions. Here we
 * just shell out to `say "text" -v Voice -r WPM` and return an empty PCM
 * stream, signalling to the caller that playback was handled in-band.
 */
export class MacSayTts implements TtsProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'mac-say',
    kind: 'tts',
    displayName: 'macOS · say',
    vendor: 'Apple',
    local: true,
    languages: ['no-NO', 'en-US', 'en-GB'],
  };

  async voices(): Promise<VoiceDescriptor[]> {
    return MAC_SAY_VOICES.map((v) => ({
      ...v,
      previewUrl: `voice-preview://say/${v.id}`,
      sampleText:
        v.language === 'no-NO'
          ? `Hei, jeg heter ${v.displayName}, og jeg snakker norsk.`
          : `Hi, my name is ${v.displayName}.`,
    }));
  }

  async status(): Promise<ProviderStatus> {
    return process.platform === 'darwin'
      ? { state: 'ready' }
      : { state: 'unavailable', reason: 'macOS only' };
  }

  // eslint-disable-next-line require-yield
  async *synthesize(
    text: string,
    opts: { voiceId: string; speed?: number; signal: AbortSignal },
  ): AsyncIterable<TtsSynthesisChunk> {
    if (process.platform !== 'darwin') throw new Error('say is macOS only');

    const wpm = opts.speed !== undefined ? Math.round(180 * opts.speed) : 180;
    const args = ['-v', opts.voiceId, '-r', String(wpm), text];

    await new Promise<void>((resolve, reject) => {
      const child = spawn('say', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderrBuf = '';
      child.stderr.on('data', (d: Buffer) => {
        stderrBuf += d.toString();
      });
      opts.signal.addEventListener('abort', () => child.kill(), { once: true });
      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT') resolve();
        else reject(new Error(`say exited code=${code} stderr=${stderrBuf.trim()}`));
      });
    });
  }
}
