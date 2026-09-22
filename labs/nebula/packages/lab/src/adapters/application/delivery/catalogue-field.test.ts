import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PreparedCataloguePoint } from '../../../../../../../../src/renderers/css/stars/prepared-catalogue-points.ts';
import { prepareNebulaCatalogueField } from './catalogue-field.ts';
import { embedNebulaFrame, METERS_PER_PARSEC } from './nebula-frame.ts';
import { samePreparedCatalogueGeometry } from '../../../../../../../../src/renderers/css/stars/prepared-catalogue-points.ts';

const sha = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex');
const frame: DensityVolumeFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545 + 16 * 365.25,
  originM: [100 * METERS_PER_PARSEC, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: METERS_PER_PARSEC,
  boundsUnits: { min: [-0.1, -0.1, -0.1], max: [0.1, 0.1, 0.1] } };
const row = (id = '1234567890123456789', distancePc = 100, g = 10) => ({ sourceId: id, raDeg: 0, decDeg: 0,
  pmRaMasYr: 0 as number | null, pmDecMasYr: 0 as number | null, parallaxMas: 10, parallaxErrorMas: 0.1,
  photGMeanMag: g, bpRp: 0 as number | null, ruwe: 1, distancePc, distanceLowerPc: distancePc * 0.9, distanceUpperPc: distancePc * 1.1 });
const field = (stars = [row()]) => ({ schema: 'cssearth-gaia-nebula-field@1', id: 'test', coordinateEpochJulianYear: 2016,
  selection: { centerIcrsDegrees: [0, 0], distancePc: 100, outerRadiusPc: 50, featherStartPc: 30,
    limitingMagnitude: 16, fadeMagnitude: 2, maximumStars: 1500, retainIds: [] as string[], retainedMatchArcsec: 0,
    referenceMagnitude: 10, referenceDiameterPx: 1.5, referenceFocalPixels: 1000 }, stars });
const retainedPoint: PreparedCataloguePoint = { id: 'named-star', positionUnits: [0, 0, 0], sizePx: 2, colorCss: '#ff0000', opacity: 1 };
async function fixture(t: TestContext, value: unknown) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-field-')); t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = JSON.stringify(value); await writeFile(join(root, 'field.json'), bytes);
  return { root, pin: { path: 'field.json', sha256: sha(bytes) } };
}
async function prepare(t: TestContext, value: unknown, target = frame, existing: readonly PreparedCataloguePoint[] = []) {
  const { root, pin } = await fixture(t, value); return prepareNebulaCatalogueField(root, pin, target, existing);
}
const close = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('posterior median distances produce physical fore/background, independently of image bounds', async t => {
  const source = field([row('1234567890123456789', 80), row('1234567890123456790', 120)]);
  const result = await prepare(t, source);
  close(result.points[0]!.positionUnits[0], -20); close(result.points[1]!.positionUnits[0], 20);
  const expanded = await prepare(t, source, { ...frame, boundsUnits: { min: [-100, -100, -100], max: [100, 100, 100] } });
  assert.deepEqual(result.points, expanded.points);
  assert.equal(result.points[0]!.id, 'gaia-dr3:1234567890123456789');
  close(result.receipt.maximumRelativeDistanceHalfWidth, 0.1);
});

test('world-to-local transform uses the actual rotated, recentered frame without a second image reflection', async t => {
  const target = { ...embedNebulaFrame(frame, { centerIcrsDegrees: [0, 0], distancePc: 100, imageRotationDegrees: 0, arcsecPerUnit: 1 }, [2, 3, 4]), epochJdTt: frame.epochJdTt };
  const result = await prepare(t, field([row('1234567890123456789', 110)]), target);
  const p = result.points[0]!.positionUnits;
  // At RA=Dec=0 local x=east(+Y), y=north(+Z), z=away(+X); origin contains [-2,+3,+4] source offset.
  close(p[0], 2, 1e-7); close(p[1], -3, 1e-7);
  close(p[2], 10 * METERS_PER_PARSEC / target.metersPerUnit - 4, 1e-7);
});

