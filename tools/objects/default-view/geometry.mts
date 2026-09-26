/** What the default camera of a prepared object looks at, derived with the runtime's own camera math and no browser.
 *
 * The orbit's default scene matrix is CSS rotateX(scene pitch) · rotateY(yaw), the same product the runtime builds
 * (`navigation/prepared-camera-basis.ts`); `worldCameraFromPresentation` turns it into the world pose the app reports
 * through `captureWorldCamera`. From the pose: the sub-camera point on the body, and where the body's pole and the
 * celestial directions land on screen. A preparation check uses it to refuse a default view that misses the lens's
 * sub-observer point; a test pins the numbers the browser was measured to show. */
import { preparedScenePitch } from '@cssearth/engine';
import { worldCameraFromPresentation } from '@cssearth/renderer/navigation';
import { requireBodyFixedToIcrf } from '../../../src/platform/solar-geometry.mts';

const DEGREE = Math.PI / 180;
type Vector3 = readonly [number, number, number];
export interface DefaultViewCamera { readonly defaultControlPitchDegrees: number; readonly defaultControlYawDegrees: number; readonly initialScenePitchDegrees: number; readonly maximumControlPitchDegrees: number; readonly maximumScenePitchDegrees: number; }
export interface DefaultViewFrame { readonly referenceFrame: string; readonly epochJdTt: number; readonly originM: Vector3; readonly presentationToReference: readonly number[]; readonly metersPerUnit: number; readonly bodyRadiusM: number; }
export interface DefaultViewGeometry {
  readonly scenePitchDegrees: number;
  /** The body point under the camera, planetocentric east-positive longitude and latitude in degrees. */
  readonly subCamera: { readonly longitudeDegrees: number; readonly latitudeDegrees: number };
  /** Screen angle of a direction, counterclockwise from screen-right in degrees, and whether it points toward the viewer. */
  readonly screen: (directionIcrf: Vector3) => { readonly angleDegrees: number; readonly towardViewer: boolean };
}

const rotateX = (t: number): number[][] => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const rotateY = (t: number): number[][] => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const multiply = (a: number[][], b: number[][]) => a.map((row, i) => row.map((_, j) => row.reduce((sum, _v, k) => sum + a[i]![k]! * b[k]![j]!, 0)));
const apply = (m: readonly (readonly number[])[], v: Vector3): Vector3 => [0, 1, 2].map(i => m[i]![0]! * v[0] + m[i]![1]! * v[1] + m[i]![2]! * v[2]) as unknown as Vector3;
const transpose = (m: readonly (readonly number[])[]) => [0, 1, 2].map(i => [0, 1, 2].map(j => m[j]![i]!));
const rows = (flat: readonly number[]) => [0, 1, 2].map(r => [flat[3 * r]!, flat[3 * r + 1]!, flat[3 * r + 2]!]);

/** The runtime's control-to-scene pitch: `preparedScenePitch` in @cssearth/engine. */
export function scenePitchDegrees(camera: DefaultViewCamera, controlPitch = camera.defaultControlPitchDegrees) {
  return preparedScenePitch(controlPitch, camera);
}

export function defaultViewGeometry(bodyId: string, camera: DefaultViewCamera, frame: DefaultViewFrame, controls?: { controlPitch: number; controlYaw: number }): DefaultViewGeometry {
  const pitch = scenePitchDegrees(camera, controls?.controlPitch), yaw = controls?.controlYaw ?? camera.defaultControlYawDegrees;
  // Presentation directions to CSS eye space (x right, y down, z toward the viewer): the scene matrix's linear part.
  const eyeFromPresentation = multiply(rotateX(pitch * DEGREE), rotateY(yaw * DEGREE));
  const rotation = Object.freeze(eyeFromPresentation.flat()) as unknown as readonly number[];
  const distanceUnits = 10 * frame.bodyRadiusM / frame.metersPerUnit;
  const { pose } = worldCameraFromPresentation({ rotation: rotation as never, bodyCenterUnits: [0, 0, -distanceUnits] }, frame as never);
  const offset = pose.positionM.map((value: number, axis: number) => value - frame.originM[axis]!) as unknown as Vector3;
  const length = Math.hypot(...offset), directionIcrf = offset.map(v => v / length) as unknown as Vector3;
  const icrfToBody = transpose(rows(requireBodyFixedToIcrf(bodyId)));
  const body = apply(icrfToBody, directionIcrf);
  const presentationFromIcrf = transpose(rows(frame.presentationToReference));
  return Object.freeze({
    scenePitchDegrees: pitch,
    subCamera: Object.freeze({ longitudeDegrees: Math.atan2(body[1], body[0]) / DEGREE, latitudeDegrees: Math.asin(Math.max(-1, Math.min(1, body[2]))) / DEGREE }),
    screen(direction: Vector3) {
      const eye = apply(eyeFromPresentation, apply(presentationFromIcrf, direction));
      return Object.freeze({ angleDegrees: Math.atan2(-eye[1], eye[0]) / DEGREE, towardViewer: eye[2] > 0 });
    },
  });
}

export const angularSeparationDegrees = (a: { longitudeDegrees: number; latitudeDegrees: number }, b: { longitudeDegrees: number; latitudeDegrees: number }) => {
  const p = (q: typeof a): Vector3 => [Math.cos(q.latitudeDegrees * DEGREE) * Math.cos(q.longitudeDegrees * DEGREE), Math.cos(q.latitudeDegrees * DEGREE) * Math.sin(q.longitudeDegrees * DEGREE), Math.sin(q.latitudeDegrees * DEGREE)];
  const [u, v] = [p(a), p(b)]; return Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) / DEGREE;
};

/** A surface-observation lens names the body point its frame looks at; the default camera must look at it too. */
export function assertDefaultViewFacesLens(bodyId: string, camera: DefaultViewCamera, frame: DefaultViewFrame, subObserver: { longitudeDegrees: number; latitudeDegrees: number }, maximumDegrees = 25) {
  const view = defaultViewGeometry(bodyId, camera, frame);
  const separation = angularSeparationDegrees(view.subCamera, subObserver);
  if (!(separation <= maximumDegrees)) throw new Error(`${bodyId}: the default camera looks at longitude ${view.subCamera.longitudeDegrees.toFixed(1)}, latitude ${view.subCamera.latitudeDegrees.toFixed(1)}, ${separation.toFixed(1)} degrees from the lens's sub-observer point (${subObserver.longitudeDegrees}, ${subObserver.latitudeDegrees}); the limit is ${maximumDegrees}.`);
  return { view, separation };
}
