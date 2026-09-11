import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseDbf } from './dbf.js';
import { extentPolygon, normalizeExtent, parseSurfaceFeaturesConfig, prepareSurfaceFeatures, rimVectors, surfaceDirection } from './index.js';

const root = process.cwd();
const mercurySource = resolve(root, 'src/planets/mercury/source');
const axes = { prime: [0, 1, 0] as const, east: [1, 0, 0] as const, north: [0, 0, 1] as const };

test('DBF reader decodes fixed-width records, field descriptors and deletion flags', () => {
  const header = Buffer.alloc(32 + 32 * 2 + 1);
  header[0] = 0x03; header.writeUInt32LE(3, 4); header.writeUInt16LE(header.length, 8); header.writeUInt16LE(1 + 5 + 8, 10);
  const field = (offset: number, name: string, type: string, length: number) => { header.write(name, offset, 'ascii'); header[offset + 11] = type.charCodeAt(0); header[offset + 16] = length; };
  field(32, 'name', 'C', 5); field(64, 'value', 'N', 8); header[96] = 0x0d;
  const rows = Buffer.concat([Buffer.from(' Ab   12.5    '), Buffer.from('*gone 0       '), Buffer.from(' Cd   -3      ')]);
  const table = parseDbf(new Uint8Array(Buffer.concat([header, rows])));
  assert.deepEqual(table.fields.map(item => [item.name, item.type, item.length]), [['name', 'C', 5], ['value', 'N', 8]]);
  assert.deepEqual(table.rows, [{ name: 'Ab', value: '12.5' }, { name: 'Cd', value: '-3' }]);
  assert.equal(table.deleted, 1);
  assert.throws(() => parseDbf(new Uint8Array(header.subarray(0, 40))), /truncated/u);
});

test('surface directions wrap east from the declared map edge with the minimap axis convention', () => {
  const equator = surfaceDirection(180, 0, axes, 180);
  assert.deepEqual(equator.map(n => Math.round(n * 1e9) / 1e9 + 0), [0, 1, 0]);
  const quarter = surfaceDirection(270, 0, axes, 180);
  assert.deepEqual(quarter.map(n => Math.round(n * 1e9) / 1e9 + 0), [1, 0, 0]);
  const pole = surfaceDirection(33, 90, axes, 180);
  assert.deepEqual(pole.map(n => Math.round(n * 1e9) / 1e9 + 0), [0, 0, 1]);
  const wrapped = surfaceDirection(10, 20, axes, 180), same = surfaceDirection(370, 20, axes, 180);
  assert.deepEqual(wrapped, same);
});

test('rim vectors trace the published diameter as a small circle of the sphere', () => {
  const rim = rimVectors([0, 1, 0], [0, 0, 1], 11500, 11500 * Math.PI / 6);
  assert.ok(Math.abs(rim.center[1] - 11500 * Math.cos(Math.PI / 6)) < 1e-2 && Math.abs(rim.east[0] + 11500 * Math.sin(Math.PI / 6)) < 1e-2 && Math.abs(rim.north[2] - 11500 * Math.sin(Math.PI / 6)) < 1e-2);
  const polar = rimVectors([0, 0, 1], [0, 0, 1], 11500, 1000);
  assert.ok(Math.hypot(...polar.east) > 0 && Math.abs(polar.east[2]!) < 1e-6, 'a polar feature still gets a tangent basis');
});

test('extents wrap the meridian around their feature and become closed polygons on the sphere', () => {
  assert.deepEqual(normalizeExtent({ minLon: 350, maxLon: 10, minLat: -5, maxLat: 5 }, 0.5), { minLon: -10, maxLon: 10, minLat: -5, maxLat: 5 });
  assert.deepEqual(normalizeExtent({ minLon: -134.29, maxLon: 147.3, minLat: 29.8, maxLat: 86.5 }, 32.6), { minLon: -134.29, maxLon: 147.3, minLat: 29.8, maxLat: 86.5 });
  assert.throws(() => normalizeExtent({ minLon: 0, maxLon: 10, minLat: 5, maxLat: -5 }, 5), /inconsistent/u);
  const polygon = extentPolygon({ minLon: 10, maxLon: 30, minLat: -10, maxLat: 10 }, axes, 180, 11500, 64);
  assert.equal(polygon.points.length, 64);
  assert.ok(polygon.points.every(point => Math.abs(Math.hypot(...point) - 11500) < 0.01));
  const first = surfaceDirection(10, -10, axes, 180), sixteenth = surfaceDirection(30, -10, axes, 180);
  assert.ok(first.every((n, i) => Math.abs(n * 11500 - polygon.points[0]![i]!) < 0.01) && sixteenth.every((n, i) => Math.abs(n * 11500 - polygon.points[16]![i]!) < 0.01));
});

test('the Mercury recipe parses and rejects overlapping or excluded label kinds', async () => {
  const config = JSON.parse(await readFile(resolve(mercurySource, 'preparation/features.json'), 'utf8'));
  const parsed = parseSurfaceFeaturesConfig(config);
  assert.equal(parsed.mapLeftEdgeLongitudeDeg, 180);
  assert.throws(() => parseSurfaceFeaturesConfig({ ...config, kinds: { ...config.kinds, region: [...config.kinds.region, 'AA'] } }), /one label kind/u);
  assert.throws(() => parseSurfaceFeaturesConfig({ ...config, excludedTypeCodes: { AA: 'no' } }), /must not also be labelled/u);
  assert.throws(() => parseSurfaceFeaturesConfig({ ...config, labelPolicy: { ...config.labelPolicy, limbCosine: 1 } }), /out of range/u);
});

