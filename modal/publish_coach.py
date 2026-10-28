"""Publish the tuned coach from the `llama-coach` Modal volume to Hugging Face (docs/FINETUNE.md step 7).

  gguf: <user>/Llama-3.2-{3B,1B}-PetMind-Coach-GGUF   (Q4_K_M, for llama-server / power mode)
  mlc:  <user>/Llama-3.2-1B-PetMind-Coach-q4f32_1-MLC (WebLLM in the browser; reuses the prebuilt
        Llama-3.2-1B q4f32_1 model library, so only the weights change: mlc-chat-config.json and tokenizer
        files are copied from mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC)

Repos are created private; making them public is the user's call. The token comes from the local .env
(HF_TOKEN, HF_USER) and is passed as a function argument, never written to disk or logged.
Run: modal run modal/publish_coach.py --what gguf|mlc|all
Llama 3.2 Community License: names start with "Llama", cards say "Built with Llama", license and use policy (repo folder licenses/) included.
"""

import pathlib

import modal

RUNS = {"3B": "llama32-3b-e2-r16", "1B": "llama32-1b-e3-r16"}
MLC_UPSTREAM = "mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC"

image = modal.Image.debian_slim(python_version="3.12").uv_pip_install("huggingface_hub==0.35.3")
mlc_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    # mlc.ai/wheels is a find-links page, not an index; its nightly CPU wheels are enough for convert_weight.
    .run_commands("pip install --pre -f https://mlc.ai/wheels mlc-llm-nightly-cpu mlc-ai-nightly-cpu psutil 'numpy<2'", "python -c 'import mlc_llm'")
    .uv_pip_install("huggingface_hub==0.35.3")
)
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


def push(api, repo: str, folder: pathlib.Path, card: str, lic: dict):
    api.create_repo(repo, private=True, exist_ok=True, repo_type="model")
    (folder / "README.md").write_text(card)
    for name, text in lic.items():
        (folder / name).write_text(text)
    api.upload_folder(repo_id=repo, folder_path=str(folder), commit_message="Upload tuned Pet Mind coach")


@app.function(image=image, volumes={"/out": vol}, timeout=3600)
def publish_gguf(size: str, user: str, token: str, lic: dict) -> str:
    import shutil

    from huggingface_hub import HfApi

    src = pathlib.Path("/out") / RUNS[size] / "model-Q4_K_M.gguf"
    folder = pathlib.Path("/tmp/gguf")
    folder.mkdir(exist_ok=True)
    shutil.copy(src, folder / f"Llama-3.2-{size}-PetMind-Coach-Q4_K_M.gguf")
    repo = f"{user}/Llama-3.2-{size}-PetMind-Coach-GGUF"
    note = "GGUF Q4_K_M (llama.cpp b11934). Serve with llama-server; the chat template is plain Llama 3 without the date header."
    push(HfApi(token=token), repo, folder, CARD.format(size=size, fmt="gguf", fmt_note=note), lic)
    return repo


@app.function(image=mlc_image, volumes={"/out": vol}, timeout=3600, cpu=8, memory=32768)
def publish_mlc(user: str, token: str, lic: dict) -> str:
    import shutil
    import subprocess

    from huggingface_hub import HfApi, snapshot_download

    merged = pathlib.Path("/out") / RUNS["1B"] / "merged"
    folder = pathlib.Path("/tmp/mlc")
    subprocess.run(["python", "-m", "mlc_llm", "convert_weight", str(merged), "--quantization", "q4f32_1", "--device", "cpu", "-o", str(folder)], check=True)
    # Same architecture and quantization as the prebuilt WebLLM library: take its config and tokenizer files as they are.
    up = pathlib.Path(snapshot_download(MLC_UPSTREAM, allow_patterns=["mlc-chat-config.json", "tokenizer*", "*.json"], ignore_patterns=["ndarray-cache*", "tensor-cache*", "params_shard*"]))
    for f in up.iterdir():
        if f.is_file() and not f.name.startswith(("ndarray-cache", "tensor-cache")) and f.name != "README.md":
            shutil.copy(f, folder / f.name)
    repo = f"{user}/Llama-3.2-1B-PetMind-Coach-q4f32_1-MLC"
    note = f"MLC q4f32_1 weights for WebLLM. Use with the prebuilt Llama-3.2-1B-Instruct q4f32_1 WebGPU model library (config from {MLC_UPSTREAM})."
    push(HfApi(token=token), repo, folder, CARD.format(size="1B", fmt="mlc", fmt_note=note), lic)
    return repo


@app.local_entrypoint()
def main(what: str = "all"):
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
        calls += [publish_gguf.spawn("3B", user, token, lic), publish_gguf.spawn("1B", user, token, lic)]
    if what in ("mlc", "all"):
        calls.append(publish_mlc.spawn(user, token, lic))
    for c in calls:
        print("published", c.get())
