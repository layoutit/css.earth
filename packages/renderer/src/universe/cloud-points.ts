import { presentPhysicalPoseInVolume, cssCameraAxesFromOrientation } from '@cssearth/engine';
import type { PreparedCloudPoints } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';
import { readPrepared } from '../prepared-data-worker-client.js';
import { readPreparedHere } from '../prepared-data/readers.js';
import { cloudOverlayReader, type CloudOverlayData } from './cloud-overlay-reader.js';
import { createCloudSegments } from './cloud-segments.js';
import { retainedStyle, type CloudOverlayLayer } from './cloud-overlay-layer.js';
import { OCCLUDED_FLOOR, occluderDepth } from './cloud-occluder.js';

/** The camera has rested this long (ms) when billboards are put in order, far to near. */
const REST_MS = 350;
/** A failed overlay read is tried again on a later publication, waiting RETRY_MS, then twice as long, up to RETRIES times. */
const RETRY_MS = 2000, RETRIES = 4;
/** The sine of the angle above a disc below which a view runs along it. */
const GRAZING = .35;
/** The cosine to the drawn direction past which the view counts as opposite it (about 6 degrees), and the catch-up after it, in degrees. */
const OPPOSITE_COSINE = -.995, ROLL_CATCH_UP = 6;

/**
 * A billboard's screen roll from the camera's axes `r` (rows right, down and back, columns the frame): the drawn right axis carried by
 * the least rotation from the drawn view direction to this one, then read on screen. A camera spin about its view axis turns it by the
 * spin; an orbit adds only the small geometric change. Null where the view lies opposite the drawn direction, which has no such rotation.
 */
export function cellRollDegrees(right: readonly [number, number, number], up: readonly [number, number, number], r: ArrayLike<number>): number | null {
  const normal = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
  const back = [r[2]!, r[5]!, r[8]!], cosine = normal[0]! * back[0]! + normal[1]! * back[1]! + normal[2]! * back[2]!;
  if (cosine < OPPOSITE_COSINE) return null;
  // Rodrigues with axis normal × back: right + axis × right + axis × (axis × right) / (1 + cosine).
  const axis = [normal[1]! * back[2]! - normal[2]! * back[1]!, normal[2]! * back[0]! - normal[0]! * back[2]!, normal[0]! * back[1]! - normal[1]! * back[0]!];
  const first = [axis[1]! * right[2] - axis[2]! * right[1], axis[2]! * right[0] - axis[0]! * right[2], axis[0]! * right[1] - axis[1]! * right[0]];
  const second = [axis[1]! * first[2]! - axis[2]! * first[1]!, axis[2]! * first[0]! - axis[0]! * first[2]!, axis[0]! * first[1]! - axis[1]! * first[0]!];
  const carried = [0, 1, 2].map(k => right[k]! + first[k]! + second[k]! / (1 + cosine));
  return Math.atan2(r[1]! * carried[0]! + r[4]! * carried[1]! + r[7]! * carried[2]!, r[0]! * carried[0]! + r[3]! * carried[1]! + r[6]! * carried[2]!) * 180 / Math.PI;
}

/**
 * A dataset's overlay bank (`prepared/<id>.bin`, read by the data worker: cloud-overlay-reader.ts), drawn over its image
 * layers: billboards (createCloudPoints) or lines (cloud-segments.ts). Its owner holds its membership. The layer is built
 * off the page and attached while it shows, detached when it stops showing: a hidden overlay is never mounted. Neither
 * happens while the camera coasts (`setCoasting`): only transform and opacity change then, and membership waits for the
 * coast to end. A read that fails is tried again; destroyed before its bank arrives, it never mounts.
 */
