# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual: fixed, waiting for review (pixel build, may be dropped by the look decision)
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.

## NPC
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
24. **Asking Ama about goods misses.** "Do you sell fish?" got "Bring it to me in person", then "how much?" got "Nothing right now". The buy path reads her question as the player selling.
- Fixed, waiting for review: 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet
None open.

## Network
None open. AOI is new work: `network/network.md`.
