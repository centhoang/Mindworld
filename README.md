# Mindworld

A cozy pixel village in the browser where **every pet and villager has a mind of its own**. Each one plans its day, picks
what to do next, chats, gestures and remembers, decided by a small Meta Llama model running on the players' own devices.
Players who are online together share one world. Each player has their own island ground, with playgrounds, picnic hills
and ponds between the grounds. The villagers' minds run on whichever player's machine has a model loaded, and they move
to another machine when that player leaves, keeping their memories. You can also teach your pet how to fight, in plain
words, and the game measures whether the lesson worked.

Built for the Meta Global AI Developer Hackathon, **Oct 27 – Nov 4, 2026**. Everything in this repository was written
during the event.

**Play: https://pets.uryto.dev** (desktop Chrome or Edge; WebGPU needed for the in-browser model). Until launch, the site is
behind an access gate.

## How to play
| Key | What it does |
|---|---|
| WASD / arrows | Walk. Your pet follows you. |
| E | Talk to a villager (Elder, Mo, Ama, Pip) or a wild pet; use beds, the market stall, your door |
| B | Load our tuned **Llama 3.2 1B** into this tab (WebGPU). Press B again for rules only |
| I | Open the Mind inspector next to a pet or villager: its plan, what it is doing, friends, memories, which model decides and where it runs |
| T | Teach your pet (a lesson in plain words becomes a few checked rules) |
| P | Your pets |
| 1-4 | Emotes when online (wave, heart, dance, laugh) |
| G / M / C | Goals panel / mute voices / CRT filter |

Things to try:
- Watch your pets at home: they eat, nap, play ball, poop (and villagers clean up), and invite each other to picnics.
- Walk to the square: villagers greet you by name and chat with each other and with your pet. Press E to ask them anything.
- Open a second window. Each player spawns on their own ground, the clock and day/night match in both windows, and an
  invitation sent in one window shows up in the other.
- Bump a wild pet to battle; press T to teach your pet, and the Proof panel replays paired fights the coach never saw.

## Meta models: where each one is used
| Model | Used for | Runs |
|---|---|---|
| **Llama 3.2 1B Instruct** (WebLLM, q4f32) | Every mind: plan, choose (only from the sim's valid choices, grammar-constrained), lines, emotes, end-of-day reflection; also the pet's fight voice | In the player's browser tab |
| **Muse Spark Open** | Villager chat when no player in the room has a model loaded; Teach (lesson to rule memo); teacher for fine-tuning the coach and the village data set | Cloud (Baseten / Modal), behind our capped Worker |
| **Muse Spark** (Meta Model API) | "Learn from my fights": reviews recent fights and proposes a revised memo | Cloud, behind our capped Worker |
| **Muse Voice Transcribe** | Teaching by voice | Cloud |
| **Llama 3.2 1B, fine-tuned** (LoRA, distilled from Muse Spark Open) | Free local coach, fight voice and village minds ([model card](https://huggingface.co/kysupo/Llama-3.2-3B-PetMind-Coach-GGUF)) | In the player's browser tab (WebLLM) |

Every decision has a fallback: local model, then the cloud model where it makes sense, then scripted rules. The inspector
shows which one actually decided (`MIND: ...`), so a scripted answer is never presented as a model's.

## How it works
- **Sim** (`client/src/life/`): a deterministic village sim: shared world clock, needs, 14 activities, relationships,
  group activities that wait for friends. It runs without any model.
- **Minds** (`client/src/mind/`): persona, memory and five small prompts (`brain.ts`). Each answer is checked against the
  allowed set before the sim uses it. One scheduler per machine queues the model calls with priorities, timeouts and a duty
  cap so the game keeps its frame rate.
- **World** (`client/src/world/`): seeded island grounds on a ring of slots, in-between grounds rolled per day, bridges, and
  seeded decor. Every client builds the same map from a few numbers, so no map data is sent.
- **Room** (`worker/src/`): one Cloudflare Worker serves the game and a Durable Object room per world. The room elects a
  host for each villager, preferring players with a local model. When the host leaves, the villager moves to another host
  within ~15 s and its memory goes with it (kept in Durable Object storage). Messages are validated and rate-limited.
- **Cost safety**: live play costs about $0, because the minds run on players' devices. Every cloud call goes through the
  Worker with per-player and per-day spend caps and cached replies. Offline data generation goes through a client that
  records every call in a ledger and stops before a hard USD cap or call limit. Tests mock all models.

More: `docs/V3-PLAN.md` (design), `docs/FINETUNE.md` (distillation), `docs/SPIKES.md` (measurements), `docs/STYLE.md` (art bible).

## Run it locally
Needs Node 22+.
```bash
cd client && npm install && npm test && npm run build
cd ../worker && npm install && npm test
npm run dev:mock     # http://127.0.0.1:8787 serves the built game; no keys, canned model replies
```
With real cloud models, copy `.env.example` to `.env` (gitignored), fill in your own keys, and run `npm run dev` in `worker/`.
The in-browser Llama needs no key. `npm run dev` in `client/` runs the Vite dev server.

## Credits and licenses
- **Built with Llama.** Llama 3.2 is licensed under the Llama 3.2 Community License; see `licenses/` (license and
  acceptable use policy). Muse models are used through their providers' APIs.
- Pixel art: our own style guide (`docs/STYLE.md`). The sprite sheets and tiles were made with OpenAI Codex image
  generation from that guide and reviewed against it; walk cycles, poses, recolours and effects are drawn in code.
- Libraries: WebLLM (MLC), llama.cpp, Cloudflare Workers, Vite, Vitest, TRL / PEFT on Modal for fine-tuning.
