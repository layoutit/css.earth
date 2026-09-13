import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { catalogueTextViolations, parseObjectText } from '../site/object-text.mts';
import type { ObjectText } from '../site/object-text.mts';
import { sourceResolver } from '../src/platform/source-catalog.mts';
import type { SourceResolver } from '../src/platform/source-catalog.mts';
import { describeTextViolations, reviewObjectText } from './object-text-sources.mts';
import { readSourceCatalog } from './read-source-catalogue.mts';
import { hasErrorCode, requireArray, requireRecord, requireString } from './source-values.mts';
import { writePreparedText } from './write-prepared-text.mts';

const root = resolve(import.meta.dirname, '..');
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Reader text is checked against its content recipe, so a publication re-pins both authored documents. */
const TEXT_INPUTS: ReadonlySet<string> = new Set(['content', 'text']);
const MANIFEST_SECTIONS = ['inputs', 'documents', 'generatedIntermediates'] as const;

async function readRecord(objectDirectory: string, path: string) {
  return requireRecord(JSON.parse(await readFile(resolve(objectDirectory, path), 'utf8')));
}

function recipeSources(descriptor: Record<string, unknown>) {
  return requireArray(requireRecord(requireRecord(descriptor.properties).recipe).sources).map(value => requireRecord(value));
}

function manifestEntries(manifest: Record<string, unknown>) {
  return MANIFEST_SECTIONS.flatMap(section => requireArray(manifest[section] ?? []).map(value => requireRecord(value)));
}

