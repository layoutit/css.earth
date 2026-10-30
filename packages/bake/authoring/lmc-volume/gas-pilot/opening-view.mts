/** The LMC's opening view: its own prepared pitch and yaw, near the disc normal on the Earth side and tilted away from the Milky Way. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cssCameraAxesFromOrientation, rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/engine';
import { parsePreparedWorldCameraFrame, parseDensityVolumeFrame } from '@cssearth/objects';
export const TILT_DEGREES = 25, SOURCE = 'src/objects/lmc/source/presentation/solar-system.json';
/** The galactic centre in the frame the world camera uses: Reid & Brunthaler's direction, GRAVITY's 8.178 kpc. */
const rad = Math.PI / 180, KPC = 3.0856775814913673e19, gcRa = 266.405 * rad, gcDec = -28.936 * rad;
export const GALACTIC_CENTRE_M = [8.178 * KPC * Math.cos(gcDec) * Math.cos(gcRa), 8.178 * KPC * Math.cos(gcDec) * Math.sin(gcRa), 8.178 * KPC * Math.sin(gcDec)] as const;
type V = readonly [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a: V): V => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
/** Where the Milky Way's centre falls on screen for a pose: pixels from the frame's centre, or null behind the camera. */
export function milkyWayOnScreen(positionM: V, orientationXyzw: readonly [number, number, number, number], focal: number) {
  const r = cssCameraAxesFromOrientation(orientationXyzw), d: V = [GALACTIC_CENTRE_M[0] - positionM[0], GALACTIC_CENTRE_M[1] - positionM[1], GALACTIC_CENTRE_M[2] - positionM[2]], depth = -(r[2] * d[0] + r[5] * d[1] + r[8] * d[2]);
  if (depth <= 0) return null; return [focal * (r[0] * d[0] + r[3] * d[1] + r[6] * d[2]) / depth, focal * (r[1] * d[0] + r[4] * d[1] + r[7] * d[2]) / depth] as const;
}
export function solveOpeningView() {
  const worldFrame = parsePreparedWorldCameraFrame(JSON.parse(readFileSync('src/objects/lmc/object.json', 'utf8')).properties.worldFrame)!;
  const raw = JSON.parse(readFileSync('src/objects/lmc-volume/object.json', 'utf8')).properties.frame, frame = parseDensityVolumeFrame(raw), toIcrs = worldRotationFromQuaternion(frame.localToReferenceXyzw);
  const origin = worldFrame.originM as unknown as V, toSun = unit([-origin[0], -origin[1], -origin[2]]);
  let normal = unit(rotateWorldPosition(toIcrs, [0, 0, 1]) as unknown as V); if (dot(normal, toSun) < 0) normal = [-normal[0], -normal[1], -normal[2]];
  const toMilkyWay = unit([GALACTIC_CENTRE_M[0] - origin[0], GALACTIC_CENTRE_M[1] - origin[1], GALACTIC_CENTRE_M[2] - origin[2]]);
  // Tilted straight away from the Milky Way, keeping the near top-down look.
  const along = dot(toMilkyWay, normal), away = unit([normal[0] * along - toMilkyWay[0], normal[1] * along - toMilkyWay[1], normal[2] * along - toMilkyWay[2]]), t = TILT_DEGREES * rad;
  const target = unit([normal[0] * Math.cos(t) + away[0] * Math.sin(t), normal[1] * Math.cos(t) + away[1] * Math.sin(t), normal[2] * Math.cos(t) + away[2] * Math.sin(t)]);
  const plan = (JSON.parse(readFileSync('src/objects/lmc/prepared/runtime.json', 'utf8')) as { camera: Record<string, number> }).camera;
  return { plan, target, normal, toMilkyWay };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { target, normal, toMilkyWay, plan } = solveOpeningView();
  const solar = await import('../../../../../src/platform/solar-geometry.mts'), B = solar.requireBodyFixedToIcrf('lmc') as readonly number[], body = [0, 1, 2].map(c => B[c]! * target[0] + B[3 + c]! * target[1] + B[6 + c]! * target[2]);
  const raw = JSON.parse(readFileSync(SOURCE, 'utf8')) as Record<string, unknown>; raw.openingDirection = body.map(v => +v.toFixed(6)); writeFileSync(SOURCE, JSON.stringify(raw, null, 2) + '\n');
  console.log(JSON.stringify({ normal, target, toMilkyWay, angleNormalToMilkyWay: Math.acos(dot(normal, toMilkyWay)) / rad, plan: { pitch: plan.initialScenePitchDegrees, ctrl: plan.defaultControlPitchDegrees, yaw: plan.defaultControlYawDegrees, maxCtrl: plan.maximumControlPitchDegrees, maxScene: plan.maximumScenePitchDegrees } }));
}
