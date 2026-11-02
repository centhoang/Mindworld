# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual
30. **Soccer goal is drawn at an angle.** The pack is top-down, front side only; `art/gen/soccer-goal.png` is iso. Send back to Codex. No screenshot on disk (user's image, 2026-11-03).
31. **Audit all Codex art for the angle.** Every file in `client/public/art/gen/`: anything not top-down goes back for rework.

### Fixed, waiting for review
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.

## Movement
- Fixed, waiting for review: 25 (own character jumped back while holding a direction; `proof/game/walk-steady.md`).

## NPC
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
- Fixed, waiting for review: 28 (hurt villagers stay cool in small talk until sorry, `proof/npc/5f-free-talk.md`). 29 (feed dropped, clean stays player-only). 24 (asking for goods is buying; "how much?" means that good, unit test only). 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet
32. **Head shade cuts straight across.** The light patch on a pet's head has square edges; it must follow the round head. Pet art goes back to Codex (`art/gen/pets`, shading also in `pixel/monster.ts`).
33. **Dots on pets read as a bug.** The small coloured marks on the body, seen front and back, are the `spots` pattern. Too small to read in pixel art: remove the part, or make it clearly a pattern.

## Network
None open. AOI is new work: `network/network.md`.
- Fixed, waiting for review: 27 (a static art file can 502 once after a deploy; `/art/tile-grass-snow-1.png` caught once, 200 since. Images and `sunny.json` now retry: unit test only, the blip did not recur).
