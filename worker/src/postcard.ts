import type { Deps } from "./app";
import { POSTCARD_REFS } from "./postcard-refs";
import { UpstreamError } from "./providers";

// Postcards (P5e, the surprise): after a win, a new friend, or a campfire story with the villagers, Muse Image on the
// Meta Model API paints a keepsake postcard of the player's pet and the friends who were there, from real game state:
// the pet's genes (colour, ears, tail, horns, pattern), who watched or told the story, what happened. The client sends
// only those values (checked against the game's own lists here) and names; the prompt is written here, so the key
// paints nothing else. Muse Image gets frames of the game itself as reference pictures (postcard-refs.ts, user
// 2026-11-05: cards must look like this village), on the Responses API; if that is refused, the plain text-only
// generation paints the card. Booked at $0.02 a card (dev.meta.ai lists $0.01 an image; the frames add input tokens),
// capped per UTC day (KV) and by the global ledger and quota. Any failure answers 200 with no image: the album simply
// gets no card that time.

export const POSTCARD_URL = "https://api.meta.ai/v1/responses"; // Muse Image with the game's frames as references
export const POSTCARD_TEXT_URL = "https://api.meta.ai/v1/images/generations"; // fallback: text only
export const POSTCARD_MODEL = "muse-image-1.0";
export const POSTCARD_USD = 0.02; // booked per generated image; billed only when one comes back
export const POSTCARD_DAILY_USD = 2; // hard cap for this feature, per UTC day
export const POSTCARD_QUOTA = { pool: "postcard", perClient: 8, total: 200 };
export const POSTCARD_SIZE = "1536x1024"; // the server keeps the ratio: a 3:2 postcard
const SPEND_PREFIX = "postcard:spend:";
const TIMEOUT_MS = 90_000;
const MAX_B64 = 8_000_000;

export const SCENES = ["win", "friends", "campfire"] as const;
export type Scene = (typeof SCENES)[number];
const EARS = ["pointy", "round", "floppy", "bunny", "tuft"] as const;
const TAILS = ["none", "nub", "puff", "curl", "fox"] as const;
const HORNS = ["none", "nubs", "unicorn", "antlers"] as const;
const PATTERNS = ["plain", "belly", "stripes"] as const;
const ARCHS = ["brute", "skitter", "turtle", "pal", "bully"] as const;
export const VILLAGER_LOOK = { elder: "the Elder, a kind old villager", mo: "Mo, a calm young fisher", ama: "Ama, a cheerful cook", pip: "Pip, a lively village kid" } as const;
type Villager = keyof typeof VILLAGER_LOOK;
type Arch = (typeof ARCHS)[number];

export interface PetAsk {
  name: string;
  hue: number; // 0..1 body colour
  accent: number; // 0..1 accent colour
  ears: (typeof EARS)[number];
  tail: (typeof TAILS)[number];
  horns: (typeof HORNS)[number];
  pattern: (typeof PATTERNS)[number];
  arch?: Arch; // a tamed pet's kind; none = the player's own hatchling
}
export interface PostcardAsk {
  scene: Scene;
  player: string;
  pet: PetAsk;
  foe?: { arch?: Arch; owner?: string }; // a win: a wild pet of that kind, or a pet of that owner
  friend?: PetAsk; // "friends": the pet befriended
  with: Villager[]; // villagers who were there; the first one cheered, or told the story
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined => (list as readonly unknown[]).includes(v) ? (v as T) : undefined;
const name = (v: unknown): string => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} '-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 16) : "");
const unit = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? ((v % 1) + 1) % 1 : null);

function parsePet(v: unknown): PetAsk | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const hue = unit(p.hue), accent = unit(p.accent);
  const ears = oneOf(EARS, p.ears), tail = oneOf(TAILS, p.tail), horns = oneOf(HORNS, p.horns), pattern = oneOf(PATTERNS, p.pattern);
  const n = name(p.name);
  if (!n || hue === null || accent === null || !ears || !tail || !horns || !pattern) return null;
  const arch = oneOf(ARCHS, p.arch);
  return { name: n, hue, accent, ears, tail, horns, pattern, ...(arch ? { arch } : {}) };
}

