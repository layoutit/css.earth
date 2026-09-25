/** Prepared resources that stand in for others when the browser lacks a rendering capability. A `<u>` face is the
 * triangle its two bevelled top corners cut with `corner-shape`; a browser without it (Safari 26) rounds those corners
 * into an ellipse, so the face shows an atlas whose slices are already masked to the triangle instead. */
export type PreparedCapability = 'corner-shape';
export interface PreparedResourceFallback { unsupported: PreparedCapability; resources: Readonly<Record<string, string>> }

let cornerShape: boolean | undefined;
export function preparedCapabilitySupported(capability: PreparedCapability): boolean {
  if (capability !== 'corner-shape') throw new TypeError(`Unknown prepared capability: ${String(capability)}.`);
  // Without CSS (tests, preparation) the prepared default applies.
  cornerShape ??= typeof CSS === 'undefined' || typeof CSS.supports !== 'function' ||
    (CSS.supports('corner-top-left-shape', 'bevel') && CSS.supports('corner-top-right-shape', 'bevel'));
  return cornerShape;
}

/** The resource map of every fallback whose capability this browser lacks; decided once per page. */
export function activeResourceFallbacks(fallbacks: readonly PreparedResourceFallback[] | undefined,
  supported: (capability: PreparedCapability) => boolean = preparedCapabilitySupported): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const fallback of fallbacks ?? []) if (!supported(fallback.unsupported)) Object.assign(map, fallback.resources);
  return map;
}
