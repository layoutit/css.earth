import { rotateWorldPosition } from '../src/renderers/css/dist/navigation.js';

// Read the package's prepared map axes in the current shared world frame.
export function surfaceMapContext(config, camera, documentTarget, windowTarget) {
  if (!camera?.navigation || !config) return null;
  const body = documentTarget.querySelector(config.surfaceSelector);
  const scene = body?.closest('.polycss-scene');
  if (!body || !scene) return null;
  return surfaceSnapshot(body, scene, config, camera, windowTarget);
}

function surfaceAxes(body, scene, config, camera, windowTarget) {
  let matrix = new windowTarget.DOMMatrix();
  for (let node = body; node && node !== scene; node = node.parentElement) {
    matrix = new windowTarget.DOMMatrix(windowTarget.getComputedStyle(node).transform).multiply(matrix);
  }
  const transform = direction => {
    const p = matrix.transformPoint({ x: direction[0], y: direction[1], z: direction[2], w: 0 });
    const length = Math.hypot(p.x, p.y, p.z);
    return rotateWorldPosition(camera.navigation.frame.presentationToReference, [p.x / length, p.y / length, p.z / length]);
  };
  return { prime: transform(config.prime), east: transform(config.east), north: transform(config.north) };
}

function surfaceSnapshot(body, scene, config, camera, windowTarget, axes = surfaceAxes(body, scene, config, camera, windowTarget)) {
  const world = camera.navigation.capture();
  const relative = world.pose.positionM.map((x, i) => x - camera.navigation.frame.originM[i]);
  return { world, relative, axes, scene };
}

/** One shell-content owner shares the rendered surface axes between its consumers.
 * Camera transforms are outside the surface chain. Native animation times also
 * catch paused seeks/restores, without polling computed styles while orbiting.
 */
export function createSurfaceMapReader({ documentTarget, windowTarget }) {
  const entries = new Map();
  let disposed = false, observer = null;
  function invalidate(records) {
    for (const entry of entries.values()) {
      if (!records || records.some(record => entry.nodes.includes(record.target) || record.target === entry.stage)) {
        entry.axes = null;
        entry.animations = null;
      }
    }
  }
  const resize = () => invalidate();
  return {
    read(map, camera) {
      if (disposed || !map || !camera?.navigation) return null;
      const records = observer?.takeRecords() ?? [];
      if (records.length) invalidate(records);
      const source = map.dataset.surfaceMinimap;
      let entry = entries.get(map);
      const config = entry?.source === source ? entry.config : JSON.parse(source);
      const body = documentTarget.querySelector(config.surfaceSelector);
      const scene = body?.closest('.polycss-scene');
      if (!body || !scene) return null;
      if (!entry || entry.source !== source || entry.body !== body || entry.scene !== scene || entry.frame !== camera.navigation.frame) {
        const nodes = [];
        for (let node = body; node && node !== scene; node = node.parentElement) nodes.push(node);
        entry = { source, config, body, scene, nodes, stage: scene.closest('.planet-stage'),
          frame: camera.navigation.frame, axes: null, animations: null, times: [] };
        entries.set(map, entry);
        if (!observer) {
          observer = new windowTarget.MutationObserver(invalidate);
          windowTarget.addEventListener('resize', resize);
        }
        // Observe only the model chain, not camera transforms or surface leaves.
        // Rebind so a replaced body is no longer retained by the observer.
        observer.disconnect();
        for (const current of entries.values()) {
          for (const node of current.nodes) observer.observe(node, { attributes: true });
          if (current.stage) observer.observe(current.stage, { attributes: true, attributeFilter: ['class', 'style'] });
        }
      }
      entry.animations ??= entry.nodes.flatMap(node => node.getAnimations())
        .filter(animation => animation.effect?.getKeyframes().some(frame => frame.transform !== undefined));
      // A duration change can alter the phase even while currentTime is paused.
      const times = entry.animations.flatMap(animation => [animation.currentTime, animation.effect.getComputedTiming().progress]);
      if (!entry.axes || times.some((time, i) => time !== entry.times[i])) {
        entry.axes = surfaceAxes(body, scene, config, camera, windowTarget);
        entry.times = times;
      }
      return surfaceSnapshot(body, scene, config, camera, windowTarget, entry.axes);
    },
    destroy() {
      disposed = true; observer?.disconnect(); entries.clear();
      if (observer) windowTarget.removeEventListener('resize', resize);
    },
  };
}

export function surfaceMapViewport(scene, optics) {
  // The camera owns the measured visible rectangle. Shell consumers use the
  // same snapshot instead of forcing geometry reads after every camera write.
  if (optics.visibleRect) {
    const rect = optics.visibleRect, [ox, oy] = optics.principalOffsetPixels;
    return { left: (rect.left - ox) / optics.focalPixels, right: (rect.right - ox) / optics.focalPixels,
      top: (rect.top - oy) / optics.focalPixels, bottom: (rect.bottom - oy) / optics.focalPixels };
  }
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
