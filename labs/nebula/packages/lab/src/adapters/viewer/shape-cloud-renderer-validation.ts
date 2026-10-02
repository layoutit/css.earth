import { isRecord as coreIsRecord } from '@cssearth/core';
import type { PreparedShapeScene } from '@cssearth/objects';
import type { PreparedCssVolume } from '@cssearth/renderer/volume/types.ts';
export function assertSharedGeometry(neutral: PreparedCssVolume, textured: PreparedCssVolume, result: PreparedShapeScene): void {
  if (neutral.id !== `shape-cloud-${result.id}` || textured.id !== neutral.id) throw new Error('Cloud materials belong to a different preview.');
  if (JSON.stringify(neutral.frame) !== JSON.stringify(textured.frame)) throw new Error('Cloud materials have different physical frames.');
  for (const axis of ['x', 'y', 'z'] as const) {
    const first = neutral.stacks.find(stack => stack.axis === axis)!, second = textured.stacks.find(stack => stack.axis === axis)!;
    if (first.leaves.length !== second.leaves.length) throw new Error('Cloud materials have different slice counts.');
    for (let i = 0; i < first.leaves.length; i++) {
      const a = first.leaves[i]!, b = second.leaves[i]!;
      if (a.id !== b.id || a.widthPx !== b.widthPx || a.heightPx !== b.heightPx || JSON.stringify(a.centerUnits) !== JSON.stringify(b.centerUnits) ||
          JSON.stringify(a.boundsCssPixels) !== JSON.stringify(b.boundsCssPixels) ||
          (Object.keys(a.style) as (keyof typeof a.style)[]).some(key => a.style[key] !== b.style[key])) throw new Error('Cloud materials do not share the same prepared geometry.');
    }
  }
  checkProvenance(neutral.provenance, result); checkProvenance(textured.provenance, result);
}
function checkProvenance(value: unknown, result: PreparedShapeScene): void {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-provenance@1' || value.geometryFile !== result.geometryFile ||
      (value.quality === undefined ? 'detailed' : value.quality) !== result.quality ||
      !record(value.projection) || value.projection.width !== result.width || value.projection.height !== result.height || value.projection.unitsPerPixel !== result.unitsPerPixel) {
    throw new TypeError('Prepared cloud provenance differs from its result.');
  }
}
const record = coreIsRecord;
