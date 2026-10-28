import { describe, expect, it } from "vitest";
import { encodeWav, WAV_RATE } from "./voice-input";

describe("encodeWav", () => {
  it("writes mono 16-bit PCM at 16 kHz, the format Meta's transcriber accepts", () => {
    const buf = encodeWav(new Float32Array([0, 1, -1, 2]));
    const v = new DataView(buf);
    const tag = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(WAV_RATE);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + 2 * i, true))).toEqual([0, 32767, -32768, 32767]); // clipped
  });
});
