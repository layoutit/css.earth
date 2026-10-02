import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDatasetBillboards } from './dataset-billboards.js';

const input = {
  schema: 'cssearth-dataset-billboards@1', atlas: { columns: 2, rows: 2, cellPx: 256 },
  banks: [
    { id: 'nebula', contextVisibility: 'independent', attached: false,
      billboard: { cell: 3, radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] } },
    { id: 'galaxy', contextVisibility: 'galactic', attached: false },
  ],
};
test('prepared billboards carry every bank once, with an in-atlas cell and no hash', () => {
  const parsed = parseDatasetBillboards(input);
  assert.deepEqual(parsed.banks.get('galaxy'), { id: 'galaxy', contextVisibility: 'galactic', attached: false });
  assert.equal(parsed.banks.get('nebula')?.billboard?.cell, 3);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [...input.banks, input.banks[1]] }), /galaxy is listed twice/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[1], payloadSha256: 'a'.repeat(64) }] }), /unsupported dataset billboard bank field payloadSha256/);
  assert.throws(() => parseDatasetBillboards({ ...input, atlas: { ...input.atlas, sha256: 'a'.repeat(64) } }), /unsupported dataset billboard atlas field sha256/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[0], billboard: { ...input.banks[0]!.billboard, cell: 4 } }] }), /outside its atlas/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[1], attached: undefined }] }), /attached/);
});

