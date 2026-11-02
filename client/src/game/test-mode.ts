// Development period: every mind and chat line must come from the local model, so training and output quality show
// plainly. Cloud models and scripted lines are switched off, and anything that would have used one says so on screen.
// Turn off near submission day, when the fallbacks get their own test.
export const LOCAL_ONLY = import.meta.env?.MODE !== "test";
// The one exception, for the event: free talk with a villager or wild pet asks Muse Spark first. Off = fully local.
export const CLOUD_CHAT = import.meta.env?.MODE !== "test";
export const NO_LOCAL = "[local model gave no line]";
