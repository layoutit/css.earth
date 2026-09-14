/** A request knows the prepared camera but not the viewport. Preserve the
 * projection's focal-length dependence until CSS resolves the real viewport. */
export function nativeProjectedLength(pixels: number, focalPixels: number, focalCss: string): string {
  return `calc(${focalCss} * ${pixels / focalPixels})`;
}

export function nativeProjectedFade(pixels: number, focalPixels: number, focalCss: string, low: number, high: number): string {
  const t = `clamp(0, (${focalCss} / 1px * ${pixels / focalPixels} - ${low}) / ${high - low}, 1)`;
  return `calc(${t} * ${t} * (3 - 2 * ${t}))`;
}
