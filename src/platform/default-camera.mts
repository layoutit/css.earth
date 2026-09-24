import type { Vector3 } from "../renderers/css/solar-system/types.ts";
import { prepareEclipticPresentationFrame } from "./solar-presentation-frame.mts";
import { requireBodyFixedSunDirection, requireBodyFixedToIcrf } from "./solar-geometry.mts";

// Where every prepared object's camera opens. Nothing here is authored per object: the ecliptic presentation frame puts
// ecliptic north up and the Sun to the left at zero yaw, so a lit body opens on that frame's design pose, and a body with
// something specific to face opens looking straight at it.

/** The design pose of a lit body: the Sun exactly to the left, the camera 40 degrees above the ecliptic plane on its north side
 * (CSS rotateX tilts the top of the scene away from the viewer for a positive angle, so north-side views are negative). */
export const LIT_DEFAULT_VIEW = Object.freeze({ initialScenePitchDegrees: -40, defaultControlYawDegrees: 0 });

export interface DefaultCameraAngles { readonly initialScenePitchDegrees: number; readonly defaultControlYawDegrees: number }
export interface ObserverPoint { readonly observerWestLongitude: number; readonly observerLatitude: number }

/** The yaw and scene pitch that put `target`, a body-fixed direction, at the centre of the default view. The scene matrix is
 * CSS rotateX(pitch) · rotateY(yaw) applied to presentation directions, and the viewer lies along CSS +z. */
export function prepareFacingCameraAngles(bodyId: string, target: Vector3): DefaultCameraAngles {
  const length = Math.hypot(...target);
  if (!(length > 0) || !target.every(Number.isFinite)) throw new TypeError(`${bodyId}: a default camera target needs a direction.`);
  const [x, y, z] = prepareEclipticPresentationFrame(bodyId).toPresentation(target.map(value => value / length));
  return Object.freeze({ defaultControlYawDegrees: Math.atan2(-x, z) * 180 / Math.PI, initialScenePitchDegrees: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI });
}

/** The body-fixed direction at the centre of a default view: the inverse of `prepareFacingCameraAngles`. */
export function openingDirection(bodyId: string, { initialScenePitchDegrees, defaultControlYawDegrees }: DefaultCameraAngles): Vector3 {
  const yaw = defaultControlYawDegrees * Math.PI / 180, pitch = initialScenePitchDegrees * Math.PI / 180;
  const presentation = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const [xAxis, yAxis, zAxis] = prepareEclipticPresentationFrame(bodyId).basis;
  return [0, 1, 2].map(axis => presentation[0]! * xAxis![axis]! + presentation[1]! * yAxis![axis]! + presentation[2]! * zAxis![axis]!);
}

/** How lopsided a partial map's data must be before the opening turns toward it. The measure is the length of the area-weighted
 * mean direction of the map's covered pixels: 0 for data spread evenly around the body, 0.5 for one exact hemisphere. Measured on
 * the prepared default maps (2026-09-23), complete maps sit at 0.021 or less and maps missing much of a hemisphere at 0.19 or
 * more; 0.1 separates them. */
export const LOPSIDED_COVERAGE = 0.1;

/** The body-fixed direction toward an observer stated as a sub-observer point (west-positive longitude, as archives state it). */
export function observerPointDirection(bodyId: string, { observerWestLongitude, observerLatitude }: ObserverPoint): Vector3 {
  if (!Number.isFinite(observerWestLongitude) || !(Math.abs(observerLatitude) <= 90)) throw new TypeError(`${bodyId}: an observation frame has no sub-observer point.`);
  const longitude = -observerWestLongitude * Math.PI / 180, latitude = observerLatitude * Math.PI / 180;
  return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
}

/** The body-fixed direction a set of observation frames looks at together: the mean of their directions toward the observer. */
export function observationCentroid(bodyId: string, directions: readonly Vector3[]): Vector3 {
  if (!directions.length) throw new TypeError(`${bodyId}: an observation target needs at least one frame.`);
  const sum = [0, 0, 0];
  for (const direction of directions) {
    const length = Math.hypot(...direction);
    if (!(length > 0) || !direction.every(Number.isFinite)) throw new TypeError(`${bodyId}: an observation frame has no observer direction.`);
    for (let axis = 0; axis < 3; axis++) sum[axis]! += direction[axis]! / length;
  }
  if (!(Math.hypot(...sum) > 1e-9)) throw new TypeError(`${bodyId}: the observation frames look at no common side.`);
  return sum;
}

/** The body-fixed directions toward the observer of a terrestrial recipe's default photograph lens: the frames' own
 * sub-observer points when every frame states one, otherwise the observer positions its prepared surface report solved for each
 * frame. None when the default lens has no photograph frames. */
