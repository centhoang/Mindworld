# Mission, goal check, and how we differ from Atelico

## The mission (user, 2026-11-04, their words)
"Our game project is special (or the future/goal suppose to be special) about (that currently not any project has
made it): browser based game that anyone can join and play (using AOI technique), running and sharing the local AI
model inference power across players (going offline will transfer the hosting to another, making the game "live" to
the very last person) - with even more powerful AI through local server inference hosting (bigger model that Web
can't handle), so that anyone can play for free at anytime - even without the cloud AI APIs. Our mission is to make it
come true, and here we are!"

**What this doc is for (user, 2026-11-04):** understanding the mission, for the submission's vision and the future
after the event. It adds no task before the deadline: build only what the plan already has.

## The original world idea (user, 2026-11-04; not the current build)
- Each player who connects spawns their own island, joined to the rest. In the middle, the game spawns themed islands
  of its own: wild terrain, events, the villagers' house grounds, and so on.
- The point is spread: players and places far enough apart that each player's area of interest holds only a little
  of the world. Spawning everything close together, or all easy to reach, throws away most of what AOI saves.
- Today's build ("fresh look" rework) is one compact village: 12 plots along its streets plus a guest yard, everything
  near everything. The AOI grid works there but saves less. The older island code is still in `world/layout.ts`
  (platforms joined by bridges between grid neighbours).

## Sharing the thinking (user, 2026-11-04)
- Balance the minds across all the strong machines in the room, not one machine for everything.
- Built: the room scores each player as tokens/s divided by (1 + villagers it already hosts)
  (`worker/src/npc.ts` `hostScore`), so two strong machines split the villagers and a much faster one takes more.
  With 4 villagers, a room with one fast machine still gives it all four.

## Goal check (2026-11-04, build `main-p-yOsRi0`): what is true today
| Part of the goal | State | Where |
|---|---|---|
| Browser game, anyone joins from a link, no setup | Built | `client/`, served by the Worker at pets.uryto.dev (behind Access until submission) |
| AOI: each player gets only what is near | Built | `worker/src/aoi.ts` (16-tile cells, a 3x3 view, newest position only, far ones every other tick past 16); `docs/network/network.md` |
| Many players | Built, with a flaky check | 100 per room, then a spill room; join check 20/20 before, 16-20/20 today (`HANDOFF.md`) |
| Local inference in the tab | Built | Llama 3.2 1B, fine-tuned (distilled from Muse Spark Open), WebLLM on WebGPU; 97.0% valid decisions on a GTX 1050 (`docs/ai/models.md`) |
| Sharing inference across players | Built | The room picks each villager's host by measured local tokens/s, spread over the strong machines (`hostScore` above); the host runs that mind for everyone, others replay its choices and lines |
| A world spread out so AOI pays off | Not in this build | The original island idea above; today's village is compact |
| Going offline hands the hosting on | Built | Leave or background tab: another player hosts; memories, promises, bonds travel with the room (`proof/network/5c5d-live.md`) |
| "Live to the very last person" | Partly | True while anyone is online. With nobody online the village pauses: the clock moves on, but nobody lived those hours (the Gazette falls back to the latest lived day) |
| Bigger models on a local server, hosting for the room | Not yet | llama.cpp `llama-server` and the published GGUFs serve only the pet coach (`sim/cortex.ts`) and the benches. No tab reports a local-server model as its host power, so a strong home PC cannot yet think for the whole village |
| Free at any time without cloud APIs | Built | Every mind falls back: local model, then rules and scripted lines (`CLOUD_LIVELY` off still plays). Cloud extras are capped per day |

The gaps to close after the event (vision, not deadline work): the island world above, and a tab that talks to a local `llama-server` (a bigger GGUF) and offers it as
host power, so the room's existing host ranking picks it. The ranking, hand-over and memory relay already exist.

## Compared to Atelico (from three of their posts, read 2026-11-04)
Sources: "Cloud AI for video games is dead on arrival", "Gamescom 2025 recap", "Introducing ARC: a fair contract for
artists" (atelico.studio/blog). Only what those posts say; their other pages may say more.

**What Atelico says and builds.** Cloud AI does not work for games: the cost grows with every interaction (they say a
game with about 1,000 daily players could go broke), rate limits silence NPCs mid-game, and safety filters block
villains. Their answer is the Atelico AI Engine: on-device inference as a toolkit for Unreal, Unity and Godot, with
small models tuned for games, said to be five orders of magnitude cheaper than the cloud. Their demo GARP runs a
village of 20+ agents that plan, remember, talk and organise (a birthday party) in real time on one RTX 3090. ARC is
a draft contract for artists: training only with explicit consent, payment up front plus a share of success, rights
limited to one project. Their posts do not mention multiplayer, the browser, sharing compute between players, or what
happens when a player goes offline.

**Where Mindworld stands out**
1. **The browser, zero install.** A stranger opens a link and the villagers think in that tab (WebGPU). Atelico ships an
   engine for native games; its showcase needs an RTX 3090.
2. **One shared, multiplayer world, with AOI.** Everyone is in the same village, up to 100 a room, then spill rooms.
3. **Inference shared across players.** The strong machines in the room think for the villagers for everyone; the
   room spreads the minds over them by measured speed. On Atelico's model each device runs its own AI.
4. **The village survives players leaving.** Hosting moves to the next player with the minds' memories intact.
5. **Any hardware can play.** A phone or a PC with no GPU is meant to play fully: another player's machine, the capped
   cloud, or the rules think for it (not yet proven on a machine with no GPU: `checks/game.md`). An on-device-only
   engine needs the device to run the model.
6. **Local first, cloud as a capped extra, not dead on arrival.** We agree on cost: every cloud call has a daily USD
   cap, a quota and a free fallback, and the game is free with the cloud off. But we use Meta's cloud where it adds
   something a 1B cannot: richer villager talk and campfire stories, the Gazette, painted postcards.
7. **The sim decides what is true.** The model picks only among the sim's valid options (grammar-constrained), so a
   villager cannot promise what the world forbids. Atelico's posts describe modular agent components, not this rule.
8. **Open Meta weights, published.** The tuned 1B ships as MLC (browser) and GGUF (native), distilled from Muse Spark.

**Where Atelico is ahead, or we only match**
- Scale per machine: 20+ agents on one GPU vs our 4 villagers plus pets on a 1B in a tab.
- A product for other studios (three engines); Mindworld is one game, not a toolkit.
- The local-server tier (bigger models at home) is in our goal, not in our build yet.
- Art ethics: ARC is a contract framework. Our art is a licensed pixel pack, Codex fills gaps in the pack's style, and
  Muse Image paints only runtime keepsakes from game state; we train nothing on artists' work. We have no artist
  contract of our own.

**For the demo and the submission text** (never in public posts before submission: `CLAUDE.md`): lead with points
1-5. They are the combination nobody else claims (browser + shared multiplayer inference + hand-over + free). Say
plainly what comes next: the local-server tier and the island world.
