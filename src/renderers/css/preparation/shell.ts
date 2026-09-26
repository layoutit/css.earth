/** Actual PolyCSS preparation of static triangular image coverage and retained transforms. */
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, resolveProjectiveQuadGuards, type Polygon } from '@layoutit/polycss';
import type { ShellRecipe } from '../../../preparation/shell/config.js';
import { unitVector, type ShellMesh } from '../../../preparation/shell/mesh.js';
import type { Vector3 } from '@cssearth/bake/volume';
import type { PreparedCssSurfaceShell } from '@cssearth/renderer/shell/types.ts';
import { SHELL_CORNER_PERMUTATIONS } from '@cssearth/renderer/shell/material-address.ts';
import { fitTextureGeometry, leafRasterScale, type ProjectiveGeometry } from '@cssearth/bake/scene';

/** A face drawn at TEXELS_PER_CSS_PIXEL. PolyCSS sizes the face's box at one CSS pixel per texel of its atlas tile, and
 * WebKit backs every composited face at that box times the device pixel ratio whatever its matrix: the heliosphere's 960
 * front faces, 32 px tiles, come to 35.4 MB of layers at DPR 3 by their boxes. The box shrinks by leafRasterScale and the
 * matrix scales it back, so a face covers its triangle and samples its tile exactly as before. */
export function shellFacePresentation(geometries: readonly Pick<ProjectiveGeometry, 'matrix' | 'leafWidth' | 'leafHeight' | 'backgroundPosition' | 'backgroundSize'>[],
  atlas: Pick<ShellRecipe['atlas'], 'tileSize' | 'columns' | 'frames'>, index: number) {
  const layouts = geometries.map(g => {
    const scale = leafRasterScale(atlas.tileSize, g.backgroundSize[0]!, 1);
    return fitTextureGeometry(g, g.leafWidth * scale, g.leafHeight * scale);
  }), geometry = layouts[0];
  if (!geometry || layouts.some(g => g.leafWidth !== geometry.leafWidth || g.leafHeight !== geometry.leafHeight ||
    String(g.backgroundSize) !== String(geometry.backgroundSize) || String(g.backgroundPosition) !== String(geometry.backgroundPosition))) {
    throw new TypeError(`Prepared corner permutations of surface triangle ${index} must share one retained image layout.`);
  }
  const rows = Math.ceil(atlas.frames / atlas.columns);
  return {
    style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`, transform: `matrix3d(${geometry.matrix})`,
      backgroundSize: `${geometry.backgroundSize[0]! * atlas.columns}px ${geometry.backgroundSize[1]! * rows}px` },
    atlasStepPixels: [geometry.backgroundSize[0]!, geometry.backgroundSize[1]!] as const,
    atlasOriginPixels: [geometry.backgroundPosition[0]!, geometry.backgroundPosition[1]!] as const,
    materialTransforms: layouts.map(g => `matrix3d(${g.matrix})`),
  };
}

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
    // PolyCSS projective images require four corners. Only the a,b,c half is opaque;
    // the rest of the retained parallelogram is transparent in the prepared atlas.
    // PolyCSS performs its X/Y reflection; the shared world camera accounts for it.
    const orders = recipe.atlas.facingLevels ? SHELL_CORNER_PERMUTATIONS : [SHELL_CORNER_PERMUTATIONS[0]];
    const geometries = orders.map(order => {
      const [p, q, r] = order.map(corner => [a, b, c][corner]!) as [Vector3, Vector3, Vector3];
      const inset = recipe.atlas.triangleInsetPixels ?? 0, size = recipe.atlas.tileSize - 2 * inset;
      // Retain a transparent guard around all three edges. The inset image triangle,
      // rather than the image rectangle, maps to the exact source p,q,r coordinates.
      const start = p.map((v, axis) => v - inset / size * (q[axis]! + r[axis]! - 2 * v)) as Vector3;
      const right = start.map((v, axis) => v + recipe.atlas.tileSize / size * (q[axis]! - p[axis]!)) as Vector3;
      const bottom = start.map((v, axis) => v + recipe.atlas.tileSize / size * (r[axis]! - p[axis]!)) as Vector3;
      const d = right.map((v, axis) => v + bottom[axis]! - start[axis]!) as Vector3;
      const polygon: Polygon = { vertices: [start, right, d, bottom],
        uvs: [[0, 1], [1, 1], [1, 0], [0, 0]], texture: atlasResource.path,
        textureImageSource: { url: atlasResource.path, width: recipe.atlas.tileSize, height: recipe.atlas.tileSize },
        texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
      const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: recipe.unitScale, layerElevation: recipe.unitScale, seamBleed: 0 }, { bleed: 0 });
      const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective', projectiveQuadGuards });
      if (!geometry) throw new TypeError(`PolyCSS could not prepare surface triangle ${index}.`);
      return geometry;
    });
    const { style, atlasStepPixels, atlasOriginPixels, materialTransforms } = shellFacePresentation(geometries, recipe.atlas, index);
    return { id: `face-${index}`, centerUnits, radialNormal: unitVector(centerUnits), faceNormal, style, atlasStepPixels, atlasOriginPixels,
      ...(recipe.atlas.facingLevels ? { vertexIndices: indices, materialTransforms } : {}) };
  });
  const units = recipe.frame.metersPerUnit;
  return { schema: 'cssearth-css-surface-shell@1', id, frame: recipe.frame, unitScale: recipe.unitScale,
    atlas: { path: atlasResource.path, ...recipe.atlas }, visibility: {
      hiddenInsideM: recipe.visibility.hiddenInsideUnits * units, fullUntilM: recipe.visibility.fullUntilUnits * units,
      hiddenBeyondM: recipe.visibility.hiddenBeyondUnits * units }, faces, resources: [atlasResource], provenance,
    ...(recipe.atlas.facingLevels ? { vertices: mesh.positionsUnits.map((positionUnits, i) => ({ positionUnits,
      radialNormal: unitVector(mesh.radialNormals[i]!) })) } : {}) };
}
