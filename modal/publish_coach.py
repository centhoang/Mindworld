"""Publish the tuned coach from the `llama-coach` Modal volume to Hugging Face (docs/FINETUNE.md step 7).

  gguf: <user>/Llama-3.2-{3B,1B}-PetMind-Coach-GGUF   (Q4_K_M, for llama-server / power mode)
  mlc:  <user>/Llama-3.2-1B-PetMind-Coach-q4f{32,16}_1-MLC (WebLLM in the browser; reuses the prebuilt
        Llama-3.2-1B q4f32_1 model library, so only the weights change; made by modal/convert_mlc.py into
        <run>/mlc on the volume, with mlc-ai's chat config and tokenizer files)

Repos are created private; making them public is the user's call. The token comes from the local .env
(HF_TOKEN, HF_USER) and is passed as a function argument, never written to disk or logged.
Run: modal run modal/publish_coach.py --what gguf|mlc|all [--tag village] (tag picks the stage 5 runs)
Llama 3.2 Community License: names start with "Llama", cards say "Built with Llama", license and use policy (repo folder licenses/) included.
"""

import pathlib

import modal

RUNS = {"": {"3B": "llama32-3b-e2-r16", "1B": "llama32-1b-e3-r16"}, "village": {"3B": "llama32-3b-village-e2-r16", "1B": "llama32-1b-n4-e3-r16"}}
NAME = {"": "PetMind-Coach", "village": "Mindworld"}  # repo names; the stage 5 model is coach + every village mind

image = modal.Image.debian_slim(python_version="3.12").uv_pip_install("huggingface_hub==0.35.3")
vol = modal.Volume.from_name("llama-coach")
app = modal.App("llama-coach-publish")

CARD = """---
license: llama3.2
base_model: meta-llama/Llama-3.2-{size}-Instruct
tags: [llama, llama-3.2, game, distillation, {fmt}]
---
# Llama-3.2-{size}-PetMind-Coach ({fmt})

**Built with Llama.** A LoRA fine-tune of Meta Llama 3.2 {size} Instruct (merged), the free local coach of the
game Pet Mind (Meta Global AI Developer Hackathon, Oct-Nov 2026).

It does two jobs with the game's exact prompts:
- **Teach:** turns a player's plain-language lesson ("guard when the brute winds up") into a memo: a few
  if-then rules in a small JSON DSL that the pet then follows. Distilled from Muse Spark Open: 2,480 lessons
  whose teacher memos were valid and did not lose on practice fights.
- **Voice:** picks the move and says a short in-character line ("guard: Shields up!").

Results on 100 held-out lessons, scored by 1,000 paired simulated fights each (win-rate lift vs an uncoached pet):
teacher Muse Spark Open +21.6 pts; tuned 3B +23.8 pts; tuned 1B +18.4 pts (JSON-schema decoding);
untuned 3B -3.0, untuned 1B +0.7. Use grammar / JSON-schema constrained decoding for Teach.

Format: {fmt_note}

Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright (c) Meta Platforms, Inc. All Rights Reserved.
See LICENSE.txt. Use is subject to the Acceptable Use Policy in USE_POLICY.md.
"""

VILLAGE_CARD = """---
license: llama3.2
base_model: meta-llama/Llama-3.2-{size}-Instruct
tags: [llama, llama-3.2, game, distillation, {fmt}]
---
# Llama-3.2-{size}-Mindworld ({fmt})

**Built with Llama.** A LoRA fine-tune of Meta Llama 3.2 {size} Instruct (merged): one small model that runs every
mind in the game Mindworld (Meta Global AI Developer Hackathon, Oct-Nov 2026), on the player's own machine.

Trained with the game's exact prompts, distilled from Muse Spark Open:
- **Coach (Teach):** a player's plain-language lesson -> a memo of if-then fight rules (2,480 lessons whose teacher
  memos were valid and did not lose on practice fights). **Voice:** move + a short in-character line (827).
- **Village minds (1,927):** day plans, activity choices, lines to villagers and pets, replies to players
  (grounded in what both can see), emotes and evening reflections, each kept only if it passed the game's own check.

Results (held-out, never trained on):
{results}

Format: {fmt_note}

Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright (c) Meta Platforms, Inc. All Rights Reserved.
See LICENSE.txt. Use is subject to the Acceptable Use Policy in USE_POLICY.md.
"""
VILLAGE_RESULTS = """- Village checks without grammar, 200 scenarios: tuned 1B 99.5% valid, tuned 3B 98.5% (stock 1B 48.5%,
  earlier coach-only 1B 82%).
- Teach, 100 lessons x 1,000 paired fights (mean win-rate lift vs an uncoached pet): tuned 1B +22.6 pts, 1 harmful;
  tuned 3B +21.5 pts, 2 harmful (teacher Muse Spark Open +21.6; coach-only 1B +18.4, 3B +23.8).
- Voice: 100% valid for both, lines 1-8 words."""


