// Every conversation the player opens: the chat box, private-talk status, and who answers a villager.
import type { Babbler } from "./babble";
import { voiceFor } from "./chatter";
import { askNpc, chatWhoFor, cloudLine, type ChatWho } from "./npc-chat";
import type { ChatWorld, Transport } from "./ports";
import { save, type Save } from "./save";
import { CLOUD_CHAT, LOCAL_ONLY, NO_LOCAL } from "./test-mode";
import { typingMs } from "../mind/human";
import { isNpc, NAME_MAX, SAY_MAX, type Npc } from "../world/live";

export interface PeerChat { peer: string }
export type ChatTarget = ChatWild | Npc | "room" | "name" | PeerChat;
type ChatWild = Parameters<ChatWorld["wildScene"]>[0];

export interface AnswerDeps {
  world: ChatWorld;
  live: () => Transport;
  myName: () => string;
  hostOf: (npc: Npc) => string | null | undefined;
}

export interface ChatDeps extends AnswerDeps {
  state: Save;
  keys: Set<string>;
  babbler: Babbler;
  renamed: () => void;
}

// Who answers a villager, in tiers: the sim when one answer is true; free talk from Muse Spark with the villager's
// memories (CLOUD_CHAT, event credits, server-capped); then the local model. Wherever the mind runs: here, or relayed
// to the player hosting it. With no mind reachable, a bare cloud line; last a scripted one.
const ASK_WAIT_MS = 15_000;
export function makeVillagerAnswer(d: AnswerDeps) {
  const { world } = d;
  const asking = new Map<Npc, (text: string | null) => void>();
  // Nobody answers instantly: a reply takes as long as typing it would, however fast the mind was.
  async function villagerAnswer(npc: Npc, line: string): Promise<{ text: string; source?: string }> {
    const t0 = performance.now();
    const answer = await villagerMind(npc, line);
    await new Promise((r) => setTimeout(r, typingMs(answer.text) - (performance.now() - t0)));
    return answer;
  }

  async function villagerMind(npc: Npc, line: string): Promise<{ text: string; source?: string }> {
    const scene = world.sceneWithMe(npc); // what we both see here, so "what's by the pond?" gets a real answer
    const here = await world.npcs?.reply(npc, d.myName(), line, undefined, scene);
    if (here) return here;
    const hostedHere = !!world.npcs?.hosting(npc);
    if (!hostedHere && d.live().status === "online" && d.hostOf(npc) && !asking.has(npc) && d.live().ask(npc, line, scene)) {
      const text = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => done(null), ASK_WAIT_MS);
        const done = (t: string | null) => {
          clearTimeout(timer);
          asking.delete(npc);
          resolve(t);
        };
        asking.set(npc, done);
      });
      if (text) return { text };
    }
    const cloud = CLOUD_CHAT ? await cloudLine(npc, line, scene) : null;
    if (cloud) return cloud;
    if (LOCAL_ONLY) return { text: NO_LOCAL };
    return askNpc(npc, line, "", undefined, undefined, scene);
  }
  return { answer: villagerAnswer, asking };
}

const wildAnswer = async (who: ChatWho, line: string, scene: string): Promise<{ text: string; source?: string }> => {
  const cloud = CLOUD_CHAT ? await cloudLine(who, line, scene) : null;
  return cloud ?? (LOCAL_ONLY ? { text: NO_LOCAL } : askNpc(who, line, "", undefined, undefined, scene));
};

export type ChatFlow = ReturnType<typeof makeChatFlow>;

