# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual: fixed, waiting for review (pixel build, may be dropped by the look decision)
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.

## Movement
- Fixed, waiting for review: 25 (own character jumped back while holding a direction; `proof/game/walk-steady.md`).

## NPC
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
28. **Small talk stays warm after insults.** Mo at fondness -12 still chats happily; only the direct questions turn cold. Needs prompt text, so not tonight. `proof/npc/5e-rude-gossip.md`.
- Fixed, waiting for review: 24 (asking for goods is buying; "how much?" means that good, unit test only). 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet

## Network
None open. AOI is new work: `network/network.md`.
- Fixed, waiting for review: 27 (a static art file can 502 once after a deploy; `/art/tile-grass-snow-1.png` caught once, 200 since. Images and `sunny.json` now retry: unit test only, the blip did not recur).
