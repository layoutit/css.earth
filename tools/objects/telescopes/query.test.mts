/** What the capability query may and may not say. The cases run on small ledgers written here, in the shapes the real
 * ledgers use, so nothing asks an archive anything; the last cases run on the committed ledgers themselves. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolve } from 'node:path';
import { BODY_MAP_SCHEMA } from '../body-map-product.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { assessObservationSelection, formatAnswer, ledgerModeKeys, loadQueryInputs, mergeIntervals, MODES_SCHEMA, parseModeCapabilities, QUERY_HELP, queryCapabilities, selectObservation, type Candidate, type CapabilityAnswer, type QueryInputs } from './query.mts';
import { hydrateTargetAssociation, parseTargetAssociationSources, TARGET_ASSOCIATIONS_SCHEMA } from './target-associations.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
const citation = 'https://jwst-docs.stsci.edu/jwst-near-infrared-spectrograph';
const psf = 'https://cxc.harvard.edu/proposer/POG/html/chap4.html';

const CAPABILITIES = parseModeCapabilities({ schema: MODES_SCHEMA, modes: [
  { telescope: 'JWST', mode: 'NIRSPEC/IFU', wavelengths: 'bands', apertureMetres: 6.5, pixelScaleArcsec: 0.1, kinds: ['cube'], citation },
  { telescope: 'JWST', mode: 'NIRCAM/IMAGE', wavelengths: [[0.6, 2.3], [2.4, 5]], apertureMetres: 6.5, pixelScaleArcsec: 0.031, kinds: ['image'], citation },
  { telescope: 'JWST', mode: 'NIRCAM/CORON', wavelengths: [[1.8, 2.2], [2.8, 5]], apertureMetres: 6.5, pixelScaleArcsec: 0.031, kinds: ['image'], citation },
  { telescope: 'Chandra', mode: 'ACIS-S', wavelengths: [[0.000124, 0.0031]], apertureMetres: 1.2, pixelScaleArcsec: 0.492, kinds: ['events'], citation: psf,
    instrumentResolutionArcsec: 0.5, instrumentResolutionBasis: 'the mirror assembly point spread function, under 0.5 arcsec full width at half maximum', instrumentResolutionCitation: psf },
  { telescope: 'Hubble', mode: 'STIS/CCD', wavelengths: [[0.164, 1.03]], apertureMetres: 2.4, pixelScaleArcsec: 0.05, kinds: ['image', 'spectrum'], citation },
  { telescope: 'Hubble', mode: 'STIS/FUV-MAMA', wavelengths: [[0.115, 0.17]], apertureMetres: 2.4, pixelScaleArcsec: 0.025, kinds: ['image', 'spectrum'], citation },
  { telescope: 'Spitzer', mode: 'IRAC Map PC', wavelengths: [[3.176, 3.926], [3.988, 4.998]], apertureMetres: 0.85, pixelScaleArcsec: 1.213,
    instrumentResolutionArcsec: 1.66, instrumentResolutionBasis: 'best cryogenic IRAC mean PRF FWHM', instrumentResolutionCitation: citation, kinds: ['image'], citation },
  { telescope: 'Spitzer', mode: 'IRAC Map', wavelengths: [[3.176, 3.926], [3.988, 4.998], [5.02, 6.44], [6.408, 9.338]], apertureMetres: 0.85, pixelScaleArcsec: 1.213,
    instrumentResolutionArcsec: 1.66, instrumentResolutionBasis: 'best cryogenic IRAC mean PRF FWHM', instrumentResolutionCitation: citation, kinds: ['image'], citation },
  { telescope: 'Spitzer', mode: 'IRS Stare', wavelengths: [[5.13, 39.9]], apertureMetres: 0.85, pixelScaleArcsec: 1.8, kinds: ['spectrum'], citation },
  { telescope: 'VLT/NACO', mode: 'imaging', wavelengths: [[1, 5]], apertureMetres: 8.2, pixelScaleArcsec: 0.01326, kinds: ['image'], citation },
  { telescope: 'Juno', mode: 'JUNOCAM', wavelengths: [[0.42, 0.9]], pixelScaleArcsec: 138.7, kinds: ['strips'], citation }] });

const JWST_LEDGER = { schema: 'cssearth-jwst-ledger@1', archiveDate: '2026-09-19', modes: [
  { mode: 'NIRSPEC/IFU', tool: 'tools/objects/jwst/cubes/spec3.mts', programs: ['europa-1250', 'sn-1987a-1232'], checked: ['europa-1250'] },
  { mode: 'MIRI/IFU', tool: null, programs: [], checked: [] },
  { mode: 'NIRCAM/CORON', tool: 'tools/objects/jwst/imaging/coron3.mts', programs: ['hd-181327-2780'], checked: ['hd-181327-2780'] },
  { mode: 'NIRCAM/IMAGE', tool: 'tools/objects/jwst/imaging/image3.mts', programs: ['ngc-3132-2733'], checked: [] }],
  objects: [{ id: 'europa', observations: { 'NIRSPEC/IFU': 13, 'MIRI/IFU': 12, 'NIRCAM/IMAGE': 6 }, programmes: ['1250', '4023'], drawn: ['NIRSPEC/IFU'] },
    { id: 'hd-181327', observations: { 'NIRCAM/CORON': 12 }, programmes: ['2780'], drawn: ['NIRCAM/CORON'] }] };
const HST_LEDGER = { schema: 'cssearth-hst-ledger@1', archiveDate: '2026-09-19', configurations: [
  { configuration: 'STIS/CCD', tool: 'tools/objects/hst/calibrate.mts', programs: ['europa-14650'], checked: ['europa-14650'] },
  { configuration: 'STIS/FUV-MAMA', tool: 'tools/objects/hst/calibrate.mts', programs: ['europa-13040'], checked: ['europa-13040'] },
  { configuration: 'STIS/NUV-MAMA', tool: 'tools/objects/hst/calibrate.mts', programs: [], checked: [] }],
  movingTargets: [{ object: 'europa', observations: 895, configurations: ['STIS/CCD', 'STIS/FUV-MAMA', 'STIS/NUV-MAMA'] }], fixedTargets: [] };
const CHANDRA_LEDGER = { schema: 'cssearth-chandra-ledger@1', measured: '2026-09-19', archive: { byInstrument: { 'HRC-I': 2006, 'ACIS-S': 14_863 } },
  modes: { 'ACIS-S no grating TIMED/FAINT': { state: 'reproduced', program: 'jupiter-acis', obsid: 18_676, target: 'Jupiter' } },
  shippedObjects: { jupiter: { matchedBy: 'target name', observations: 2, longest: [{ obsid: 18_676, target: 'Jupiter', instrument: 'ACIS-S', grating: 'NONE', exposureKs: 9.3, startDate: '2016-05-24T12:00:00' }] } } };
const NACO_LEDGER = { schema: 'cssearth-naco-ledger@2', measured: '2026-09-19',
  modes: [{ mode: 'imaging', frames: 10, programs: ['ceres-080C0881'], receipts: ['ceres-080C0881.COADDED_IMG.reproduction.json'], state: 'reduced' },
    { mode: 'cube', frames: 4, programs: [], receipts: [], state: 'refused', reason: 'This route refuses the mode.' }],
  objects: [{ id: 'ceres', targets: ['CERES'], frames: 14, programmes: ['080.C-0881(A)'], modes: ['imaging', 'cube'], records: [
    { id: '080.C-0881-A-CERES-2007-11-11-imaging', programme: '080.C-0881(A)', archiveTarget: 'CERES', mode: 'imaging', night: '2007-11-11',
      startIso: '2007-11-11T02:38:47Z', endIso: '2007-11-11T02:54:00Z', frames: 10 }] },
    { id: 'vesta', targets: ['VESTA'], frames: 217, programmes: ['076.C-0580(A)'], modes: ['imaging', 'spectroscopy'], records: [
      { id: '076.C-0580-A-VESTA-2006-01-01-imaging', programme: '076.C-0580(A)', archiveTarget: 'VESTA', mode: 'imaging', night: '2006-01-01',
        startIso: '2006-01-01T01:00:00Z', endIso: '2006-01-01T02:00:00Z', frames: 100 }] }] };
const JUNO_LEDGER = { schema: 'cssearth-junocam-ledger@1', measured: '2026-09-19', objects: [
  { id: 'europa', target: 'EUROPA', colourImages: 52, measuredImages: 4, programs: ['europa-pj45'], state: 'measured', why: '4 image(s) registered.' },
  { id: 'io', target: 'IO', colourImages: 247, measuredImages: 0, programs: [], state: 'not measured', why: 'No program of this target is pinned.' }] };
const SPITZER_LEDGER = { schema: 'cssearth-spitzer-ledger@4', archiveDate: '2026-09-19', searched: ['itokawa'], modes: [
  { mode: 'IRAC Map PC', tool: null, programs: [], checked: [], receipts: [] }, { mode: 'IRS Stare', tool: null, programs: [], checked: [], receipts: [] }], holdings: [{ object: 'itokawa', modes: { 'IRAC Map PC': 1, 'IRS Stare': 2 }, records: [
    { id: '1', programme: '292', mode: 'IRS Stare', title: 'epoch one', startIso: '2007-05-03T23:01:47.812Z', endIso: '2007-05-03T23:36:43.455Z' },
    { id: '2', programme: '292', mode: 'IRS Stare', title: 'epoch two', startIso: '2007-05-04T01:42:54.417Z', endIso: '2007-05-04T02:17:50.064Z' },
    { id: '3', programme: '61012', mode: 'IRAC Map PC', title: 'warm IRAC', startIso: '2010-05-15T14:35:42.395Z', endIso: '2010-05-15T14:49:52.594Z' },
  ] }] };

const bodyMap = (telescope: string, instrument: string, id: string) => ({ schema: BODY_MAP_SCHEMA,
  definition: { quantity: 'salt band depth', units: 'dimensionless', timeDependence: 'surface-property', method: { window: [0.45, 0.5] }, source: 'a paper' },
  frame: { body: 'europa', radiusKm: 1560.8, rotation: { model: 'pck00011.tpc', bodyCode: 502 } },
  grid: { width: 4, height: 2, longitude: 'east-positive-from-0', rows: 'north-to-south' },
  planes: { file: 'map.fits', value: 'SCI', uncertainty: 'ERR' }, mask: { maximumEmissionDegrees: 70, missing: 'NaN' },
  observations: [{ id, telescope, instrument, midTimeJd: 2_459_800.5, rangeKm: 6.3e8, subObserver: { latitudeDegrees: 0, westLongitudeDegrees: 180 },
    angularResolution: { majorArcsec: 0.05, minorArcsec: 0.05, basis: 'fitted point spread function' } }] });

const inputs = (ledgers: readonly { telescope: string; value: unknown }[], rest: Partial<QueryInputs> = {}): QueryInputs =>
  ({ ledgers: ledgers.map(entry => ({ ...entry, path: `data/${entry.telescope}/ledger.json` })), capabilities: CAPABILITIES,
    targetCatalogue: ['europa', 'hd-181327', 'ceres', 'vesta', 'jupiter', 'itokawa', 'io', 'flora', 'm42', 'bennu', 'comet-1p', 'comet-81p', 'nix', 'hydra'].map(id => ({ id, name: id === 'bennu' ? 'Bennu' : id, aliases: [] })),
    targetAssociations: [], bodyMaps: [], ...rest });
const candidate = (answer: CapabilityAnswer, mode: string): Candidate => {
  const found = answer.candidates.find(entry => entry.mode === mode);
  assert.ok(found, `no candidate for ${mode}`);
  return found;
};

test('a JWST cube mode takes its coverage from the bands, and touching bands become one interval', () => {
  assert.deepEqual(JWST_CUBE_COVERAGE['NIRSPEC-PRISM-CLEAR'], [0.6, 5.3]);
  assert.deepEqual(CAPABILITIES.find(entry => entry.mode === 'NIRSPEC/IFU')?.wavelengthIntervals, [[0.6, 5.3]]);
  assert.deepEqual(mergeIntervals([[2.8, 5], [1.8, 2.2], [2.2, 2.4]]), [[1.8, 2.4], [2.8, 5]]);
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }]));
  assert.equal(candidate(answer, 'NIRSPEC/IFU').meetsConstraints.wavelength?.answer, 'yes');
});

test('a colliding designation remains ambiguous through the capability query', () => {
  const answer = queryCapabilities({ target: '2009 RE26', wavelengthMicrometres: [0.5, 0.7] }, inputs([], { targetCatalogue: [
    { id: 'emilylakdawalla', name: 'Emilylakdawalla', aliases: ['2009 RE26'] },
    { id: 'other-object', name: 'Other object', aliases: ['2009RE26'] },
  ] }));
  assert.equal(answer.targetResolution.status, 'ambiguous');
  assert.equal(answer.endpoint.status, 'unknown-target');
  assert.match(formatAnswer(answer), /Ambiguous target 2009 RE26/u);
});

test('a gap between the two intervals of a mode is not coverage', () => {
  const ask = (from: number, to: number) => candidate(queryCapabilities({ target: 'hd-181327', wavelengthMicrometres: [from, to] },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRCAM/CORON').meetsConstraints.wavelength!;
  assert.equal(ask(2.4, 2.6).answer, 'no');
  assert.match(ask(2.4, 2.6).reason, /1\.8 to 2\.2 and 2\.8 to 5 micrometres; 2\.4 to 2\.6 falls outside every one of them/u);
  assert.equal(ask(2, 3).answer, 'partial');
  assert.match(ask(2, 3).reason, /only 2 to 2\.2 and 2\.8 to 3 of the request is inside it/u);
  assert.equal(ask(3, 3.2).answer, 'yes');
  assert.equal(candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [2.31, 2.39] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRCAM/IMAGE')
    .meetsConstraints.wavelength?.answer, 'no');
});

test('targets resolve through the shipped catalogue, while a near typo is a distinct unknown target', () => {
  const known = queryCapabilities({ target: 'Bennu', wavelengthMicrometres: [3.5, 3.9] }, inputs([]));
  assert.equal(known.target, 'bennu');
  assert.deepEqual(known.targetResolution, { status: 'resolved', requested: 'Bennu', canonical: { id: 'bennu', name: 'Bennu' }, matchedBy: 'name' });
  const typo = queryCapabilities({ target: 'bannu', wavelengthMicrometres: [3.5, 3.9] }, inputs([]));
  assert.equal(typo.endpoint.status, 'unknown-target');
  assert.deepEqual(typo.endpoint.blockerCodes, ['unknown-target']);
  assert.deepEqual(typo.targetResolution.status === 'unknown' ? typo.targetResolution.suggestions.map(entry => entry.id) : [], ['bennu']);
  assert.deepEqual(typo.withoutTheTarget, []);
  assert.match(formatAnswer(typo), /Did you mean Bennu \(bennu\)/u);
});

test('an unsearched target is an incomplete index, while an explicit empty search is a real negative', () => {
  const base = { schema: 'cssearth-spitzer-ledger@4', archiveDate: '2026-09-19', modes: [], holdings: [], unanswered: [], searched: [] };
  const skipped = queryCapabilities({ target: 'comet-1p', wavelengthMicrometres: [0.6, 0.7], time: { any: true }, angularResolutionArcsec: 2,
    kind: 'image', result: 'telescope-product' }, inputs([{ telescope: 'spitzer', value: { ...base, notAsked: [{ object: 'comet-1p', reason: 'moving-target identifier unavailable' }] } }]));
  assert.equal(skipped.endpoint.status, 'index-incomplete');
  assert.deepEqual(skipped.endpoint.blockerCodes, ['target-index-unavailable']);
  assert.deepEqual(skipped.targetCoverage, [{ telescope: 'spitzer', ledger: 'data/spitzer/ledger.json', state: 'not-searched', reason: 'moving-target identifier unavailable' }]);
  assert.deepEqual(skipped.withoutTheTarget, []);
  const unsearched = queryCapabilities({ ...skipped.request }, inputs([{ telescope: 'spitzer', value: { ...base, notAsked: [] } }]));
  assert.equal(unsearched.endpoint.status, 'index-incomplete');
  const empty = queryCapabilities({ ...skipped.request }, inputs([{ telescope: 'spitzer', value: { ...base, searched: ['comet-1p'], notAsked: [] } }]));
  assert.equal(empty.endpoint.status, 'no-selectable-candidate');
  assert.deepEqual(empty.withoutTheTarget.map(entry => entry.telescope), ['spitzer']);
});

test('PDS products rejected by normalization are not reported as an empty archive', () => {
  const ledger = { schema: 'cssearth-pds-ledger@1', archiveDate: '2026-09-19', searched: ['comet-81p'], modes: [], objects: [], searches: [
    { target: 'comet-81p', registryProducts: 2, admittedProducts: 0, scope: { productClass: 'Product_Observational', processingLevels: 'all' },
      rejected: [{ lidvid: 'urn:nasa:pds:a::1.0', reason: 'ambiguous instrument' }, { lidvid: 'urn:nasa:pds:b::1.0', reason: 'unsupported structure' }] },
  ] };
  const answer = queryCapabilities({ target: 'comet-81p', wavelengthMicrometres: [0.5, 0.7], time: { any: true }, kind: 'image', result: 'telescope-product', angularResolutionArcsec: 1 },
    inputs([{ telescope: 'pds', value: ledger }]));
  const coverage = answer.targetCoverage[0]!;
  assert.equal(coverage.state, 'unsupported-products');
  assert.deepEqual([coverage.registryProducts, coverage.admittedProducts, coverage.rejected?.length], [2, 0, 2]);
  assert.deepEqual(answer.withoutTheTarget, []);
  assert.deepEqual(answer.endpoint.blockerCodes, ['archive-products-unsupported']);
});

test('an indexed observation exposes a telescope-owned qualification action when qualification is the only blocker', () => {
  const ledger = { schema: 'cssearth-spitzer-ledger@4', archiveDate: '2026-09-19', searched: ['bennu'], modes: [
    { mode: 'IRAC Map', tool: 'tools/objects/spitzer/mosaic.mts', programs: [], checked: [], receipts: [] }],
  holdings: [{ object: 'bennu', modes: { 'IRAC Map': 1 }, records: [
    { id: '21415424', programme: '289', mode: 'IRAC Map', title: 'Bennu', startIso: '2007-05-08T16:23:47.636Z', endIso: '2007-05-08T16:27:43.816Z' }] }] };
  const request = { target: 'bennu', wavelengthMicrometres: [3.5, 3.9] as const, time: { any: true as const }, angularResolutionArcsec: 2,
    kind: 'image' as const, result: 'telescope-product' as const };
  const answer = queryCapabilities(request, inputs([{ telescope: 'spitzer', value: ledger }]));
  const irac = candidate(answer, 'IRAC Map');
  assert.deepEqual(irac.selectionAssessment.blockers.map(blocker => blocker.code), ['target-program-unqualified']);
  assert.deepEqual(irac.selectionAssessment.qualificationActions, [{ kind: 'qualify-observation', observation: '21415424', archiveProgramme: '289',
    program: 'bennu-21415424', configuration: { kind: 'spitzer-irac-channel', channel: 1 }, command: 'pnpm', arguments: ['--silent', 'telescope:qualify', '--target', 'bennu', '--telescope', 'Spitzer',
      '--mode', 'IRAC Map', '--observation', '21415424', '--channel', '1'] }]);
  const qualified = queryCapabilities(request, inputs([{ telescope: 'spitzer', value: { ...ledger, modes: [{ ...ledger.modes[0], programs: ['bennu-21415424'], checked: ['bennu-21415424'] }] } }]));
  assert.equal(candidate(qualified, 'IRAC Map').selectionAssessment.selectable, true);
  assert.equal(candidate(qualified, 'IRAC Map').selectionAssessment.qualificationActions.length, 1, 'a ledger claim alone cannot suppress qualification of an exact output');
});

test('a cited target-in-field association exposes exact observations without changing the archive target', () => {
  const source = { schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [{ target: 'nix', archive: 'mast', collection: 'HST',
    observations: ['j96o01010', 'j96o02010'],
    evidence: [{ citation: 'https://example.test/paper', locator: 'table 1', establishes: 'Nix is measured in both Pluto pointings.' }] }] };
  const associations = hydrateTargetAssociation(parseTargetAssociationSources(source)[0]!, { astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', observations: [
    { id: 'j96o01010', collection: 'HST', archiveTarget: 'PLUTO', programme: '10427', mode: 'ACS/WFC', startIso: '2005-05-15T00:21:00.197Z', endIso: '2005-05-15T01:56:09.210Z', filter: 'F606W' },
    { id: 'j96o02010', collection: 'HST', archiveTarget: 'PLUTO', programme: '10427', mode: 'ACS/WFC', startIso: '2005-05-18T03:06:58.213Z', endIso: '2005-05-18T03:46:03.197Z', filter: 'F606W' }] });
  const ledger = { ...HST_LEDGER, configurations: [...HST_LEDGER.configurations,
    { configuration: 'ACS/WFC', tool: 'tools/objects/hst/calibrate.mts', programs: [], checked: [], archiveFinal: { programs: [], qualified: [] } }] };
  const answer = queryCapabilities({ target: 'nix', wavelengthMicrometres: [0.5, 0.7], time: { any: true }, angularResolutionArcsec: 1,
    kind: 'image', result: 'telescope-product' }, inputs([{ telescope: 'hst', value: ledger }], { targetAssociations: associations }));
  const acs = candidate(answer, 'ACS/WFC');
  assert.deepEqual(acs.observations, { count: 2, scope: 'this-mode', records: [
    { id: 'j96o01010', startIso: '2005-05-15T00:21:00.197Z', endIso: '2005-05-15T01:56:09.210Z', filter: 'F606W', programme: '10427', archiveTarget: 'PLUTO' },
    { id: 'j96o02010', startIso: '2005-05-18T03:06:58.213Z', endIso: '2005-05-18T03:46:03.197Z', filter: 'F606W', programme: '10427', archiveTarget: 'PLUTO' }] });
  assert.deepEqual(acs.programmes, ['10427']);
  assert.equal(acs.toolkitSupport.level, 'tool-without-checked-program');
  assert.deepEqual(acs.selectionAssessment.blockers.map(blocker => blocker.code), ['target-program-unqualified']);
  assert.deepEqual(acs.evidence.targetAssociations, [{ source: 'data/telescopes/target-associations.json', archive: 'mast', collection: 'HST', archiveTarget: 'PLUTO', programme: '10427',
    astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z',
    citation: 'https://example.test/paper', locator: 'table 1', establishes: 'Nix is measured in both Pluto pointings.' }]);
  assert.match(formatAnswer(answer), /MAST HST via Astroquery 0\.4\.11.*archive target PLUTO, programme 10427/u);
  const unrelated = queryCapabilities({ ...answer.request, target: 'hydra' }, inputs([{ telescope: 'hst', value: ledger }], { targetAssociations: associations }));
  assert.equal(unrelated.candidates.length, 0, 'a field association belongs only to the target its evidence names');
});

test('a mode with no recorded capabilities answers unknown and says so, rather than guessing', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [5, 7], kind: 'cube' }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }]));
  const miri = candidate(answer, 'MIRI/IFU');
  assert.deepEqual(['wavelength', 'angularResolution', 'kind'].map(name => miri.meetsConstraints[name]?.answer), ['unknown', 'unknown', 'unknown']);
  assert.match(miri.meetsConstraints.wavelength!.reason, /Capabilities not recorded/u);
  assert.ok(miri.unknown.some(line => line.includes('Capabilities not recorded')));
});

test('an explicit selection keeps unknowns and refuses a hard no or another target\'s program', () => {
  const complete = { target: 'europa', wavelengthMicrometres: [3.4, 3.6] as const, kind: 'cube' as const, result: 'body-map' as const,
    time: { any: true as const }, angularResolutionArcsec: 0.3 };
  const answer = queryCapabilities(complete, inputs([{ telescope: 'jwst', value: JWST_LEDGER }]));
  const selected = selectObservation(answer, 'JWST', 'NIRSPEC/IFU', 'europa-1250');
  assert.equal(selected.toolkitLevel, 'proven');
  assert.equal(selected.bodyMapSupport.answer, 'yes');
  assert.equal(selected.constraints.wavelength?.answer, 'yes');
  assert.ok(selected.unresolved.some(entry => entry.constraint === 'angularResolution' && entry.answer === 'partial'));
  assert.equal(answer.endpoint.status, 'selectable-candidates');
  assert.equal(candidate(answer, 'NIRSPEC/IFU').selectionAssessment.selectable, true);
  assert.deepEqual(candidate(answer, 'NIRSPEC/IFU').selectionAssessment.nextActions[0]?.arguments.slice(-7),
    ['--select-telescope', 'JWST', '--select-mode', 'NIRSPEC/IFU', '--program', 'europa-1250', '--json']);
  assert.throws(() => selectObservation(answer, 'JWST', 'NIRSPEC/IFU', 'sn-1987a-1232'), /not a pinned or archive-final program of europa/u);
  const impossible = queryCapabilities({ ...complete, wavelengthMicrometres: [8, 9] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }]));
  assert.throws(() => selectObservation(impossible, 'JWST', 'NIRSPEC/IFU', 'europa-1250'), /cannot answer this request: wavelength/u);
});

test('selection requires a complete scientific request and exposes the shared NACO body-map author', () => {
  const incomplete = queryCapabilities({ target: 'ceres', wavelengthMicrometres: [2, 2.3], kind: 'image' }, inputs([{ telescope: 'naco', value: NACO_LEDGER }]));
  assert.equal(incomplete.endpoint.status, 'request-incomplete');
  assert.deepEqual(assessObservationSelection(incomplete, 'VLT/NACO', 'imaging', 'ceres-080C0881').blockers.map(blocker => blocker.code),
    ['incomplete-request', 'incomplete-request', 'incomplete-request']);
  const complete = queryCapabilities({ target: 'ceres', wavelengthMicrometres: [2, 2.3], kind: 'image', result: 'body-map', time: { any: true }, angularResolutionArcsec: 0.1 },
    inputs([{ telescope: 'naco', value: NACO_LEDGER }]));
  const naco = candidate(complete, 'imaging');
  assert.equal(naco.toolkitSupport.level, 'proven');
  assert.equal(naco.bodyMapSupport.answer, 'yes');
  assert.equal(naco.bodyMapSupport.author, 'tools/objects/naco/author-body-map.mts');
  assert.equal(selectObservation(complete, 'VLT/NACO', 'imaging', 'ceres-080C0881').programme, 'ceres-080C0881');
});

test('help states the complete request and the direction of a resolution limit', () => {
  assert.match(QUERY_HELP, /largest acceptable angular or surface scale/u);
  assert.match(QUERY_HELP, /pnpm --silent telescope:query/u);
});

test('a Vesta selection reports every blocker and human output separates archive from toolkit programs', () => {
  const answer = queryCapabilities({ target: 'vesta', wavelengthMicrometres: [1, 2], kind: 'image', result: 'body-map', time: { any: true }, angularResolutionArcsec: 0.1 },
    inputs([{ telescope: 'naco', value: NACO_LEDGER }]));
  const assessment = assessObservationSelection(answer, 'VLT/NACO', 'imaging', '076.C-0580(A)');
  assert.deepEqual(assessment.blockers.map(blocker => blocker.code), ['programme']);
  assert.throws(() => selectObservation(answer, 'VLT/NACO', 'imaging', '076.C-0580(A)'), error => {
    assert.match(String(error), /076\.C-0580\(A\) is not a pinned or archive-final program of vesta/u);
    return true;
  });
  const text = formatAnswer(answer);
  assert.match(text, /archive programmes recorded for vesta: 076\.C-0580\(A\)/u);
  assert.match(text, /pinned toolkit programs: ceres-080C0881/u);
  assert.match(text, /checked toolkit programs: ceres-080C0881/u);
  assert.match(text, /usable program of vesta: none/u);
  assert.deepEqual(candidate(answer, 'imaging').selectionAssessment.qualificationActions.map(action => action.configuration), [
    { kind: 'naco-program-night', programme: '076.C-0580(A)', archiveTarget: 'VESTA', night: '2006-01-01' },
  ]);
});

test('what the optics resolve can say no; what the pixels sample cannot', () => {
  const ask = (arcsec: number) => candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], angularResolutionArcsec: arcsec },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU').meetsConstraints.angularResolution!;
  assert.equal(ask(0.001).answer, 'no');
  assert.match(ask(0.001).reason, /optics cannot resolve better than 0\.132 arcsec \(1\.22 lambda \/ D at 3\.4 micrometres on 6\.5 m\)/u);
  assert.equal(ask(0.15).answer, 'unknown');
  assert.match(ask(0.15).reason, /the detector samples at 0\.2 arcsec \(two 0\.1 arcsec detector pixels\)\. Dithering, subpixel positioning and event centroiding/u);
  assert.equal(ask(1).answer, 'partial');
  assert.match(ask(1).reason, /^Possible/u);
  assert.equal(candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU')
    .meetsConstraints.angularResolution?.answer, 'unknown');
});

test('a documented point spread function, not the pixel, decides an X-ray detector', () => {
  const chandra = candidate(queryCapabilities({ target: 'jupiter', wavelengthMicrometres: [0.0005, 0.002], angularResolutionArcsec: 0.6 },
    inputs([{ telescope: 'chandra', value: CHANDRA_LEDGER }])), 'ACIS-S').meetsConstraints.angularResolution!;
  assert.equal(chandra.answer, 'unknown');
  assert.match(chandra.reason, /point spread function[\s\S]*which meets the 0\.6 arcsec asked for, but the detector samples at 0\.984 arcsec/u);
  const coarse = candidate(queryCapabilities({ target: 'jupiter', wavelengthMicrometres: [0.0005, 0.002], angularResolutionArcsec: 0.3 },
    inputs([{ telescope: 'chandra', value: CHANDRA_LEDGER }])), 'ACIS-S').meetsConstraints.angularResolution!;
  assert.equal(coarse.answer, 'no');
});

test('a mode with only a pixel scale answers unknown, because nothing says what its optics resolve', () => {
  const juno = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [0.5, 0.6], angularResolutionArcsec: 500 },
    inputs([{ telescope: 'juno', value: JUNO_LEDGER }])), 'JUNOCAM').meetsConstraints.angularResolution!;
  assert.equal(juno.answer, 'unknown');
  assert.match(juno.reason, /what the optics resolve is not recorded for this mode/u);
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
  assert.match(near.meetsConstraints.surfaceResolution!.reason, /402 km at the sub-observer point[\s\S]*611 km at the sub-observer point/u);
  assert.equal(near.meetsConstraints.resolutionElements?.answer, 'no');
  assert.match(near.meetsConstraints.resolutionElements!.reason, /7\.76 elements across the disc \(1\.22 lambda \/ D[^)]*\), which is coarser than the 8 elements asked for\. The detector samples at 5\.11 elements/u);
});

test('time is unknown unless the ledger dates that object in that mode', () => {
  const jwst = candidate(queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], time: { fromIso: '2022-01-01', toIso: '2023-01-01' } },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }])), 'NIRSPEC/IFU');
  assert.equal(jwst.meetsConstraints.time?.answer, 'unknown');
  assert.match(jwst.meetsConstraints.time!.reason, /carries no dates/u);
  const inside = candidate(queryCapabilities({ target: 'jupiter', wavelengthMicrometres: [0.0005, 0.002], time: { fromIso: '2016-01-01', toIso: '2017-01-01' } },
    inputs([{ telescope: 'chandra', value: CHANDRA_LEDGER }])), 'ACIS-S');
  assert.equal(inside.meetsConstraints.time?.answer, 'yes');
  const outside = candidate(queryCapabilities({ target: 'jupiter', wavelengthMicrometres: [0.0005, 0.002], time: { fromIso: '2020-01-01', toIso: '2021-01-01' } },
    inputs([{ telescope: 'chandra', value: CHANDRA_LEDGER }])), 'ACIS-S');
  assert.equal(outside.meetsConstraints.time?.answer, 'partial');
  assert.match(outside.meetsConstraints.time!.reason, /does not date the rest/u);
});

test('a complete observation index gives identities and a definite time refusal', () => {
  const answer = queryCapabilities({ target: 'itokawa', wavelengthMicrometres: [2, 2.2], time: { fromIso: '2005-09-01', toIso: '2005-10-31' },
    surfaceResolutionKm: 0.1, kind: 'image', result: 'body-map' }, inputs([{ telescope: 'spitzer', value: SPITZER_LEDGER }]));
  const irac = candidate(answer, 'IRAC Map PC');
  assert.equal(irac.meetsConstraints.wavelength?.answer, 'no');
  assert.equal(irac.meetsConstraints.time?.answer, 'no');
  assert.deepEqual(irac.programmes, ['61012']);
  assert.deepEqual(irac.observations?.records?.map(record => record.id), ['3']);
  assert.match(formatAnswer(answer), /observation 3, programme 61012: 2010-05-15/u);
});

test('toolkit support separates a checked program of this target from a tool that has never been proved', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }, { telescope: 'juno', value: JUNO_LEDGER }]));
  const nirspec = candidate(answer, 'NIRSPEC/IFU');
  assert.equal(nirspec.toolkitSupport.level, 'proven');
  assert.deepEqual([nirspec.toolkitSupport.targetProgramPinned, nirspec.toolkitSupport.targetProgramChecked], [true, true]);
  assert.deepEqual([nirspec.toolkitSupport.productionMethod, nirspec.toolkitSupport.evidenceBasis, nirspec.toolkitSupport.acceptanceCriterion],
    ['local-pipeline', 'accepted-route-receipts', 'receipt-valid-for-pinned-program']);
  assert.equal(nirspec.toolkitSupport.tool, 'tools/objects/jwst/cubes/spec3.mts');
  assert.equal(candidate(answer, 'NIRCAM/IMAGE').toolkitSupport.level, 'tool-without-checked-program');
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

test('a retired instrument with a qualified archive-final program is usable with limits, and never reads as re-calibrated', () => {
  // HRS/1 has no pipeline in the toolchain and never will; what it has is the archive's own final product of one Europa
  // observation, pinned and read here. The two must not collapse into one answer.
  const ledger = { ...HST_LEDGER, configurations: [...HST_LEDGER.configurations,
    { configuration: 'HRS/1', tool: null, programs: [], checked: [], archiveFinal: { programs: ['europa-ghrs-5376'], qualified: ['europa-ghrs-5376'] } },
    { configuration: 'HRS/2', tool: null, programs: [], checked: [], archiveFinal: { programs: ['europa-ghrs-other'], qualified: [] } }],
    movingTargets: [{ object: 'europa', observations: 895, configurations: ['STIS/CCD', 'HRS/1', 'HRS/2'] }] };
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [0.13, 0.15] }, inputs([{ telescope: 'hst', value: ledger }]));
  const qualified = candidate(answer, 'HRS/1').toolkitSupport;
  assert.equal(qualified.level, 'archive-final');
  assert.deepEqual([qualified.productionMethod, qualified.evidenceBasis, qualified.acceptanceCriterion], ['archive-final', 'archive-origin', 'archive-bytes-qualified']);
  assert.deepEqual(qualified.checked, [], 'nothing was re-calibrated on a retired instrument');
  assert.equal(qualified.tool, undefined);
  assert.deepEqual(qualified.archiveFinalQualified, ['europa-ghrs-5376']);
  assert.equal(qualified.targetProgramChecked, false);
  assert.equal(qualified.targetArchiveFinalQualified, true);
  assert.match(qualified.reason, /Nothing here re-calibrates this mode/u);
  assert.match(qualified.reason, /establishes those bytes and not a re-calibration here/u);
  // A program listed but not qualified establishes nothing, and the mode drops back to having no toolkit.
  const listed = candidate(answer, 'HRS/2').toolkitSupport;
  assert.equal(listed.level, 'none');
  assert.deepEqual(listed.archiveFinalQualified, []);
  // A re-calibrated mode is unchanged by any of this.
  const stis = candidate(answer, 'STIS/CCD').toolkitSupport;
  assert.equal(stis.level, 'proven');
  assert.deepEqual(stis.archiveFinalQualified, []);
  assert.match(formatAnswer(answer), /archive-final products qualified, not re-made here/u);
  assert.doesNotMatch(formatAnswer(answer).split('Hubble HRS/2')[0]!.split('Hubble HRS/1')[1] ?? '', /recalibrated here and checked/u);
});

test('a body map reaches the one detector it names, and no other', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [0.45, 0.5] },
    inputs([{ telescope: 'hst', value: HST_LEDGER }], { bodyMaps: [{ path: 'src/objects/europa/source/hst/salt.body-map.json', value: bodyMap('HST', 'STIS/CCD', 'oc-salt-1') }] }));
  assert.deepEqual(candidate(answer, 'STIS/CCD').evidence.bodyMaps, [{ path: 'src/objects/europa/source/hst/salt.body-map.json', quantity: 'salt band depth (dimensionless)',
    observation: 'oc-salt-1', basis: 'fitted point spread function', resolutionKind: 'unknown', angularResolutionArcsec: 0.05, surfaceResolutionKm: 153 }]);
  assert.deepEqual(candidate(answer, 'STIS/FUV-MAMA').evidence.bodyMaps, []);
  assert.deepEqual(candidate(answer, 'STIS/NUV-MAMA').evidence.bodyMaps, []);
  assert.deepEqual(answer.unassignedEvidence, []);
});

test('evidence that names no single mode is set aside with what it could mean', () => {
  const investigations = { path: 'src/objects/europa/investigations.json', value: { schema: 'cssearth-investigation-ledger@1', objectId: 'europa',
    entries: [{ id: 'jwst-carbon-dioxide', status: 'unresolved', subject: 'JWST NIRSpec carbon dioxide', finding: 'The released map is a figure, not a grid.' },
      { id: 'nirspec-ifu-short-gratings', status: 'excluded', subject: 'The NIRSPEC/IFU short gratings', finding: 'They saturate on Europa below 2.3 micrometres.' },
      { id: 'galileo-colour', status: 'included', subject: 'Controlled Galileo colour', finding: 'No telescope of this repository is involved.' }] } };
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6] },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }], { bodyMaps: [{ path: 'src/objects/europa/source/jwst/co2.body-map.json', value: bodyMap('JWST', 'NIRSPEC', 'jw01250-o001') },
      { path: 'src/objects/europa/source/other/sphere.body-map.json', value: bodyMap('VLT/SPHERE', 'IRDIS', 'sphere-1') }], investigations }));
  assert.deepEqual(candidate(answer, 'NIRSPEC/IFU').evidence.investigations.map(entry => entry.id), ['nirspec-ifu-short-gratings']);
  assert.deepEqual(candidate(answer, 'NIRSPEC/IFU').evidence.bodyMaps, []);
  assert.deepEqual(answer.unassignedEvidence.map(entry => [entry.kind, entry.identity]),
    [['body-map', 'JWST NIRSPEC, observation jw01250-o001'], ['body-map', 'VLT/SPHERE IRDIS, observation sphere-1'], ['investigation', 'jwst-carbon-dioxide: JWST NIRSpec carbon dioxide']]);
  assert.deepEqual(answer.unassignedEvidence[0]!.couldMean, ['JWST NIRSPEC/IFU', 'JWST MIRI/IFU', 'JWST NIRCAM/IMAGE']);
  assert.match(answer.unassignedEvidence[1]!.reason, /Nothing here knows the telescope VLT\/SPHERE/u);
  assert.deepEqual(answer.unassignedEvidence[1]!.couldMean, []);
});

test('candidates that cover the wavelengths come first', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [2.2, 2.5] },
    inputs([{ telescope: 'jwst', value: JWST_LEDGER }, { telescope: 'juno', value: JUNO_LEDGER }, { telescope: 'hst', value: HST_LEDGER }]));
  const rank = (entry: Candidate) => entry.meetsConstraints.wavelength?.answer === 'yes' ? 0 : entry.meetsConstraints.wavelength?.answer === 'partial' ? 1 : 2;
  assert.deepEqual(answer.candidates.map(rank), [...answer.candidates.map(rank)].sort());
  assert.equal(answer.candidates[0]?.mode, 'NIRSPEC/IFU');
});

test('a capability entry states its intervals, a kind this repository knows and a citation, or it is refused', () => {
  const entry = { telescope: 'JWST', mode: 'NIRCAM/IMAGE', wavelengths: [[0.6, 5]], apertureMetres: 6.5, kinds: ['image'], citation };
  assert.throws(() => parseModeCapabilities({ schema: 'other@1', modes: [entry] }), /Unsupported mode capability schema/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, kinds: ['picture'] }] }), /unknown product kind/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, wavelengths: [[5, 0.6]] }] }), /which is not a range/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, wavelengths: [[0.6, 2.3, 5]] }] }), /each interval as two wavelengths/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, citation: undefined }] }), /citation must be a string/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, instrumentResolutionArcsec: 0.5 }] }), /where it was read/u);
  assert.throws(() => parseModeCapabilities({ schema: MODES_SCHEMA, modes: [{ ...entry, mode: 'NIRCAM/GRISM', wavelengths: 'bands' }] }), /no bands in bands.mts/u);
});

test('the committed ledgers: Europa at 3.4 to 3.6 micrometres has historical JWST cube comparisons, and nothing claims a sharpness', async () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [3.4, 3.6], kind: 'cube' }, await loadQueryInputs(ROOT, 'europa'));
  const nirspec = candidate(answer, 'NIRSPEC/IFU');
  assert.equal(nirspec.telescope, 'JWST');
  assert.equal(nirspec.meetsConstraints.wavelength?.answer, 'yes');
  assert.equal(nirspec.meetsConstraints.kind?.answer, 'yes');
  assert.equal(nirspec.toolkitSupport.level, 'tool-without-checked-program', 'historical comparisons are not accepted qualification evidence');
  assert.equal(nirspec.toolkitSupport.targetProgramChecked, false, 'historical comparisons need explicit acceptance before they count as checked');
  assert.equal(nirspec.evidence.archiveDate.length, 10);
  assert.ok(answer.candidates.length > 1, 'other modes observed Europa too');
  for (const entry of answer.candidates) assert.notEqual(entry.meetsConstraints.angularResolution?.answer, 'yes');
});

test('the committed ledger turns Triton NIRSpec records into runnable band-specific qualification actions', async () => {
  const answer = queryCapabilities({ target: 'triton', wavelengthMicrometres: [1.55, 1.75], time: { fromIso: '2015-01-01', toIso: '2025-12-31' },
    rangeKm: 4_500_000_000, surfaceResolutionKm: 1_500, kind: 'cube', result: 'body-map' }, await loadQueryInputs(ROOT, 'triton'));
  const nirspec = candidate(answer, 'NIRSPEC/IFU');
  assert.equal(nirspec.meetsConstraints.time?.answer, 'yes');
  assert.deepEqual(nirspec.selectionAssessment.blockers.map(blocker => blocker.code), ['target-program-unqualified']);
  assert.deepEqual(nirspec.selectionAssessment.qualificationActions.map(action => [action.observation, action.configuration]), [
    ['jw01272-o003_t001_nirspec_g140h-f100lp', { kind: 'jwst-band', band: 'NIRSPEC-G140H-F100LP', wavelengthMicrometres: [1.55, 1.75] }],
    ['jw01272-o011_t001_nirspec_g140h-f100lp', { kind: 'jwst-band', band: 'NIRSPEC-G140H-F100LP', wavelengthMicrometres: [1.55, 1.75] }],
  ]);
  assert.deepEqual(nirspec.selectionAssessment.qualificationActions[0]!.arguments.slice(-4),
    ['--band', 'NIRSPEC-G140H-F100LP', '--wavelength', '1.55,1.75']);
});

test('the committed ledger turns each Pallas NACO night into a runnable archive qualification action', async () => {
  const answer = queryCapabilities({ target: 'pallas', wavelengthMicrometres: [2.1, 2.3], time: { any: true },
    angularResolutionArcsec: 0.1, kind: 'image', result: 'body-map' }, await loadQueryInputs(ROOT, 'pallas'));
  const naco = answer.candidates.find(entry => entry.telescope === 'VLT/NACO' && entry.mode === 'imaging')!;
  assert.deepEqual(naco.selectionAssessment.blockers.map(blocker => blocker.code), ['target-program-unqualified']);
  assert.deepEqual(naco.selectionAssessment.qualificationActions.map(action => [action.observation, action.configuration]), [
    ['074.C-0502-A-PALLAS-2005-02-02-imaging', { kind: 'naco-program-night', programme: '074.C-0502(A)', archiveTarget: 'PALLAS', night: '2005-02-02' }],
    ['074.C-0502-A-PALLAS-2005-03-12-imaging', { kind: 'naco-program-night', programme: '074.C-0502(A)', archiveTarget: 'PALLAS', night: '2005-03-12' }],
    ['074.C-0502-A-PALLAS-2005-03-13-imaging', { kind: 'naco-program-night', programme: '074.C-0502(A)', archiveTarget: 'PALLAS', night: '2005-03-13' }],
  ]);
});

test('the committed ledgers: HD 181327 between 2.4 and 2.6 micrometres falls in the NIRCam coronagraphy gap', async () => {
  const loaded = await loadQueryInputs(ROOT, 'hd-181327');
  const coron = candidate(queryCapabilities({ target: 'hd-181327', wavelengthMicrometres: [2.4, 2.6] }, loaded), 'NIRCAM/CORON');
  assert.equal(coron.meetsConstraints.wavelength?.answer, 'no');
  assert.equal(coron.meetsConstraints.angularResolution?.answer, 'unknown');
  assert.equal(coron.toolkitSupport.level, 'tool-without-checked-program');
  assert.equal(candidate(queryCapabilities({ target: 'hd-181327', wavelengthMicrometres: [3, 3.2] }, loaded), 'NIRCAM/CORON').meetsConstraints.wavelength?.answer, 'yes');
});

test('the committed archive ledgers expose sourced capabilities without inventing toolkit support', async () => {
  const m42 = queryCapabilities({ target: 'm42', wavelengthMicrometres: [0.5, 5] }, await loadQueryInputs(ROOT, 'm42'));
  const irac = candidate(m42, 'IRAC Map');
  assert.equal(irac.telescope, 'Spitzer'); assert.equal(irac.meetsConstraints.wavelength?.answer, 'partial');
  const kcwi = candidate(m42, 'KCWI');
  assert.equal(kcwi.telescope, 'Keck'); assert.equal(kcwi.toolkitSupport.level, 'proven'); assert.ok(kcwi.toolkitSupport.targetProgramChecked);
  const europa = queryCapabilities({ target: 'europa', wavelengthMicrometres: [0.5, 5] }, await loadQueryInputs(ROOT, 'europa'));
  const niri = candidate(europa, 'NIRI');
  assert.equal(niri.telescope, 'Gemini'); assert.equal(niri.meetsConstraints.wavelength?.answer, 'unknown');
  const nirspec = europa.candidates.find(entry => entry.telescope === 'Keck' && entry.mode === 'NIRSPEC')!;
  assert.equal(nirspec.toolkitSupport.level, 'none', 'a pinned program is not a runnable toolkit when its pipeline is absent');
  const selectableEuropa = queryCapabilities({ target: 'europa', wavelengthMicrometres: [0.5, 5], kind: 'spectrum', result: 'telescope-product', time: { any: true }, angularResolutionArcsec: 1 }, await loadQueryInputs(ROOT, 'europa'));
  assert.throws(() => selectObservation(selectableEuropa, 'Keck', 'NIRSPEC', 'europa-nirspec-2006a-c213ol'), /has no usable toolkit/u);
});

test('Itokawa retains Spitzer refusals and exposes pinned native sources without inventing their suitability', async () => {
  const answer = queryCapabilities({ target: 'itokawa', wavelengthMicrometres: [2, 2.2], time: { fromIso: '2005-09-01', toIso: '2005-10-31' },
    surfaceResolutionKm: 0.1, kind: 'image', result: 'body-map' }, await loadQueryInputs(ROOT, 'itokawa'));
  const archive = answer.candidates.filter(entry => entry.telescope === 'Spitzer');
  assert.deepEqual(archive.map(entry => entry.mode), ['IRAC Map PC', 'IRS Peakup Image', 'IRS Stare']);
  const native = answer.candidates.find(entry => entry.observations?.records?.some(record => record.sourceProductId));
  assert.ok(native, 'pinned native images should be queryable');
  assert.equal(native.meetsConstraints.wavelength?.answer, 'unknown');
  assert.ok(native.selectionAssessment.blockers.some(blocker => blocker.code === 'body-map-author-missing'));
  for (const entry of archive) {
    assert.equal(entry.meetsConstraints.wavelength?.answer, 'no');
    assert.equal(entry.meetsConstraints.time?.answer, 'no');
    assert.equal(entry.toolkitSupport.level, 'none');
  }
  assert.deepEqual(candidate(answer, 'IRAC Map PC').observations?.records?.map(record => record.id), ['35303936']);
  assert.deepEqual(candidate(answer, 'IRS Stare').programmes, ['292', '30080']);
});

test('the committed Flora request ends explicitly after sourced candidate refusals', async () => {
  const answer = queryCapabilities({ target: 'flora', wavelengthMicrometres: [0.55, 0.85], time: { any: true }, angularResolutionArcsec: 0.1,
    kind: 'image', result: 'body-map' }, await loadQueryInputs(ROOT, 'flora'));
  assert.equal(answer.endpoint.status, 'no-selectable-candidate');
  assert.equal(answer.endpoint.selectableCandidates, 0);
  const texes = candidate(answer, 'TEXES'), hires = candidate(answer, 'HIRES'), cube = candidate(answer, 'cube'), wfpc2 = candidate(answer, 'WFPC2/PC');
  assert.deepEqual([texes.meetsConstraints.wavelength?.answer, texes.meetsConstraints.kind?.answer], ['no', 'no']);
  assert.deepEqual([hires.meetsConstraints.wavelength?.answer, hires.meetsConstraints.kind?.answer], ['yes', 'no']);
  assert.deepEqual([cube.meetsConstraints.wavelength?.answer, cube.meetsConstraints.kind?.answer], ['no', 'no']);
  assert.deepEqual(wfpc2.selectionAssessment.blockers.map(blocker => blocker.code),
    ['body-map-author-missing', 'target-program-unqualified']);
  assert.match(formatAnswer(answer), /workflow: no-selectable-candidate; 0 of \d+ candidate mode\(s\) can proceed/u);
});

test('the committed Halley request exposes a real IHW archive-final image and the Spitzer index gap', async () => {
  const answer = queryCapabilities({ target: 'halley', wavelengthMicrometres: [0.6, 0.7], time: { fromIso: '1986-02-01', toIso: '1986-04-30' },
    angularResolutionArcsec: 2, kind: 'image', result: 'telescope-product' }, await loadQueryInputs(ROOT, 'halley'));
  assert.equal(answer.target, 'comet-1p');
  assert.equal(answer.endpoint.status, 'selectable-candidates');
  const ihw = candidate(answer, 'NNSN image');
  assert.equal(ihw.observations?.count, 3523);
  assert.deepEqual([ihw.meetsConstraints.time?.answer, ihw.meetsConstraints.kind?.answer, ihw.meetsConstraints.wavelength?.answer], ['yes', 'yes', 'unknown']);
  assert.equal(ihw.toolkitSupport.level, 'archive-final');
  assert.equal(ihw.selectionAssessment.selectable, true);
  assert.deepEqual(ihw.observations?.records?.find(record => record.id === 'NNSN1121'), { id: 'NNSN1121', programme: '401132',
    startIso: '1986-03-01T09:44:17.000Z', endIso: '1986-03-01T09:44:27.000Z', title: 'IHW GUNN_R', filter: 'GUNN_R', pixelScaleArcsec: 0.36,
    quality: 'EXCELLENT', observatory: 'EUROPEAN SOUTHERN', instrument: 'DANISH 1.5M REFL. / GEC CCD' });
  assert.equal(answer.targetCoverage.find(entry => entry.telescope === 'spitzer')?.state, 'not-searched');
});

test('the committed PDS bridge selects an exact Didymos product without claiming unknown wavelength or resolution', async () => {
  const answer = queryCapabilities({ target: 'didymos', wavelengthMicrometres: [0.55, 0.65], time: { any: true },
    angularResolutionArcsec: 5, kind: 'image', result: 'telescope-product' }, await loadQueryInputs(ROOT, 'didymos'));
  const lmi = answer.candidates.find(entry => entry.telescope === 'Lowell/LDT' && entry.mode === 'LMI/VR calibrated image')!;
  assert.equal(lmi.toolkitSupport.level, 'archive-final');
  assert.equal(lmi.toolkitSupport.productionMethod, 'archive-final');
  assert.match(lmi.toolkitSupport.reason, /retrieves and decodes products for this mode without recalibrating them/u);
  assert.deepEqual(lmi.observations?.records?.[0]?.wavelengthIntervalMicrometres, [0.520975, 0.697365]);
  assert.equal(lmi.selectionAssessment.selectable, true);
  const selected = selectObservation(answer, 'Lowell/LDT', 'LMI/VR calibrated image', 'didymos-pds-lmi-20201217-0048');
  assert.equal(selected.unresolved.some(entry => entry.constraint === 'observationWavelength'), false);
  assert.equal(selected.unresolved.some(entry => entry.constraint === 'angularResolution'), true);
});

test('the committed Charon discovery and qualification produce a selectable multiband archive-final product', async () => {
  const answer = queryCapabilities({ target: 'charon', wavelengthMicrometres: [0.5, 0.7], time: { any: true }, angularResolutionArcsec: 5,
    kind: 'image', result: 'telescope-product' }, await loadQueryInputs(ROOT, 'charon'));
  const mvic = answer.candidates.find(entry => entry.telescope === 'New Horizons' && entry.mode === 'MVIC mapped color')!;
  assert.equal(mvic.toolkitSupport.level, 'archive-final');
  assert.equal(mvic.selectionAssessment.selectable, true);
  assert.deepEqual(mvic.observations?.records?.[0]?.wavelengthIntervalsMicrometres, [[0.875, 0.915], [0.78, 0.96], [0.55, 0.7], [0.4, 0.55]]);
  const selected = selectObservation(answer, 'New Horizons', 'MVIC mapped color', 'charon-pds-nh_charon_color_mosaic');
  assert.equal(selected.unresolved.some(entry => entry.constraint === 'observationWavelength'), false);
  assert.equal(selected.unresolved.some(entry => entry.constraint === 'angularResolution'), true);
});

test('the committed Hydra search qualifies four separate MVIC images without inventing registration', async () => {
  const answer = queryCapabilities({ target: 'hydra', wavelengthMicrometres: [0.5, 0.54], time: { any: true }, angularResolutionArcsec: 5,
    kind: 'image', result: 'telescope-product' }, await loadQueryInputs(ROOT, 'hydra'));
  const mvic = answer.candidates.find(entry => entry.telescope === 'New Horizons' && entry.mode === 'MVIC color images')!;
  assert.equal(answer.candidates.some(entry => entry.mode === 'MVIC mapped color' || entry.mode === 'LMI/VR calibrated image'), false);
  assert.equal(mvic.toolkitSupport.level, 'archive-final');
  assert.equal(mvic.selectionAssessment.selectable, true);
  assert.deepEqual(mvic.observations?.records?.[0]?.wavelengthIntervalsMicrometres, [[0.4, 0.55], [0.54, 0.7], [0.78, 0.975], [0.86, 0.91]]);
  const selected = selectObservation(answer, 'New Horizons', 'MVIC color images', 'hydra-pds-cube_h_color_best');
  assert.equal(selected.unresolved.some(entry => entry.constraint === 'observationWavelength'), false);
  assert.equal(selected.unresolved.some(entry => entry.constraint === 'angularResolution'), true);
  assert.equal(selected.bodyMapSupport.answer, 'no');
});

test('one Wild 2 query sees source-pinned Stardust PDS3 observations without a discovery command', async () => {
  const answer = queryCapabilities({ target: 'comet-81p', wavelengthMicrometres: [0.5, 0.7], time: { any: true }, rangeKm: 240,
    surfaceResolutionKm: 0.1, kind: 'image', result: 'body-map' }, await loadQueryInputs(ROOT, 'comet-81p'));
  const navcam = answer.candidates.find(entry => entry.telescope === 'Stardust' && entry.mode === 'NAVCAM/RDR image')!;
  assert.equal(navcam.observations?.count, 5);
  assert.deepEqual(navcam.observations?.records?.map(record => record.id), ['n2069we02_rr', 'n2073we02_rr', 'n2075we02_rr', 'n2077we02_rr', 'n2079we02_rr']);
  assert.equal(navcam.observations?.records?.[0]?.centralWavelengthMicrometres, 0.6988);
  assert.deepEqual([navcam.meetsConstraints.wavelength?.answer, navcam.meetsConstraints.time?.answer, navcam.meetsConstraints.kind?.answer], ['unknown', 'yes', 'yes']);
  assert.equal(navcam.toolkitSupport.tool, 'tools/objects/telescopes/qualify-source.mts');
  assert.ok(navcam.selectionAssessment.blockers.some(blocker => blocker.code === 'body-map-author-missing'));
  assert.equal(answer.targetCoverage.find(entry => entry.telescope === 'package-sources')?.state, 'observed');
  assert.equal(navcam.observations?.records?.[0]?.requestSatisfaction?.constraints.wavelength?.answer, 'unknown');
});

/** Ledger modes with no sourced entry in `modes.json`: the query reports each as "capabilities not recorded". A mode leaves
 * this list by being sourced, and a new ledger mode joins it deliberately. Hubble's aggregate keys (ACS, COS, STIS, WFPC2 and
 * COS-STIS) name no one detector, `HRS` is the same where the catalogue names no detector, and the rest are retired instruments or
 * NACO techniques whose own pages state no wavelength range. The FOS and GHRS detectors left this list when their handbooks'
 * own ranges were read for the archive-final route; being sourced is not being re-calibrated here, and the query keeps those
 * two apart. */
