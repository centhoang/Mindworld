# Full game checks

Run on `/` only when every other list is clear. Two or more players, deployed build.

- [ ] A stranger plays with no setup and knows what to do in a minute. (needs a person)
- [ ] The birthday promise works from start to end. (not driven: takes in-game days with a mind deciding; needs a long run)
- [x] Farm, fish, sell and buy make one loop. (proof: ../proof/game/2-players.md; grow wait cut by the driver)
- [ ] Teach, then Prove, then a duel with a friend. (duel proven: ../proof/game/2-players.md. Teach waits for step 7: no coach under `LOCAL_ONLY`)
- [ ] Every human activity works for players and villagers. (fish, plant, water, harvest proven; the full list not driven)
- [x] No fishing without water, no walking through solid things. (proof: ../proof/game/2-players.md)
- [x] Holding one direction, walking or running, your character moves smoothly and never jumps back. (proof: ../proof/game/walk-steady.md)
- [x] Two players in the village see the same day. (proof: ../proof/game/2-players.md)
- [ ] Runs with no GPU: rules and cached lines, and it says so. (waits for step 7: `LOCAL_ONLY` shows no scripted lines; `?gpu=skip` works in dev only, so live needs a machine with no GPU)
