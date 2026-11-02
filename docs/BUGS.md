# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual: fixed, waiting for review (pixel build, may be dropped by the look decision)
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.

## Movement
26. **Half-second stalls in the test Chrome.** The picture freezes about 500 ms, 2-4 times per 10 s of walking, sometimes 3 s, with no long task. Old view too; an empty page has none. Cause unknown, may be this rig.
- Fixed, waiting for review: 25 (own character jumped back while holding a direction; `proof/game/walk-steady.md`).

## NPC
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
- Fixed, waiting for review: 24 (asking for goods is buying; "how much?" means that good, unit test only). 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet

## Network
27. **Two 502s with two tabs.** One tab logged two 502 responses during the two-tab check; URL not caught, a solo tab had none. Play seemed fine. `proof/network/5c5d-live.md`.
