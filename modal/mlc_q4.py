"""MLC q4f32_1 weights for Llama 3.2 1B in plain NumPy (no TVM), so WebLLM's prebuilt q4f32_1 library can run our tuned 1B.

The mlc_llm wheels would not install or load (four nightly failures earlier, then the pinned 0.20 release clashing with
apache-tvm-ffi), and the format is small: the layout below was read from mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC's
tensor-cache.json, and `modal/convert_mlc.py --check` proves it by converting Meta's stock 1B and comparing it with
mlc-ai's published weights (same layout; about 0.1-0.3% of 4-bit values one rounding step off, scales within 1 ulp).

Layout (group quantization, symmetric, 4 bits, group 32, uint32 storage):
- every linear W [out, in] -> q_weight uint32 [out, in/8] (element j of a word in bits 4j..4j+3) + q_scale [out, in/32]
- q = clip(round(w / scale) + 7, 0, 14), scale = max|w| over the group / 7
- q/k/v fused into qkv_proj, gate/up into gate_up_proj (along out); tied embeddings, so no lm_head
- q4f32_1: float tensors (scales, norms) are float32, stored as bf16 ("f32-to-bf16", round to nearest even)
- q4f16_1: the same, computed and stored in float16 (for GPUs with shader-f16: faster, and lighter on integrated GPUs)
"""

import hashlib
import json
import pathlib

import numpy as np

GROUP = 32
MAX_INT = 7
SHARD_BYTES = 32 * 1024 * 1024


def quantize(w: np.ndarray, ft=np.float32) -> tuple[np.ndarray, np.ndarray]:
    w = w.astype(ft)
    out, n = w.shape
    g = w.reshape(out, n // GROUP, GROUP)
    scale = (np.abs(g).max(axis=2) / ft(MAX_INT)).astype(ft)
    safe = np.where(scale == 0, ft(1), scale)
    q = np.clip(np.round(g / safe[:, :, None]) + MAX_INT, 0, 2 * MAX_INT).astype(np.uint32)
    q = q.reshape(out, n // 8, 8)
    packed = np.zeros((out, n // 8), dtype=np.uint32)
    for j in range(8):
        packed |= q[:, :, j] << np.uint32(4 * j)
    return packed, scale


def to_bf16(x: np.ndarray) -> np.ndarray:
    u = np.ascontiguousarray(x, dtype=np.float32).view(np.uint32)
    return ((u + np.uint32(0x7FFF) + ((u >> np.uint32(16)) & np.uint32(1))) >> np.uint32(16)).astype(np.uint16)


def mlc_params(get, layers: int, ft=np.float32):
    """Yields (name, array) in MLC naming; `get(hf_name)` returns a float array; ft = float32 (q4f32_1) or float16 (q4f16_1)."""
    def q(name: str, w: np.ndarray):
        packed, scale = quantize(w, ft)
        yield f"{name}.q_weight", packed
        yield f"{name}.q_scale", scale

    yield from q("model.embed_tokens", get("model.embed_tokens.weight"))
    for i in range(layers):
        p = f"model.layers.{i}"
        a = f"{p}.self_attn"
        yield from q(f"{a}.qkv_proj", np.concatenate([get(f"{a}.q_proj.weight"), get(f"{a}.k_proj.weight"), get(f"{a}.v_proj.weight")]))
        yield from q(f"{a}.o_proj", get(f"{a}.o_proj.weight"))
        m = f"{p}.mlp"
        yield from q(f"{m}.gate_up_proj", np.concatenate([get(f"{m}.gate_proj.weight"), get(f"{m}.up_proj.weight")]))
        yield from q(f"{m}.down_proj", get(f"{m}.down_proj.weight"))
        yield f"{p}.input_layernorm.weight", get(f"{p}.input_layernorm.weight").astype(ft)
        yield f"{p}.post_attention_layernorm.weight", get(f"{p}.post_attention_layernorm.weight").astype(ft)
    yield "model.norm.weight", get("model.norm.weight").astype(ft)


def encode(arr: np.ndarray) -> tuple[bytes, str]:
    if arr.dtype == np.float32:
        return to_bf16(arr).tobytes(), "float32"
    if arr.dtype == np.float16:
        return np.ascontiguousarray(arr).tobytes(), "float16"
    return np.ascontiguousarray(arr).tobytes(), str(arr.dtype)


def write(params, out: pathlib.Path) -> dict:
    """Writes params_shard_*.bin + tensor-cache.json (and ndarray-cache.json, the older name) like mlc_llm does."""
    out.mkdir(parents=True, exist_ok=True)
    records, shard, offset, total, count = [], [], 0, 0, 0

    def flush():
        nonlocal shard, offset
        if not shard:
            return
        path = f"params_shard_{len(records)}.bin"
        data = b"".join(b for _, b in shard)
        (out / path).write_bytes(data)
        records.append({"dataPath": path, "format": "raw-shard", "nbytes": len(data), "records": [r for r, _ in shard], "md5sum": hashlib.md5(data).hexdigest()})
        shard, offset = [], 0

    for name, arr in params:
        data, dtype = encode(arr)
        if shard and offset + len(data) > SHARD_BYTES:
            flush()
        shard.append(({"name": name, "shape": list(arr.shape), "dtype": dtype, "format": "f32-to-bf16", "nbytes": len(data), "byteOffset": offset}, data))
        offset += len(data)
        total += len(data)
        count += 1
    flush()
    meta = {"ParamSize": count, "ParamBytes": float(total), "BitsPerParam": 0.0}
    cache = json.dumps({"metadata": meta, "records": records})
    for name in ("tensor-cache.json", "ndarray-cache.json"):
        (out / name).write_text(cache)
    return meta


def read(folder: pathlib.Path) -> dict[str, bytes]:
    cache = json.loads((folder / "tensor-cache.json").read_text())
    out = {}
    for rec in cache["records"]:
        blob = (folder / rec["dataPath"]).read_bytes()
        for p in rec["records"]:
            out[p["name"]] = (p["shape"], p["dtype"], blob[p["byteOffset"] : p["byteOffset"] + p["nbytes"]])
    return out
