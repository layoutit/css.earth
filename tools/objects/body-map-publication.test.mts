import { bodyMapFits } from './jwst/cubes/body-map.mts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { sha256 } from '../../src/platform/sha256.mts';
import { formatBodyMapProduct, type BodyMapProduct } from './body-map-product.mts';
import { bindMapResolution, bodyMapProductRecord, formatProductRecord, qualifyBodyMap } from './body-map-publication.mts';
import type { ObservationSelection } from './telescopes/query.mts';

const plane = bodyMapFits({ width: 4, height: 2 }, {}, [{ name: 'CO2 BAND DEPTH', units: 'band depth', values: new Float32Array(8).fill(1) }, { name: 'CO2 BAND DEPTH ERROR', units: 'band depth', values: new Float32Array(8).fill(.1) }]);
const product = (): BodyMapProduct => ({ schema: 'cssearth-body-map@1',
  definition: { quantity: 'CO2 band depth', units: 'band depth', timeDependence: 'surface-property', wavelengthIntervalsMicrometres: [[4.24, 4.28]], source: 'a published definition',
    method: { bandMicrometres: [4.24, 4.28], continuumMicrometres: [[4.2, 4.225], [4.3, 4.33]] } },
  frame: { body: 'europa', radiusKm: 1560.8, rotation: { model: 'pck00011.tpc', bodyCode: 502 } },
  grid: { width: 4, height: 2, longitude: 'east-positive-from-0', rows: 'north-to-south' },
  planes: { file: 'co2.fits', value: 'CO2 BAND DEPTH', uncertainty: 'CO2 BAND DEPTH ERROR' },
  mask: { maximumEmissionDegrees: 65, missing: 'NaN' }, observations: [{ id: 'jw01250-o002', telescope: 'JWST', instrument: 'NIRSPEC-G395H-F290LP',
    mode: 'NIRSPEC/IFU', programme: 'europa-1250', midTimeJd: 2_459_800.5, rangeKm: 6.3e8,
    subObserver: { latitudeDegrees: 0, westLongitudeDegrees: 180 }, angularResolution: { majorArcsec: 0.1, minorArcsec: 0.1, basis: 'disc-edge fit' } }] });
const selection: ObservationSelection = { satisfaction: { status: 'unresolved', acceptance: 'all-requested-constraints', constraints: {} }, schema: 'cssearth-telescope-observation-selection@1', request: { target: 'europa', wavelengthMicrometres: [4.24, 4.28], kind: 'cube', result: 'body-map', time: { any: true }, angularResolutionArcsec: 0.3 },
  telescope: 'JWST', mode: 'NIRSPEC/IFU', programme: 'europa-1250', toolkitLevel: 'proven', constraints: {},
  bodyMapSupport: { answer: 'yes', author: 'tools/objects/jwst/cubes/author-body-maps.mts', reason: 'the body-map author' }, unresolved: [],
  evidence: { ledger: 'data/jwst/ledger.json', archiveDate: '2026-09-19', receipts: [], targetAssociations: [], bodyMaps: [], investigations: [] } };

async function fixture(value = product(), measured = true) {
  const bound = measured ? bindMapResolution(value, 'measured', 'fixture-disc-fit', { residual: 0.01 }) : undefined;
  if (bound) value = bound.product;
  const directory = await mkdtemp(resolve(tmpdir(), 'body-map-publication-')), planePath = resolve(directory, value.planes.file), mapPath = `${planePath}.body-map.json`;
  const metadata = Buffer.from(formatBodyMapProduct(value)), record = bodyMapProductRecord(value, plane, metadata,
    [{ role: 'spectral cube', identity: 'mast:JWST/product/jw01250-o002_s3d.fits', bytes: 12, sha256: 'b'.repeat(64) }],
    [{ name: 'cssEarth author-body-maps', version: '1' }], undefined, bound ? [bound.output] : []);
  if (bound) await writeFile(resolve(directory, bound.output.path), bound.output.bytes);
  await writeFile(planePath, plane); await writeFile(mapPath, metadata); await writeFile(`${planePath}.product.json`, formatProductRecord(record));
  return { directory, planePath, mapPath };
}

