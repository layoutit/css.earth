/** Actual PolyCSS preparation of static image geometry; no runtime image or mesh generation. */
import { balanceVolumeSlices } from './volume-order.js';
import { compileLeafBounds } from './leaf-bounds.js';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Axis, Vector3, VolumeRecipe } from '@cssearth/bake/volume';
import type { VolumeSlices } from '@cssearth/bake/volume/node';
import { fitTextureGeometry, leafRasterScale, type ProjectiveGeometry } from '../../../platform/projective-surface-raster.mts';
import type { PreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
import type { PreparedCssVolume, PreparedVolumeLeafStyle } from '../volume/types.js';
export type { PreparedCssVolume } from '../volume/types.js';

/** A PolyCSS image leaf drawn at TEXELS_PER_CSS_PIXEL. PolyCSS gives the leaf one CSS pixel per texel of the image its
 * background spans, `imagePixels` wide, and WebKit backs every composited leaf at that box times the device pixel ratio,
 * whatever its matrix: on a DPR 3 iPhone each of M42's 370×475 slices took 6.2 MB (275 MB of layers on its focus page)
 * and the Milky Way's 1024 px outer disc 36.9 MB. The box shrinks by leafRasterScale and the matrix scales it back, so
 * the leaf covers the same plane and samples the same texels. */
export function compileVolumeLeaf(geometry: Pick<ProjectiveGeometry, 'matrix' | 'leafWidth' | 'leafHeight' | 'backgroundPosition' | 'backgroundSize'>,
  imagePixels: number): { boundsCssPixels: PreparedLeafBounds | undefined; style: PreparedVolumeLeafStyle } {
  const scale = leafRasterScale(imagePixels, geometry.backgroundSize[0]!, 1);
  const leaf = fitTextureGeometry(geometry, geometry.leafWidth * scale, geometry.leafHeight * scale);
  const px = (values: readonly number[]) => values.map(value => `${value}px`).join(' ');
  return { boundsCssPixels: compileLeafBounds(leaf.matrix, leaf.leafWidth, leaf.leafHeight),
    style: { width: `${leaf.leafWidth}px`, height: `${leaf.leafHeight}px`, transform: `matrix3d(${leaf.matrix})`,
      backgroundSize: px(leaf.backgroundSize), backgroundPosition: px(leaf.backgroundPosition) } };
}

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
      widthPx: quad.widthPx, heightPx: quad.heightPx, ...compileVolumeLeaf(geometry, quad.widthPx) }];
  });
  const axes: Axis[] = ['x', 'y', 'z'];
  return { schema: 'cssearth-css-volume@1' as const, id, frame,
    anchors: recipe.anchors.map(anchor => ({ id: anchor.id, positionUnits: referencePositionToUnits(anchor.referencePositionM, frame) })),
    stacks: axes.map((axis, index) => {
      const quads = slices.quads.filter(quad => quad.axis === axis), normal = quads[0]?.normal;
      if (!normal || Math.abs(Math.hypot(...normal) - 1) > 1e-8 || quads.some(quad =>
        Math.abs(Math.abs(quad.normal.reduce((sum, value, i) => sum + value * normal[i]!, 0)) - 1) > 1e-8))
        throw new TypeError('Volume bank needs parallel unit normals.');
      const rotated = normal.some((value, i) => i !== index && Math.abs(value) > 1e-10);
      return { axis, ...(rotated ? { normalUnits: normal } : {}), leaves: balanceVolumeSlices(
        leaves.filter(leaf => leaf.axis === axis).map(({ axis: _axis, ...leaf }) => leaf), axis, rotated ? normal : undefined) };
    }),
    resources: slices.quads.filter(quad => quad.alphaCoverage !== 0).map(quad => ({ path: quad.texturePath, sha256: quad.sha256, bytes: quad.bytes,
      width: quad.widthPx, height: quad.heightPx })), provenance: slices.provenance, approximation: slices.approximation };
}
