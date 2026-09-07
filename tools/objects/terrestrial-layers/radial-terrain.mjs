import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, computeSolidTrianglePlan, SOLID_TRIANGLE_CANONICAL_SIZE, SOLID_TRIANGLE_BLEED, BASE_TILE } from '@layoutit/polycss';
import { loadObjShape } from './obj-shape.mjs';
import { prepareProjectiveTextureLayer } from '../../../src/platform/projective-surface-raster.mjs';
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
  const nativeRaster = profile.primitive === 'u';
  if (profile.primitive !== undefined && !nativeRaster) throw new TypeError('Unknown radial triangle primitive.');
  const grid = await (profile.format === 'wavefront-obj-zip' ? loadObjShape : loadPdsScalarGrid)(resolve(sourceDirectory, profile.path), profile.grid);
  const scale = config.geometry.radius / (config.geometry.radiusKm * 1000);
  const simplified = profile.simplification
    ? await (await import('./radial-meshoptimizer.mjs')).simplifyRadialTerrain(grid.sample, profile, scale)
    : null;
  const faces = simplified?.faces ?? radialTriangles(grid.sample, profile, scale);
  const tileSize = profile.tileSize, columns = profile.atlasColumns;
  if (![tileSize, columns].every(value => Number.isInteger(value) && value > 0) || tileSize > 512 || columns > 64) throw new TypeError('Invalid radial texture layout.');
  const width = columns * tileSize, height = Math.ceil(faces.length / columns) * tileSize;
  const url = `${config.publicBase}${config.namespace}-normal-surface@2x.webp`;
  const plans = faces.map((face, index) => {
    const rect = { x: index % columns * tileSize, y: Math.floor(index / columns) * tileSize, width: tileSize, height: tileSize };
    if (!nativeRaster) {
      const [a, b, c] = face.vertices;
      // Extend the prepared rectangle beyond the true triangle. Alpha describes
      // the overlapping triangle; adjoining CSS raster edges cannot expose sky.
      const ab = sub(b, a), ac = sub(c, a), bleed = 3 / tileSize;
      const at = (u, v) => a.map((n, i) => n + u * ab[i] + v * ac[i]);
      const polygon = { vertices: [at(-bleed, -bleed), at(1 + bleed, -bleed), at(1 + bleed, 1 + bleed), at(-bleed, 1 + bleed)], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: url,
        textureImageSource: { url, width, height, sourceRect: rect },
        texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, color: '#888888' };
      const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: BASE_TILE, layerElevation: BASE_TILE, textureLighting: 'baked', seamBleed: 0 });
      const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
      if (!geometry) throw new Error(`Radial face ${index} failed preparation.`);
      return { face, rect, geometry, matrix: geometry.matrix.split(',').map(Number) };
    }
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
  const leaves = plans.map(({ geometry: g }) => nativeRaster ? ({ tag: 'u', className: `${config.namespace}-terrain-face`, polar: null,
    attributes: { 'data-polycss-texture-leaf-sizing': 'raster', 'data-polycss-texture-backend': 'atlas', 'data-polycss-texture-lighting': 'baked' },
    style: `transform:matrix3d(${g.matrix});background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px;--polycss-atlas-leaf-sizing:raster` }) : ({ tag: 's', className: `${config.namespace}-terrain-face`, polar: null,
    projectiveTextureLayer: prepareProjectiveTextureLayer(g.matrix, 4),
    style: `transform:matrix3d(${g.matrix});background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px` }));
  return { grid, faces, plans, leaves, width, height, tileSize, nativeRaster, ...(simplified ? { simplification: simplified.report } : {}) };
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

/** Bake opaque triangle rasters, coordinates and fixed-epoch Sun illumination. The
 * renderer switches between these prepared banks through ordinary variants.
 */
export async function prepareRadialMaterials({ radial, surfaces, config, source, publicDirectory, outputDirectory, sunDirection }) {
  const { width, height, tileSize, nativeRaster } = radial;
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
        // Native u owns coverage; rectangular source-image leaves retain
        // their previously prepared alpha boundary.
        const bleed = 3 / tileSize;
        const alpha = nativeRaster || !(u < -bleed || v < -bleed || u + v > 1 + bleed) ? 255 : 0;
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
        flood[offset + 3] = shadow[offset + 3] = alpha;
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
    source: config.geometry.radialTerrain, faces: radial.faces, width, height,
    ...(radial.simplification ? { simplification: radial.simplification } : {}) }) + '\n');
  return surfaces;
}
