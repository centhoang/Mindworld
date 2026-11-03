// Fights: a wild pet or a live duel, played on the battle screen.
import { petLook } from "../game/genes";
import { shareGhost } from "../game/ghost-api";
import type { Speaker } from "../game/chatter";
import type { Instinct } from "../game/instinct";
import { addToParty } from "../game/party";
import type { CloudPlan } from "../game/rival-api";
import type { FightWorld, Transport } from "../game/ports";
import { MAX_TAMED, save, type Save } from "../game/save";
import { addCoins, coinsFor } from "../game/shop";
import { Battle } from "../sim/battle";
import { duelCoins, duelView, type DuelResult, type Fighter } from "../sim/duel";
import { ENEMIES, type EnemyDef } from "../sim/enemies";
import { GHOST_ARCHETYPE, ghostPet, type Genes } from "../sim/ghost";
import { coachReview } from "../sim/review";
import { duelEnd, rehearse, rivalDef, rivalLabel, rivalOf, whyLost, type DuelEnd, type RivalOwner } from "../sim/rivals";
import { withTactics, type WildMemos } from "../sim/tactics";
import type { DEFAULT_PET, Intent, Outcome, Replay } from "../sim/types";
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
const STUDY_MS = 10_000; // longest a villager studies on the battle screen before it fights with its bundled plans

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
  coolFoe: (foe: Wild) => void;
  memoKey: () => string;
  brainTag: () => string;
  duelBegun: () => void;
}