export function makeChatFlow(d: ChatDeps) {
  const { world } = d;
  const { answer: villagerAnswer, asking } = makeVillagerAnswer(d);
  // Talking to a wild pet (E when close): Muse Spark answers in character through the Worker (/api/chat,
  // capped and cached; scripted lines when offline). The pet stops wandering while you talk.
  const chatForm = document.getElementById("chat") as HTMLFormElement;
  const chatInput = chatForm.querySelector("input")!;
  let chatWith: ChatTarget | null = null;
  const isPeerChat = (w: ChatTarget | null): w is PeerChat => typeof w === "object" && w !== null && "peer" in w;
  const chatKey = (w: ChatTarget) => (w === "room" || w === "name" || isPeerChat(w) ? "me" : typeof w === "string" ? `n:${w}` : `w${w.id}`);
  const talkTarget = (w: ChatTarget | null) => (isPeerChat(w) ? w.peer : typeof w === "string" && w !== "room" && w !== "name" ? (w as Npc) : null);
  // Private chats: others see a talking status and can't start a chat with those in one (the room enforces it).
  const talks = new Map<string, string>(); // who opened the chat -> who it is with
  const talkKey = (who: string) => (isNpc(who) ? `n:${who}` : `p:${who}`);
  const inMyTalk = (a: string, b: string) => !!world.npcs?.me && (a === world.npcs.me || b === world.npcs.me);
  setInterval(() => {
    for (const [a, b] of talks) {
      if (!inMyTalk(a, b)) for (const who of [a, b]) world.say(talkKey(who), "talking...", 3);
      if (isNpc(b) && world.npcs?.hosting(b)) world.npcs.hold(b); // a villager in a chat stays, whoever hosts it
    }
    if (typeof chatWith === "string" && isNpc(chatWith)) world.npcs?.hold(chatWith);
  }, 2000);
  setInterval(() => {
    const to = talkTarget(chatWith);
    if (to && d.live().status === "online") d.live().talk(to); // renewal: a silent chat ends on the room's timeout
  }, 15_000);
  const GREET: Record<Npc, string> = { elder: "Ah, a visitor. Ask me anything.", mo: "Shh... the fish are listening. Hello!", ama: "Oh, hello dear! Hungry?", pip: "Hi! Wanna play?" };
  function openChat(w: ChatTarget): void {
    const to = talkTarget(w);
    if (to && d.live().status === "online") d.live().talk(to);
    chatWith = w;
    if (typeof w !== "string" && !isPeerChat(w)) w.wait = 999;
    d.keys.clear();
    chatForm.hidden = false;
    chatInput.value = w === "name" ? d.myName() : "";
    chatInput.maxLength = w === "name" ? NAME_MAX : 140;
    chatInput.placeholder = w === "name" ? "Your name..." : "Say something...";
    chatInput.focus();
    if (w === "name") return void chatInput.select();
    if (w !== "room" && !isPeerChat(w)) world.say(chatKey(w), typeof w === "string" ? GREET[w] : "?", 3);
    if (typeof w === "string" && w !== "room") world.npcs?.hold(w);
  }
  function closeChat(): void {
    if (talkTarget(chatWith) && d.live().status === "online") d.live().talk();
    if (chatWith && typeof chatWith !== "string" && !isPeerChat(chatWith)) chatWith.wait = 1;
    chatWith = null;
    chatForm.hidden = true;
    chatInput.blur();
  }
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const w = chatWith;
    const line = chatInput.value.trim();
    if (w === "name") {
      const name = line.replace(/[^\p{L}\p{N} _'-]+/gu, "").slice(0, NAME_MAX).trim();
      if (name) d.state.name = name;
      else delete d.state.name;
      save(d.state);
      closeChat();
      d.renamed();
      return;
    }
    if (w === "room") {
      if (line && d.live().say(line.slice(0, SAY_MAX))) world.say("me", line.slice(0, SAY_MAX), 5);
      chatInput.value = "";
      return;
    }
    if (isPeerChat(w)) {
      if (line && d.live().say(line.slice(0, SAY_MAX), w.peer)) world.say("me", line.slice(0, SAY_MAX), 5);
      chatInput.value = "";
      return;
    }
    const who = typeof w === "string" ? (w as Npc) : w && chatWhoFor("wild", w.arch);
    if (!w || !who || !line) return;
    chatInput.value = "";
    world.say(chatKey(w), "...", 20);
    const answer = typeof w === "string" ? villagerAnswer(w as Npc, line) : wildAnswer(who, line, world.wildScene(w));
    void answer.then((r) => {
      world.say(chatKey(w), r.text, 6);
      if (!d.state.muted) {
        const v = voiceFor(typeof w === "string" ? (w as Npc) : w.arch);
        d.babbler.say(r.text, { base: 250 * v.pitch ** 0.8, speed: v.rate, wave: "triangle" });
      }
    });
  });
  chatForm.querySelector("[data-act=close]")!.addEventListener("click", closeChat);

  return { open: openChat, close: closeChat, target: () => chatWith, isPeerChat, talkTarget, talks, asking };
}
