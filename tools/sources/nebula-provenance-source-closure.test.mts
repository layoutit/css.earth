import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseSourceCatalog, sourceObject, sourceArray, sourceText } from '../../src/platform/source-catalog.mts';

const root = resolve(import.meta.dirname, '../..');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: string) => sourceObject(JSON.parse(await readFile(resolve(root, path), 'utf8')));

test('application provenance inputs and recipes read source-owned files without laboratory data', async () => {
  let references = 0;
  async function checked(path: string) {
    assert.ok(!path.startsWith('labs/'), `Application provenance attempted a lab read: ${path}`);
    const bytes = await readFile(resolve(root, path));
    assert.ok(bytes.length > 0, path);
    references++;
  }
  for (const id of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)) {
    const base = `src/objects/${id}/source`;
    const presentation = await json(`${base}/presentation.json`).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    });
    if (!presentation || presentation.schema !== 'cssearth-volume-presentation-source@1') continue;
    const manifest = await json(`${base}/manifest.json`);
    for (const row of sourceArray(manifest.inputs, sourceObject)) {
      const path = sourceText(row.path); if (path.startsWith('.local/')) continue;
      await checked(path);
    }
    for (const row of sourceArray(presentation.recipes, sourceObject)) await checked(sourceText(row.path));
  }
  assert.ok(references > 0);
  await assert.rejects(checked('labs/nebula/models/fixture.json'), /attempted a lab read/);
});

test('retained provenance copies preserve pins, revision identities and manifest coverage', async () => {
  let references = 0;
  for (const id of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)) {
    const base = `src/objects/${id}/source`;
    const ledger = await json(`${base}/provenance-references.json`).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    });
    if (!ledger) continue;
    assert.equal(ledger.schema, 'cssearth-provenance-references@1');
    const manifest = await json(`${base}/manifest.json`);
    const rows = ['inputs', 'documents', 'generatedIntermediates'].flatMap(key => sourceArray(manifest[key], sourceObject));
    for (const reference of sourceArray(ledger.references, sourceObject)) {
      const path = sourceText(reference.path), original = sourceText(reference.originalPath), revision = sourceText(reference.revision);
      assert.ok(path.startsWith(`${base}/`)); assert.match(revision, /^[a-f0-9]{40}$/);
      const bytes = await readFile(resolve(root, path));
      assert.ok(bytes.length > 0, path);
      assert.ok(original.startsWith('labs/nebula/models/'));
      const owner = rows.find(row => row.path === path); assert.ok(owner, `Unmanifested evidence: ${path}`);
      references++;
    }
  }
  assert.ok(references > 0);
});

test('source records cited from the lab keep portable statement links without current lab reads', async () => {
  const records = await Promise.all((await readdir(resolve(root, 'src/sources'))).filter(path => path.endsWith('.json')).map(path => json(`src/sources/${path}`)));
  const catalog = parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records });
  let histories = 0;
  for (const record of Object.values(catalog.records)) for (const evidence of record.evidence) {
    if (!('path' in evidence) || !evidence.path.startsWith('labs/')) continue;
    for (const statement of record.statements) {
      assert.ok(!statement.evidence.startsWith(evidence.path), 'Historical statement still implies a current local path');
    }
    histories++;
  }
  assert.ok(histories > 0);
});
