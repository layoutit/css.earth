import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';
import { mountBatchedSpatialPoints } from './batched-spatial-points.js';

/** Enough for the Milky Way's stacked levels (32,829 dots). The batched projection walks the drawn prefix each frame, and
 * a stacked bank draws its innermost levels only from near its origin, so the whole bank is walked only near the Sun. */
const MAX_CATALOGUE_POINTS = 40000;
/** Every point shows within this distance of the bank's origin (the Sun). Farther out a catalogue draws a share
 * inversely proportional to the camera's distance: gently, so zooming never floods in or strips away a crowd at once. */
const FULL_DETAIL_DISTANCE_M = 10e3 * 3.0856775814913673e16;
/** A bank fades out as its whole extent shrinks from 48 to 16 screen pixels: past that its dots pile onto a few pixels
 * (the stars within 100 pc, seen from across the galaxy) and still cost a projection every frame. */
const EXTENT_FADE_PIXELS = [16, 48] as const;
/** A prepared bank's JSON, refusing an unsuccessful answer. */
export async function fetchPreparedJson(target: string): Promise<unknown> {
  const response = await fetch(target);
  if (!response.ok) throw new Error(`${target} answered ${response.status}.`);
  return response.json() as Promise<unknown>;
}
/** A sparse catalogue (the globular clusters) is never thinned below this many points. */
const MIN_DRAWN_POINTS = 300;

/** How many of a bank's points to draw from a camera this far from its origin. */
export function drawnPointCount(total: number, cameraDistanceM: number, fullDetailDistanceM = FULL_DETAIL_DISTANCE_M): number {
  const fraction = cameraDistanceM <= fullDetailDistanceM ? 1 : fullDetailDistanceM / cameraDistanceM;
  return Math.min(total, Math.max(MIN_DRAWN_POINTS, Math.round(total * fraction)));
}

/**
 * A stacked bank's levels (packages/bake/cli/stack-catalogue-points.mts), in its order: the outermost is thinned with the
 * camera's distance from `fullDetailUnits`, as any bank is; each inner level's dots appear one at a time as the view's
 * half-width at the origin shrinks through `appearUnits` (from, to), evenly in its logarithm. Zooming in only ever adds
 * dots to the prefix, and zooming out takes the newest away first.
 */
export type CataloguePointLevel = { readonly points: number; readonly fullDetailUnits: number } | { readonly points: number; readonly appearUnits: readonly [number, number] };
export function stackedPointCount(levels: readonly CataloguePointLevel[], cameraDistanceUnits: number, viewHalfWidthUnits: number, metersPerUnit: number): number {
  const [outer, ...inner] = levels;
  const drawn = drawnPointCount(outer!.points, cameraDistanceUnits * metersPerUnit, (outer as { fullDetailUnits: number }).fullDetailUnits * metersPerUnit);
  if (drawn < outer!.points) return drawn;
  let total = drawn;
  for (const level of inner) {
    const [from, to] = (level as { appearUnits: readonly [number, number] }).appearUnits;
    const shown = Math.max(0, Math.min(1, Math.log(from / viewHalfWidthUnits) / Math.log(from / to)));
    total += Math.round(level.points * shown);
    if (shown < 1) break;
  }
  return total;
}

export interface PreparedCataloguePoints {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly appearance: { readonly colorCss: string; readonly radiusPx: number; readonly opacity: number; readonly palette?: readonly string[];
    readonly levels?: readonly CataloguePointLevel[] };
  /** Each point's position, and its palette colour when the bank has a palette. */
  readonly points: readonly { readonly positionUnits: VolumeVector; readonly colorCss: string }[];
}

