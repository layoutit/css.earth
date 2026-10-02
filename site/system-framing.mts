import { eyeDistanceM } from '@cssearth/engine';
import { cross3 as cross } from '@cssearth/core';
import type { WorldRotation } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { PreparedWorldCameraFrame } from '@cssearth/objects';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { PreparedWorldContext } from '@cssearth/objects';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { MapViewport } from './minimap/surface-map-context.mts';
type Optics = ReturnType<ObjectWorldNavigation['optics']>;
type FramingFrame = Pick<PreparedWorldCameraFrame, 'referenceFrame' | 'epochJdTt' | 'originM' | 'bodyRadiusM'>;
interface FramingCandidate { originM?: PositionM; minimumM: PositionM; maximumM: PositionM; cameraToReference: readonly number[]; }
interface SystemView { readonly candidates: readonly FramingCandidate[]; }
const tuple = (map: (axis: number) => number): PositionM => [map(0), map(1), map(2)];
import galaxy from '../src/objects/milky-way-volume/object.json' with { type: 'json' };
import datasetVolumes from './prepared-dataset-volumes.json' with { type: 'json' };
import localGroupGalaxies from './prepared-local-group-galaxies.json' with { type: 'json' };
import { SYSTEM_FRAMING_ANGLES, SYSTEM_FRAMING_PADDING_PIXELS } from './runtime-policy.mts';
import { systemFramingRadii } from './system-framing-radii.mts';
export { systemFramingRadii } from './system-framing-radii.mts';
import { cssCameraAxesFromOrientation, cssViewFromOrientation, rotateWorldPosition, worldQuaternionFromRotation, worldRotationFromQuaternion } from '@cssearth/renderer/navigation';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';
import { readApplicationSystemView } from './world-system-views.mts';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';

/** Each bound pair's centre of mass and the separation of its stars: what the camera aims at once it is far enough out to
 * see both. The system keeps its star's framing, which is the planet orbits around it. */
export function systemCenters(plan: Pick<PreparedWorldContext, 'bodies' | 'focus'>) {
  const hosts = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  return new Map(plan.bodies.flatMap(body => {
    const host = body.boundTo ? hosts.get(body.boundTo.hostId) : undefined;
    return host && body.boundTo ? [[body.boundTo.hostId, { centerM: body.boundTo.centerM as PositionM,
      separationM: Math.hypot(...body.positionM.map((value, axis) => value - host.positionM[axis]!)) }] as const] : [];
  }));
}

/** Each system host's framing radius. A system whose file the page has not read keeps the radius preparation measured
 * over the whole world (site/build/prepare/prepare-world-presentation.mts); the rest are measured here from the same
 * prepared bounds, so a page has every system's radius before it reads that system. */
export const SYSTEM_FRAMING_RADII: ReadonlyMap<string, number> = new Map([...PREPARED_WORLD_PRESENTATION.systemFramingRadii, ...systemFramingRadii(context)]);
export const SYSTEM_CENTERS = systemCenters(context);
/** Systems of other stars: placed stars, which have no orbit of their own, that planets orbit. They are reached from light
 * years away, where a turn out of edge-on reads as an approach; the Sun's and a planet's moons keep the departure angle. */
export const STELLAR_SYSTEMS: ReadonlySet<string> = new Set(context.bodies.filter(body => body.systemView && !body.orbit).map(body => body.id));
/** System overview camera candidates by host, each added when `loadSystemView` reads it; navigation awaits the one it frames. */
export const SYSTEM_VIEWS = new Map<string, SystemView>();
/** Hosts whose overview is framed by prepared candidates. */
export const SYSTEM_VIEW_HOSTS: ReadonlySet<string> = new Set([context.focus, ...context.bodies].filter(body => body.systemView).map(body => body.id));
/** Whether framing `id` can proceed: it is no system host, or its candidates are read. */
export const systemViewLoaded = (id: string) => !SYSTEM_VIEW_HOSTS.has(id) || SYSTEM_VIEWS.has(id);
const systemViewsLoading = new Map<string, Promise<void>>();
/** Read one host's candidates once; a failed read is forgotten so the next navigation retries it. */
export function loadSystemView(id: string, read?: (id: string) => Promise<unknown>): Promise<void> {
  if (systemViewLoaded(id)) return Promise.resolve();
  let loading = systemViewsLoading.get(id);
  if (!loading) {
    loading = readApplicationSystemView(id, read).then(view => { SYSTEM_VIEWS.set(id, view); })
      .catch(error => { systemViewsLoading.delete(id); throw error; });
    systemViewsLoading.set(id, loading);
  }
  return loading;
}
/** A host's authored orbit range: its system overview never places the camera beyond the distance its orbits are drawn to. */
export const SYSTEM_RANGES = new Map(context.bodies.flatMap(body => 'orbitsWithinM' in body && body.orbitsWithinM !== undefined ? [[body.id, body.orbitsWithinM] as const] : []));
export const GALACTIC_VOLUME = parseDensityVolumeFrame(galaxy.properties.volume);
/** Volumes a body shows through one of its datasets, by volume id, each with the object it is the extent of when it
 * names one (site/build/prepare/prepare-catalog.mts). */
