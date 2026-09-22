import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinObjectDocuments } from './pin-object-documents.mts';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

test('authored files are never pinned; a download is adopted only once, on request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pin-downloads-'));
  try {
    await mkdir(join(root, 'source/observations'), { recursive: true }); await mkdir(join(root, 'source/preparation'), { recursive: true });
    const plan = '{"operations":[{"kind":"download","path":"observations/new.fits"},{"kind":"download","path":"observations/old.fits"}]}\n';
    await writeFile(join(root, 'source/preparation/acquisition.json'), plan);
    for (const name of ['marker.png', 'sphere.tab', 'new.fits', 'old.fits']) await writeFile(join(root, 'source/observations', name), `${name} bytes\n`);
    const placeholder = { expectedBytes: 1, expectedSha256: '0'.repeat(64) };
    const manifest = {
      inputs: [
        { path: 'observations/sphere.tab', recipe: { generator: 'tools/author.mts' }, sourceBinding: { kind: 'catalogued' } },
        { path: 'observations/new.fits', ...placeholder, sourceBinding: { kind: 'catalogued' } },
        { path: 'observations/old.fits', expectedBytes: 3, expectedSha256: 'a'.repeat(64), sourceBinding: { kind: 'catalogued' } }],
      generatedIntermediates: [{ path: 'observations/marker.png' }],
      documents: [{ path: 'preparation/acquisition.json' }] };
    const text = JSON.stringify(manifest, null, 2) + '\n';
    await writeFile(join(root, 'source/manifest.json'), text);
    assert.deepEqual(await pinObjectDocuments(root), [], 'nothing authored is pinned');
    assert.deepEqual((await pinObjectDocuments(root, { adoptDownloads: true, write: false })).map(change => change.path), ['observations/new.fits']);
    assert.equal(await readFile(join(root, 'source/manifest.json'), 'utf8'), text, 'check mode writes nothing');
    assert.deepEqual((await pinObjectDocuments(root, { adoptDownloads: true })).map(change => change.path), ['observations/new.fits'], 'only the placeholder download is adopted');
    const written = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8'));
    assert.equal(written.inputs[1].expectedSha256, sha('new.fits bytes\n'));
    assert.equal(written.inputs[2].expectedSha256, 'a'.repeat(64), 'a real upstream pin is never overwritten');
    assert.equal(written.inputs[0].expectedSha256, undefined); assert.equal(written.generatedIntermediates[0].expectedSha256, undefined);
    assert.deepEqual(await pinObjectDocuments(root, { adoptDownloads: true }), [], 'an adopted pin is final');
  } finally { await rm(root, { recursive: true, force: true }); }
});
