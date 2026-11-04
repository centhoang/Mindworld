# Mindworld

Mindworld is a free multiplayer pixel village in the browser where the villagers think for themselves, and the
players share the AI that runs them. A Llama 3.2 1B we fine-tuned runs in the players' own tabs; the room hands each
villager's mind to the fastest machines, and when a host leaves, the minds move on with their memories.

Elder, Mo, Ama and Pip decide what to do, remember your visits, make promises, trade, and hold grudges with reasons you
can ask about. Invite Pip to your birthday, keep the appointment or miss it, and see how that changes your next
conversation, and who else hears about it. Teach your pet in plain words, duel a villager's pet or another player, and
check whether the lesson helped. Players in the same room share the village, its clock, villagers and rolling ball live.

## Play

**[Play Mindworld](https://mindworld.uryto.dev)** — the site is behind an access gate until submission.

Use a modern browser. WebGPU is needed only to run the optional Llama model in your tab.
Without it, another player's machine can host the villagers; otherwise the capped cloud or rules run their minds.
Your pet can fight using its taught rules, and teaching has a scripted fallback.

## How to play

| Key | Action |
|---|---|
| WASD / arrows | Walk; move the cursor in menus. |
| Shift | Run while walking. |
| E / Enter | Use or talk to what is nearby: villagers, the stall, town board, beds, your door or another player. |
| T | Open Teach; Enter submits a lesson, Tab reviews recent fights, Escape closes it. |
| P | Pick the pet that follows you. |
| B | Turn this tab's local Llama brain on or off (WebGPU). |
| I | Inspect a nearby villager or pet's mind, memories and decisions. |
| N | Set your player name. |
| C | Open or close the postcard album. |
| 1–4 in the village | Wave, heart, dance, laugh while online. |
| 1–5 during a wild or villager fight | Queue a limited trainer shout: attack, guard, flee, emote, befriend. |
| Enter / Space / Z in battle | Choose a menu option or advance battle text. |
| Escape / X in menus | Back or close; in a battle menu, select its last option. |
| G / M | Show or hide goals / toggle character voices. |

On touch screens, use the left stick to walk; push it to the rim to run. The right buttons are E (use/talk),
X (back) and T (Teach). Tap battle choices and the on-screen chips; chat and teaching use text inputs.

Things to try:

1. Tell Pip: "My birthday party is this evening at the dance floor, come?" A promise can change the villager's plans;
   turn up, or miss it and talk again afterward.
2. Ask "why are you mad?" after upsetting a villager. Say "sorry" and inspect how the relationship changes.
3. Read prices at the town board. With a carrot in your basket, try "sell you a carrot for 20 coins" and answer the
   offer. Villagers can refuse; completed trades move the price board.
4. Ask Mo "wanna duel?" while awake and off work. After a loss, read the reason; when the coach offers a lesson,
   choose **Teach it**, submit it, and read **Proof**. T then Tab also asks for a review of recent wild fights.
5. Read the **Village Gazette** on the town board: headlines come from the villagers' notes and market prices,
   using yesterday or the latest day somebody actually lived.
6. Visit the campfire in the evening and wait with the villagers for a story drawn from their memories.
7. Win a fight or befriend a wild pet, then open C to browse postcards. A story can also earn one; images are
   optional cloud extras, and the album stays on this device.
8. Open a second window with `?p=2` for a separate save, set a different name with N, and meet in the village.
   Walk into the shared ball to kick it; press 3 by the dance floor and nearby villagers can join you.

## What is special

- **A browser link, no game installation.** Local inference runs in the tab when the device supports WebGPU.
- **A shared village per room.** Up to 100 players join a room; full rooms send new arrivals to spill rooms.
  Area of interest (AOI) limits nearby updates instead of sending every moving thing to everyone.
- **Players share inference.** Each villager has an elected host. Ranking uses measured local tokens per second
  and how many villagers the machine already hosts.
- **Hosting moves with the people.** Leaving or backgrounding a tab lets another player take over with the
  relayed memories, promises and bonds.
- **WebGPU is optional for play.** Other hosts, capped cloud calls and rules cover weaker devices.
  With cloud providers disabled, local models and free rules keep the game playable.

The [mission and goal check](docs/game/mission.md) separate the working game from the longer-term vision.

## Meta models

The local model is **Llama 3.2 1B Instruct, fine-tuned with LoRA**, distilled from Muse Spark Open.
All Worker calls below also pass through the shared spend ledger described under "How it works."

| Model | What it does | Where it runs | Cap / fallback |
|---|---|---|---|
| Tuned Llama 3.2 1B | Villager and pet plans, choices, lines, emotes and reflection | Browser, WebLLM / WebGPU; elected hosts run villagers | One queued model per tab; validated rules and scripted lines on failure. |
| Tuned Llama 3.2 1B | Pet fight choices and short fight lines when a memo rule does not apply | Browser, WebLLM | Allowed moves checked; rule-based instinct on failure. |
| Tuned Llama 3.2 1B | Free Teach and fight-review coach when the cloud coach is unavailable | Browser, WebLLM, when loaded | Memo schema and validation; scripted coach next. |
| Muse Spark Open | Mind decisions when no local model is available (`/api/llm`, dialogue) | Baseten, through Worker | Shared ledger caps; rules and scripted lines. |
| Muse Spark Open | Villager and wild-pet free talk (`/api/chat`), including with local Llama loaded | Baseten, through Worker | Chat quota, cached openers, scripted replies. |
| Muse Spark Open | Pet-to-pet talk at home (`/api/petchat`) without local Llama | Baseten, through Worker | Shared chat quota; cached or scripted pairs. |
| Muse Spark Open | Teach: words into a checked fight memo (`/api/llm`, teach) | Baseten, through Worker | Shared ledger caps; loaded local coach, then scripted coach. |
| Muse Spark Open | A rival's proposed counter-plan (`/api/rival`) | Baseten, through Worker | $1/UTC day, quota and cache; bundled plans. The sim rehearses candidates. |
| Muse Spark Open | A watching villager's reaction to a fight (`/api/cheer`) | Baseten, through Worker | $1/UTC day and quota; villager's scripted lines. |
| Muse Spark Open | Villager banter and evening campfire stories (`/api/banter`) | Baseten, through Worker | $1/UTC day, quota, nearby listeners and 40-second spacing; local/scripted talk or rules stories. |
| Muse Spark Open | Scheduled updates to wild-pet tactics, learned from shared winning memos | Baseten, Worker cron | $0.30/UTC day, at most four calls daily; previous or bundled tactics. |
| Muse Spark Open | Optional fight choices with `?cloudmoves` and a configured Modal server | Modal, through Worker | Shared ledger caps and timeout; memo/rule-based instinct. |
| Muse Spark Open | Teacher data for the coach and village fine-tunes | Modal, offline training tools | USD/call limits and recorded calls; invalid training rows rejected. |
| Muse Spark 1.3 | Review recent fights and propose a revised memo (`/api/llm`, memo; T then Tab) | Meta Model API, through Worker | Shared ledger caps; local/scripted coach. Revisions must pass practice fights. |
| Muse Spark 1.3 | Village Gazette (`/api/gazette`) | Meta Model API; Baseten Muse Spark Open if Meta is unconfigured | $1/UTC day and quota; room/day cache, then headlines from rules. |
| Muse Image 1.0 | Postcards from pet genes and the people present, painted from frames of the game itself as reference pictures so a card looks like the village (`/api/postcard`; text-only if references are refused) | Meta Model API, through Worker | $2/UTC day and quota; no new card on failure. |
| Muse Voice Transcribe 1.0 | Speak a lesson in Teach (`/api/transcribe`) | Meta Model API, through Worker | Shared ledger caps, server clip limit 30 seconds; type the lesson instead. |

Browser weights: [q4f16_1](https://huggingface.co/kysupo/Llama-3.2-1B-Mindworld-q4f16_1-MLC) /
[q4f32_1](https://huggingface.co/kysupo/Llama-3.2-1B-Mindworld-q4f32_1-MLC), private until submission.
See [models and training](docs/ai/models.md) and the [model-card generator](modal/publish_coach.py).

Browser audit (Oct 31, 2026): **97.0% valid decisions across 300 held-out cases**, N4 weights, WebLLM q4f32_1,
GTX 1050, seed 4. In that audit, grammar-constrained Teach averaged **+18.9 percentage points** in held-out
win rate over 100 lessons, each scored on 1,000 paired fights; five lessons hurt win rate.

The updated [combat bench](docs/ai/pet.md) reports **+29.0 points** for a specific three-rule memo:
guard heavy hits, befriend a hurt foe, emote at a guarding foe. It compares against an untaught pet on
200 held-out seeds per foe across five wild foes. This measures the memo under the newer fight rules.

## How it works

- **Sim:** TypeScript battle and village rules own what is true: needs, jobs, relationships, promises, trades,
  blocks, counters and charge. Teach builds a small validated memo; Prove compares it on paired unseen fight seeds.
- **Minds:** the sim reasons about what is possible; the model picks among valid options. Local decisions use
  grammar-constrained output where supported, then parsing and validation. A scheduler queues calls with priorities,
  timeouts and a duty cap. Direct factual answers come from state; free talk and Teach currently try the cloud first.
- **World:** a plain canvas client draws one compact, hand-authored village with houses, small farms, a square,
  pond, wild pets, dance floor and campfire. There are 12 player plots, then guest yards.
- **Room:** a Cloudflare Worker serves the client and APIs; each WebSocket room has a Durable Object.
  It elects villager hosts, relays state, stores relayed mind logs and the last ball kick, and handles spill rooms.
- **AOI:** 16-tile cells, a 3×3 view, position batching and fewer far updates in a crowd.
  Joins, hosting and some shared events still go to the whole room.
- **Cost safety:** current defaults in [worker/wrangler.toml](worker/wrangler.toml) cap cloud use at **$30/day**
  overall, **$2/day per client** and **120 calls/minute per client**, plus provider total limits and feature quotas.
  Client limits use a hashed IP. The ledger reserves the worst-case charge before a paid call; local models,
  rules and scripted replies provide free gameplay fallbacks. Optional images can simply be absent.

Read the [design](docs/game/design.md), [implementation](docs/game/implementation.md),
[villager minds](docs/ai/npc.md), [pet rules, Teach and Prove](docs/ai/pet.md), and [network design](docs/network/network.md).

## Run it locally

Install Node.js and npm. From the repository root:

~~~bash
npm --prefix client install
npm --prefix worker install
npm --prefix client run build
npm --prefix worker run dev:mock
~~~

Open http://127.0.0.1:8787. Mock mode needs no API keys and uses canned cloud replies.
If the optional model download is unavailable, choose **Skip for now**; gameplay has rule fallbacks.
For client-only development, use `npm --prefix client run dev` (Vite).
Tests: `npm --prefix client test` and `npm --prefix worker test`.
For cloud configuration, see [.env.example](.env.example); `npm --prefix worker run dev` is the non-mock command.

## Honest limits / next

The larger-model local-server tier cannot yet offer inference to the room; local-server tooling serves the coach
and benches. The connected, spread-out island world is also a future goal: today's compact village gives AOI less to save.
With nobody online, villagers stop living through events even though the shared clock advances.
Local 1B free talk can drift or repeat. Play without a GPU still needs a real-device check. On a host with no
local model, the cloud stand-in for villager decisions (`/api/llm` dialogue) usually runs out of tokens while
Muse Spark reasons, so those decisions fall to rules; talking to villagers still uses Muse Spark (`/api/chat`).
Some everyday notes used by the Gazette are only in the host tab and can be lost on reload or handover.
Albums stay on the device; campfire cards currently arrive only on the storyteller's host machine.
See the [goal check](docs/game/mission.md) and [NPC notes](docs/ai/npc.md).

## Credits and licenses

- **Built with Llama.** [Llama 3.2 Community License](licenses/LLAMA_3.2_LICENSE.txt) and
  [Acceptable Use Policy](licenses/LLAMA_3.2_USE_POLICY.md).
- **Sunnyside World** asset pack: the repository's [art provenance](docs/visual/style.md) records permission for
  free and commercial use, modification and style study. Codex-made pets, houses, interiors and battle art fill
  gaps in the pack's style.
- Libraries and tools: WebLLM (`@mlc-ai/web-llm`), TypeScript, Vite, Vitest, tsx and Wrangler.
  See the [client](client/package.json) and [worker](worker/package.json) packages.

Everything in this repository was written during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026.
