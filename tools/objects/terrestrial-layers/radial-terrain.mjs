import { resolve } from 'node:path';
import { loadContactEllipsoids } from './contact-ellipsoids.mjs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { computeSolidTrianglePlan, SOLID_TRIANGLE_CANONICAL_SIZE, SOLID_TRIANGLE_BLEED, BASE_TILE } from '@layoutit/polycss';
import { loadStlShape, loadPdsPlanetocentricShape, loadObjShape, loadPdsVertexFacetShape, loadPdsPlateShape, loadVrmlShape, loadPdsRadiusTable, closestTrianglePoint } from './obj-shape.mjs';
import { createSourceSurfacePainter } from './scientific-raster.mjs';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mjs';
import { loadPdsScalarGrid } from './pds-scalar-grid.mjs';
import { loadPdsRadialTable } from './pds-radial-table.mjs';
import { createRasterEmitter } from './solid-raster.mjs';
import { renderRadialSnapshot } from './radial-snapshot.mjs';
import { createSourceMeshLighting } from './source-mesh-lighting.mjs';
import { preparePdsConstraintMap } from './pds-constraint-map.mjs';
import { orientObservedSurface, validateObservedReduction } from './open-surface.mjs';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => a.map(v => v / Math.hypot(...a));

/** A sampled, source-owned radial model. No ellipsoid is inferred from the map. */
export async function loadRadialTerrain({ config, sourceDirectory, source }) {
  const profile = config.geometry.radialTerrain;
  if (!profile) return null;
  if (profile.backfaceVisible !== undefined && typeof profile.backfaceVisible !== 'boolean') {
    throw new TypeError('Radial backface visibility must be boolean.');
  }
  if (profile.format === 'contact-ellipsoids' && profile.simplification?.method !== 'source-meshoptimizer') {
    throw new TypeError('Contact bodies require full source connectivity.');
  }
  await source.validatePath(profile.path);
  const loader = profile.format === 'contact-ellipsoids' ? loadContactEllipsoids
    : profile.format === 'pds-planetocentric-plate' ? loadPdsPlanetocentricShape
    : profile.format === 'stl' ? loadStlShape : profile.format === 'pds-radius-table' ? loadPdsRadiusTable
    : ['wavefront-obj', 'wavefront-obj-zip'].includes(profile.format) ? loadObjShape
    : profile.format === 'vrml-mesh' ? loadVrmlShape
    : profile.format === 'pds-plate-model' ? loadPdsPlateShape
    : profile.format === 'pds-vertex-facet' ? loadPdsVertexFacetShape
    : profile.format === 'pds-radial-table' ? loadPdsRadialTable : loadPdsScalarGrid;
  if (profile.sourceTopology !== undefined && profile.sourceTopology !== 'open') throw new TypeError('Unknown source mesh topology.');
  let grid = await loader(resolve(sourceDirectory, profile.path), profile.grid);
  if (profile.sourceTopology === 'open') {
    if (profile.simplification?.method !== 'source-meshoptimizer') throw new TypeError('Open observations require source-preserving simplification.');
    grid = orientObservedSurface(grid);
  }
  for (const entry of source.manifest.inputs.filter(entry =>
    entry.generator === 'tools/objects/terrestrial-layers/pds-constraint-map.mjs')) {
    source.assertBytes(entry, await preparePdsConstraintMap(grid, entry.recipe));
  }
  const scale = config.geometry.radius / (config.geometry.radiusKm * 1000);
  if (profile.primitive !== undefined && profile.primitive !== 'u') throw new TypeError('Unknown radial triangle primitive.');
  const simplified = profile.simplification?.method === 'meshoptimizer'
    ? await (await import('./radial-meshoptimizer.mjs')).simplifyRadialTerrain(grid.sample, profile, scale)
    : null;
  const faces = simplified?.faces ?? (profile.simplification
    ? await simplifyRadialShape(grid, profile, scale)
    : radialTriangles(grid.sample, profile, scale));
  const tileSize = profile.tileSize, columns = profile.atlasColumns;
  if (![tileSize, columns].every(value => Number.isInteger(value) && value > 0) || tileSize > 512 || columns > 64) throw new TypeError('Invalid radial texture layout.');
  const width = columns * tileSize, height = Math.ceil(faces.length / columns) * tileSize;
  const plans = faces.map((face, index) => {
    const rect = { x: index % columns * tileSize, y: Math.floor(index / columns) * tileSize, width: tileSize, height: tileSize };
    const plan = computeSolidTrianglePlan({ vertices: face.vertices, color: '#888888' }, index,
      // The core planner takes CSS units, including its seam overlap. Scale
      // that overlap with the source coordinates, as with tile/elevation.
      { tileSize: BASE_TILE, layerElevation: BASE_TILE, bleedRatio: 1, seamBleed: SOLID_TRIANGLE_BLEED * BASE_TILE },
      { primitive: 'corner-bevel', includeColor: false, matrixDecimals: 9 });
    if (!plan) throw new Error(`Radial face ${index} failed PolyCSS triangle preparation.`);
    // The same raster sizing transport used by Mario: the u leaf matches its
    // prepared texel cell, and the inverse basis scale preserves the geometry.
    const matrix = plan.transformText.slice(9, -1).split(',').map(Number);
    for (const component of [0, 1, 2, 4, 5, 6]) matrix[component] *= SOLID_TRIANGLE_CANONICAL_SIZE / tileSize;
    const geometry = { matrix: matrix.join(','), leafWidth: tileSize, leafHeight: tileSize,
      backgroundPosition: [-rect.x, -rect.y], backgroundSize: [width, height] };
    return { face, rect, geometry, matrix };
  });
  const leaves = plans.map(({ geometry: g }) => ({ tag: 'u', className: `${config.namespace}-terrain-face`, polar: null,
    attributes: { 'data-polycss-texture-leaf-sizing': 'raster', 'data-polycss-texture-backend': 'atlas', 'data-polycss-texture-lighting': 'baked' },
    style: `transform:matrix3d(${g.matrix});background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px;--polycss-atlas-leaf-sizing:raster${profile.backfaceVisible ? ';backface-visibility:visible' : ''}` }));
  return { grid, faces, plans, leaves, width, height, tileSize,
    ...(grid.coverage ? { coverage: grid.coverage } : {}),
    ...(simplified || faces.simplification ? { simplification: simplified?.report ?? faces.simplification } : {}) };
}

