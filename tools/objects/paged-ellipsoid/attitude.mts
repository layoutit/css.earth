/** How a paged ellipsoid sits in its scene, derived rather than authored: the system node is solved so the drawn body is the
 * ecliptic presentation frame (ecliptic north up, the Sun to the left at zero yaw), and every baked light and view direction is
 * the same chain applied in PolyCSS world coordinates (world X/Y are CSS Y/X), with the body-fixed Sun as the light. */
import { buildPolyMeshTransform } from '@layoutit/polycss';
import { prepareEclipticPresentationFrame } from '../../../src/platform/solar-presentation-frame.mts';
import { chain, matrix3dText, POLYCSS_SURFACE_PLACEMENT, solveSystemMatrix } from '../world-navigation-sources.ts';

type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];
type Vector3 = readonly [number, number, number];
const SWAP: Matrix3 = [0, 1, 0, 1, 0, 0, 0, 0, 1];
const multiply = (a: Matrix3, b: Matrix3): Matrix3 => [0, 1, 2].flatMap(row => [0, 1, 2].map(column =>
  a[3 * row]! * b[column]! + a[3 * row + 1]! * b[3 + column]! + a[3 * row + 2]! * b[6 + column]!)) as unknown as Matrix3;
const transpose = (m: Matrix3): Matrix3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const apply = (m: Matrix3, v: readonly number[]): Vector3 => [0, 1, 2].map(row => m[3 * row]! * v[0]! + m[3 * row + 1]! * v[1]! + m[3 * row + 2]! * v[2]!) as unknown as Vector3;
const world = (css: Matrix3) => multiply(multiply(SWAP, css), SWAP);

export interface EllipsoidAttitude {
  /** The system node transform (CSS `matrix3d`). */
  readonly systemTransform: string;
  /** The mesh node transform below it (CSS). */
  readonly meshTransform: string;
  /** Row-major CSS rotation of the system node, and of system then mesh. */
  readonly systemMatrix: Matrix3;
  readonly bodyMatrix: Matrix3;
  /** The Sun in object (mesh-local world) coordinates. */
  readonly objectLight: Vector3;
  /** The Sun's CSS view direction at a camera pose. */
  sunView(scenePitchDegrees: number, controlYawDegrees?: number): Vector3;
  /** A screen direction (PolyCSS world coordinates: x down, y right, z toward the viewer) at a camera pose, in object coordinates. */
  screenToObject(vector: readonly number[], scenePitchDegrees: number, controlYawDegrees?: number): Vector3;
  /** An eye-space CSS direction at a camera pose, in object coordinates. */
  viewToObject(vector: readonly number[], scenePitchDegrees: number, controlYawDegrees?: number): Vector3;
}

export function prepareEllipsoidAttitude(bodyId: string, { meshRotationZDegrees, mapLeftEdgeLongitudeDeg }: { meshRotationZDegrees: number; mapLeftEdgeLongitudeDeg: number }): EllipsoidAttitude {
  const frame = prepareEclipticPresentationFrame(bodyId);
  const meshTransform = buildPolyMeshTransform({ rotation: [0, 0, meshRotationZDegrees] }) ?? '';
  const systemMatrix = solveSystemMatrix(bodyId, frame.basis.flat() as unknown as Matrix3, [meshTransform], { ...POLYCSS_SURFACE_PLACEMENT, mapLeftEdgeLongitudeDeg });
  const bodyMatrix = multiply(systemMatrix, chain(meshTransform) as unknown as Matrix3);
  // Presentation (world) to object (world): the inverse of system then mesh, conjugated into world coordinates.
  const presentationToObject = transpose(world(bodyMatrix));
  const pose = (pitch: number, yaw: number) => chain(`rotateX(${pitch}deg) rotateY(${yaw}deg)`) as unknown as Matrix3;
  const viewToPresentation = (pitch: number, yaw: number) => transpose(pose(pitch, yaw));
  const sunPresentation = frame.sunDirection as unknown as Vector3;
  return Object.freeze({
    systemTransform: matrix3dText(systemMatrix), meshTransform, systemMatrix, bodyMatrix,
    objectLight: apply(presentationToObject, apply(SWAP, sunPresentation)),
    sunView: (pitch: number, yaw = 0) => apply(pose(pitch, yaw), sunPresentation),
    screenToObject: (vector: readonly number[], pitch: number, yaw = 0) => apply(presentationToObject, apply(world(viewToPresentation(pitch, yaw)), vector)),
    viewToObject: (vector: readonly number[], pitch: number, yaw = 0) => apply(presentationToObject, apply(SWAP, apply(viewToPresentation(pitch, yaw), vector))),
  });
}