export function parsePostcardAsk(body: unknown): PostcardAsk | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const scene = oneOf(SCENES, b.scene);
  const pet = parsePet(b.pet);
  const player = name(b.player);
  if (!scene || !pet || !player) return null;
  const withV = Array.isArray(b.with) ? [...new Set(b.with.filter((w): w is Villager => typeof w === "string" && w in VILLAGER_LOOK))].slice(0, 3) : [];
  const ask: PostcardAsk = { scene, player, pet, with: withV };
  if (scene === "win") {
    const f = b.foe && typeof b.foe === "object" ? (b.foe as Record<string, unknown>) : {};
    const arch = oneOf(ARCHS, f.arch), owner = name(f.owner);
    if (!arch && !owner) return null;
    ask.foe = { ...(arch ? { arch } : {}), ...(owner ? { owner } : {}) };
  }
  if (scene === "friends") {
    const friend = parsePet(b.friend);
    if (!friend) return null;
    ask.friend = friend;
  }
  if (scene === "campfire" && !withV.length) return null; // somebody tells the story
  return ask;
}

export function colourName(h: number): string {
  if (h < 0.04 || h >= 0.94) return "red";
  if (h < 0.11) return "orange";
  if (h < 0.18) return "golden yellow";
  if (h < 0.42) return "green";
  if (h < 0.52) return "teal";
  if (h < 0.7) return "blue";
  if (h < 0.8) return "purple";
  return "pink";
}

const KIND: Record<Arch, string> = { brute: "big, sturdy", skitter: "tiny, quick", turtle: "shy, shelled", pal: "fluffy, friendly", bully: "cheeky, puffed-up" };
const EAR: Record<PetAsk["ears"], string> = { pointy: "pointy ears", round: "round ears", floppy: "floppy ears", bunny: "long bunny ears", tuft: "tufted ears" };
const TAIL: Record<PetAsk["tail"], string> = { none: "", nub: "a stubby tail", puff: "a puffy tail", curl: "a curly tail", fox: "a bushy fox tail" };
const HORN: Record<PetAsk["horns"], string> = { none: "", nubs: "two little horn nubs", unicorn: "a single small horn", antlers: "tiny antlers" };

export function petText(p: PetAsk): string {
  const accent = colourName(p.accent);
  const pattern = p.pattern === "stripes" ? `${accent} stripes` : p.pattern === "belly" ? `a ${accent} belly` : "";
  const parts = [EAR[p.ears], pattern, HORN[p.horns], TAIL[p.tail]].filter(Boolean);
  return `${p.name}, a ${p.arch ? KIND[p.arch] : "small, round"} ${colourName(p.hue)} pet creature with ${parts.join(", ")}`;
}

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

const STYLE_TEXT = "A keepsake postcard illustration in cozy pixel-art style, like a little village game: chunky pixels, soft outlines, warm sunny palette, front view.";
const STYLE_REFS =
  "The pictures are frames from this game. Paint a keepsake postcard of the moment below in exactly the game's own art style: crisp retro pixel art with hard square pixels, the same bright limited palette, the same top-down three-quarter view, the same small chibi villagers and round pet creatures, the same grass, flowers, round trees, houses and props. Frame it closer than the frames, centred on the moment, with a little more pixel detail. Wide 3:2 landscape.";

export function postcardPrompt(a: PostcardAsk, refs = false): string {
  const pet = petText(a.pet);
  const folk = a.with.map((v) => VILLAGER_LOOK[v]);
  const foe = a.foe?.arch ? `a ${KIND[a.foe.arch]} wild ${a.foe.arch}` : `${a.foe?.owner ?? "a friend"}'s pet`;
  const scene =
    a.scene === "campfire"
      ? `An evening around a crackling campfire on the village green: ${folk[0]} tells a story while ${pet} sits with its trainer ${a.player} and listens${folk.length > 1 ? `, beside ${list(folk.slice(1))}` : ""}. Warm firelight, first stars above.`
      : a.scene === "friends"
        ? `In a sunny meadow, ${pet} has just made a new friend: ${petText(a.friend!)}. The two pets play together while trainer ${a.player} smiles${folk.length ? ` and ${list(folk)} looks on` : ""}.`
        : `In a sunny meadow, ${pet} has just won a friendly pet match against ${foe} and jumps for joy beside trainer ${a.player}${folk.length ? `, while ${list(folk)} cheers` : ""}. Nobody is hurt; everyone is smiling.`;
  return [
    refs ? STYLE_REFS : STYLE_TEXT,
    scene,
    "Cute and gentle, for all ages. No text, letters, words, numbers or logos anywhere in the picture.",
  ].join("\n");
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const MIME: [string, string][] = [["UklGR", "image/webp"], ["iVBOR", "image/png"], ["/9j/", "image/jpeg"]];
const MOCK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export interface PostcardReply {
  image?: string; // data URL
  source: "model" | "none";
  model?: string;
  why?: string;
  costUsd?: number;
}

type Call = (a: PostcardAsk, deps: Deps, signal: AbortSignal) => Promise<string>;
const post = (deps: Deps, url: string, body: unknown, signal: AbortSignal) =>
  deps.fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${deps.cfg.providers.meta.apiKey ?? ""}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });

