// Touch controls for phones and tablets (gap found in P3: a phone could join and watch but not walk). A stick on the
// left walks, pushed to its rim it runs; buttons on the right press E (use, talk, choose), X (back) and T (teach). Each
// sends the same key events as a keyboard, so every screen and menu works unchanged. Shown only on a touch screen.

const STICK = 120; // px across
const DEAD = 0.3; // of the radius: a push smaller than this is no direction
const RUN = 0.85; // pushed this far out, you run
const BUTTONS: readonly [label: string, key: string][] = [["T", "t"], ["X", "Escape"], ["E", "e"]];

const press = (key: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { key }));

// The keys a push of (dx, dy) holds, in a stick of radius r: up to two arrows, and Shift at the rim.
export function stickKeys(dx: number, dy: number, r: number): string[] {
  const d = Math.hypot(dx, dy);
  if (d < r * DEAD) return [];
  const out: string[] = [];
  if (Math.abs(dx) > d * 0.38) out.push(dx < 0 ? "ArrowLeft" : "ArrowRight");
  if (Math.abs(dy) > d * 0.38) out.push(dy < 0 ? "ArrowUp" : "ArrowDown");
  if (d > r * RUN) out.push("Shift");
  return out;
}

export function touchControls(): void {
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    build();
  };
  if (matchMedia("(pointer: coarse)").matches) show();
  else window.addEventListener("touchstart", show, { once: true, passive: true }); // a laptop with a touch screen
}

function build(): void {
  const css = document.createElement("style");
  css.textContent = `
    #stick, #pads { position: fixed; bottom: 44px; touch-action: none; user-select: none; -webkit-user-select: none; z-index: 1; }
    #stick { left: 14px; width: ${STICK}px; height: ${STICK}px; border-radius: 50%; background: rgba(57,70,63,0.35); border: 3px solid rgba(121,88,73,0.8); }
    #stick i { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px; border-radius: 50%;
      background: rgba(255,243,216,0.85); border: 3px solid #795849; }
    #pads { right: 14px; display: flex; gap: 10px; align-items: flex-end; }
    #pads button { width: 54px; height: 54px; border-radius: 50%; font: 14px "Press Start 2P", monospace; color: #FFF3D8;
      background: rgba(165,121,84,0.9); border: 3px solid #795849; padding: 0; touch-action: none; }
    #pads button[data-key=e] { width: 66px; height: 66px; font-size: 18px; }
    #pads button.on { background: #795849; }`;
  document.head.appendChild(css);

  const stick = document.createElement("div");
  stick.id = "stick";
  const knob = document.createElement("i");
  stick.appendChild(knob);
  let held: string[] = [];
  let finger: number | null = null;
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const rad = r.width / 2;
    let [dx, dy] = [e.clientX - r.left - rad, e.clientY - r.top - rad];
    const d = Math.hypot(dx, dy);
    if (d > rad) [dx, dy] = [(dx / d) * rad, (dy / d) * rad];
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const next = stickKeys(dx, dy, rad);
    for (const k of held) if (!next.includes(k)) press(k, false);
    for (const k of next) if (!held.includes(k)) press(k, true);
    held = next;
  };
  const release = () => {
    finger = null;
    knob.style.transform = "";
    for (const k of held) press(k, false);
    held = [];
  };
  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    finger = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    move(e);
  });
  stick.addEventListener("pointermove", (e) => e.pointerId === finger && move(e));
  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);

  const pads = document.createElement("div");
  pads.id = "pads";
  for (const [label, key] of BUTTONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.key = key.toLowerCase();
    const up = () => {
      if (!b.classList.contains("on")) return;
      b.classList.remove("on");
      press(key, false);
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); // keep the chat box's keyboard where it is
      b.classList.add("on");
      press(key, true);
    });
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    pads.appendChild(b);
  }
  document.body.append(stick, pads);
}
