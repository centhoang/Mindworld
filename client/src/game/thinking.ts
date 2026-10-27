// Label for the pet's "thinking" bubble while the Cortex (Muse) call runs: cycling dots plus elapsed seconds.
export function thinkingLabel(elapsedMs: number): string {
  const ms = Math.max(0, elapsedMs);
  return `thinking${".".repeat(1 + (Math.floor(ms / 400) % 3))} ${Math.floor(ms / 1000)}s`;
}