test('publication binds the question and selected program to current map bytes', async () => {
  const { mapPath } = await fixture(), layer = await qualifyBodyMap(mapPath, selection);
  assert.equal(layer.satisfaction.status, 'unresolved');
  assert.equal(layer.satisfaction.constraints.kind?.answer, 'unknown'); assert.equal(layer.satisfaction.constraints.artifact?.answer, 'yes');
  assert.equal(layer.target, 'europa'); assert.equal(layer.selection.programme, 'europa-1250');
  assert.deepEqual({ metadata: layer.map.metadata, productRecord: layer.map.productRecord, plane: layer.map.plane },
    { metadata: 'co2.fits.body-map.json', productRecord: 'co2.fits.product.json', plane: 'co2.fits' });
  assert.equal(layer.map.quantity, 'CO2 band depth'); assert.equal(layer.observations[0]!.mode, 'NIRSPEC/IFU');
});

test('publication refuses changed bytes, changed meaning and a selection absent from the map', async () => {
  const changedMeaning = await fixture(), parsed = JSON.parse(await readFile(changedMeaning.mapPath, 'utf8')) as Record<string, unknown>;
  parsed.definition = { ...(parsed.definition as object), quantity: 'another quantity' };
  await writeFile(changedMeaning.mapPath, `${JSON.stringify(parsed, null, 2)}\n`);
  await assert.rejects(qualifyBodyMap(changedMeaning.mapPath, selection), /does not describe the output bytes|does not pin its/u);

  const other = { ...selection, programme: 'europa-4023-o001' };
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, other), /names no JWST NIRSPEC\/IFU observation/u);
});

test('publication refuses a map observation that omits its exact mode or program', async () => {
  const incomplete = product();
  const observation = { ...incomplete.observations[0] };
  delete (observation as { mode?: string }).mode;
  const { mapPath } = await fixture({ ...incomplete, observations: [observation] });
  await assert.rejects(qualifyBodyMap(mapPath, selection), /without an exact ledger mode and program|names no JWST/u);
});

test('publication resolves mode-level uncertainty against the map measured resolution and time', async () => {
  const resolved = await qualifyBodyMap((await fixture()).mapPath, { ...selection,
    constraints: { angularResolution: { answer: 'partial', reason: 'the mode might reach it' } },
    unresolved: [{ constraint: 'angularResolution', answer: 'partial', reason: 'the mode might reach it' }] });
  assert.equal(resolved.selection.constraints.angularResolution?.answer, 'yes');
  assert.deepEqual(resolved.selection.unresolved, []);
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, { ...selection, request: { ...selection.request, angularResolutionArcsec: 0.05 } }), /measured resolution is 0\.100 arcsec.*requires 0\.05/u);
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, { ...selection, request: { ...selection.request, angularResolutionArcsec: undefined, surfaceResolutionKm: 100 } }), /measured surface resolution/u);
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, { ...selection, request: { ...selection.request, angularResolutionArcsec: undefined, resolutionElements: 20 } }), /measured resolution elements/u);
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, { ...selection, request: { ...selection.request, time: { fromIso: '2000-01-01', toIso: '2001-01-01' } } }), /outside the requested time range/u);
});

test('publication resolves the original wavelength request from the map measurement', async () => {
  const resolved = await qualifyBodyMap((await fixture()).mapPath, { ...selection,
    unresolved: [{ constraint: 'observationWavelength', answer: 'unknown', reason: 'the observation product was not read yet' }] });
  assert.equal(resolved.selection.constraints.observationWavelength?.answer, 'yes');
  assert.deepEqual(resolved.selection.unresolved, []);
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, { ...selection, request: { ...selection.request, wavelengthMicrometres: [4.1, 4.28] } }), /map measurement covers 4\.24 to 4\.28.*requires 4\.1 to 4\.28/u);
  const missing = product(); delete (missing.definition as { wavelengthIntervalsMicrometres?: unknown }).wavelengthIntervalsMicrometres;
  await assert.rejects(qualifyBodyMap((await fixture(missing)).mapPath, selection), /does not state the wavelength intervals/u);
});

