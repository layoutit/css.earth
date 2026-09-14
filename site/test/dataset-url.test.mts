import assert from 'node:assert/strict';
import test from 'node:test';
import { datasetHref, readDatasetUrl, withDataset } from '../dataset-url.mts';
import { parseDatasetDestination } from '../../src/platform/dataset-destination.mts';

const url = (value: string) => new URL(value, 'https://example.test');
test('native query selections preserve view state and unrelated anchors; legacy fragments still work', () => {
  assert.deepEqual(readDatasetUrl(url('/saturn/?dataset=ultraviolet')), { requested: true, id: 'ultraviolet' });
  assert.deepEqual(readDatasetUrl(url('/saturn/#dataset=ultraviolet')), { requested: true, id: 'ultraviolet' });
  const native = withDataset(url('/saturn/?v=view&overview=solar-system#sources'), 'thermal');
  assert.equal(native.searchParams.get('dataset'), 'thermal');
  assert.equal(native.searchParams.get('v'), 'view');
  assert.equal(native.hash, '#sources');
  assert.equal(withDataset(native, null).searchParams.has('dataset'), false);
  assert.equal(withDataset(url('/saturn/#sources&dataset=ultraviolet'), 'thermal').hash, '#sources&dataset=thermal');
  assert.equal(datasetHref('/saturn/', 'thermal'), '/saturn/?dataset=thermal');
  assert.equal(parseDatasetDestination('/saturn/#dataset=thermal', 'saturn', 'thermal'), '/saturn/#dataset=thermal');
});
test('ambiguous and malformed dataset selections are rejected before publication', () => {
  for (const href of ['/saturn/?dataset=', '/saturn/?dataset=a&dataset=b', '/saturn/?dataset=a#dataset=b', '/saturn/#dataset=a&dataset=b', '/saturn/#dataset=%', '/saturn/?dataset=%00']) {
    assert.throws(() => readDatasetUrl(url(href)));
  }
});
