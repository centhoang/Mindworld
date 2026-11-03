# Pet checks

Lab: `/lab/pet`. It reads your save and never writes it. Proof so far: `proof/pet/5d.md`. Teach and Prove lines were not re-run on Sunnyside: `LOCAL_ONLY` has no coach until step 7.

- [x] Hatching feels like a small moment, and each pet differs. [proof](../proof/pet/hatch-mood.md) [Sunnyside](../proof/game/sunny-live.md)
- [x] The pet follows you without getting stuck. [proof](../proof/pet/hatch-mood.md) [Sunnyside](../proof/game/sunny-live.md)
- [x] It shows mood through what it does. [proof](../proof/pet/hatch-mood.md)
- [x] A lesson in plain words becomes rules you can read. [proof](../proof/pet/teach-tuned.md)
- [x] A bad lesson is refused with a clear reason. [proof](../proof/pet/teach-refused.png)
- [x] A lesson that adds no rule says so, and the memo stays. [proof](../proof/pet/teach-unchanged.png)
- [x] Prove shows a real change, for or against. [proof](../proof/pet/teach-tuned.md)
- [x] A taught pet fights differently from before. [proof](../proof/pet/teach-tuned.md)
- [ ] Teach works with no setup, and doesn't stall. Took 12-30 s per lesson on a GTX 1050. Waits for step 7: with `LOCAL_ONLY` on and no model it says "No coach answered" ([live](../proof/pet/5d-live-no-coach.jpg)).
- [ ] A fight feels tense: blocks, counters, crits and a charged signature move show on screen, with damage numbers. (lines on live: [combat-live](../proof/pet/combat-live.md); a screenshot of pips, numbers and a signature still owed)
- [x] The trainer can shout a move twice per wild fight (keys 1-5); the memo plays the rest. [combat-live](../proof/pet/combat-live.md)
- [x] A village rival (Elder, Mo, Ama, later Pip) accepts or refuses a duel, adapts its tactics to your memo, and says why it beat you. [rivals-live](../proof/pet/rivals-live.md)
- [ ] A villager's pet looks the same in the village and on the battle screen. (code shares the genes; not yet seen on live: the pane was hidden)
- [ ] A bored villager walks up and challenges you, and "yes" starts the duel. (unit tests only)
- [ ] The tip after a loss, taught, wins the next duel more often. (bench: the three lessons win 62-70% against every adapted rival; the coach review now picks a lesson rehearsed against that rival, e.g. Mo 0% -> 28%)
- [x] After a fight, the coach suggests one lesson in plain words; "Teach it" types it into Teach and teaching it raises Prove. [coach-review-live](../proof/pet/coach-review-live.md)
- [ ] After a clean win the coach stays quiet (no lesson, no extra key press). (unit tests only)
- [x] The light on a pet's head follows the round head: no square edges, on every build, front and back. [close-up](../proof/pet/heads-round.png)
- [x] No small marks on a pet's body, front or back. Old pets that had spots still load and show plain. [unit tests](../../../client/src/game/genes.test.ts)
- [x] On a new save the egg line stays readable through the hatch; the Brain line waits. [live](../proof/game/sunny-hatch-line.jpg)
