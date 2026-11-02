// The Teach screen: your pet's memo (the rules it plays by), a text box to teach it in plain words, a
// "review my fights" button, and the proof card after each change (paired fights on seeds the coach never
// saw, before vs after). Typing happens in a small DOM form under the canvas; everything else is drawn.

import { COACH_LABEL, isFightLesson, runCoach } from "../game/coach";
import { thinkingLabel } from "../game/thinking";
import { transcribe, voiceInputSupported, VoiceRecorder } from "../game/voice-input";
import { FetchLlmClient, LlmCortex, LocalCortex, ScriptedCortex, type Cortex, type CortexResult, type JsonCompletion } from "../sim/cortex";
import { describeCond, type Memo } from "../sim/memo";
import { prove, type ProofReport } from "../sim/proof";
import type { Replay } from "../sim/types";
import { LOCAL_ONLY } from "../game/test-mode";
import { PAL } from "./art";
import { drawFrame, drawText, GLYPH, LINE, wrap } from "./text";
import type { ScenePanel } from "../game/ports";

export interface TeachHost {
  memo(): Memo;
  recent(): Replay[];
  setMemo(m: Memo): void; // saves too
  petName(): string;
  portrait(): HTMLCanvasElement;
  browserCoach(): JsonCompletion | null; // the tuned 1B, when it runs in this tab
}

const live = new LlmCortex(new FetchLlmClient(""));
const offline = new ScriptedCortex();
const NAMES = new Map<Cortex, string>([[live, "live coach"]]);

// Who to ask, in order: Muse Spark, the free tuned coach in this tab (the Llama distilled from Muse Spark Teach,
// docs/archive/FINETUNE.md), then the scripted coach.
export function coachChain(browser: JsonCompletion | null = null): Cortex[] {
  const inTab = browser && new LocalCortex("", { complete: browser });
  if (inTab) NAMES.set(inTab, "browser coach");
  return [live, ...(inTab ? [inTab] : []), offline];
}

// Development period: the tuned model in this tab or nothing, so a weak lesson is the model's own.
function localCoachChain(browser: JsonCompletion | null): Cortex[] {
  return coachChain(browser).filter((c) => c instanceof LocalCortex);
}

export class TeachScreen {
  open = false;
  private busySince = 0;
  private status = "Tell your pet what to do in your own words. Its memo below is what it follows in fights.";
  private proof: ProofReport | null = null;
  private readonly form: HTMLFormElement;
  private readonly input: HTMLInputElement;

