import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCloudCatalogue } from './cloud-parts.js';

const catalogue = { schema: 'cssearth-cloud-parts@1', id: 'example', referenceLeafIds: ['r'], parts: [
  { id: 'a', label: 'Structure 1', kind: 'extended', signalFraction: .4, defaultEnabled: true, leafIds: ['a1', 'a2'] },
  { id: 'b', label: 'Structure 2', kind: 'extended', signalFraction: .3, defaultEnabled: true, leafIds: ['b1'] },
  { id: 'd', label: 'Diffuse', kind: 'diffuse', signalFraction: .3, defaultEnabled: false, leafIds: ['d1'] },
] };
const leafIds = ['r', 'a1', 'a2', 'b1', 'd1'];
test('catalogue rejects ambiguous, missing, duplicated or unrelated contributions', () => {
  assert.throws(() => parseCloudCatalogue(catalogue, 'other', leafIds));
  assert.throws(() => parseCloudCatalogue(catalogue, 'example', [...leafIds, 'unowned']));
  for (const edit of [
    (c: typeof catalogue) => { c.parts[0]!.leafIds.push('r'); },
    (c: typeof catalogue) => { c.parts[0]!.signalFraction = .8; },
    (c: typeof catalogue) => { c.parts[0]!.id = 'reference'; },
  ]) { const copy = structuredClone(catalogue); edit(copy); assert.throws(() => parseCloudCatalogue(copy, 'example', leafIds)); }
});
