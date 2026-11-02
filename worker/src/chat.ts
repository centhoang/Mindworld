// NPC chat: the elder and the wild pets answer the player in one short, cute line from a Meta model.
// The persona prompts live here (the client only names who it talks to), every call is capped through
// the spend ledger (per client and per day), repeated openers are served from a small cache, and when the
// model is over budget or down the NPC still answers with a scripted line.

export const CHAT_WHO = ["elder", "brute", "skitter", "turtle", "pal", "bully", "mo", "ama", "pip"] as const;
export type ChatWho = (typeof CHAT_WHO)[number];

export const CHAT_MAX_LINE = 140; // the player's message, characters
export const CHAT_MAX_WORDS = 25;
export const CHAT_MAX_TOKENS = 500; // Muse reasons first (150-290 tokens), so leave room for the reply
export const MIND_MAX_TOKENS = 800; // a villager's prompt is longer, and so is the reasoning
export const CHAT_QUOTA = { pool: "chat", perClient: 120, total: 3000 };

const STYLE =
  "You are a character in Mindworld, a cozy village game where players raise and coach pet " +
  "companions. Reply with ONE short spoken line, at most 25 words, cute and warm, in plain text: no emoji, " +
  "no quotes, no stage directions, no lists. Stay in character. Never ask for or repeat personal details " +
  "(names, places, ages, contacts). If the player is rude or asks for something unsafe, gently change the subject " +
  "back to the village.";

const PERSONA: Record<ChatWho, string> = {
  elder:
    "You are the Elder, the village's oldest herb gardener, who has watched pets grow for a lifetime. You give gentle, " +
    "practical tips: pets learn from rules the player teaches (guard when a heavy hit is coming, befriend calm creatures).",
  brute:
    "You are a wild Brute, a big, sleepy, soft-hearted pet in the meadow. You wind up heavy hits you think nobody " +
    "notices. You talk slowly and love naps and snacks.",
  skitter:
    "You are a wild Skitter, a tiny, fast, giggly pet in the meadow. You dart around, talk quickly, love shiny things.",
  turtle:
    "You are a wild Turtle pet in the meadow: shy, polite, likes to hide in your shell and guard, warms up to kind words.",
  pal:
    "You are a wild Pal, the friendliest pet in the meadow. You love making friends and would happily follow the player home.",
  bully:
    "You are a wild Bully pet in the meadow: cheeky and boastful, but secretly lonely. You tease, then show a soft side.",
  mo: "You are Mo, the village fisher: calm, curious and patient. You fish at dawn, whittle, and share your catch with anyone who asks.",
  ama: "You are Ama, the village cook: tidy, generous and chatty. You cook for everyone, tidy up after them and love a party.",
  pip: "You are Pip, the village kid: playful, loud and curious. You love soccer and dancing and challenge everyone to a game.",
};

const SCRIPTED: Record<ChatWho, readonly string[]> = {
  elder: [
    "Ah, a visitor! Teach your pet one clear rule at a time, little one.",
    "When a creature winds up a big hit, a wise pet guards.",
    "Calm creatures often want a friend. Try befriending them.",
    "Grow a little, sell a little. The market square rewards patience.",
  ],
  brute: ["Mmm... big nap soon. You have snacks?", "I hit hard, but only after a long wind-up. Shh.", "You are small. I like small friends."],
  skitter: ["Zip zip! Can't catch me!", "Ooh, shiny! Is that a coin?", "Hehe, I am the fastest in the meadow!"],
  turtle: ["Oh! Hello... I will just stay in my shell a bit.", "You seem kind. Maybe we can be friends.", "Slow and steady, that is my way."],
  pal: ["Hi hi! Want to be friends? Please?", "Your pet looks so happy with you!", "I would love to see your cabin someday!"],
  bully: ["Hah! Your pet looks tiny. ...Cute, though.", "I am the toughest here. Mostly.", "Fine, you can stay. Just for a bit."],
  mo: ["The fish bite best at dawn. Patience, friend.", "Found a pond yet? Sit with me sometime.", "Quiet water, quiet mind."],
  ama: ["Hungry? There is always soup on my stove.", "Bring your pets to the square later!", "Oh dear, who left that mess? I'll tidy it."],
  pip: ["Soccer? Soccer! Come on, one game!", "Bet I can run faster than your pet!", "Let's dance on the square tonight!"],
};

