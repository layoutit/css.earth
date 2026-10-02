import { fromEyeM } from '@cssearth/engine';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssViewFromOrientation } from '@cssearth/engine';

/** A sphere's outline on screen, in pixels from the viewport centre (y down): an ellipse, `major` along `angle`. */
export interface SphereSilhouette { readonly x: number; readonly y: number; readonly major: number; readonly minor: number; readonly angle: number }

/**
 * The exact perspective outline of a sphere: the cone of sight lines that graze it, cut by the image plane. Seen straight
 * on it is a circle; off the axis it stretches along the line to the image centre. Null when the camera is inside the
 * sphere, behind it, or the cone reaches past the side of the view (it would not close on the image plane).
 */
export function sphereSilhouette(world: WorldCameraPose, viewport: WorldCameraViewport, centreM: readonly number[], radiusM: number): SphereSilhouette | null {
  const f = viewport.focalPixels;
  if (!(f > 0) || !(radiusM > 0)) return null;
  const delta = fromEyeM(world.pose, centreM);
  const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
  const eyeX = rotation[0]! * delta[0]! + rotation[1]! * delta[1]! + rotation[2]! * delta[2]!;
  const eyeY = rotation[3]! * delta[0]! + rotation[4]! * delta[1]! + rotation[5]! * delta[2]!;
  const depth = -(rotation[6]! * delta[0]! + rotation[7]! * delta[1]! + rotation[8]! * delta[2]!);
  const distance = Math.hypot(eyeX, eyeY, depth);
  if (!(distance > radiusM) || !(depth > 0)) return null;
  // theta: the centre's angle off the view axis; alpha: the cone's half-angle.
  const theta = Math.atan2(Math.hypot(eyeX, eyeY), depth), alpha = Math.asin(radiusM / distance), angle = Math.atan2(eyeY, eyeX);
  if (!(theta + alpha < Math.PI / 2 - 1e-6)) return null;
  const near = Math.tan(theta - alpha), far = Math.tan(theta + alpha), along = f * (near + far) / 2;
  const [principalX, principalY] = viewport.principalOffsetPixels;
  return { x: principalX + along * Math.cos(angle), y: principalY + along * Math.sin(angle), major: f * (far - near) / 2,
    minor: f * Math.sin(alpha) / Math.sqrt(Math.cos(theta - alpha) * Math.cos(theta + alpha)), angle };
}

/** The lowest point of the outline, in the same pixels. */
export function silhouetteBottom({ y, major, minor, angle }: SphereSilhouette): number {
  return y + Math.hypot(major * Math.sin(angle), minor * Math.cos(angle));
}
