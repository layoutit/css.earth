import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';
import { mountBatchedSpatialPoints } from './batched-spatial-points.js';

/** Enough for a published catalogue of stars drawn as one bank; the batched projection walks every point each frame. */
const MAX_CATALOGUE_POINTS = 5000;
/** Every point shows within this distance of the bank's origin (the Sun). Farther out a catalogue draws a share
 * inversely proportional to the camera's distance: gently, so zooming never floods in or strips away a crowd at once. */
const FULL_DETAIL_DISTANCE_M = 10e3 * 3.0856775814913673e16;
/** A sparse catalogue (the globular clusters) is never thinned below this many points. */
const MIN_DRAWN_POINTS = 300;

/** How many of a bank's points to draw from a camera this far from its origin. */
export function drawnPointCount(total: number, cameraDistanceM: number): number {
  const fraction = cameraDistanceM <= FULL_DETAIL_DISTANCE_M ? 1 : FULL_DETAIL_DISTANCE_M / cameraDistanceM;
  return Math.min(total, Math.max(MIN_DRAWN_POINTS, Math.round(total * fraction)));
}

export interface PreparedCataloguePoints {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly appearance: { readonly colorCss: string; readonly radiusPx: number; readonly opacity: number; readonly palette?: readonly string[] };
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
  const colorCss = appearance?.colorCss, radiusPx = appearance?.radiusPx, opacity = appearance?.opacity, palette = appearance?.palette;
  const hex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);
  if (!hex(colorCss) || typeof radiusPx !== 'number' || !(radiusPx > 0) ||
      typeof opacity !== 'number' || !(opacity > 0 && opacity <= 1)) throw new TypeError(`${data.id}: catalogue point appearance needs a hex colour, a positive radius and an opacity in (0, 1].`);
  if (palette !== undefined && (!Array.isArray(palette) || !palette.length || !palette.every(hex))) throw new TypeError(`${data.id}: a catalogue point palette is a list of hex colours.`);
  if (!Array.isArray(data.points) || !data.points.length || data.points.length > MAX_CATALOGUE_POINTS) {
    throw new TypeError(`${data.id}: a catalogue point bank holds 1 to ${MAX_CATALOGUE_POINTS} points, got ${Array.isArray(data.points) ? data.points.length : 'none'}.`);
  }
  const width = palette ? 4 : 3;
  const points = data.points.map((point: unknown, index: number) => {
    if (!Array.isArray(point) || point.length !== width || !point.every(axis => typeof axis === 'number' && Number.isFinite(axis))) {
      throw new TypeError(`${data.id}: point ${index} must be ${width} finite numbers${palette ? ' (x, y, z and a palette index)' : ''}.`);
    }
    const colour = palette ? palette[point[3]] : colorCss;
    if (!hex(colour)) throw new TypeError(`${data.id}: point ${index} names palette colour ${point[3]}, which the palette of ${palette!.length} lacks.`);
    return Object.freeze({ positionUnits: Object.freeze([point[0], point[1], point[2]]) as unknown as VolumeVector, colorCss: colour });
  });
  return Object.freeze({ id: data.id, frame, appearance: Object.freeze({ colorCss, radiusPx, opacity, ...(palette ? { palette: Object.freeze([...palette]) } : {}) }),
    points: Object.freeze(points) });
}

/**
 * A published catalogue drawn as fixed dust: every point the same small dot, whatever the distance, so a population's
 * shape shows without any star claiming a size. Fetched on the first publication that shows it.
 */
export function mountCataloguePoints({ host, before, url, fetchJson }: {
  host: HTMLElement; before?: Element; url: string; fetchJson(url: string): Promise<unknown>;
}) {
  const root = host.ownerDocument.createElement('div');
  root.dataset.cataloguePoints = 'loading';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  if (before) host.insertBefore(root, before); else host.append(root);
  let runtime: ReturnType<typeof mountBatchedSpatialPoints> | null = null, loading = false, destroyed = false;
  let latest: VolumeCameraPublication | null = null;
  return Object.freeze({ root,
    publish(publication: VolumeCameraPublication, opacity = 1) {
      if (destroyed) return;
      const alpha = Math.max(0, Math.min(1, opacity)), display = alpha > 0 ? '' : 'none';
      if (root.style.opacity !== String(alpha)) root.style.opacity = String(alpha);
      if (root.style.display !== display) root.style.display = display;
      if (!(alpha > 0)) return;
      latest = publication;
      if (runtime) { runtime.publish(publication); return; }
      if (loading) return;
      loading = true;
      void fetchJson(url).then(value => {
        if (destroyed) return;
        const bank = parseCataloguePoints(value, url);
        // One style object per colour: the projection asks for a style per point on every frame.
        const styles = new Map([...new Set(bank.points.map(point => point.colorCss))].map(colorCss =>
          [colorCss, { colorCss, radiusPx: bank.appearance.radiusPx, opacity: bank.appearance.opacity }] as const));
        // Zooming out draws a smaller share of the catalogue, always a prefix of its prepared order (sparse places first,
        // crowds last): points leave and return as the camera moves, and none is swapped for another.
        runtime = mountBatchedSpatialPoints({ host: root, frame: bank.frame, points: bank.points,
          drawnCount: distanceUnits => drawnPointCount(bank.points.length, distanceUnits * bank.frame.metersPerUnit),
          className: `catalogue-points-${bank.id}`, stylePoint: point => styles.get(point.colorCss)! });
        root.dataset.cataloguePoints = bank.id;
        if (latest) runtime.publish(latest);
      }).catch(error => { root.dataset.cataloguePoints = 'failed'; console.error(`Catalogue points ${url} failed`, error); });
    },
    destroy() { if (destroyed) return; destroyed = true; runtime?.destroy(); root.remove(); },
  });
}