export const isChatWho = (v: unknown): v is ChatWho => typeof v === "string" && (CHAT_WHO as readonly string[]).includes(v);

// Control characters and markup out, whitespace collapsed, length capped.
export function cleanLine(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f<>`]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LINE);
}

// Openers ("hi", empty) are the same question every time, so their answers are cached.
export const isOpener = (line: string): boolean =>
  line === "" || /^(hi+|hello+|hey+|yo|howdy|hiya|good (morning|evening|day)|greetings)[!. ]*$/i.test(line);

// What the player and the NPC both see (built by the client, mind/scene.ts): one short line, cleaned like chat.
export const SCENE_MAX = 300;
export function cleanScene(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return /https?:|www\.|\.(com|net|org|io)\b/i.test(t) ? "" : t.slice(0, SCENE_MAX);
}

// A villager's own mind for this talk (built by the client): who it is, what it remembers, the talk so far.
export const MIND_MAX = 1400;
export function cleanMind(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u0009\u000b-\u001f\u007f<>`]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, MIND_MAX);
}

const VILLAGER_STYLE =
  "You are playing a villager in a cozy village game. The player must not be able to tell you from a human player. " +
  "Reply with what you say next: one or two short sentences, under 22 words, plain text, no emoji, no quotes, no stage directions. " +
  "Answer the last thing said, and use the talk so far: if they say 'it' or 'why', you know what they mean, so never ask them to explain. " +
  "Do not repeat a topic or a sentence you already used, and do not describe where you are unless asked. Talk like a person, not a helper: opinions, small moods, no offers of assistance. " +
  "Answer what was really said. If they insult you, react the way a person would: hurt, sharp or dry, never polite and never as if you misheard. " +
  "If your notes say you are hurt, every reply stays short and cool, small talk too, and you do not warm up until they say sorry. " +
  "This is one small village on one island. It has soccer, dancing, fishing, the market and farming, and no picnics: never suggest anything else to do together. " +
  "Never invent things that happened in the village: use only the memories given. A tale you are asked for is fine, and carry on with it when they ask what happened next. Never read your notes aloud, and only make an offer if it fits. " +
  "If asked whether you are an AI, take it as an odd joke and stay yourself. Never ask for personal details.";

export function chatPrompt(who: ChatWho, line: string, scene = "", mind = ""): { system: string; prompt: string } {
  const around = scene ? `Around you right now: ${scene}\nIf the player asks about something around you, answer only from that list.\n` : "";
  if (mind) return { system: VILLAGER_STYLE, prompt: `${mind}\n${around}The player says: ${line}\nYour reply:` };
  return {
    system: `${STYLE}\n${PERSONA[who]}`,
    prompt: line ? `${around}The player says: ${line}\nYour reply:` : `${around}The player walks up to you and waves. Greet them.\nYour reply:`,
  };
}

// The model's text as one display-safe line of <= 25 words, or "" when unusable.
export function tidyReply(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, " ");
  t = t.split(/\n+/).map((s) => s.trim()).filter(Boolean)[0] ?? "";
  t = t.replace(/^[A-Za-z ]{1,20}:\s+/, ""); // "Elder: ..."
  t = t.replace(/[*_#`<>]/g, "").replace(/^["'“‘]+|["'”’]+$/g, "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length > CHAT_MAX_WORDS) {
    t = words.slice(0, CHAT_MAX_WORDS).join(" ").replace(/[,;:]$/, "") + "...";
  }
  return t.slice(0, 220);
}

