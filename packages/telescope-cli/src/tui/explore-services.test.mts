import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileSize, writeProductRecord } from '@cssearth/telescope-core/node';
import { explorationDownloadSize, explorationFreeBytes, explorationPickStatuses } from './explore-services.mts';
import { exploreChoice, exploreSession } from './fixtures/explore.mts';

test('ALMA size reads only whole-delivery #this tar entries and unknown remains unknown', async () => {
  const choice = { ...exploreChoice, display: { ...exploreChoice.display, advertisedKilobytes: null } };
  const xml = `<VOTABLE><RESOURCE><TABLE>${['access_url', 'semantics', 'content_length'].map(name => `<FIELD name="${name}"/>`).join('')}<DATA><TABLEDATA>
    <TR><TD>https://almascience.org/a.tar</TD><TD>#this</TD><TD>1024</TD></TR>
    <TR><TD>https://almascience.org/b.tar</TD><TD>#this</TD><TD>2048</TD></TR>
    <TR><TD>https://almascience.org/a.jpg</TD><TD>#preview</TD><TD>9999</TD></TR>
    </TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++; assert.equal(String(input), 'https://almascience.org/datalink/sync?ID=uid%3A%2F%2FA%2FB%2FC');
    assert.ok(init?.signal); return new Response(xml);
  };
  assert.equal(await explorationDownloadSize(choice, new AbortController().signal, fetcher), 3072);
  assert.equal(await explorationDownloadSize(exploreChoice, new AbortController().signal, fetcher), 1024000); assert.equal(calls, 1);
  assert.equal(await explorationDownloadSize(choice, new AbortController().signal, async () => { throw new Error('archive down'); }), null);
  assert.equal(await explorationDownloadSize(choice, new AbortController().signal, async () => new Response(xml.replace('<TD>1024</TD>', '<TD></TD>'))), null);
});

test('free space uses the target volume before a child folder exists', async () => {
  const { bavail, bsize } = await statfs(tmpdir()), expected = bavail * bsize;
  const actual = await explorationFreeBytes(resolve(tmpdir(), 'telescope-missing/child'));
  assert.ok(Math.abs(actual - expected) < 100 * 1024 ** 2);
});

test('markers require a verified delivery or real retained bytes, and never count extraction aliases twice', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'explore-status-'));
  try {
    const work = resolve(root, '.work/pick-1/acquisition.partial'), pick = resolve(root, 'pick-2');
    await mkdir(work, { recursive: true }); await mkdir(pick);
    await writeFile(resolve(work, 'request.json'), '{}');
    const session = { ...exploreSession(), directory: root };
    assert.equal((await explorationPickStatuses(session)).size, 0);
    await writeFile(resolve(work, 'detector.raw.download.partial'), '123');
    assert.deepEqual((await explorationPickStatuses(session)).get(1), { state: 'partial', bytes: 3 });
    await rm(resolve(work, 'detector.raw.download.partial'));
    await writeFile(resolve(work, 'archive.tar.download.partial'), '12345');
    await writeFile(resolve(work, 'science.fits'), '12345');
    assert.deepEqual((await explorationPickStatuses(session)).get(1), { state: 'partial', bytes: 5 });
    const science = resolve(pick, 'science.fits'), record = resolve(pick, 'product.json');
    await writeFile(science, 'science');
    await writeProductRecord(record, { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: 'science.fits', file: science }]);
    const resultPath = resolve(pick, 'result.json');
    await writeFile(resultPath, JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: 'science.fits', record: 'product.json', receipt: 'product.json',
      facts: { target: 'star', verified: true }, context: { kind: 'exploration', target: 'star', discovery: { schema: 'cssearth-telescope-exploration@1', reference: { kind: 'indexed-observation', observation: 'one' } }, assessment: { status: 'not-requested' } },
      files: await Promise.all(['science.fits', 'product.json'].map(async path => ({ path, ...await fileSize(resolve(pick, path)) }))) }));
    assert.deepEqual((await explorationPickStatuses(session)).get(2), { state: 'done', bytes: 7, resultPath });
    await writeFile(science, 'changed bytes');
    await assert.rejects(explorationPickStatuses(session), /records 7/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