/** Simplify the released topology before UV sampling. Original positions are
 * retained; geometry and the simplifier never enter the browser runtime. */
export async function simplifyRadialShape(mesh, profile, scale) {
  const { targetFaces, maximumErrorMeters } = profile.simplification;
  if (!mesh.positions || !mesh.indices || !Number.isInteger(targetFaces) || targetFaces < 4 ||
      !Number.isInteger(profile.faceBudget) || targetFaces > profile.faceBudget || profile.faceBudget > 2000 ||
      !(maximumErrorMeters > 0) || !Number.isFinite(maximumErrorMeters) || !(scale > 0) ||
      ['regularize', 'prune'].some(key => profile.simplification[key] !== undefined && typeof profile.simplification[key] !== 'boolean')) throw new TypeError('Invalid source mesh simplification.');
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
    const unique = new Array(count);
    for (let i = 0; i < compact.length; i++) if (compact[i] !== 0xffffffff) unique[compact[i]] = positions[i];
    positions = unique;
  }
  const flags = ['ErrorAbsolute', ...(preserveSource && profile.simplification.regularize ? ['RegularizeLight'] : []),
    ...(preserveSource && profile.simplification.prune ? ['Prune'] : []), ...(open ? ['LockBorder'] : [])];
  // Source-defined junctions must survive reduction. Compare at the same
  // Float32 precision used by the position weld and meshoptimizer.
  const positionKey = v => v.map(Math.fround).join(',');
  const locked = new Set((mesh.lockedPositions ?? []).map(positionKey));
  if (locked.size && (!preserveSource || [...locked].some(key => !positions.some(v => positionKey(v) === key)))) {
    throw new TypeError('Source mesh locks must identify retained source positions.');
  }
  const locks = locked.size ? Uint8Array.from(positions, v => locked.has(positionKey(v)) ? 1 : 0) : null;
  const packedPositions = Float32Array.from(positions.flat());
  const [simplified, error] = locks
    ? MeshoptSimplifier.simplifyWithAttributes(sourceIndices, packedPositions, 3,
      new Float32Array(), 0, [], locks, targetFaces * 3, maximumErrorMeters, flags)
    : MeshoptSimplifier.simplify(sourceIndices, packedPositions, 3, targetFaces * 3, maximumErrorMeters, flags);
  // Edge collapses can leave exactly coincident, oppositely wound face pairs
  // (zero-volume fins). Cancel only those exact pairs, then require closure.
  // No positions are moved and no source feature is approximated in cleanup.
  const indices = preserveSource ? removeOppositeFacePairs(simplified) : simplified;
  if (!indices.length || indices.length / 3 > targetFaces) throw new Error(`Source mesh reached ${indices.length / 3} faces at ${error} m estimated error; requested ${targetFaces} within ${maximumErrorMeters} m.`);
  const topology = open ? validateObservedReduction(sourceIndices, indices, positions)
    : preserveSource ? validateClosedMesh(indices, positions) : undefined;
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push(Array.from(indices.subarray(i, i + 3),
    index => positions[index].map(value => value * scale)));
  const faces = surfaceTriangles(triangles, preserveSource);
  if (preserveSource) faces.simplification = { method: 'source-meshoptimizer', version: '1.2.0', flags,
    sourceFaces: mesh.indices.length, sourceVertices: mesh.positions.length, weldedVertices: positions.length,
    targetFaces, outputFaces: faces.length, removedOppositeFaces: (simplified.length - indices.length) / 3,
    maximumErrorMeters, estimatedErrorMeters: error, topology,
    ...(locks ? { lockedVertices: locks.reduce((sum, n) => sum + n, 0) } : {}),
    ...(open ? { sourceTopology: 'open', sourceOrientation: mesh.sourceOrientation } : {}) };
  return faces;
}

