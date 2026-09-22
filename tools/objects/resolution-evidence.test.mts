import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseResolutionEvidence, parseAcceptedAssumptions, supportsMeasuredResolution, PROFILE_ASSUMPTIONS } from './resolution-evidence.mts';
import { requestFromArguments } from './telescopes/query.mts';
test('evidence and explicit acceptance are validated without inferring meaning from prose', () => {
  assert.equal(supportsMeasuredResolution({ kind: 'measured' }), false);
  assert.throws(() => parseResolutionEvidence({ kind: 'looks sharp' }), /Unknown/);
  assert.throws(() => parseResolutionEvidence({ kind: 'measured', receipt: { file: 'x', sha256: 'bad' } }), /SHA/);
  assert.throws(() => parseAcceptedAssumptions(['all']), /Unknown/);
  const request = requestFromArguments(['--target', 'eris', '--wavelength', '2.2,2.4', '--any-time', '--min-arcsec', '1', '--kind', 'cube', '--result', 'telescope-product', '--accept-assumptions', PROFILE_ASSUMPTIONS.join(',')]);
  assert.deepEqual(request.acceptedAssumptions, PROFILE_ASSUMPTIONS);
});
