import { sha256 } from '../../../src/platform/sha256.mts';
import { isArray } from '../../../src/platform/is-array.mts';
import {matchesPreparationGenerator} from '../../prepare/preparation-generator.mts';
import type {SolidSurface,RadialState,RadialMaterialConfig,RadialMaterialSurface} from './solid-contract.mts';
import {parseRadialSnapshot} from './radial-source.mts';
import {requireArray,requireString} from '../../sources/source-values.mts';
interface ObservationTransfer {
  interiorTexels: number; counts: Record<string, number>; sources?: Record<string, number>;
  maximumSourceDistanceMeters: number; maximumPixelSeparationMeters: number; maximumPhotometricGain: number; method: string;
}
import type {SourceMesh, SourceScalar} from './contracts.mts';
import type {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import type {SimplifierFlags} from 'meshoptimizer/simplifier';
import type {RadialSimplification} from './radial-meshoptimizer.mts';
import {requireRecord,requireFiniteNumber} from '../../sources/source-values.mts';
import {parseRadialSource} from './radial-source.mts';
export interface TerrainMesh extends SourceMesh {
  coverage?: Record<string, unknown>; lockedPositions?: readonly number[][]; imagePlaneCoordinates?: number[][];
  sourceOrientation?: unknown; heightAt?(x: number, y: number): number | null;
}
type TerrainGrid = SourceScalar & Partial<TerrainMesh>;
function isTerrainMesh(grid: TerrainGrid): grid is TerrainMesh {
  return grid.positions !== undefined && grid.indices !== undefined && grid.bounds !== undefined && grid.vertices !== undefined && grid.faces !== undefined &&
    grid.hit !== undefined && grid.intersect !== undefined && grid.closestPoint !== undefined;
}
export function requireTerrainMesh(grid: TerrainGrid): TerrainMesh {
  if (!isTerrainMesh(grid)) throw new TypeError('Terrain operation requires a source mesh.');
  return grid;
}
function radialSampling(profile: {latitudeSegments?: number; longitudeSegments?: number; faceBudget: number}): RadialSamplingProfile {
  return {latitudeSegments:requireFiniteNumber(profile.latitudeSegments),longitudeSegments:requireFiniteNumber(profile.longitudeSegments),faceBudget:profile.faceBudget};
}
import type {PreparedTriangle, SourceSurfaceSample, SciencePalette} from './contracts.mts';
export interface RadialSamplingProfile {latitudeSegments: number; longitudeSegments: number; faceBudget: number;}
export type RadiusSampler = (longitude: number, latitude: number) => number | null;
type UnshadedFace = {vertices: readonly (readonly number[])[]; normal: number[]; estimated?: boolean; vertexNormals?: number[][]};
type RadialFaces = PreparedTriangle[] & {simplification?: Record<string, unknown>};
import { removeOppositeFacePairs } from './mesh-face-pairs.mts';
import { resolve, dirname } from 'node:path';
import { loadEllipsoidParameters } from './ellipsoid-parameters.mts';
import { loadContactEllipsoids } from './contact-ellipsoids.mts';
import { loadImageDem } from './image-dem.mts';
import { completeImageDem, reduceCompletedImageDem } from './image-dem-completion.mts';
import { repairImageDemDiagonals, measureImageDemReduction } from './image-dem-reduction.mts';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { buildSeamBleedPolygonEdges, computeSolidTrianglePlan, SOLID_TRIANGLE_BLEED, SOLID_TRIANGLE_CANONICAL_SIZE, BASE_TILE } from '@layoutit/polycss';
import { loadStlShape, loadPdsPlanetocentricShape, loadObjShape, loadPdsVertexFacetShape, loadPdsPlateShape, loadVrmlShape, loadPdsRadiusTable, closestTrianglePoint } from './obj-shape.mts';
import { createSourceSurfacePainter } from './scientific-raster.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';
import { loadPdsScalarGrid } from './pds-scalar-grid.mts';
import { loadPdsRadialTable, loadPdsRadialTableMesh } from './pds-radial-table.mts';
import { createRasterEmitter } from './solid-raster.mts';
import { renderRadialSnapshot } from './radial-snapshot.mts';
import { createSourceMeshLighting } from './source-mesh-lighting.mts';
import { linearToSrgb, srgbToLinear } from '../color-transfer.mts';
import { preparePdsConstraintMap } from './pds-constraint-map.mts';
import { orientObservedSurface, validateObservedReduction } from './open-surface.mts';
import {prepareNativePhotographicAtlas} from './native-photograph.mts';
import { neutralShapeAtlas, shapeFillIllumination } from './shape-material.mts';

/** Scales a photograph's encoded sRGB byte by an illumination factor in linear light. */
const litByte = (byte: number, illumination: number) => Math.round(255 * linearToSrgb(srgbToLinear(byte / 255) * illumination));

const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: readonly number[]) => a.map(v => v / Math.hypot(...a));

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
    ? await (await import('./radial-meshoptimizer.mts')).simplifyRadialTerrain(grid.sample, {...radialSampling(profile),simplification:profile.simplification}, scale)
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

/** Simplify the released topology before UV sampling. Original positions are
 * retained; geometry and the simplifier never enter the browser runtime. */
