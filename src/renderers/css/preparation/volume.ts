/** Actual PolyCSS preparation of static image geometry; no runtime image or mesh generation. */
import { balanceVolumeSlices } from './volume-order.js';
import { compileLeafBounds } from './leaf-bounds.js';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Axis, Vector3, VolumeRecipe } from '../../../preparation/volume/config.js';
import type { VolumeSlices } from '../../../preparation/volume/slices.js';
import type { PreparedCssVolume } from '../volume/types.js';
export type { PreparedCssVolume } from '../volume/types.js';

function referencePositionToUnits(position: Vector3, frame: DensityVolumeFrame): Vector3 {
  const x = (position[0] - frame.originM[0]) / frame.metersPerUnit;
  const y = (position[1] - frame.originM[1]) / frame.metersPerUnit;
  const z = (position[2] - frame.originM[2]) / frame.metersPerUnit;
  const qx = -frame.localToReferenceXyzw[0], qy = -frame.localToReferenceXyzw[1];
  const qz = -frame.localToReferenceXyzw[2], qw = frame.localToReferenceXyzw[3];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
}
export function compileCssVolume(options: { id: string; frame: DensityVolumeFrame; slices: VolumeSlices; recipe: Pick<VolumeRecipe, 'anchors'> }): PreparedCssVolume {
  const { id, frame, slices, recipe } = options;
  for (const bound of ['min', 'max'] as const) for (let axis = 0; axis < 3; axis++) {
    const actual = slices.boundsUnits[bound][axis], expected = frame.boundsUnits[bound][axis];
    if (actual === undefined || expected === undefined || Math.abs(actual - expected) > 1e-10 * Math.max(1, Math.abs(expected))) {
      throw new TypeError('Prepared geometry bounds disagree with the authored physical frame.');
    }
  }
  // A lossless-alpha empty slab contributes no light or extinction from any
  // camera. Exclude it from the portable render graph and resource closure;
  // retain every nonempty slab, however faint, and keep original plan indices.
  const leaves = slices.quads.flatMap((quad, index) => {
    if (quad.alphaCoverage === 0) return [];
    const polygon: Polygon = { vertices: quad.vertices, uvs: quad.uvs, texture: quad.texturePath,
      textureImageSource: { url: quad.texturePath, width: quad.widthPx, height: quad.heightPx },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
    const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: 50, layerElevation: 50, seamBleed: 0 });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    if (!geometry) throw new TypeError(`PolyCSS could not prepare volume leaf ${quad.id}.`);
    return [{ axis: quad.axis, id: quad.id, centerUnits: quad.center, texturePath: quad.texturePath,
      widthPx: quad.widthPx, heightPx: quad.heightPx,
      boundsCssPixels: compileLeafBounds(geometry.matrix, geometry.leafWidth, geometry.leafHeight),
      style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`,
        transform: `matrix3d(${geometry.matrix})`,
        backgroundSize: geometry.backgroundSize.map(value => `${value}px`).join(' '),
        backgroundPosition: geometry.backgroundPosition.map(value => `${value}px`).join(' ') } }];
  });
  const axes: Axis[] = ['x', 'y', 'z'];
  return { schema: 'cssearth-css-volume@1' as const, id, frame,
    anchors: recipe.anchors.map(anchor => ({ id: anchor.id, positionUnits: referencePositionToUnits(anchor.referencePositionM, frame) })),
    stacks: axes.map(axis => ({ axis, leaves: balanceVolumeSlices(
      leaves.filter(leaf => leaf.axis === axis).map(({ axis: _axis, ...leaf }) => leaf), axis) })),
    resources: slices.quads.filter(quad => quad.alphaCoverage !== 0).map(quad => ({ path: quad.texturePath, sha256: quad.sha256, bytes: quad.bytes,
      width: quad.widthPx, height: quad.heightPx })), provenance: slices.provenance, approximation: slices.approximation };
}
