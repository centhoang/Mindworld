# Pet Mind

A browser game built for the Meta Global AI Developer Hackathon (Oct 27 – Nov 4). It plays in any modern browser with no install.

**Play: https://pets.uryto.dev** (desktop Chrome or Edge recommended).

Teach a pet that thinks for itself. A small Meta Llama on your device decides every move; Meta's Muse models coach it between fights; every lesson is proven on fights the coach never saw.

## How to play
1. Press **Fight!** and watch your uncoached pet (log tags show who decided each move: `memo #n`, the model, or `instinct`).
2. Type a lesson, or press **Speak** and say it, then **Teach**. Example: "When the big one winds up a heavy hit, guard. Make friends with hurt enemies."
3. The **Proof** panel replays 1,000 paired fights on seeds the coach never saw and shows the win-rate change with a 95% confidence interval. **Watch a fight it now wins** replays one.
4. **Learn from my fights** asks the coach to review your recent fights. Try the boss, **The Reader**: it reads your pet's rules and counters the obvious ones.
5. **Share my pet as a ghost** lets other players fight your pet's rules; pick "Another player's ghost" to fight theirs.

## How it works
| Part | Model | Where |
|---|---|---|
| Teach (lesson → validated rule memo) | Muse Spark Open | Baseten, via our Worker |
| Learn from my fights (review + revised memo, kept only if it doesn't lose) | Muse Spark 1.3 | Meta Model API |
| Voice teaching | Muse Voice Transcribe | Meta Model API |
| Instinct (picks among moves the memo allows, speaks) | Llama 3.2 1B (WebLLM) / 3B (llama.cpp, power mode) / Muse Spark Open (Modal, cloud fallback) | your device / cloud |
| Free coach (Teach with no cloud call) | Llama 3.2 3B fine-tuned on Muse Spark Open's lessons | your device (power mode) |

The memo is a small closed rule language, so model output is validated before the pet uses it, and the evaluation runs the same rules directly over thousands of seeded fights (`client/src/sim/`). One Cloudflare Worker (`worker/`) serves the game and proxies every paid call with hard spend caps, rate limits and a geo-block. If any model is unavailable, the game falls back to the next layer and finally to plain rules. Details: `docs/PLAN.md`, `docs/SPIKES.md`, `docs/FINETUNE.md`.

## Run it locally
Needs Node 22+.
```bash
cd client && npm install && npm test && npm run build
cd ../worker && npm install && npm test
npm run dev:mock     # http://127.0.0.1:8787 serves the built game; no keys, canned model replies
```
With real models: copy `.env.example` to `.env`, fill in your keys, and run `npm run dev` in `worker/` instead. `npm run eval` in `client/` prints the paired-seed numbers offline. Deploy notes: `docs/DEPLOY.md`.

## Power mode (optional, local GPU)

Power mode lets the game use **Meta Llama 3.2 3B Instruct** running natively on your own PC (llama.cpp), which is faster and smarter than the in-browser model. Start the server, then press **Power mode** in the game and allow Chrome's prompt; after that the game finds `http://127.0.0.1:8080` by itself on every visit.

One command (Windows, PowerShell, from the repo folder):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\power-mode.ps1
```

The first run downloads a pinned llama.cpp build and the model (about 0.7 GB + 2 GB, checked by SHA-256) into `%LOCALAPPDATA%\PetMind`; later runs start immediately. Keep the window open while you play; Ctrl+C stops it.

- **Requirements**: Windows 10/11 x64, an NVIDIA GPU with about 3 GB free VRAM and a recent driver. No NVIDIA card? Use `-Backend vulkan` (AMD/Intel GPUs) or `-Backend cpu` (slow), and `-Model coach1b` for a smaller model (~0.8 GB).
- **Model**: by default the **Pet Mind coach**, a Llama 3.2 3B we fine-tuned on Muse Spark Open's coaching (Built with Llama; [model card](https://huggingface.co/kysupo/Llama-3.2-3B-PetMind-Coach-GGUF)). It lets Teach work for free, offline: tick "Free coach" in the game. `-Model 3b` / `1b` run the stock Llama 3.2 Instruct instead.
- **Privacy**: the model runs entirely on your machine and the server listens on 127.0.0.1 only. Nothing from power mode leaves your PC.
- **Browser prompt**: because the game page is served over https and talks to localhost, Chrome may ask to allow access to devices on your local network (Local Network Access). Allow it for the game's site, or power mode stays off and the game keeps using the in-browser model.
- Options: `-Port`, `-InstallDir`, `-SkipDownload` (use already-installed files), `-AllowOrigin <game origin>` to accept requests only from the game's site.

## Licenses
Built with Llama: Llama 3.2 is licensed under the Llama 3.2 Community License (`licenses/`). Muse models are used through their providers' APIs.
