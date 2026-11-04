# Deploy notes

**Live: https://mindworld.uryto.dev** (since 2026-11-04; https://pets.uryto.dev since 2026-10-28, kept until P8) (Cloudflare Worker `pet-mind`, custom domain in `wrangler.toml`, workers.dev disabled). Redeploy: `cd client && npm run build`, then `cd ../worker && npx wrangler deploy`. Wrangler is logged in via the TEMP Chrome profile (`wrangler login --browser=false`, open the URL there). Secrets set with `wrangler secret bulk` from a temp JSON in `.scratch/` (deleted after): BASETEN_API_KEY, META_API_KEY, MODAL_PROXY_TOKEN, MODAL_BASE_URL. Glimmer URL not set (too slow/cold for players).

One Cloudflare Worker (`worker/`) serves the built client (`client/dist`) and the API, so the geo-block covers every request.

## Local
```
cd client && npm install && npm run build      # client/dist
cd ../worker && npm install
npm run dev          # wrangler dev --env-file ../.env  -> http://127.0.0.1:8787 (real keys, real spend, capped)
npm run dev:mock     # LLM_MOCK=1: no keys, no spend
npm test             # unit tests (no network)
```
Client dev with hot reload: `cd client && npm run dev` (proxies /api to :8787). The game is `/` (client/index.html; `/pixel.html` redirects there). Spike B page: `/spike-b.html` (served as `/spike-b` by the Worker).

## First deploy (needs `wrangler login`; the user's Cloudflare account)
1. `cd worker && npx wrangler secret put BASETEN_API_KEY` and `... META_API_KEY` (paste from `.env`; never commit). Same for `MODAL_PROXY_TOKEN` and `MODAL_BASE_URL` (the Modal Spark Open provider stays disabled until both are set).
2. `npx wrangler deploy` (provisions the `GHOSTS` KV and the `SpendCounter` Durable Object automatically).
3. Add the custom domain (`mindworld.uryto.dev`; its hostname must be in the Access app first, until P8) to the Worker (dashboard: Workers > pet-mind > Settings > Domains) or a `routes` entry with `custom_domain = true` in `wrangler.toml`. That is the only DNS-touching step.
4. Optional second layer: a Cloudflare WAF custom rule blocking the restricted countries on the zone (the Worker already returns 451).

## Spend guard (see `worker/src/ledger.ts`)
Defaults in `wrangler.toml [vars]`: `MAX_DAILY_USD=5`, `MAX_TOTAL_USD_BASETEN=50`, `MAX_TOTAL_USD_META=100`, per client `$0.40/day` and 10 calls/min. Every paid call reserves its worst-case cost first (UTF-8 bytes of the prompt as the input-token bound, `max_tokens` as the output bound), settles the real usage after, and books the worst case when the outcome is unknown (timeout, reset, unreadable 2xx). `GET /api/spend` shows the live numbers. A refusal returns `{error, fallback:"reflex"}` so the game keeps playing on the free policy.
