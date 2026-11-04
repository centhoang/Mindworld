// Frozen client prompts: compare the complete text, without importing browser code.
const COACH_SYSTEM = [
  "You coach a small pet that fights turn-based duels. You maintain the pet's MEMO: a few if-then rules it follows.",
  "Reply with ONLY one JSON object, no prose: {\"summary\": string (max 160 chars), \"rules\": Rule[]} with at most 8 rules, most important first.",
  "Rule = {\"if\": Cond[] (1-3 conditions, all must hold), \"do\": Action, \"why\": string (max 100 chars)}.",
  "Action is one of: attack, guard, flee, emote, befriend.",
  "Cond is one of:",
  "  {\"k\":\"enemy\",\"is\":\"brute\"|\"skitter\"|\"turtle\"|\"pal\"|\"bully\"}",
  "  {\"k\":\"intent\",\"is\":\"idle\"|\"heavy\"|\"guarding\"|\"calm\"|\"scared\"}   (heavy = telegraphed heavy hit)",
  "  {\"k\":\"size\",\"is\":\"smaller\"|\"similar\"|\"bigger\"}   (enemy size relative to the pet)",
  "  {\"k\":\"last\",\"is\":Action}   (the pet's previous move)",
  "  {\"k\":\"myHp\"|\"enemyHp\"|\"turn\",\"op\":\"<\"|\">=\",\"n\":number}   (HP in percent)",
  "Facts: guard cuts damage taken to 40%. Attacking a guarding enemy does 40% damage. Attacking is how an enemy gets hurt.",
  "Befriend ends the fight as a win. On a hurt enemy (<40% HP, it usually shows intent \"scared\") befriend almost always works at once: befriend it, never emote at it.",
  "Emote never wins by itself; it only makes a later befriend likelier on a healthy enemy, and the enemy may hit you meanwhile. Flee ends the fight without a win.",
  "Guard and emote only buy time: a rule that guards or emotes turn after turn stalls the fight into a loss or draw. Every enemy needs a path to a win (attack it down, then befriend).",
  "Keep rules that still work, fix or drop ones the replays show are hurting, and obey the player's instruction.",
  "Keep your reasoning brief; the JSON is all that matters.",
].join("\n");

const DIALOGUE_SYSTEM = "You are the inner voice of a character in a cozy village game. Stay in character. Answer only in the requested format.";

// Only the name varies. Match plain, trimmed names; parseParty caps them at 12 UTF-16 chars.
// The final assertion also rejects a trailing newline, which JavaScript's $ alone would allow.
const MOVE_SYSTEM = /^You are ([\p{L}\p{N}_'-](?:[\p{L}\p{N} _'-]{0,10}[\p{L}\p{N}_'-])?), a small pet in a turn-based duel \(curious, a little cheeky, loyal to its coach\)\. Pick one of the allowed moves and say a short line \(max 8 words\) in character\. Format: move: line$(?![\s\S])/u;

// Measured saturated client prompts: 5259 / 4360 / 2688 / 90 chars respectively.
// About 1.5x headroom, rounded up; the existing server-wide output cap still applies.
export const LLM_POLICIES = {
  memo: { provider: "meta", maxTokens: 4000, maxPromptChars: 7900, system: COACH_SYSTEM },
  teach: { provider: "baseten", maxTokens: 4000, maxPromptChars: 6600, system: COACH_SYSTEM },
  dialogue: { provider: "baseten", maxTokens: 400, maxPromptChars: 4100, system: DIALOGUE_SYSTEM },
  move: { provider: "modal", maxTokens: 600, maxPromptChars: 140, system: MOVE_SYSTEM },
} as const;

export type LlmPolicy = (typeof LLM_POLICIES)[keyof typeof LLM_POLICIES];

export function checkLlm(kind: unknown, system: unknown, prompt: unknown): LlmPolicy | string {
  if (kind === "chat") return "use /api/chat";
  if (typeof kind !== "string" || !Object.hasOwn(LLM_POLICIES, kind)) return "unknown kind";
  const policy = LLM_POLICIES[kind as keyof typeof LLM_POLICIES];
  if (typeof system !== "string") return "bad system";
  if (typeof policy.system === "string") {
    if (system !== policy.system) return "bad system";
  } else {
    const match = policy.system.exec(system);
    if (!match || match[1]!.length > 12) return "bad system";
  }
  if (typeof prompt !== "string" || prompt.length === 0) return "bad prompt";
  if (prompt.length > policy.maxPromptChars) return "prompt too long";
  return policy;
}