const WITHOUT_CAPABILITIES: readonly string[] = ['Gemini Alopeke', 'Gemini CIRPASS', 'Gemini F2', 'Gemini FLAMINGOS', 'Gemini GHOST', 'Gemini GMOS', 'Gemini GMOS-N', 'Gemini GMOS-S',
  'Gemini GNIRS', 'Gemini GPI', 'Gemini GRACES', 'Gemini GSAOI', 'Gemini Hokupaa+QUIRC', 'Gemini IGRINS', 'Gemini IGRINS-2', 'Gemini MAROON-X', 'Gemini NICI', 'Gemini NIFS',
  'Gemini NIRI', 'Gemini OSCIR', 'Gemini PHOENIX', 'Gemini TReCS', 'Gemini Zorro', 'Gemini bHROS', 'Gemini hrwfs', 'Gemini michelle',
  'Hubble ACS', 'Hubble COS', 'Hubble COS-STIS', 'Hubble FGS', 'Hubble FOC/48', 'Hubble FOC/96',
  'Hubble HRS', 'Hubble HSP/UNK/POL', 'Hubble HSP/UNK/UV1', 'Hubble HSP/UNK/UV2', 'Hubble HSP/UNK/VIS', 'Hubble STIS', 'Hubble WFPC/PC',
  'Hubble WFPC/WFC', 'Hubble WFPC2', 'Keck DEIMOS', 'Keck ESI', 'Keck GUIDER', 'Keck KCWI', 'Keck KPF', 'Keck LRIS', 'Keck LWS', 'Keck MOSFIRE',
  'Keck NIRC', 'Keck NIRC2', 'Keck NIRES', 'Keck NIRSPEC', 'Keck OSIRIS',
  'VLT/NACO app', 'VLT/NACO chopping', 'VLT/NACO coronography', 'VLT/NACO differential', 'VLT/NACO fabry-perot',
  'VLT/NACO other', 'VLT/NACO sam', 'VLT/NACO sampol'];

