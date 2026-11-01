# Testing

**Goal:** you review one aspect at a time, on live, without playing the whole game.

## Scopes
| Scope | Lab | What runs | What is faked |
|---|---|---|---|
| Visual | `/lab/visual` | Drawing | Game state: a fixed scene set, no model, no room |
| NPC | `/lab/npc` | Minds, chat, real model | World: a tiny stage, no room |
| Pet | `/lab/pet` | Teach, Prove, pet mind | World, room |
| Network | `/lab/net` | Room, sync, bots | Drawing is dots, no model |
| Game | `/` | Everything wired | Nothing |

Labs are thin pages on the same deployed build, behind Access. Each starts only its scope through the shared interfaces. The full game is the same parts wired together.

## Review loop
1. Claude tests a scope against its checklist and adds proof.
2. Claude publishes the lab (`scope-publish` skill).
3. You read `docs/testing/checks/<scope>.md`, open the lab, and judge any item.
4. You mark it: pass, fail or add a new line. Failures go to `docs/BUGS.md`.
5. Claude fixes and repeats. Clear lines stay done until that scope changes.

## Checklist format
```
- [x] What you should see, in plain words. (proof: link)
- [ ] Not yet.
- [!] Failed: short reason, bug number.
```
- Lines are outcomes that matter to you, not code. About 10 per scope.
- Claude marks `[x]` only after checking on the deployed build.
- Visual lines carry an image or video. Chat lines carry the transcript.
- Proof goes to `docs/testing/proof/<scope>/`, kept small, and is replaced each run.

## Rules
- Unit tests stay beside the code. A lab is for what only a person can judge.
- A scope may import shared interfaces only, never another scope.
- Full game play-test only when every scope's list is clear.
- Mock the LLM in tests. The NPC lab uses the real model.
