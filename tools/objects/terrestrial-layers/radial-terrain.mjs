import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { computeSolidTrianglePlan, SOLID_TRIANGLE_CANONICAL_SIZE, SOLID_TRIANGLE_BLEED, BASE_TILE } from '@layoutit/polycss';
import { loadObjShape, loadPdsVertexFacetShape } from './obj-shape.mjs';
import { loadPdsScalarGrid } from './pds-scalar-grid.mjs';
import { createRasterEmitter } from './solid-raster.mjs';
import { renderRadialSnapshot } from './radial-snapshot.mjs';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => a.map(v => v / Math.hypot(...a));

/** A sampled, source-owned radial model. No ellipsoid is inferred from the map. */
export async function loadRadialTerrain({ config, sourceDirectory, source }) {
  const profile = config.geometry.radialTerrain;
  if (!profile) return null;
  await source.validatePath(profile.path);
  const loader = ['wavefront-obj', 'wavefront-obj-zip'].includes(profile.format) ? loadObjShape : profile.format === 'pds-vertex-facet' ? loadPdsVertexFacetShape : loadPdsScalarGrid;
  const grid = await loader(resolve(sourceDirectory, profile.path), profile.grid);
  const scale = config.geometry.radius / (config.geometry.radiusKm * 1000);
  const faces = profile.simplification
    ? await simplifyRadialShape(grid, profile, scale)
    : radialTriangles(grid.sample, profile, scale);
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
    style: `transform:matrix3d(${g.matrix});background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px;--polycss-atlas-leaf-sizing:raster` }));
  return { grid, faces, plans, leaves, width, height, tileSize };
}

/** Simplify the released topology before UV sampling. Original positions are
 * retained; geometry and the simplifier never enter the browser runtime. */
export async function simplifyRadialShape(mesh, profile, scale) {
  const { targetFaces, maximumErrorMeters } = profile.simplification;
  if (!mesh.positions || !mesh.indices || !Number.isInteger(targetFaces) || targetFaces < 4 ||
      !Number.isInteger(profile.faceBudget) || targetFaces > profile.faceBudget || profile.faceBudget > 2000 ||
      !(maximumErrorMeters > 0) || !Number.isFinite(maximumErrorMeters) || !(scale > 0)) throw new TypeError('Invalid source mesh simplification.');
  await MeshoptSimplifier.ready;
  const [indices] = MeshoptSimplifier.simplify(Uint32Array.from(mesh.indices.flat()),
    Float32Array.from(mesh.positions.flat()), 3, targetFaces * 3, maximumErrorMeters, ['ErrorAbsolute']);
  if (!indices.length || indices.length / 3 > targetFaces) throw new Error('Source mesh cannot meet the leaf target within its authored error limit.');
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push(Array.from(indices.subarray(i, i + 3),
    index => mesh.positions[index].map(value => value * scale)));
  return surfaceTriangles(triangles);
}

export function radialTriangles(sample, profile, scale) {
  const { latitudeSegments: rows, longitudeSegments: columns, faceBudget } = profile;
  if (![rows, columns, faceBudget].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > faceBudget || faceBudget > 2000 || !(scale > 0)) throw new TypeError('Invalid radial mesh budget.');
  const point = (row, col) => {
    const latitude = -90 + row * 180 / rows, longitude = col * 360 / columns;
    const radius = sample(longitude, latitude);
    if (!(radius > 0)) throw new Error(`Terrain model has no radius at ${longitude}, ${latitude}; no geometry fallback is supplied.`);
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    return [radius * scale * Math.cos(lat) * Math.cos(lon), radius * scale * Math.cos(lat) * Math.sin(lon), radius * scale * Math.sin(lat)];
  };
  const triangles = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = point(row, col), b = point(row, (col + 1) % columns), c = point(row + 1, (col + 1) % columns), d = point(row + 1, col);
    if (row !== 0) triangles.push([a, b, c]);
    if (row !== rows - 1) triangles.push([a, c, d]);
  }
  return surfaceTriangles(triangles);
}

