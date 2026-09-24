import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { parseDbf } from './dbf.js';
import { budgetTracePaths, nodeIndex as nodeIndexForTest, parseSurfaceAxes, parseSurfaceFeaturesConfig, prepareSurfaceFeatures, selectTraces } from './index.js';
import { extentPolygon, meshRadiusBand, normalizeExtent, projectRadial, rimVectors, surfaceDirection } from './geometry.js';
import { parseShpPolylines } from './shp.js';
const test = sourceTest();

const root = process.cwd();
const mercurySource = resolve(root, 'src/objects/mercury/source');
const axes = { prime: [0, 1, 0] as const, east: [1, 0, 0] as const, north: [0, 0, 1] as const, mapLeftEdgeLongitudeDeg: 0 };

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

test('shapefile polylines decode, traces select by class inside the padded extent, and budgets keep endpoints', () => {
  // One record: two parts of a polyline in a hand-built shapefile.
  const parts = [[[0, 0], [1, 1], [2, 0]], [[5, 5], [6, 6]]] as const;
  const pointCount = 5, content = 44 + 4 * 2 + 16 * pointCount, file = Buffer.alloc(100 + 8 + content);
  file.writeInt32BE(9994, 0); file.writeInt32BE((100 + 8 + content) / 2, 24); file.writeInt32LE(1000, 28); file.writeInt32LE(3, 32);
  file.writeInt32BE(1, 100); file.writeInt32BE(content / 2, 104);
  const start = 108; file.writeInt32LE(3, start); file.writeInt32LE(2, start + 36); file.writeInt32LE(pointCount, start + 40);
  file.writeInt32LE(0, start + 44); file.writeInt32LE(3, start + 48);
  parts.flat().forEach(([x, y], index) => { file.writeDoubleLE(x, start + 52 + 16 * index); file.writeDoubleLE(y, start + 60 + 16 * index); });
  const decoded = parseShpPolylines(new Uint8Array(file));
  assert.deepEqual(decoded.records[0]?.parts, parts);
  const traces = [
    { className: 'Contractional Landform', lengthM: 100, parts: [[[10, 10], [11, 11]]] },
    { className: 'Contractional Landform', lengthM: 20, parts: [[[10.5, 10.5], [10.6, 10.6]]] },
    { className: 'Contractional Landform', lengthM: 60, parts: [[[10, 10], [30, 30]]] },
    { className: 'Extensional Landform', lengthM: 500, parts: [[[10, 10], [11, 11]]] },
  ] as const;
  const selected = selectTraces(traces, 'Contractional Landform', { minLon: 9, maxLon: 12, minLat: 9, maxLat: 12 }, { paddingDeg: 0.3, insideFraction: 0.9, maximumTraces: 6, minimumLengthShare: 0.25 });
  assert.deepEqual(selected.map(trace => trace.lengthM), [100], 'the short trace is under the share and the long one leaves the extent');
  const budget = budgetTracePaths([[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], [[9, 9], [9, 8]]], 6);
  assert.deepEqual(budget, [[[0, 0], [2, 0], [3, 0], [5, 0]], [[9, 9], [9, 8]]]);
});

test('the Mercury recipe parses and rejects overlapping or excluded label kinds', async () => {
  const config = JSON.parse(await readFile(resolve(mercurySource, 'preparation/features.json'), 'utf8'));
  const parsed = parseSurfaceFeaturesConfig(config);
  // The surface map owns where longitude starts; Mercury's global mosaic begins at 180 degrees.
  assert.equal(parseSurfaceAxes(JSON.parse(await readFile(resolve(mercurySource, parsed.surfaceMap), 'utf8'))).mapLeftEdgeLongitudeDeg, 180);
  assert.throws(() => parseSurfaceFeaturesConfig({ ...config, kinds: { ...config.kinds, region: [...config.kinds.region, 'AA'] } }), /one label kind/u);
  assert.throws(() => parseSurfaceFeaturesConfig({ ...config, excludedTypeCodes: { AA: 'no' } }), /must not also be labelled/u);
  assert.throws(() => parseSurfaceFeaturesConfig({ ...config, labelPolicy: { ...config.labelPolicy, limbCosine: 1 } }), /out of range/u);
});

