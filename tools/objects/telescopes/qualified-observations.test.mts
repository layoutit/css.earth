import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { rememberQualification, loadQualifiedObservations } from './qualified-observations.mts';
import { writeProductRecord, productRecordPath } from '../product-record.mts';
test('qualification readback binds facts to the exact output, receipt and producing record', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'qualified-observation-'));
  try {
    const product = resolve(root, 'cube.fits'), receipt = resolve(root, 'comparison.json');
    await writeFile(product, 'qualified fixture'); await writeFile(receipt, '{}');
    await writeProductRecord(productRecordPath(product), { telescope: 'JWST', stage: 'spec3-cube', inputs: [], software: [], parameters: {} }, [{ path: 'cube.fits', file: product }]);
    await rememberQualification(root, { ...{ schema: 'cssearth-telescope-qualification@2' }, target: 'test', telescope: 'JWST', mode: 'NIRSPEC/IFU', observation: 'obs', program: 'test-obs', product, receipt, productRecord: productRecordPath(product), outputRoot: root,
      facts: { target: 'test', verified: true, kind: 'cube', result: 'telescope-product', wavelengthIntervalsMicrometres: [[2.2, 2.4]] } });
    const loaded = await loadQualifiedObservations(root, 'test');
    assert.equal(loaded.length, 1); assert.equal(loaded[0]!.product, 'cube.fits');
    assert.deepEqual(loaded[0]!.facts.wavelengthIntervalsMicrometres, [[2.2, 2.4]]);
    await writeFile(receipt, '{"changed":true}');
    assert.deepEqual(await loadQualifiedObservations(root, 'test'), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