MLC_NOTE = """The results above were measured on the Q4_K_M GGUF. This 4-bit format differs. N4 weights in WebLLM (q4f32_1, GTX 1050, seed 4): 97.0% valid (plan, choose, line, emote, reflect, decide, deal all 100%; extract 32/37, reply 69/73), p50 1.9 s. Teach with grammar: 100% valid, +18.9 pts, 5 harmful, p50 10.8 s."""


def card(tag: str, size: str, fmt: str, note: str) -> str:
    if tag == "village":
        return VILLAGE_CARD.format(size=size, fmt=fmt, fmt_note=note, results=VILLAGE_RESULTS)
    return CARD.format(size=size, fmt=fmt, fmt_note=note)


def push(api, repo: str, folder: pathlib.Path, card: str, lic: dict):
    api.create_repo(repo, private=True, exist_ok=True, repo_type="model")
    (folder / "README.md").write_text(card)
    for name, text in lic.items():
        (folder / name).write_text(text)
    api.upload_folder(repo_id=repo, folder_path=str(folder), commit_message="Upload tuned Llama 3.2")


@app.function(image=image, volumes={"/out": vol}, timeout=3600)
def publish_gguf(size: str, user: str, token: str, lic: dict, tag: str = "") -> str:
    import shutil

    from huggingface_hub import HfApi

    src = pathlib.Path("/out") / RUNS[tag][size] / "model-Q4_K_M.gguf"
    folder = pathlib.Path("/tmp/gguf")
    folder.mkdir(exist_ok=True)
    shutil.copy(src, folder / f"Llama-3.2-{size}-{NAME[tag]}-Q4_K_M.gguf")
    repo = f"{user}/Llama-3.2-{size}-{NAME[tag]}-GGUF"
    note = "GGUF Q4_K_M (llama.cpp b11934). Serve with llama-server; the chat template is plain Llama 3 without the date header."
    push(HfApi(token=token), repo, folder, card(tag, size, "gguf", note), lic)
    return repo


@app.function(image=image, volumes={"/out": vol}, timeout=3600)
def publish_mlc(user: str, token: str, lic: dict, tag: str = "", quant: str = "q4f32_1") -> str:
    import shutil

    from huggingface_hub import HfApi

    folder = pathlib.Path("/tmp") / quant
    shutil.copytree(pathlib.Path("/out") / RUNS[tag]["1B"] / ("mlc-f16" if quant == "q4f16_1" else "mlc"), folder)
    repo = f"{user}/Llama-3.2-1B-{NAME[tag]}-{quant}-MLC"
    note = f"MLC {quant} weights for WebLLM. Use with the prebuilt Llama-3.2-1B-Instruct {quant} WebGPU model library (config and tokenizer from mlc-ai/Llama-3.2-1B-Instruct-{quant}-MLC). {MLC_NOTE}"
    push(HfApi(token=token), repo, folder, card(tag, "1B", "mlc", note), lic)
    return repo


@app.local_entrypoint()
def main(what: str = "all", tag: str = ""):
    env = {}
    for line in (pathlib.Path(__file__).resolve().parent.parent / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    user, token = env["HF_USER"], env["HF_TOKEN"]
    licenses = pathlib.Path(__file__).resolve().parent.parent / "licenses"
    lic = {"LICENSE.txt": (licenses / "LLAMA_3.2_LICENSE.txt").read_text(encoding="utf-8"), "USE_POLICY.md": (licenses / "LLAMA_3.2_USE_POLICY.md").read_text(encoding="utf-8")}
    calls = []
    if what in ("gguf", "all"):
        calls += [publish_gguf.spawn("3B", user, token, lic, tag), publish_gguf.spawn("1B", user, token, lic, tag)]
    if what in ("mlc", "all"):
        calls += [publish_mlc.spawn(user, token, lic, tag, q) for q in ("q4f32_1", "q4f16_1")]
    for c in calls:
        print("published", c.get())
