import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('compact replay consumes already admitted material and projection', () => {
  assert.doesNotMatch(source('./finite-emission.ts'), /parseCloudAppearance|validateChannelGain|validateDatasetToneCurve|readCompactToneProjection|readCompactFiniteDataset/u);
});
