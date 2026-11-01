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

## NPC chat
11. **Free talk is weak on the 1B.** With no sim answer, replies drift: Mo offers a fishing rod to "I caught a big fish", "what's your job?" got nonsense, Pip brings up soup again. Runs: `.scratch/chat-runs/`. Needs the 3B decision.
12. **Reply invents odd offers.** Recorded: Ama said "want to join me for a picnic but nobody showed?". A memory leaked into an invitation.

## Second review (2026-11-01): all blockers
13. **Farm (img1, reference img7).** A plain dirt ground with no decor on it. Plant slots sit right next to each other in rows, with rows a human can walk between. Today: a flower on the dirt, a notched corner, slots spaced apart.
14. **Grid (img2).** Everything sits on the tile grid. Undo the off-centre tree jitter. Keep organic clumps as a shape, on whole tiles (bug 5 asked for no rows, this asks for no free placement).
15. **Cut-off tiles (img3, img4).** img3: where cliff, beach and bridge meet. img4: the house bottom and its corners are cut, with leftover pieces (stools, bush) from the picture at the mask edge.
16. **Fenced roads (img5).** Straight dirt roads have fences on both sides.
17. **Bridge stands (img6).** Horizontal bridges have a shadow and posts below them. TILE-RULES: posts 5.37 were never drawn.
18. **World edge (img8).** A hard line where the sea stops and grey sky starts. Also E: FISH shows at a coast corner on cliff.
19. **Road bulge (img9).** The verge bulges break the road tiles: slanted corners and a stray notch. My change, tile rule error. Remove or redo with valid shapes.
20. **Layering (img10).** Player and pet draw wrongly against house walls: head over or under the wrong part.
21. **Pond pier (img11).** Cliff extrudes in the middle of the pond where the pier joins. Draw the cliff normally and lay the bridge on top. Remove the land step under it.
22. **Clouds under land (img8, img11).** All clouds fly above the islands. Remove low clouds over sea and under land.
23. **No layer rule.** Write `docs/LAYERS.md` first: the fixed draw order from Room1 (TILE-RULES has the layer list), what sorts by feet, what is always on top. Then hold every fix above to it.
