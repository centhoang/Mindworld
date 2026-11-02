// The player's save in localStorage, shared by the v1 (3D) and v2 (pixel) entries. Every field is parsed
// defensively: old or corrupt saves load with defaults instead of failing.

import { parseOnboard, type OnboardSave } from "./onboard";
import { fromHome, parseDecor, plotSlots, type Placement } from "./decor";
import { emptyHome, type DecorKind, type Slot } from "./home";
import { parseCoins, parseOwned } from "./shop";
import { parseFarm, type Farm } from "./farm";
import { parseRoom, type Piece } from "./room";
import { parseActive, parseParty, type PartyMon } from "./party";
import { newSeed, parseGenes, randomGenes } from "./genes";
import { EMPTY_MEMO, validateMemo, type Memo } from "../sim/memo";
import type { Genes } from "../sim/ghost";
import { ARCHETYPES, type ArchetypeId, type Replay } from "../sim/types";

// `?p=2` keeps a second player's save apart, so a new tab in the same browser is someone else.
const player = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("p");
export const SAVE_KEY = `petmind.v1${player ? `.p${player.slice(0, 4)}` : ""}`;
export const MAX_TAMED = 6;
export interface Save {
  memo: Memo;
  recent: Replay[];
  shared?: string; // the memo rules last uploaded as a ghost, so the same pet is not re-shared every fight
  mine?: string[]; // ids of ghosts this browser uploaded, to label your own ghost when you meet it
  home: Slot[]; // decor on the pet's home plot (derived from decor; kept for older readers)
  decor: Placement[]; // everything placed in your corner: plot ring + A-frame porch
  coins?: number; // earned from wild wins and befriends, spent at the market
  owned?: DecorKind[]; // decor bought at the market (the starter set is always owned)
  muted?: boolean; // in-world voice off
  name?: string; // the name over your head; empty = the one your pet's genes give you
  hide?: Record<string, boolean>; // UI panels closed with the small buttons
  steps?: { fought?: boolean; proved?: boolean; shipped?: boolean }; // first-steps guide progress
  tamed?: ArchetypeId[]; // wild pets befriended in the meadow; they live in your corner
  genes: Genes; // the pet's looks, rolled at hatch (older saves get one on first load)
  onboard?: OnboardSave; // first-run hatch + hints seen, goals card closed
  party?: PartyMon[]; // v2: befriended pets you own (with their looks)
  active?: number; // v2: who walks and fights: 0 = hatched pet, i = party[i - 1]
  pack?: Partial<Record<string, number>>; // goods from villagers that are not crops: fish, wood, herbs
  farm?: Farm; // v2: the beds beside your A-frame, seeds and the harvest basket
  room?: Piece[]; // v2: furniture inside your A-frame
  groundSeed?: number; // v3: your ground's shape + theme (world/ground.ts), rolled once
}

export function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    if (raw) {
      return {
        memo: validateMemo(raw.memo).memo,
        genes: parseGenes(raw.genes) ?? randomGenes(newSeed()),
        recent: Array.isArray(raw.recent) ? raw.recent.slice(-8) : [],
        ...(() => {
          const decor = Array.isArray(raw.decor) ? parseDecor(raw.decor) : fromHome(raw.home);
          return { decor, home: plotSlots(decor) };
        })(),
        coins: parseCoins(raw.coins),
        owned: parseOwned(raw.owned),
        ...(raw.muted === true ? { muted: true } : {}),
        ...(typeof raw.name === "string" && raw.name ? { name: raw.name.slice(0, 10) } : {}),
        ...(raw.hide && typeof raw.hide === "object" ? { hide: raw.hide } : {}),
        ...(typeof raw.shared === "string" ? { shared: raw.shared } : {}),
        ...(Array.isArray(raw.mine) ? { mine: raw.mine.filter((x): x is string => typeof x === "string").slice(-20) } : {}),
        ...(Array.isArray(raw.tamed)
          ? { tamed: raw.tamed.filter((a): a is ArchetypeId => (ARCHETYPES as readonly string[]).includes(a as string)).slice(-MAX_TAMED) }
          : {}),
        ...(() => {
          const party = parseParty(raw.party);
          return party.length ? { party, active: parseActive(raw.active, party.length) } : {};
        })(),
        ...(raw.pack && typeof raw.pack === "object" ? { pack: Object.fromEntries(Object.entries(raw.pack).filter(([, n]) => typeof n === "number" && n > 0)) } : {}),
        ...(raw.farm ? { farm: parseFarm(raw.farm) } : {}),
        ...(raw.room ? { room: parseRoom(raw.room) } : {}),
        ...(typeof raw.groundSeed === "number" && Number.isInteger(raw.groundSeed) && raw.groundSeed > 0 && raw.groundSeed < 2 ** 31 ? { groundSeed: raw.groundSeed } : {}),
        ...(parseOnboard(raw.onboard) ? { onboard: parseOnboard(raw.onboard) } : {}),
        ...(raw.steps && typeof raw.steps === "object"
          ? { steps: { fought: raw.steps.fought === true, proved: raw.steps.proved === true, shipped: raw.steps.shipped === true } }
          : {}),
      };
    }
  } catch {
    /* private mode or corrupt save: start fresh */
  }
  return { memo: EMPTY_MEMO, genes: randomGenes(newSeed()), recent: [], home: emptyHome(), decor: [] };
}

export function save(state: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: progress lasts for this tab only */
  }
}