export function makeFightFlow(d: FightDeps) {
  const { world, state, pet, battleView, teach, instinct } = d;
  const DUEL_END: Record<DuelResult, [Outcome, string]> = { win: ["win", "ko"], loss: ["loss", "ko"], draw: ["timeout", ""], friends: ["win", "friends"] };
  async function duel(seed: number, a: Fighter, b: Fighter): Promise<void> {
    const me = d.live().myId === a.id ? "a" : d.live().myId === b.id ? "b" : null;
    if (!me || d.mode() !== "world") return; // not ours, or busy (the other side still sees the whole duel)
    d.duelBegun();
    d.setMode("battle");
    d.keys.clear();
    const them = me === "a" ? b : a;
    const v = duelView(a, b, seed, me);
    const mine = { ...d.side(d.activeMember()), maxHp: v.myMaxHp };
    await battleView.open({ name: them.name.slice(0, 12), sprite: drawMonster(petLook(them.genes), 64, "front"), genes: them.genes, maxHp: v.theirMaxHp, level: 3 }, mine, `${them.name.slice(0, 12)} is ready to duel!`);
    await battleView.say(`Live duel! Both pets follow their own memo rules. Same fight on both screens.`);
    for (const t of v.turns) await battleView.playTurn(t.mine, "", "duel", t.theirAct, t.dealt, t.taken, t.myHp, t.theirHp, { fx: t.fx, charge: t.charge });
    await battleView.end(...DUEL_END[v.result]);
    const earned = duelCoins(v.result);
    if (earned) {
      state.coins = addCoins(state.coins ?? 0, earned);
      await battleView.say(`+${earned} coins.`);
    }
    save(state);
    d.setMode("world");
  }

  // One fight on the battle screen, a wild pet or a villager's: Fight = watch the pet play its memo; Teach = change
  // the memo first; Swap = next party member; Run = leave (null).
  async function play(battle: Battle, foeName: string): Promise<Replay | null> {
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
      } else return null;
    }
    // The pet's brain: a firing memo rule decides at once; otherwise a local Llama (if loaded) picks among
    // the moves the memo allows and gives the line, with the reflex as fallback. The next pick is prefetched
    // while the current turn animates.
    const name = d.activeMember().name;
    let next = instinct.decide(name, state.memo, battle.observe());
    battleView.allowShouts();
    while (!battle.done) {
      const obs = battle.observe();
      const left = battleView.shouts;
      await battleView.say(`${foeName} ${TELL[obs.intent]}${left ? ` (1-5: shout a move, ${left} left)` : ""}`);
      const choice = await next;
      const tag = choice.source === "rule" ? `memo #${choice.rule! + 1}` : choice.source === "model" ? d.brainTag() : "instinct";
      const shout = battleView.takeShout(); // the trainer's call beats the memo for this one turn
      const rec = battle.step(shout ?? choice.action, !!shout);
      if (!battle.done) next = instinct.decide(name, state.memo, battle.observe());
      await battleView.playTurn(rec.action, shout ? "" : choice.line, tag, rec.enemyAct, rec.dealt, rec.taken, rec.myHp, rec.enemyHp, rec);
    }
    return battle.replay();
  }

  async function fight(w: Wild): Promise<void> {
    d.setMode("battle");
    d.keys.clear();
    const arch = w.arch;
    d.setFoeVoice(arch);
    const def = withTactics(ENEMIES[arch], d.wildMemos()[arch]);
    const battle = new Battle({ enemy: arch, seed: Math.floor(Math.random() * 1e9), enemyDef: def });
    const foeName = arch[0]!.toUpperCase() + arch.slice(1);
    const foeSprite = drawMonster(petLook(w.genes), 64, "front", BUILDS[arch]);
    await battleView.open({ name: foeName, sprite: foeSprite, genes: w.genes, maxHp: def.maxHp, level: 2 + (w.id % 3) }, d.side(d.activeMember()));
    const replay = await play(battle, foeName);
    if (!replay) {
      await battleView.say("You slip away safely.");
      d.coolFoe(w);
      d.setMode("world");
      return;
    }
    await battleView.end(replay.outcome, replay.how);
    if (replay.outcome === "win") {
      world.cheerPet();
      const earned = coinsFor(replay.outcome, replay.how);
      state.coins = addCoins(state.coins ?? 0, earned);
      let msg = `+${earned} coins.`;
      if (replay.how === "befriended") {
        state.tamed = [...(state.tamed ?? []), w.arch].slice(-MAX_TAMED); // v1 readers
        state.party = addToParty(state.party ?? [], w.arch, w.genes);
        state.active = Math.min(state.active ?? 0, state.party.length);
        d.refreshParty();
        msg = `${state.party.at(-1)!.name} the ${w.arch} is yours now! It waits at your corner. ${msg}`;
      }
      await battleView.say(msg);
      await review(replay, foeName, () => withTactics(ENEMIES[arch], d.wildMemos()[arch]));
      world.removeWild(w.id);
      const meadow = world.world.platforms.find((p) => Math.hypot(p.x - w.home.x, p.z - w.home.z) <= p.r);
      if (meadow) setTimeout(() => world.spawnWild(meadow.x, meadow.z, meadow.r), 20000);
    } else {
      await review(replay, foeName, () => withTactics(ENEMIES[arch], d.wildMemos()[arch]));
      d.coolFoe(w); // give the player time to walk away
    }
    state.recent = [...state.recent, replay].slice(-8);
    // A win with a taught memo shares its rules: the Worker's cron has Muse Spark re-teach wild pets from them.
    if (replay.outcome === "win" && state.memo.rules.length > 0 && state.shared !== d.memoKey()) {
      void shareGhost(pet.name, state.genes, state.memo, state.home).then((r) => {
        if (!r.ok) return;
        state.shared = d.memoKey();
        state.mine = [...(state.mine ?? []), r.id].slice(-20);
        save(state);
      });
    }
    state.steps = { ...state.steps, fought: true };
    save(state);
    d.setMode("world");
  }
  // The coach's review after a fight (sim/review.ts): what went wrong and the one lesson that wins more practice fights
  // against this foe. "Teach it" opens Teach with the lesson typed in. With no lesson to give, `fallback` is said.
  async function review(replay: Replay, foe: string, def: () => EnemyDef, fallback = ""): Promise<void> {
    const r = coachReview(replay, state.memo, { pet: d.activeMember().name, foe, def });
    if (!r) return void (fallback && (await battleView.say(fallback)));
    if (r.seen) await battleView.say(`Coach: ${r.seen}`);
    const pct = (x: number) => `${Math.round(100 * x)}%`;
    await battleView.say(`Coach: one lesson wins ${pct(r.after)} of practice fights against ${foe}, not ${pct(r.before)}:`);
    if ((await battleView.ask(r.lesson, ["Teach it", "Done"])) !== 0) return;
    d.keys.clear();
    teach.show(r.lesson);
    while (teach.open) await new Promise((res) => setTimeout(res, 100));
  }

  // A villager's pet. While the villager studies the player's memo (the cloud plan, if any, arrives meanwhile), the
  // battle screen is up; then it spars its plans in its head (sim/rivals.ts rehearse) and says which one it took.
  // Returns how it ended for the player, or null if they ran.
  async function rival(owner: RivalOwner, plan: Promise<CloudPlan>): Promise<DuelEnd | null> {
    if (d.mode() !== "world") return null;
    d.setMode("battle");
    d.keys.clear();
    d.setFoeVoice(owner);
    const base = rivalOf(owner);
    const label = rivalLabel(base);
    const spec = ghostPet(base.genes, base.name);
    await battleView.open({ name: label, sprite: drawMonster(petLook(base.genes), 64, "front"), genes: base.genes, maxHp: spec.maxHp, level: 3 }, d.side(d.activeMember()), `${base.ownerName} sends out ${base.name}!`);
    await battleView.say(`${base.ownerName} studies how your pet fights...`);
    const cloud = await Promise.race([plan, new Promise<CloudPlan>((r) => setTimeout(() => r({ rules: [], summary: "", source: "late" }), STUDY_MS))]);
    const study = rehearse(base, state.memo, cloud.rules);
    const rv = { ...base, memo: study.memo };
    const said = study.from === "own" ? `${base.name}, just be yourself!` : study.from === "cloud" && cloud.summary ? cloud.summary : `${base.name}, ${study.plan[0]!.why}!`;
    await battleView.say(`${base.ownerName}: "${said}"`, study.from === "cloud" ? "Muse Spark" : "");
    const log: number[] = [];
    const battle = new Battle({ enemy: GHOST_ARCHETYPE, seed: Math.floor(Math.random() * 1e9), enemyDef: rivalDef(rv, pet, log) });
    const replay = await play(battle, base.name);
    if (!replay) {
      await battleView.say(`${base.ownerName}: "Another time, then."`);
      d.setMode("world");
      return null;
    }
    const end = duelEnd(replay);
    await battleView.end(replay.outcome, replay.how === "befriended" ? "friends" : replay.how);
    const earned = duelCoins(end);
    if (earned) {
      state.coins = addCoins(state.coins ?? 0, earned);
      await battleView.say(`+${earned} coins.`);
    }
    if (end === "loss" || end === "draw") {
      const w = whyLost(replay, log, rv, state.memo);
      await battleView.say(w.why);
      await review(replay, base.name, () => rivalDef(rv, pet, []), w.tip);
    } else await review(replay, base.name, () => rivalDef(rv, pet, []));
    if (end === "win") world.cheerPet();
    state.recent = [...state.recent, replay].slice(-8);
    state.steps = { ...state.steps, fought: true };
    save(state);
    d.setMode("world");
    return end;
  }
  return { fight, duel, rival };
}
