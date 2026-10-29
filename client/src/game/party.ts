// Owned pets: wild pets you befriend join your party (tamed = owned). Slot 0 is always the pet you hatched;
// `active` picks who walks with you and fights. The others live at your corner. They all play the same
// taught memo, so switching pets never changes what the coach measured.

import { parseGenes } from "./genes";
import { liveName } from "../world/live";
import type { Genes } from "../sim/ghost";
import { ARCHETYPES, type ArchetypeId } from "../sim/types";

export interface PartyMon {
  arch: ArchetypeId;
  genes: Genes;
  name: string;
}

export const MAX_PARTY = 6; // befriended pets kept; the oldest leaves when a seventh joins

export const shortName = (g: Genes): string => liveName(g).split(" ").at(-1)!;

export function parseParty(raw: unknown): PartyMon[] {
  if (!Array.isArray(raw)) return [];
  const out: PartyMon[] = [];
  for (const r of raw as Partial<PartyMon>[]) {
    if (!r || typeof r !== "object") continue;
    const genes = parseGenes(r.genes);
    if (!genes || !(ARCHETYPES as readonly string[]).includes(r.arch as string)) continue;
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 12) : shortName(genes);
    out.push({ arch: r.arch as ArchetypeId, genes, name });
  }
  return out.slice(-MAX_PARTY);
}

export function addToParty(party: readonly PartyMon[], arch: ArchetypeId, genes: Genes): PartyMon[] {
  return [...party, { arch, genes, name: shortName(genes) }].slice(-MAX_PARTY);
}

// 0 = the hatched pet, i = party[i - 1]. Out-of-range values fall back to the hatched pet.
export function parseActive(raw: unknown, partySize: number): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= partySize ? raw : 0;
}
