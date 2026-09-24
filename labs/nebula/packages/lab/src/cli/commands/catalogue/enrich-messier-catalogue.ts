/** Explicit single-writer metadata enrichment. Stop acquisition before invoking this command. */
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { enrichImageMetadata, selectEnrichmentCandidates, type EnrichedArchiveImage } from './enrich-messier.ts';
import { inventoryStorage } from '../../../features/catalogue/selection.ts';
import { readArchiveImage, readArchiveQuery, readMessierInventory, type ArchiveImage, type MessierInventory } from '../../../features/catalogue/types.ts';
import { isRecord as record } from '@cssearth/core';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const directory = '.local/nebula-lab/catalogue/messier';
const indexPath = `${directory}/index.json`;
function originalImage(image: ArchiveImage): ArchiveImage {
  const value: unknown = image;
  if (!record(value) || !record(value.metadataOriginal)) return image;
  const original = value.metadataOriginal;
  return readArchiveImage({ ...image, accessUrl: original.accessUrl, accessFormat: original.accessFormat,
    estimatedBytes: original.estimatedBytes, previewUrl: original.previewUrl });
}
export function originalAccessKey(image: ArchiveImage): string {
  const original = originalImage(image);
  return `${image.provider}:${original.accessUrl ?? image.id}`;
}