export const DATASET_VOLUMES: ReadonlyMap<string, { readonly frame: DensityVolumeFrame; readonly host?: string }> = new Map(
  Object.entries(datasetVolumes).map(([id, bank]) => {
    const host: unknown = 'host' in bank ? bank.host : undefined;
    if (host !== undefined && typeof host !== 'string') throw new TypeError(`site/prepared-dataset-volumes.json: ${id}.host must be an object id.`);
    return [id, { frame: parseDensityVolumeFrame(bank.frame), ...(host === undefined ? {} : { host }) }];
  }));

/** The Local Group as the universe draws it: the Milky Way's volume and the other galaxies the Local Group catalogue draws,
 * each a sphere of its recipe focus radius (site/build/prepare/prepare-catalog.mts), in one box in reference axes. */
const DRAWN_GALAXIES_BOX = (() => {
  const rotation = worldRotationFromQuaternion(GALACTIC_VOLUME.localToReferenceXyzw), { min, max } = GALACTIC_VOLUME.boundsUnits;
  const galaxy = [0, 1, 2, 3, 4, 5, 6, 7].map(corner => {
    const offset = rotateWorldPosition(rotation, tuple(axis => ((corner >> axis) & 1 ? max : min)[axis]! * GALACTIC_VOLUME.metersPerUnit));
    return tuple(axis => GALACTIC_VOLUME.originM[axis]! + offset[axis]);
  });
  const members = Object.entries(localGroupGalaxies as Record<string, { originM: unknown; radiusM: unknown }>).flatMap(([id, { originM, radiusM }]) => {
    if (!Array.isArray(originM) || originM.length !== 3 || !originM.every(Number.isFinite) || typeof radiusM !== 'number' || !(radiusM > 0)) {
      throw new TypeError(`prepared-local-group-galaxies.json: ${id} needs an origin of three numbers and a positive radius.`);
    }
    return [-1, 1].flatMap(sign => [0, 1, 2].map(axis => tuple(index => (originM[index] as number) + (index === axis ? sign * radiusM : 0))));
  });
  const corners = [...galaxy, ...members];
  const minimum = tuple(axis => Math.min(...corners.map(corner => corner[axis]!))), maximum = tuple(axis => Math.max(...corners.map(corner => corner[axis]!)));
  const centre = tuple(axis => (minimum[axis] + maximum[axis]) / 2);
  return { centre, candidate: { minimumM: tuple(axis => minimum[axis] - centre[axis]), maximumM: tuple(axis => maximum[axis] - centre[axis]),
    cameraToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1] } };
})();

/** Fit a box in reference axes at the current viewing angle, centred on it. */
function boxZoomTarget(from: WorldCameraPose, box: { centre: PositionM; candidate: FramingCandidate }, optics: Optics, rect: MapViewport) {
  const frame = { referenceFrame: from.referenceFrame, epochJdTt: from.epochJdTt, originM: box.centre, bodyRadiusM: 0 };
  return { world: systemViewTarget(from, frame, optics, { candidates: [box.candidate] }, rect), focusPositionM: box.centre };
}

/** Fit the drawn galaxies (the Milky Way's volume and the Local Group catalogue's galaxies) at the current viewing angle, centred on them: an overview's `zoom.frame` {fit: drawn-galaxies}. */
export function drawnGalaxiesZoomTarget(from: WorldCameraPose, optics: Optics, rect: MapViewport) {
  return boxZoomTarget(from, DRAWN_GALAXIES_BOX, optics, rect);
}

/** Each classification's prepared box (site/build/prepare/prepare-world-presentation.mts prepareCategoryFrames), in the world's
 * Sun-centred reference axes: what its header pill frames. */
export const CATEGORY_FRAMES: ReadonlyMap<string, { centre: PositionM; candidate: FramingCandidate }> = new Map([...PREPARED_WORLD_PRESENTATION.categoryFrames]
  .map(([classification, frame]) => [classification, { centre: [...frame.centreM], candidate: { minimumM: [...frame.minimumM], maximumM: [...frame.maximumM],
    cameraToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1] } }]));

/** Fit one classification's members at the current viewing angle, centred on them; null when it has no prepared box. */
export function categoryZoomTarget(classification: string, from: WorldCameraPose, optics: Optics, rect: MapViewport) {
  const box = CATEGORY_FRAMES.get(classification);
  return box ? boxZoomTarget(from, box, optics, rect) : null;
}

