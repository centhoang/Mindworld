# Deploy notes (user does these; Claude prepared the config)

One Cloudflare Worker (`worker/`) serves the built client (`client/dist`) and the API, so the geo-block covers every request.

## Local
```
cd client && npm install && npm run build      # client/dist
cd ../worker && npm install
npm run dev          # wrangler dev --env-file ../.env  -> http://127.0.0.1:8787 (real keys, real spend, capped)
npm run dev:mock     # LLM_MOCK=1: no keys, no spend
npm test             # unit tests (no network)
```
Client dev with hot reload: `cd client && npm run dev` (proxies /api to :8787). Spike B page: `/spike-b.html` (served as `/spike-b` by the Worker).

## First deploy (needs `wrangler login`; the user's Cloudflare account)
1. `cd worker && npx wrangler secret put BASETEN_API_KEY` and `... META_API_KEY` (paste from `.env`; never commit).
2. `npx wrangler deploy` (provisions the `GHOSTS` KV and the `SpendCounter` Durable Object automatically).
3. Add the custom domain `pets.uryto.dev` to the Worker (dashboard: Workers > pet-mind > Settings > Domains) or a `routes` entry with `custom_domain = true` in `wrangler.toml`. That is the only DNS-touching step.
4. Optional second layer: a Cloudflare WAF custom rule blocking the restricted countries on the zone (the Worker already returns 451).

## Spend guard (see `worker/src/ledger.ts`)
Defaults in `wrangler.toml [vars]`: `MAX_DAILY_USD=5`, `MAX_TOTAL_USD_BASETEN=50`, `MAX_TOTAL_USD_META=100`, per client `$0.40/day` and 10 calls/min. Every paid call reserves its worst-case cost first (UTF-8 bytes of the prompt as the input-token bound, `max_tokens` as the output bound), settles the real usage after, and books the worst case when the outcome is unknown (timeout, reset, unreadable 2xx). `GET /api/spend` shows the live numbers. A refusal returns `{error, fallback:"reflex"}` so the game keeps playing on the free policy.
