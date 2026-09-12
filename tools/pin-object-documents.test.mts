import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinObjectDocuments } from './pin-object-documents.mts';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'pin-documents-'));
  await mkdir(join(root, 'source/preparation'), { recursive: true });
  const recipe = '{\n  "raster": {}\n}\n', plan = '{"operations":[]}\n';
  await writeFile(join(root, 'source/preparation/terrestrial.json'), recipe);
  await writeFile(join(root, 'source/preparation/acquisition.json'), plan);
  await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [], documents: [
    { path: 'preparation/terrestrial.json', expectedBytes: 1, expectedSha256: '0'.repeat(64) },
    { path: 'preparation/acquisition.json', expectedBytes: plan.length, expectedSha256: sha(plan) }] }, null, 2) + '\n');
  await writeFile(join(root, 'object.json'), JSON.stringify({ id: 'x', properties: { recipe: { sources: [
    { id: 'terrestrial', path: 'source/preparation/terrestrial.json', sha256: '0'.repeat(64) },
    { id: 'acquisition', path: 'source/preparation/acquisition.json', sha256: sha(plan) }] } } }, null, 2) + '\n');
  return { root, recipe };
}

test('stale document pins are refreshed in both the manifest and the descriptor, current ones are untouched', async () => {
  const { root, recipe } = await fixture();
  try {
    const checked = await pinObjectDocuments(root, { write: false });
    assert.deepEqual(checked.map(change => [change.file, change.path]), [['source/manifest.json', 'preparation/terrestrial.json'], ['object.json', 'source/preparation/terrestrial.json']]);
    assert.equal(JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).documents[0].expectedSha256, '0'.repeat(64), 'check mode writes nothing');
    const changes = await pinObjectDocuments(root);
    assert.equal(changes.length, 2);
    const manifest = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')), descriptor = JSON.parse(await readFile(join(root, 'object.json'), 'utf8'));
    assert.deepEqual(manifest.documents[0], { path: 'preparation/terrestrial.json', expectedBytes: recipe.length, expectedSha256: sha(recipe) });
    assert.equal(descriptor.properties.recipe.sources[0].sha256, sha(recipe));
    assert.equal(descriptor.properties.recipe.sources[1].sha256, sha('{"operations":[]}\n'));
    assert.deepEqual(await pinObjectDocuments(root), [], 'a second run finds nothing stale');
  } finally { await rm(root, { recursive: true, force: true }); }
});