export function photographDirections(bodyId: string, recipe: { raster?: { surfaceObservations?: readonly { id: string }[] }; presentation?: { defaultLens?: string } }, surfacesReport: unknown): Vector3[] | undefined {
  const defaultLens = recipe.presentation?.defaultLens;
  const lens = (recipe.raster?.surfaceObservations ?? []).find(entry => entry.id === defaultLens) as { frames?: readonly Record<string, unknown>[] } | undefined;
  if (!lens?.frames?.length) return undefined;
  if (lens.frames.every(frame => Number.isFinite(frame.observerWestLongitude) && Number.isFinite(frame.observerLatitude))) {
    return lens.frames.map(frame => observerPointDirection(bodyId, { observerWestLongitude: Number(frame.observerWestLongitude), observerLatitude: Number(frame.observerLatitude) }));
  }
  const record = (value: unknown, label: string) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${bodyId}: ${label} is not a record.`);
    return value as Record<string, unknown>;
  };
  const surfaces = record(surfacesReport, 'the prepared surface report').surfaces;
  if (!Array.isArray(surfaces)) throw new TypeError(`${bodyId}: the prepared surface report lists no surfaces.`);
  const observation = surfaces.map(value => record(value, 'a prepared surface')).find(entry => entry.id === defaultLens)?.observation as Record<string, unknown> | undefined;
  const cameras = (Array.isArray(observation?.frames) ? observation.frames.map(frame => record(frame, 'a report frame').camera) : [observation?.camera]).filter(camera => camera !== undefined);
  const directions = cameras.map(camera => {
    const position = Array.isArray(camera) ? camera : record(camera, 'a report camera').positionKm;
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) throw new TypeError(`${bodyId}: a surface report camera position has three finite components.`);
    return position;
  });
  if (!directions.length) throw new TypeError(`${bodyId}: the default photograph lens states no observer, in its frames or its prepared report.`);
  return directions;
}

/** The default camera of one object:
 * - an observation lens: its frames' common direction toward the observer;
 * - a planet of another star: its substellar point, where its synchronous rotation record puts longitude 0 facing the host
 *   star that lights the map;
 * - a placed star: the direction of the Sun, where Earth observes it from;
 * - a lit body whose default map covers mostly one side (`coverage`, the mean direction of its covered pixels, at least
 *   LOPSIDED_COVERAGE long): the design pose's tilt, turned to face the centre of that data, and on the south side of the
 *   ecliptic when that centre is south of it;
 * - any other body: the lit design pose. */
export function prepareDefaultCameraAngles(bodyId: string, { observation, light = 'sun', coverage }: { observation?: readonly Vector3[]; light?: 'sun' | 'self' | 'host'; coverage?: Vector3 } = {}): DefaultCameraAngles {
  if (observation?.length) return prepareFacingCameraAngles(bodyId, observationCentroid(bodyId, observation));
  if (light === 'host') return prepareFacingCameraAngles(bodyId, [1, 0, 0]);
  if (light === 'self') return prepareFacingCameraAngles(bodyId, requireBodyFixedSunDirection(bodyId));
  if (coverage && Math.hypot(...coverage) >= LOPSIDED_COVERAGE) {
    // The design tilt, taken on the south side of the ecliptic when the data centre lies south of it.
    const facing = prepareFacingCameraAngles(bodyId, coverage), tilt = Math.abs(LIT_DEFAULT_VIEW.initialScenePitchDegrees);
    return Object.freeze({ initialScenePitchDegrees: facing.initialScenePitchDegrees > 0 ? tilt : -tilt, defaultControlYawDegrees: facing.defaultControlYawDegrees });
  }
  return LIT_DEFAULT_VIEW;
}

/** Default camera angles are derived here; a recipe that still states them is stale and would silently disagree. */
export function refuseAuthoredCameraAngles(source: object) {
  for (const key of ["initialScenePitchDegrees", "defaultControlYawDegrees"]) {
    if (Object.hasOwn(source, key)) throw new TypeError(`${key} is derived at preparation (src/platform/default-camera.mts), not authored.`);
  }
}

/** Counterclockwise screen angle (from screen-right, y up) at which celestial north on the sky, as Earth sees the body, lies in
 * the default view. Earth's line of sight is taken along the Sun direction, as the scene places Earth. A sky-plane image
 * turned by this angle minus 90 degrees keeps its north where the scene's sky has it. */
export function prepareSkyNorthScreenAngleDegrees(bodyId: string, angles: DefaultCameraAngles): number {
  const B = requireBodyFixedToIcrf(bodyId), sun = requireBodyFixedSunDirection(bodyId);
  const toIcrf = (v: readonly number[]) => [0, 1, 2].map(row => B[3 * row]! * v[0]! + B[3 * row + 1]! * v[1]! + B[3 * row + 2]! * v[2]!);
  const toBody = (v: readonly number[]) => [0, 1, 2].map(column => B[column]! * v[0]! + B[3 + column]! * v[1]! + B[6 + column]! * v[2]!);
  const sight = toIcrf(sun).map(value => -value), along = sight[2]!;
  const north = [0 - along * sight[0]!, 0 - along * sight[1]!, 1 - along * sight[2]!], length = Math.hypot(...north);
  if (!(length > 1e-9)) throw new TypeError(`${bodyId}: celestial north has no direction on a sky seen along the pole.`);
  const [x, y, z] = prepareEclipticPresentationFrame(bodyId).toPresentation(toBody(north.map(value => value / length)));
  const yaw = angles.defaultControlYawDegrees * Math.PI / 180, pitch = angles.initialScenePitchDegrees * Math.PI / 180;
  // rotateY(yaw), then rotateX(pitch), as the scene matrix applies them.
  const yawedX = Math.cos(yaw) * x! + Math.sin(yaw) * z!, yawedZ = -Math.sin(yaw) * x! + Math.cos(yaw) * z!;
  const eyeY = Math.cos(pitch) * y! - Math.sin(pitch) * yawedZ;
  return Math.atan2(-eyeY, yawedX) * 180 / Math.PI;
}