test('proper motion uses Gaia cos-dec tangent components at the pole and the frame epoch', async t => {
  const star = { ...row(), raDeg: 0, decDeg: 90, pmRaMasYr: 1000, pmDecMasYr: 2000 };
  const source = field([star]); source.selection.centerIcrsDegrees = [0, 90];
  const target = { ...frame, epochJdTt: 2451545 + 26 * 365.25, originM: [0, 0, 100 * METERS_PER_PARSEC] as const };
  const result = await prepare(t, source, target), p = result.points[0]!.positionUnits;
  const east = 10 * Math.PI / 648000, north = 20 * Math.PI / 648000, norm = Math.hypot(east, north, 1);
  close(p[0], -100 * north / norm); close(p[1], 100 * east / norm); close(p[2], 100 / norm - 100);
  const unmoved = await prepare(t, { ...source, stars: [{ ...star, pmRaMasYr: null, pmDecMasYr: null }] }, target);
  close(unmoved.points[0]!.positionUnits[0], 0); close(unmoved.points[0]!.positionUnits[1], 0);
  assert.equal(unmoved.receipt.missingProperMotionCount, 1);
});

test('the outer boundary is a smooth sphere with faint taper, not a rectangular image footprint', async t => {
  // [40,40,0] is inside a Cartesian 50-pc half-width box but outside the physical sphere.
  const cornerDistance = Math.hypot(140, 40);
  const source = field([
    row('1234567890123456780', 100, 10), row('1234567890123456781', 140, 10),
    row('1234567890123456782', 100, 15), row('1234567890123456783', 140, 15),
    row('1234567890123456784', 150, 10), row('1234567890123456785', 100, 16),
    { ...row('1234567890123456786', cornerDistance, 10), raDeg: Math.atan2(40, 140) * 180 / Math.PI },
  ]);
  const result = await prepare(t, source), byId = new Map(result.points.map(p => [p.id, p]));
  close(byId.get('gaia-dr3:1234567890123456780')!.opacity, 1);
  close(byId.get('gaia-dr3:1234567890123456781')!.opacity, 0.5);
  close(byId.get('gaia-dr3:1234567890123456782')!.opacity, 0.5);
  close(byId.get('gaia-dr3:1234567890123456783')!.opacity, 0.25);
  assert.equal(result.points.length, 4); assert.equal(result.receipt.excluded.outsideSphere, 2); assert.equal(result.receipt.excluded.faint, 1);
});

test('measured G determines display area and the physical footprint scales with source distance', async t => {
  const source = field([row('1234567890123456780', 100, 10), row('1234567890123456781', 100, 15), row('1234567890123456782', 125, 10)]);
  const result = await prepare(t, source), byId = new Map(result.points.map(p => [p.id, p]));
  const bright = byId.get('gaia-dr3:1234567890123456780')!, faint = byId.get('gaia-dr3:1234567890123456781')!, farther = byId.get('gaia-dr3:1234567890123456782')!;
  close(bright.diameterUnits!, 0.15); close(faint.diameterUnits! / bright.diameterUnits!, 0.1);
  close((faint.diameterUnits! / bright.diameterUnits!) ** 2, 0.01);
  close(farther.diameterUnits! / bright.diameterUnits!, 1.25);
});

