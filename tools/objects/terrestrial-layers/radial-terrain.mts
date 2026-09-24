import type { PreparedTriangle } from './contracts.mts';
import type { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import type { RadialSamplingProfile, RadialFaces, TerrainGrid } from './radial-mesh.mts';
import { requireTerrainMesh, radialTriangles, simplifyRadialShape, simplifyRadialTerrain, shadeRadialFaces, validateClosedMesh } from './radial-mesh.mts';
import { isArray, requireRecord, requireArray, requireFiniteNumber } from '@cssearth/core';
import { matchesPreparationGenerator } from '../../prepare/preparation-generator.mts';
import { parseRadialSource } from './radial-source.mts';
import { resolve } from 'node:path';
import { loadEllipsoidParameters } from './ellipsoid-parameters.mts';
import { loadContactEllipsoids } from './contact-ellipsoids.mts';
import { loadImageDem } from './image-dem.mts';
import { completeImageDem, reduceCompletedImageDem } from './image-dem-completion.mts';
import { measureImageDemReduction } from './image-dem-reduction.mts';
import { buildSeamBleedPolygonEdges, computeSolidTrianglePlan, SOLID_TRIANGLE_BLEED, SOLID_TRIANGLE_CANONICAL_SIZE, BASE_TILE } from '@layoutit/polycss';
import { loadStlShape, loadPdsPlanetocentricShape, loadObjShape, loadPdsVertexFacetShape, loadPdsPlateShape, loadVrmlShape, loadPdsRadiusTable } from './obj-shape.mts';
import { loadPdsScalarGrid } from './pds-scalar-grid.mts';
import { loadPdsRadialTable, loadPdsRadialTableMesh } from './pds-radial-table.mts';
import { preparePdsConstraintMap } from './pds-constraint-map.mts';
import { orientObservedSurface } from './open-surface.mts';

const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);

function radialSampling(profile: {latitudeSegments?: number; longitudeSegments?: number; faceBudget: number}): RadialSamplingProfile {
  return {latitudeSegments:requireFiniteNumber(profile.latitudeSegments),longitudeSegments:requireFiniteNumber(profile.longitudeSegments),faceBudget:profile.faceBudget};
}

