# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual: fixed, waiting for review (pixel build, may be dropped by the look decision)
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.

## NPC
11. **Free talk is weak on the 1B.** With no sim answer, replies drift: Mo offers a fishing rod to "I caught a big fish", "what's your job?" got nonsense, Pip brings up soup again. Runs: `.scratch/chat-runs/`. Open: `ai/npc.md` options.
12. **Reply invents odd offers.** Ama said "want to join me for a picnic but nobody showed?". A memory leaked into an invitation.
- Fixed, waiting for review: 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet
None open.

## Network
None open. AOI is new work: `network/network.md`.