export async function simplifyRadialShape(mesh: TerrainMesh, profile: {faceBudget: number; sourceTopology?: string; simplification: RadialSimplification}, scale: number) {
  const { targetFaces, maximumErrorMeters } = profile.simplification;
  if (!mesh.positions || !mesh.indices || !Number.isInteger(targetFaces) || targetFaces < 4 ||
      !Number.isInteger(profile.faceBudget) || targetFaces > profile.faceBudget || profile.faceBudget > 4000 ||
      !(maximumErrorMeters > 0) || !Number.isFinite(maximumErrorMeters) || !(scale > 0) ||
      (['regularize', 'prune'] as const).some(key => profile.simplification[key] !== undefined && typeof profile.simplification[key] !== 'boolean')) throw new TypeError('Invalid source mesh simplification.');
  await MeshoptSimplifier.ready;
  const preserveSource = profile.simplification.method === 'source-meshoptimizer';
  const open = profile.sourceTopology === 'open';
  if (open && (!preserveSource || profile.simplification.prune)) throw new TypeError('Open observations must retain every source boundary.');
  let sourceIndices = Uint32Array.from(mesh.indices.flat()), positions = mesh.positions;
  if (preserveSource && !open) {
    // ICQ releases duplicate cube-edge positions. Weld before assigning UVs,
    // using the same meshoptimizer remap and physical compaction as Vesta.
    const remap = MeshoptSimplifier.generatePositionRemap(Float32Array.from(positions.flat()), 3);
    sourceIndices = sourceIndices.map(index => remap[index]);
    const [compact, count] = MeshoptSimplifier.compactMesh(sourceIndices);
    const unique = new Array<number[]>(count);
    for (let i = 0; i < compact.length; i++) if (compact[i] !== 0xffffffff) unique[compact[i]] = positions[i];
    positions = unique;
  }
  const flags: SimplifierFlags[] = ['ErrorAbsolute', ...(preserveSource && profile.simplification.regularize ? ['RegularizeLight' as const] : []),
    ...(preserveSource && profile.simplification.prune ? ['Prune' as const] : []), ...(open ? ['LockBorder' as const] : [])];
  // Source-defined junctions must survive reduction. Compare at the same
  // Float32 precision used by the position weld and meshoptimizer.
  const positionKey = (v: readonly number[]) => v.map(Math.fround).join(',');
  const locked = new Set((mesh.lockedPositions ?? []).map(positionKey));
  if (locked.size && (!preserveSource || [...locked].some(key => !positions.some(v => positionKey(v) === key)))) {
    throw new TypeError('Source mesh locks must identify retained source positions.');
  }
  const locks = locked.size ? Uint8Array.from(positions, v => locked.has(positionKey(v)) ? 1 : 0) : null;
  const imagePlane = Boolean(mesh.imageGrid);
  if (imagePlane && (!open || !preserveSource || locks)) throw new TypeError('Image DEMs require open source surface reduction.');
  const packedPositions = Float32Array.from(positions.flat());
  // Collapse in the image plane with scaled height as an attribute. This
  // preserves the height-field orientation, unlike unconstrained 3D collapse.
  const extent = imagePlane ? Math.max(...[0, 1].map(axis => mesh.bounds[1][axis] - mesh.bounds[0][axis])) : 0;
  const [simplified, error] = imagePlane
    ? MeshoptSimplifier.simplifyWithAttributes(sourceIndices,
      Float32Array.from(positions.flatMap(p => [p[0], p[1], 0])), 3,
      Float32Array.from(positions, p => p[2] / extent), 1, [1], null,
      targetFaces * 3, maximumErrorMeters, flags)
    : locks
    ? MeshoptSimplifier.simplifyWithAttributes(sourceIndices, packedPositions, 3,
      new Float32Array(), 0, [], locks, targetFaces * 3, maximumErrorMeters, flags)
    : MeshoptSimplifier.simplify(sourceIndices, packedPositions, 3, targetFaces * 3, maximumErrorMeters, flags);
  // Edge collapses can leave exactly coincident, oppositely wound face pairs
  // (zero-volume fins). Cancel only those exact pairs, then require closure.
  // No positions are moved and no source feature is approximated in cleanup.
  const cleaned = preserveSource ? removeOppositeFacePairs(simplified) : simplified;
  if (imagePlane && !mesh.imagePlaneCoordinates) throw new Error('Image DEM lacks its source plane coordinates.');
  const repaired = imagePlane && mesh.imagePlaneCoordinates ? repairImageDemDiagonals(cleaned, mesh.imagePlaneCoordinates) : null;
  const indices = repaired?.indices ?? cleaned;
  if (!indices.length || indices.length / 3 > targetFaces) throw new Error(`Source mesh reached ${indices.length / 3} faces at ${error} m estimated error; requested ${targetFaces} within ${maximumErrorMeters} m.`);
  const topology = open ? validateObservedReduction(sourceIndices, indices, positions)
    : preserveSource ? validateClosedMesh(indices, positions) : undefined;
  const imageReduction = repaired ? { diagonalFlips: repaired.flips,
    ...measureImageDemReduction(mesh, indices, maximumErrorMeters) } : undefined;
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push(Array.from(indices.subarray(i, i + 3),
    index => positions[index].map(value => value * scale)));
  const faces = surfaceTriangles(triangles, preserveSource);
  if (preserveSource) faces.simplification = { method: 'source-meshoptimizer', version: '1.2.0', flags,
    sourceFaces: mesh.indices.length, sourceVertices: mesh.positions.length, weldedVertices: positions.length,
    targetFaces, outputFaces: faces.length, removedOppositeFaces: (simplified.length - indices.length) / 3,
    maximumErrorMeters, ...(imagePlane ? { imageReduction, optimizerError: error,
      optimizerErrorUnits: 'Combined planar and normalized height metric; physical metre deviations measured separately.' }
      : { estimatedErrorMeters: error }), topology,
    ...(locks ? { lockedVertices: locks.reduce((sum, n) => sum + n, 0) } : {}),
    ...(open ? { sourceTopology: 'open', sourceOrientation: mesh.sourceOrientation } : {}) };
  return faces;
}

export { removeOppositeFacePairs } from './mesh-face-pairs.mts';