test('the pinned Mercury Gazetteer archive prepares anchored IAU features on the body mesh', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'mercury-features-'));
  try {
    const config = JSON.parse(await readFile(resolve(mercurySource, 'preparation/features.json'), 'utf8'));
    const tree = { scene: 1, nodes: [{ className: 'polycss-camera', parent: -1 }, { className: 'polycss-scene', parent: 0 }, { className: 'polycss-mesh mercury-system', parent: 1 }, { className: 'polycss-mesh mercury-body', parent: 2 }, { className: 'mercury-polar', parent: 3 }] };
    const { plan, catalog } = await prepareSurfaceFeatures({ objectId: 'mercury', sourceDirectory: mercurySource, publicDirectory: resolve(directory, 'public'), outputDirectory: resolve(directory, 'prepared'),
      config, maxEntries: 1000, radiusKm: 2439.7, meshRadiusUnits: 11500, tree, declaredLensIds: ['normal', 'enhanced', 'topography', 'interior'] });
    assert.deepEqual(plan.outline, { pieces: 64 });
    assert.equal(plan.policy.minimumZoomShare, 1);
    assert.equal(plan.target, 3);
    assert.equal(catalog.features.length + 32 + catalog.duplicates.rows, 613);
    assert.deepEqual(catalog.excluded.AL?.count, 32);
    assert.deepEqual(catalog.duplicates, { features: 8, rows: 8, maxSeparationDeg: 0.1632, maxDiameterDifferenceKm: 0.846 });
    assert.equal(new Set(catalog.features.map(feature => feature.id)).size, catalog.features.length);
    assert.equal(plan.catalog.count, catalog.features.length);
    assert.equal(catalog.datum.radiusM, 2439700);
    const written = await readFile(resolve(directory, 'public', 'mercury-features.json'));
    assert.equal(written.length, plan.catalog.bytes);
    for (const feature of catalog.features) {
      assert.ok(Math.abs(Math.hypot(...feature.anchorUnits) - 11500) < 1e-2, feature.name);
      const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
      if (feature.outline.kind === 'circle') {
        // Rim points lie on the sphere: |center|² + |east|² = R², and the tangents are orthogonal to the centre and each other.
        const { center, east, north } = feature.outline;
        assert.ok(Math.abs(Math.hypot(...center) ** 2 + Math.hypot(...east) ** 2 - 11500 ** 2) < 11500 * 0.5, feature.name);
        assert.ok(Math.abs(Math.hypot(...east) - Math.hypot(...north)) < 0.05 && Math.abs(dot(center, east)) < 50 && Math.abs(dot(center, north)) < 50 && Math.abs(dot(east, north)) < 50, feature.name);
        assert.equal(feature.kind, 'point', feature.name);
      } else {
        assert.equal(feature.outline.points.length, 64, feature.name);
        assert.ok(feature.outline.points.every(point => Math.abs(Math.hypot(...point) - 11500) < 0.01), feature.name);
        assert.notEqual(feature.kind, 'point', feature.name);
      }
      assert.ok(feature.radiusUnits > 0 && feature.diameterKm > 0, feature.name);
      assert.match(feature.link, /^https:\/\/planetarynames\.wr\.usgs\.gov\/Feature\/\d+$/u);
    }
    // Prepared priority: the largest features come first.
    assert.equal(catalog.features[0]!.name, 'Borealis Planitia');
    const caloris = catalog.features.find(feature => feature.name === 'Caloris Planitia');
    assert.ok(caloris && caloris.kind === 'region' && Math.abs(caloris.longitudeDeg - 161.9848) < 1e-6);
    const expected = surfaceDirection(caloris.longitudeDeg, caloris.latitudeDeg, axes, 180);
    assert.ok(expected.every((n, i) => Math.abs(n * 11500 - caloris.anchorUnits[i]!) < 1e-2));
    assert.equal(catalog.features.find(feature => feature.name === 'Rembrandt')?.outline.kind, 'circle');
    const enterprise = catalog.features.find(feature => feature.name === 'Enterprise Rupes');
    assert.equal(enterprise?.kind, 'linear'); assert.equal(enterprise?.outline.kind, 'box');
    // The published extent runs 66.16–84.03° E, 38.47–28.67° S: the first polygon vertex is the south-west corner.
    const corner = surfaceDirection(66.1641, -38.4737, axes, 180);
    const enterprisePoints = enterprise?.outline.kind === 'box' ? enterprise.outline.points : null;
    assert.ok(enterprisePoints && corner.every((n, i) => Math.abs(n * 11500 - enterprisePoints[0]![i]!) < 1), JSON.stringify(enterprisePoints?.[0]));
    await assert.rejects(prepareSurfaceFeatures({ objectId: 'mercury', sourceDirectory: mercurySource, publicDirectory: resolve(directory, 'p2'), outputDirectory: resolve(directory, 'o2'),
      config, maxEntries: 10, radiusKm: 2439.7, meshRadiusUnits: 11500, tree, declaredLensIds: ['normal', 'enhanced', 'topography'] }), /exceed the authored capability/u);
    await assert.rejects(prepareSurfaceFeatures({ objectId: 'mercury', sourceDirectory: mercurySource, publicDirectory: resolve(directory, 'p3'), outputDirectory: resolve(directory, 'o3'),
      config, maxEntries: 1000, radiusKm: 2440.5, meshRadiusUnits: 11500, tree, declaredLensIds: ['normal', 'enhanced', 'topography'] }), /datum radius/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
