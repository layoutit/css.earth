import { writeStyle } from '../rendering/retained-write.js';
import { eyeDistanceM } from '@cssearth/engine';
import { parseCataloguePoints, type CataloguePointLevel, decodeCatalogueBankBinary, type CataloguePointSpread, type VolumeVector } from '@cssearth/objects';

import { readPreparedBinary } from '../prepared-data/prepared-binary.js';

import type { VolumeCameraPublication } from '../volume/types.js';

import { mountBatchedSpatialPoints, pointPaint } from './batched-spatial-points.js';
import { pointLayerSlot } from './point-layer.js';
import { revealLayer } from '../rendering/layer-reveal.js';
import { afterStartup } from '../rendering/startup-gate.js';

/** Dot layers switching on show one a frame (layer-reveal.ts). */
const revealLayers = (layers: readonly (HTMLElement | SVGElement)[]) => { for (const layer of layers) revealLayer(layer); };

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
/** A published catalogue point bank (`<id>.bin`): packed, gunzipped by the platform and decoded to the object its JSON
 * was (@cssearth/objects prepared-data/catalogue-bank-binary.ts), refusing an unsuccessful answer. */
export async function fetchPreparedCatalogueBank(target: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(target);
  if (!response.ok) throw new Error(`${target} answered ${response.status}.`);
  return decodeCatalogueBankBinary(await readPreparedBinary(await response.arrayBuffer(), target), target);
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

export interface CataloguePointOccluder { readonly centreM: readonly number[]; readonly normal: readonly number[]; readonly radiusM: number }
/** A reference-frame vector in a bank's own axes: the inverse of its frame's local-to-reference rotation. */
const toLocalAxes = ([x, y, z, w]: readonly number[], [vx, vy, vz]: readonly number[]): VolumeVector => {
  const qx = -x!, qy = -y!, qz = -z!, tx = 2 * (qy * vz! - qz * vy!), ty = 2 * (qz * vx! - qx * vz!), tz = 2 * (qx * vy! - qy * vx!);
  return [vx! + w! * tx + (qy * tz - qz * ty), vy! + w! * ty + (qz * tx - qx * tz), vz! + w! * tz + (qx * ty - qy * tx)];
};

/**
 * A published catalogue drawn as fixed dust: every point the same small dot, whatever the distance, so a population's
 * shape shows without any star claiming a size. Fetched on the first publication that shows it. Its root is a group in
 * the dot layer that ends where it mounts (point-layer.ts): banks mounted next to each other are one layer, and the
 * root's stroke opacity dims this bank alone.
 */
export function mountCataloguePoints({ host, before, url, loadBank, occluder }: {
  host: HTMLElement; before?: Node; url: string; loadBank(url: string): Promise<unknown>;
  /** A disc in the world's reference frame (its centre, unit normal and radius, in metres) that dims the dots behind it. */
  occluder?: CataloguePointOccluder;
}) {
  const slot = pointLayerSlot(host, before), root = slot.group;
  root.dataset.cataloguePoints = 'loading';
  let runtime: { readonly layers: readonly SVGElement[]; publish(publication: VolumeCameraPublication): void; hide(): void; destroy(): void } | null = null, loading = false, destroyed = false;
  let latest: VolumeCameraPublication | null = null, extent: { originM: readonly number[]; radiusM: number } | null = null;
  // The loaded bank's fade as the view narrows at its origin (its appearance's fadeOutUnits, in its units), in metres.
  let fadeOutM: readonly [number, number] | null = null;
  // The view's half-width at the bank's origin per unit of camera distance: a stacked bank's inner levels fill in by it.
  let halfWidthPerDistance = 1;
  // The points at the places of stars a body marker draws (the selected body, and each star the world holds as a body):
  // found once per list of places and per part, by the bank's own rounding (catalogue-bank-binary.ts
  // CATALOGUE_POSITION_SCALE), and left out of the paint while the list names them.
  let hiddenAtM: readonly (readonly number[])[] | null = null;
  // A place in the world's frame as the loaded bank stores it, or null in a rotated bank (a galaxy's own dots), which is
  // never asked for one.
  let placeKey: ((positionM: readonly number[]) => string | null) | null = null;
  /** The hidden points of one part, by the part's own indices. */
  const hiddenIn = (points: readonly { readonly positionUnits: readonly number[] }[]) => {
    let byPlace: Map<string, number> | null = null, forList: typeof hiddenAtM = null, indices: ReadonlySet<number> | null = null;
    return () => {
      if (forList === hiddenAtM) return indices;
      forList = hiddenAtM;
      if (!hiddenAtM?.length || !placeKey) return indices = null;
      byPlace ??= new Map(points.map((point, index) => [point.positionUnits.join(','), index] as const));
      const found = hiddenAtM.flatMap(positionM => { const key = placeKey!(positionM), index = key === null ? undefined : byPlace!.get(key); return index === undefined ? [] : [index]; });
      return indices = found.length ? new Set(found) : null;
    };
  };
  return Object.freeze({ root,
    /** `withoutM`: places in the world's frame, in metres, whose own dots are not drawn. The caller passes the same list
     * until its places change. */
    publish(publication: VolumeCameraPublication, opacity = 1, withoutM: readonly (readonly number[])[] | null = null) {
      if (destroyed) return;
      hiddenAtM = withoutM;
      let alpha = Math.max(0, Math.min(1, opacity));
      if (extent) {
        const distanceM = eyeDistanceM(publication.world.pose, extent.originM);
        const pixels = distanceM > extent.radiusM ? publication.viewport.focalPixels * extent.radiusM / distanceM : Infinity;
        const t = Math.max(0, Math.min(1, (pixels - EXTENT_FADE_PIXELS[0]) / (EXTENT_FADE_PIXELS[1] - EXTENT_FADE_PIXELS[0])));
        alpha *= t * t * (3 - 2 * t);
        if (fadeOutM) {
          // The whole bank fades out as the view's half-width at its origin narrows, evenly in its logarithm; faded out it
          // neither draws nor projects.
          const { widthPixels, heightPixels, focalPixels } = publication.viewport;
          const halfWidthM = distanceM * (widthPixels && heightPixels && focalPixels > 0 ? Math.hypot(widthPixels, heightPixels) / 2 / focalPixels : halfWidthPerDistance);
          alpha *= Math.max(0, Math.min(1, Math.log(halfWidthM / fadeOutM[1]) / Math.log(fadeOutM[0] / fadeOutM[1])));
        }
      }
      const display = alpha > 0 ? '' : 'none';
      // The bank dims by its strokes' opacity, which its paths inherit. A group's own opacity is an offscreen pass on every
      // repaint of the shared layer: dragging the Milky Way on the iPad, 50 frames in 211 ran over 20 ms with the main
      // bank's 0.6 on its group and 17 to 25 with it on the strokes (2026-10-03). A dot's alpha was already its stroke's,
      // so the dimming now behaves the same way: where two dots of different colours overlap, both show through.
      // The property is inherited, so each change restyles the bank's paths: about 1 ms a frame for 2,000 paths on the
      // iPad while a bank fades, which is what the group's pass cost there; a bank at a steady opacity pays nothing.
      writeStyle(root, 'strokeOpacity', String(alpha));
      if (root.style.display !== display) {
        root.style.display = display;
        if (display === '' && runtime) revealLayers(runtime.layers);
      }
      if (!(alpha > 0)) { runtime?.hide(); return; }
      latest = publication;
      const { widthPixels, heightPixels, focalPixels } = publication.viewport;
      if (widthPixels && heightPixels && focalPixels > 0) halfWidthPerDistance = Math.hypot(widthPixels, heightPixels) / 2 / focalPixels;
      if (runtime) { runtime.publish(publication); return; }
      if (loading) return;
      loading = true;
      // A body's first view does not draw the background dots: they wait for it to be interactive (startup-gate.ts).
      afterStartup(host.ownerDocument.defaultView, () => { if (!destroyed) void loadBank(url).then(value => {
        if (destroyed) return;
        const bank = parseCataloguePoints(value, url);
        extent = { originM: bank.frame.originM, radiusM: Math.max(...bank.points.map(point => Math.hypot(...point.positionUnits))) * bank.frame.metersPerUnit };
        const fadeOut = bank.appearance.fadeOutUnits;
        fadeOutM = fadeOut ? [fadeOut[0] * bank.frame.metersPerUnit, fadeOut[1] * bank.frame.metersPerUnit] : null;
        // One style object per palette entry (a color at one radius): the projection asks for a style per point on every
        // frame. An entry's alpha byte scales the bank's opacity.
        // A world place as the bank would have stored it, compared axis by axis with every point. The bank's frame is
        // unrotated here or no place is hidden: a rotated bank (a galaxy's own dots) is never asked for one.
        const [qx, qy, qz, qw] = bank.frame.localToReferenceXyzw, unrotated = qx === 0 && qy === 0 && qz === 0 && qw === 1;
        const stored = (meters: number, axis: number) => Math.round((meters - bank.frame.originM[axis]!) / bank.frame.metersPerUnit * 1e4) / 1e4;
        placeKey = positionM => !unrotated ? null : positionM.map((value, axis) => stored(value, axis)).join(',');
        const styleKey = (point: { colorCss: string; radiusPx: number }) => `${point.colorCss}|${point.radiusPx}`;
        const styles = new Map([...new Map(bank.points.map(point => [styleKey(point), point] as const)).entries()].map(([key, { colorCss: color, radiusPx }]) =>
          [key, { colorCss: color.slice(0, 7), radiusPx,
            opacity: bank.appearance.opacity * (color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1) }] as const));
        // Zooming out draws a smaller share of the catalogue, always a prefix of its prepared order (sparse places first,
        // crowds last): points leave and return as the camera moves, and none is swapped for another. From outside the
        // bank's reach the share is also capped by how many dots its projected shape holds.
        const drawn = (distanceUnits: number, cameraUnits: VolumeVector) => Math.min(bank.appearance.levels
          ? stackedPointCount(bank.appearance.levels, distanceUnits, distanceUnits * halfWidthPerDistance, bank.frame.metersPerUnit)
          : drawnPointCount(bank.points.length, distanceUnits * bank.frame.metersPerUnit,
            bank.appearance.fullDetailUnits === undefined ? undefined : bank.appearance.fullDetailUnits * bank.frame.metersPerUnit),
          screenPointCount(bank.spread, cameraUnits, latest?.viewport.focalPixels ?? 0, bank.appearance.outsidePixelsPerDot));
        // Past its screen budget a bank draws an even share of its visible dots, set from the last frame's count. An inner
        // level with its own budget moves the bank's to it as the level appears, evenly in the logarithm of the half-width.
        // The levels spend it in order, outermost first: an arriving level takes what the ones already on screen leave, so
        // zooming in never thins the dots the view is already steered by.
        const budget = bank.appearance.screenBudget;
        const budgetAt = (distanceUnits: number) => {
          let value = budget!;
          const halfWidth = distanceUnits * halfWidthPerDistance;
          for (const level of bank.appearance.levels ?? []) {
            const window = (level as { appearUnits?: readonly [number, number] }).appearUnits;
            if (level.screenBudget === undefined || !window) continue;
            const t = Math.max(0, Math.min(1, Math.log(window[0] / halfWidth) / Math.log(window[0] / window[1])));
            value = value * (level.screenBudget / value) ** t;
          }
          return value;
        };
        const distanceOf = (publication: VolumeCameraPublication) =>
          eyeDistanceM(publication.world.pose, bank.frame.originM) / bank.frame.metersPerUnit;
        // A level's exact repaint after a pause measures the view the camera stopped at: the shares are recomputed from it and
        // published once more, so a still view keeps the same dots however the frames before it were paced.
        const settled = () => { if (latest && runtime) { runtime.publish(latest); runtime.publish(latest); } };
        const part = (points: typeof bank.points, cellOf: Int32Array, count: (total: number) => number, share: () => number, paintGroup?: number) => ({ points,
          ...(paintGroup === undefined ? {} : { paintGroup }),
          cells: { boxes: bank.cells.boxes, of: cellOf },
          drawnCount: (distanceUnits: number, cameraUnits: VolumeVector) => count(drawn(distanceUnits, cameraUnits)),
          ...(budget === undefined ? {} : { keepFraction: share }),
          hidden: hiddenIn(points),
          // One path per color unions its dots, so two translucent dots of one color that overlap do not add up; a part
          // keeps a path only for the colors its own dots use.
          paintPalette: [...new Set(points.map(styleKey))].map(key => pointPaint(styles.get(key)!)),
          stylePoint: (point: (typeof bank.points)[number]) => styles.get(styleKey(point))! });
        const local = occluder && { normal: toLocalAxes(bank.frame.localToReferenceXyzw, occluder.normal), radiusUnits: occluder.radiusM / bank.frame.metersPerUnit,
          centreUnits: toLocalAxes(bank.frame.localToReferenceXyzw, occluder.centreM.map((value, axis) => (value - bank.frame.originM[axis]!) / bank.frame.metersPerUnit)) };
        const mount = (parts: ReturnType<typeof part>[]) => mountBatchedSpatialPoints({ host: slot, frame: bank.frame, parts,
          onSettle: settled, className: `catalogue-points-${bank.id}`, ...(local ? { occluder: local } : {}) });
        // Each level draws as its own part: it dims to its near opacity as the innermost level fills, and takes its share
        // of the budget after the levels outside it. The levels share one field, so they are one layer (batched-spatial-points.ts).
        const levels = bank.appearance.levels ?? [];
        let start = 0;
        const shares = levels.map(level => { const entry = { start, points: level.points, nearOpacity: level.nearOpacity ?? 1, share: 1 }; start += level.points; return entry; });
        const rebudget = (candidates: readonly number[], distanceUnits: number, entries: { share: number }[]) => {
          if (budget === undefined) return;
          let left = budgetAt(distanceUnits);
          candidates.forEach((count, index) => {
            entries[index]!.share = count > left ? Math.max(0, left) / count : 1;
            left -= count * entries[index]!.share;
          });
        };
        if (shares.length < 2) {
          const whole = { share: 1 }, single = mount([part(bank.points, bank.cells.of, total => total, () => whole.share)]);
          runtime = { layers: [single.root], publish(publication) { single.publish(publication); rebudget([single.stats().candidates], distanceOf(publication), [whole]); }, hide: single.hide, destroy: single.destroy };
        } else {
          const innermost = levels[levels.length - 1] as { appearUnits?: readonly [number, number] };
          const field = mount(shares.map(entry => part(bank.points.slice(entry.start, entry.start + entry.points), bank.cells.of.subarray(entry.start, entry.start + entry.points),
            // Levels with the same near opacity dim together, so they share their paths (batched-spatial-points.ts).
            total => Math.max(0, Math.min(entry.points, total - entry.start)), () => entry.share, entry.nearOpacity)));
          runtime = { layers: [field.root], publish(publication) {
            const distanceUnits = distanceOf(publication);
            const [from, to] = innermost.appearUnits ?? [1, 1];
            const filled = from > to ? Math.max(0, Math.min(1, Math.log(from / (distanceUnits * halfWidthPerDistance)) / Math.log(from / to))) : 0;
            shares.forEach((entry, index) => {
              const group = field.parts[index]!.group, opacity = String(1 - (1 - entry.nearOpacity) * filled);
              writeStyle(group, 'opacity', opacity);
            });
            field.publish(publication);
            rebudget(field.parts.map(entry => entry.stats().candidates), distanceUnits, shares);
          }, hide: field.hide, destroy: field.destroy };
        }
        root.dataset.cataloguePoints = bank.id;
        if (root.style.display !== 'none') revealLayers(runtime.layers);
        if (latest) runtime.publish(latest);
      }).catch(error => { root.dataset.cataloguePoints = 'failed'; console.error(`Catalogue points ${url} failed`, error); }); });
    },
    destroy() { if (destroyed) return; destroyed = true; runtime?.destroy(); slot.release(); },
  });
}
