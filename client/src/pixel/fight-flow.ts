// Fights: a wild pet, the boss, a ghost, or a live duel, played on the battle screen.
import { parseGenes, petLook, randomGenes } from "../game/genes";
import { fetchRandomGhost, shareGhost } from "../game/ghost-api";
import type { Speaker } from "../game/chatter";
import type { Instinct } from "../game/instinct";
import { addToParty } from "../game/party";
import type { FightWorld, Transport } from "../game/ports";
import { MAX_TAMED, save, type Save } from "../game/save";
import { addCoins, coinsFor } from "../game/shop";
import { Battle } from "../sim/battle";
import { BOSS_ARCHETYPE, BOSS_FOCUS, BOSS_STATS, BOSS_TURNS, makeBoss, type Boss } from "../sim/boss";
import { duelCoins, duelView, type DuelResult, type Fighter } from "../sim/duel";
import { ENEMIES } from "../sim/enemies";
import { GHOST_ARCHETYPE, ghostEnemyDef, type Genes, type Ghost } from "../sim/ghost";
import { withTactics, type WildMemos } from "../sim/tactics";
import type { DEFAULT_PET, Intent, Outcome } from "../sim/types";
import type { BattleView, Side } from "./battle";
import { BUILDS, drawMonster } from "./monster";
import type { Wild } from "./overworld";
import type { TeachScreen } from "./teach";

const TELL: Record<Intent, string> = {
  idle: "is watching you.",
  heavy: "winds up a HEAVY hit!",
  guarding: "hides behind its guard.",
  calm: "looks calm.",
  scared: "looks hurt and scared.",
};

type Member = { name: string; genes: Genes };

export interface FightDeps {
  world: FightWorld;
  state: Save;
  pet: typeof DEFAULT_PET;
  live: () => Transport;
  keys: Set<string>;
  battleView: BattleView;
  teach: TeachScreen;
  instinct: Instinct;
  mode: () => string;
  setMode: (m: "world" | "battle") => void;
  setFoeVoice: (v: Speaker) => void;
  wildMemos: () => WildMemos;
  members: () => Member[];
  activeMember: () => Member;
  side: (m: Member) => Side;
  refreshParty: () => void;
  coolFoe: (foe: Foe) => void;
  memoKey: () => string;
  brainTag: () => string;
  duelBegun: () => void;
  toast: (text: string, t: number) => void;
}

type Foe = Wild | "boss" | "ghost";