/** A sampled, source-owned radial model. No ellipsoid is inferred from the map. */
export async function loadRadialTerrain({config,sourceDirectory,source}: {
  config: {namespace: string; geometry: {radius: number; radiusKm: number; radialTerrain?: unknown}; raster?: unknown};
  sourceDirectory: string; source: Awaited<ReturnType<typeof createSourceManifest>>;
}) {
  if (!config.geometry.radialTerrain) return null;
  const input = requireRecord(config.geometry.radialTerrain);
  if (input.backfaceVisible !== undefined && typeof input.backfaceVisible !== 'boolean') {
    throw new TypeError('Radial backface visibility must be boolean.');
  }
  const profile = parseRadialSource(input);
  if (profile.format === 'contact-ellipsoids' && profile.simplification?.method !== 'source-meshoptimizer') {
    throw new TypeError('Contact bodies require full source connectivity.');
  }
  await source.validatePath(profile.path);
  const loader = profile.format === 'ellipsoid-parameters' ? loadEllipsoidParameters
    : profile.format === 'contact-ellipsoids' ? loadContactEllipsoids
    : profile.format === 'image-plane-dem' ? loadImageDem
    : profile.format === 'pds-planetocentric-plate' ? loadPdsPlanetocentricShape
    : profile.format === 'stl' ? loadStlShape : profile.format === 'pds-radius-table' ? loadPdsRadiusTable
    : ['wavefront-obj', 'wavefront-obj-zip'].includes(profile.format ?? '') ? loadObjShape
    : profile.format === 'vrml-mesh' ? loadVrmlShape
    : profile.format === 'pds-plate-model' ? loadPdsPlateShape
    : profile.format === 'pds-vertex-facet' ? loadPdsVertexFacetShape
    // A radial table simplified with source preservation needs its source mesh; a radially resampled one keeps the height field.
    : profile.format === 'pds-radial-table' ? (profile.simplification?.method === 'source-meshoptimizer' ? loadPdsRadialTableMesh : loadPdsRadialTable) : loadPdsScalarGrid;
  if (profile.sourceTopology !== undefined && profile.sourceTopology !== 'open') throw new TypeError('Unknown source mesh topology.');
  let grid: TerrainGrid = await loader(resolve(sourceDirectory, profile.path), profile.grid);
  if (profile.sourceTopology === 'open') {
    if (profile.simplification?.method !== 'source-meshoptimizer') throw new TypeError('Open observations require source-preserving simplification.');
    grid = orientObservedSurface(requireTerrainMesh(grid));
  }
  for (const entry of source.manifest.inputs.filter(entry =>
    matchesPreparationGenerator(requireRecord(entry).generator, 'tools/objects/terrestrial-layers/pds-constraint-map.mts'))) {
    await preparePdsConstraintMap(grid, requireRecord(entry).recipe);
  }
  const scale = config.geometry.radius / (config.geometry.radiusKm * 1000);
  if (profile.primitive !== undefined && profile.primitive !== 'u') throw new TypeError('Unknown radial triangle primitive.');
  const simplified = profile.simplification?.method === 'meshoptimizer'
    ? await simplifyRadialTerrain(grid.sample, {...radialSampling(profile),simplification:profile.simplification}, scale)
    : null;
  const faces: RadialFaces = simplified?.faces ?? (profile.simplification
    ? await simplifyRadialShape(requireTerrainMesh(grid), {...profile,simplification:profile.simplification}, scale)
    : radialTriangles(grid.sample, radialSampling(profile), scale));
  let completion;
  if (profile.completion) {
    if (!grid.imageGrid || profile.sourceTopology !== 'open' || !profile.simplification) throw new TypeError('Estimated completion requires an observed image DEM.');
    const mesh = requireTerrainMesh(grid);
    const envelope = completeImageDem(faces, profile.completion, scale);
    const completed = profile.completion.reduction
      ? await reduceCompletedImageDem(faces, envelope, profile.completion.reduction, scale)
      : { ...envelope, faces: [...faces, ...shadeRadialFaces(envelope.faces)] };
    const preparedFaces = profile.completion.reduction ? shadeRadialFaces(completed.faces) : completed.faces;
    if (!preparedFaces.every((face): face is PreparedTriangle => 'vertexNormals' in face && isArray(face.vertexNormals))) throw new Error('Completed terrain lacks prepared normals.');
    faces.splice(0, faces.length, ...preparedFaces);
    const sourceKey = (p: readonly number[]) => p.map(v => Math.round(v * 1e6)).join(',');
    const sourceIds = new Map(mesh.positions.map((p,i) => [sourceKey(p),i]));
    const measuredIndices = faces.filter(f => !f.estimated).flatMap(f => f.vertices.map(p => {
      const id = sourceIds.get(sourceKey(p.map(v => v / scale)));
      if (id === undefined) throw new Error('A measured face left the original source posts.');
      return id;
    }));
    const sourceFit = measureImageDemReduction(mesh, Uint32Array.from(measuredIndices), profile.simplification.maximumErrorMeters);
    const positions: number[][] = [], lookup = new Map<string, number>();
    const indices = faces.flatMap(face => face.vertices.map(p => {
      const key = p.join(',');
      if (!lookup.has(key)) { lookup.set(key, positions.length); positions.push(p.map(v => v / scale)); }
      return lookup.get(key)!;
    }));
    const topology = validateClosedMesh(indices, positions);
    if (topology.components !== 1 || topology.eulerCharacteristic !== 2) throw new Error('Estimated completion must close one nucleus.');
    completion = { ...completed.report, sourceFit, topology };
  }
  const layout = rasterAtlasLayout(faces, profile.texelsPerFace, textureQuantum(config));
  const leaves = layout.plans.map(({ geometry: g }) => ({ tag: 'u', className: `${config.namespace}-terrain-face`, polar: null,
    attributes: { 'data-polycss-texture-leaf-sizing': 'raster', 'data-polycss-texture-backend': 'atlas', 'data-polycss-texture-lighting': 'baked' },
    style: `transform:matrix3d(${g.matrix});background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px;--polycss-atlas-leaf-sizing:raster${profile.backfaceVisible ? ';backface-visibility:visible' : ''}` }));
  return { grid, faces, ...layout, leaves, ...(completion ? { completion } : {}),
    ...(grid.coverage ? { coverage: grid.coverage } : {}),
    ...(simplified || faces.simplification ? { simplification: simplified?.report ?? faces.simplification } : {}) };
}

