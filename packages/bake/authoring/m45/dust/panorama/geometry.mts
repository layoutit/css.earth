import assert from 'node:assert/strict';
import { compileLeafBounds } from '@cssearth/bake/volume-leaves';
import type { PreparedVolumeLeaf } from '@cssearth/objects';

const cssPair = (value: string) => value.split(' ').map(Number.parseFloat);
const matrixOf = (leaf: PreparedVolumeLeaf) => {
  const matrix = leaf.style.transform.slice(9, -1).split(',').map(Number);
  if (matrix.length !== 16 || !matrix.every(Number.isFinite) || matrix[3] || matrix[7] || matrix[11] || matrix[15] !== 1) throw new Error('Existing affine prepared cube face required');
  return matrix;
};

/** Compare the painted source pixels, including the existing compiler's .6-unit
 * bleed. Recompiling an enlarged cube would subtly stretch the old picture. */
export function assertNativeRays(before: PreparedVolumeLeaf, after: PreparedVolumeLeaf, gutter: number): number {
  const old = matrixOf(before), next = matrixOf(after), a = cssPair(before.style.backgroundSize), b = cssPair(after.style.backgroundSize);
  const pa = cssPair(before.style.backgroundPosition), pb = cssPair(after.style.backgroundPosition);
  let maximum = 0;
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [.5, .5]]) {
    const ax = pa[0]! + u! * a[0]!, ay = pa[1]! + v! * a[1]!;
    const bx = pb[0]! + (gutter + u! * before.widthPx) / after.widthPx * b[0]!;
    const by = pb[1]! + (gutter + v! * before.heightPx) / after.heightPx * b[1]!;
    for (let row = 0; row < 3; row++) {
      const error = Math.abs(old[row]! * ax + old[row + 4]! * ay + old[row + 12]! - (next[row]! * bx + next[row + 4]! * by + next[row + 12]!));
      maximum = Math.max(maximum, error); assert(error < 1e-6, 'Native picture ray moved when extending prepared support');
    }
  }
  return maximum;
}

/** Extend the existing compiled face; its matrix basis and original painted
 * pixel locations stay fixed. Only new transparent/feathered support is added. */
export function extendPreparedFace(before: PreparedVolumeLeaf, texturePath: string, gutter: number) {
  if (before.widthPx !== before.heightPx || !Number.isInteger(gutter) || gutter < 2) throw new Error('Square prepared face and native gutter required');
  const matrix = matrixOf(before), span = cssPair(before.style.backgroundSize), n = before.widthPx, texels = n + 2 * gutter;
  const width = Number.parseFloat(before.style.width), height = Number.parseFloat(before.style.height);
  if (![...span, width, height].every(value => value > 0 && Number.isFinite(value))) throw new Error('Finite image box required');
  const px = gutter * span[0]! / n, py = gutter * span[1]! / n;
  for (let row = 0; row < 3; row++) matrix[row + 12]! -= px * matrix[row]! + py * matrix[row + 4]!;
  const joined = matrix.join(','), nextWidth = width + 2 * px, nextHeight = height + 2 * py;
  const after: PreparedVolumeLeaf = { ...before, id: before.id.replace(/^Pleiades-/u, 'Pleiades-'), texturePath, widthPx: texels, heightPx: texels,
    boundsCssPixels: compileLeafBounds(joined, nextWidth, nextHeight), style: { ...before.style,
      width: `${nextWidth}px`, height: `${nextHeight}px`, transform: `matrix3d(${joined})`,
      backgroundSize: `${span[0]! * texels / n}px ${span[1]! * texels / n}px` } };
  return { leaf: after, maximumNativeRayErrorCssWorld: assertNativeRays(before, after, gutter) };
}
