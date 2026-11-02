// The first-visit story lines (egg, hatched) stay on screen: a Brain line that arrives meanwhile waits behind them.

export interface Line {
  text: string;
  who?: string;
  t: number;
  keep?: boolean; // a story line: nothing in the background replaces it
}

export const brainMayShow = (now: Line | null): boolean => !now?.keep;

// What comes after the current line: the rest of the story first, then the waiting Brain line, then the hints.
export function afterLine(queue: Line[], held: Line | null): { next: Line | null; held: Line | null } {
  if (held && !queue[0]?.keep) return { next: held, held: null };
  return { next: queue.shift() ?? null, held };
}