export const scriptedLine = (who: ChatWho, random: () => number): string => {
  const lines = SCRIPTED[who];
  return lines[Math.floor(random() * lines.length) % lines.length]!;
};

// Per-isolate opener cache: up to 3 model lines per NPC, then answers rotate through them for free.
export class OpenerCache {
  private readonly lines = new Map<string, string[]>();
  private readonly tries = new Map<string, number>(); // model replies seen, duplicates included
  constructor(private readonly perWho = 3) {}
  full(who: string): boolean {
    return (this.tries.get(who) ?? 0) >= this.perWho && (this.lines.get(who)?.length ?? 0) > 0;
  }
  pick(who: string, random: () => number): string | null {
    const l = this.lines.get(who);
    return l?.length ? l[Math.floor(random() * l.length) % l.length]! : null;
  }
  add(who: string, line: string): void {
    this.tries.set(who, (this.tries.get(who) ?? 0) + 1);
    const l = this.lines.get(who) ?? [];
    if (l.length < this.perWho && !l.includes(line)) l.push(line);
    this.lines.set(who, l);
  }
}

// ---------- pet-to-pet chat: two pets meet and swap one line each ----------
// The client only sends a cleaned name and a trait from a fixed list (derived from the pet's memo), so
// nothing free-form from another player reaches the prompt.

export const PET_TRAITS = ["bold", "careful", "cautious", "cheerful", "friendly", "curious"] as const;
export type PetTrait = (typeof PET_TRAITS)[number];
export interface PetSide { name: string; trait: PetTrait }
const PET_NAME_MAX = 16;

export function parsePetSide(v: unknown): PetSide | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.normalize("NFKC").replace(/[^\p{L}\p{N} _'-]+/gu, "").replace(/\s+/g, " ").trim().slice(0, PET_NAME_MAX).trim() : "";
  if (!name || !(PET_TRAITS as readonly string[]).includes(o.trait as string)) return null;
  return { name, trait: o.trait as PetTrait };
}

export function petsPrompt(a: PetSide, b: PetSide): { system: string; prompt: string } {
  return {
    system:
      "You write tiny dialogues for Mindworld, a cozy game where pets roam a small village. Two pets meet. " +
      "Reply with exactly two lines, first pet A then pet B, each at most 12 words, cute and warm, plain text, " +
      "format 'A: ...' and 'B: ...'. No emoji, no personal details.",
    prompt: `Pet A is ${a.trait}. Pet B is ${b.trait}. They just bumped into each other on the road.`,
  };
}

// Two display-safe lines, or null when the reply is unusable. Names are added by the client.
export function tidyPair(text: string): [string, string] | null {
  const t = text.replace(/<think>[\s\S]*?<\/think>/gi, " ");
  const a = /(?:^|\n)\s*\**A\**\s*:\s*(.+)/.exec(t)?.[1];
  const b = /(?:^|\n)\s*\**B\**\s*:\s*(.+)/.exec(t)?.[1];
  const ta = a ? tidyReply(a) : "";
  const tb = b ? tidyReply(b) : "";
  return ta && tb ? [ta.slice(0, 120), tb.slice(0, 120)] : null;
}

const PET_SCRIPTED: Record<PetTrait, readonly string[]> = {
  bold: ["Race you to the pond!", "I am training every day!"],
  careful: ["Careful, this road is bumpy.", "I always guard first. Just in case."],
  cautious: ["Oh! You startled me.", "Is it safe over there?"],
  cheerful: ["Hello hello! Nice day for a walk!", "Your fur looks so fluffy!"],
  friendly: ["Want to be friends?", "Let's play together sometime!"],
  curious: ["Ooh, who are you?", "What's over by the pond?"],
};
export const scriptedPair = (a: PetSide, b: PetSide, random: () => number): [string, string] => {
  const pick = (t: PetTrait) => PET_SCRIPTED[t][Math.floor(random() * 2) % 2]!;
  return [pick(a.trait), pick(b.trait)];
};
