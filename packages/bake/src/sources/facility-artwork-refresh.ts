import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import { parsePreparedSources, parsePreparedExploration, parseExplorationImage, type DatasetRoutes } from '@cssearth/objects/provenance';

/** Refresh only artwork bytes/crops. Existing attribution and every unrelated
 * input must still match; this does not reacquire or rebake celestial datasets. The application passes in its dataset
 * routes, which validate the prepared facilities and sources. */
export async function prepareArtworkRefresh(root: string, before: Buffer, after: Buffer, images: ReadonlyMap<string, Buffer>, routes: DatasetRoutes) {
  const previous = requireRecord(JSON.parse(before.toString())), next = requireRecord(JSON.parse(after.toString()));
  const facilities = requireRecord(JSON.parse(await readFile(resolve(root, 'site/prepared/prepared-facilities.json'), 'utf8')));
  const sources = requireRecord(JSON.parse(await readFile(resolve(root, 'site/prepared/prepared-sources.json'), 'utf8')));
  const validatedSources = parsePreparedSources(sources, routes), validatedFacilities = parsePreparedExploration(facilities, validatedSources.sources, routes);
  const previousEntries = requireArray(previous.entries).map(value => requireRecord(value));
  const nextEntries = requireArray(next.entries).map(value => requireRecord(value));
  assert.deepEqual(previousEntries.map(entry => entry.id), nextEntries.map(entry => entry.id), 'Artwork membership changed');
  const prepared = [];
  for (const [index, entry] of nextEntries.entries()) {
    const old = previousEntries[index], source = requireRecord(entry.source), id = requireString(entry.id);
    const identity = (entry: Record<string, unknown>) => Object.fromEntries(Object.entries(entry).filter(([key]) => !['bytes', 'subject', 'composition', 'processing'].includes(key)));
    assert.deepEqual(identity(entry), identity(old), `${id}: source attribution changed; full preparation required`);
    if (source.kind !== 'model-render') assert.deepEqual(entry, old, `${id}: only model renders may change`);
    const image = parseExplorationImage({ id, src: entry.url, width: entry.width, height: entry.height, bytes: entry.bytes,
      kind: source.kind, sourceUrl: source.sourcePage, credit: source.credit, ...(entry.subject === undefined ? {} : { subject: entry.subject }) });
    const path = 'public' + image.src;
    const bytes = images.get(path) ?? await readFile(resolve(root, path));
    assert.equal(bytes.length, image.bytes, `${id}: artwork size`);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, image.width); assert.equal(metadata.height, image.height);
    prepared.push(image);
  }
  facilities.images = prepared;
  parsePreparedExploration(facilities, validatedSources.sources, routes); parsePreparedSources(sources, routes);
  return [{ path: resolve(root, 'site/prepared/prepared-facilities.json'), text: JSON.stringify(facilities, null, 2) + '\n' },
    { path: resolve(root, 'site/prepared/prepared-sources.json'), text: JSON.stringify(sources, null, 2) + '\n' }];
}
