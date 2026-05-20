import { MicVAD } from '@ricky0123/vad-web';

const TARGET_SAMPLE_RATE = 16_000;

const AEC_WARMUP_MS = 2_500;
const MIN_BARGE_DURATION_FRAMES = 8; // ~160 ms at 20 ms frames

export interface MicSession {
  destroy: () => Promise<void>;
  notifyTtsStarted: () => void;
  notifyTtsStopped: () => void;
}

export interface MicHandlers {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array, sampleRate: number) => void;
  onBargeIn: () => void;
  onVadMisfire?: () => void;
  onError?: (err: Error) => void;
}

export async function startMic(handlers: MicHandlers): Promise<MicSession> {
  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
  } catch (err) {
    handlers.onError?.(err as Error);
    throw err;
  }

  let ttsStartedAt: number | null = null;
  let pendingBargeFrames = 0;

  const inAecWarmup = (): boolean =>
    ttsStartedAt !== null && Date.now() - ttsStartedAt < AEC_WARMUP_MS;

  const vad = await MicVAD.new({
    stream: micStream,
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    minSpeechFrames: 6,
    redemptionFrames: 28,
    preSpeechPadFrames: 16,
    onSpeechStart: () => {
      if (inAecWarmup()) {
        pendingBargeFrames = 0;
        return;
      }
      if (ttsStartedAt !== null) {
        pendingBargeFrames += 1;
        if (pendingBargeFrames >= MIN_BARGE_DURATION_FRAMES) {
          pendingBargeFrames = 0;
          handlers.onBargeIn();
          handlers.onSpeechStart();
        }
        return;
      }
      handlers.onSpeechStart();
    },
    onSpeechEnd: (audio) => {
      pendingBargeFrames = 0;
      handlers.onSpeechEnd(audio, TARGET_SAMPLE_RATE);
    },
    onVADMisfire: () => {
      pendingBargeFrames = 0;
      handlers.onVadMisfire?.();
    },
  });

  vad.start();

  return {
    notifyTtsStarted: () => {
      ttsStartedAt = Date.now();
      pendingBargeFrames = 0;
    },
    notifyTtsStopped: () => {
      ttsStartedAt = null;
      pendingBargeFrames = 0;
    },
    async destroy() {
      vad.pause();
      try {
        vad.destroy();
      } catch {
        // older versions of the lib don't expose destroy
      }
      micStream?.getTracks().forEach((t) => t.stop());
    },
  };
}

export function audioToArrayBuffer(audio: Float32Array): ArrayBuffer {
  const out = new ArrayBuffer(audio.byteLength);
  new Float32Array(out).set(audio);
  return out;
}