test('every capability entry names a mode the ledgers use, and the modes without one are the known list', async () => {
  const loaded = await loadQueryInputs(ROOT, 'europa');
  const keys = new Set(ledgerModeKeys(loaded.ledgers).map(entry => `${entry.telescope} ${entry.mode}`));
  for (const entry of loaded.capabilities) assert.ok(keys.has(`${entry.telescope} ${entry.mode}`), `${entry.telescope} ${entry.mode} is in modes.json but in no ledger`);
  const recorded = new Set(loaded.capabilities.map(entry => `${entry.telescope} ${entry.mode}`));
  assert.deepEqual([...keys].filter(key => !recorded.has(key)).sort(), WITHOUT_CAPABILITIES);
  for (const entry of loaded.capabilities) assert.match(entry.citation, /^https:\/\//u, `${entry.mode} cites where its numbers were read`);
});
test('a qualified narrow product cannot hide another band or satisfy its request', () => {
  const ledger = { ...JWST_LEDGER, schema: 'cssearth-jwst-ledger@2', modes: [{ ...JWST_LEDGER.modes[0], programs: ['europa-narrow'], checked: ['europa-narrow'] }],
    objects: [{ id: 'europa', observations: { 'NIRSPEC/IFU': 1 }, programmes: ['1250'], drawn: [], records: [{ id: 'jw01250-o002_t001_nirspec_g395h-f290lp', mode: 'NIRSPEC/IFU', filter: 'F290LP;G395H', programme: '1250', startIso: '2023-01-01T00:00:00Z', endIso: '2023-01-01T01:00:00Z' }] }] };
  const qualifiedProducts = [{ target: 'europa', telescope: 'JWST', mode: 'NIRSPEC/IFU', observation: 'narrow', program: 'europa-narrow', product: 'narrow.fits', receipt: 'receipt.json', productRecord: 'narrow.fits.product.json', outputRoot: 'output',
    facts: { target: 'europa', verified: true, kind: 'cube' as const, result: 'telescope-product' as const, wavelengthIntervalsMicrometres: [[2.2, 2.4] as const] } }];
  const request = { target: 'europa', wavelengthMicrometres: [4.24, 4.28] as const, time: { any: true as const }, kind: 'cube' as const, result: 'telescope-product' as const, angularResolutionArcsec: 1 };
  const answer = queryCapabilities(request, inputs([{ telescope: 'jwst', value: ledger }], { qualifiedProducts }));
  const mode = candidate(answer, 'NIRSPEC/IFU');
  assert.equal(mode.selectionAssessment.selectable, false);
  assert.equal(mode.selectionAssessment.qualificationActions.length, 1);
  const partial = queryCapabilities(request, inputs([{ telescope: 'jwst', value: ledger }], { qualifiedProducts: [{ ...qualifiedProducts[0]!, observation: 'jw01250-o002_t001_nirspec_g395h-f290lp', facts: { ...qualifiedProducts[0]!.facts, wavelengthIntervalsMicrometres: [[4.2, 4.26]] } }] }));
  assert.equal(candidate(partial, 'NIRSPEC/IFU').selectionAssessment.qualificationActions.length, 1, 'a partial slice still offers the missing reduction');
  assert.throws(() => selectObservation(answer, 'JWST', 'NIRSPEC/IFU', 'europa-narrow'), /do not cover/);
  const matched = queryCapabilities({ ...request, wavelengthMicrometres: [2.25, 2.35] }, inputs([{ telescope: 'jwst', value: ledger }], { qualifiedProducts }));
  const selected = selectObservation(matched, 'JWST', 'NIRSPEC/IFU', 'europa-narrow');
  assert.equal(selected.product!.product, 'narrow.fits');
  assert.equal(selected.satisfaction.constraints.artifact!.answer, 'yes');
  assert.equal(selected.satisfaction.constraints.wavelength!.answer, 'yes');
  assert.equal(selected.satisfaction.constraints.angularResolution!.answer, 'unknown');
  assert.ok(!selected.unresolved.some(item => item.constraint === 'observationWavelength'));
});

test('an HST association transport failure preserves independent archive results', () => {
  const answer = queryCapabilities({ target: 'europa', wavelengthMicrometres: [4.24, 4.28] }, inputs([{ telescope: 'jwst', value: JWST_LEDGER }, { telescope: 'hst', value: HST_LEDGER }], { associationFailures: [{ collection: 'HST', reason: 'timeout' }] }));
  assert.ok(answer.candidates.some(candidate => candidate.telescope === 'JWST'));
  assert.equal(answer.targetCoverage.find(coverage => coverage.telescope === 'hst')!.state, 'unanswered');
});