/** A prepared `cssearth-catalogue-points@1` bank: fixed 3D positions of a published catalogue and how to draw them. */
export function parseCataloguePoints(value: unknown, at = 'catalogue points'): PreparedCataloguePoints {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`);
  const data = value as Record<string, unknown>;
  if (data.schema !== 'cssearth-catalogue-points@1' || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a cssearth-catalogue-points@1 bank with an id.`);
  const frame = parseDensityVolumeFrame(data.frame);
  const appearance = data.appearance as Record<string, unknown> | undefined;
  const colorCss = appearance?.colorCss, radiusPx = appearance?.radiusPx, opacity = appearance?.opacity, palette = appearance?.palette, levels = appearance?.levels;
  const hex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);
  if (!hex(colorCss) || typeof radiusPx !== 'number' || !(radiusPx > 0) ||
      typeof opacity !== 'number' || !(opacity > 0 && opacity <= 1)) throw new TypeError(`${data.id}: catalogue point appearance needs a hex colour, a positive radius and an opacity in (0, 1].`);
  // A palette entry may carry its own opacity as a fourth byte (#rrggbbaa).
  const entry = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value);
  if (palette !== undefined && (!Array.isArray(palette) || !palette.length || !palette.every(entry))) throw new TypeError(`${data.id}: a catalogue point palette is a list of hex colours, with an optional alpha byte.`);
  if (!Array.isArray(data.points) || !data.points.length || data.points.length > MAX_CATALOGUE_POINTS) {
    throw new TypeError(`${data.id}: a catalogue point bank holds 1 to ${MAX_CATALOGUE_POINTS} points, got ${Array.isArray(data.points) ? data.points.length : 'none'}.`);
  }
  const parsedLevels = levels === undefined ? undefined : parseLevels(levels, data.points.length, data.id);
  const width = palette ? 4 : 3;
  const points = data.points.map((point: unknown, index: number) => {
    if (!Array.isArray(point) || point.length !== width || !point.every(axis => typeof axis === 'number' && Number.isFinite(axis))) {
      throw new TypeError(`${data.id}: point ${index} must be ${width} finite numbers${palette ? ' (x, y, z and a palette index)' : ''}.`);
    }
    const colour = palette ? palette[point[3]] : colorCss;
    if (!entry(colour)) throw new TypeError(`${data.id}: point ${index} names palette colour ${point[3]}, which the palette of ${palette!.length} lacks.`);
    return Object.freeze({ positionUnits: Object.freeze([point[0], point[1], point[2]]) as unknown as VolumeVector, colorCss: colour });
  });
  return Object.freeze({ id: data.id, frame, appearance: Object.freeze({ colorCss, radiusPx, opacity,
    ...(palette ? { palette: Object.freeze([...palette]) } : {}), ...(parsedLevels ? { levels: parsedLevels } : {}) }),
    points: Object.freeze(points) });
}

function parseLevels(value: unknown, total: number, id: string): readonly CataloguePointLevel[] {
  const positive = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number) && number > 0;
  if (!Array.isArray(value) || value.length < 2) throw new TypeError(`${id}: a stacked bank has two or more levels.`);
  let before = Infinity, sum = 0;
  const parsed = value.map((raw: unknown, index: number): CataloguePointLevel => {
    const level = raw as { points?: unknown; fullDetailUnits?: unknown; appearUnits?: unknown };
    if (!Number.isInteger(level?.points) || !((level.points as number) > 0)) throw new TypeError(`${id}: level ${index} needs its point count.`);
    sum += level.points as number;
    if (index === 0) {
      if (!positive(level.fullDetailUnits)) throw new TypeError(`${id}: the outermost level needs fullDetailUnits.`);
      before = level.fullDetailUnits;
      return Object.freeze({ points: level.points as number, fullDetailUnits: level.fullDetailUnits });
    }
    const window = level.appearUnits;
    if (!Array.isArray(window) || window.length !== 2 || !positive(window[0]) || !positive(window[1]) || !(window[0] > window[1]) || window[0] > before) {
      throw new TypeError(`${id}: level ${index} appears over a shrinking window starting no farther out than the level before it is whole, got ${JSON.stringify(window)}.`);
    }
    before = window[1];
    return Object.freeze({ points: level.points as number, appearUnits: Object.freeze([window[0], window[1]]) as readonly [number, number] });
  });
  if (sum !== total) throw new TypeError(`${id}: the levels hold ${sum} points, the bank ${total}.`);
  return Object.freeze(parsed);
}

/**
 * A published catalogue drawn as fixed dust: every point the same small dot, whatever the distance, so a population's
 * shape shows without any star claiming a size. Fetched on the first publication that shows it.
 */
