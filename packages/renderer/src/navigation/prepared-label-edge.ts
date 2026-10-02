import { type ObjectRuntimeDefinition, type PreparedWorldCameraFrame, cssMatrix } from '@cssearth/objects';

import type { WorldCameraPose } from '@cssearth/objects';
import type { WorldCameraViewport } from './world-camera.js';

import { presentWorldCamera, worldCameraViewport } from './world-camera.js';
import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';

export type PreparedLabelEdge = (world: WorldCameraPose, viewport: WorldCameraViewport) => number | null;

/** Project the existing prepared picking mesh. No DOM measurements, new geometry,
 * image reads or additional assets; the same edge follows arrival and rotation. */
export function preparedLabelEdge(definition: ObjectRuntimeDefinition, frame: PreparedWorldCameraFrame): PreparedLabelEdge | undefined {
  const hit = definition.surfaceHit;
  if (!hit || hit.datasetRanges || !hit.triangles.length || typeof DOMMatrix === 'undefined') return undefined;
  let local = new DOMMatrix();
  for (let index = hit.target; index !== definition.tree.scene;) {
    const node = definition.tree.nodes[index];
    if (!node || node.parent < 0) return undefined;
    // A driven ancestor is not a static prepared transform.
    if (node.properties.length) return undefined;
    const transform = /(?:^|;)\s*transform\s*:\s*([^;]+)/u.exec(node.style ?? '')?.[1]?.trim();
    if (transform && transform !== 'none') {
      if (!cssMatrix(transform)) return undefined;
      local = new DOMMatrix(transform).multiply(local);
    }
    index = node.parent;
  }
  let previousWorld: WorldCameraPose | undefined, previousViewport: WorldCameraViewport | undefined, bottom: number | null = null;
  return (world, viewport) => {
    if (world === previousWorld && viewport === previousViewport) return bottom;
    previousWorld = world; previousViewport = viewport;
    const optics = worldCameraViewport(world, viewport), view = presentWorldCamera(world, frame, optics);
    const projection = physicalProjectionFromCamera(view.rotation, view.bodyCenterUnits, definition.camera.sceneScale, optics);
    const matrix = new DOMMatrix(Array.from(projection.eyeFromScene)).multiply(local).toFloat64Array();
    let edge = -Infinity;
    for (const triangle of hit.triangles) for (const [x, y, z] of triangle) {
      const depth = -(matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]);
      if (depth <= 0) return bottom = null;
      edge = Math.max(edge, optics.principalOffsetPixels[1] + optics.focalPixels *
        (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / depth);
    }
    return bottom = Number.isFinite(edge) ? edge : null;
  };
}
