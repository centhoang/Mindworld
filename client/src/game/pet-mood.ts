// What the pet following you does when you stop: its mood shows in what it does, never in a number.
import type { Pose } from "../life/activities";

export const HATCH_TIME = 4; // seconds the egg rocks on the first visit
export const GLAD_TIME = 6; // seconds it cheers after a win
const SETTLES = 4; // seconds you stand still before it does anything
const BORED = 20; // seconds until playing gives way to sitting

export function petMood(still: number, night: boolean, glad: number): Pose | null {
  if (glad > 0) return "dance";
  if (still < SETTLES) return null;
  if (night) return "sleep";
  return still < BORED ? "wiggle" : "sit";
}
