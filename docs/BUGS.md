# Open bugs, by scope

Every bug the user reports goes here, with its image in `.scratch/bugs/`. Remove when proven fixed. Fixed lines wait for the user's review.

## Visual
34. **A speech box can cover the Goals panel.** A bubble of someone in the top left draws over it, on purpose today (`underBubbles`). Reads as an overlap. Shot: `proof/visual/sunny-bubble-over-goals.jpg`. User's call.

36. **Brain panel replaces the hatch line.** On a new save "Something is wiggling inside your egg" is gone after about 1 s. The panel also names the model to a stranger.

### Fixed, waiting for review
1-9, 13-23: ground tiles, pond edge, windmill, house entry, placement, farm art, beaches, fishing rules, coast corners, grid, cut-off tiles, road fences, bridge posts, world edge, road bulge, layering, pond pier, clouds, layer rule. Detail: git history of this file.
35: playground slide redrawn straight-on (`proof/visual/slide-live.jpg`).
30, 31: soccer goal redrawn straight-on, all 654 gen files audited, only the goal failed (`proof/visual/gen-art-audit.md`, `proof/visual/goal-live.png`).

## Movement
- Fixed, waiting for review: 25 (own character jumped back while holding a direction; `proof/game/walk-steady.md`).

## Game
37. **Dance, chop and clean not seen unforced on Sunnyside.** 200 s sample only; forced shots proved no pose. Needs a longer live watch.

## NPC
11. **Free talk is weak on the 1B.** Cloud free talk now fixes this during the event (`proof/npc/5a-transcript.md`). Local fallback alone is still weak.
- Fixed, waiting for review: 28 (hurt villagers stay cool in small talk until sorry, `proof/npc/5f-free-talk.md`). 29 (feed dropped, clean stays player-only). 24 (asking for goods is buying; "how much?" means that good, unit test only). 12 (memory cut off invitations, unit test only). 10. Conversation continues: yes, no, later and "where?" act on offers.

## Pet
- Fixed, waiting for review: 32 (head light is a crescent along the round head, `proof/pet/heads-round.png`, `proof/pet/head-live.png`). 33 (spots removed; old spots genes show plain).

## Network
None open. AOI is new work: `network/network.md`.
- Fixed, waiting for review: 27 (a static art file can 502 once after a deploy; `/art/tile-grass-snow-1.png` caught once, 200 since. Images and `sunny.json` now retry: unit test only, the blip did not recur).
