import { rotateWorldPosition } from '../src/renderers/css/dist/navigation.js';

// Read the package's prepared map axes in the current shared world frame.
export function surfaceMapContext(config, camera, documentTarget, windowTarget) {
  if (!camera?.navigation || !config) return null;
  const body = documentTarget.querySelector(config.surfaceSelector);
  const scene = body?.closest('.polycss-scene');
  if (!body || !scene) return null;
  let matrix = new windowTarget.DOMMatrix();
  for (let node = body; node && node !== scene; node = node.parentElement) {
    matrix = new windowTarget.DOMMatrix(windowTarget.getComputedStyle(node).transform).multiply(matrix);
  }
  const transform = direction => {
    const p = matrix.transformPoint({ x: direction[0], y: direction[1], z: direction[2], w: 0 });
    const length = Math.hypot(p.x, p.y, p.z);
    return rotateWorldPosition(camera.navigation.frame.presentationToReference, [p.x / length, p.y / length, p.z / length]);
  };
  const axes = { prime: transform(config.prime), east: transform(config.east), north: transform(config.north) };
  const world = camera.navigation.capture();
  const relative = world.pose.positionM.map((x, i) => x - camera.navigation.frame.originM[i]);
  return { world, relative, axes, scene };
}

export function surfaceMapViewport(scene, optics) {
  const root = scene.closest('.polycss-camera').getBoundingClientRect();
  const stage = scene.closest('.planet-stage').getBoundingClientRect();
  const ox = root.x + root.width / 2 + optics.principalOffsetPixels[0];
  const oy = root.y + root.height / 2 + optics.principalOffsetPixels[1];
  return {
    left: (Math.max(root.left, stage.left) - ox) / optics.focalPixels,
    right: (Math.min(root.right, stage.right) - ox) / optics.focalPixels,
    top: (Math.max(root.top, stage.top) - oy) / optics.focalPixels,
    bottom: (Math.min(root.bottom, stage.bottom) - oy) / optics.focalPixels,
  };
}
