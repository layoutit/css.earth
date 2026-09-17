import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gridTransferDecision, parseSkyBandRegistration, skyBandCandidate } from './sky-band-registration.ts';

const wcs = { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [4000, 4000], referencePixel: [2000, 2000], referenceValueDeg: [13.19, -72.83],
  scaleDeg: [-0.0025063655876377947, 0.0025063655876377947], rotationDeg: 0 };
const pin = { path: 'labs/nebula/models/x/recipe.json', sha256: 'a'.repeat(64) };
const candidate = (id: string, extra: Record<string, unknown> = {}) => skyBandCandidate({ id, path: `.local/x/${id}.png`, sha256: 'b'.repeat(64), wcs, skyBands: pin, ...extra });
const stars = { query: pin, path: '.local/x/stars.csv', sha256: 'c'.repeat(64) };

test('a grid transfer needs a passing catalogue gate on the reference and an identical grid and WCS', () => {
  const grid = JSON.stringify({ width: 4000, height: 4000, fovDeg: 10, centerIcrsDegrees: [13.19, -72.83] });
  const reference = { candidate: candidate('ref'), gridJson: grid, gatePass: true }, target = { candidate: candidate('dust'), gridJson: grid };
  assert.equal(gridTransferDecision(reference, target).pass, true);
  assert.equal(gridTransferDecision({ ...reference, gatePass: false }, target).pass, false, 'a failed reference gate never qualifies the target');
  assert.equal(gridTransferDecision(reference, { ...target, gridJson: grid.replace('13.19', '13.5') }).pass, false);
  assert.equal(gridTransferDecision(reference, { candidate: candidate('dust', { wcs: { ...wcs, referencePixel: [2001, 2000] } }), gridJson: grid }).pass, false);
});

test('recipes and candidates are validated at runtime', () => {
  const recipe = { schema: 'cssearth-sky-band-registration@1', catalogue: 'labs/nebula/models/x/image-candidates.json', stars,
    catalogueChecks: [{ imageId: 'ref', blueChannel: 'W1', receipt: 'labs/nebula/models/x/ref.json' }],
    gridTransfers: [{ imageId: 'dust', referenceId: 'ref', blueChannel: 'SPIRE', receipt: 'labs/nebula/models/x/dust.json', diagnostic: 'labs/nebula/models/x/dust-diag.json' }],
    fixedWcsChecks: [{ imageId: 'publisher', blueChannel: 'W1', receipt: 'labs/nebula/models/x/publisher.json' }],
    negativeControls: [{ label: 'shifted-40px', imageId: 'publisher', blueChannel: 'W1', wcs: { ...wcs, referencePixel: [2040, 2000] }, receipt: 'labs/nebula/models/x/publisher-negative.json' }] };
  assert.equal(parseSkyBandRegistration(recipe).gridTransfers[0]!.referenceId, 'ref');
  assert.throws(() => parseSkyBandRegistration({ ...recipe, gridTransfers: [{ ...recipe.gridTransfers[0]!, referenceId: 'other' }] }), /catalogue-checked/);
  assert.throws(() => parseSkyBandRegistration({ ...recipe, gridTransfers: [{ ...recipe.gridTransfers[0]!, imageId: 'ref' }] }), /exactly once/);
  assert.throws(() => parseSkyBandRegistration({ ...recipe, catalogueChecks: [{ ...recipe.catalogueChecks[0]!, receipt: '/tmp/ref.json' }] }), /repository-relative/);
  assert.throws(() => candidate('x', { url: 'https://example.org/x.png' }), /composed candidates/);
  assert.throws(() => parseSkyBandRegistration({ ...recipe, negativeControls: [{ ...recipe.negativeControls[0]!, receipt: recipe.fixedWcsChecks[0]!.receipt }] }), /exactly once/);
  assert.throws(() => parseSkyBandRegistration({ ...recipe, fixedWcsChecks: undefined }), /Unsupported/);
});
