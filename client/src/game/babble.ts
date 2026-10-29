// Cute creature "babble": each syllable of a line becomes a short pitched blip shaped like its vowel, the
// way cozy games voice their characters. Friendlier than robotic text-to-speech, works offline, no voices
// to install. Pure syllable splitting is tested; the audio part needs a browser.

export interface Syllable {
  vowel: "a" | "e" | "i" | "o" | "u";
  stress: number; // 0..1, louder/higher for capitals, "!" and the first syllable of a word
  pause: number; // ms of silence after it (spaces, commas, full stops)
}

const VOWEL = /[aeiouy]+/gi;
const MAX_SYLLABLES = 28; // long replies babble their start, then trail off

export function syllables(text: string): Syllable[] {
  const out: Syllable[] = [];
  const excited = /!/.test(text);
  for (const word of text.split(/\s+/)) {
    const parts = word.match(VOWEL) ?? [];
    parts.forEach((v, i) => {
      const ch = v[0]!.toLowerCase();
      const vowel = (ch === "y" ? "i" : ch) as Syllable["vowel"];
      const loud = word === word.toUpperCase() && /[A-Z]/.test(word);
      out.push({ vowel, stress: Math.min(1, (i === 0 ? 0.6 : 0.35) + (excited ? 0.2 : 0) + (loud ? 0.3 : 0)), pause: 0 });
    });
    const last = out[out.length - 1];
    if (last && parts.length) last.pause = /[.?]$/.test(word) ? 140 : /[,;:]$/.test(word) ? 90 : 35;
    if (out.length >= MAX_SYLLABLES) break;
  }
  return out.slice(0, MAX_SYLLABLES);
}

// Rough vowel formants (Hz): a bandpass at the first formant colours each blip.
const FORMANT: Record<Syllable["vowel"], number> = { a: 850, e: 560, i: 320, o: 520, u: 360 };
const STEP: Record<Syllable["vowel"], number> = { a: 0, e: 2, i: 4, o: -2, u: -3 }; // semitone offsets: a sing-song melody

export interface BabbleVoice {
  base: number; // Hz of a neutral syllable
  speed: number; // 1 = normal
  wave?: OscillatorType;
}

export class Babbler {
  private ctx: AudioContext | null = null;
  private stopAt = 0;
  volume = 0.18;

  private audio(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  }

  // Plays a line; a new line cuts the previous one short by starting after it is silenced.
  say(text: string, voice: BabbleVoice) {
    const ctx = this.audio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    let t = Math.max(ctx.currentTime + 0.02, Math.min(this.stopAt, ctx.currentTime + 0.02));
    const out = ctx.createGain();
    out.gain.value = this.volume;
    out.connect(ctx.destination);
    for (const s of syllables(text)) {
      const len = (0.075 + s.stress * 0.03) / voice.speed;
      const osc = ctx.createOscillator();
      osc.type = voice.wave ?? "triangle";
      const f = voice.base * 2 ** ((STEP[s.vowel] + s.stress * 3 + (Math.random() - 0.5) * 1.5) / 12);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.92, t + len); // a soft downward lilt
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.max(FORMANT[s.vowel], f * 1.5);
      bp.Q.value = 1.2;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.5 + s.stress * 0.5, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(bp).connect(env).connect(out);
      osc.start(t);
      osc.stop(t + len + 0.02);
      t += len + s.pause / 1000 / voice.speed;
    }
    this.stopAt = t;
    window.setTimeout(() => out.disconnect(), (t - ctx.currentTime + 0.3) * 1000);
  }
}
