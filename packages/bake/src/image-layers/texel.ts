/** The brightest channel of a texel that holds a body's light, of full: under it there is room to make up a browser's rounding. */
export const COLOR_PEAK = 240 / 255;

/** A texel from its channels' optical depths. Its opacity is its brightest channel's, drawn a little more opaque
 * and a little less saturated (`COLOR_PEAK`), which leaves room above every channel: a browser keeps a
 * layer's color times its opacity in whole numbers, rounded down, and half a step is added back to each channel.
 * `owed` is the rounding of the opacity carried from the texel in front; the texel's own is returned. */
export function paintTexel(rgba: Buffer, o: number, each: readonly number[], owed: number): number {
  const depth = Math.max(...each), wanted = depth / COLOR_PEAK + owed, stored = Math.max(0, Math.min(254, Math.round(255 * (1 - Math.exp(-wanted))))), lift = stored ? 127.5 / stored : 0;
  for (let c = 0; c < 3; c++) rgba[o + c] = Math.min(255, Math.round(255 * COLOR_PEAK * each[c]! / depth + lift));
  rgba[o + 3] = stored;
  return wanted + Math.log(1 - stored / 255);
}
