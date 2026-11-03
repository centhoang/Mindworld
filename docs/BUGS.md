# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual
34. **A speech box can cover the Goals panel.** A bubble of someone in the top left draws over it, on purpose today (`underBubbles`). Reads as an overlap. Shot: `proof/visual/sunny-bubble-over-goals.jpg`. User's call.

36. **The Brain panel names the model to a stranger.** User's call; the wording is unchanged.

### Fixed, waiting for review
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.
35: playground slide redrawn straight-on (`proof/visual/slide-live.jpg`).
38-41 (Sunnyside, live): 38 home roof cleaned of the demo's smoke, rocks, branch, chimney trail and dormer shadows; villager roofs lose the patched shingle tiles (`proof/visual/roof-38-live.png`, `roof-38-art.png`). 39 the pond carried a `rod` prop spot: removed, the rod shows only in Mo's hands (`pond-39-40-live.png`). 40 roads are the path grown by a full tile ring, kept off coast edges; the pond lane moved a row to meet the pier; a 1-tile coast spur and a stepped street end fixed (same shot, `village-look.test.ts`). 41 the village plots now get the pack's field with edges and a tilled mound per bed, beds moved inside the plot (`farm-41-live.png`).
30, 31: soccer goal redrawn straight-on, all 654 gen files audited, only the goal failed (`proof/visual/gen-art-audit.md`, `proof/visual/goal-live.png`).

## Hatch
- Fixed, waiting for review: 36, hatch line (the egg line and "hatched" stay up, the Brain line waits, `proof/game/sunny-hatch-line.jpg`).

## Movement
- Fixed, waiting for review: 25 (own character jumped back while holding a direction; `proof/game/walk-steady.md`).

## Game
37. **Dance not seen unforced on Sunnyside.** 16 min plus 12 min of watching on live: nobody started it. Pip twice waited alone for soccer, for 5 game hours at a time, while the others worked. Clean is player only. No clear defect found: `proof/game/sunny-live.md`.

## NPC
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
- Fixed, waiting for review: 42, 43 (per-client chat cap gone, day's USD cap stays; greetings and free talk answered by Muse Spark on live
  with the time and what the villager is doing; replay and the chat-log failures in `proof/npc/chatlog-2026-11-03.md`). 28 (hurt villagers stay cool in small talk until sorry, `proof/npc/5f-free-talk.md`). 29 (feed dropped, clean stays player-only). 24 (asking for goods is buying; "how much?" means that good, unit test only). 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet
- Fixed, waiting for review: 32 (head light is a crescent along the round head, `proof/pet/heads-round.png`, `proof/pet/head-live.png`). 33 (spots removed; old spots genes show plain).

## Network
None open. AOI is new work: `network/network.md`.
- Fixed, waiting for review: 27 (a static art file can 502 once after a deploy; `/art/tile-grass-snow-1.png` caught once, 200 since. Images and `sunny.json` now retry: unit test only, the blip did not recur).
