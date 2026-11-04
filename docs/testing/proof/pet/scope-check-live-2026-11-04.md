# Pet scope on live, 2026-11-04 (~22:00 VN)

Live build `main-czFxq799` at mindworld.uryto.dev, test Chrome (room `check`, player Brave Pip, pet Mochi),
local model loaded ("Llama 3.2 1B, tuned by us"). Driver scripts: `.scratch/chk7/{teach2,teach3,fight,bored,yes,rematch}.js`.

## Teach with no setup (line 13)
- Lesson "guard when it winds up a heavy hit, then counter": memo changed in 4.1 s.
- "when the foe is low, use the big move to finish it": 3.4 s. Same lesson again: "did not get a new rule" (correct).
- "when my pet is hurt below 30, guard": 4.9 s, "Memo updated by the Muse Spark (Open Weights)", Prove +1.3 pts
  (87% > 88%, 1000 new fights). Shot: `teach-live.png`.
- Note: Muse Spark also changed an old rule (attack -> befriend when the foe is below 40%). Valid, not asked for.

## Signature move on screen (line 14)
- Wild Turtle, memo "guard, then attack after a guard" (set for this fight only, the taught memo put back after):
  "Mochi blocks it! Leaf Whirl is charged!", then "Mochi unleashes LEAF WHIRL!" with the glint on the foe and the
  charge bar. Shot: `signature-live.png`. Also seen unforced in both duels with Ama below.

## Villager pet looks the same (line 19)
- Ama's Honey in the village (tan, long ears with green stripes, green tail tip) and on the battle screen:
  `villager-pet-same-live.png` (left: village at 3x, right: battle).

## Bored villager asks, "yes" starts the duel (line 20)
- Forced only the timing: Ama's fun need set to 20, the player placed beside her, her greet gap cleared. Her own pick:
  greetings 1-8 were nothing, a hello, or "dance this evening?"; the 9th: "Brave Pip, want to duel? Honey is itching
  for a match. Say yes if you're in." (`bored-challenge-live.png`). Chat "yes": battle open in 3.1 s, "Ama sends out
  Honey!" (`challenge-yes-duel-live.png`).

## Tip after a loss, taught, next duel (line 21)
- Duel 1 (taught memo): Mochi hit into Honey's guard and was countered; lost. Tip: "Teach your pet to wait (emote)
  while the foe guards, not hit into its guard."
- Taught it (3.9 s, rule "emote when the foe is guarding", `teach-tip-live.png`). Duel 2 ("wanna duel again?"):
  Mochi danced while Honey guarded, blocked two heavy hits, unleashed Leaf Whirl, then befriended: "Ama's Honey and
  Mochi are friends now! +2 coins." One duel each; the rate is the bench's (62-70%).

## Clean win, coach quiet (line 23)
- Three wins (Skitter befriended, Pal, Brute): no "Coach:" line and no "Teach it / Done" prompt after any of them;
  the only choice box shown was the fight menu.
- Two losses to a wild Turtle with a test memo also had no coach lesson (no lesson wins 2 more of 32 practice fights:
  `sim/review.ts` returns null). Correct by the rule, noted.
