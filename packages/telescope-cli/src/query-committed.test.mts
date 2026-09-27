/** What the capability query says on the committed ledgers, programs, receipts and source manifests themselves; the cases on
 * small ledgers written in the shapes the real ledgers use are in query.test.mts. */
import assert from 'node:assert/strict';
import { restoredSources, sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';
import { formatAnswer, loadQueryInputs, queryCapabilities, selectObservation } from './query.mts';
import { ledgerModeKeys } from './query-modes.mts';
import type { Candidate, CapabilityAnswer } from './query-contract.mts';

const ROOT = WORKSPACE;
const candidate = (answer: CapabilityAnswer, mode: string): Candidate => {
  const found = answer.candidates.find(entry => entry.mode === mode);
  assert.ok(found, `no candidate for ${mode}`);
  return found;
};

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

test('Itokawa retains Spitzer refusals and exposes pinned native sources without inventing their suitability', async t => {
  // The native images are read from their downloaded FITS headers, which a bare clone does not hold: skip until they are restored.
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'src/objects/itokawa/source/manifest.json'), 'utf8')) as { inputs: { path: string; origin?: string }[] };
  const pinned = restoredSources('itokawa', ...manifest.inputs.filter(input => /\.fits?$/u.test(input.path) && /^https?:/u.test(input.origin ?? '')).map(input => input.path));
  if (pinned.skip) return t.skip(pinned.skip);
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
  assert.equal(navcam.toolkitSupport.tool, 'packages/telescope-cli/src/qualify-source.mts');
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

test('every receipt path a committed-ledger answer shows exists in this checkout, including receipts recorded before their programs moved', async () => {
  const shown: string[] = [];
  for (const target of ['charon', 'hydra', 'didymos', 'io', 'europa', 'ganymede', 'bennu']) {
    const answer = queryCapabilities({ target, wavelengthMicrometres: [0.1, 30], time: { any: true }, kind: 'image', result: 'telescope-product' },
      await loadQueryInputs(ROOT, target));
    const text = formatAnswer(answer);
    for (const entry of answer.candidates) for (const receipt of entry.evidence.receipts) {
      // Keck, Gemini and NACO ledgers name a receipt by its file name within the archive's programs, not by a checkout path.
      if (!receipt.includes('/')) continue;
      assert.ok(text.includes(receipt), `${target}: ${receipt} is not in the displayed answer`);
      shown.push(receipt);
    }
  }
  assert.ok(shown.filter(path => path.includes('/pds/programs/')).length >= 3, 'the PDS receipts of Charon, Hydra and Didymos are shown');
  assert.ok(shown.filter(path => path.includes('/spitzer/programs/')).length >= 1, 'the Spitzer receipt of Bennu is shown');
  for (const path of new Set(shown)) await access(resolve(ROOT, path)).catch(() => assert.fail(`the answer shows ${path}, which does not exist`));
});
