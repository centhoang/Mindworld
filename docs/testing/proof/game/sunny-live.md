# Sunnyside on the deployed build (2026-11-03, main-CF1BQK8c)

Test Chrome on pets.uryto.dev, drivers `.scratch/chk/scope1-7.mjs`, `game2.mjs`, `acts2.mjs`. Teleports, the shortened grow wait and an in-tab clock shift touch only test tabs.

## Screens
- Night and evening differ and stay readable: `../visual/sunny-night-square.jpg`, `sunny-night-home.jpg`, `sunny-evening.jpg`.
- Door: E at the door, the view closes and opens, wipe 0 to 0.97 and back in 29 frames. Inside `../visual/sunny-inside.jpg`. Holding down walks out, 3 tiles below the door.
- Chat box under the world, typed text shows, Pip's bubble above: `../visual/sunny-chatbox.jpg`.
- Sorting: behind a tree `../visual/sunny-behind-tree.jpg`, in front `sunny-front-of-tree.jpg`.
- Farm stages side by side: `../visual/sunny-farm-stages.jpg`.
- Window sizes at 125% Windows scale: 800x600 canvas 1000x750, 1366x768 canvas 1708x960, 1537x865 canvas 1922x1082. Canvas = device pixels.
- Chips Goals, Map, Names, Hints hide and show (`state.hide` flips both ways). Sunnyside has no Grid chip.

## Walking in the first hold after a teleport
Teleported in from far away, key held at once, 0.9 s, about 53 frames each.
- 6 runs: first step on frame 1 in five, no step back, no jump. Four walked about 1.5 tiles. Two started against something solid and stayed put, also with no step back.
- The camera catches up in big steps for 4-7 frames after a teleport. Only tests teleport.

## Farm, fish, sell, buy, duel (two tabs, peers 1)
- Clock gap under 0.9 game s. Dry land no fishing; shore fish 0 > 1.
- Wheat planted, watered, stage 1 to 3, harvested. Night: the stall says closed, nothing sold, correct.
- Noon, same save: wheat sold, coins 0 > 3; seed bought, coins 3 > 2, seeds 2 > 3 (`sunny-market.jpg`).
- Peer menu, duel, accept, battle, back to the village: `sunny-duel.jpg`. No page errors; only the favicon 404.

## Villagers unforced, over a full game day
Build main-Dp6B-Vqo, Friday 21:00 to Sunday 15:00. Samples every 3 s for 16 min, then about 12 min more.
- Seen doing: sell, fish (`sunny-fish.jpg`), tend, farm, cook, sleep, wander, chop.
- Chop: Pip, Sunday noon, unforced, axe pose in `sunny-chop.jpg`. No chop in the first 16 min: Pip's noon was skipped or lost that day. The shift can skip by design (`jobs.ts`, playful); which one it was here was not read.
- Dance: never started. Pip twice waited alone for soccer, about 5 game hours on Sunday morning. The others were at work.
- Clean is player only, not a failure.

## Hatch and follow
Fresh save, cold cache: first frame 1.9 s, egg already showing, 4 s hatch in view, pet out. Build main-Dp6B-Vqo: the "wiggling" line stays to the end of the hatch, then "Your egg hatched", then the Brain line (`sunny-hatch-line.jpg`).
Pet gap after a walk 1.13 tiles.

## Redeploy
Slide fix, main-C8-Yp4Aq, version 47fbb9e8: slide straight-on on live (`../visual/slide-live.jpg`), no page errors. Other sections ran on main-CF1BQK8c.

## "Want a picnic?"
Real chat on live, Pip: "nope, not picnic time! I'm busy chopping wood! Wanna challenge me to a game?" 14 s. Offers no picnic.
No `/api/chat` call was seen in that tab, so the answer did not come from the cloud. The cap (UTC day) was not tested; it resets 00:00 UTC, 7 AM in Vietnam.
