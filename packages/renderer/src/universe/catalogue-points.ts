import { MAX_CATALOGUE_POINTS, parseCataloguePointSpread, parseDensityVolumeFrame } from '@cssearth/objects';
import type { CataloguePointSpread, DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';
import { mountBatchedSpatialPoints, pointPaint } from './batched-spatial-points.js';
import { revealLayer } from './layer-reveal.js';

/** Dot layers switching on show one a frame (layer-reveal.ts). */
const revealLayers = (layers: readonly HTMLElement[]) => { for (const layer of layers) revealLayer(layer); };

// MAX_CATALOGUE_POINTS bounds every published bank. The batched projection walks the drawn prefix each frame, and a
// stacked bank draws its innermost levels only from near its origin, so the whole bank is walked only near the Sun.
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
/** Seen from outside its reach, a bank draws at most one dot per this many square pixels of its projected shape (about
 * 8 px apart), so a far galaxy's dots never pile into a few pixels. */
const PIXELS_PER_DOT = 64;

/** How many dots a bank's projected shape holds, seen from `cameraUnits` (the camera in the bank's frame): its disc as an
 * ellipse, `across` wide and foreshortened by the view's angle to the normal but never thinner than `along`. Within its
 * reach there is no such limit. */
export function screenPointCount(spread: CataloguePointSpread, cameraUnits: VolumeVector, focalPixels: number, pixelsPerDot = PIXELS_PER_DOT): number {
  const distance = Math.hypot(...cameraUnits);
  if (!(distance > spread.across) || !(focalPixels > 0)) return Infinity;
  const cos = Math.abs(cameraUnits[0] * spread.normal[0] + cameraUnits[1] * spread.normal[1] + cameraUnits[2] * spread.normal[2]) / distance;
  const a = focalPixels * spread.across / distance, c = focalPixels * spread.along / distance;
  return Math.floor(Math.PI * a * Math.sqrt(a * a * cos * cos + c * c * (1 - cos * cos)) / pixelsPerDot);
}

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
export type CataloguePointLevel = ({ readonly points: number; readonly fullDetailUnits: number } | { readonly points: number; readonly appearUnits: readonly [number, number] })
  /** The level's opacity once the innermost level has filled the view, reached as it fills (1 when absent). */
  & { readonly nearOpacity?: number };
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
    readonly levels?: readonly CataloguePointLevel[];
    /** The most of its dots a bank shows on screen at once: past it, an even, stable share of them is drawn. */
    readonly screenBudget?: number };
  /** Each point's position, and its palette colour when the bank has a palette. */
  readonly points: readonly { readonly positionUnits: VolumeVector; readonly colorCss: string }[];
  /** The bank's prepared shape around its origin, written by the bake that published it. */
  readonly spread: CataloguePointSpread;
}

/** A prepared `cssearth-catalogue-points@1` bank: fixed 3D positions of a published catalogue and how to draw them. */
export function parseCataloguePoints(value: unknown, at = 'catalogue points'): PreparedCataloguePoints {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`);
  const data = value as Record<string, unknown>;
  if (data.schema !== 'cssearth-catalogue-points@1' || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a cssearth-catalogue-points@1 bank with an id.`);
  const frame = parseDensityVolumeFrame(data.frame);
  const appearance = data.appearance as Record<string, unknown> | undefined;
  const colorCss = appearance?.colorCss, radiusPx = appearance?.radiusPx, opacity = appearance?.opacity, palette = appearance?.palette, levels = appearance?.levels;
  const screenBudget = appearance?.screenBudget;
  if (screenBudget !== undefined && !(Number.isSafeInteger(screenBudget) && (screenBudget as number) > 0)) {
    throw new TypeError(`${String(data.id)}: catalogue point screenBudget must be a positive whole number, got ${JSON.stringify(screenBudget)}.`);
  }
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
  const spread = parseCataloguePointSpread(data.spread, `${data.id} (${at})`);
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
    ...(palette ? { palette: Object.freeze([...palette]) } : {}), ...(parsedLevels ? { levels: parsedLevels } : {}),
    ...(screenBudget === undefined ? {} : { screenBudget: screenBudget as number }) }),
    points: Object.freeze(points), spread });
}

