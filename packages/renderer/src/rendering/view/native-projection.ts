/** A request knows the prepared camera but not the viewport. Preserve the
 * projection's focal-length dependence until CSS resolves the real viewport. */
export function nativeProjectedLength(pixels: number, focalPixels: number, focalCss: string): string {
  return `calc(${focalCss} * ${pixels / focalPixels})`;
}

export function nativeProjectedFade(pixels: number, focalPixels: number, focalCss: string, low: number, high: number): string {
  const t = `clamp(0, (${focalCss} / 1px * ${pixels / focalPixels} - ${low}) / ${high - low}, 1)`;
  return `calc(${t} * ${t} * (3 - 2 * ${t}))`;
}

/** The same fade once CSS has resolved the focal length, so a caller can drop a presentation that contributes nothing.
 * A mix of 0 means only the impostor views are visible; 1 means only the full volume is. */
export function nativeProjectedMix(pixels: number, focalPixels: number, focalCssPixels: number, low: number, high: number): number {
  if (!Number.isFinite(focalCssPixels) || !Number.isFinite(pixels) || !(focalPixels > 0) || !(high > low)) return Number.NaN;
  const t = Math.min(Math.max((focalCssPixels * (pixels / focalPixels) - low) / (high - low), 0), 1);
  return t * t * (3 - 2 * t);
}