// The game's own frames as references (Responses API: input_image parts in a user message).
const withRefs: Call = async (a, deps, signal) => {
  const content = [{ type: "input_text", text: postcardPrompt(a, true) }, ...POSTCARD_REFS[a.scene].map((image_url) => ({ type: "input_image", image_url }))];
  const res = await post(deps, POSTCARD_URL, { model: POSTCARD_MODEL, input: [{ role: "user", content }] }, signal);
  if (!res.ok) throw new UpstreamError(`upstream status ${res.status}`, res.status);
  const body = (await res.json()) as { output?: { type?: unknown; result?: unknown }[] };
  const item = body.output?.find((o) => o.type === "image_generation_call" && typeof o.result === "string");
  return typeof item?.result === "string" ? item.result : "";
};

const textOnly: Call = async (a, deps, signal) => {
  const res = await post(deps, POSTCARD_TEXT_URL, { model: POSTCARD_MODEL, prompt: postcardPrompt(a), n: 1, size: POSTCARD_SIZE }, signal);
  if (!res.ok) throw new UpstreamError(`upstream status ${res.status}`, res.status);
  const body = (await res.json()) as { data?: { b64_json?: unknown }[] };
  return typeof body.data?.[0]?.b64_json === "string" ? body.data[0].b64_json : "";
};

export async function paintPostcard(a: PostcardAsk, deps: Deps, clientKey: string): Promise<PostcardReply> {
  const none = (why: string, costUsd = 0): PostcardReply => ({ source: "none", why, ...(costUsd ? { costUsd } : {}) });
  const { cfg } = deps;
  if (!cfg.mock && !cfg.providers.meta.apiKey) return none("unconfigured");
  const worst = cfg.mock ? 0 : POSTCARD_USD;
  const spendKey = SPEND_PREFIX + dayOf(deps.now());
  const spent = Number((await deps.ghosts.get(spendKey)) ?? "0") || 0;
  if (spent + worst > POSTCARD_DAILY_USD + 1e-9) return none("job_cap");
  const id = deps.newId();
  const reserved = await deps.spend.reserve({ id, provider: "meta", worstCaseUsd: worst, clientKey, quota: POSTCARD_QUOTA });
  if (!reserved.ok) return none(reserved.reason);
  await deps.ghosts.put(spendKey, String(spent + worst), { expirationTtl: 3 * 86400 });
  if (cfg.mock) {
    await deps.spend.settle(id, 0);
    return { image: `data:image/png;base64,${MOCK_PNG}`, source: "model", model: "mock", costUsd: 0 };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let b64 = "";
  try {
    try {
      b64 = await withRefs(a, deps, ctl.signal);
    } catch (e) {
      if (!(e instanceof UpstreamError)) throw e;
      b64 = await textOnly(a, deps, ctl.signal); // refused (not billed): the plain text card instead
    }
  } catch (e) {
    if (e instanceof UpstreamError) {
      // Not billed: only images that come back cost anything.
      await deps.spend.release(id);
      await deps.ghosts.put(spendKey, String(spent), { expirationTtl: 3 * 86400 });
      return none("upstream");
    }
    await deps.spend.settle(id, worst); // a timeout may still have been billed
    return none(ctl.signal.aborted ? "timeout" : "upstream", worst);
  } finally {
    clearTimeout(timer);
  }
  await deps.spend.settle(id, POSTCARD_USD);
  if (!b64 || b64.length > MAX_B64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 4096))) return none("invalid", POSTCARD_USD);
  const mime = MIME.find(([sig]) => b64.startsWith(sig))?.[1] ?? "image/png";
  return { image: `data:${mime};base64,${b64.replace(/\s+/g, "")}`, source: "model", model: POSTCARD_MODEL, costUsd: POSTCARD_USD };
}
