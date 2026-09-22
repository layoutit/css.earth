import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { rememberQualification, loadQualifiedObservations } from './qualified-observations.mts';
import { writeProductRecord, productRecordPath } from '../product-record.mts';
import { PROFILE_ASSUMPTIONS } from '../resolution-evidence.mts';
import { assessRequest } from './request-satisfaction.mts';
test('qualification readback binds facts to the exact output, receipt and producing record', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'qualified-observation-'));
  try {
    const product = resolve(root, 'cube.fits'), receipt = resolve(root, 'comparison.json'), resolution = resolve(root, 'resolution.json');
    await writeFile(product, 'qualified fixture'); await writeFile(receipt, '{}'); await writeFile(resolution, '{}');
    await writeProductRecord(productRecordPath(product), { telescope: 'JWST', stage: 'spec3-cube', inputs: [], software: [], parameters: {} }, [{ path: 'cube.fits', file: product }]);
    await rememberQualification(root, { ...{ schema: 'cssearth-telescope-qualification@2' }, target: 'test', telescope: 'JWST', mode: 'NIRSPEC/IFU', observation: 'obs', program: 'test-obs', product, receipt, productRecord: productRecordPath(product), outputRoot: root,
      facts: { target: 'test', verified: true, kind: 'cube', result: 'telescope-product', wavelengthIntervalsMicrometres: [[2.2, 2.4]],
        resolutionEvidence: [{ kind: 'measured', receipt: { file: resolution } }],
        angularResolutionBound: { arcsec: .4, method: 'jwst-point-source-profile@1', receipt: resolution } } });
    const loaded = await loadQualifiedObservations(root, 'test');
    assert.equal(loaded.length, 1); assert.equal(loaded[0]!.product, 'cube.fits');
    assert.deepEqual(loaded[0]!.facts.wavelengthIntervalsMicrometres, [[2.2, 2.4]]);
    assert.equal(loaded[0]!.facts.angularResolutionBound!.receipt, 'resolution.json');
    assert.deepEqual(loaded[0]!.facts.resolutionEvidence, [{ kind: 'measured', receipt: { file: 'resolution.json' } }]);
    const request = { target: 'test', wavelengthMicrometres: [2.2, 2.4] as const, time: { any: true as const }, kind: 'cube' as const, result: 'telescope-product' as const };
    assert.equal(assessRequest({ ...request, angularResolutionArcsec: 1 }, loaded[0]!.facts).status, 'unresolved');
    assert.equal(assessRequest({ ...request, angularResolutionArcsec: 1, acceptedAssumptions: [PROFILE_ASSUMPTIONS[0]!] }, loaded[0]!.facts).status, 'unresolved');
    const accepted = assessRequest({ ...request, angularResolutionArcsec: 1, acceptedAssumptions: PROFILE_ASSUMPTIONS }, loaded[0]!.facts);
    assert.equal(accepted.status, 'fulfilled'); assert.ok(accepted.constraints.angularResolution!.assumptions!.every(item => item.accepted));
    assert.equal(assessRequest({ ...request, angularResolutionArcsec: .2, acceptedAssumptions: PROFILE_ASSUMPTIONS }, loaded[0]!.facts).constraints.angularResolution!.answer, 'unknown');
    await writeFile(resolution, '{"changed":true}');
    assert.deepEqual(await loadQualifiedObservations(root, 'test'), []);
    await writeFile(resolution, '{}');
    await writeFile(receipt, '{"changed":true}');
    assert.deepEqual(await loadQualifiedObservations(root, 'test'), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
