import { MicVAD, utils as vadUtils } from '@ricky0123/vad-web';

const TARGET_SAMPLE_RATE = 16_000;

export interface MicSession {
  destroy: () => Promise<void>;
}

export interface MicHandlers {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array, sampleRate: number) => void;
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

  const vad = await MicVAD.new({
    stream: micStream,
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    minSpeechFrames: 6,
    redemptionFrames: 28,
    preSpeechPadFrames: 16,
    onSpeechStart: () => handlers.onSpeechStart(),
    onSpeechEnd: (audio) => handlers.onSpeechEnd(audio, TARGET_SAMPLE_RATE),
    onVADMisfire: () => handlers.onVadMisfire?.(),
  });

  vad.start();

  return {
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

export { vadUtils };
