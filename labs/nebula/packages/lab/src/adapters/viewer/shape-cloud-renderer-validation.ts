import type { PreparedShapeScene } from '@cssearth/bake/volume';
import type { PreparedCssVolume } from '../../../../../../../src/renderers/css/volume/types';
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
  const first = supportHash(neutral.provenance, result), second = supportHash(textured.provenance, result);
  if (first !== second) throw new Error('Cloud materials have different prepared alpha support.');
}
function supportHash(value: unknown, result: PreparedShapeScene): string {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-provenance@1' || typeof value.alphaSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.alphaSha256) ||
      value.sourceSha256 !== result.sourceSha256 || value.mapSha256 !== result.mapSha256 || value.geometrySha256 !== result.geometrySha256 ||
      (value.quality === undefined ? 'detailed' : value.quality) !== result.quality ||
      !record(value.projection) || value.projection.width !== result.width || value.projection.height !== result.height || value.projection.unitsPerPixel !== result.unitsPerPixel) {
    throw new TypeError('Prepared cloud provenance or alpha support differs from its result.');
  }
  return value.alphaSha256;
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