test('publication explains the missing body-map contract instead of leaking a file error', async () => {
  await assert.rejects(qualifyBodyMap(resolve(tmpdir(), 'missing-ceres.fits.body-map.json'), { ...selection, telescope: 'VLT/NACO', mode: 'imaging', programme: 'ceres-080C0881' }),
    /Cannot publish VLT\/NACO imaging program ceres-080C0881: the body-map metadata is missing.*map plane.*body-map\.json.*product\.json/u);
});
test('publication validates the actual FITS planes, units, grid and uncertainty mask', async () => {
  const { assertBodyMapPlanes } = await import('./body-map-publication.mts');
  assert.throws(() => assertBodyMapPlanes(Buffer.from('not FITS'), product()));
  assert.throws(() => assertBodyMapPlanes(plane, { ...product(), grid: { ...product().grid, width: 5 } }), /grid/);
  assert.throws(() => assertBodyMapPlanes(plane, { ...product(), planes: { ...product().planes, uncertainty: 'ABSENT' } }), /ABSENT/);
  assert.throws(() => assertBodyMapPlanes(plane, { ...product(), definition: { ...product().definition, units: 'K' } }), /units/);
  const invalid = bodyMapFits({ width: 4, height: 2 }, {}, [{ name: 'CO2 BAND DEPTH', units: 'band depth', values: new Float32Array(8).fill(1) }, { name: 'CO2 BAND DEPTH ERROR', units: 'band depth', values: new Float32Array(8).fill(-1) }]);
  assert.throws(() => assertBodyMapPlanes(invalid, product()), /uncertainties/);
});

test('prose, nominal optics, sampling and unpinned measurements cannot satisfy any resolution requirement', async () => {
  for (const kind of [undefined, 'nominal', 'sampling', 'modeled', 'measured'] as const) {
    const map = product(), observation = map.observations[0]!;
    const value = { ...map, observations: [{ ...observation, angularResolution: { ...observation.angularResolution, basis: '0.1 arcsec; nominal diffraction or pixel spacing, not a measured PSF', ...(kind ? { evidence: { kind } } : {}) } }] };
    const layer = await qualifyBodyMap((await fixture(value, false)).mapPath, { ...selection, request: { ...selection.request, surfaceResolutionKm: 500, resolutionElements: 1 } });
    for (const constraint of ['angularResolution', 'surfaceResolution', 'resolutionElements']) {
      assert.equal(layer.satisfaction.constraints[constraint]?.answer, 'unknown');
      assert.ok(layer.selection.unresolved.some(item => item.constraint === constraint));
    }
  }
});
test('a changed resolution receipt invalidates map publication', async () => {
  const f = await fixture(); await writeFile(`${f.planePath}.resolution.json`, '{}');
  await assert.rejects(qualifyBodyMap(f.mapPath, selection), /output bytes/);
});
test('a midpoint inside a request does not prove that the entire exposure fits', async () => {
  const map = product(), jd = (iso: string) => Date.parse(iso) / 86400000 + 2440587.5;
  const value = { ...map, observations: [{ ...map.observations[0]!, midTimeJd: jd('2026-01-01T10:05:00Z'), exposureSeconds: 600 }] };
  const asked = { ...selection, request: { ...selection.request, time: { fromIso: '2026-01-01T10:04:00Z', toIso: '2026-01-01T10:06:00Z' } } };
  const unknown = await qualifyBodyMap((await fixture(value)).mapPath, asked);
  assert.equal(unknown.satisfaction.constraints.time?.answer, 'unknown');
  assert.equal(unknown.selection.constraints.time?.answer, 'unknown');
  const timed = { ...value, observations: [{ ...value.observations[0]!, startTimeJd: jd('2026-01-01T10:00:00Z'), endTimeJd: jd('2026-01-01T10:10:00Z') }] };
  const f = await fixture(timed);
  await assert.rejects(qualifyBodyMap(f.mapPath, asked), /outside the requested time/);
  const valid = await qualifyBodyMap(f.mapPath, { ...asked, request: { ...asked.request, time: { fromIso: '2026-01-01T09:59:00Z', toIso: '2026-01-01T10:11:00Z' } } });
  assert.equal(valid.satisfaction.constraints.time?.answer, 'yes');
});