/** All overlapping-target copies change together, so a resolved URL cannot double-count a dataset. */
export function applyEnrichments(inventory: MessierInventory, updates: Map<string, EnrichedArchiveImage>): MessierInventory {
  return { ...inventory, generatedAt: new Date().toISOString(), storage: undefined,
    targets: inventory.targets.map(target => ({ ...target, queries: target.queries.map(query => {
      const images = query.images.map(image => {
        const update = updates.get(originalAccessKey(image)); if (!update) return image;
        const original = originalImage(image), value: unknown = image;
        const previous = record(value) && Array.isArray(value.metadataEvidence) ? value.metadataEvidence : [];
        return readArchiveImage({ ...image, accessUrl: update.accessUrl, accessFormat: update.accessFormat,
          estimatedBytes: update.estimatedBytes, previewUrl: update.previewUrl,
          metadataOriginal: { publishedId: image.id.replace(/#[a-f0-9]{16}$/, ''), accessUrl: original.accessUrl,
            accessFormat: original.accessFormat, estimatedBytes: original.estimatedBytes, previewUrl: original.previewUrl },
          metadataEvidence: [...previous, ...update.metadataEvidence] });
      });
      return { ...query, images, matchedEstimatedBytes: query.status === 'complete' ? images.reduce((sum, image) => sum + (image.estimatedBytes ?? 0), 0) : null,
        matchedUnknownSizeCount: query.status === 'complete' ? images.filter(image => image.estimatedBytes === null).length : null };
    }) })) };
}

async function hydrate(root: string, text: string): Promise<MessierInventory> {
  const inventory = readMessierInventory(JSON.parse(text));
  for (const target of inventory.targets) for (let i = 0; i < target.queries.length; i++) {
    const query = target.queries[i]!; if (!query.imagesPath) continue;
    const bytes = await readFile(resolve(root, query.imagesPath));
    if (hash(bytes) !== query.imagesSha256) throw new Error(`Archive page hash mismatch: ${query.imagesPath}`);
    const page = readArchiveQuery(JSON.parse(bytes.toString()));
    if (page.provider !== query.provider || page.images.length !== query.imageCount) throw new Error('Archive page identity/count mismatch.');
    target.queries[i] = page;
  }
  delete inventory.storage;
  return inventory;
}
async function publish(root: string, originalIndex: string, inventory: MessierInventory) {
  const files = inventory.targets.flatMap(target => target.queries.filter(query => query.status !== 'pending').map(query => {
    const { imagesPath: _path, imagesSha256: _hash, imageCount: _count, ...full } = query;
    return { path: `${directory}/queries/${target.objectId}-${query.provider}.json`, query, contents: JSON.stringify(full) };
  }));
  const snapshot: MessierInventory = { ...inventory, storage: inventoryStorage(inventory), targets: inventory.targets.map(target => ({ ...target,
    queries: target.queries.map(query => {
      const file = files.find(candidate => candidate.query === query);
      return file ? { ...query, images: [], imageCount: query.images.length, imagesPath: file.path, imagesSha256: hash(file.contents) } : query;
    }) })) };
  readMessierInventory(snapshot);
  if (hash(await readFile(resolve(root, indexPath))) !== hash(originalIndex)) {
    throw new Error('Inventory changed during enrichment. Stop acquisition and retry; no pages were modified.');
  }
  // Single writer: publish complete pages first, then their compact index. Readers check page hashes.
  for (const file of files) {
    const path = resolve(root, file.path);
    if (hash(await readFile(path)) === hash(file.contents)) continue;
    await writeFile(`${path}.enrich.tmp`, file.contents); await rename(`${path}.enrich.tmp`, path);
  }
  const path = resolve(root, indexPath);
  await writeFile(`${path}.enrich.tmp`, JSON.stringify(snapshot)); await rename(`${path}.enrich.tmp`, path);
  const verified = readMessierInventory(JSON.parse(await readFile(path, 'utf8')));
  if (JSON.stringify(verified) !== JSON.stringify(snapshot)) throw new Error('Published inventory differs from enrichment snapshot.');
  const summaryPath = resolve(root, directory, 'summary.json');
  await writeFile(`${summaryPath}.enrich.tmp`, JSON.stringify({ generatedAt: verified.generatedAt, catalogueSha256: verified.catalogueSha256,
    policy: verified.policy, ...verified.storage, indexBytes: (await readFile(path)).byteLength }, null, 2));
  await rename(`${summaryPath}.enrich.tmp`, summaryPath);
  return verified;
}

async function main() {
  const args = process.argv.slice(2), objects = args.filter(arg => arg.startsWith('--object=')).map(arg => arg.slice(9));
  if (!objects.length || args.some(arg => !/^(--object=m(?:[1-9]|[1-9][0-9]|10[0-9]|110)|--max-images=(?:[1-9]|1[0-2]))$/.test(arg))) {
    throw new Error('Usage: enrich-messier-catalogue --object=m42 [--object=m8] [--max-images=3]. Stop inventory acquisition first.');
  }
  const maximum = Number(args.find(arg => arg.startsWith('--max-images='))?.slice(13) ?? 3);
  const root = process.cwd(), original = await readFile(resolve(root, indexPath), 'utf8'), inventory = await hydrate(root, original);
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
  const updates = new Map<string, EnrichedArchiveImage>();
  for (const target of inventory.targets.filter(target => objects.includes(target.objectId))) {
    for (const query of target.queries) {
      if (!['complete', 'truncated'].includes(query.status)) continue;
      for (const image of selectEnrichmentCandidates(query.images, maximum)) {
        const key = originalAccessKey(image); if (updates.has(key)) continue;
        console.log(`ENRICH ${target.objectId} ${query.provider} ${image.collection} ${image.id}`);
        const result = await enrichImageMetadata(originalImage(image), controller.signal);
        updates.set(key, result);
        console.log(`ENRICH_RESULT ${target.objectId} ${query.provider} preview=${Boolean(result.previewUrl)} bytes=${result.estimatedBytes ?? 'unknown'} ${result.metadataEvidence.map(e => `${e.stage}:${e.status}`).join(' ')}`);
      }
    }
  }
  controller.signal.throwIfAborted();
  if (!updates.size) throw new Error('No eligible completed archive images for the selected objects; nothing written.');
  const verified = await publish(root, original, applyEnrichments(inventory, updates));
  const results = [...updates.values()], summary = { objects: [...new Set(objects)], enriched: results.length,
    previews: results.filter(image => image.metadataEvidence.some(e => e.stage === 'preview-head' && e.status === 'resolved')).length,
    resolved: results.filter(image => image.metadataEvidence.some(e => e.stage === 'science-head' && e.status === 'resolved')).length,
    failed: results.filter(image => image.metadataEvidence.some(e => e.status === 'error')).length, storage: verified.storage };
  console.log(`MESSIER_ENRICHMENT_SAVED ${JSON.stringify(summary)}`);
  if (summary.failed) process.exitCode = 2;
}
if (/^enrich-messier-catalogue\.(?:ts|mjs)$/.test(basename(process.argv[1] ?? ''))) await main();
