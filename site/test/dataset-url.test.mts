import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { datasetHref, readDatasetUrl, withDataset } from '../dataset-url.mts';
import { parseDatasetDestination } from '../../src/platform/dataset-destination.mts';

const url = (value: string) => new URL(value, 'https://example.test');
test('native query selections preserve view state and unrelated anchors; obsolete fragments do not select a dataset', () => {
  assert.deepEqual(readDatasetUrl(url('/saturn/?dataset=ultraviolet')), { requested: true, id: 'ultraviolet' });
  assert.deepEqual(readDatasetUrl(url('/saturn/#dataset=ultraviolet')), { requested: false, id: null });
  const native = withDataset(url('/saturn/?v=view&overview=system#sources'), 'thermal');
  assert.equal(native.searchParams.get('dataset'), 'thermal');
  assert.equal(native.searchParams.get('v'), 'view');
  assert.equal(native.hash, '#sources');
  assert.equal(withDataset(native, null).searchParams.has('dataset'), false);
  assert.equal(withDataset(url('/saturn/#sources'), 'thermal').href, 'https://example.test/saturn/?dataset=thermal#sources');
  assert.equal(datasetHref('/saturn/', 'thermal'), '/saturn/?dataset=thermal');
  assert.throws(() => parseDatasetDestination('/saturn/#dataset=thermal', 'saturn', 'thermal'));
});
test('ambiguous and malformed dataset selections are rejected before publication', () => {
  for (const href of ['/saturn/?dataset=', '/saturn/?dataset=a&dataset=b', '/saturn/?dataset=%00']) {
    assert.throws(() => readDatasetUrl(url(href)));
  }
});