test('exact UTC request edges agree with their Julian dates',async()=>{
 const startIso='2026-01-01T10:00:00.000Z',endIso='2026-01-01T10:10:00.000Z',jd=(iso:string)=>Date.parse(iso)/86400000+2440587.5;
 const map=product(),f=await fixture({...map,observations:[{...map.observations[0]!,midTimeJd:(jd(startIso)+jd(endIso))/2,startTimeJd:jd(startIso),endTimeJd:jd(endIso),startIso,endIso}]});
 const layer=await qualifyBodyMap(f.mapPath,{...selection,request:{...selection.request,time:{fromIso:startIso,toIso:endIso}}});
 assert.equal(layer.selection.constraints.time?.answer,'yes');assert.equal(layer.satisfaction.constraints.time?.answer,'yes');
});

test('publication establishes input kind only from a current qualified artifact with matching input bytes',async()=>{
 const {writeProductRecord,productRecordPath,pinFile}=await import('./product-record.mts');
 const {rememberQualification,loadQualifiedObservations}=await import('./telescopes/qualified-observations.mts');
 const f=await fixture(),root=f.directory,cube=resolve(root,'selected.fits'),receipt=resolve(root,'comparison.json');
 await writeFile(cube,'verified cube fixture');await writeFile(receipt,'{}');
 await writeProductRecord(productRecordPath(cube),{telescope:'JWST',stage:'fixture-cube',inputs:[],software:[],parameters:{}},[{path:'selected.fits',file:cube}]);
 await rememberQualification(root,{target:'europa',telescope:'JWST',mode:'NIRSPEC/IFU',program:selection.programme,observation:'jw01250-o002',product:cube,productRecord:productRecordPath(cube),receipt,outputRoot:root,facts:{target:'europa',verified:true,kind:'cube',result:'telescope-product'}});
 const selected={...selection,product:(await loadQualifiedObservations(root,'europa'))[0]!};
 await assert.rejects(qualifyBodyMap(f.mapPath,selected,root),/did not consume/);
 const record=JSON.parse(await readFile(`${f.planePath}.product.json`,'utf8'));record.inputs.push({role:'qualified scientific product',identity:'selected.fits',...await pinFile(cube)});
 await writeFile(`${f.planePath}.product.json`,JSON.stringify(record));
 assert.equal((await qualifyBodyMap(f.mapPath,selected,root)).satisfaction.status,'fulfilled');
 assert.equal((await qualifyBodyMap(f.mapPath,selected,root)).satisfaction.status,'fulfilled');
 await writeFile(cube,'substituted same-program cube');await assert.rejects(qualifyBodyMap(f.mapPath,selected,root),/stale/);
 await writeFile(cube,'verified cube fixture');await writeFile(receipt,'changed');await assert.rejects(qualifyBodyMap(f.mapPath,selected,root),/stale/);
});

test('publication refuses a different estimator even when its band overlaps',async()=>{
 const p=product(),f=await fixture({...p,definition:{...p.definition,method:{...p.definition.method,kind:'band-depth'}}});
 const request={...selection.request,continuumMicrometres:[[4.2,4.225],[4.3,4.33]] as const};
 await qualifyBodyMap(f.mapPath,{...selection,request});
 await assert.rejects(qualifyBodyMap(f.mapPath,{...selection,request:{...request,continuumMicrometres:[[4.1,4.225],[4.3,4.33]]}}),/estimator/);
});
