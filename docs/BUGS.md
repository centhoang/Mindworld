# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual
Found in user play-test #1 (2026-11-04, live worker 14537484). The user plays once more at the end, when all is done.
54. **Campfire flames sit off the stone ring** (up and left of it). `.scratch/bugs/53-54-campfire-fishing.png`.
    Likely: `pixel/pixel-view.ts` ~208 draws `spr_deco_fire_01_strip4` at `cx + dx - 2`, a left edge, not centred on the ring.
55. **Inside the small house: the table at the top right is cut off, and a dark window tile stands on the floor** between
    the shelf and the table. `.scratch/bugs/55-interior-table-window.png`. Codex art (`client/public/art/gen/home-small-open.png`):
    a rework brief (window on the back wall's inner face, every piece whole), then `python scripts/art-home-small.py`,
    and check `game/house.ts` FLOORS/BUILT_IN still match.
58. **Battle layout: each HP panel sits right against a pet**, which reads oddly. The user leaves the redesign to Claude
    ("re-design the layout to your liking"; Codex only makes art, never layout). `.scratch/bugs/57-59-battle-layout-res.png`.
59. **Battle pixel sizes do not match**: the background, the player, my pet and the foe are drawn at different pixel
    scales. Keep one: **the player's pixel size is the baseline** (user). Rework the battle background and the pet art at
    that scale; ask Codex specifically for the art (user). `.scratch/bugs/57-59-battle-layout-res.png`.

### Fixed, waiting for review
46 (P4, deployed 2026-11-04, worker 3a555c50): every plot has the same small house (Codex art in pack style, roof recoloured into the pack's five colours by slot, `scripts/art-home-small.py`) with a small room inside; the old home wing is gone (`game/house.ts`, `interior.ts`, `village-map.ts plotHouse`). Seen in the dev pane; not yet on live by the user.
34 (user chose "bubble moves aside", 2026-11-03): a bubble that would cover the Goals card steps just below it (`layoutBubbles` keep-out, `bubbles.test.ts`). Not yet seen on live.
36 (user chose "keep, friendlier"): the Brain lines say plain words first, model after: "The village now thinks on your own computer (Llama 3.2 1B, tuned)" (`pixel/main.ts` `switchBrain`).
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.
35: playground slide redrawn straight-on (`proof/visual/slide-live.jpg`).
44 (old character art): every person went through one draw that fell back to the old 16 x 24 sprites while a strip loaded, and for good once a load failed (no retry, bug 27 blips). Now all strips load up front, a failed file is asked for again, and a missing strip shows the same look's idle strip or nothing; the old fallbacks are gone (`humans.test.ts`, live day watch: `proof/visual/old-sprite-44.md`).
38-41 (Sunnyside, live): 38 home roof cleaned of the demo's smoke, rocks, branch, chimney trail and dormer shadows, and its lower roof relaid in even rows of the pack's blue shingle; villager roofs lose the patched shingle tiles (`proof/visual/roof-38-live.png`, `roof-38-art.png`). 39 the pond carried a `rod` prop spot: removed, the rod shows only in Mo's hands (`pond-39-40-live.png`). The first proof had the player on water: the shot script had put him there; walking cannot (`village-walk.test.ts`). 40 roads are the path grown by a full tile ring, kept off coast edges; the pond lane moved a row to meet the pier; a 1-tile coast spur and a stepped street end fixed (same shot, `village-look.test.ts`). 41 the village plots now get the pack's field with edges and a tilled mound per bed, beds moved inside the plot (`farm-41-live.png`).
45: bench, slide and food bowl removed (village-map spots, bowl no longer drawn). P2: pets now eat at home, not at the old bowl spot. Not yet seen on live by the user.
30, 31: soccer goal redrawn straight-on, all 654 gen files audited, only the goal failed (`proof/visual/gen-art-audit.md`, `proof/visual/goal-live.png`).

## Hatch
- Fixed, waiting for review: 36, hatch line (the egg line and "hatched" stay up, the Brain line waits, `proof/game/sunny-hatch-line.jpg`).

## Movement
- Fixed, waiting for review: 47 (leaving the house put you on a blocked tile: the door column sits on the farm plot's edge; now the nearest open spot, `village-walk.test.ts`). 25 (own character jumped back while holding a direction; `proof/game/walk-steady.md`).

## Game
- Fixed, waiting for review: 37 (dance never started, Pip waited alone for soccer). Dance and soccer are open now: one may start, others join; dance has its own floor and an evening party pull; a dancing player pulls villagers (headless watch: dance 30, soccer 7 in 8 game days, `proof/game/activities.md` P2). Not yet seen in a live watch.
- Fixed (found in P2): map rocks drew nothing yet blocked the way (their "rock-small" picture was never loaded); they use the pack's rock stamp now.

## NPC
53. **Villagers "sitting by the campfire" are drawn fishing** (rod and line, no water near). The campfire pose `warm` in
    `pixel/humans.ts` (line ~45) plays `waiting`, which is the pack's fishing-wait strip. `.scratch/bugs/53-54-campfire-fishing.png`.
60. **"what you guys up to?" at the campfire, at night, got the rules line "Not much. Enjoying the day."** (chat log
    09:36 VN): `mind/directions.ts doingAnswer` falls back when the label is missing, and says "day" at any hour.
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
- Fixed, waiting for review: 42, 43 (per-client chat cap gone, day's USD cap stays; greetings and free talk answered by Muse Spark on live
  with the time and what the villager is doing; replay and the chat-log failures in `proof/npc/chatlog-2026-11-03.md`). 28 (hurt villagers stay cool in small talk until sorry, `proof/npc/5f-free-talk.md`). 29 (feed dropped, clean stays player-only). 24 (asking for goods is buying; "how much?" means that good, unit test only). 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet
56. **Pet parts hard to read as pixel art**: two blue lines under the eyes look like tears (the blue ear dots and the blue
    tail read fine). Re-check every pet part, every build, for anything unclear at pet size. `.scratch/bugs/56-pet-blue-lines.png`.
57. **Battle: nothing says what keys 1-5 do** while a shout is open. Show the five moves next to their keys (or on the
    command panel) whenever the player can shout. `.scratch/bugs/57-59-battle-layout-res.png`.
- Fixed, waiting for review: 48 (a wild pet pressed into a wall or tree kept pushing at an unreachable target; now it re-picks a reachable one after 0.8 s, and one inside a wall goes home; 120 s sim: none still). 32 (head light is a crescent along the round head, `proof/pet/heads-round.png`, `proof/pet/head-live.png`). 33 (spots removed; old spots genes show plain).

## Network
Found by the P3 join check (`scripts/join-check.mjs`, live `check` room, run 1, 2026-11-04 00:25 VN; `proof/network/join-live.md`):
49. **A refresh lost its plot to a newcomer.** With all 12 plots held, a player who refreshed while someone new joined in those
    seconds came back a guest, and the newcomer had their plot. Fix: a ground left under 60 s ago (`REFRESH_HOLD_MS`) is kept for
    its owner (`room.ts` `takeSlot`, unit test). Waiting for join-check run 2.
50. **A late joiner did not see a nearby farm** unless its owner's tab resent it (a background tab never does). Fix: the welcome
    brings the farms in view (`room.ts` `join`, unit test). Proven fixed on live (join-check run 2); remove after review.
51. **Villagers stood still for everyone while their host fought, sat indoors or had the tab in the background** (found with
    real tabs in the `check` room: a mid-duel tab was handed Mo on someone's join). The game does not step the village in
    battle or home mode, and a background tab is throttled. Fix: the cap heartbeat carries `bg` (hidden, fighting or indoors),
    sent at once on a change; the room hosts villagers on a visible, free player when there is one (`npc.ts` `elect`, unit
    test; `room-flow.ts` beat). Also: a view that throttles frames without saying it is hidden now steps the world too.
    Proven on live: two tabs dueling, all four villagers moved to the third player at once and kept walking.
52. **Phone-size window: the Goals card and the bottom line ran off the right edge, the map was off-screen** (375 x 812:
    the scale came from the height alone, 125 art columns). Fix: the scale also keeps at least 360 columns
    (`pixel/low-size.ts`, unit test). Not a bug but a gap: no touch controls, so a phone can join and watch but not walk.
- Fixed, waiting for review: 27 (a static art file can 502 once after a deploy; `/art/tile-grass-snow-1.png` caught once, 200 since. Images and `sunny.json` now retry: unit test only, the blip did not recur).
