/** What the capability query may and may not say. The cases run on small ledgers written here, in the shapes the five real
 * ledgers use, so nothing asks an archive anything; the last cases run on the committed ledgers themselves. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { BODY_MAP_SCHEMA } from '../body-map-product.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { ledgerModeKeys, loadQueryInputs, MODES_SCHEMA, parseModeCapabilities, queryCapabilities, type Candidate, type CapabilityAnswer, type QueryInputs } from './query.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
const citation = 'https://jwst-docs.stsci.edu/jwst-near-infrared-spectrograph';

const CAPABILITIES = parseModeCapabilities({ schema: MODES_SCHEMA, modes: [
  { telescope: 'JWST', mode: 'NIRSPEC/IFU', wavelengthMicrometres: 'bands', apertureMetres: 6.5, pixelScaleArcsec: 0.1, kinds: ['cube'], citation },
  { telescope: 'JWST', mode: 'NIRCAM/IMAGE', wavelengthMicrometres: [0.6, 5], apertureMetres: 6.5, pixelScaleArcsec: 0.031, kinds: ['image'], citation },
  { telescope: 'Chandra', mode: 'HRC-I', wavelengthMicrometres: [0.000124, 0.0207], apertureMetres: 1.2, pixelScaleArcsec: 0.13175, kinds: ['events'], citation },
  { telescope: 'VLT/NACO', mode: 'imaging', wavelengthMicrometres: [1, 5], apertureMetres: 8.2, pixelScaleArcsec: 0.01326, kinds: ['image'], citation },
  { telescope: 'Juno', mode: 'JUNOCAM', wavelengthMicrometres: [0.42, 0.9], apertureMetres: 0.0034, pixelScaleArcsec: 139.3, kinds: ['strips'], citation }] });

const JWST_LEDGER = { schema: 'cssearth-jwst-ledger@1', archiveDate: '2026-09-19', modes: [
  { mode: 'NIRSPEC/IFU', tool: 'tools/objects/jwst/cubes/spec3.mts', programs: ['europa-1250', 'sn-1987a-1232'], checked: ['europa-1250'] },
  { mode: 'MIRI/IFU', tool: null, programs: [], checked: [] },
  { mode: 'NIRCAM/IMAGE', tool: 'tools/objects/jwst/imaging/image3.mts', programs: ['ngc-3132-2733'], checked: [] }],
  objects: [{ id: 'europa', observations: { 'NIRSPEC/IFU': 13, 'MIRI/IFU': 12, 'NIRCAM/IMAGE': 6 }, programmes: ['1250', '4023'], drawn: ['NIRSPEC/IFU'] }] };
const CHANDRA_LEDGER = { schema: 'cssearth-chandra-ledger@1', measured: '2026-09-19', archive: { byInstrument: { 'HRC-I': 2006, 'ACIS-S': 14_863 } },
  modes: { 'HRC-I no grating OBSERVING': { state: 'reproduced', program: 'jupiter-hrci', obsid: 18_676, target: 'Jupiter' } },
  shippedObjects: { jupiter: { matchedBy: 'target name', observations: 2, longest: [{ obsid: 18_676, target: 'Jupiter', instrument: 'HRC-I', grating: 'NONE', exposureKs: 9.3, startDate: '2016-05-24T12:00:00' }] } } };
const NACO_LEDGER = { schema: 'cssearth-naco-ledger@1', measured: '2026-09-19',
  modes: [{ mode: 'imaging', frames: 10, programs: ['ceres-080C0881'], receipts: ['ceres-080C0881.COADDED_IMG.reproduction.json'], state: 'reduced' },
    { mode: 'cube', frames: 4, programs: [], receipts: [], state: 'refused', reason: 'This route refuses the mode.' }],
  objects: [{ id: 'ceres', targets: ['CERES'], frames: 14, programmes: ['080.C-0881(A)'], modes: ['imaging', 'cube'] }] };
const JUNO_LEDGER = { schema: 'cssearth-junocam-ledger@1', measured: '2026-09-19', objects: [
  { id: 'europa', target: 'EUROPA', colourImages: 52, measuredImages: 4, programs: ['europa-pj45'], state: 'measured', why: '4 image(s) registered.' },
  { id: 'io', target: 'IO', colourImages: 247, measuredImages: 0, programs: [], state: 'not measured', why: 'No program of this target is pinned.' }] };

const inputs = (ledgers: readonly { telescope: string; value: unknown }[], rest: Partial<QueryInputs> = {}): QueryInputs =>
  ({ ledgers: ledgers.map(entry => ({ ...entry, path: `data/${entry.telescope}/ledger.json` })), capabilities: CAPABILITIES, bodyMaps: [], ...rest });
const candidate = (answer: CapabilityAnswer, mode: string): Candidate => {
  const found = answer.candidates.find(entry => entry.mode === mode);
  assert.ok(found, `no candidate for ${mode}`);
  return found;
};

test('a JWST cube mode takes its coverage from the bands, and answers wavelength from it', () => {
  assert.deepEqual(JWST_CUBE_COVERAGE['NIRSPEC-PRISM-CLEAR'], [0.6, 5.3]);
  assert.deepEqual(CAPABILITIES.find(entry => entry.mode === 'NIRSPEC/IFU')?.wavelengthMicrometres, [0.6, 5.3]);
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }]));
  assert.equal(candidate(answer, 'NIRSPEC/IFU').meetsConstraints.wavelength?.answer, 'yes');
  assert.equal(queryCapabilities({ target: 'europa', wavelengthMicrometres: [4, 6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])).candidates
    .find(entry => entry.mode === 'NIRCAM/IMAGE')?.meetsConstraints.wavelength?.answer, 'partial');
  assert.equal(queryCapabilities({ target: 'europa', wavelengthMicrometres: [10, 12] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])).candidates
    .find(entry => entry.mode === 'NIRCAM/IMAGE')?.meetsConstraints.wavelength?.answer, 'no');
});

test('a mode with no recorded capabilities answers unknown and says so, rather than guessing', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [5, 7], kind: 'cube' }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }]));
  const miri = candidate(answer, 'MIRI/IFU');
  assert.deepEqual(['wavelength', 'angularResolution', 'kind'].map(name => miri.meetsConstraints[name]?.answer), ['unknown', 'unknown', 'unknown']);
  assert.match(miri.meetsConstraints.wavelength!.reason, /Capabilities not recorded/u);
  assert.ok(miri.unknown.some(line => line.includes('Capabilities not recorded')));
});

test('sharpness is never yes: it says what the mode cannot beat, and no when that is too coarse', () => {
  const ask = (arcsec: number) => candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], angularResolutionArcsec: arcsec },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU').meetsConstraints.angularResolution!;
  assert.equal(ask(0.001).answer, 'no');
  assert.match(ask(0.001).reason, /cannot be sharper than 0\.2 arcsec/u);
  assert.equal(ask(1).answer, 'partial');
  assert.match(ask(1).reason, /Possible/u);
  assert.equal(candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU')
    .meetsConstraints.angularResolution?.answer, 'unknown');
});

test('two pixels floor the diffraction limit where the pixel scale is the coarser of the two', () => {
  const nirspec = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], angularResolutionArcsec: 5 }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU');
  assert.match(nirspec.meetsConstraints.angularResolution!.reason, /two 0\.1 arcsec pixels, which are wider than the 0\.132 arcsec diffraction limit/u);
  const nircam = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [4.9, 5], angularResolutionArcsec: 5 }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRCAM/IMAGE');
  assert.match(nircam.meetsConstraints.angularResolution!.reason, /1\.22 lambda \/ D at 4\.9 micrometres on 6\.5 m/u);
});

test('kilometres on the ground and elements across the disc need what the caller alone knows', () => {
  const without = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], surfaceResolutionKm: 100, resolutionElements: 8 },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU');
  assert.equal(without.meetsConstraints.surfaceResolution?.answer, 'unknown');
  assert.match(without.meetsConstraints.surfaceResolution!.reason, /need the range to the body/u);
  assert.equal(without.meetsConstraints.resolutionElements?.answer, 'unknown');
  const near = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], surfaceResolutionKm: 1000, resolutionElements: 8, rangeKm: 6.3e8, bodyRadiusKm: 1560.8 },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU');
  assert.equal(near.meetsConstraints.surfaceResolution?.answer, 'partial');
  assert.match(near.meetsConstraints.surfaceResolution!.reason, /611 km at the sub-observer point/u);
  assert.equal(near.meetsConstraints.resolutionElements?.answer, 'no');
  assert.match(near.meetsConstraints.resolutionElements!.reason, /spans at most 5\.11 elements/u);
});

test('time is unknown unless the ledger dates that object in that mode', () => {
  const jwst = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], time: { fromIso: '2022-01-01', toIso: '2023-01-01' } },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU');
  assert.equal(jwst.meetsConstraints.time?.answer, 'unknown');
  assert.match(jwst.meetsConstraints.time!.reason, /carries no dates/u);
  const inside = candidate(queryCapabilities({ target: 'jupiter', wavelengthMicrometres: [0.001, 0.002], time: { fromIso: '2016-01-01', toIso: '2017-01-01' } },
    inputs([{ telescope: 'chandra', value: CHANDRA_LEDGER }])), 'HRC-I');
  assert.equal(inside.meetsConstraints.time?.answer, 'yes');
  const outside = candidate(queryCapabilities({ target: 'jupiter', wavelengthMicrometres: [0.001, 0.002], time: { fromIso: '2020-01-01', toIso: '2021-01-01' } },
    inputs([{ telescope: 'chandra', value: CHANDRA_LEDGER }])), 'HRC-I');
  assert.equal(outside.meetsConstraints.time?.answer, 'partial');
  assert.match(outside.meetsConstraints.time!.reason, /does not date the rest/u);
});

test('toolkit support separates a checked program of this target from a tool that has never been proved', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }, { telescope: 'juno', value: JUNO_LEDGER }]));
  const nirspec = candidate(answer, 'NIRSPEC/IFU');
  assert.equal(nirspec.toolkitSupport.level, 'proven');
  assert.deepEqual([nirspec.toolkitSupport.targetProgramPinned, nirspec.toolkitSupport.targetProgramChecked], [true, true]);
  assert.equal(nirspec.toolkitSupport.tool, 'tools/objects/jwst/cubes/spec3.mts');
  assert.equal(candidate(answer, 'NIRCAM/IMAGE').toolkitSupport.level, 'tool-without-checked-program');
  assert.deepEqual([candidate(answer, 'NIRCAM/IMAGE').toolkitSupport.targetProgramPinned, candidate(answer, 'NIRCAM/IMAGE').toolkitSupport.targetProgramChecked], [false, false]);
  assert.equal(candidate(answer, 'MIRI/IFU').toolkitSupport.level, 'none');
  assert.equal(candidate(answer, 'JUNOCAM').toolkitSupport.level, 'proven');
  const io = queryCapabilities({ target: 'io', wavelengthMicrometres: [0.5, 0.6] }, inputs([{ telescope: 'juno', value: JUNO_LEDGER }]));
  assert.equal(candidate(io, 'JUNOCAM').toolkitSupport.level, 'tool-without-checked-program');
});

test('a mode the route refuses has no toolkit, and says why in the ledger words', () => {
  const answer = queryCapabilities({ target: 'ceres', wavelengthMicrometres: [2, 2.4] }, inputs([{ telescope: 'naco', value: NACO_LEDGER }]));
  assert.equal(candidate(answer, 'cube').toolkitSupport.level, 'none');
  assert.match(candidate(answer, 'cube').toolkitSupport.reason, /This route refuses the mode/u);
  const imaging = candidate(answer, 'imaging');
  assert.equal(imaging.toolkitSupport.level, 'proven');
  assert.deepEqual(imaging.evidence.receipts, ['ceres-080C0881.COADDED_IMG.reproduction.json']);
  assert.equal(imaging.observations?.scope, 'object-total');
});

test('a body map beside the object and an investigation entry are evidence; a ledger without the target says so', () => {
  const bodyMap = { schema: BODY_MAP_SCHEMA, definition: { quantity: 'band depth', units: 'dimensionless', timeDependence: 'surface-property', method: { window: [3.4, 3.6] }, source: 'a paper' },
    frame: { body: 'europa', radiusKm: 1560.8, rotation: { model: 'pck00011.tpc', sha256: 'a'.repeat(64), bodyCode: 502 } },
    grid: { width: 4, height: 2, longitude: 'east-positive-from-0', rows: 'north-to-south' },
    planes: { file: 'map.fits', sha256: 'b'.repeat(64), value: 'SCI', uncertainty: 'ERR' }, mask: { maximumEmissionDegrees: 70, missing: 'NaN' },
    observations: [{ id: 'jw01250-o001', telescope: 'JWST', instrument: 'NIRSPEC', midTimeJd: 2_459_800.5, rangeKm: 6.3e8,
      subObserver: { latitudeDegrees: 0, westLongitudeDegrees: 180 }, angularResolution: { majorArcsec: 0.2, minorArcsec: 0.2, basis: 'fitted point spread function' } }] };
  const investigations = { path: 'src/objects/europa/investigations.json', value: { schema: 'cssearth-investigation-ledger@1', objectId: 'europa',
    entries: [{ id: 'jwst-carbon-dioxide', status: 'unresolved', subject: 'JWST NIRSpec carbon dioxide', finding: 'The released map is a figure, not a grid.' },
      { id: 'sphere-composition', status: 'deferred', subject: 'VLT SPHERE reflectance', finding: 'Reuse terms are missing.' }] } };
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }, { telescope: 'naco', value: NACO_LEDGER }], { bodyMaps: [{ path: 'src/objects/europa/source/jwst/co2.body-map.json', value: bodyMap }], investigations }));
  const nirspec = candidate(answer, 'NIRSPEC/IFU');
  assert.deepEqual(nirspec.evidence.bodyMaps, [{ path: 'src/objects/europa/source/jwst/co2.body-map.json', quantity: 'band depth (dimensionless)', observation: 'jw01250-o001', angularResolutionArcsec: 0.2, surfaceResolutionKm: 611 }]);
  assert.deepEqual(nirspec.evidence.investigations.map(entry => entry.id), ['jwst-carbon-dioxide']);
  assert.deepEqual(candidate(answer, 'MIRI/IFU').evidence.bodyMaps, []);
  assert.deepEqual(answer.withoutTheTarget.map(entry => entry.telescope), ['naco']);
  assert.ok(candidate(answer, 'MIRI/IFU').unknown.some(line => line.includes('no body map beside the object names it')));
});

test('a capability entry states a range, a kind this repository knows and a citation, or it is refused', () => {
  const entry = { telescope: 'JWST', mode: 'NIRCAM/IMAGE', wavelengthMicrometres: [0.6, 5], apertureMetres: 6.5, kinds: ['image'], citation };
  assert.throws(() => parseModeCapabilities({ schema: 'other@1', modes: [entry] }), /Unsupported mode capability schema/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, kinds: ['picture'] }] }), /unknown product kind/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, wavelengthMicrometres: [5, 0.6] }] }), /which is not a range/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, citation: undefined }] }), /citation must be a string/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, mode: 'NIRCAM/GRISM', wavelengthMicrometres: 'bands' }] }), /no bands in bands.mts/u);
});

test('the committed ledgers: Europa at 3.4 to 3.6 micrometres is a proven JWST cube target, and nothing claims a sharpness', async () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], kind: 'cube' }, await loadQueryInputs(ROOT, 'europa'));
  const nirspec = candidate(answer, 'NIRSPEC/IFU');
  assert.equal(nirspec.telescope, 'JWST');
  assert.equal(nirspec.meetsConstraints.wavelength?.answer, 'yes');
  assert.equal(nirspec.meetsConstraints.kind?.answer, 'yes');
  assert.equal(nirspec.toolkitSupport.level, 'proven');
  assert.ok(nirspec.toolkitSupport.targetProgramChecked, 'a checked program of Europa');
  assert.ok(nirspec.evidence.archiveDate.length === 10, 'the ledger says when the archive was read');
  assert.ok(answer.candidates.length > 1, 'other modes observed Europa too');
  for (const entry of answer.candidates) assert.notEqual(entry.meetsConstraints.angularResolution?.answer, 'yes');
});

test('the committed ledgers: no candidate for any target ever answers yes for sharpness', async () => {
  for (const target of ['europa', 'jupiter', 'betelgeuse', 'ceres']) {
    const loaded = await loadQueryInputs(ROOT, target);
    for (const arcsec of [1e-6, 0.05, 1, 1000]) {
      const answer = queryCapabilities({ target, wavelengthMicrometres: [0.5, 5], angularResolutionArcsec: arcsec, rangeKm: 6.3e8, bodyRadiusKm: 1560.8, surfaceResolutionKm: 10, resolutionElements: 8 }, loaded);
      for (const entry of answer.candidates) {
        assert.notEqual(entry.meetsConstraints.angularResolution?.answer, 'yes', `${entry.telescope} ${entry.mode} claimed a sharpness`);
        assert.notEqual(entry.meetsConstraints.surfaceResolution?.answer, 'yes', `${entry.telescope} ${entry.mode} claimed kilometres`);
        assert.notEqual(entry.meetsConstraints.resolutionElements?.answer, 'yes', `${entry.telescope} ${entry.mode} claimed elements`);
      }
    }
  }
});

/** Ledger modes with no sourced entry in `modes.json`: the query reports each as "capabilities not recorded". A mode leaves
 * this list by being sourced, and a new ledger mode joins it deliberately. Hubble's aggregate keys (ACS, COS, STIS, WFPC2 and
 * COS-STIS) name no one detector, and the rest are retired instruments or NACO techniques whose own pages state no wavelength
 * range. */