export function mountCloudOverlay({ host, before, behind, url, resolveResource }: { host: HTMLElement; before?: Node | null; /** Where billboards behind a bank's `behindPlane` are drawn. */ behind?: () => Node | null; url: string; resolveResource(path: string): string }) {
  const doc = host.ownerDocument, window = doc.defaultView!;
  let layer: CloudOverlayLayer | null = null, rootStyle: ReturnType<typeof retainedStyle> | null = null, backStyle: ReturnType<typeof retainedStyle> | null = null, attached = false, coasting = false, destroyed = false;
  let latest: { publication: VolumeCameraPublication; opacity: number } | null = null, loading = false, failures = 0, retryAt = 0;
  let rest: ReturnType<typeof setTimeout> | null = null, retiring = false;
  function destroy() { destroyed = true; if (rest) clearTimeout(rest); layer?.root.remove(); layer?.backRoot?.remove(); attached = false; layer = null; }
  const read = (): Promise<CloudOverlayData> => typeof Worker === 'undefined'
    ? readPreparedHere(cloudOverlayReader.kind, url, (input, init) => window.fetch(input, init)).then(reading => reading.value as CloudOverlayData)
    : readPrepared<CloudOverlayData>(cloudOverlayReader.kind, url);
  function load() {
    loading = true;
    read().then(data => {
      loading = false;
      if (destroyed) return;
      layer = data.kind === 'points' ? createCloudPoints({ host, cloud: data.points, resolveResource }) : createCloudSegments({ host, lines: data.lines });
      rootStyle = retainedStyle(layer.root); backStyle = layer.backRoot ? retainedStyle(layer.backRoot) : null;
      apply();
    }, (error: unknown) => {
      loading = false; failures++; retryAt = Date.now() + RETRY_MS * 2 ** (failures - 1);
      console.warn(`Overlay ${url} could not be read (attempt ${failures} of ${RETRIES}).`, error);
    });
  }
  function settle() {
    if (rest) clearTimeout(rest);
    rest = setTimeout(() => { rest = null; if (destroyed || !attached) return; if (coasting) { settle(); return; } layer?.atRest?.(); }, REST_MS);
  }
  function apply() {
    if (destroyed || !layer || !latest) return;
    if (latest.opacity > 0) {
      if (!attached) { if (coasting) return; host.insertBefore(layer.root, before ?? null); if (layer.backRoot) host.insertBefore(layer.backRoot, behind?.() ?? null); attached = true; }
      // the layer's opacity in steps of 1/64: a fading bank writes it each frame otherwise
      rootStyle!.opacity(String(Math.round(Math.min(1, latest.opacity) * 64) / 64)); backStyle?.opacity(String(Math.round(Math.min(1, latest.opacity) * 64) / 64));
      layer.place(latest.publication);
      settle();
    } else if (attached) {
      if (coasting) { rootStyle!.opacity('0'); backStyle?.opacity('0'); return; }
      layer.root.remove(); layer.backRoot?.remove(); attached = false;
    }
  }
  return {
    publish(publication: VolumeCameraPublication, opacity: number) {
      if (retiring) return;
      latest = { publication, opacity };
      if (!layer && !loading && !destroyed && opacity > 0 && failures < RETRIES && Date.now() >= retryAt) load();
      apply();
    },
    /** While the camera coasts nothing is attached or detached; when it stops, what the last publication asked for is,
     * and an overlay retired meanwhile is taken away. */
    setCoasting(active: boolean) { coasting = active; if (!active) { if (retiring) destroy(); else apply(); } },
    /** Taken away as its dataset gives way to another: at once, or, while the camera coasts, cleared to opacity 0 and
     * taken away when the coast ends. */
    retire() { if (coasting && attached) { retiring = true; rootStyle!.opacity('0'); backStyle?.opacity('0'); } else destroy(); },
    destroy,
  };
}

/**
 * Cloud points (@cssearth/objects cloud-points.ts) as billboards: one element a cluster, its atlas cell (a prepared file
 * found through `resolveResource`, as every published asset has its own address) as its background, placed each
 * publication at its centre's place on screen, as wide as its cluster at that distance, and dimmed by how deep its sight
 * line passes through the occluder's ellipsoids. Placing writes only transform and opacity, and only when they change;
 * the order, far to near, is set once the camera rests (`atRest`).
 */
