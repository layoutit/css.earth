import { sha256 } from '../../src/platform/sha256.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '../sources/source-values.mts';
import { parsePreparedSources, sourceCatalogDigest } from '../../src/platform/prepared-sources.mts';
import { parsePreparedExploration, parseExplorationImage } from '../../src/platform/prepared-exploration.mts';
import { readSourceCatalog } from '../sources/read-source-catalogue.mts';

/** Refresh only artwork bytes/crops. Existing attribution and every unrelated
 * input must still match; this does not reacquire or rebake celestial datasets. */
export async function prepareArtworkRefresh(root: string, before: Buffer, after: Buffer, images: ReadonlyMap<string, Buffer>) {

  const libraryPath = 'site/source/facilities/render-library.json';
  const previous = requireRecord(JSON.parse(before.toString())), next = requireRecord(JSON.parse(after.toString()));
  const facilities = requireRecord(JSON.parse(await readFile(resolve(root, 'site/prepared-facilities.json'), 'utf8')));
  const sources = requireRecord(JSON.parse(await readFile(resolve(root, 'site/prepared-sources.json'), 'utf8')));
  const validatedSources = parsePreparedSources(sources), validatedFacilities = parsePreparedExploration(facilities, validatedSources.sources);
  assert.equal(sha256(before), validatedSources.closure[libraryPath], 'Previous artwork library does not match the prepared graph');
  assert.equal(sourceCatalogDigest(await readSourceCatalog(root)), validatedSources.catalogSha256, 'Source records changed; full preparation required');
  const previousEntries = requireArray(previous.entries).map(value => requireRecord(value));
  const nextEntries = requireArray(next.entries).map(value => requireRecord(value));
  assert.deepEqual(previousEntries.map(entry => entry.id), nextEntries.map(entry => entry.id), 'Artwork membership changed');
  const mutable = new Set<string>([libraryPath]);
  const prepared = [];
  for (const [index, entry] of nextEntries.entries()) {
    const old = previousEntries[index], source = requireRecord(entry.source), id = requireString(entry.id);
    const identity = (entry: Record<string, unknown>) => Object.fromEntries(Object.entries(entry).filter(([key]) => !['bytes', 'sha256', 'subject', 'composition', 'processing'].includes(key)));
    assert.deepEqual(identity(entry), identity(old), `${id}: source attribution changed; full preparation required`);
    if (source.kind !== 'model-render') assert.deepEqual(entry, old, `${id}: only model renders may change`);
    const image = parseExplorationImage({ id, src: entry.url, width: entry.width, height: entry.height, bytes: entry.bytes, sha256: entry.sha256,
      kind: source.kind, sourceUrl: source.sourcePage, credit: source.credit, ...(entry.subject === undefined ? {} : { subject: entry.subject }) });
    const path = 'public' + image.src;
    const bytes = images.get(path) ?? await readFile(resolve(root, path));
    assert.equal(bytes.length, image.bytes, `${id}: artwork size`); assert.equal(sha256(bytes), image.sha256, `${id}: artwork digest`);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, image.width); assert.equal(metadata.height, image.height);
    assert.equal(validatedSources.closure[path], old.sha256, `${id}: prior artwork pin`);
    if (JSON.stringify(entry) !== JSON.stringify(old)) mutable.add(path);
    prepared.push(image);
  }
  // Preserve the proof behind the existing attribution graph, including absent,
  // changed or added source records failing above. Only these image pins move.
  for (const [path, hash] of Object.entries(validatedSources.closure)) if (!mutable.has(path)) {
    assert.equal(sha256(await readFile(resolve(root, path))), hash, `Unrelated source input changed: ${path}`);
  }
  const closure: Record<string, string> = { ...validatedSources.closure, [libraryPath]: sha256(after) };
  for (const image of prepared) closure['public' + image.src] = image.sha256;
  facilities.images = prepared; sources.closure = closure;
  parsePreparedExploration(facilities, validatedSources.sources); parsePreparedSources(sources);
  return [{ path: resolve(root, 'site/prepared-facilities.json'), text: JSON.stringify(facilities, null, 2) + '\n' },
    { path: resolve(root, 'site/prepared-sources.json'), text: JSON.stringify(sources, null, 2) + '\n' }];
}
