// /lab/npc: the real minds, scheduler and model, with no room and nothing drawn but a table.
import { makeVillagerAnswer } from "../game/chat-flow";
import { randomGenes } from "../game/genes";
import type { Transport } from "../game/ports";
import { WebLlmVoice } from "../game/voices";
import { MindScheduler } from "../mind/scheduler";
import { Overworld } from "../pixel/overworld";
import { NPCS, type Npc } from "../world/live";

const world = new Overworld(randomGenes(7), 1);
world.myName = "Kai";
const brain = new WebLlmVoice();
let loaded = false;
const sched = new MindScheduler(() => (loaded ? brain : null), { paused: () => false });
world.attachMinds(sched, () => loaded, null);
const offline = { status: "offline" } as Transport; // no room: every villager's mind runs here
const { answer } = makeVillagerAnswer({ world, live: () => offline, hostOf: () => null, myName: () => world.myName });

// Villagers also speak up by themselves, and "yes" may answer that, so their bubbles go in the log too.
const heard: string[] = [];
const bubble = world.say.bind(world);
world.say = (key, text, secs, ...rest) => {
  if (key.startsWith("n:") && text !== "...") heard.push(`${key.slice(2)}: ${text}`), log(`(bubble) ${key.slice(2)}: ${text}`);
  bubble(key, text, secs, ...rest);
};

const none = new Set<string>();
setInterval(() => world.update(0.05, none), 50);

let talkingTo: Npc = "pip";
const whoEl = document.getElementById("who")!;
const logEl = document.getElementById("log")!;
const statusEl = document.getElementById("status")!;
const log = (s: string) => {
  logEl.textContent += `${s}\n`;
  logEl.scrollTop = logEl.scrollHeight;
};
for (const id of NPCS) {
  const b = document.createElement("button");
  b.textContent = id;
  b.classList.toggle("on", id === talkingTo);
  b.onclick = () => {
    talkingTo = id;
    for (const o of whoEl.children) o.classList.toggle("on", o === b);
  };
  whoEl.append(b);
}

const loadBtn = document.getElementById("load") as HTMLButtonElement;
loadBtn.onclick = () => {
  loadBtn.disabled = true;
  void brain.load((_text, frac) => (statusEl.textContent = `Loading: ${Math.round(100 * frac)}%`)).then(() => {
    loaded = true;
    statusEl.textContent = "Model ready";
  }, (e: unknown) => {
    loadBtn.disabled = false;
    statusEl.textContent = `Could not load: ${String(e).slice(0, 100)}`;
  });
};

const form = document.getElementById("say") as HTMLFormElement;
const input = form.querySelector("input")!;
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const line = input.value.trim();
  if (!line) return;
  input.value = "";
  const npc = talkingTo;
  const a = world.npcs!.v.agents.find((x) => x.id === npc);
  if (a) world.player = { x: a.pos.x + 1, z: a.pos.z }; // the stage: I always stand beside whoever I talk to
  const t0 = performance.now();
  log(`you > ${npc}: ${line}`);
  void answer(npc, line).then((r) => log(`${npc}: ${r.text}   [${r.source ?? "?"}, ${Math.round(performance.now() - t0)} ms]`));
});

const stage = document.getElementById("stage")!;
setInterval(() => {
  stage.innerHTML = `<tr><th>Villager</th><th>Doing</th></tr>${(world.npcs?.v.agents ?? [])
    .map((a) => `<tr><td>${a.name}</td><td>${a.state}${a.act ? `: ${a.act}` : ""}</td></tr>`)
    .join("")}`;
}, 1000);
(window as unknown as { __lab: unknown }).__lab = { world, answer, sched, heard };
