import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTHORED_PREPARATION_SCHEMA, readAuthoredPreparationSources, readPublishedPreparationSources } from './authored-preparation.ts';

test('authored receipts retain untagged historical source-list admission', () => {
  assert.equal(AUTHORED_PREPARATION_SCHEMA, 'cssearth-authored-preparation@1');
  for (const value of [null, [], {}, { sources: null }]) assert.equal(readAuthoredPreparationSources(value, 'receipt'), undefined);
  const sources = [{ id: '', path: '', extra: true }];
  for (const schema of [undefined, AUTHORED_PREPARATION_SCHEMA, 'historical'])
    assert.deepEqual(readAuthoredPreparationSources({ schema, sources }, 'receipt'), [{ id: '', path: '' }]);
  assert.throws(() => readAuthoredPreparationSources({ sources: [null] }, 'receipt'), { message: 'receipt sources[0] must be an object.' });
  assert.throws(() => readAuthoredPreparationSources({ sources: [{ id: 'a', path: 1 }] }, 'receipt'),
    { message: 'receipt: sources[0] needs a string id and path; got {"id":"a","path":1}.' });
});

test('published replay keeps whole records and its original id-only validation', () => {
  const source = { id: 'a', extra: true };
  assert.deepEqual([...readPublishedPreparationSources({ sources: [source] })], [['a', JSON.stringify(source)]]);
  assert.throws(() => readPublishedPreparationSources({ sources: [{ path: 'a' }] }), /source id/);
  assert.throws(() => readPublishedPreparationSources({ sources: [null] }), /published source/);
  assert.throws(() => readPublishedPreparationSources({}), /published sources/);
});
