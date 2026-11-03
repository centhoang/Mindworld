// The live room as the game sees it: who is here, whose ground is where, who hosts each villager.
import type { ChatFlow } from "../game/chat-flow";
import type { RoomWorld } from "../game/ports";
import type { Save } from "../game/save";
import type { Pose } from "../life/activities";
import type { Fighter } from "../sim/duel";
import type { Genes } from "../sim/ghost";
import { worldDay, type GroundOwner } from "./layout";
import { GUEST_SLOT, PLOT_COUNT } from "./village-map";
import { isNpc, LiveLink, NPCS, roomQuery, roomUrl, type Emote, type LivePeer, type Npc } from "./live";

export const EMOTE_TEXT: Record<Emote, string> = { wave: "*waves*", heart: "<3 <3", dance: "*dances*", laugh: "haha!" };

export interface RoomDeps {
  world: RoomWorld;
  state: Save;
  chat: ChatFlow;
  myName: () => string;
  myGenes: () => Genes;
  toast: (text: string, t: number) => void;
  speed: () => number; // tokens a second this machine's model can give the room
  away?: () => boolean; // fighting or indoors: the village does not step here, so its villagers should go elsewhere
  duel: {
    invited: (duel: string, from: string, name: string) => void;
    started: (seed: number, a: Fighter, b: Fighter) => Promise<void>;
    ended: (reason: "declined" | "gone") => void;
  };
}

