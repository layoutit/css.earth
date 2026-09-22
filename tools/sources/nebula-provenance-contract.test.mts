import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import test from 'node:test';
import { sourceArray, sourceObject, sourceText, parseSourceBinding } from '../../src/platform/source-catalog.mts';
import { evidenceLink, parseInvestigationLedger } from '../investigations/investigation-ledger.mts';
import { readInvestigationSurveys } from '../investigations/investigation-survey.mts';
import { applicationDeliveryKind } from '../nebula/application/delivery-identity.ts';

const root = resolve(import.meta.dirname, '../..');
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function presentedBanks() {
  const entries: { id: string; base: string }[] = [];
  for (const folder of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const base = `src/objects/${folder.name}`;
    const names = await readdir(resolve(root, base));
    if (!names.includes('object.json')) continue;
    const descriptor = sourceObject(await read(`${base}/object.json`));
    if (descriptor.type === 'volume-lens-bank' && names.includes('source')) {
      const sourceFiles = await readdir(resolve(root, base, 'source'));
      const filename = sourceFiles.includes('compact-delivery.json') ? 'compact-delivery.json'
        : sourceFiles.includes('delivery.json') ? 'delivery.json' : null;
      if (filename && applicationDeliveryKind(filename, await read(`${base}/source/${filename}`))) entries.push({ id: sourceText(descriptor.id), base });
    }
    else if (descriptor.type === 'image-layer-bank' && names.includes('source')) {
      const sourceFiles = await readdir(resolve(root, base, 'source'));
      if (sourceFiles.includes('presentation.json')) entries.push({ id: sourceText(descriptor.id), base });
    }
  }
  assert.ok(entries.length > 0, 'Exercise the delivered objects, not an empty fixture.');
  return entries;
}

test('every presented bank lens has an included, revision-pinned investigation', async () => {
  for (const { id, base } of await presentedBanks()) {
    const ledger = parseInvestigationLedger(await read(`${base}/investigations.json`), id, await readInvestigationSurveys(resolve(import.meta.dirname, '../..'), evidenceLink));
    const presentation = sourceObject(await read(`${base}/source/presentation.json`));
    for (const lens of sourceArray(presentation.lenses, sourceObject)) {
      const lensId = sourceText(lens.id);
      const entry = ledger.entries.find(entry => entry.id === `lens-${lensId}`);
      assert.equal(entry?.status, 'included', `${id}/${lensId}: shipped lens must have a decision and evidence.`);
    }
  }
});

test('presented bank manifests account for each retained source file and verify pinned bytes', async () => {
  for (const { id, base } of await presentedBanks()) {
    const manifest = sourceObject(await read(`${base}/source/manifest.json`));
    const entries = ['inputs', 'documents', 'generatedIntermediates'].flatMap(section =>
      sourceArray(manifest[section], sourceObject));
    const listed = new Map(entries.map(entry => [sourceText(entry.path), entry]));
    async function inspect(directory: string): Promise<void> {
      for (const file of await readdir(resolve(root, directory), { withFileTypes: true })) {
        const path = `${directory}/${file.name}`;
        if (file.isDirectory()) { await inspect(path); continue; }
        if (path === `${base}/source/manifest.json`) continue;
        const entry = listed.get(path);
        assert.ok(entry, `${id}: unlisted source ${relative(root, resolve(root, path))}`);
        const bytes = await readFile(resolve(root, path));
        assert.ok(bytes.length > 0, `${path}: empty source`);
        assert.notEqual(parseSourceBinding(entry.sourceBinding).kind, 'unresolved', `${path}: source identity`);
      }
    }
    await inspect(`${base}/source`);
  }
});

test('the retained LMC SMASH photograph credits its publisher rather than the project', async () => {
  const manifest = sourceObject(await read('src/objects/lmc/source/manifest.json'));
  const image = sourceArray(manifest.documents, sourceObject).find(entry => entry.path === 'src/objects/lmc/source/source.jpg');
  assert.ok(image);
  const binding = parseSourceBinding(image.sourceBinding);
  assert.equal(binding.kind, 'catalogued');
  if (binding.kind !== 'catalogued') throw new Error('The photograph must retain its published identity.');
  assert.ok(binding.references.some(reference => reference.catalogueId === 'noirlab-noirlab2030a'));
  const original = sourceObject(await read('src/objects/lmc/source/provenance.json'));
  assert.equal(image.credit, original.credit);
  assert.equal(image.origin, original.sourcePage);
});
