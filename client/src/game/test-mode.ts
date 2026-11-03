// Development period switch: on, every mind and chat line must come from the local model, so training and output
// quality show plainly; cloud models and scripted lines are off, and anything that would have used one says so.
// Off since 2026-11-03 (user): minds fall back to Muse Spark, then rules and scripted lines.
export const LOCAL_ONLY = false;
// Free talk with a villager or wild pet asks Muse Spark first. Off = fully local.
export const CLOUD_CHAT = import.meta.env?.MODE !== "test";
// Cloud extras that make the village feel lively (rival tactics, fight reviews). Off = the game runs free, on rules.
export const CLOUD_LIVELY = import.meta.env?.MODE !== "test";
export const NO_LOCAL = "[local model gave no line]";