const WITHOUT_CAPABILITIES: readonly string[] = ['Hubble ACS', 'Hubble COS', 'Hubble COS-STIS', 'Hubble FGS', 'Hubble FOC/48', 'Hubble FOC/96', 'Hubble FOS/BL', 'Hubble FOS/RD',
  'Hubble HRS', 'Hubble HRS/1', 'Hubble HRS/2', 'Hubble HSP/UNK/POL', 'Hubble HSP/UNK/UV1', 'Hubble HSP/UNK/UV2', 'Hubble HSP/UNK/VIS', 'Hubble STIS', 'Hubble WFPC/PC',
  'Hubble WFPC/WFC', 'Hubble WFPC2', 'VLT/NACO app', 'VLT/NACO chopping', 'VLT/NACO coronography', 'VLT/NACO cube', 'VLT/NACO differential', 'VLT/NACO fabry-perot',
  'VLT/NACO other', 'VLT/NACO sam', 'VLT/NACO sampol'];

test('every capability entry names a mode the ledgers use, and the modes without one are the known list', async () => {
  const loaded = await loadQueryInputs(ROOT, 'europa');
  const keys = new Set(ledgerModeKeys(loaded.ledgers).map(entry => `${entry.telescope} ${entry.mode}`));
  for (const entry of loaded.capabilities) assert.ok(keys.has(`${entry.telescope} ${entry.mode}`), `${entry.telescope} ${entry.mode} is in modes.json but in no ledger`);
  const recorded = new Set(loaded.capabilities.map(entry => `${entry.telescope} ${entry.mode}`));
  assert.deepEqual([...keys].filter(key => !recorded.has(key)).sort(), WITHOUT_CAPABILITIES);
  for (const entry of loaded.capabilities) assert.match(entry.citation, /^https:\/\//u, `${entry.mode} cites where its numbers were read`);
});
