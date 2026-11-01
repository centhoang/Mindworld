# Open bugs

Every bug the user reports goes here in the same turn, with its screenshot saved to `.scratch/bugs/` (gitignored). Remove an entry once it is fixed and proven on the deployed build with 2 players. A "Lead" is a guess until checked.

## World and look
1. **Ground tile size.** One square of ground should fit one tree or one farm spot. Today one thing covers 4 squares. The pack is all 1:1, so ask why anything scales. Compare tile, tree and crop sizes with `Sunnyside_World_ExampleScene.png`.
2. **Pond edge broken.** `.scratch/bugs/2026-11-01-img2.png`: gaps in the foam line where the channel meets the cliff; the bridge stub stands in the water. Started with the pond-as-coast change.
3. **Windmill invisible.** `img3.png`: only blades show, behind a house. Lead: no tower is drawn, or the stamp is placed behind the house. Windmills must keep clear of houses.
4. **House entry is wrong.** `img4.png` (house) goes to `img5.png` (a different scene and building). It must look like `VisualAssetPack/BuiltDemo/Interior.gif`: the roof lifts in place on that same house, with the same surroundings.
5. **Unnatural placement.** `img6.png`: trees sit in grid rows, paths are straight lines. Match the demo's organic clusters and paths.
6. **Farm art wrong.** `img8.png`: a ripe crop turns into a yellow leaf on the ground. All plants and farm ground must look like `img10.png`: a dirt field with hexagon plots and each crop's real growth stages.
7. **Sand beaches missing.** `img7.png` shows sand and sand-edge tiles in the tileset. Everything in the demo is in the pack. The earlier "no clean sand tiles" claim was wrong.

## Collision
8. **Fishing with no water.** `img1.png`: the player fishes at a cliff. Lead: `waterSide` reads `T.water` cells that the cliff face covers. Check the terrain layer too.
9. **Standing off the coast.** `img9.png`: the player stands on water past a diagonal corner tile. Corner tiles need a collision shape.

## NPC chat
10. **Conversation does not continue.** The NPC asks to dance or play soccer, the user says yes, and it asks about the activity again. Lead: an invite spoken as a free model line registers no pending offer, so "yes" goes back to the model (`pitch`/`tookUp` in mind/npcs.ts handle only sim invites). Tests: docs/NPC-CHAT-TESTS.md.