export function removeOppositeFacePairs(indices) {
  const seen = new Map(), removed = new Set();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3)), sorted = [...triangle].sort((a, b) => a - b);
    const key = sorted.join(','), previous = seen.get(key);
    if (!previous) { seen.set(key, { offset: i, triangle }); continue; }
    const index = previous.triangle.indexOf(triangle[0]);
    if (removed.has(previous.offset) || previous.triangle[(index + 2) % 3] !== triangle[1]) {
      throw new Error('Source mesh has ambiguous duplicate faces.');
    }
    removed.add(previous.offset); removed.add(i);
  }
  return indices.filter((_, i) => !removed.has(i - i % 3));
}

/** Edge incidents establish orientation without assuming a radial surface or
 * requiring a single component. The signed volume rejects inverted shells. */
export function validateClosedMesh(indices, positions) {
  const edges = new Map(), vertices = new Set(), parents = new Map();
  const find = v => { let root = v; while (parents.get(root) !== root) root = parents.get(root); return root; };
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

export function radialTriangles(sample, profile, scale) {
  const { latitudeSegments: rows, longitudeSegments: columns, faceBudget } = profile;
  if (![rows, columns, faceBudget].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > faceBudget || faceBudget > 2000 || !(scale > 0)) throw new TypeError('Invalid radial mesh budget.');
  return sampleRadialTriangles(sample, rows, columns, scale);
}

export function sampleRadialTriangles(sample, rows, columns, scale, canonicalPoles = false) {
  if (![rows, columns].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > 262144 || !Number.isFinite(scale) || !(scale > 0)) throw new TypeError('Invalid radial sampling budget.');
  const point = (row, col) => {
    const pole = row === 0 || row === rows;
    const latitude = -90 + row * 180 / rows, longitude = canonicalPoles && pole ? 0 : col * 360 / columns;
    const radius = sample(longitude, latitude);
    if (!(radius > 0)) throw new Error(`Terrain model has no radius at ${longitude}, ${latitude}; no geometry fallback is supplied.`);
    if (canonicalPoles && pole) return [0, 0, (row === 0 ? -1 : 1) * radius * scale];
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    return [radius * scale * Math.cos(lat) * Math.cos(lon), radius * scale * Math.cos(lat) * Math.sin(lon), radius * scale * Math.sin(lat)];
  };
  const faces = [];
  function triangle(a, b, c) {
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

function surfaceTriangles(triangles, preserveSourceWinding = false) {
  const faces = triangles.map(([a, b, c]) => {
    let normal = cross(sub(b, a), sub(c, a));
    if (!preserveSourceWinding && dot(normal, a) < 0) { [b, c] = [c, b]; normal = normal.map(x => -x); }
    if (!(Math.hypot(...normal) > 1e-8)) throw new Error('Degenerate terrain face.');
    return { vertices: [a, b, c], normal: unit(normal) };
  });
  return shadeRadialFaces(faces);
}

export function shadeRadialFaces(faces) {
  // Area-weighted shared normals remove lighting discontinuities without
  // changing any source-derived position or smoothing the physical silhouette.
  const key = vertex => vertex.map(value => Math.round(value * 1e6)).join(',');
  const sums = new Map();
  for (const face of faces) {
    const normal = cross(sub(face.vertices[1], face.vertices[0]), sub(face.vertices[2], face.vertices[0]));
    for (const vertex of face.vertices) {
      const id = key(vertex), sum = sums.get(id) ?? [0, 0, 0];
      sums.set(id, sum.map((value, axis) => value + normal[axis]));
    }
  }
  for (const face of faces) face.vertexNormals = face.vertices.map(vertex => unit(sums.get(key(vertex))));
  return faces;
}

/** Shared by the retained atlas and prepare-only context image. Coordinates
 * enter in display units and are immediately restored to physical metres. */
export function createRadialScienceColorSampler(sourceSurface, lens, config) {
  const paint = createSourceSurfacePainter(lens);
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  return point => {
    const sample = sourceSurface.samplePoint(point.map(n => n * metersPerUnit));
    if (sample) return { ...sample, color: paint(sample) };
    const longitude = Math.atan2(point[1], point[0]) * 180 / Math.PI;
    const latitude = Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI;
    return { color: missingCoverageColor(longitude, latitude, 360 / config.raster.width) };
  };
}

/** Bake opaque triangle rasters, coordinates and fixed-epoch Sun illumination. The
 * renderer switches between these prepared banks through ordinary variants.
 */
export async function prepareRadialMaterials({ radial, surfaces, config, source, publicDirectory, outputDirectory, sunDirection,
  artifactId = null, snapshotEntries = source.manifest.generatedIntermediates }) {
  if (artifactId !== null && !/^[a-z][a-z0-9-]*$/.test(artifactId)) throw new TypeError('Invalid surface model artifact id.');
  const suffix = artifactId ? `-${artifactId}` : '';
  const { width, height, tileSize } = radial;
  const lightingRecipe = config.geometry.radialTerrain.sourceLighting;
  const lighting = lightingRecipe ? createSourceMeshLighting(radial.grid, lightingRecipe,
    config.geometry.radiusKm * 1000 / config.geometry.radius, sunDirection) : null;
  const emit = createRasterEmitter(publicDirectory, config.publicBase);
  for (const surface of surfaces) {
    const flood = Buffer.alloc(width * height * 4), shadow = Buffer.alloc(width * height * 4);
    const sourceSurface = radial.scientificSurfaces?.get(surface.id);
    const scientific = sourceSurface && config.raster.scientific.find(lens => lens.id === surface.id);
    const sampleScience = scientific && createRadialScienceColorSampler(sourceSurface, scientific, config);
    const scalarSources = ['pds3-scalar-map', 'facet-scalars'].includes(scientific?.format) && Buffer.alloc(width * height * 4);
    const observation = radial.observationSurfaces?.get(surface.id);
    // Direct source samplers never consume the flat preview, including its
    // withheld radial directions. Keep that map only for previews/minimaps.
    let map, info;
    if (!sourceSurface && !observation) {
      ({ data: map, info } = await sharp(resolve(publicDirectory, surface.map.url.split('/').at(-1)))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
    }
    const sampleSources = observation?.report.frames && Buffer.alloc(width * height);
    const observationTransfer = observation && { interiorTexels: 0, counts: {}, maximumSourceDistanceMeters: 0,
      maximumPixelSeparationMeters: 0, maximumPhotometricGain: 0,
      method: 'Closest full-source triangle point; all bilinear observation contributors checked before interpolation; atlas bleed clamped to retained face.' };
    const transfer = sourceSurface && { sampledTexels: 0, withheldTexels: 0, maximumDistanceMeters: 0,
      includesAtlasBleed: true, triangleInteriorTexels: 0, withheldTriangleInteriorTexels: 0,
      maximumAcceptedDistanceMeters: scientific.surfaceSampling.maximumDistanceMeters,
      method: scalarSources ? sourceSurface.report.registration : 'Closest full-source triangle point in 3D; source barycentric radius and normal. No radial branch selection.' };
    for (const { face, rect, geometry, matrix: m } of radial.plans) {
      const [a, b, c] = face.vertices, ab = sub(b, a), ac = sub(c, a), aa = dot(ab, ab), bb = dot(ac, ac), abac = dot(ab, ac);
      const denominator = aa * bb - abac * abac;
      for (let py = 0; py < tileSize; py++) for (let px = 0; px < tileSize; px++) {
        const x = (px + .5) * geometry.leafWidth / tileSize, y = (py + .5) * geometry.leafHeight / tileSize;
        const w = m[3] * x + m[7] * y + m[15];
        const css = [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w, (m[2] * x + m[6] * y + m[14]) / w];
        const point = [css[1] / BASE_TILE, css[0] / BASE_TILE, css[2] / BASE_TILE];
        const ap = sub(point, a), u = (dot(ap, ab) * bb - dot(ap, ac) * abac) / denominator, v = (dot(ap, ac) * aa - dot(ap, ab) * abac) / denominator;
        // PolyCSS's native u primitive owns triangle coverage. Fill its entire
        // raster so antialiasing never samples a transparent triangle edge.
        const normal = unit(face.vertexNormals[0].map((n, i) => n * (1 - u - v) + face.vertexNormals[1][i] * u + face.vertexNormals[2][i] * v));
        // Fixed-epoch directional illumination is baked in the body's frame.
        const light = lighting?.sample(point, normal);
        let illumination = light?.shadow ?? (.12 + .88 * Math.max(0, dot(normal, sunDirection)));
        const offset = ((rect.y + py) * width + rect.x + px) * 4;
        if (observation) {
          const sample = observation.samplePoint(closestTrianglePoint(point, a, ab, ac).point);
          if (sampleSources) sampleSources[offset / 4] = sample.reason ? 0 : sample.frameIndex + 1;
          const interior = u >= 0 && v >= 0 && u + v <= 1;
          if (interior) {
            observationTransfer.interiorTexels++;
            const key = sample.reason ?? 'accepted';
            observationTransfer.counts[key] = (observationTransfer.counts[key] ?? 0) + 1;
            if (!sample.reason) {
              if (sample.frameId) {
                observationTransfer.sources ??= {};
                observationTransfer.sources[sample.frameId] = (observationTransfer.sources[sample.frameId] ?? 0) + 1;
              }
              observationTransfer.maximumSourceDistanceMeters = Math.max(observationTransfer.maximumSourceDistanceMeters, sample.distanceMeters);
              observationTransfer.maximumPixelSeparationMeters = Math.max(observationTransfer.maximumPixelSeparationMeters, sample.separationMeters);
              observationTransfer.maximumPhotometricGain = Math.max(observationTransfer.maximumPhotometricGain, sample.gain);
            }
          }
          for (let channel = 0; channel < 3; channel++) {
            // The observation's authored photometric treatment is already prepared. Uniform flood
            // preserves its measured detail on every side of the source mesh.
            flood[offset + channel] = sample.color[channel];
            shadow[offset + channel] = Math.round(sample.color[channel] * illumination);
          }
          flood[offset + 3] = shadow[offset + 3] = 255;
          continue;
        }
        if (sourceSurface) {
          // Clamp the raster bleed to this retained triangle, never to an
          // unrelated surface beyond its edge. Runtime primitive coverage is
          // unchanged; source projection and color are entirely prepared here.
          const clamped = closestTrianglePoint(point, a, ab, ac).point;
          const sample = sampleScience(clamped);
          if (scalarSources && sample.sourceCell !== undefined) scalarSources.writeUInt32LE(sample.sourceCell + 1, offset);
          transfer.sampledTexels++;
          const interior = u >= 0 && v >= 0 && u + v <= 1;
          if (interior) transfer.triangleInteriorTexels++;
          const color = sample.color;
          if (sample.radius !== undefined) {
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
        const lon = (Math.atan2(point[1], point[0]) / (2 * Math.PI) + 1) % 1;
        const lat = Math.atan2(point[2], Math.hypot(point[0], point[1]));
        const sx = lon * info.width - .5, sy = Math.max(0, Math.min(info.height - 1, (.5 - lat / Math.PI) * info.height - .5));
        const x0 = (Math.floor(sx) + info.width) % info.width, x1 = (x0 + 1) % info.width, y0 = Math.floor(sy), y1 = Math.min(info.height - 1, y0 + 1), tx = sx - Math.floor(sx), ty = sy - y0;
        for (let channel = 0; channel < 3; channel++) {
          const top = map[(y0 * info.width + x0) * 4 + channel] * (1 - tx) + map[(y0 * info.width + x1) * 4 + channel] * tx;
          const bottom = map[(y1 * info.width + x0) * 4 + channel] * (1 - tx) + map[(y1 * info.width + x1) * 4 + channel] * tx;
          const color = top * (1 - ty) + bottom * ty;
          flood[offset + channel] = Math.round(color * (light?.flood ?? 1));
          shadow[offset + channel] = Math.round((light ? color : Math.round(color)) * illumination);
        }
        flood[offset + 3] = shadow[offset + 3] = 255;
      }
    }
    // Scientific colours retain exact palette values; the numeric source index is preparation-only.
    const encoding = scalarSources ? { lossless: true, effort: 4 } : { quality: config.raster.surfaceQuality ?? 90, alphaQuality: 100, effort: 4 };
    surface.surface = await emit(`${config.namespace}-${surface.id}-surface@2x.webp`, sharp(flood, { raw: { width, height, channels: 4 } }), encoding);
    surface.shadowSurface = await emit(`${config.namespace}-${surface.id}-shadow@2x.webp`, sharp(shadow, { raw: { width, height, channels: 4 } }), encoding);
    surface.polesUrl = surface.surface.url;
    surface.layout = { kind: 'triangle-atlas', width, height, tileSize, faceCount: radial.faces.length };
    if (config.geometry.radialTerrain.thumbnail) {
      const snapshot = await renderRadialSnapshot({ ...config.geometry.radialTerrain.thumbnail, faces: radial.faces,
        map: resolve(publicDirectory, surface.map.url.split('/').at(-1)) });
      surface.thumbnail = await emit(`${config.namespace}-${surface.id}-thumbnail.webp`, sharp(snapshot).resize(48, 48)
        .extend({ left: 24, right: 24, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    }
    if (transfer) surface.surfaceSampling.transfer = transfer;
    if (scalarSources) {
      const bytes = Buffer.from(JSON.stringify({ schema: 'cssearth-atlas-scalar-index@1', width, height,
        encoding: 'gzip-u32le-base64', layout: 'row-major; 0 withheld, otherwise original table row (1-based); includes atlas bleed',
        source: surface.source, data: gzipSync(scalarSources, { level: 9 }).toString('base64') }) + '\n');
      const file = `${surface.id}-source-index.json`;
      await writeFile(resolve(outputDirectory, file), bytes);
      surface.scalarMap.sampleSources = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), width, height };
      const nearest = scientific.format === 'facet-scalars' || scientific.displaySampling === 'nearest';
      const snapshot = await renderRadialSnapshot({ faces: radial.faces, sampleSurface: sampleScience, size: 96,
        longitudeDegrees: 30, latitudeDegrees: 30, ambient: 1, diffuse: 0,
        ...(nearest ? { displaySampling: 'nearest' } : {}) });
      surface.thumbnail = await emit(`${config.namespace}-${surface.id}-thumbnail.webp`, sharp(snapshot).resize(48, 48,
        { kernel: nearest ? 'nearest' : 'lanczos3' })
        .extend({ left: 24, right: 24, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    }
    if (observationTransfer) surface.observation.transfer = observationTransfer;
    if (sampleSources) {
      const codes = { 0: 'no-qualified-observation', ...Object.fromEntries(observation.report.frames.map((frame, i) => [i + 1, frame.id])) };
      const bytes = Buffer.from(JSON.stringify({ schema: 'cssearth-atlas-observation-index@1', width, height, codes,
        encoding: 'gzip-u8-base64', layout: 'row-major; one source code per atlas texel; includes triangle bleed',
        data: gzipSync(sampleSources, { level: 9 }).toString('base64') }) + '\n');
      const file = `${surface.id}-source-index.json`;
      await writeFile(resolve(outputDirectory, file), bytes);
      surface.observation.sampleSources = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        width, height, includesAtlasBleed: true, codes };
    }
  }
  if (lighting) await writeFile(resolve(outputDirectory, `source-lighting${suffix}.json`), JSON.stringify({ ...lighting.report, recipe: lightingRecipe }) + '\n');
  for (const entry of snapshotEntries.filter(entry =>
    entry.generator === 'tools/objects/terrestrial-layers/radial-snapshot.mjs')) {
    const surface = surfaces.find(surface => surface.id === entry.recipe?.lensId);
    if (!surface) throw new TypeError('Radial snapshot requires a prepared source lens.');
    const science = radial.scientificSurfaces?.get(surface.id);
    const lens = science && config.raster.scientific.find(lens => lens.id === surface.id);
    const png = await renderRadialSnapshot({ ...entry.recipe, faces: radial.faces,
      ...(science ? { sampleSurface: createRadialScienceColorSampler(science, lens, config),
        ...((lens.format === 'facet-scalars' || lens.displaySampling === 'nearest') ? { displaySampling: 'nearest' } : {}) } : {}),
      map: resolve(publicDirectory, surface.map.url.split('/').at(-1)) });
    source.assertBytes(entry, png);
  }
  await writeFile(resolve(outputDirectory, `terrain${suffix}.json`), JSON.stringify({ schema: 'cssearth-prepared-radial-terrain@1',
    source: config.geometry.radialTerrain, faces: radial.faces, width, height,
    ...(radial.coverage ? { coverage: radial.coverage } : {}),
    ...(radial.simplification ? { simplification: radial.simplification } : {}) }) + '\n');
  return surfaces;
}