test('the radius band spans the nearest face point to the farthest vertex, so sagging faces stay inside it', () => {
  // A square face at y = 100 with corners 50 units out: its centre is the nearest surface point (100), its corners the farthest.
  const square = [[[-50, 100, -50], [50, 100, -50], [50, 100, 50]], [[-50, 100, -50], [50, 100, 50], [-50, 100, 50]]];
  const band = meshRadiusBand(square);
  assert.equal(band.minimum, 100);
  assert.ok(Math.abs(band.maximum - Math.hypot(50, 100, 50)) < 1e-3);
  // A face whose plane passes near the origin but whose triangle does not: the nearest point is a vertex, not the plane.
  const skew = [[[100, 0, 0], [100, 10, 0], [100, 0, 10]]];
  assert.equal(meshRadiusBand(skew).minimum, 100);
});

test('shape-model anchors cast onto the farthest hit of the picking mesh and report misses as null', () => {
  // Two squares facing +y at 100 and 90 units: the outer one is the surface; +x misses entirely.
  const square = (y: number) => [[[-50, y, -50], [50, y, -50], [50, y, 50]], [[-50, y, -50], [50, y, 50], [-50, y, 50]]];
  const triangles = [...square(90), ...square(100)];
  assert.ok(Math.abs(projectRadial(triangles, [0, 1, 0])! - 100) < 1e-9);
  assert.ok(Math.abs(projectRadial(triangles, [0.3, 1, 0.2].map(v => v / Math.hypot(0.3, 1, 0.2)) as [number, number, number])! - 100 * Math.hypot(0.3, 1, 0.2)) < 1e-9);
  assert.equal(projectRadial(triangles, [1, 0, 0]), null);
  assert.equal(projectRadial(triangles, [0, -1, 0]), null);
});

test('a banded body resolves to the first band when every band shares one frame', () => {
  const band = (extra = '') => ({ className: `polycss-mesh pluto-body${extra}`, parent: 2, style: 'transform:rotateZ(180deg);animation-duration:84s' });
  const tree = { scene: 1, nodes: [{ className: 'polycss-camera', parent: -1 }, { className: 'polycss-scene', parent: 1 }, { className: 'polycss-mesh pluto-system', parent: 1 }, band(' pluto-body-polar'), band(), band(), band(' pluto-body-polar')] };
  assert.equal(nodeIndexForTest(tree, { className: 'pluto-body', withoutClassName: 'pluto-body-polar' }), 4);
  assert.equal(nodeIndexForTest(tree, { className: 'pluto-body', withoutClassName: null }), 3);
  const skewed = { ...tree, nodes: [...tree.nodes.slice(0, 5), { ...band(), style: 'transform:rotateZ(90deg)' }, tree.nodes[6]!] };
  assert.throws(() => nodeIndexForTest(skewed, { className: 'pluto-body', withoutClassName: 'pluto-body-polar' }), /do not share one frame/u);
  assert.throws(() => nodeIndexForTest(tree, { className: 'pluto-core', withoutClassName: null }), /must name a prepared node/u);
});

