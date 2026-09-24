import type { WorldRotation } from '../src/renderers/css/navigation/world-camera-math.js';
import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
import type { PreparedWorldContext } from '../src/renderers/css/universe/prepared-world-context.js';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { MapViewport } from './surface-map-context.mts';
type Optics = ReturnType<ObjectWorldNavigation['optics']>;
type FramingFrame = Pick<PreparedWorldCameraFrame, 'referenceFrame' | 'epochJdTt' | 'originM' | 'bodyRadiusM'>;
interface FramingCandidate { originM?: PositionM; minimumM: PositionM; maximumM: PositionM; cameraToReference: readonly number[]; }
interface SystemView { readonly candidates: readonly FramingCandidate[]; }
const tuple = (map: (axis: number) => number): PositionM => [map(0), map(1), map(2)];
import galaxy from '../src/objects/milky-way/object.json' with { type: 'json' };
import { SYSTEM_FRAMING_ANGLES, SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE, SYSTEM_FRAMING_PADDING_PIXELS } from './runtime-policy.mts';
import { cssCameraAxesFromOrientation, cssViewFromOrientation, rotateWorldPosition, worldQuaternionFromRotation, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';
import { readApplicationSystemViews } from './world-system-views.mts';

/** Camera framing consumes the prepared orbit bounds, never orbit vertices. */
export function systemFramingRadii(plan: Pick<PreparedWorldContext, 'focus' | 'bodies'>) {
  const parents = new Map([...(plan.focus?.systemView ? [plan.focus] : []), ...plan.bodies].map(body => [body.id, body]));
  const largestMoons = new Map<string, number>();
  for (const moon of plan.bodies) {
    const parentId = moon.orbit?.centerBodyId;
    if (!parentId || !parents.has(parentId) || !moon.orbit?.bounds) continue;
    largestMoons.set(parentId, Math.max(largestMoons.get(parentId) ?? 0, moon.radiusM));
  }
  const radii = new Map<string, number>();
  for (const moon of plan.bodies) {
    const parent = parents.get(moon.orbit?.centerBodyId ?? ""), bounds = moon.orbit?.bounds;
    if (!parent || !bounds) continue;
    if (parent.systemView ? !parent.systemView.memberIds.includes(moon.id)
      : moon.radiusM < (largestMoons.get(parent.id) ?? 0) * SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE) continue;
    const radius = Math.hypot(...bounds.centerM.map((value, axis) => value - parent.positionM[axis]))
      + bounds.radiusM + moon.radiusM;
    radii.set(parent.id, Math.max(radii.get(parent.id) ?? parent.radiusM, radius));
  }
  return radii;
}

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

export const SYSTEM_FRAMING_RADII = systemFramingRadii(context);
export const SYSTEM_CENTERS = systemCenters(context);
/** Systems of other stars: placed stars, which have no orbit of their own, that planets orbit. They are reached from light
 * years away, where a turn out of edge-on reads as an approach; the Sun's and a planet's moons keep the departure angle. */
export const STELLAR_SYSTEMS: ReadonlySet<string> = new Set(context.bodies.filter(body => body.systemView && !body.orbit).map(body => body.id));
/** System overview camera candidates by host. Empty until `loadSystemViews` resolves; navigation awaits it first. */
export const SYSTEM_VIEWS = new Map<string, SystemView>();
/** Hosts whose overview is framed by prepared candidates. */
export const SYSTEM_VIEW_HOSTS: ReadonlySet<string> = new Set([context.focus, ...context.bodies].filter(body => body.systemView).map(body => body.id));
export const systemViewsLoaded = () => SYSTEM_VIEWS.size === SYSTEM_VIEW_HOSTS.size;
let systemViewsLoading: Promise<void> | null = null;
export function loadSystemViews(read?: () => Promise<unknown>): Promise<void> {
  systemViewsLoading ??= readApplicationSystemViews(read).then(views => { for (const [id, view] of views) SYSTEM_VIEWS.set(id, view); })
    .catch(error => { systemViewsLoading = null; throw error; });
  return systemViewsLoading;
}
/** A host's authored orbit range: its system overview never places the camera beyond the distance its orbits are drawn to. */
export const SYSTEM_RANGES = new Map(context.bodies.flatMap(body => 'orbitsWithinM' in body && body.orbitsWithinM !== undefined ? [[body.id, body.orbitsWithinM] as const] : []));
export const GALACTIC_VOLUME = parseDensityVolumeFrame(galaxy.properties.volume);

/** Fit the volume along the current viewing ray, keeping its anchor and orientation. */
export function volumeZoomTarget(from: WorldCameraPose, volume: DensityVolumeFrame, optics: Optics, rect: MapViewport, referencePositionM: PositionM) {
  const range = Math.hypot(...from.pose.positionM.map((value, axis) => value - referencePositionM[axis]));
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
    for (const selector of ['.object-sidebar', '.explorer-shell-header', '.object-footer']) {
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
      orientationXyzw } };
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

function cross(a: PositionM, b: PositionM): PositionM {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