/** The atlas pixel step every lens can scale to: a lens prepared at an eighth of the atlas needs rectangles in multiples of eight. */
function textureQuantum(config: {raster?: unknown}) {
  const raster = config.raster === undefined ? {} : requireRecord(config.raster);
  const scales = [...requireArray(raster.observations ?? []), ...requireArray(raster.scientific ?? [])]
    .flatMap(lens => requireRecord(lens).textureScale === undefined ? [] : [requireFiniteNumber(requireRecord(lens).textureScale)]);
  const quantum = Math.max(1, ...scales.map(scale => 1 / scale));
  if (!Number.isSafeInteger(quantum)) throw new TypeError('Texture scales must divide the atlas into whole pixels.');
  return quantum;
}

/** Raster sizing, as PolyCSS sizes a textured polygon: each face gets its own rectangle, sized by the face, so every face has the same
 * texel density and one leaf pixel is one atlas texel. The u leaf draws its triangle with the base along the bottom edge and the apex at
 * the top centre. Sizing the height by the apex's distance from the base midpoint keeps each texel within the square root of two of the
 * nominal density even for a thin, sheared face; the base is the edge that needs the fewest texels. The packed atlas, gaps included,
 * holds at most the body's budget of texels per face. */
/** Seam repair as PolyCSS prepares a solid mesh: an edge shared with a neighbouring face overlaps it by the default seam bleed, and a
 * face with no shared edge by the solid-triangle bleed, both in CSS pixels; interior slices fill whatever cracks remain
 * (tools/prepared-interior-slices.mts). */
/** Measured on Alphonsina, Ida, Itokawa, Mathilde, Achlys, Amalthea and comet 1P (DPR 2, five poses, both zooms): twelve CSS pixels
 * closes the cracks at every zoom, leaving at most 24 open crack pixels at maximum zoom against 16,708 without it, and costs no
 * surface detail (Itokawa's mean surface detail 1.572 without overlap, 1.669 with it). */
export const RADIAL_SEAM_REPAIR = { sharedEdgeAmount: 12, fallbackAmount: SOLID_TRIANGLE_BLEED } as const;

