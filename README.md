# Pet Mind

A browser game built for the Meta Global AI Developer Hackathon (Oct 27 – Nov 4). It plays in any modern browser with no install.

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
