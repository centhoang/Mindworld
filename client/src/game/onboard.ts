// First-run flow for a stranger: a short hatch moment, three cozy hints, and a goals card.
// Pure parts (hint text, goal progress, save parsing) are tested; the DOM part is thin.

export interface OnboardSave {
  seen?: boolean; // the hatch + hints played once; "?" replays them
  goalsHidden?: boolean; // the player closed the goals card
}

export interface Goal {
  id: "befriend" | "teach" | "farm";
  label: string;
  how: string;
  done: boolean;
}

// The goals card: the three things a first visit should touch (teach, tame, farm).
export interface PixelGoalInput {
  taught: boolean; // a lesson changed the memo (steps.proved)
  party: number; // pets befriended
  shipped: boolean; // sold a harvest at the crate or the market
}

export function pixelGoals(g: PixelGoalInput): Goal[] {
  return [
    { id: "teach", label: "Teach your pet (T)", how: "Plain words; it is tested on new fights", done: g.taught },
    { id: "befriend", label: "Befriend a wild pet", how: "Wild meadows; weaken it, then befriend", done: g.party > 0 },
    { id: "farm", label: "Grow and sell a crop", how: "Beds by your A-frame; sell at the crate", done: g.shipped },
  ];
}

// First-run lines for the pixel build, after the hatch line.
export const PIXEL_HINTS: readonly string[] = [
  "WASD or arrows to walk, Shift to run. Your pet follows you everywhere. N: your name.",
  "E talks and uses things: the Elder, wild pets, the farm beds, the market stall, your door.",
  "Bump a wild pet to battle. Your pet fights by its memo: press T to teach it new rules. G: goals.",
];

export interface Hint {
  icon: string;
  title: string;
  body: string;
}

export function hints(touch: boolean): Hint[] {
  return [
    {
      icon: "🐾",
      title: "Walk around",
      body: touch ? "Tap the ground to walk. Pinch to zoom. Your pet follows you." : "WASD or arrow keys, or click the ground. Scroll to zoom. Your pet follows you.",
    },
    {
      icon: "💬",
      title: "Say hi",
      body: touch
        ? "Walk up to the elder, a wild pet or a stall, then tap the big button that appears."
        : "Walk up to the elder, a wild pet or a stall, then press E (or click them).",
    },
    {
      icon: "🏡",
      title: "Explore",
      body: "Wild pets roam the meadow to the east. Your A-frame cabin is right here: chill on the porch or decorate it.",
    },
  ];
}

export function parseOnboard(raw: unknown): OnboardSave | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  return { ...(r.seen === true ? { seen: true } : {}), ...(r.goalsHidden === true ? { goalsHidden: true } : {}) };
}

export const isTouch = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Hatch moment: an egg wobbles, cracks, and the pet's name pops. Resolves when done (or tapped).
export function playHatch(root: HTMLElement, petName: string): Promise<void> {
  root.innerHTML = `<div class="egg">🥚</div><div class="hatchText">Something is wiggling…</div>`;
  root.hidden = false;
  root.classList.remove("hatched");
  return new Promise((done) => {
    let finished = false;
    const timers: number[] = [];
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach((t) => clearTimeout(t));
      root.hidden = true;
      root.removeEventListener("click", finish);
      done();
    };
    timers.push(
      window.setTimeout(() => {
        root.classList.add("hatched");
        root.innerHTML = `<div class="egg">🐣</div><div class="hatchText">Meet <b>${esc(petName)}</b>!<br><span class="dim">Your pet, with looks all its own.</span></div>`;
      }, 1500),
      window.setTimeout(finish, 3600),
    );
    root.addEventListener("click", finish);
  });
}

// Three-step hint card. Resolves when the player finishes or skips.
export function playHints(root: HTMLElement, list: readonly Hint[]): Promise<void> {
  let i = 0;
  root.hidden = false;
  return new Promise((done) => {
    const render = () => {
      const h = list[i]!;
      root.innerHTML =
        `<div class="hintIcon">${h.icon}</div><div class="hintBody"><b>${esc(h.title)}</b><div>${esc(h.body)}</div></div>` +
        `<div class="row hintNav"><span class="dim">${i + 1} / ${list.length}</span>` +
        `<button type="button" data-a="skip">Skip</button>` +
        `<button type="button" class="primary" data-a="next">${i + 1 < list.length ? "Next" : "Let's go!"}</button></div>`;
    };
    const onClick = (ev: Event) => {
      const a = (ev.target as HTMLElement).closest("button")?.dataset.a;
      if (a === "next" && i + 1 < list.length) return void (i++, render());
      if (a === "next" || a === "skip") {
        root.removeEventListener("click", onClick);
        root.hidden = true;
        done();
      }
    };
    root.addEventListener("click", onClick);
    render();
  });
}

export function renderGoals(root: HTMLElement, list: readonly Goal[]) {
  const n = list.filter((g) => g.done).length;
  root.innerHTML =
    `<div class="row" style="justify-content:space-between"><b>Goals ${n}/${list.length}</b><button type="button" class="chip" data-a="close" aria-label="Hide goals">✕</button></div>` +
    list.map((g) => `<div class="goal${g.done ? " done" : ""}">${g.done ? "✅" : "⬜"} ${esc(g.label)}${g.done ? "" : `<div class="dim">${esc(g.how)}</div>`}</div>`).join("");
}