function parseLevels(value: unknown, total: number, id: string): readonly CataloguePointLevel[] {
  const positive = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number) && number > 0;
  if (!Array.isArray(value) || value.length < 1) throw new TypeError(`${id}: a stacked bank has one or more levels.`);
  let before = Infinity, sum = 0;
  const parsed = value.map((raw: unknown, index: number): CataloguePointLevel => {
    const level = raw as { points?: unknown; fullDetailUnits?: unknown; appearUnits?: unknown; nearOpacity?: unknown };
    if (!Number.isInteger(level?.points) || !((level.points as number) > 0)) throw new TypeError(`${id}: level ${index} needs its point count.`);
    sum += level.points as number;
    if (level.nearOpacity !== undefined && !(positive(level.nearOpacity) && level.nearOpacity <= 1)) {
      throw new TypeError(`${id}: level ${index} nearOpacity must be in (0, 1], got ${JSON.stringify(level.nearOpacity)}.`);
    }
    const near = level.nearOpacity === undefined ? {} : { nearOpacity: level.nearOpacity as number };
    if (index === 0) {
      if (!positive(level.fullDetailUnits)) throw new TypeError(`${id}: the outermost level needs fullDetailUnits.`);
      before = level.fullDetailUnits;
      return Object.freeze({ points: level.points as number, fullDetailUnits: level.fullDetailUnits, ...near });
    }
    const window = level.appearUnits;
    if (!Array.isArray(window) || window.length !== 2 || !positive(window[0]) || !positive(window[1]) || !(window[0] > window[1]) || window[0] > before) {
      throw new TypeError(`${id}: level ${index} appears over a shrinking window starting no farther out than the level before it is whole, got ${JSON.stringify(window)}.`);
    }
    before = window[1];
    return Object.freeze({ points: level.points as number, appearUnits: Object.freeze([window[0], window[1]]) as readonly [number, number], ...near });
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
  let runtime: { readonly layers: readonly HTMLElement[]; publish(publication: VolumeCameraPublication): void; destroy(): void } | null = null, loading = false, destroyed = false;
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
      if (root.style.display !== display) {
        root.style.display = display;
        if (display === '' && runtime) revealLayers(runtime.layers);
      }
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
        // crowds last): points leave and return as the camera moves, and none is swapped for another. From outside the
        // bank's reach the share is also capped by how many dots its projected shape holds.
        const drawn = (distanceUnits: number, cameraUnits: VolumeVector) => Math.min(bank.appearance.levels
          ? stackedPointCount(bank.appearance.levels, distanceUnits, distanceUnits * halfWidthPerDistance, bank.frame.metersPerUnit)
          : drawnPointCount(bank.points.length, distanceUnits * bank.frame.metersPerUnit),
          screenPointCount(bank.spread, cameraUnits, latest?.viewport.focalPixels ?? 0));
        // Past its screen budget a bank draws an even share of its visible dots, set from the last frame's count.
        let share = 1;
        const budget = bank.appearance.screenBudget;
        const mount = (points: typeof bank.points, count: (total: number) => number) => mountBatchedSpatialPoints({ host: root, frame: bank.frame, points,
          drawnCount: (distanceUnits, cameraUnits) => count(drawn(distanceUnits, cameraUnits)),
          ...(budget === undefined ? {} : { keepFraction: () => share }),
          // One path per colour unions its dots, so two translucent dots of one colour that overlap do not add up.
          paintPalette: [...styles.values()].map(pointPaint),
          className: `catalogue-points-${bank.id}`, stylePoint: point => styles.get(point.colorCss)! });
        // Consecutive levels that share a near opacity draw as one part, so a part can dim as the innermost level fills.
        const levels = bank.appearance.levels ?? [], parts: { start: number; points: number; nearOpacity: number }[] = [];
        for (const level of levels) {
          const nearOpacity = level.nearOpacity ?? 1, last = parts[parts.length - 1];
          if (last && last.nearOpacity === nearOpacity) last.points += level.points;
          else parts.push({ start: last ? last.start + last.points : 0, points: level.points, nearOpacity });
        }
        const rebudget = (candidates: number) => { if (budget !== undefined) share = candidates > budget ? budget / candidates : 1; };
        if (parts.length < 2) {
          const single = mount(bank.points, total => total);
          runtime = { layers: [single.root], publish(publication) { single.publish(publication); rebudget(single.stats().candidates); }, destroy: single.destroy };
        } else {
          const innermost = levels[levels.length - 1] as { appearUnits?: readonly [number, number] };
          const mounted = parts.map(part => ({ ...part, runtime: mount(bank.points.slice(part.start, part.start + part.points),
            total => Math.max(0, Math.min(part.points, total - part.start))) }));
          runtime = { layers: mounted.map(part => part.runtime.root), publish(publication) {
            const distanceUnits = Math.hypot(...publication.world.pose.positionM.map((value, axis) => value - bank.frame.originM[axis]!)) / bank.frame.metersPerUnit;
            const [from, to] = innermost.appearUnits ?? [1, 1];
            const filled = from > to ? Math.max(0, Math.min(1, Math.log(from / (distanceUnits * halfWidthPerDistance)) / Math.log(from / to))) : 0;
            for (const part of mounted) {
              const opacity = String(1 - (1 - part.nearOpacity) * filled);
              if (part.runtime.root.style.opacity !== opacity) part.runtime.root.style.opacity = opacity;
              part.runtime.publish(publication);
            }
            rebudget(mounted.reduce((sum, part) => sum + part.runtime.stats().candidates, 0));
          }, destroy() { for (const part of mounted) part.runtime.destroy(); } };
        }
        root.dataset.cataloguePoints = bank.id;
        if (root.style.display !== 'none') revealLayers(runtime.layers);
        if (latest) runtime.publish(latest);
      }).catch(error => { root.dataset.cataloguePoints = 'failed'; console.error(`Catalogue points ${url} failed`, error); });
    },
    destroy() { if (destroyed) return; destroyed = true; runtime?.destroy(); root.remove(); },
  });
}