test('Cardiel coefficients yield independently calculated zero-color fluxes and neutral out-of-domain fallback', async t => {
  const source = field([row(), { ...row('1234567890123456790'), bpRp: -0.5 }, { ...row('1234567890123456791'), bpRp: 2 },
    { ...row('1234567890123456792'), bpRp: null }, { ...row('1234567890123456793'), bpRp: 1.5 }]);
  const result = await prepare(t, source);
  const encode = (magnitudeOffset: number) => Math.round((1.055 * (10 ** (-0.4 * (magnitudeOffset + 0.13748689))) ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0');
  assert.equal(result.points[0]!.colorCss, `#${encode(0.10979647)}${encode(-0.02330159)}ff`);
  assert.deepEqual(result.points.slice(1, 4).map(p => p.colorCss), ['#ffffff', '#ffffff', '#ffffff']);
  assert.equal(result.receipt.neutralColorCount, 3);
  const red = result.points[4]!.colorCss; assert.ok(parseInt(red.slice(1, 3), 16) > parseInt(red.slice(5, 7), 16));
});

test('brightness budget is deterministic, includes explicit retained stars, and discards old image fields', async t => {
  const source = field([row('1234567890123456783', 100, 12), row('1234567890123456782', 100, 8), row('1234567890123456781', 100, 8)]);
  source.selection.maximumStars = 2; source.selection.retainIds = [retainedPoint.id];
  const result = await prepare(t, source, frame, [retainedPoint, { ...retainedPoint, id: 'old-image-star' }]);
  assert.deepEqual(result.points.map(p => p.id), ['named-star', 'gaia-dr3:1234567890123456781']);
  assert.deepEqual(result.points[0], retainedPoint); assert.equal(result.receipt.excluded.budget, 2);
  await assert.rejects(prepare(t, source), /Retained catalogue identity/);
});

test('angular deduplication uses retained world directions and preserves their original depth', async t => {
  const source = field([row('1234567890123456781', 90), { ...row('1234567890123456782', 110), raDeg: 1 / 3600 },
    { ...row('1234567890123456783', 100), raDeg: 4 / 3600 }]);
  source.selection.retainIds = [retainedPoint.id]; source.selection.retainedMatchArcsec = 3;
  const target = embedNebulaFrame(frame, { centerIcrsDegrees: [0, 0], distancePc: 100, imageRotationDegrees: 33, arcsecPerUnit: 1 });
  const result = await prepare(t, source, target, [retainedPoint]);
  assert.equal(result.receipt.excluded.retainedMatch, 2); assert.deepEqual(result.points[0], retainedPoint);
  assert.equal(result.points[1]!.id, 'gaia-dr3:1234567890123456783');
  source.selection.retainedMatchArcsec = 0;
  assert.equal((await prepare(t, source, target, [retainedPoint])).points.length, 4);
});

test('a retained core outside the selected image keeps its detecting-source light without moving', async t => {
  const source = field(); source.selection.retainIds = [retainedPoint.id];
  const value = {...source,selection:{...source.selection,retainedAppearance:'anchor'}};
  const {root,pin} = await fixture(t,value);
  const absent = {...retainedPoint,colorCss:'#000000',opacity:0};
  const result = await prepareNebulaCatalogueField(root,pin,frame,[absent],[retainedPoint]);
  assert.deepEqual(result.points[0],retainedPoint);
  await assert.rejects(prepareNebulaCatalogueField(root,pin,frame,[absent]),/requires its source points/);
  await assert.rejects(prepareNebulaCatalogueField(root,pin,frame,[absent],
    [{...retainedPoint,positionUnits:[1,0,0]}]),/preserve the source geometry/);
  await assert.rejects(prepare(t,{...value,selection:{...value.selection,retainedAppearance:'invent'}}),/appearance policy/);
});

test('source pins reject content drift, traversal and escaping symlinks', async t => {
  const { root, pin } = await fixture(t, field());
  for (const path of ['../field.json', '/field.json', 'x/../field.json', './field.json', 'x\\field.json']) {
    await assert.rejects(prepareNebulaCatalogueField(root, { ...pin, path }, frame, []), /repository-relative path/);
  }
  const other = await fixture(t, field()); await symlink(join(other.root, 'field.json'), join(root, 'escape.json'));
  await assert.rejects(prepareNebulaCatalogueField(root, { ...pin, path: 'escape.json' }, frame, []), /escapes/);
});

test('runtime validation rejects lossy identifiers, malformed uncertainty, duplicate identities and unsupported frames', async t => {
  const valid = field();
  for (const change of [ { sourceId: 1234567890123456789 }, { distanceLowerPc: 101 }, { distanceUpperPc: 99 },
    { distancePc: 0 }, { raDeg: 360 }, { decDeg: -91 }, { pmRaMasYr: '0' }, { parallaxErrorMas: 0 } ]) {
    await assert.rejects(prepare(t, { ...valid, stars: [{ ...row(), ...change }] }), TypeError);
  }
  await assert.rejects(prepare(t, field([row(), row()])), /unique decimal strings/);
  await assert.rejects(prepare(t, valid, { ...frame, referenceFrame: 'lab' }), /Sun ICRF/);
  await assert.rejects(prepare(t, { ...valid, selection: { ...valid.selection, maximumStars: 2001 } }), /budget/);
  await assert.rejects(prepare(t, { ...valid, selection: { ...valid.selection, featherStartPc: 50 } }), /fade/);
});

test('the acquired Crab catalogue prepares a nonempty physical volume with pinned uncertainty and no image stars', async () => {
  const path = 'src/objects/m1/source/stellar-field.json', bytes = await readFile(path);
  const target = embedNebulaFrame(frame, { centerIcrsDegrees: [83.6334511837, 22.0151236394], distancePc: 2000, imageRotationDegrees: 0, arcsecPerUnit: 1 });
  const result = await prepareNebulaCatalogueField(process.cwd(), { path }, target, [{ ...retainedPoint, id: 'crab-pulsar' }]);
  assert.ok(result.receipt.catalogueCount > 0); assert.ok(result.receipt.maximumRelativeDistanceHalfWidth > 0);
  assert.equal(result.receipt.retainedCount, 1); assert.ok(result.points.length <= 1500);
  const depths = result.points.slice(1).map(p => p.positionUnits[2] * target.metersPerUnit / METERS_PER_PARSEC);
  assert.ok(Math.min(...depths) < -1); assert.ok(Math.max(...depths) > 1);
  assert.ok(result.points.slice(1).every(p => Math.hypot(...p.positionUnits) * target.metersPerUnit / METERS_PER_PARSEC < 50.001));
});

test('the checked-in Helix selection retains wide-image cores and its central star across the budget and lenses', async () => {
  const path = 'src/objects/helix/source/stellar-field.json', bytes = await readFile(path);
  const source: unknown = JSON.parse(bytes.toString());
  assert.ok(source && typeof source === 'object' && 'selection' in source && 'provenance' in source);
  const selection = source.selection, provenance = source.provenance;
  assert.ok(selection && typeof selection === 'object' && 'retainIds' in selection && Array.isArray(selection.retainIds));
  const ids = selection.retainIds;
  assert.ok(ids.every((id): id is string => typeof id === 'string'));
  assert.equal(ids.length, 34);
  for (const id of ['eso-wfi-1508','eso-vista-12992','eso-vista-13414','eso-vista-11915','eso-vista-17840','eso-vista-10069','eso-wide-785']) assert.ok(ids.includes(id));
  assert.ok('retainedAppearance' in selection); assert.equal(selection.retainedAppearance,'anchor');
  assert.ok('retainedMatchArcsec' in selection); assert.equal(selection.retainedMatchArcsec, 10);
  assert.ok(provenance && typeof provenance === 'object' && 'imageAnchors' in provenance);
  const anchors = provenance.imageAnchors;
  assert.ok(anchors && typeof anchors === 'object' && 'matches' in anchors && Array.isArray(anchors.matches));
  assert.deepEqual(anchors.matches.map((match: unknown) => {
    assert.ok(match && typeof match === 'object' && 'imageId' in match && 'gaiaSourceId' in match && 'matchArcsec' in match);
    if (match.imageId === 'eso-vista-10069') { assert.equal(match.gaiaSourceId,null); assert.equal(match.matchArcsec,null); }
    else {
      assert.ok(typeof match.gaiaSourceId === 'string' && /^\d{10,20}$/.test(match.gaiaSourceId));
      assert.ok(typeof match.matchArcsec === 'number' && match.matchArcsec < 10);
    }
    return match.imageId;
  }), ids);
  // Synthetic retained geometry isolates the delivery contract without requiring a generated compiler cache.
  const existing: PreparedCataloguePoint[] = ids.map((id, i) => ({ ...retainedPoint, id,
    positionUnits: id === 'eso-wfi-1508' ? [0, 0, 0] : [i * 13, i * 7, (i % 3) * 20] }));
  const target = embedNebulaFrame(frame, { centerIcrsDegrees: [337.4107083333334, -20.83717222222222],
    distancePc: 216, imageRotationDegrees: 0, arcsecPerUnit: 1 });
  const pin = { path, sha256: sha(bytes) };
  const wfi = await prepareNebulaCatalogueField(process.cwd(), pin, target, [...existing.map(p => p.id.startsWith('eso-vista-') ? {...p,opacity:0} : p), { ...retainedPoint, id: 'unvetted-image-peak' }], existing);
  const infrared = await prepareNebulaCatalogueField(process.cwd(), pin, target,
    existing.map(point => ({ ...point, colorCss: '#aabbcc', opacity: 0.25 })), existing);
  assert.equal(wfi.points.length, 1500); assert.equal(wfi.receipt.retainedCount, 34); assert.equal(wfi.receipt.catalogueCount, 1466);
  assert.deepEqual(wfi.points.slice(0, 34).map(point => point.id), ids);
  assert.ok(wfi.points.some(point => point.id === 'eso-wfi-1508'));
  assert.ok(!wfi.points.some(point => point.id === 'unvetted-image-peak'));
  assert.ok(samePreparedCatalogueGeometry({ frame: target, points: wfi.points }, { frame: target, points: infrared.points }));
  assert.deepEqual(wfi.points.slice(0,34),existing);
  assert.deepEqual(infrared.points.slice(0,34),existing);
});

test('catalogue refresh preserves the existing Helix core identities, matching tolerance and evidence', async t => {
  const sourceBytes = await readFile('src/objects/helix/source/stellar-field.json');
  const source = JSON.parse(sourceBytes.toString());
  const { root } = await fixture(t, {}), owner = join(root, 'src/objects/helix/source');
  await mkdir(owner, { recursive: true });
  await writeFile(join(owner, 'stellar-field.json'), sourceBytes);
  await writeFile(join(owner, 'delivery.json'), await readFile('src/objects/helix/source/delivery.json'));
  // A one-row catalogue cache exercises the actual refresh CLI without requiring native processing or archive access.
  const query = source.provenance.query.replace(/^WITH candidates AS \(SELECT (?!ALL )/, 'WITH candidates AS (SELECT ALL ');
  const star = source.stars[0], columns = ['source_id', 'ra', 'dec', 'pmra', 'pmdec', 'parallax', 'parallax_error',
    'phot_g_mean_mag', 'phot_bp_mean_mag', 'phot_rp_mean_mag', 'ruwe', 'r_med_geo', 'r_lo_geo', 'r_hi_geo'];
  const cells = [star.sourceId, star.raDeg, star.decDeg, star.pmRaMasYr, star.pmDecMasYr, star.parallaxMas,
    star.parallaxErrorMas, star.photGMeanMag, '', '', star.ruwe, star.distancePc, star.distanceLowerPc, star.distanceUpperPc];
  const cache = join(root, '.local/nebula-lab/stellar-fields'); await mkdir(cache, { recursive: true });
  await writeFile(join(cache, `helix-${sha(query).slice(0, 12)}.csv`), `${columns.join(',')}\n${cells.join(',')}\n`);
  const refreshed = spawnSync(process.execPath, ['--experimental-strip-types',
    join(process.cwd(), 'tools/prepare/prepare-nebula-field-catalogues.mts'), 'helix'], { cwd: root, encoding: 'utf8', timeout: 3000 });
  assert.equal(refreshed.status, 0, `${refreshed.error?.message ?? ''}\n${refreshed.stdout}\n${refreshed.stderr}`);
  assert.match(refreshed.stdout, /NEBULA_FIELD_CATALOGUES_COMPLETE/);
  const next = JSON.parse(await readFile(join(owner, 'stellar-field.json'), 'utf8'));
  assert.equal(next.stars.length, 1);
  assert.deepEqual(next.selection.retainIds, source.selection.retainIds);
  assert.equal(next.selection.retainedMatchArcsec, 10);
  assert.equal(next.selection.retainedAppearance, 'anchor');
  assert.deepEqual(next.provenance.imageAnchors, source.provenance.imageAnchors);
  assert.equal(next.provenance.retainedSources, source.provenance.retainedSources);
});
