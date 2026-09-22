import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { UPGRADE_FACTOR, bodyArchiveNames, citedDois, imageryVerdict, opusImagesUrl, opusTargets, parseOpusFrames, shippedImagery } from './imagery-candidates.mts';

test('OPUS covered bodies are the names of its centre-resolution fields', () => {
  const fields = { data: { 'Surface Geometry Constraints': {
    SURFACEGEOnix_centerresolution1: { label: 'Body Center Resolution (Min) [Nix]' }, SURFACEGEOnix_centerresolution2: { label: 'Max' },
    SURFACEGEOs2004s12_centerresolution1: { label: 'Body Center Resolution (Min) [S/2004 S 12]' }, SURFACEGEOnix_phase1: { label: 'Phase' } } } };
  assert.deepEqual([...opusTargets(fields)].sort(), ['nix', 's2004s12']);
});

test('the images query asks for images ordered by the body-centre resolution', () => {
  const url = new URL(opusImagesUrl('nix', 3));
  assert.equal(url.searchParams.get('observationtype'), 'Image');
  assert.equal(url.searchParams.get('order'), 'SURFACEGEOnix_centerresolution1,opusid');
  assert.equal(url.searchParams.get('cols'), 'opusid,instrument,time1,SURFACEGEOnix_centerresolution1,SURFACEGEOnix_centerphaseangle1');
});

// Measured OPUS response for Nix, 2026-09-16, abridged to two rows and one row without geometry.
const NIX_PAGE = { available: 2567, page: [
  ['nh-lorri-lor_0299174134', 'New Horizons LORRI', '2015-07-14T10:03:35.806', '0.30023', '9.544'],
  ['nh-lorri-lor_0299174108', 'New Horizons LORRI', '2015-07-14T10:03:09.806', '0.30188', ''],
  ['nh-lorri-lor_0299999999', 'New Horizons LORRI', '2015-07-14T12:00:00.000', null, null] ] };

test('OPUS rows parse in column order, and a row without a centre resolution is left out', () => {
  const { available, frames } = parseOpusFrames(NIX_PAGE);
  assert.equal(available, 2567);
  assert.deepEqual(frames, [
    { opusId: 'nh-lorri-lor_0299174134', instrument: 'New Horizons LORRI', time: '2015-07-14T10:03:35.806', centerKmPerPixel: 0.30023, phaseDegrees: 9.544 },
    { opusId: 'nh-lorri-lor_0299174108', instrument: 'New Horizons LORRI', time: '2015-07-14T10:03:09.806', centerKmPerPixel: 0.30188, phaseDegrees: null }]);
});

test('imagery is each photograph lens\'s finest frame and each map lens\'s native scale; false colour, science and shape are not', () => {
  const surfaces = { surfaces: [
    { id: 'shape', appearance: 'neutral', source: { id: 'shape', width: 100 }, projection: 'x' },
    { id: 'normal', observation: { frames: [{ id: 'a', footprint: { nadirMedianMeters: 900 } }, { id: 'b', footprint: { nadirMedianMeters: 450 } }] } },
    { id: 'mosaic', falseColor: false, projection: 'equirectangular', source: { id: 'usgs', width: 11520 }, sourceGeoreference: { resolution: [416.75, -416.75, 0] } },
    { id: 'global', falseColor: false, projection: 'equirectangular', source: { id: 'iss', width: 5760 } },
    { id: 'infrared', falseColor: true, projection: 'equirectangular', source: { id: 'vims', width: 720 } },
    { id: 'elevation', falseColor: false, scientific: {}, projection: 'equirectangular', source: { id: 'dtm', width: 2048 } },
    { id: 'unscaled', falseColor: false, projection: 'equirectangular', source: { id: 'usgs-frames' } }] };
  // A 198 km body: a 5760-pixel global map is 2 pi 198000 / 5760 = 216 m at the equator.
  assert.deepEqual(shippedImagery(surfaces, 198).map(item => [item.lens, item.kind, item.meters === null ? null : Math.round(item.meters)]),
    [['global', 'map', 216], ['mosaic', 'map', 417], ['normal', 'photograph', 450], ['unscaled', 'map', null]]);
});

test('the verdict: too few pixels first, then no lens, then the upgrade factor', () => {
  // Hydra's best MVIC colour scan: about 50 km across at 4.6 km/px is 11 px.
  assert.equal(imageryVerdict({ shippedMeters: 1137, opusKmPerPixel: 4.6, diameterKm: 50, minimumPixels: 50 }).verdict, 'too-small');
  assert.equal(imageryVerdict({ shippedMeters: null, opusKmPerPixel: 0.3, diameterKm: 50, minimumPixels: 50 }).verdict, 'candidate');
  assert.equal(imageryVerdict({ shippedMeters: 300, opusKmPerPixel: 0.30023, diameterKm: 50, minimumPixels: 50 }).verdict, 'no-upgrade', 'Nix already ships its finest LORRI frame');
  const finer = imageryVerdict({ shippedMeters: 1000, opusKmPerPixel: 1 / UPGRADE_FACTOR, diameterKm: 100, minimumPixels: 50 });
  assert.equal(finer.verdict, 'finer-frames');
  assert.equal(finer.factor, UPGRADE_FACTOR);
  assert.equal(imageryVerdict({ shippedMeters: null, opusKmPerPixel: null, diameterKm: 50, minimumPixels: 50 }).verdict, 'no-images');
  assert.equal(imageryVerdict({ shippedMeters: null, opusKmPerPixel: 0.01, diameterKm: 3000, minimumPixels: 50, reported: false }).verdict, 'shipped-unknown', 'a body without a surfaces report is not a candidate by absence');
});

test('a body is searched under its catalogue name and, when numbered, its long number and designations', () => {
  assert.deepEqual(bodyArchiveNames('Haumea', '136108 Haumea (2003 EL61)'), ['Haumea', '136108', '2003 EL61', '2003EL61']);
  assert.deepEqual(bodyArchiveNames('Psyche', '16 Psyche (A852 FA)'), ['Psyche', 'A852 FA', 'A852FA'], 'a short number matches too much');
  assert.deepEqual(bodyArchiveNames('Hiʻiaka'), ['Hiiaka']);
  assert.deepEqual(bodyArchiveNames('Io'), [], 'a two-letter name is not searched');
});

test('cited DOIs come from the manifest-bound catalogue records and doi.org links in the ledger', () => {
  const manifest = { inputs: [{ sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'paper' }, { catalogueId: 'software' }] } }], documents: [{ sourceBinding: { kind: 'local' } }] };
  const records = new Map<string, unknown>([['paper', { identifiers: [{ type: 'DOI', value: '10.1029/2021JE007091' }, { type: 'arXiv', value: '2402.03422' }] }], ['software', { identifiers: [] }]]);
  const ledger = { entries: [{ evidence: ['https://doi.org/10.3847/PSJ/ac01ec', 'https://arxiv.org/abs/2105.11372'] }] };
  assert.deepEqual(citedDois(manifest, records, ledger), ['10.1029/2021je007091', '10.3847/psj/ac01ec']);
});