export function makeFightFlow(d: FightDeps) {
  const { world, state, pet, battleView, teach, instinct } = d;
  const DUEL_END: Record<DuelResult, [Outcome, string]> = { win: ["win", "ko"], loss: ["loss", "ko"], draw: ["timeout", ""], friends: ["win", "befriended"] };
  async function duel(seed: number, a: Fighter, b: Fighter): Promise<void> {
    const me = d.live().myId === a.id ? "a" : d.live().myId === b.id ? "b" : null;
    if (!me || d.mode() !== "world") return; // not ours, or busy (the other side still sees the whole duel)
    d.duelBegun();
    d.setMode("battle");
    d.keys.clear();
    const them = me === "a" ? b : a;
    const v = duelView(a, b, seed, me);
    const mine = { ...d.side(d.activeMember()), maxHp: v.myMaxHp };
    await battleView.open({ name: them.name.slice(0, 12), sprite: drawMonster(petLook(them.genes), 64, "front"), maxHp: v.theirMaxHp, level: 3 }, mine);
    await battleView.say(`Live duel! Both pets follow their own memo rules. Same fight on both screens.`);
    for (const t of v.turns) await battleView.playTurn(t.mine, "", "duel", t.theirAct, t.dealt, t.taken, t.myHp, t.theirHp);
    await battleView.end(...DUEL_END[v.result]);
    const earned = duelCoins(v.result);
    if (earned) {
      state.coins = addCoins(state.coins ?? 0, earned);
      await battleView.say(`+${earned} coins.`);
    }
    save(state);
    d.setMode("world");
  }

  async function fight(foe: Wild | "boss" | "ghost"): Promise<void> {
    d.setMode("battle");
    d.keys.clear();
    const w = typeof foe === "string" ? null : foe;
    const boss: Boss | null = foe === "boss" ? makeBoss(state.memo, pet) : null;
    // A ghost: another player's shared pet (looks + memo rules) from the Worker, or a bundled one offline.
    const ghost: Ghost | null = foe === "ghost" ? (await fetchRandomGhost()).ghost : null;
    const arch = w ? w.arch : ghost ? GHOST_ARCHETYPE : BOSS_ARCHETYPE;
    const tactic = w ? d.wildMemos()[w.arch] : undefined;
    d.setFoeVoice(ghost ? "ghost" : arch);
    const def = boss ? boss.def : ghost ? ghostEnemyDef(ghost, pet) : withTactics(ENEMIES[arch], tactic);
    const battle = new Battle({ enemy: arch, seed: Math.floor(Math.random() * 1e9), enemyDef: def, ...(boss ? { maxTurns: BOSS_TURNS } : {}) });
    const foeName = boss ? BOSS_STATS.label : ghost ? ghost.name.slice(0, 12) : arch[0]!.toUpperCase() + arch.slice(1);
    const foeSprite = boss
      ? drawMonster(petLook(randomGenes(4242)), 80, "front", BUILDS.bully)
      : ghost
        ? drawMonster(petLook(parseGenes(ghost.genes) ?? randomGenes(1)), 64, "front")
        : drawMonster(petLook(w!.genes), 64, "front", BUILDS[arch]);
    await battleView.open({ name: foeName, sprite: foeSprite, maxHp: def.maxHp, level: boss ? 9 : ghost ? 5 : 2 + (w!.id % 3) }, d.side(d.activeMember()));
    if (ghost) await battleView.say(`${ghost.name}'s ghost fights with its owner's memo: ${ghost.memo.rules.length} rule${ghost.memo.rules.length === 1 ? "" : "s"}.`);
    if (boss) {
      await battleView.say(d.wildMemos().boss?.summary ? `"${d.wildMemos().boss?.summary}"` : `"I can read your pet's memo. Every rule. Surprise me."`);
      await battleView.say(`It loses focus after ${BOSS_FOCUS} reads. A dazed boss might make friends.`);
    }
    // Fight = watch the pet play its memo; Teach = change the memo first; Swap = next party member; Run = leave.
    for (;;) {
      const c = await battleView.choose();
      if (c === "fight") break;
      if (c === "teach") {
        d.keys.clear();
        teach.show();
        while (teach.open) await new Promise((r) => setTimeout(r, 100));
      } else if (c === "swap") {
        const n = d.members().length;
        if (n < 2) await battleView.say("No one else is with you yet. Befriend a wild pet!");
        else {
          state.active = ((state.active ?? 0) + 1) % n;
          save(state);
          d.refreshParty();
          await battleView.swapMine(d.side(d.activeMember()));
        }
      } else {
        await battleView.say("You slip away safely.");
        d.coolFoe(foe);
        d.setMode("world");
        return;
      }
    }
    // The pet's brain: a firing memo rule decides at once; otherwise a local Llama (if loaded) picks among
    // the moves the memo allows and gives the line, with the reflex as fallback. The next pick is prefetched
    // while the current turn animates.
    const name = d.activeMember().name;
    let next = instinct.decide(name, state.memo, battle.observe());
    while (!battle.done) {
      const obs = battle.observe();
      await battleView.say(`${foeName} ${TELL[obs.intent]}`);
      const choice = await next;
      const tag = choice.source === "rule" ? `memo #${choice.rule! + 1}` : choice.source === "model" ? d.brainTag() : "instinct";
      const rec = battle.step(choice.action);
      if (!battle.done) next = instinct.decide(name, state.memo, battle.observe());
      await battleView.playTurn(choice.action, choice.line, tag, rec.enemyAct, rec.dealt, rec.taken, rec.myHp, rec.enemyHp);
      const read = boss?.reads.find((r) => r.turn === obs.turn);
      if (read) await battleView.say(`It read memo #${read.rule + 1}! ${read.did === "idle" ? "It faked the tell." : "It hit hard anyway."}`, "boss read");
      else if (boss?.dazedTurns.includes(obs.turn)) await battleView.say(`${foeName} is dazed: it can't read you now.`, "dazed");
    }
    const replay = battle.replay();
    await battleView.end(replay.outcome, replay.how);
    if (replay.outcome === "win") {
      const earned = coinsFor(replay.outcome, replay.how);
      state.coins = addCoins(state.coins ?? 0, earned);
      let msg = `+${earned} coins.`;
      if (replay.how === "befriended" && w) {
        state.tamed = [...(state.tamed ?? []), w.arch].slice(-MAX_TAMED); // v1 readers
        state.party = addToParty(state.party ?? [], w.arch, w.genes);
        state.active = Math.min(state.active ?? 0, state.party.length);
        d.refreshParty();
        msg = `${state.party.at(-1)!.name} the ${w.arch} is yours now! It waits at your corner. ${msg}`;
      }
      if (boss) msg = `You outsmarted The Reader! ${msg}`;
      await battleView.say(msg);
      if (w) {
        world.removeWild(w.id);
        const meadow = world.world.platforms.find((p) => Math.hypot(p.x - w.home.x, p.z - w.home.z) <= p.r);
        if (meadow) setTimeout(() => world.spawnWild(meadow.x, meadow.z, meadow.r), 20000);
      } else d.coolFoe(foe);
    } else {
      if (boss) await battleView.say("Tip: it reads your rules. Teach a plan it can't predict, then come back.");
      d.coolFoe(foe); // give the player time to walk away
    }
    if (w) state.recent = [...state.recent, replay].slice(-8);
    // Winning wild fights with a taught memo shares your pet as a ghost others can fight (rules only).
    if (w && replay.outcome === "win" && state.memo.rules.length > 0 && state.shared !== d.memoKey()) {
      void shareGhost(pet.name, state.genes, state.memo, state.home).then((r) => {
        if (!r.ok) return;
        state.shared = d.memoKey();
        state.mine = [...(state.mine ?? []), r.id].slice(-20);
        save(state);
        d.toast(`${pet.name}'s ghost is out there now: other players can fight its memo.`, 4);
      });
    }
    state.steps = { ...state.steps, fought: true, ...(boss && replay.outcome === "win" ? { boss: true } : {}) };
    save(state);
    d.setMode("world");
  }
  return { fight, duel };
}