/** Refresh the descriptor and manifest pins of the content recipe and reader text, and nothing else. */
async function repinTextInputs(objectDirectory: string) {
  const descriptor = await readRecord(objectDirectory, 'object.json'), manifest = await readRecord(objectDirectory, 'source/manifest.json');
  let descriptorChanged = false, manifestChanged = false;
  for (const reference of recipeSources(descriptor).filter(source => TEXT_INPUTS.has(requireString(source.id)))) {
    const path = requireString(reference.path), bytes = await readFile(resolve(objectDirectory, path)), sha256 = digest(bytes);
    if (reference.sha256 !== sha256) { reference.sha256 = sha256; descriptorChanged = true; }
    for (const entry of manifestEntries(manifest).filter(candidate => `source/${requireString(candidate.path)}` === path)) {
      if (entry.expectedSha256 === sha256 && entry.expectedBytes === bytes.length) continue;
      entry.expectedSha256 = sha256; entry.expectedBytes = bytes.length; manifestChanged = true;
    }
  }
  if (descriptorChanged) await writePreparedText(resolve(objectDirectory, 'object.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
  if (manifestChanged) await writePreparedText(resolve(objectDirectory, 'source/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Publish one object's reader text without preparing imagery, controls or its scene transport. */
export async function prepareObjectText(objectDirectory: string, { check = false, sources }: { check?: boolean; sources?: SourceResolver } = {}) {
  if (!check) await repinTextInputs(objectDirectory);
  const descriptor = await readRecord(objectDirectory, 'object.json'), manifest = await readRecord(objectDirectory, 'source/manifest.json');
  const id = requireString(descriptor.id), properties = requireRecord(descriptor.properties), catalog = requireRecord(properties.catalog);
  const references = recipeSources(descriptor);
  const pinned = async (sourceId: string): Promise<unknown> => {
    const reference = references.find(source => source.id === sourceId);
    assert.ok(reference, `${id}: the recipe has no ${sourceId} source`);
    const path = requireString(reference.path), bytes = await readFile(resolve(objectDirectory, path)), sha256 = digest(bytes);
    const entries = manifestEntries(manifest).filter(candidate => `source/${requireString(candidate.path)}` === path);
    assert.equal(entries.length, 1, `${id}: ${path} needs one manifest entry`);
    assert.ok(reference.sha256 === sha256 && entries[0]!.expectedSha256 === sha256 && entries[0]!.expectedBytes === bytes.length,
      `${id}: ${path} is not pinned; run pnpm prepare:text -- ${id}`);
    return JSON.parse(bytes.toString('utf8'));
  };
  const content = await pinned('content');
  const review = await reviewObjectText(await pinned('text'), {
    objectId: id, name: requireString(catalog.name), content, manifest, sources,
    read: path => readFile(resolve(objectDirectory, path)),
  });
  if (review.violations.length) throw new Error(`${id}: reader text breaks the text contract:\n${describeTextViolations(review.violations)}`);
  const lensIds = requireArray(requireRecord(requireRecord(content).lenses).controls).map(value => requireString(requireRecord(value).id));
  const datasets = Object.fromEntries(lensIds.map(lensId => {
    const dataset = review.text.datasets[lensId]!;
    return [lensId, { title: dataset.title, ...(dataset.detail === undefined ? {} : { detail: dataset.detail }), summary: dataset.summary }];
  }));
  const publish = async (path: string, value: unknown) => {
    const original = await readFile(resolve(objectDirectory, path), 'utf8');
    const serialized = `${JSON.stringify(value, null, original.startsWith('{\n') ? 2 : 0)}\n`;
    if (check) assert.equal(original, serialized, `${id}: stale ${path}; run pnpm prepare:text -- ${id}`);
    else await writePreparedText(resolve(objectDirectory, path), serialized);
  };
  // The catalogue card is also the page's search and share description.
  await publish('object.json', { ...descriptor, properties: { ...properties, catalog: { ...catalog, description: review.text.card.text } } });
  const { schema, objectId, title, introduction: _introduction, datasets: _datasets, ...rest } = await readRecord(objectDirectory, 'prepared/content.json');
  await publish('prepared/content.json', { schema, objectId, title, introduction: review.text.introduction.text, datasets, ...rest });
  try {
    const panel = await readRecord(objectDirectory, 'prepared/panel.json');
    await publish('prepared/panel.json', { ...panel, introduction: review.text.introduction.text });
  } catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
  for (const path of ['prepared/authored-preparation.json', 'prepared/world-navigation.json']) {
    let receipt: Record<string, unknown>;
    try { receipt = await readRecord(objectDirectory, path); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    const recorded = requireArray(receipt.sources).map(value => requireRecord(value));
    if (!recorded.some(source => source.id === 'content')) continue;
    // Receipts list the recipe sources they were prepared from; only the two text inputs move here.
    const next = recorded.filter(source => source.id !== 'text').flatMap(source => source.id !== 'content' ? [source]
      : references.filter(reference => TEXT_INPUTS.has(requireString(reference.id))).map(reference => ({ ...reference })));
    await publish(path, { ...receipt, sources: next });
  }
  return { id, card: review.text.card.text.length, introduction: review.text.introduction.text.length, datasets: lensIds.length };
}

/** Every registered object's reader text, for the checks that compare objects. */
export async function readCatalogueText(projectRoot = root): Promise<{ text: ObjectText; name: string }[]> {
  return Promise.all(OBJECTS.map(async object => {
    const directory = resolve(projectRoot, 'src/planets', object.id);
    const reference = recipeSources(await readRecord(directory, 'object.json')).find(source => source.id === 'text');
    assert.ok(reference, `${object.id}: the recipe has no text source`);
    const text = parseObjectText(JSON.parse(await readFile(resolve(directory, requireString(reference.path)), 'utf8')), object.id);
    return { text, name: object.name };
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check');
  const ids = process.argv.slice(2).filter(argument => !['--', '--check'].includes(argument));
  assert.ok(ids.every(id => OBJECTS.some(object => object.id === id)), 'Unregistered text target');
  const sources = sourceResolver(await readSourceCatalog(root));
  const results = [];
  for (const object of OBJECTS) {
    if (!ids.length || ids.includes(object.id)) results.push(await prepareObjectText(resolve(root, 'src/planets', object.id), { check, sources }));
  }
  const repeated = catalogueTextViolations(await readCatalogueText());
  if (repeated.length) throw new Error(`Reader text repeats across objects:\n${describeTextViolations(repeated)}`);
  console.log(JSON.stringify({ check, objects: results.length, results: results.length > 3 ? results.slice(0, 3) : results }));
}
