export const LOW_H = 216;
export const LOW_MIN_W = 360; // the Goals card, the bottom line and the map need this many columns (phone-size windows)

// One art pixel is always a whole number of screen pixels, or pixels come out in different sizes. The scale that
// shows at least LOW_H rows and LOW_MIN_W columns wins, and the low-res picture takes whatever size fills the screen.
export function lowSize(devW: number, devH: number, rows = LOW_H, cols = LOW_MIN_W): { w: number; h: number; scale: number } {
  const scale = Math.max(1, Math.min(Math.floor(Math.max(1, devH) / rows), Math.floor(Math.max(1, devW) / cols)));
  return { w: Math.max(1, Math.ceil(devW / scale)), h: Math.max(1, Math.ceil(devH / scale)), scale };
}
