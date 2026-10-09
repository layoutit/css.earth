/** Patch annotation: what a selected leaf is, read from its bank's leaf record and the drawn element, never recomputed. */
export type Vector3 = readonly [number, number, number];
export interface AnnotationFrame {
  readonly referenceFrame: string; readonly originM: Vector3; readonly localToReferenceXyzw: readonly [number, number, number, number]; readonly metersPerUnit: number;
}
export interface SkyOffset { eastArcsec: number; northArcsec: number; depthArcsec: number }
export interface AnnotatedPatch {
  bank: string; layer: string; leaf: string; sky: SkyOffset | null;
  /** The projected quad's mean edge lengths on screen (CSS px) and the longer over the shorter. */
  screenPx: [number, number]; stretch: number;
}
const ARCSEC_PER_RADIAN = 648000 / Math.PI;
const rotate = ([x, y, z, w]: readonly number[], v: Vector3): [number, number, number] => {
  const tx = 2 * (y! * v[2] - z! * v[1]), ty = 2 * (z! * v[0] - x! * v[2]), tz = 2 * (x! * v[1] - y! * v[0]);
  return [v[0] + w! * tx + (y! * tz - z! * ty), v[1] + w! * ty + (z! * tx - x! * tz), v[2] + w! * tz + (x! * ty - y! * tx)];
};
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const unit = (v: readonly number[]) => { const l = Math.hypot(...v); return [v[0]! / l, v[1]! / l, v[2]! / l] as const; };

/** A bank point's sky offset from the frame origin (the bank's centre: for Cassiopeia A, its fitted expansion centre)
 * as seen from the Sun: arcsec east and north on the tangent plane, and depth along the sight line (positive = farther),
 * in arcsec at the origin's distance. Only a `sun-icrf` frame names a sky; any other frame gives null. */
export function skyOffset(frame: AnnotationFrame, centerUnits: Vector3): SkyOffset | null {
  if (frame.referenceFrame !== 'sun-icrf') return null;
  const distance = Math.hypot(...frame.originM);
  if (!(distance > 0)) return null;
  const sight = unit(frame.originM), east = unit([-sight[1], sight[0], 0]), north = [sight[1] * east[2] - sight[2] * east[1], sight[2] * east[0] - sight[0] * east[2], sight[0] * east[1] - sight[1] * east[0]];
  const d = rotate(frame.localToReferenceXyzw, centerUnits).map(value => value * frame.metersPerUnit);
  const arcsec = (value: number) => value / distance * ARCSEC_PER_RADIAN;
  return { eastArcsec: arcsec(dot(d, east)), northArcsec: arcsec(dot(d, north)), depthArcsec: arcsec(dot(d, sight)) };
}

/** The projected quad's size from its four screen corners in order (top-left, top-right, bottom-right, bottom-left). */
export function quadMetrics(corners: readonly (readonly [number, number])[]): { screenPx: [number, number]; stretch: number } {
  const edge = (a: number, b: number) => Math.hypot(corners[b]![0] - corners[a]![0], corners[b]![1] - corners[a]![1]);
  const across = (edge(0, 1) + edge(3, 2)) / 2, down = (edge(0, 3) + edge(1, 2)) / 2;
  const shorter = Math.min(across, down);
  return { screenPx: [across, down], stretch: shorter > 0 ? Math.max(across, down) / shorter : Infinity };
}

const round = (value: number, places = 1) => { const scale = 10 ** places; return Math.round(value * scale) / scale; };
/** One compact line to paste into chat. */
export function annotationText(context: { object: string; dataset: string; bank: string; camera: unknown; url?: string }, patches: readonly AnnotatedPatch[]): string {
  return JSON.stringify({ object: context.object, dataset: context.dataset, bank: context.bank, camera: context.camera, ...(context.url ? { url: context.url } : {}),
    patches: patches.map(item => ({ layer: item.layer, leaf: item.leaf,
      ...(item.sky ? { eastArcsec: round(item.sky.eastArcsec), northArcsec: round(item.sky.northArcsec), depthArcsec: round(item.sky.depthArcsec) } : { sky: null }),
      screenPx: item.screenPx.map(value => round(value, 0)), stretch: Number.isFinite(item.stretch) ? round(item.stretch, 2) : null })) });
}
