import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveLinksWith, archiveTableWith } from './archive-tables.ts';

test('an archive table is asked at the service address, read by lower-case column with absent text null, and a cut-short answer says so', async () => {
  const asked: unknown[] = [];
  const answer = (complete: boolean, rows: Record<string, unknown>[]) => archiveTableWith(async request => { asked.push(request);
    return { schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', pyvo: '1.9.1', operation: 'tap-query', tap: { queryStatus: complete ? 'OK' : 'OVERFLOW', complete }, rows }; });
  assert.deepEqual(await answer(true, [{ Size: 123, obs_id: 'a', doi: '' }])('https://archive.example/tap/sync', 'SELECT 1', 5), { rows: [{ size: 123, obs_id: 'a', doi: null }], overflow: false });
  assert.deepEqual(asked, [{ operation: 'tap-query', service: 'https://archive.example/tap', query: 'SELECT 1', maxrec: 5 }]);
  assert.equal((await answer(false, [])('https://archive.example/tap', 'SELECT 1', 5)).overflow, true);
  await assert.rejects(answer(true, [{ Size: 1, size: 2 }])('https://archive.example/tap', 'SELECT 1', 5), /Duplicate archive columns/);
});

test('a DataLink answer keeps its columns with units, its rows and what the request returned', async () => {
  const asked: unknown[] = [], field = (name: string, unit: string | null) => ({ name, id: null, datatype: 'char', arraysize: null, unit, ucd: null, utype: null, xtype: null, ref: null });
  const ask = archiveLinksWith(async request => { asked.push(request); return { schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', operation: 'vo-links',
    vo: { schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw: { path: 'answers/vo-links-1.xml', bytes: 2048 }, effectiveUrl: 'https://archive.example/links?ID=a', fetchedAt: '2026-10-06T00:00:00Z', httpStatus: 200,
      queryStatus: 'OK', fields: [field('ID', null), field('content_length', 'byte')], rows: [{ ID: 'a', content_length: 12 }], resources: [], coordinateSystems: [], timeSystems: [], issues: [], times: [], bindings: [] } }; })('answers');
  assert.deepEqual(await ask('https://archive.example/links?ID=a'), { queryStatus: 'OK', fields: [{ name: 'ID', unit: null }, { name: 'content_length', unit: 'byte' }],
    rows: [{ ID: 'a', content_length: 12 }], resolvedUrl: 'https://archive.example/links?ID=a', httpStatus: 200, responseBytes: 2048 });
  assert.deepEqual(asked, [{ operation: 'vo-links', url: 'https://archive.example/links?ID=a', directory: 'answers', byteLimit: 2 * 1024 * 1024 }]);
});
