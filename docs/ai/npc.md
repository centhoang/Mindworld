# NPC minds and chat

**Goal:** a player cannot tell a villager from a human. **Bet:** the sim reasons; the model decides and speaks.

## Villagers
Elder (herbs), Mo (fishing), Ama (market stall), Pip (wood). Each has a persona, a job with hours, a wallet, a farm plot and a long goal. Any of them can skip a shift or refuse a deal, with a reason.

## How a mind works
- **Sim first:** most ticks need no model. Questions with one true answer come from the sim (`directions.ts`, `offers.ts`, `scene.ts`).
- **Model tasks:** plan, choose, line, emote, reflect, extract, decide, deal. Short prompts, a few valid options, output checked by the game.
- **Memory:** a rolling log, facts, promises, and bonds (fondness, trust, respect), each tied to a memory.
- **Promises:** invitation -> extract -> decide -> calendar -> plan bends -> kept or broken -> consequences and gossip.
- **Hosting:** minds run in a player's tab. The room elects a host per villager and hands over on leave.

## Chat today
- Offers work: yes, no, later and "where?" all act on the offer.
- True answers work.
- **Free talk on the 1B is weak** (bug 11): it drifts, and repeats topics.
- `cleanReply` strips bond notes and repeat invitations.
- Prompts are frozen at af455c4: a text change needs a retrain.

## Speed on the GTX 1050 (2026-11-02, same test)
| | 1B stock | 3B stock |
|---|---|---|
| Download / VRAM | ~0.9 GB / ~0.9 GB | 1.82 GB / 2.95 GB |
| Decode | 7.2 tok/s | 2.7 tok/s |
| Prefill | 60-70 tok/s | 20-32 tok/s |
| 48 tokens out, 330 tokens in | 11.7 s | 29.9 s |

The 3B is ~2.7x slower. The tuned 3B is trained (`llama32-3b-n4-e2-r16`, on the Modal volume, GGUF ready) but its reply quality has not been benched.

## Options for chat (user decides)
| | Idea | Good | Bad |
|---|---|---|---|
| **A (recommended)** | Tiers: sim answers first, then 1B or a cloud Meta model for free talk during the event, with a cap | Fast, best talk for judges, strong Meta tooling story | Free talk gets weaker when the cap ends |
| B | Tuned 3B only on GPUs that pass a speed probe; 1B otherwise | Free forever, better talk if the bench proves it | Slow on weak GPUs; two weight sets to host |
| C | 3B everywhere | One model | 30 s replies on a 1050, 2.95 GB VRAM shuts out many players |
| D | Better 1B: shorter prompts, 15-20 word replies, intent routing to line banks | Cheapest, helps all options | Won't fix open-ended talk alone |

Whichever wins, do D. A short reply (20 tokens, 150 in) takes ~6 s on the 1B and ~14 s on the 3B. A "typing..." bubble makes that feel like a person.

**Next step:** bench the tuned 3B against the tuned 1B on `../testing/checks/npc.md`, using native GGUF so it costs nothing. Decide from reply quality.

Rule to settle: the game must still work free after the event. A cloud tier is fine under that rule only if turning it off leaves the game playable.

Design backlog and research sources: `archive/NPC-PLAN.md`.
