# Final plan: the user's input (2026-11-03)

The user woke and asked for a final plan, made in a new session in plan mode and executed there. This file holds
everything the user said for it, so no session has to recover it from chat. Bugs from the same message are in `docs/BUGS.md` (45-48).

## Target for the submission demo (user's words, lightly edited)
1. **Pet combat:** more exciting and more complex, with more adapted teaching, so fighting another trainer (NPC or player)
   is a real challenge. Today both the visuals and the combat actions feel too plain.
2. **Human activities:** add more, polish and check them all, so NPCs feel more complicated.
3. **Many players at once:** test to check the final output.
4. **Map polish:** based on `VisualAssetPack/BuiltDemo/`. Then the user tests again for issues.
5. **Then** plan the demo submission and prepare everything else needed to submit.
6. **AI split:** the local trained model for AI decisions that need to be more dynamic than strict logic can be.
   AI APIs for live chat and anything that needs to feel lively.
7. **Surprise the user**, aiming for the best prizes.

## Specific asks
- **Ball:** it rolls physically when any human touches it. Question from the user: is there a soccer activity yet?
  (Status: villagers walk to soccer and Pip waits there alone, `proof/game/sunny-live.md`; check what plays.)
- **Dance floor** where humans can dance (links to bug 37: dance is never chosen unforced).
- **Use every activity the asset pack supports** (search the pack, `VisualAssetPack/`, and BuiltDemo first).
- **Liveliness:** Muse Spark answers made the game feel more alive. Use all the services we have for liveliness:
  Baseten, Meta Model API, Modal, etc. (Credits in `HANDOFF.md`; money rules in `CLAUDE.md`.)
- **Docs:** no size limits any more. Sessions were losing context; write down anything a later session needs.

## Known facts for the planner
- Deadline: Nov 4, 9 PM ET = Nov 5, 9 AM Vietnam. Step 7 (turn `LOCAL_ONLY` off, remove `/api/chatlog`) runs last.
- Judged on Impact 30, Meta tooling 25, Demo 25, Technical depth 20 (`docs/ops/event.md`).
- Chat already goes to Muse Spark on live (per-client cap gone, $30/day cap, `worker/wrangler.toml`).
- Open bugs and the user's calls (34, 36): `docs/BUGS.md`.