/** Edge incidents establish orientation without assuming a radial surface or
 * requiring a single component. The signed volume rejects inverted shells. */
export function validateClosedMesh(indices: Uint32Array | readonly number[], positions: readonly (readonly number[])[]) {
  const edges = new Map<string, number[]>(), vertices = new Set<number>(), parents = new Map<number, number>();
  const parent=(v: number)=>{const result=parents.get(v);if(result===undefined)throw new Error('Missing mesh connectivity vertex.');return result;};
  const find = (v: number) => { let root = v; while (parent(root) !== root) root = parent(root); return root; };
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3)), [a, b, c] = triangle.map(index => positions[index]);
    if (triangle.length !== 3 || ![a, b, c].every(v => v?.length === 3 && v.every(Number.isFinite)) ||
        !(Math.hypot(...cross(sub(b, a), sub(c, a))) > 0)) throw new Error('Source mesh has a degenerate face.');
    volume += dot(a, cross(b, c)) / 6;
    for (const v of triangle) { vertices.add(v); if (!parents.has(v)) parents.set(v, v); }
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
      const edge = edges.get(key) ?? [0, 0]; edge[0]++; edge[1] += a < b ? 1 : -1; edges.set(key, edge);
      const rootA = find(a), rootB = find(b); if (rootA !== rootB) parents.set(rootB, rootA);
    }
  }
  if (![...edges.values()].every(([count, winding]) => count === 2 && winding === 0) || !(volume > 0)) {
    throw new Error('Source mesh is not closed and consistently outward wound.');
  }
  return { vertices: vertices.size, edges: edges.size, faces: indices.length / 3,
    components: new Set([...vertices].map(find)).size, eulerCharacteristic: vertices.size - edges.size + indices.length / 3,
    signedVolumeCubicMeters: volume };
}

export function radialTriangles(sample: RadiusSampler, profile: RadialSamplingProfile, scale: number) {
  const { latitudeSegments: rows, longitudeSegments: columns, faceBudget } = profile;
  if (![rows, columns, faceBudget].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > faceBudget || faceBudget > 2000 || !(scale > 0)) throw new TypeError('Invalid radial mesh budget.');
  return sampleRadialTriangles(sample, rows, columns, scale);
}

export function sampleRadialTriangles(sample: RadiusSampler, rows: number, columns: number, scale: number, canonicalPoles = false) {
  if (![rows, columns].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > 262144 || !Number.isFinite(scale) || !(scale > 0)) throw new TypeError('Invalid radial sampling budget.');
  const point = (row: number, col: number) => {
    const pole = row === 0 || row === rows;
    const latitude = -90 + row * 180 / rows, longitude = canonicalPoles && pole ? 0 : col * 360 / columns;
    const radius = sample(longitude, latitude);
    if (radius === null || !(radius > 0)) throw new Error(`Terrain model has no radius at ${longitude}, ${latitude}; no geometry fallback is supplied.`);
    if (canonicalPoles && pole) return [0, 0, (row === 0 ? -1 : 1) * radius * scale];
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    return [radius * scale * Math.cos(lat) * Math.cos(lon), radius * scale * Math.cos(lat) * Math.sin(lon), radius * scale * Math.sin(lat)];
  };
  const faces: UnshadedFace[] = [];
  function triangle(a: number[], b: number[], c: number[]) {
    let normal = cross(sub(b, a), sub(c, a));
    if (dot(normal, a) < 0) { [b, c] = [c, b]; normal = normal.map(x => -x); }
    if (!(Math.hypot(...normal) > 1e-8)) throw new Error('Degenerate terrain face.');
    faces.push({ vertices: [a, b, c], normal: unit(normal) });
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = point(row, col), b = point(row, (col + 1) % columns), c = point(row + 1, (col + 1) % columns), d = point(row + 1, col);
    if (row !== 0) triangle(a, b, c);
    if (row !== rows - 1) triangle(a, c, d);
  }
  return shadeRadialFaces(faces);
}

function surfaceTriangles(triangles: readonly number[][][], preserveSourceWinding = false) {
  const faces = triangles.map(([a, b, c]) => {
    let normal = cross(sub(b, a), sub(c, a));
    if (!preserveSourceWinding && dot(normal, a) < 0) { [b, c] = [c, b]; normal = normal.map(x => -x); }
    if (!(Math.hypot(...normal) > 1e-8)) throw new Error('Degenerate terrain face.');
    return { vertices: [a, b, c], normal: unit(normal) };
  });
  return shadeRadialFaces(faces);
}

export function shadeRadialFaces(faces: UnshadedFace[]): RadialFaces {
  // Area-weighted shared normals remove lighting discontinuities without
  // changing any source-derived position or smoothing the physical silhouette.
  const key = (vertex: readonly number[]) => vertex.map(value => Math.round(value * 1e6)).join(',');
  const sums = new Map<string, number[]>();
  for (const face of faces) {
    const normal = cross(sub(face.vertices[1], face.vertices[0]), sub(face.vertices[2], face.vertices[0]));
    for (const vertex of face.vertices) {
      const id = key(vertex), sum = sums.get(id) ?? [0, 0, 0];
      sums.set(id, sum.map((value, axis) => value + normal[axis]));
    }
  }
  for (const face of faces) face.vertexNormals = face.vertices.map(vertex => unit(sums.get(key(vertex)) ?? (() => { throw new Error('Missing accumulated face normal.'); })()));
  // Every input face above now owns its prepared vertex normals; retain the array identity.
  return faces as RadialFaces;
}

/** Shared by the retained atlas and prepare-only context image. Coordinates
 * enter in display units and are immediately restored to physical metres. */