  constructor(private readonly host: TeachHost) {
    this.form = document.getElementById("teach") as HTMLFormElement;
    this.input = this.form.querySelector("input")!;
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (text) this.lesson(text);
    });
    this.form.querySelector<HTMLButtonElement>("[data-act=review]")!.onclick = () => void this.coach((c) => c.reflect(this.host.memo(), this.host.recent()), true);
    this.form.querySelector<HTMLButtonElement>("[data-act=close]")!.onclick = () => this.hide();
    const speak = this.form.querySelector<HTMLButtonElement>("[data-act=speak]")!;
    speak.hidden = !voiceInputSupported();
    speak.onclick = () => void this.toggleVoice(speak);
  }

  private lesson(text: string): void {
    if (isFightLesson(text)) void this.coach((c) => c.teach(this.host.memo(), text), false);
    else this.status = `${this.host.petName()} only learns about fights. Try: guard when it winds up a heavy hit.`;
  }

  // Speak a lesson: record (press again or 20 s to stop), transcribe on the Worker, then teach it.
  private readonly recorder = new VoiceRecorder();
  private async toggleVoice(btn: HTMLButtonElement): Promise<void> {
    if (!this.recorder.recording) {
      try {
        await this.recorder.start(() => void this.toggleVoice(btn));
        btn.textContent = "Stop";
        this.status = "Listening... say the lesson, then press Stop.";
      } catch {
        this.status = "No microphone access. Type the lesson instead.";
      }
      return;
    }
    btn.textContent = "Speak";
    this.status = "Writing down what you said...";
    try {
      const { transcript } = await transcribe(await this.recorder.stop());
      const text = transcript.trim();
      if (!text) return void (this.status = "I didn't catch any words. Try again a little closer to the mic.");
      this.input.value = text.slice(0, 300);
      this.lesson(this.input.value);
    } catch (e) {
      this.status = `Could not transcribe (${(e as Error).message}). Type the lesson instead.`;
    }
  }

  show(): void {
    this.open = true;
    this.form.hidden = false;
    this.input.focus();
  }

  hide(): void {
    this.open = false;
    this.form.hidden = true;
    this.input.blur();
  }

  get busy(): boolean {
    return this.busySince > 0;
  }

  private async coach(run: (c: Cortex) => Promise<CortexResult>, gated: boolean): Promise<void> {
    if (this.busy) return;
    this.busySince = performance.now();
    this.setButtons(true);
    const before = this.host.memo();
    try {
      const out = await runCoach(LOCAL_ONLY ? localCoachChain(this.host.browserCoach()) : coachChain(this.host.browserCoach()), run, before, { gated, names: NAMES });
      // Players get a short version; the detailed note goes to the console for us.
      if (out.failed.length) console.info("[coach]", out.note);
      const who = out.res ? COACH_LABEL[out.res.source] : "";
      const helped = out.failed.length && out.res ? `Muse Spark is busy right now, so the ${who} helped. ` : "";
      this.status = !out.res ? out.note : out.memo ? `${helped}Memo updated by the ${who}.` : `${helped}The new plan did worse in practice fights, so ${this.host.petName()} keeps its memo.`;
      if (out.memo) {
        this.host.setMemo(out.memo);
        this.proof = prove(before.rules.length ? before : null, out.memo);
        this.input.value = "";
      }
    } finally {
      this.busySince = 0;
      this.setButtons(false);
    }
  }

  private setButtons(off: boolean): void {
    for (const b of this.form.querySelectorAll("button, input")) (b as HTMLButtonElement).disabled = off && (b as HTMLElement).dataset.act !== "close";
  }

  review(): void {
    void this.coach((c) => c.reflect(this.host.memo(), this.host.recent()), true);
  }

  // The same screen as one panel on the plane.
  panel(t: number): ScenePanel {
    const talk = this.busy ? `${this.host.petName()} is ${thinkingLabel(performance.now() - this.busySince)}` : this.status;
    const rules = this.host.memo().rules.map((r, i) => ({ label: `${i + 1}. ${r.do.toUpperCase()}: when ${r.if.map(describeCond).join(" and ")}` }));
    const h = this.proof?.heldout;
    const proof = h ? [{ label: `Proof: ${h.winRateDelta >= 0 ? "+" : ""}${(100 * h.winRateDelta).toFixed(1)} pts, ${Math.round(h.before.winRate * 100)}% > ${Math.round(h.after.winRate * 100)}% wins, ${h.n} new fights`, ink: h.winRateDelta > 0 ? PAL.grassD : h.winRateDelta < 0 ? PAL.coral : PAL.wood }] : [];
    return {
      place: "middle",
      title: `Teach ${this.host.petName()}`,
      width: 64,
      rows: [
        { label: talk, ink: PAL.wood },
        { label: " " },
        ...(rules.length ? rules : [{ label: "(no rules yet: it just tackles)" }]),
        ...proof,
        { label: " " },
        { label: `> ${this.input.value}${Math.floor(t * 2) & 1 ? "_" : " "}` },
      ],
      footer: "Enter: teach  Tab: review fights  Esc: close",
    };
  }

  draw(g: CanvasRenderingContext2D, sw: number, sh: number, t: number): void {
    g.fillStyle = PAL.grassD;
    g.fillRect(0, 0, sw, sh);
    const x = 8;
    const w = sw - 16;
    drawFrame(g, x, 6, w, sh - 12);
    const p = this.host.portrait();
    const bob = Math.floor(t * 2) % 2;
    g.drawImage(p, x + 8, 12 + bob);
    drawText(g, `Teach ${this.host.petName()}`, x + 8 + p.width + 8, 16, PAL.wood);
    const talk = this.busy ? `${this.host.petName()} is ${thinkingLabel(performance.now() - this.busySince)}` : this.status;
    wrap(talk, w - p.width - 32).slice(0, 3).forEach((l, i) => drawText(g, l, x + 8 + p.width + 8, 28 + i * LINE, PAL.sandD));

    let y = 12 + p.height + 6;
    // Action first, so a cut line still says what the pet will do.
    const rules = this.host.memo().rules.map((r) => `${r.do.toUpperCase()}: when ${r.if.map(describeCond).join(" and ")}`);
    if (!rules.length) {
      drawText(g, "(no rules yet: it just tackles)", x + 10, y, PAL.sandD);
      y += LINE + 4;
    }
    // Two lines per rule when there is room; one line each (cut with "..") when the proof card is up or
    // the memo is long, so all rules stay visible.
    const perRule = this.proof || rules.length > 4 ? 1 : 2;
    const cols = Math.floor((w - 34) / GLYPH);
    for (const [i, r] of rules.entries()) {
      let ws = wrap(r, w - 34);
      if (ws.length > perRule) ws = [...ws.slice(0, perRule - 1), `${ws[perRule - 1]!.slice(0, cols - 2)}..`];
      drawText(g, `${i + 1}.`, x + 8, y, PAL.wood);
      for (const l of ws) {
        drawText(g, l, x + 26, y);
        y += LINE;
      }
      y += perRule === 2 ? 2 : 0;
    }
    if (this.proof) this.drawProof(g, x + 6, Math.min(y + 3, sh - 62), w - 12); // stays above the DOM form
  }

  // Compact proof card: the change in win rate on paired fights the coach never saw.
  private drawProof(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const h = this.proof!.heldout;
    const d = 100 * h.winRateDelta;
    g.fillStyle = PAL.sand;
    g.fillRect(x, y, w, 28);
    const delta = `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`;
    drawText(g, "Proof:", x + 6, y + 4, PAL.wood);
    drawText(g, delta, x + 6 + 7 * GLYPH, y + 4, d > 0 ? PAL.grassD : d < 0 ? PAL.coral : PAL.wood);
    drawText(g, `${Math.round(h.before.winRate * 100)}% > ${Math.round(h.after.winRate * 100)}% wins, ${h.n} new fights`, x + 6, y + 16, PAL.ink);
  }
}