test('the pinned Mercury Gazetteer archive prepares anchored IAU features on the body mesh', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'mercury-features-'));
  try {
    const config = JSON.parse(await readFile(resolve(mercurySource, 'preparation/features.json'), 'utf8'));
    const tree = { scene: 1, nodes: [{ className: 'polycss-camera', parent: -1 }, { className: 'polycss-scene', parent: 0 }, { className: 'polycss-mesh mercury-system', parent: 1 }, { className: 'polycss-mesh mercury-body', parent: 2 }, { className: 'mercury-polar', parent: 3 }] };
    const { plan, catalog } = await prepareSurfaceFeatures({ objectId: 'mercury', sourceDirectory: mercurySource, publicDirectory: resolve(directory, 'public'), outputDirectory: resolve(directory, 'prepared'),
      config, maxEntries: 1000, radiusKm: 2439.7, meshRadiusUnits: 11500, tree, declaredLensIds: ['normal', 'enhanced', 'topography', 'interior'] });
    assert.deepEqual(plan.outline, { pieces: 256 });
    assert.equal(plan.policy.minimumZoomShare, config.labelPolicy.minimumZoomShare);
    assert.equal(plan.target, 3);
    // Every adopted row is accounted for: labelled names, the MESSENGER impact site (unsized, from the pinned sites document), the 32 excluded albedo features and the folded duplicates.
    assert.equal(catalog.features.length + 32 + catalog.duplicates.rows, 614);
    assert.deepEqual(catalog.assumed.unsized, { IM: 1 });
    assert.deepEqual(catalog.sites, { source: catalog.sites?.source ?? '', retrievedAt: '2026-09-12', count: 1 });
    const impact = catalog.features.find(feature => feature.code === 'IM');
    assert.ok(impact && impact.diameterKm === 0 && impact.note && impact.credit.endsWith('2015'), 'the MESSENGER impact carries its cited source');
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
      } else if (feature.outline.kind === 'box') {
        assert.equal(feature.outline.points.length, 256, feature.name);
        assert.ok(feature.outline.points.every(point => Math.abs(Math.hypot(...point) - 11500) < 0.01), feature.name);
        assert.notEqual(feature.kind, 'point', feature.name);
      } else {
        const vertices = feature.outline.paths.reduce((sum, path) => sum + path.length, 0);
        assert.ok(feature.outline.paths.length >= 1 && vertices <= 240, feature.name);
        assert.ok(feature.outline.paths.every(path => path.length >= 2 && path.every(point => Math.abs(Math.hypot(...point) - 11500) < 0.01)), feature.name);
        assert.ok(['RU', 'DO', 'FO'].includes(feature.code), feature.name);
      }
      assert.ok(feature.diameterKm === 0 ? feature.radiusUnits === 0 : feature.radiusUnits > 0 && feature.diameterKm > 0, feature.name);
      if (['LS', 'IM', 'SS', 'RT'].includes(feature.code)) assert.match(feature.link, /^https?:\/\//u, feature.name);
      else assert.match(feature.link, /^https:\/\/planetarynames\.wr\.usgs\.gov\/Feature\/\d+$/u);
    }
    // Prepared priority: the largest features come first.
    assert.equal(catalog.features[0]!.name, 'Borealis Planitia');
    const caloris = catalog.features.find(feature => feature.name === 'Caloris Planitia');
    assert.ok(caloris && caloris.kind === 'region' && Math.abs(caloris.longitudeDeg - 161.9848) < 1e-6);
    const expected = surfaceDirection(caloris.longitudeDeg, caloris.latitudeDeg, axes, 180);
    assert.ok(expected.every((n, i) => Math.abs(n * 11500 - caloris.anchorUnits[i]!) < 1e-2));
    assert.equal(catalog.features.find(feature => feature.name === 'Rembrandt')?.outline.kind, 'circle');
    const enterprise = catalog.features.find(feature => feature.name === 'Enterprise Rupes');
    assert.equal(enterprise?.kind, 'linear'); assert.equal(enterprise?.outline.kind, 'trace', 'the mapped scarp replaces the extent box');
    // Angkor Vallis is not a tectonic structure: it keeps its published extent, whose first vertex is the south-west corner.
    const angkor = catalog.features.find(feature => feature.name === 'Angkor Vallis');
    const corner = surfaceDirection(112.5, 55.9952, axes, 180);
    const angkorPoints = angkor?.outline.kind === 'box' ? angkor.outline.points : null;
    assert.ok(angkorPoints && corner.every((n, i) => Math.abs(n * 11500 - angkorPoints[0]![i]!) < 1), JSON.stringify(angkorPoints?.[0]));
    assert.ok(catalog.traces && catalog.traces.traces === 18451 && catalog.traces.matched === 66 && catalog.traces.unmatched.length === 9, JSON.stringify(catalog.traces));
    assert.ok(catalog.traces.unmatched.includes('Astrolabe Rupes'));
    await assert.rejects(prepareSurfaceFeatures({ objectId: 'mercury', sourceDirectory: mercurySource, publicDirectory: resolve(directory, 'p2'), outputDirectory: resolve(directory, 'o2'),
      config, maxEntries: 10, radiusKm: 2439.7, meshRadiusUnits: 11500, tree, declaredLensIds: ['normal', 'enhanced', 'topography'] }), /exceed the authored capability/u);
    await assert.rejects(prepareSurfaceFeatures({ objectId: 'mercury', sourceDirectory: mercurySource, publicDirectory: resolve(directory, 'p3'), outputDirectory: resolve(directory, 'o3'),
      config, maxEntries: 1000, radiusKm: 2600, meshRadiusUnits: 11500, tree, declaredLensIds: ['normal', 'enhanced', 'topography'] }), /datum radius/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('ellipsoid samplers put geodetic positions on the reference ellipsoid and check a rendered surface against it', async () => {
  const { ellipsoidSampler, ellipsoidSurfacePoint, normalizedEllipsoidRadius, renderedEllipsoidSampler, surfaceCoordinates } = await import('./ellipsoid.js');
  const semiAxes = { equatorial: 11500, polar: 11500 * 6356.752 / 6378.137 };
  for (const [lon, lat] of [[281.53, -0.18], [103.82, 1.35], [338.06, 64.15], [0, 90], [180, -90]] as const) {
    const point = ellipsoidSurfacePoint(lon, lat, axes, 180, semiAxes);
    assert.ok(Math.abs(normalizedEllipsoidRadius(point, semiAxes, axes.north) - 1) < 1e-9, `${lon},${lat} lies on the ellipsoid`);
    const back = surfaceCoordinates(point, axes, 180), geocentric = Math.atan((semiAxes.polar / semiAxes.equatorial) ** 2 * Math.tan(lat * Math.PI / 180)) * 180 / Math.PI;
    assert.ok(Math.abs(back.latitudeDeg - geocentric) < 1e-6 && (Math.abs(lat) === 90 || Math.abs(back.longitudeDeg - lon) < 1e-6), `${lon},${lat} round-trips through geocentric coordinates`);
  }
  // The geodetic normal is the sphere direction; on the ellipsoid it is not radial except at the equator and poles.
  const pure = ellipsoidSampler(axes, 180, semiAxes), point = pure.point(338.06, 64.15), normal = pure.normal(338.06, 64.15);
  assert.deepEqual(normal, surfaceDirection(338.06, 64.15, axes, 180));
  assert.ok(Math.abs(point[2] - semiAxes.polar * Math.sqrt(1 - (Math.hypot(point[0], point[1]) / semiAxes.equatorial) ** 2)) < 1e-6);
  assert.deepEqual(pure.plan(), { ...semiAxes, north: axes.north, minimumShare: 1, maximumShare: 1 });
  // The shared preparation casts map directions: the cast recovers the geodetic position from its normal and rounds like every mesh coordinate.
  const { ellipsoidSurfaceCast } = await import('./ellipsoid.js');
  const cast = ellipsoidSurfaceCast(pure, axes, 180);
  assert.deepEqual(cast.onSurface(surfaceDirection(338.06, 64.15, axes, 180)), point.map(value => Number(value.toFixed(3))));
  assert.deepEqual(cast.plan(), pure.plan());
  // A rendered surface that sags below the ellipsoid keeps longitude; the band records how far it sags.
  const sagging = renderedEllipsoidSampler(axes, 180, semiAxes, (lon, lat) => { const p = ellipsoidSurfacePoint(lon, lat, axes, 180, semiAxes); return [p[0] * 0.99, p[1] * 0.99, p[2] * 0.99]; });
  sagging.point(10, 20); sagging.point(200, -50);
  const plan = sagging.plan();
  assert.ok(Math.abs(plan.minimumShare - 0.99) < 1e-6 && plan.maximumShare === 1, JSON.stringify(plan));
  assert.throws(() => renderedEllipsoidSampler(axes, 180, semiAxes, () => [0, 0, semiAxes.polar * 0.5]).point(10, 20), /of the ellipsoid radius/u);
  assert.throws(() => renderedEllipsoidSampler(axes, 180, semiAxes, (lon, lat) => ellipsoidSurfacePoint(lon + 1, lat, axes, 180, semiAxes)).point(10, 20), /different longitude/u);
  assert.throws(() => renderedEllipsoidSampler(axes, 180, semiAxes, (lon, lat) => ellipsoidSurfacePoint(lon, lat + 4, axes, 180, semiAxes)).point(10, 20), /geodetic latitude/u);
});