export function rasterAtlasLayout(faces: readonly PreparedTriangle[], texelsPerFace: number, quantum: number) {
  if (!Number.isSafeInteger(texelsPerFace) || texelsPerFace < 16 || !Number.isSafeInteger(quantum) || quantum < 1) throw new TypeError('Invalid radial texel budget.');
  const polygons = faces.map(face => ({ vertices: face.vertices.map(p => {if(p.length!==3)throw new Error('Invalid triangle point.');return [p[0],p[1],p[2]] as [number,number,number];}), color: '#888888' }));
  const seamEdges = buildSeamBleedPolygonEdges(polygons, { tileSize: BASE_TILE, layerElevation: BASE_TILE });
  const triangles = faces.map((face, index) => {
    const shared = seamEdges.get(index);
    const plan = computeSolidTrianglePlan(polygons[index], index,
      // The core planner takes CSS units, including its seam overlap.
      { tileSize: BASE_TILE, layerElevation: BASE_TILE, bleedRatio: 1,
        seamBleed: shared?.size ? RADIAL_SEAM_REPAIR.sharedEdgeAmount : RADIAL_SEAM_REPAIR.fallbackAmount, ...(shared ? { seamEdges: shared } : {}) },
      { primitive: 'corner-bevel', includeColor: false, matrixDecimals: 9 });
    if (!plan) throw new Error(`Radial face ${index} failed PolyCSS triangle preparation.`);
    // The planner's canonical leaf maps its bottom corners and top centre to the overlapped triangle.
    const m = plan.transformText.slice(9, -1).split(',').map(Number), size = SOLID_TRIANGLE_CANONICAL_SIZE;
    const at = (x: number, y: number) => [0, 1, 2].map(i => m[i] * x + m[4 + i] * y + m[12 + i]);
    const corners = [at(0, size), at(size, size), at(size / 2, 0)];
    let best: { base: number; length: number; rise: number } | undefined;
    for (let base = 0; base < 3; base++) {
      const a = corners[base], b = corners[(base + 1) % 3], c = corners[(base + 2) % 3];
      const length = Math.hypot(...sub(b, a)), rise = Math.hypot(...sub(c, a.map((v, i) => (v + b[i]) / 2)));
      if (!best || length * rise < best.length * best.rise) best = { base, length, rise };
    }
    return { face, corners, normal: [m[8], m[9], m[10]], ...best! };
  });
  const budget = texelsPerFace * faces.length, step = (n: number) => Math.max(2, Math.ceil(n / quantum)) * quantum;
  // Shelf packing, tallest rows first, on a near-square page.
  const pack = (density: number) => {
    const sizes = triangles.map(t => [step(t.length / density), step(t.rise / density)]);
    const area = sizes.reduce((sum, [w, h]) => sum + w * h, 0);
    const width = Math.max(...sizes.map(([w]) => w), Math.ceil(Math.sqrt(area) / quantum) * quantum);
    const order = sizes.map((_, i) => i).sort((a, b) => sizes[b][1] - sizes[a][1] || a - b), rects: { x: number; y: number; width: number; height: number }[] = [];
    let x = 0, y = 0, row = 0;
    for (const i of order) {
      const [w, h] = sizes[i];
      if (x + w > width) { x = 0; y += row; row = 0; }
      rects[i] = { x, y, width: w, height: h }; x += w; row = Math.max(row, h);
    }
    return { rects, width, height: y + row };
  };
  // The finest density whose packed page fits the budget.
  let fine = 0, coarse = Math.max(...triangles.map(t => Math.max(t.length, t.rise)));
  const fits = (density: number) => { const page = pack(density); return page.width * page.height <= budget; };
  while (!fits(coarse)) coarse *= 2;
  for (let i = 0; i < 40; i++) { const middle = (fine + coarse) / 2; if (middle > 0 && fits(middle)) coarse = middle; else fine = middle; }
  const { rects, width, height } = pack(coarse);
  if (width > 16383 || height > 16383) throw new Error(`Radial atlas ${width}x${height} exceeds WebP dimensions.`);
  const plans = triangles.map((t, index) => {
    const rect = rects[index], a = t.corners[t.base], b = t.corners[(t.base + 1) % 3], c = t.corners[(t.base + 2) % 3];
    const apex = sub(c, a.map((v, i) => (v + b[i]) / 2));
    const matrix = [...sub(b, a).map(v => v / rect.width), 0, ...apex.map(v => -v / rect.height), 0, ...t.normal, 0, ...a.map((v, i) => v + apex[i]), 1];
    const geometry = { matrix: matrix.join(','), leafWidth: rect.width, leafHeight: rect.height, backgroundPosition: [-rect.x, -rect.y], backgroundSize: [width, height] };
    return { face: t.face, rect, geometry, matrix };
  });
  return { plans, width, height };
}