/** Fit the volume along the current viewing ray, keeping its anchor and orientation. */
export function volumeZoomTarget(from: WorldCameraPose, volume: DensityVolumeFrame, optics: Optics, rect: MapViewport, referencePositionM: PositionM) {
  const range = eyeDistanceM(from.pose, referencePositionM);
  const [ox, oy] = (optics.principalOffsetPixels ?? [0, 0]), focal = optics.focalPixels;
  const ray = [ox / focal, oy / focal, 1];
  const depth = range / Math.hypot(...ray);
  const offset = rotateWorldPosition(cssCameraAxesFromOrientation(from.pose.orientationXyzw), tuple(axis => ray[axis] * depth));
  const focusPositionM = tuple(axis => from.pose.positionM[axis] - offset[axis]);
  const world = systemViewTarget(from, { ...volume, originM: focusPositionM, bodyRadiusM: 0 }, optics, { candidates: [{
    originM: volume.originM,
    minimumM: tuple(axis => volume.boundsUnits.min[axis] * volume.metersPerUnit),
    maximumM: tuple(axis => volume.boundsUnits.max[axis] * volume.metersPerUnit),
    cameraToReference: worldRotationFromQuaternion(volume.localToReferenceXyzw),
  }] }, rect);
  return { world, focusPositionM };
}

/** The same scale boundary governs both the system arrival and the card handoff. */
export function systemOverviewDistance(bodyRadiusM: number, systemRadiusM: number, optics: Pick<Optics, "focalPixels" | "framingRadiusPixels">) {
  return Math.sqrt(systemRadiusM * bodyRadiusM) * Math.hypot(1, optics.focalPixels / optics.framingRadiusPixels);
}

/** The scene stays centered; the fit respects the shell around that center. */
export function systemFramingRect(optics: Optics, documentTarget?: Document) {
  const width = optics.widthPixels ?? optics.framingRadiusPixels * 2;
  const height = optics.heightPixels ?? optics.framingRadiusPixels * 2;
  const rect = { ...(optics.visibleRect ?? { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 }) };
  const stage = documentTarget?.querySelector?.('.object-stage')?.getBoundingClientRect();
  if (stage && documentTarget) {
    const cx = stage.left + stage.width / 2, cy = stage.top + stage.height / 2;
    // Read once on selection, never in the animation loop.
    // On tablets the pill row rides the sheet's top edge, level with the search, over the scene. (The search box itself sits
    // left of centre there, where this reading would take it for a sidebar.)
    for (const selector of ['.object-sidebar', '.explorer-shell-header', '.object-footer', '.object-search-categories']) {
      const box = documentTarget.querySelector(selector)?.getBoundingClientRect();
      if (!box || !box.width || !box.height) continue;
      if (box.right < cx) rect.left = Math.max(rect.left, box.right - cx);
      else if (box.bottom <= cy) rect.top = Math.max(rect.top, box.bottom - cy);
      else if (box.top >= cy) rect.bottom = Math.min(rect.bottom, box.top - cy);
    }
  }
  const padding = Math.min(SYSTEM_FRAMING_PADDING_PIXELS, (rect.right - rect.left) / 8, (rect.bottom - rect.top) / 8,
    -rect.left / 2, rect.right / 2, -rect.top / 2, rect.bottom / 2);
  return { left: rect.left + padding, right: rect.right - padding,
    top: rect.top + padding, bottom: rect.bottom - padding };
}

/** Keep the departure angle (opened out of edge-on for another star's system) and fit the prepared system around its new center. */
export function systemViewTarget(from: WorldCameraPose, frame: FramingFrame, optics: Optics, view: SystemView, rect: MapViewport, minimumRangeM = 0, openEdgeOn = false, maximumRangeM = Number.POSITIVE_INFINITY): WorldCameraPose {
  if (from.referenceFrame !== frame.referenceFrame || from.epochJdTt !== frame.epochJdTt) {
    throw new TypeError('System selection requires a common frame and epoch.');
  }
  if (!(rect.left < 0 && rect.right > 0 && rect.top < 0 && rect.bottom > 0)) {
    throw new TypeError('System framing must leave room around the scene center.');
  }
  const orientationXyzw = openEdgeOn ? openedOrientation(from.pose.orientationXyzw, view) : [...from.pose.orientationXyzw] as [number, number, number, number];
  // Screen offsets and prepared corners meet in CSS camera axes (+y down).
  const cameraToReference = cssCameraAxesFromOrientation(orientationXyzw);
  const referenceToCamera = cssViewFromOrientation(orientationXyzw);
  // Each prepared box encloses the complete system. Project their eight corners
  // at the current angle and use the tightest fit; none dictates a camera turn.
  const depth = Math.min(maximumRangeM, ...view.candidates.map(candidate =>
    fitSystemDepth(frame, optics, candidate, rect, minimumRangeM, referenceToCamera)));
  if (!Number.isFinite(depth)) throw new TypeError('System framing requires prepared bounds.');
  const [ox, oy] = (optics.principalOffsetPixels ?? [0, 0]), focal = optics.focalPixels;
  const offset = rotateWorldPosition(cameraToReference, [ox / focal * depth, oy / focal * depth, depth]);
  return { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: tuple(axis => frame.originM[axis] + offset[axis]),
      orientationXyzw, focusOffset: { originM: frame.originM, offsetM: offset } } };
}

