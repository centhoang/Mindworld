// Voice teaching: record a spoken lesson, turn it into the WAV Meta's transcriber accepts (RIFF, mono,
// 16-bit PCM, 16 kHz), and send it to the Worker's /api/transcribe. The transcript then goes through Teach.

export const WAV_RATE = 16_000;
export const MAX_RECORD_MS = 20_000; // the Worker accepts up to 30 s; a lesson is a sentence or two

// Mono float samples in [-1, 1] -> WAV bytes.
export function encodeWav(samples: Float32Array, rate = WAV_RATE): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // integer PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

// Whatever the browser recorded (webm/opus, mp4/aac...) -> decoded, mixed to mono and resampled to 16 kHz.
async function toWav(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * WAV_RATE));
    const off = new OfflineAudioContext(1, frames, WAV_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    return encodeWav((await off.startRendering()).getChannelData(0));
  } finally {
    void ctx.close();
  }
}

export const voiceInputSupported = (): boolean =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

// One press starts recording, the next press (or MAX_RECORD_MS) stops it.
export class VoiceRecorder {
  private rec: MediaRecorder | null = null;
  private timer = 0;

  get recording(): boolean {
    return this.rec?.state === "recording";
  }

  async start(onAutoStop: () => void): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    this.rec = new MediaRecorder(stream);
    this.rec.start();
    this.timer = window.setTimeout(onAutoStop, MAX_RECORD_MS);
  }

  // Resolves with the WAV, after releasing the microphone.
  stop(): Promise<ArrayBuffer> {
    const rec = this.rec;
    clearTimeout(this.timer);
    this.rec = null;
    if (!rec) return Promise.reject(new Error("not recording"));
    return new Promise((resolve, reject) => {
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        toWav(new Blob(chunks, { type: rec.mimeType })).then(resolve, reject);
      };
      rec.stop();
    });
  }
}

export async function transcribe(wav: ArrayBuffer, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<{ transcript: string; costUsd: number }> {
  const res = await fetchFn("/api/transcribe", { method: "POST", headers: { "content-type": "audio/wav" }, body: wav });
  const body = (await res.json().catch(() => ({}))) as { transcript?: string; costUsd?: number; error?: string; message?: string };
  if (!res.ok || typeof body.transcript !== "string") throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  return { transcript: body.transcript, costUsd: body.costUsd ?? 0 };
}
