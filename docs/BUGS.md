# Open bugs

Every bug the user reports goes here in the same turn, with its screenshot saved to `.scratch/bugs/` (gitignored). Remove an entry once it is fixed and proven on the deployed build with 2 players. A "Lead" is a guess until checked.

Fixes for all 10 reported bugs are deployed and checked by Claude with 2 players (2026-11-01). They stay listed until the user's next play-test accepts them.

## Fixed, not yet accepted
Images for the second review: `.scratch/bugs/2026-11-01b-imgN.png`. Where a new entry below covers one of these, the new entry wins.
1. **Ground tile size.** Nothing scaled: the pack's fill 3.1 is an 8 px checker. Fill is now flat 1.1/1.2, one square per tile.
2. **Pond edge broken.** Ponds are notched rectangles; the "bridge stub" was the dock, now a 3-wide pier with rails.
3. **Windmill invisible.** The strip is the wheel only. Added `mill-tower`; mills keep off the yard's house.
4. **House entry.** The player's house is the demo house indoors and out; the roof lifts in place over the live world. Other players' grounds still show their own stamps.
5. **Unnatural placement.** Trees sit off-centre in uneven blobs; road verges bulge. Roads still run along the axes.
6. **Farm art.** Stage 5 was the harvested item; stages are now 1-4. Light dirt under beds and fields. Beds moved south-east of the house.
7. **Sand beaches.** South coast runs of 6+ show cliff, sand, edge 5.20. Decoration only: not walkable.
8. **Fishing with no water.** `waterSide` now needs open water, not a cell under cliff or foam; reach is 2 tiles.
9. **Standing off the coast.** Outer corner tiles block their sea side (`cornerBlocks`).
10. **Conversation does not continue.** Offers are tracked whoever voiced them (mind/offers.ts). Yes, no, later and "where?" all act on them on the real model.
13. **Farm.** Plain dirt block; flowers cleared; road cells count, so no notch.
14. **Grid.** Tree jitter removed; clumps keep their outline on whole tiles.
15. **Cut-off tiles.** Beaches are a row deeper and end on 5.19, so foam joins the corners. Home picture: bush, stools and pots planked over.
16. **Fenced roads.** Straight roads have fences on both sides, both directions.
17. **Bridge stands.** Shadow and braced posts under east-west bridges.
18. **World edge.** The sea runs on past the map. No E: FISH from a south coast edge or corner.
19. **Road bulge.** Bulges removed.
20. **Layering.** Houses sort per stretch of wall by their own foot (`footRuns`).
21. **Pond pier.** A pier no longer shortens the cliff.
22. **Clouds under land.** Low clouds removed. All clouds are high.
23. **No layer rule.** `docs/LAYERS.md`.

## NPC chat
11. **Free talk is weak on the 1B.** With no sim answer, replies drift: Mo offers a fishing rod to "I caught a big fish", "what's your job?" got nonsense, Pip brings up soup again. Runs: `.scratch/chat-runs/`. Needs the 3B decision.
12. **Reply invents odd offers.** Recorded: Ama said "want to join me for a picnic but nobody showed?". A memory leaked into an invitation.
