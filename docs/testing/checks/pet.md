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
- [x] The light on a pet's head follows the round head: no square edges, on every build, front and back. [close-up](../proof/pet/heads-round.png)
- [x] No small marks on a pet's body, front or back. Old pets that had spots still load and show plain. [unit tests](../../../client/src/game/genes.test.ts)