export function makeRoomFlow(d: RoomDeps) {
  const { world, chat, myName, myGenes } = d;
  const sameSave = (g: Genes) => JSON.stringify(g) === JSON.stringify(myGenes());
  const addPeer = (p: LivePeer) => {
    if (!sameSave(p.genes)) world.addPeer(p.id, p.name, p.genes, p.x, p.z, p.px, p.pz);
  };
  // Grounds: every player in the room holds a slot on the ring; their ground is drawn from the seed in their
  // hello. A player who leaves leaves a ghost ground for 10 min. Any change rebuilds the map (same on every
  // client); so does the shared day (in-between grounds) and a ghost ground expiring.
  const grounds = new Map<string, GroundOwner>(); // live id -> ground
  const aways = new Map<number, { g: GroundOwner; until: number }>(); // slot -> ghost ground
  let mySlot = 0;
  let slotKnown = false; // the room told me my slot: a reconnect asks for it back
  // Testing: pop in a stand-in player's island (the buttons show on localhost or with ?dev).
  const fakes: GroundOwner[] = [];
  function fakeIsle(add: boolean): void {
    if (!add) fakes.pop();
    else {
      const used = new Set([mySlot, ...[...grounds.values()].map((o) => o.slot), ...aways.keys(), ...fakes.map((o) => o.slot)]);
      const slot = Array.from({ length: PLOT_COUNT }, (_, n) => n).find((n) => !used.has(n));
      if (slot !== undefined) fakes.push({ id: `fake${slot}`, name: `Test ${slot}`, seed: slot * 7919 + 13, slot });
    }
    relayoutGrounds();
  }
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || new URLSearchParams(location.search).has("dev"))
    for (const b of document.querySelectorAll<HTMLButtonElement>("#ui [data-dev]")) b.hidden = false;
  const ROOM_SEED = [...roomUrl(location)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  const relayoutGrounds = () => {
    const now = Date.now();
    for (const [slot, a] of aways) if (a.until <= now) aways.delete(slot);
    world.relayout({ me: { seed: d.state.groundSeed!, slot: mySlot }, others: [...grounds.values(), ...[...aways.values()].map((a) => a.g), ...fakes], roomSeed: ROOM_SEED, day: worldDay(now) });
  };
  const trackGround = (p: LivePeer) => {
    if (p.corner === null || sameSave(p.genes)) return;
    aways.delete(p.corner);
    grounds.set(p.id, { id: p.id, name: p.name, seed: p.seed || ([...p.id].reduce((h, c) => h * 33 + c.charCodeAt(0), 5) % 2 ** 31) + 1, slot: p.corner });
  };
  setInterval(() => {
    const due = [...aways.values()].some((a) => a.until <= Date.now());
    if (due || worldDay() !== world.day) relayoutGrounds();
  }, 5000);
  const npcHosts = new Map<Npc, string | null>(); // who runs each NPC's mind (me: it runs in this tab)
  function setNpcHost(npc: Npc, host: string | null): void {
    npcHosts.set(npc, host);
    world.npcs?.setHost(npc, host);
  }
  const DROP_GRACE_MS = 20_000;
  let toldWhere = "1:false"; // what the last welcome told us (room:guest); the main village with a plot says nothing
  let wasOnline = false;
  // What every machine must see the same: where the villagers I host are, and what grows on my ground.
  const SHARE_MS = 500;
  let sharedAt = 0;
  let sharedNpcs = "";
  let sharedFarm = "";
  function shareState(now: number): void {
    if (now - sharedAt < SHARE_MS || live.status !== "online") return;
    sharedAt = now;
    const spots = world.npcs?.spots() ?? [];
    const key = JSON.stringify(spots);
    if (spots.length && key !== sharedNpcs && live.npcs(spots)) sharedNpcs = key;
    const plots = (d.state.farm?.plots ?? []).map((p): [string, number] => [p.crop ?? "", p.stage]);
    const farm = JSON.stringify(plots);
    if (farm !== sharedFarm && live.farm(plots)) sharedFarm = farm;
  }
  const live: LiveLink = new LiveLink(roomUrl(location) + roomQuery(location.search), () => ({ name: myName(), genes: myGenes(), groundSeed: d.state.groundSeed, slot: slotKnown ? mySlot : undefined, ...world.me }), {
    welcome: (id, corner, peers, awayList, npcs = {}, open = [], ball) => {
      if (ball) world.ballKicked(ball);
      chat.talks.clear();
      for (const [a, b] of open) chat.talks.set(a, b);
      npcHosts.clear();
      if (world.npcs) world.npcs.me = id;
      for (const n of NPCS) setNpcHost(n, npcs[n] ?? null);
      world.peers.clear();
      grounds.clear();
      aways.clear();
      mySlot = corner ?? GUEST_SLOT;
      slotKnown = corner !== null;
      // One line on why you are where you are: another village, the Guest yard. Once per room and slot.
      const told = `${live.roomNo}:${corner === null}`;
      if (told !== toldWhere && (live.roomNo > 1 || corner === null)) {
        const where = live.roomNo > 1 ? `The village was full, so you are in village ${live.roomNo}. ` : "";
        d.toast(where + (corner === null ? `All ${PLOT_COUNT} plots are taken, so you live in the Guest yard.` : ""), 5);
      }
      toldWhere = told;
      for (const a of awayList) aways.set(a.slot, { g: { id: `away${a.slot}`, name: a.name, seed: a.seed || 1, slot: a.slot, away: true }, until: Date.now() + a.ttl });
      for (const p of peers) (addPeer(p), trackGround(p));
      relayoutGrounds();
    },
    join: (p) => {
      sharedFarm = sharedNpcs = ""; // the newcomer has not seen them
      addPeer(p);
      trackGround(p);
      relayoutGrounds();
    },
    leave: (id) => {
      world.peers.delete(id);
      if (grounds.delete(id)) setTimeout(relayoutGrounds, 500); // an `away` usually follows and keeps the ground
    },
    enter: (p, plots) => {
      addPeer(p);
      if (plots) world.peerFarms.set(p.id, plots);
    },
    exit: (id) => void world.peers.delete(id), // the ground stays: they are only out of view
    mind: (from, l) => {
      world.hearMind(from, l);
      if (l.say && l.to && l.to === world.npcs?.me && isNpc(l.who)) chat.asking.get(l.who)?.(l.say); // my relayed question's answer
    },
    talking: (id, withWho, on) => {
      const me = world.npcs?.me;
      if (on) chat.talks.set(id, withWho);
      else chat.talks.delete(id);
      if (!me) return;
      if (on && withWho === me && (!chat.target() || chat.target() === "room")) {
        d.toast(`${world.peers.get(id)?.name ?? "Someone"} is talking to you. Esc ends the chat.`, 4);
        chat.open({ peer: id });
      }
      if (!on && (id === me || withWho === me) && chat.isPeerChat(chat.target())) chat.close();
    },
    talkNo: (withWho) => {
      if (chat.talkTarget(chat.target()) !== withWho) return;
      chat.close();
      d.toast("They are talking with someone right now. Try again soon.", 3);
    },
    ask: (npc, from, name, text, scene) => void world.npcs?.reply(npc, name, text, from, scene),
    askNo: (npc) => chat.asking.get(npc)?.(null),
    npcHost: (npc, host) => setNpcHost(npc, host),
    npcState: (npc, log) => world.npcs?.setMemory(npc, log),
    away: (a) => {
      aways.set(a.slot, { g: { id: `away${a.slot}`, name: a.name, seed: a.seed || 1, slot: a.slot, away: true }, until: Date.now() + a.ttl });
      relayoutGrounds();
    },
    pos: (id, x, z, px, pz) => world.movePeer(id, x, z, px, pz),
    pose: (id, pose, flip) => world.posePeer(id, pose as Pose | null, flip),
    npcs: (list) => world.npcs?.shadow(list),
    farm: (id, plots) => void world.peerFarms.set(id, plots),
    emote: (id, e) => world.say(`p:${id}`, EMOTE_TEXT[e], 3),
    ball: (k) => world.ballKicked(k),
    status: (s) => {
      if (s === "online") return void (wasOnline = true);
      if (s === "offline" && wasOnline) d.toast("Lost the village connection. Trying again...", 4);
      wasOnline = false;
      for (const n of NPCS) setNpcHost(n, null);
      if (world.npcs) world.npcs.me = null; // offline: the NPCs' minds run here
      world.peers.clear();
      // A short drop must not pull the islands from under a visitor's feet.
      setTimeout(() => {
        if (live.status === "online" || (!grounds.size && !aways.size)) return;
        grounds.clear();
        aways.clear();
        relayoutGrounds();
      }, DROP_GRACE_MS);
    },
    say: (id, text) => world.say(`p:${id}`, text, 5),
    duel: (duel, from, name) => d.duel.invited(duel, from, name),
    duelStart: (_duel, seed, a, b) => void d.duel.started(seed, a, b),
    duelEnd: (_duel, reason) => d.duel.ended(reason),
  });
  live.connect();
  // Minds online: my pets' activity starts and lines go to the room; others' come back as bubbles. The cap
  // heartbeat tells the room how fast my local model is, so it can pick me to host village NPCs.
  world.onPose = (pose, flip) => void (live.status === "online" && live.pose(pose, flip));
  world.onKick = (k) => void (live.status === "online" && live.kick(k));
  world.onMind = (l) => void (live.status === "online" && live.mind(l.say ? { ...l, ...world.speakerAt(l.who) } : l));
  // The heartbeat goes every 10 s, and at once when this tab goes away (hidden, fighting, indoors) or comes back:
  // villagers hosted by a tab whose village does not step would stand still for everyone (join check, bug 51).
  let beatAt = 0;
  let beatBg: boolean | null = null;
  const beat = () => {
    if (live.status !== "online") return void (beatBg = null);
    const bg = document.hidden || !!d.away?.();
    const now = Date.now();
    if (bg === beatBg && now - beatAt < 10_000) return;
    if (live.cap(d.speed(), "gpu" in navigator, bg)) [beatAt, beatBg] = [now, bg];
  };
  setInterval(beat, 1000);
  document.addEventListener("visibilitychange", beat);
  return { live, shareState, fakeIsle, hostOf: (npc: Npc) => npcHosts.get(npc) };
}