export function createRadialScienceColorSampler<T extends SourceSurfaceSample>(sourceSurface: {samplePoint(point: readonly number[]): T | null}, lens: SciencePalette, config: {geometry: {radiusKm: number; radius: number}; raster: {width: number}}) {
  const paint = createSourceSurfacePainter(lens);
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  return (point: readonly number[]) => {
    const sample = sourceSurface.samplePoint(point.map(n => n * metersPerUnit));
    if (sample) return { ...sample, color: paint(sample) };
    const longitude = Math.atan2(point[1], point[0]) * 180 / Math.PI;
    const latitude = Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI;
    return { color: missingCoverageColor(longitude, latitude, 360 / config.raster.width) };
  };
}

/** Replace a reviewed generated intermediate with regenerated bytes. */
async function replaceReviewedImage(sourceDirectory: string, path: string, bytes: Uint8Array) {
  const manifest = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8')));
  const entries = requireArray(manifest.generatedIntermediates).map(value => requireRecord(value)).filter(entry => entry.path === path);
  if (entries.length !== 1) throw new TypeError(`Reviewed image ${path} needs exactly one manifest entry.`);
  await writeFile(resolve(sourceDirectory, path), bytes);
}

/** Bake opaque triangle rasters, coordinates and fixed-epoch Sun illumination. The
 * renderer switches between these prepared banks through ordinary variants.
 */
