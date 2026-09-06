/** Actual PolyCSS preparation of static triangular image coverage and retained transforms. */
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, resolveProjectiveQuadGuards, type Polygon } from '@layoutit/polycss';
import type { ShellRecipe } from '../../../preparation/shell/config.js';
import { unitVector, type ShellMesh } from '../../../preparation/shell/mesh.js';
import type { Vector3 } from '../../../preparation/volume/config.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';

export function compileCssSurfaceShell(options: { id: string; recipe: ShellRecipe; mesh: ShellMesh;
  atlasResource: PreparedCssSurfaceShell['resources'][number]; provenance: Readonly<Record<string, unknown>> }): PreparedCssSurfaceShell {
  const { id, recipe, mesh, atlasResource, provenance } = options;
  // Opaque seam expansion would overlap neighboring translucent triangles.
  const projectiveQuadGuards = resolveProjectiveQuadGuards({ bleed: 0 });
  for (const vertex of mesh.positionsUnits) for (let axis = 0; axis < 3; axis++) {
    if (vertex[axis]! < recipe.frame.boundsUnits.min[axis]! || vertex[axis]! > recipe.frame.boundsUnits.max[axis]!) {
      throw new TypeError('Prepared surface escapes the authored physical frame.');
    }
  }
  const faces = mesh.triangles.map((indices, index) => {
    const [a, b, c] = indices.map(i => mesh.positionsUnits[i]!) as [Vector3, Vector3, Vector3];
    const centerUnits = a.map((v, axis) => (v + b[axis]! + c[axis]!) / 3) as Vector3;
    const ab = b.map((v, axis) => v - a[axis]!) as Vector3, ac = c.map((v, axis) => v - a[axis]!) as Vector3;
    const faceNormal = unitVector([ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]);
    if (faceNormal.reduce((sum, v, axis) => sum + v * centerUnits[axis]!, 0) <= 0) throw new TypeError('Surface triangle must face outward.');
    const d = b.map((v, axis) => v + c[axis]! - a[axis]!) as Vector3;
    // PolyCSS projective images require four corners. Only the a,b,c half is opaque;
    // the rest of the retained parallelogram is transparent in the prepared atlas.
    // PolyCSS performs its X/Y reflection; the shared world camera accounts for it.
    const polygon: Polygon = { vertices: [a, b, d, c],
      uvs: [[0, 1], [1, 1], [1, 0], [0, 0]], texture: atlasResource.path,
      textureImageSource: { url: atlasResource.path, width: recipe.atlas.tileSize, height: recipe.atlas.tileSize },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
    const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: recipe.unitScale, layerElevation: recipe.unitScale, seamBleed: 0 }, { bleed: 0 });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective', projectiveQuadGuards });
    if (!geometry) throw new TypeError(`PolyCSS could not prepare surface triangle ${index}.`);
    const rows = Math.ceil(recipe.atlas.frames / recipe.atlas.columns);
    return { id: `face-${index}`, centerUnits, radialNormal: unitVector(centerUnits), faceNormal,
      style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`, transform: `matrix3d(${geometry.matrix})`,
        backgroundSize: `${geometry.backgroundSize[0] * recipe.atlas.columns}px ${geometry.backgroundSize[1] * rows}px` },
      atlasStepPixels: geometry.backgroundSize, atlasOriginPixels: geometry.backgroundPosition };
  });
  const units = recipe.frame.metersPerUnit;
  return { schema: 'cssearth-css-surface-shell@1', id, frame: recipe.frame, unitScale: recipe.unitScale,
    atlas: { path: atlasResource.path, ...recipe.atlas }, visibility: {
      hiddenInsideM: recipe.visibility.hiddenInsideUnits * units, fullUntilM: recipe.visibility.fullUntilUnits * units,
      hiddenBeyondM: recipe.visibility.hiddenBeyondUnits * units }, faces, resources: [atlasResource], provenance };
}