function surfaceTriangles(triangles) {
  const faces = triangles.map(([a, b, c]) => {
    let normal = cross(sub(b, a), sub(c, a));
    if (dot(normal, a) < 0) { [b, c] = [c, b]; normal = normal.map(x => -x); }
    if (!(Math.hypot(...normal) > 1e-8)) throw new Error('Degenerate terrain face.');
    return { vertices: [a, b, c], normal: unit(normal) };
  });
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

/** Bake opaque triangle rasters, coordinates and fixed-epoch Sun illumination. The
 * renderer switches between these prepared banks through ordinary variants.
 */
export async function prepareRadialMaterials({ radial, surfaces, config, source, publicDirectory, outputDirectory, sunDirection }) {
  const { width, height, tileSize } = radial;
  const emit = createRasterEmitter(publicDirectory, config.publicBase);
  for (const surface of surfaces) {
    const { data: map, info } = await sharp(resolve(publicDirectory, surface.map.url.split('/').at(-1))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const flood = Buffer.alloc(width * height * 4), shadow = Buffer.alloc(width * height * 4);
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
        const illumination = .12 + .88 * Math.max(0, dot(normal, sunDirection));
        const lon = (Math.atan2(point[1], point[0]) / (2 * Math.PI) + 1) % 1;
        const lat = Math.atan2(point[2], Math.hypot(point[0], point[1]));
        const sx = lon * info.width - .5, sy = Math.max(0, Math.min(info.height - 1, (.5 - lat / Math.PI) * info.height - .5));
        const x0 = (Math.floor(sx) + info.width) % info.width, x1 = (x0 + 1) % info.width, y0 = Math.floor(sy), y1 = Math.min(info.height - 1, y0 + 1), tx = sx - Math.floor(sx), ty = sy - y0;
        const offset = ((rect.y + py) * width + rect.x + px) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const top = map[(y0 * info.width + x0) * 4 + channel] * (1 - tx) + map[(y0 * info.width + x1) * 4 + channel] * tx;
          const bottom = map[(y1 * info.width + x0) * 4 + channel] * (1 - tx) + map[(y1 * info.width + x1) * 4 + channel] * tx;
          flood[offset + channel] = Math.round(top * (1 - ty) + bottom * ty);
          shadow[offset + channel] = Math.round(flood[offset + channel] * illumination);
        }
        flood[offset + 3] = shadow[offset + 3] = 255;
      }
    }
    const encoding = { quality: config.raster.surfaceQuality ?? 90, alphaQuality: 100, effort: 4 };
    surface.surface = await emit(`${config.namespace}-${surface.id}-surface@2x.webp`, sharp(flood, { raw: { width, height, channels: 4 } }), encoding);
    surface.shadowSurface = await emit(`${config.namespace}-${surface.id}-shadow@2x.webp`, sharp(shadow, { raw: { width, height, channels: 4 } }), encoding);
    surface.polesUrl = surface.surface.url;
    surface.layout = { kind: 'triangle-atlas', width, height, tileSize, faceCount: radial.faces.length };
  }
  for (const entry of source.manifest.generatedIntermediates.filter(entry =>
    entry.generator === 'tools/objects/terrestrial-layers/radial-snapshot.mjs')) {
    const surface = surfaces.find(surface => surface.id === entry.recipe?.lensId);
    if (!surface) throw new TypeError('Radial snapshot requires a prepared source lens.');
    const png = await renderRadialSnapshot({ ...entry.recipe, faces: radial.faces,
      map: resolve(publicDirectory, surface.map.url.split('/').at(-1)) });
    source.assertBytes(entry, png);
  }
  await writeFile(resolve(outputDirectory, 'terrain.json'), JSON.stringify({ schema: 'cssearth-prepared-radial-terrain@1',
    source: config.geometry.radialTerrain, faces: radial.faces, width, height }) + '\n');
  return surfaces;
}