export async function prepareRadialMaterials({ radial, surfaces, config, source, sourceDirectory, publicDirectory, outputDirectory, sunDirection,
  artifactId = null, snapshotEntries = source.manifest.generatedIntermediates, replaceReviewedImages = false }: {
    radial: Pick<RadialState,'width'|'height'|'faces'|'observationSurfaces'|'completion'|'coverage'|'simplification'> & {scientificSurfaces?:ReadonlyMap<string,{samplePoint?:(point:readonly number[])=>SourceSurfaceSample|null;report?:unknown}>;grid?:RadialState['grid'];plans:readonly {face:PreparedTriangle;rect:{x:number;y:number;width:number;height:number};matrix:readonly number[];geometry:{leafWidth:number;leafHeight:number}}[]}; surfaces: RadialMaterialSurface[]; config: RadialMaterialConfig;
    source: Pick<Awaited<ReturnType<typeof createSourceManifest>>, 'manifest'>;
    sourceDirectory?: string; publicDirectory: string; outputDirectory: string; sunDirection: readonly number[]; artifactId?: string | null;
    snapshotEntries?: Awaited<ReturnType<typeof createSourceManifest>>['manifest']['generatedIntermediates'];
    /** Write mode: a regenerated reviewed image replaces the source copy and its manifest pin; review it in the diff. */
    replaceReviewedImages?: boolean;
  }) {
  if (artifactId !== null && !/^[a-z][a-z0-9-]*$/.test(artifactId)) throw new TypeError('Invalid surface model artifact id.');
  const suffix = artifactId ? `-${artifactId}` : '';
  const { width: canonicalWidth, height: canonicalHeight } = radial;
  const lightingRecipe = config.geometry.radialTerrain.sourceLighting;
  const lighting = lightingRecipe ? createSourceMeshLighting(requireTerrainMesh(radial.grid ?? (()=>{throw new TypeError("Source lighting requires the original mesh.");})()), lightingRecipe,
    config.geometry.radiusKm * 1000 / config.geometry.radius, sunDirection) : null;
  // Every surface at a given scale uses these exact plans, points and normals.
  // Keep double-precision results across banks; ray tracing depends on geometry,
  // never on the selected photograph or scientific colour.
  const lightingByScale = new Map();
  let reusedLightingSamples = 0;
  const emit = createRasterEmitter(publicDirectory, config.publicBase);
  for (const surface of surfaces) {
    const neutralShape = surface.material && requireRecord(surface.material).kind === 'unobserved-neutral';
    if (neutralShape && !lighting && !surface.textureScale &&
        !config.geometry.radialTerrain.thumbnail && !radial.faces.some(face => face.estimated) && !radial.grid?.imageGrid) {
      const { flood, shadow } = neutralShapeAtlas(radial, sunDirection);
      const raw = { width: canonicalWidth, height: canonicalHeight, channels: 4 as const };
      // No quality: the emitter writes it in the lossy lane (lossy-lane.ts).
      const encoding = { alphaQuality: 100, effort: 4 };
      surface.surface = await emit(`${config.namespace}-${surface.id}-surface@2x.webp`, sharp(flood, { raw }), encoding);
      surface.shadowSurface = await emit(`${config.namespace}-${surface.id}-shadow@2x.webp`, sharp(shadow, { raw }), encoding);
      surface.polesUrl = surface.surface.url;
      surface.layout = { kind: 'triangle-atlas', width: canonicalWidth, height: canonicalHeight, faceCount: radial.faces.length };
      continue;
    }
    const photograph=config.raster.observations?.find(observation=>observation.id===surface.id);
    if(photograph?.nativePhotographicSampling) {
      if(!sourceDirectory || lightingRecipe || artifactId || surface.textureScale || radial.observationSurfaces?.has(surface.id) || radial.scientificSurfaces?.has(surface.id)) {
        throw new Error('Native photograph refresh requires the existing cylindrical-map terrain and lighting.');
      }
      const input=source.manifest.inputs.find(entry=>requireRecord(entry).lensId===surface.id && entry.consumers.includes('surfaces'));
      if(!input)throw new Error(`No pinned photograph for ${surface.id}.`);
      Object.assign(surface,await prepareNativePhotographicAtlas({radial,sourceDirectory,source:input,validity:photograph.validity,
        sampling:photograph.nativePhotographicSampling,publicDirectory,publicBase:config.publicBase,id:`${config.namespace}-${surface.id}`,
        sunDirection,mapWidth:config.raster.width}));
      continue;
    }
    // The retained CSS background size stays canonical. Only prepared image
    // pixels and atlas rectangles scale; each normalized UV keeps its owner.
    const scale = surface.textureScale ?? 1;
    const width = canonicalWidth * scale, height = canonicalHeight * scale;
    if (![1,.5,.25,.125].includes(scale) || ![width,height].every(n=>Number.isSafeInteger(n) && n>0)) {
      throw new TypeError('Scaled radial atlas dimensions must remain integral.');
    }
    const flood = Buffer.alloc(width * height * 4), shadow = Buffer.alloc(width * height * 4);
    let cachedLighting = lightingByScale.get(scale);
    if (lighting && !cachedLighting) {
      cachedLighting = new Float64Array(width * height * 2).fill(NaN);
      lightingByScale.set(scale, cachedLighting);
    }
    const nearest = surface.displaySampling === 'nearest';
    const sourceSurface = radial.scientificSurfaces?.get(surface.id);
    const scientific = sourceSurface && (config.raster.scientific ?? []).find(lens => lens.id === surface.id);
    if (sourceSurface && (!scientific || !sourceSurface.samplePoint || !scientific.surfaceSampling)) throw new Error('Terrain science requires its source-point sampler and bound profile.');
    const sampleScience = scientific && sourceSurface?.samplePoint
      ? createRadialScienceColorSampler({samplePoint: sourceSurface.samplePoint}, scientific, config) : null;
    const scalarSources = ['pds3-scalar-map', 'facet-scalars', 'vtk-cell-categories', 'obj-uv-fits'].includes(scientific?.format ?? '') && Buffer.alloc(width * height * 4);
    const observation = radial.observationSurfaces?.get(surface.id);
    // Direct source samplers never consume the flat preview, including its
    // withheld radial directions. Keep that map only for previews/minimaps.
    let map, info;
    if (!sourceSurface && !observation) {
      ({ data: map, info } = await sharp(resolve(publicDirectory, requireString(surface.map.url.split('/').at(-1))))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
    }
    const observedFrames = observation && requireArray(requireRecord(observation.report).frames);
    // Only a mosaic needs a source index; a single photograph's coverage mask already names its one source.
    const frames = observedFrames && observedFrames.length > 1 ? observedFrames.map(value => {const frame=requireRecord(value);return {...frame,id:requireString(frame.id)};}) : null;
    const sampleSources = frames && Buffer.alloc(width * height);
    const observationTransfer: ObservationTransfer | undefined = observation && { interiorTexels: 0, counts: {}, maximumSourceDistanceMeters: 0,
      maximumPixelSeparationMeters: 0, maximumPhotometricGain: 0,
      method: 'Closest full-source triangle point; all bilinear observation contributors checked before interpolation; atlas bleed clamped to retained face.' };
    const transfer = sourceSurface && scientific?.surfaceSampling && { sampledTexels: 0, withheldTexels: 0, maximumDistanceMeters: 0,
      includesAtlasBleed: true, triangleInteriorTexels: 0, withheldTriangleInteriorTexels: 0,
      maximumAcceptedDistanceMeters: scientific.surfaceSampling.maximumDistanceMeters,
      method: scalarSources ? requireRecord(sourceSurface.report).registration : 'Closest full-source triangle point in 3D; source barycentric radius and normal. No radial branch selection.' };
    for (const { face, rect, geometry, matrix: m } of radial.plans) {
      const [a, b, c] = face.vertices, ab = sub(b, a), ac = sub(c, a), aa = dot(ab, ab), bb = dot(ac, ac), abac = dot(ab, ac);
      const denominator = aa * bb - abac * abac;
      const rectWidth = rect.width * scale, rectHeight = rect.height * scale;
      const [n0, n1, n2] = face.vertexNormals;
      // The leaf clips its rectangle to the triangle it draws, base along the bottom and apex at the top centre, seam overlap included.
      // A texel is drawn only inside it or within the few texels filtering reads across an edge; texels farther out are not sampled,
      // and each takes the nearest sampled texel in its row. Distances are in leaf pixels, one texel each at scale 1.
      const W = geometry.leafWidth, H = geometry.leafHeight, slant = Math.hypot(W / 2, H), marginPixels = UNDRAWN_MARGIN_TEXELS * Math.max(W / rectWidth, H / rectHeight);
      const undrawn = new Uint8Array(rectWidth * rectHeight);
      for (let py = 0; py < rectHeight; py++) for (let px = 0; px < rectWidth; px++) {
        const x = (px + .5) * geometry.leafWidth / rectWidth, y = (py + .5) * geometry.leafHeight / rectHeight;
        const w = m[3] * x + m[7] * y + m[15];
        const point = [(m[1] * x + m[5] * y + m[13]) / w / BASE_TILE, (m[0] * x + m[4] * y + m[12]) / w / BASE_TILE, (m[2] * x + m[6] * y + m[14]) / w / BASE_TILE];
        // Scalar forms of dot, sub and unit in their exact operation order (dot's reduce starts from 0), so every texel is bit-identical.
        const ap0 = point[0] - a[0], ap1 = point[1] - a[1], ap2 = point[2] - a[2];
        const apab = 0 + ap0 * ab[0] + ap1 * ab[1] + ap2 * ab[2], apac = 0 + ap0 * ac[0] + ap1 * ac[1] + ap2 * ac[2];
        const u = (apab * bb - apac * abac) / denominator, v = (apac * aa - apab * abac) / denominator;
        // Outward distance past the left edge (0, H)–(W/2, 0) and the right edge (W/2, 0)–(W, H).
        const beyond = Math.max((H * (W / 2 - x) - (W / 2) * y) / slant, (H * (x - W / 2) - (W / 2) * y) / slant);
        if (beyond > marginPixels) { undrawn[py * rectWidth + px] = 1; continue; }
        // PolyCSS's native u primitive owns triangle coverage. Fill its entire
        // raster so antialiasing never samples a transparent triangle edge.
        const nx = n0[0] * (1 - u - v) + n1[0] * u + n2[0] * v, ny = n0[1] * (1 - u - v) + n1[1] * u + n2[1] * v, nz = n0[2] * (1 - u - v) + n1[2] * u + n2[2] * v;
        const length = Math.hypot(nx, ny, nz), normal = [nx / length, ny / length, nz / length];
        // Fixed-epoch directional illumination is baked in the body's frame.
        const lightIndex = ((rect.y * scale + py) * width + rect.x * scale + px) * 2;
        let light;
        if (!face.estimated && lighting) {
          if (Number.isNaN(cachedLighting[lightIndex])) {
            light = lighting.sample(point, normal);
            cachedLighting[lightIndex] = light.flood;
            cachedLighting[lightIndex + 1] = light.shadow;
          } else {
            light = { flood: cachedLighting[lightIndex], shadow: cachedLighting[lightIndex + 1] };
            reusedLightingSamples++;
          }
        }
        const sunDot = 0 + normal[0] * sunDirection[0] + normal[1] * sunDirection[1] + normal[2] * sunDirection[2];
        let illumination = light?.shadow ?? (.12 + .88 * Math.max(0, sunDot));
        const offset = ((rect.y * scale + py) * width + rect.x * scale + px) * 4;
        const clampedPoint = radial.grid?.imageGrid && closestTrianglePoint(point, a, ab, ac).point;
        const sourceMeters = config.geometry.radiusKm * 1000 / config.geometry.radius;
        const outsideSource = clampedPoint && (radial.grid?.heightAt ?? (() => {throw new Error("Image DEM lacks a source height sampler");}))(clampedPoint[0] * sourceMeters, clampedPoint[1] * sourceMeters) === null;
        if (face.estimated || outsideSource) {
          const color = missingCoverageColor(Math.atan2(point[1], point[0]) * 180 / Math.PI,
            Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 360 / config.raster.width);
          const interior = u >= 0 && v >= 0 && u + v <= 1;
          if (observationTransfer && interior) {
            observationTransfer.interiorTexels++;
            const reason = face.estimated ? 'estimated-geometry' : 'outside-source-footprint';
            observationTransfer.counts[reason] = (observationTransfer.counts[reason] ?? 0) + 1;
          }
          if (transfer) {
            transfer.sampledTexels++; transfer.withheldTexels++;
            if (interior) { transfer.triangleInteriorTexels++; transfer.withheldTriangleInteriorTexels++; }
          }
          for (let channel = 0; channel < 3; channel++) {
            flood[offset + channel] = color[channel];
            shadow[offset + channel] = observation ? litByte(color[channel], illumination) : Math.round(color[channel] * illumination);
          }
          flood[offset + 3] = shadow[offset + 3] = 255;
          continue;
        }
        if (observation && observationTransfer) {
          const sample = observation.samplePoint(closestTrianglePoint(point, a, ab, ac).point);
          if (sampleSources) sampleSources[offset / 4] = sample.reason !== undefined ? 0 : requireFiniteNumber(sample.frameIndex) + 1;
          const interior = u >= 0 && v >= 0 && u + v <= 1;
          if (interior) {
            observationTransfer.interiorTexels++;
            const key = sample.reason ?? 'accepted';
            observationTransfer.counts[key] = (observationTransfer.counts[key] ?? 0) + 1;
            if (sample.reason === undefined) {
              if (sample.frameId) {
                observationTransfer.sources ??= {};
                observationTransfer.sources[sample.frameId] = (observationTransfer.sources[sample.frameId] ?? 0) + 1;
              }
              observationTransfer.maximumSourceDistanceMeters = Math.max(observationTransfer.maximumSourceDistanceMeters, requireFiniteNumber(sample.distanceMeters));
              observationTransfer.maximumPixelSeparationMeters = Math.max(observationTransfer.maximumPixelSeparationMeters, requireFiniteNumber(sample.separationMeters));
              observationTransfer.maximumPhotometricGain = Math.max(observationTransfer.maximumPhotometricGain, requireFiniteNumber(sample.gain));
            }
          }
          for (let channel = 0; channel < 3; channel++) {
            // The observation's authored photometric treatment is already prepared. Uniform flood
            // preserves its measured detail on every side of the source mesh.
            flood[offset + channel] = sample.color[channel];
            // A photograph is light: its shading multiplies decoded linear light, never the encoded byte.
            shadow[offset + channel] = litByte(sample.color[channel], illumination);
          }
          flood[offset + 3] = shadow[offset + 3] = 255;
          continue;
        }
        if (sourceSurface && sampleScience && transfer && scientific) {
          // Clamp the raster bleed to this retained triangle, never to an
          // unrelated surface beyond its edge. Runtime primitive coverage is
          // unchanged; source projection and color are entirely prepared here.
          const clamped = closestTrianglePoint(point, a, ab, ac).point;
          const sample = sampleScience(clamped);
          if (scalarSources && 'sourceCell' in sample && sample.sourceCell !== undefined) scalarSources.writeUInt32LE(sample.sourceCell + 1, offset);
          transfer.sampledTexels++;
          const interior = u >= 0 && v >= 0 && u + v <= 1;
          if (interior) transfer.triangleInteriorTexels++;
          const color = sample.color;
          if ('radius' in sample) {
            if (scientific.format !== 'pds3-scalar-map') illumination = .12 + .88 * Math.max(0, dot(sample.normal, sunDirection));
            transfer.maximumDistanceMeters = Math.max(transfer.maximumDistanceMeters, sample.distanceMeters);
          } else {
            transfer.withheldTexels++;
            if (interior) transfer.withheldTriangleInteriorTexels++;
          }
          for (let channel = 0; channel < 3; channel++) {
            flood[offset + channel] = color[channel];
            shadow[offset + channel] = Math.round(color[channel] * illumination);
          }
          flood[offset + 3] = shadow[offset + 3] = 255;
          continue;
        }
        if (!info || !map) throw new Error('Terrain texture lacks its decoded source map.');
        const lon = (Math.atan2(point[1], point[0]) / (2 * Math.PI) + 1) % 1;
        const lat = Math.atan2(point[2], Math.hypot(point[0], point[1]));
        const sx = lon * info.width - .5, sy = Math.max(0, Math.min(info.height - 1, (.5 - lat / Math.PI) * info.height - .5));
        const x0 = (Math.floor(sx) + info.width) % info.width, x1 = (x0 + 1) % info.width, y0 = Math.floor(sy), y1 = Math.min(info.height - 1, y0 + 1), tx = sx - Math.floor(sx), ty = sy - y0;
        const nearestX = Math.floor(lon * info.width) % info.width;
        const nearestY = Math.max(0, Math.min(info.height - 1, Math.floor((.5 - lat / Math.PI) * info.height)));
        const fillIllumination = neutralShape ? shapeFillIllumination(sunDot) : (light ? light.flood : 1);
        for (let channel = 0; channel < 3; channel++) {
          const top = map[(y0 * info.width + x0) * 4 + channel] * (1 - tx) + map[(y0 * info.width + x1) * 4 + channel] * tx;
          const bottom = map[(y1 * info.width + x0) * 4 + channel] * (1 - tx) + map[(y1 * info.width + x1) * 4 + channel] * tx;
          const color = nearest ? map[(nearestY * info.width + nearestX) * 4 + channel] : top * (1 - ty) + bottom * ty;
          flood[offset + channel] = Math.round(color * fillIllumination);
          shadow[offset + channel] = Math.round((light ? color : Math.round(color)) * illumination);
        }
        flood[offset + 3] = shadow[offset + 3] = 255;
      }
      fillUndrawnTexels(undrawn, rectWidth, rectHeight, (py, from, to) => {
        const row = (rect.y * scale + py) * width + rect.x * scale, target = (row + to) * 4, source = (row + from) * 4;
        flood.copyWithin(target, source, source + 4); shadow.copyWithin(target, source, source + 4);
        if (scalarSources) scalarSources.copyWithin(target, source, source + 4);
        if (sampleSources) sampleSources[row + to] = sampleSources[row + from];
      });
    }
    // Scientific colours retain exact palette values; the numeric source index is preparation-only.
    // Photographs keep full chroma detail through sharp's smart subsampling.
    const encoding = scalarSources || nearest || scientific?.format === 'image-plane-dem' ? { lossless: true, effort: 4 }
      : { alphaQuality: 100, effort: 4 };
    surface.surface = await emit(`${config.namespace}-${surface.id}-surface@2x.webp`, sharp(flood, { raw: { width, height, channels: 4 } }), encoding);
    // A photograph that keeps its acquisition lighting has no second, epoch-lit atlas: Shadows shows it as photographed.
    if (observation?.retainsIllumination) delete surface.shadowSurface;
    else surface.shadowSurface = await emit(`${config.namespace}-${surface.id}-shadow@2x.webp`, sharp(shadow, { raw: { width, height, channels: 4 } }), encoding);
    surface.polesUrl = surface.surface.url;
    surface.layout = { kind: 'triangle-atlas', width, height, faceCount: radial.faces.length };
    if (config.geometry.radialTerrain.thumbnail && !observation && !sourceSurface) {
      const snapshot = await renderRadialSnapshot({ ...parseRadialSnapshot(config.geometry.radialTerrain.thumbnail), faces: radial.faces,
        map: resolve(publicDirectory, requireString(surface.map.url.split('/').at(-1))) });
      surface.thumbnail = await emit(`${config.namespace}-${surface.id}-thumbnail.webp`, sharp(snapshot).resize(48, 48)
        .extend({ left: 24, right: 24, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    }
    if (scientific?.format === 'image-plane-dem') {
      const snapshot = await renderRadialSnapshot({ ...parseRadialSnapshot(config.geometry.radialTerrain.thumbnail),
        faces: radial.faces, sampleSurface: sampleScience ?? undefined, ambient: 1, diffuse: 0 });
      surface.thumbnail = await emit(`${config.namespace}-${surface.id}-thumbnail.webp`, sharp(snapshot).resize(48, 48)
        .extend({ left: 24, right: 24, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    }
    if (transfer) requireRecord(surface.surfaceSampling).transfer = transfer;
    if (scalarSources && scientific) {
      const bytes = Buffer.from(JSON.stringify({ schema: 'cssearth-atlas-scalar-index@1', width, height,
        encoding: 'gzip-u32le-base64', layout: scientific.format === 'vtk-cell-categories'
          ? (scientific.symbols ? 'row-major; 0 withheld, 1 mapped background, otherwise SBMT feature ID + 1; includes atlas bleed' : 'row-major; 0 withheld, otherwise original VTK face ID + 1; includes atlas bleed')
          : 'row-major; 0 withheld, otherwise original table row (1-based); includes atlas bleed',
        source: surface.source, data: gzipSync(scalarSources, { level: 9 }).toString('base64') }) + '\n');
      const file = `${surface.id}-source-index.json`;
      await writeFile(resolve(outputDirectory, file), bytes);
      requireRecord(surface.scalarMap).sampleSources = { file, bytes: bytes.length, sha256: sha256(bytes), width, height };
      const nearest = scientific.format === 'facet-scalars' || scientific.displaySampling === 'nearest';
      const snapshot = await renderRadialSnapshot({ faces: radial.faces, sampleSurface: sampleScience ?? undefined, size: 96,
        longitudeDegrees: 30, latitudeDegrees: 30, ambient: 1, diffuse: 0,
        ...(nearest ? { displaySampling: 'nearest' } : {}) });
      surface.thumbnail = await emit(`${config.namespace}-${surface.id}-thumbnail.webp`, sharp(snapshot).resize(48, 48,
        { kernel: nearest ? 'nearest' : 'lanczos3' })
        .extend({ left: 24, right: 24, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    }
    if (observationTransfer) requireRecord(surface.observation).transfer = observationTransfer;
    if (sampleSources && frames) {
      const codes = { 0: 'no-qualified-observation', ...Object.fromEntries(frames.map((frame, i) => [i + 1, frame.id])) };
      const bytes = Buffer.from(JSON.stringify({ schema: 'cssearth-atlas-observation-index@1', width, height, codes,
        encoding: 'gzip-u8-base64', layout: 'row-major; one source code per atlas texel; includes triangle bleed',
        data: gzipSync(sampleSources, { level: 9 }).toString('base64') }) + '\n');
      const file = `${surface.id}-source-index.json`;
      await writeFile(resolve(outputDirectory, file), bytes);
      requireRecord(surface.observation).sampleSources = { file, bytes: bytes.length, sha256: sha256(bytes),
        width, height, includesAtlasBleed: true, codes };
    }
  }
  if (lighting) await writeFile(resolve(outputDirectory, `source-lighting${suffix}.json`), JSON.stringify({ ...lighting.report, reusedLightingSamples, recipe: lightingRecipe }) + '\n');
  for (const entry of snapshotEntries.filter(entry =>
    matchesPreparationGenerator(entry.generator, 'tools/objects/terrestrial-layers/radial-snapshot.mts'))) {
    const surface = surfaces.find(surface => surface.id === requireRecord(requireRecord(entry).recipe).lensId);
    if (!surface) throw new TypeError('Radial snapshot requires a prepared source lens.');
    const science = radial.scientificSurfaces?.get(surface.id);
    const observation = radial.observationSurfaces?.get(surface.id);
    const lens = science && (config.raster.scientific ?? []).find(lens => lens.id === surface.id);
    if (science && (!science.samplePoint || !lens)) throw new Error('Terrain snapshot requires its source-point sampler and bound profile.');
    const scienceSnapshot = science?.samplePoint && lens ? createRadialScienceColorSampler({samplePoint:science.samplePoint}, lens, config) : undefined;
    const png = await renderRadialSnapshot({ ...parseRadialSnapshot(requireRecord(entry).recipe), faces: radial.faces,
      ...(scienceSnapshot && lens ? { sampleSurface: scienceSnapshot,
        ...((lens.format === 'facet-scalars' || lens.displaySampling === 'nearest') ? { displaySampling: 'nearest' } : {}) } : {}),
      ...(observation ? { sampleSurface: observation.samplePoint } : {}),
      map: resolve(publicDirectory, requireString(surface.map.url.split('/').at(-1))) });
    const reviewed = sourceDirectory ? await readFile(resolve(sourceDirectory, entry.path)).catch(() => null) : null;
    if (reviewed && Buffer.compare(reviewed, png) === 0) continue;
    if (replaceReviewedImages && sourceDirectory) {
      await replaceReviewedImage(sourceDirectory, entry.path, png);
      console.log(`Replaced reviewed image source/${entry.path} (${png.length} bytes); review it in the diff.`);
      continue;
    }
    // The reviewed snapshot is tracked. Keep the regenerated bytes where an owner can inspect them.
    const review = resolve(process.cwd(), 'output/source-context', config.namespace, entry.path.split('/').at(-1) ?? 'context.png');
    await mkdir(dirname(review), { recursive: true });
    await writeFile(review, png);
    throw new Error(`Regenerated ${entry.path} differs from the reviewed image. The regenerated image is at ${review}; review it and copy it to source/${entry.path}.`);
  }
  await writeFile(resolve(outputDirectory, `terrain${suffix}.json`), JSON.stringify({ schema: 'cssearth-prepared-radial-terrain@1',
    source: config.geometry.radialTerrain, faces: radial.faces, width: canonicalWidth, height: canonicalHeight,
    ...(radial.completion ? { completion: radial.completion } : {}),
    ...(radial.coverage ? { coverage: radial.coverage } : {}),
    ...(radial.simplification ? { simplification: radial.simplification } : {}) }) + '\n');
  return surfaces;
}

/** Texels beyond a triangle that are still sampled: bilinear filtering reads one across an edge, and the second keeps a minified
 * edge from averaging in a copied colour. */
const UNDRAWN_MARGIN_TEXELS = 2;

/** Give each unsampled texel of a rectangle the nearest sampled texel in its row, the left one on a tie. */
export function fillUndrawnTexels(undrawn: Uint8Array, width: number, height: number, copy: (row: number, from: number, to: number) => void) {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let left = -1;
    for (let x = 0; x < width; x++) {
      if (!undrawn[row + x]) { left = x; continue; }
      let right = x + 1;
      while (right < width && undrawn[row + right]) right++;
      if (left < 0 && right >= width) throw new Error('A raster atlas row has no sampled texel.');
      for (let fill = x; fill < right; fill++) copy(y, left >= 0 && (right >= width || fill - left <= right - fill) ? left : right, fill);
      x = right - 1;
    }
  }
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
