import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssCameraAxesFromOrientation } from '../navigation/world-camera-math.js';

/** Only the observer projection is runtime work; every astronomical position is prepared. */
export function projectCatalogPosition(positionM: readonly number[], world: WorldCameraPose, viewport: WorldCameraViewport) {
  const rotation = cssCameraAxesFromOrientation(world.pose.orientationXyzw);
  const dx = positionM[0] - world.pose.positionM[0];
  const dy = positionM[1] - world.pose.positionM[1];
  const dz = positionM[2] - world.pose.positionM[2];
  const x = rotation[0] * dx + rotation[3] * dy + rotation[6] * dz;
  const y = rotation[1] * dx + rotation[4] * dy + rotation[7] * dz;
  const depth = -(rotation[2] * dx + rotation[5] * dy + rotation[8] * dz);
  if (!(depth > 0)) return null;
  return { x: viewport.principalOffsetPixels[0] + viewport.focalPixels * x / depth,
    y: viewport.principalOffsetPixels[1] + viewport.focalPixels * y / depth,
    distanceM: Math.hypot(dx, dy, dz), depthM: depth };
}
