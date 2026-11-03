# Pet minds

**Role:** your companion, and the proof that AI teaching changes behaviour. NPCs come first; pets get deeper after them.

## What a pet is
- Hatched with random genes, which set its look and persona.
- Follows you, reacts on its own, has needs and moods, and joins the village's day.
- Wild pets can be befriended and join your party.

## Teach and Prove
- **Teach:** you give a lesson in words. Muse Spark Open or the tuned local model turns it into a memo: at most 8 rules in a small DSL.
- **The memo runs the fight:** a pure policy. Same seed, same luck.
- **Prove:** paired seeds compare the pet with and without the memo. It reports a real win-rate change, not vibes.
- Target lift: +15 points. Teacher +21.6, tuned 1B about +21. Details: `models.md`.

## Fight rules (2026-11-03, final plan P1)
The 5 moves and the memo DSL are unchanged, so the tuned 1B (Instinct, coach) needs no retrain. New depth in `sim/battle.ts`:
- **Block:** guarding while the foe hits. **Counter:** an attack right after a block, x1.5.
- **Charge:** each block adds 1 (max `CHARGE_MAX` 2); the next attack at full charge is the signature move, x2, and uses it.
- **Crits:** 8% each side, x1.5. **Foe counter:** attacking into the foe's guard makes its next hit x1.5. Both sides play by the same rules.
- Brute HP 44 -> 48, so an untaught pet still loses to it.
- `TurnRecord.fx` (`block`, `counter`, `signature`, `crit`, `foe-counter`, `foe-crit`), `charge`, `shout` feed the battle screen and the fight review. `step(action, shout)` marks a trainer's call.

Bench (`.scratch/combat/bench.ts`, 200 held-out seeds, win rate per foe brute/skitter/turtle/pal/bully):
| Memo | Before | After |
|---|---|---|
| none (baseline) | 21/90/86/100/6 | 13/93/87/99/5 |
| guard heavy, befriend hurt, emote at a guard | 100/94/100/100/47 | 97/94/100/100/51 |
| Prove lift, held-out | +27.6 pts | **+29.0 pts** |

Wild pets stay a learnable ladder; the real challenge is the NPC rivals and other players (P1 rivals, `docs/plan/final-plan.md`).

## Mind
Needs, plan, choose, emote and reflect use the same scheduler as villagers. Lines are short. The persona comes from genes and the memo.

## Other model use
- Voice teaching goes through Meta's transcriber.
- Babble is local audio, with no model.

## Open
- Pet chat has no check list beyond `../testing/checks/pet.md`.
- Backlog: pet jobs, breeding, deeper memories of owners. Not before NPC chat is good.
