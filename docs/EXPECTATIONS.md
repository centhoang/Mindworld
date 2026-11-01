# What the user expects before a play-test

Do not ask for a play-test until every line holds on the deployed build with 2+ players. Add new expectations here as the user states them.

## Look
- Matches `VisualAssetPack/BuiltDemo`. Everything in the demo is in the pack: search the tileset and Room1 before saying something is missing.
- Pack art is 1:1. One ground square fits one tree or one farm spot. No scaling.
- Natural layout: organic clusters and paths, no grid rows. Sand beaches, windmills with towers, dense decor.
- Water everywhere moves like the ocean, with clean edges.
- Farm looks like the demo: dirt field, hexagon plots, real growth stages for every crop.
- Entering a house looks like `Interior.gif`: the roof lifts in place on the same house.
- Even pixels at any display scale.

## Humans
- Every human activity works in both logic and visuals, for villagers and players.
- Actions match the world: no fishing without water, no walking on fences, water or off corners.

## NPC chat
- A player cannot tell NPCs from humans.
- Replies continue the conversation: a yes to an offer acts on that offer, and nothing is asked twice.
- Questions about the world get true answers.
- The local model does the talking. If the tuned 1B cannot, try a bigger trained model (3B).
- Before any play-test, run docs/NPC-CHAT-TESTS.md and read the replies. After any user play-test, read the recorded chat without being asked.

## Network
- What needs syncing is synced between players. Delay is acceptable.

## Open from the last review
Every entry in docs/BUGS.md counts as a blocker.
