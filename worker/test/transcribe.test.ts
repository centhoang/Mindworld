import { describe, expect, it } from "vitest";
import { MAX_WAV_BYTES, parseWav, transcribeCostUsd, TRANSCRIBE_URL } from "../src/transcribe";
import { harness } from "./helpers";

// A minimal RIFF/WAVE file: `ms` of silence, mono 16-bit PCM.
function wav(ms: number, rate = 16_000, channels = 1, bits = 16): ArrayBuffer {
  const dataBytes = Math.floor((rate * ms) / 1000) * channels * (bits / 8);
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * (bits / 8), true);
  v.setUint16(32, channels * (bits / 8), true);
  v.setUint16(34, bits, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  return buf;
}

const post = (body: ArrayBuffer) => ({ method: "POST", headers: { "content-type": "audio/wav" }, body });
const transcriptReply = (text: string, ms: number) => new Response(JSON.stringify({ sessionId: "s1", transcript: text, audioDurationMs: ms, turns: [] }), { status: 200 });

describe("parseWav", () => {
  it("reads the duration of mono 16-bit PCM at 16 or 24 kHz", () => {
    expect(parseWav(wav(2500))).toEqual({ sampleRate: 16_000, durationMs: 2500 });
    expect(parseWav(wav(1000, 24_000))).toEqual({ sampleRate: 24_000, durationMs: 1000 });
  });

  it("rejects what Meta would reject", () => {
    expect(parseWav(new ArrayBuffer(10))).toBe("not a WAV file");
    expect(parseWav(wav(1000, 44_100))).toBe("need 16 or 24 kHz");
    expect(parseWav(wav(1000, 16_000, 2))).toBe("need mono 16-bit PCM");
  });
});

describe("POST /api/transcribe", () => {
  it("sends multipart to Meta, returns the transcript and books the billed seconds", async () => {
    const h = harness();
    h.upstream.respond = async () => transcriptReply("  guard when the brute winds up  ", 3000);
    const res = await h.call("/api/transcribe", post(wav(3200)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { transcript: string; costUsd: number };
    expect(body.transcript).toBe("guard when the brute winds up");
    expect(body.costUsd).toBeCloseTo(transcribeCostUsd(3000));
    const call = h.upstream.calls[0]!;
    expect(call.url).toBe(TRANSCRIBE_URL);
    const form = call.init.body as FormData;
    expect(JSON.parse(await (form.get("request") as Blob).text())).toMatchObject({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV" });
    expect(form.get("audio")).toBeInstanceOf(Blob);
    expect((await h.ledger.snapshot()).totalSpentUsd.meta).toBeCloseTo(transcribeCostUsd(3000));
  });

  it("refuses bad or long audio before calling upstream", async () => {
    const h = harness();
    expect((await h.call("/api/transcribe", post(wav(1000, 44_100)))).status).toBe(400);
    expect((await h.call("/api/transcribe", post(wav(31_000, 16_000)))).status).toBe(400);
    expect((await h.call("/api/transcribe", post(new ArrayBuffer(MAX_WAV_BYTES + 1)))).status).toBe(413);
    expect(h.upstream.calls).toHaveLength(0);
  });

  it("releases the reservation on an upstream error and books the worst case on an unreadable reply", async () => {
    const h = harness();
    h.upstream.respond = async () => new Response("nope", { status: 500 });
    expect((await h.call("/api/transcribe", post(wav(2000)))).status).toBe(502);
    expect((await h.ledger.snapshot()).totalSpentUsd.meta).toBe(0);
    h.upstream.respond = async () => new Response("{}", { status: 200 });
    expect((await h.call("/api/transcribe", post(wav(2000)))).status).toBe(502);
    expect((await h.ledger.snapshot()).totalSpentUsd.meta).toBeCloseTo(transcribeCostUsd(2000));
  });

  it("answers in mock mode without calling Meta", async () => {
    const h = harness({ cfg: { mock: true } });
    const body = (await (await h.call("/api/transcribe", post(wav(1000)))).json()) as { transcript: string; mock: boolean };
    expect(body.mock).toBe(true);
    expect(body.transcript.length).toBeGreaterThan(0);
    expect(h.upstream.calls).toHaveLength(0);
  });
});
