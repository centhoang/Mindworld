import { UnreadableResponse, UpstreamError, type ProviderConfig } from "./providers";

// Voice teaching: the player speaks a lesson, the browser sends a short WAV, Meta's Muse Voice Transcribe
// turns it into text, and the text goes through the normal Teach path. Only the file endpoint is used
// (POST /v1/asr/transcribe, multipart: "request" JSON + "audio" WAV). Docs: dev.meta.ai/docs/api-reference/voice.

export const TRANSCRIBE_URL = "https://api.meta.ai/v1/asr/transcribe";
export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
export const USD_PER_AUDIO_HOUR = 0.18; // metered in whole seconds, streaming and file priced the same
export const MAX_CLIP_MS = 30_000; // a lesson is a sentence or two; 30 s caps cost and upload size
export const MAX_WAV_BYTES = 44 + 24_000 * 2 * 30 + 1024; // 30 s of 24 kHz mono 16-bit plus header slack
const TIMEOUT_MS = 30_000;

// Game words bias recognition toward the spelling the coach understands ("befriend", not "be friend").
export const KEYWORDS = ["brute", "skitter", "turtle", "pal", "bully", "befriend", "emote", "guard", "flee", "heavy", "HP"];

export interface WavInfo {
  sampleRate: number;
  durationMs: number;
}

// Meta accepts RIFF/WAVE, mono integer PCM at 16 or 24 kHz. Checking it here turns a bad clip into a 400
// before anything is billed, and gives the clip length for the worst-case reservation.
export function parseWav(buf: ArrayBuffer): WavInfo | string {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (buf.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return "not a WAV file";
  let off = 12;
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  while (off + 8 <= buf.byteLength) {
    const id = tag(off);
    const size = v.getUint32(off + 4, true);
    if (id === "fmt " && size >= 16 && off + 24 <= buf.byteLength) {
      fmt = { format: v.getUint16(off + 8, true), channels: v.getUint16(off + 10, true), rate: v.getUint32(off + 12, true), bits: v.getUint16(off + 22, true) };
    } else if (id === "data") {
      if (!fmt) return "data before fmt";
      if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16) return "need mono 16-bit PCM";
      if (fmt.rate !== 16_000 && fmt.rate !== 24_000) return "need 16 or 24 kHz";
      const bytes = Math.min(size, buf.byteLength - off - 8);
      return { sampleRate: fmt.rate, durationMs: Math.floor((bytes / 2 / fmt.rate) * 1000) };
    }
    off += 8 + size + (size % 2);
  }
  return "no audio data";
}

// Worst case books the whole clip rounded up to the next second; the actual cost uses the billed duration.
export const transcribeCostUsd = (ms: number): number => (Math.ceil(ms / 1000) / 3600) * USD_PER_AUDIO_HOUR;

export async function transcribeMeta(
  cfg: ProviderConfig["meta"],
  wav: ArrayBuffer,
  fetchFn: (input: string, init: RequestInit) => Promise<Response>,
): Promise<{ transcript: string; audioDurationMs: number }> {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ model: TRANSCRIBE_MODEL, audioEncoding: "WAV", mode: "PUSH_TO_TALK", keywords: KEYWORDS })], { type: "application/json" }));
  form.append("audio", new Blob([wav], { type: "audio/wav" }), "lesson.wav");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(TRANSCRIBE_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.apiKey ?? ""}`, accept: "application/json" },
      body: form,
      signal: ctl.signal,
    });
    if (!res.ok) throw new UpstreamError(`upstream status ${res.status}`, res.status);
    const body = (await res.json()) as { transcript?: unknown; audioDurationMs?: unknown };
    if (typeof body.transcript !== "string") throw new UnreadableResponse("no transcript in reply");
    const ms = typeof body.audioDurationMs === "number" && Number.isFinite(body.audioDurationMs) ? Math.max(0, body.audioDurationMs) : NaN;
    return { transcript: body.transcript, audioDurationMs: ms };
  } catch (e) {
    if (e instanceof UpstreamError || e instanceof UnreadableResponse) throw e;
    throw new UnreadableResponse(ctl.signal.aborted ? "upstream timeout" : `upstream failure: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
