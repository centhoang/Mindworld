import type { SpendCounter } from "./spend-do";

export interface Env {
  SPEND: DurableObjectNamespace<SpendCounter>;
  GHOSTS: KVNamespace;
  ASSETS: Fetcher;
  // secrets (never exposed to the client)
  BASETEN_API_KEY?: string;
  META_API_KEY?: string;
  MODAL_PROXY_TOKEN?: string;
  // plain vars; all optional so a bare `.env` still works
  BASETEN_BASE_URL?: string;
  BASETEN_MODEL?: string;
  META_MODEL?: string;
  MODAL_BASE_URL?: string;
  MODAL_MODEL?: string;
  MODAL_GLIMMER_URL?: string;
  MODAL_GLIMMER_MODEL?: string;
  LLM_MOCK?: string;
  MAX_DAILY_USD?: string;
  MAX_TOTAL_USD_BASETEN?: string;
  MAX_TOTAL_USD_META?: string;
  MAX_TOTAL_USD_MODAL?: string;
  MAX_TOTAL_USD_GLIMMER?: string;
  CLIENT_DAILY_USD?: string;
  CLIENT_PER_MINUTE?: string;
}
