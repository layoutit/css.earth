import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
/** Join mission facts to approved static images; never download or rerender them. */
export async function prepareSpacecraft() {
  const catalog = JSON.parse(await readFile(resolve(root, 'site/source/spacecraft/catalog.json'), 'utf8'));
  const library = JSON.parse(await readFile(resolve(root, 'site/source/spacecraft/render-library.json'), 'utf8'));
  const emblemLibrary = JSON.parse(await readFile(resolve(root, 'site/source/spacecraft/emblem-library.json'), 'utf8'));
  const images = new Map(library.entries.map(image => [image.id, image]));
  const emblems = new Map(emblemLibrary.entries.map(emblem => [emblem.id, emblem]));
  if (images.size !== library.entries.length) throw new TypeError('Duplicate spacecraft image identity.');
  if (emblems.size !== emblemLibrary.entries.length || emblems.size !== catalog.spacecraft.length)
    throw new TypeError('Spacecraft emblems must cover the mission catalog exactly.');
  const prepared = {};
  for (const entry of catalog.spacecraft) {
    if (!/^[a-z][a-z0-9-]*$/u.test(entry.id) || prepared[entry.id]) throw new TypeError('Invalid spacecraft catalog identity.');
    if (typeof entry.description !== 'string' || !entry.description.trim())
      throw new TypeError(`Missing spacecraft description: ${entry.id}.`);
    const image = images.get(entry.id);
    if (!image || image.url !== `/shell/spacecraft-renders/${entry.id}.webp`)
      throw new Error(`Missing approved spacecraft image: ${entry.id}.`);
    const bytes = await readFile(resolve(root, `public${image.url}`));
    if (bytes.length !== image.bytes || digest(bytes) !== image.sha256)
      throw new Error(`Approved spacecraft image identity changed: ${entry.id}.`);
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== 'webp' || metadata.width !== image.width || metadata.height !== image.height)
      throw new Error(`Approved spacecraft image dimensions changed: ${entry.id}.`);
    const approvedEmblem = emblems.get(entry.id);
    if (!approvedEmblem || approvedEmblem.src !== `/shell/spacecraft-emblems/${entry.id}.png`)
      throw new Error(`Missing approved spacecraft emblem: ${entry.id}.`);
    const emblemBytes = await readFile(resolve(root, `public${approvedEmblem.src}`));
    if (emblemBytes.length !== approvedEmblem.bytes || digest(emblemBytes) !== approvedEmblem.sha256)
      throw new Error(`Approved spacecraft emblem identity changed: ${entry.id}.`);
    const emblemMetadata = await sharp(emblemBytes).metadata();
    if (emblemMetadata.format !== 'png' || !emblemMetadata.hasAlpha ||
        emblemMetadata.width !== approvedEmblem.width || emblemMetadata.height !== approvedEmblem.height)
      throw new Error(`Approved spacecraft emblem must be a transparent PNG: ${entry.id}.`);
    const emblem = { ...approvedEmblem.source, kind: 'emblem', src: approvedEmblem.src,
      width: approvedEmblem.width, height: approvedEmblem.height,
      bytes: approvedEmblem.bytes, sha256: approvedEmblem.sha256 };
    prepared[entry.id] = { ...entry, image: {
      src: image.url, width: image.width, height: image.height,
      bytes: image.bytes, sha256: image.sha256,
      kind: image.source.kind, sourceUrl: image.source.sourcePage, credit: image.source.credit,
    }, emblem };
  }
  const output = resolve(root, 'site/prepared-spacecraft.json');
  const serialized = JSON.stringify(prepared, null, 2) + '\n';
  const previous = await readFile(output, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null; throw error;
  });
  if (previous !== serialized) await writeFile(output, serialized);
  return prepared;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const entries = await prepareSpacecraft();
  console.log(`Reused ${Object.keys(entries).length} approved spacecraft images (${Object.values(entries).reduce((n, entry) => n + entry.image.bytes, 0)} bytes).`);
}
