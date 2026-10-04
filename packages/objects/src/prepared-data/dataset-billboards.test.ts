import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDatasetBillboards } from './dataset-billboards.js';

const input = {
  schema: 'cssearth-dataset-billboards@2', imagePx: 256,
  banks: [
    { id: 'nebula', contextVisibility: 'independent', attached: false,
      billboard: { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] } },
    { id: 'galaxy', contextVisibility: 'galactic', attached: false },
  ],
};
test('prepared billboards carry every bank once, with its own image and no hash', () => {
  const parsed = parseDatasetBillboards(input);
  assert.deepEqual(parsed.banks.get('galaxy'), { id: 'galaxy', contextVisibility: 'galactic', attached: false });
  assert.equal(parsed.imagePx, 256);
  assert.equal(parsed.banks.get('nebula')?.billboard?.radiusUnits, 1);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [...input.banks, input.banks[1]] }), /galaxy is listed twice/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[1], payloadSha256: 'a'.repeat(64) }] }), /unsupported dataset billboard bank field payloadSha256/);
  // A cell of a shared atlas made every billboard's layer copy the whole atlas to draw from it (2026-10-03).
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[0], billboard: { ...input.banks[0]!.billboard, cell: 3 } }] }), /unsupported dataset billboard field cell/);
  assert.throws(() => parseDatasetBillboards({ ...input, imagePx: 0 }), /image size/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[1], attached: undefined }] }), /attached/);
});
