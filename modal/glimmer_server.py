"""Muse Glimmer 30B (Meta open weights, Apache 2.0) on Modal: vLLM behind an OpenAI-compatible server.

Role in the game: the hosted "Instinct" chooser, so a stranger gets a real Meta open-weight model without
installing anything. The Worker calls it with a Modal proxy token (MODAL_PROXY_TOKEN) and falls back to the
deterministic memo rules when it is cold, slow or down.

Cost control: scale to zero (min containers 0), short scaledown window, one replica. Modal bills the GPU by
the second only while a container runs. Compute credits (no card on the workspace) are the hard stop.

Deploy: modal deploy modal/glimmer_server.py      Stop billing now: modal app stop glimmer-instinct
"""

import json
import os

import modal

MODEL_NAME = "meta-models/Muse-Glimmer-30B"
MODEL_REVISION = "cec94fcfd6512f2cfe708138c32533b346ea4f69"  # pinned so a repo update cannot change the model
SERVED_NAME = "glimmer"
# Modal refuses H200, H100, A100-80GB and L40S on a workspace without a payment method (checked 2026-10-28);
# with a card on file the H100 below is allowed. FP8 halves the bytes read per token (decode is memory-bound).
GPU = os.environ.get("GLIMMER_GPU", "H100")  # read at deploy time only
QUANT = "fp8"  # None = BF16 as released (~60 GB). "fp8" = vLLM quantizes the same weights on load (~30 GB).
MAX_MODEL_LEN = 16384  # the game prompts are a few thousand tokens at most
MINUTES = 60
PORT = 8000

image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.32.0")
    .env({"HF_XET_HIGH_PERFORMANCE": "1", "VLLM_LOG_STATS_INTERVAL": "10"})
)

hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)

app = modal.App("glimmer-instinct")


@app.server(
    image=image,
    gpu=GPU,
    scaledown_window=5 * MINUTES,
    startup_timeout=20 * MINUTES,  # first start downloads the weights into the volume
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
    port=PORT,
    routing_region="us-east",
    target_concurrency=16,
)
class Server:
    @modal.enter()
    def start(self):
        import subprocess

        cmd = [
            "vllm", "serve", MODEL_NAME,
            "--revision", MODEL_REVISION,
            "--served-model-name", SERVED_NAME,
            "--host", "0.0.0.0",
            "--port", str(PORT),
            "--max-model-len", str(MAX_MODEL_LEN),
            "--gpu-memory-utilization", "0.92",
            "--async-scheduling",
            "--limit-mm-per-prompt", json.dumps({"image": 0}),  # text only: skip the vision encoder
        ]
        if QUANT:
            cmd += ["--quantization", QUANT]
        print(*cmd)
        self.process = subprocess.Popen(cmd)

    @modal.exit()
    def stop(self):
        self.process.terminate()
