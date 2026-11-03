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

Wild pets stay a learnable ladder; the real challenge is the NPC rivals and other players.

## Village rivals (2026-11-03, P1)
Code: `client/src/sim/rivals.ts` (pure), `pixel/fight-flow.ts` `rival()`, `mind/npcs.ts` `duelTalk`/`challenge`/`duelDone`,
`game/rival-api.ts`, worker `src/rival.ts` (`POST /api/rival`).
- **Pets:** Elder's Sage (balanced: finishes a weak foe, strikes after a block), Mo's Ripple (counter-puncher: guards, then
  a heavy counter), Ama's Honey (kind back to kindness, blocks a bully), Pip's Zip (reckless, fast, light; arrives with
  Pip's goal). Genes fixed per villager, so the overworld sprite and the battle sprite match.
- **Ask:** "wanna duel?", "let's battle", "fight me" (`duelAsked`). Refusals in order: no pet, grudge, night (4 real min
  of every 12), at work, 3 duels today. A villager with fun < 50 also challenges a passing player (35%, once a day each);
  "yes" starts it. Results: memory line, `outfought` (respect +8) or `sparred` beat, belief to every other hosted mind
  ("beat Mo's Ripple in a duel"), coins as live duels (win 3, friends 2).
- **Adapting (agentic):** before the fight the villager rehearses plans against the player's memo (deterministic proxy,
  32 fixed seeds each): its own style, 5 bundled counter-plans and the cloud plan, each also gated (turn >= 3, or own
  HP < 60). Its own style stays if the player would win <= 40% anyway; else it takes the plan nearest a 40% player chance
  (`FAIR`). The model proposes, the sim decides.
- **Cloud plan:** Muse Spark writes 1-3 counter-rules in the villager's style from the player's rules (no notes sent) and
  move counts. KV cache per (villager, memo hash) 2 days; `RIVAL_DAILY_USD` 1, quota 20/client and 400/day; 3200 max
  tokens. Told to "think briefly" it reasons ~900-1300 tokens (4-13 s, ~$0.01); without that it ran past 2400 and was cut.
  The client asks when a chat with a villager who has a pet opens and waits at most 10 s on the battle screen.
- **Loss explanation:** `rivalDef` logs which rival rule chose each turn; `whyLost` names the rule behind most damage
  ("Ripple strikes right after it guards, with a HEAVY hit.") and a lesson to teach.

Bench (`.scratch/combat/rival-bench.ts`, 400 seeds, player win % vs elder/mo/ama/pip):
| Player memo | Own style | After the rival adapts |
|---|---|---|
| none | 23/0/0/66 | 23/0/0/66 |
| guard heavy, befriend hurt, emote at a guard | 78/69/100/82 | 70/62/71/70 |
| guard heavy, attack after guard, emote at a guard | 26/22/100/66 | 26/22/46/22 |
| always attack | 60/0/2/96 | 60/0/2/96 |
| always guard | 89/0/0/0 | 0/0/0/0 (draws: both pets wait) |

## Mind
Needs, plan, choose, emote and reflect use the same scheduler as villagers. Lines are short. The persona comes from genes and the memo.

## Other model use
- Voice teaching goes through Meta's transcriber.
- Babble is local audio, with no model.

## Open
- Pet chat has no check list beyond `../testing/checks/pet.md`.
- Backlog: pet jobs, breeding, deeper memories of owners. Not before NPC chat is good.
