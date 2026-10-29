// Game time for the living world: one in-game day lasts 12 real minutes, so a play session sees mornings,
// a party evening and the minds going to bed. Pure: the caller passes elapsed seconds.

export const DAY_SECONDS = 720;
export const HOUR_SECONDS = DAY_SECONDS / 24;
export const START_HOUR = 8; // a new world starts in the morning

export type Phase = "morning" | "noon" | "evening" | "night";

export interface GameTime {
  day: number; // 0-based
  hour: number; // 0..24, fractional
  phase: Phase;
}

export function gameTime(seconds: number): GameTime {
  const total = seconds / HOUR_SECONDS + START_HOUR;
  const day = Math.floor(total / 24);
  const hour = total - day * 24;
  return { day, hour, phase: phaseOf(hour) };
}

export function phaseOf(hour: number): Phase {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "noon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

// "08:30" for logs and the inspector.
export function clockLabel(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
