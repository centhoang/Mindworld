// Bench client only: sends a voice prompt to a llama.cpp `llama-server` (the published GGUFs). The game itself uses WebLLM.
import { splitReply, type VoicePrompt, type VoiceReply } from "../game/instinct";

export class NativeVoice {
  constructor(private readonly base: string) {}

  async pick(p: VoicePrompt, signal: AbortSignal): Promise<VoiceReply> {
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
        temperature: 0.7,
        max_tokens: 24,
        grammar: p.grammar,
      }),
    });
    if (!res.ok) throw new Error(`llama-server HTTP ${res.status}`);
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return splitReply(body.choices[0]?.message.content ?? "");
  }
}