export function createCloudPoints({ host, cloud, resolveResource }: { host: HTMLElement; cloud: PreparedCloudPoints; resolveResource(path: string): string }): CloudOverlayLayer {
  const doc = host.ownerDocument, depthThrough = occluderDepth(cloud.occluder), cell = cloud.cellTexels;
  const root = doc.createElement('div'); root.className = 'prepared-cloud-points'; root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
  root.dataset.cloudPoints = String(cloud.count);
  const atlas = resolveResource(cloud.atlas);
  const plane = cloud.behindPlane, backRoot = plane ? root.cloneNode(false) as HTMLElement : undefined;
  if (backRoot) { backRoot.className += ' prepared-cloud-points-behind'; }
  // Opposite the drawn direction no least rotation exists: the roll holds, then catches up at most ROLL_CATCH_UP a publication.
  let heldRoll: number | null = null, catching = false;
  const stepRoll = (target: number | null) => {
    if (target === null) { catching = heldRoll !== null; return heldRoll ?? 0; }
    if (heldRoll === null || !catching) { heldRoll = target; return target; }
    const gap = ((target - heldRoll + 540) % 360) - 180;
    if (Math.abs(gap) <= ROLL_CATCH_UP) { catching = false; heldRoll = target; return target; }
    heldRoll += Math.sign(gap) * ROLL_CATCH_UP; return heldRoll;
  };
  let order = '', eye: readonly [number, number, number] = [0, 0, 0];
  const boards = Array.from({ length: cloud.count }, (_, index) => {
    const el = doc.createElement('div');
    el.style.cssText = `position:absolute;left:0;top:0;width:${cell}px;height:${cell}px;background:url("${atlas}") -${cloud.cells[index * 2]}px -${cloud.cells[index * 2 + 1]}px no-repeat;transform-origin:50% 50%;will-change:transform,opacity`;
    root.append(el); return { el, style: retainedStyle(el), index, depth: 0 };
  });
  /** Seen along a thin disc, its far half lies behind the near half: there a billboard beyond the disc's centre is drawn behind the volume. */
  const isBehind = (i: number) => {
    const to = [eye[0] - plane!.pointUnits[0], eye[1] - plane!.pointUnits[1], eye[2] - plane!.pointUnits[2]], length = Math.hypot(to[0]!, to[1]!, to[2]!), n = plane!.normalUnits;
    if (Math.abs(to[0]! * n[0] + to[1]! * n[1] + to[2]! * n[2]) / length > GRAZING) return false;
    return (cloud.positions[i * 3]! - plane!.pointUnits[0]) * to[0]! + (cloud.positions[i * 3 + 1]! - plane!.pointUnits[1]) * to[1]! + (cloud.positions[i * 3 + 2]! - plane!.pointUnits[2]) * to[2]! < 0;
  };
  return {
    root, ...(backRoot ? { backRoot } : {}),
    place(publication) {
      const local = presentPhysicalPoseInVolume(publication.world.pose, cloud.frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
      eye = local.positionUnits as readonly [number, number, number]; const [px, py, pz] = local.positionUnits, focal = publication.viewport.focalPixels, [ox, oy] = publication.viewport.principalOffsetPixels;
      const w = (publication.viewport.widthPixels ?? host.clientWidth) / 2, h = (publication.viewport.heightPixels ?? host.clientHeight) / 2;
      // A cell keeps the twist it was drawn with, and only the twist: orbiting turns it through the least rotation, not its axis's projection.
      const a = cloud.cellAxesUnits, roll = a ? ` rotate(${stepRoll(cellRollDegrees(a.right, a.up, r)).toFixed(2)}deg)` : '';
      for (const board of boards) {
        const i = board.index, x = cloud.positions[i * 3]! - px, y = cloud.positions[i * 3 + 1]! - py, z = cloud.positions[i * 3 + 2]! - pz;
        const depth = -(r[2] * x + r[5] * y + r[8] * z); board.depth = depth;
        if (depth <= 0) { board.style.opacity('0'); continue; }
        const sx = focal * (r[0] * x + r[3] * y + r[6] * z) / depth + ox + w, sy = focal * (r[1] * x + r[4] * y + r[7] * z) / depth + oy + h;
        const size = cloud.diameters[i]! * focal / depth / cell, planar = cloud.planarCells && i >= cloud.planarCells.from ? cloud.planarCells : null;
        // A flat cell's edges as this camera sees them: exact for a patch in the plane, up to perspective across the patch.
        const shape = planar ? `matrix(${[r[0] * planar.right[0] + r[3] * planar.right[1] + r[6] * planar.right[2], r[1] * planar.right[0] + r[4] * planar.right[1] + r[7] * planar.right[2], -(r[0] * planar.up[0] + r[3] * planar.up[1] + r[6] * planar.up[2]), -(r[1] * planar.up[0] + r[4] * planar.up[1] + r[7] * planar.up[2])].map(v => (v * size).toFixed(4)).join()},0,0)` : `scale(${size.toFixed(4)})${roll}`;
        board.style.transform(`translate3d(${(sx - cell / 2).toFixed(1)}px,${(sy - cell / 2).toFixed(1)}px,0) ${shape}`);
        board.style.opacity((1 - (1 - OCCLUDED_FLOOR) * depthThrough(px, py, pz, x, y, z)).toFixed(3));
      }
    },
    atRest() {
      const sorted = [...boards].sort((a, b) => b.depth - a.depth), key = sorted.map(board => plane && isBehind(board.index) ? '-' + board.index : board.index).join();
      if (key !== order) { order = key; for (const board of sorted) (plane && isBehind(board.index) ? backRoot! : root).append(board.el); }
    },
  };
}