export function mountCataloguePoints({ host, before, url, fetchJson }: {
  host: HTMLElement; before?: Node; url: string; fetchJson(url: string): Promise<unknown>;
}) {
  const root = host.ownerDocument.createElement('div');
  root.dataset.cataloguePoints = 'loading';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  if (before) host.insertBefore(root, before); else host.append(root);
  let runtime: ReturnType<typeof mountBatchedSpatialPoints> | null = null, loading = false, destroyed = false;
  let latest: VolumeCameraPublication | null = null, extent: { originM: readonly number[]; radiusM: number } | null = null;
  // The view's half-width at the bank's origin per unit of camera distance: a stacked bank's inner levels fill in by it.
  let halfWidthPerDistance = 1;
  return Object.freeze({ root,
    publish(publication: VolumeCameraPublication, opacity = 1) {
      if (destroyed) return;
      let alpha = Math.max(0, Math.min(1, opacity));
      if (extent) {
        const position = publication.world.pose.positionM;
        const distanceM = Math.hypot(...position.map((value, axis) => value - extent!.originM[axis]!));
        const pixels = distanceM > extent.radiusM ? publication.viewport.focalPixels * extent.radiusM / distanceM : Infinity;
        const t = Math.max(0, Math.min(1, (pixels - EXTENT_FADE_PIXELS[0]) / (EXTENT_FADE_PIXELS[1] - EXTENT_FADE_PIXELS[0])));
        alpha *= t * t * (3 - 2 * t);
      }
      const display = alpha > 0 ? '' : 'none';
      if (root.style.opacity !== String(alpha)) root.style.opacity = String(alpha);
      if (root.style.display !== display) root.style.display = display;
      if (!(alpha > 0)) return;
      latest = publication;
      const { widthPixels, heightPixels, focalPixels } = publication.viewport;
      if (widthPixels && heightPixels && focalPixels > 0) halfWidthPerDistance = Math.hypot(widthPixels, heightPixels) / 2 / focalPixels;
      if (runtime) { runtime.publish(publication); return; }
      if (loading) return;
      loading = true;
      void fetchJson(url).then(value => {
        if (destroyed) return;
        const bank = parseCataloguePoints(value, url);
        extent = { originM: bank.frame.originM, radiusM: Math.max(...bank.points.map(point => Math.hypot(...point.positionUnits))) * bank.frame.metersPerUnit };
        // One style object per palette entry: the projection asks for a style per point on every frame. An entry's alpha
        // byte scales the bank's opacity.
        const styles = new Map([...new Set(bank.points.map(point => point.colorCss))].map(colour =>
          [colour, { colorCss: colour.slice(0, 7), radiusPx: bank.appearance.radiusPx,
            opacity: bank.appearance.opacity * (colour.length === 9 ? parseInt(colour.slice(7), 16) / 255 : 1) }] as const));
        // Zooming out draws a smaller share of the catalogue, always a prefix of its prepared order (sparse places first,
        // crowds last): points leave and return as the camera moves, and none is swapped for another.
        runtime = mountBatchedSpatialPoints({ host: root, frame: bank.frame, points: bank.points,
          drawnCount: bank.appearance.levels
            ? distanceUnits => stackedPointCount(bank.appearance.levels!, distanceUnits, distanceUnits * halfWidthPerDistance, bank.frame.metersPerUnit)
            : distanceUnits => drawnPointCount(bank.points.length, distanceUnits * bank.frame.metersPerUnit),
          // A single SVG path unions overlapping subpaths. Preserve per-dot alpha
          // accumulation for translucent banks with the shadow painter.
          paintPalette: [...styles.values()].every(style => style.opacity === 1)
            ? [...styles.values()].map(style => `${style.colorCss}ff`) : undefined,
          className: `catalogue-points-${bank.id}`, stylePoint: point => styles.get(point.colorCss)! });
        root.dataset.cataloguePoints = bank.id;
        if (latest) runtime.publish(latest);
      }).catch(error => { root.dataset.cataloguePoints = 'failed'; console.error(`Catalogue points ${url} failed`, error); });
    },
    destroy() { if (destroyed) return; destroyed = true; runtime?.destroy(); root.remove(); },
  });
}