/** The departure angle, unless it sees the orbits nearly edge-on: a transiting system seen from the Sun is a line. Such a
 * view turns about its own horizontal axis until it stands at the shallowest prepared elevation above the orbital plane. */
function openedOrientation(orientationXyzw: readonly number[], view: SystemView): [number, number, number, number] {
  const current = [...orientationXyzw] as [number, number, number, number];
  // Every prepared candidate's right axis lies in the orbital plane, so two of them give its normal. A single box (the
  // galactic volume) has no plane.
  const right = (candidate: FramingCandidate): PositionM => tuple(axis => candidate.cameraToReference[axis * 3]!);
  const first = view.candidates[0];
  if (!first || view.candidates.length < 2) return current;
  const normal = view.candidates.slice(1).map(candidate => cross(right(first), right(candidate)))
    .reduce((best, value) => Math.hypot(...value) > Math.hypot(...best) ? value : best);
  const length = Math.hypot(...normal);
  if (!(length > 1e-6)) return current;
  const n = tuple(axis => normal[axis]! / length);
  const rotation = worldRotationFromQuaternion(current);
  const back: PositionM = [rotation[2]!, rotation[5]!, rotation[8]!];
  const sine = back[0] * n[0] + back[1] * n[1] + back[2] * n[2];
  const minimum = Math.min(...SYSTEM_FRAMING_ANGLES.elevationsDegrees) * Math.PI / 180;
  const elevation = Math.asin(Math.min(1, Math.abs(sine)));
  if (elevation >= minimum - 1e-9) return current;
  // Turn the eye direction toward the side of the plane it already looks from (north when exactly edge-on).
  const toward = sine < 0 ? tuple(axis => -n[axis]!) : n;
  const axisVector = cross(back, toward), axisLength = Math.hypot(...axisVector);
  const [kx, ky, kz] = tuple(axis => axisVector[axis]! / axisLength);
  const angle = minimum - elevation, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const turn = [t * kx * kx + c, t * kx * ky - s * kz, t * kx * kz + s * ky,
    t * kx * ky + s * kz, t * ky * ky + c, t * ky * kz - s * kx,
    t * kx * kz - s * ky, t * ky * kz + s * kx, t * kz * kz + c];
  const turned = [0, 1, 2].flatMap(row => [0, 1, 2].map(column =>
    turn[row * 3]! * rotation[column]! + turn[row * 3 + 1]! * rotation[3 + column]! + turn[row * 3 + 2]! * rotation[6 + column]!));
  return [...worldQuaternionFromRotation(turned as unknown as Parameters<typeof worldQuaternionFromRotation>[0])] as [number, number, number, number];
}



/** Fit the prepared bounds through the current perspective projection. */
function fitSystemDepth(frame: FramingFrame, optics: Optics, view: FramingCandidate, rect: MapViewport, minimumRangeM: number, referenceToCamera: WorldRotation) {
  const [ox, oy] = (optics.principalOffsetPixels ?? [0, 0]), focal = optics.focalPixels;
  const precision = 8 * Number.EPSILON * Math.max(minimumRangeM, ...frame.originM.map(Math.abs));
  let depth = Math.max(frame.bodyRadiusM * 2,
    minimumRangeM / Math.hypot(1, ox / focal, oy / focal) + precision);
  for (const bx of [view.minimumM[0], view.maximumM[0]])
    for (const by of [view.minimumM[1], view.maximumM[1]])
      for (const bz of [view.minimumM[2], view.maximumM[2]]) {
        const corner = rotateWorldPosition(view.cameraToReference, [bx, by, bz]);
        const [x, y, z] = rotateWorldPosition(referenceToCamera, view.originM
          ? tuple(axis => corner[axis] + view.originM![axis] - frame.originM[axis]) : corner);
        const nx = focal * x - ox * z, ny = focal * y - oy * z;
        depth = Math.max(depth, z + Math.abs(frame.bodyRadiusM),
          z + nx / (nx < 0 ? rect.left : rect.right), z + ny / (ny < 0 ? rect.top : rect.bottom));
      }
  return depth;
}
