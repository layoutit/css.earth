import { readObjectContentDatasets } from '@cssearth/objects';
// Entry: node site/build/prepare/companion-context.mts <object id>. An object with no surface has no picture of its own: its
// list marker is drawn from the bank its default dataset shows, or from a published picture of the bank that draws it
// (`--picture`). This writes that picture as the object's marker source,
// `source/presentation/context.png`, which its source manifest records with this generator.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { companionThumbnails } from './surfaceless-scene.ts';

const root = resolve(import.meta.dirname, '../../..'), [id, option] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: companion-context.mts <object id> [--picture=<path from the object folder>]');
const objectDirectory = resolve(root, 'src/objects', id), presentation = resolve(objectDirectory, 'source/presentation');
const picture = option?.startsWith('--picture=') ? resolve(objectDirectory, option.slice('--picture='.length)) : null;
if (picture) {
  // An object none of whose datasets shows a bank names the published picture of the bank that draws it.
  if (!picture.startsWith(`${resolve(root, 'src/objects')}/`)) throw new TypeError(`${option}: the picture is a file of an object package.`);
  await sharp(picture).resize(512, 512, { fit: 'cover' }).png().toFile(resolve(presentation, 'context.png'));
} else {
  const content = readObjectContentDatasets(JSON.parse(await readFile(resolve(objectDirectory, 'source/content/object.json'), 'utf8')));
  const shown = content.datasets.controls.find(control => control.id === content.datasets.defaultDataset);
  if (!shown?.volume) throw new TypeError(`src/objects/${id}/source/content/object.json: the default dataset shows no companion bank to picture.`);
  // The companion's picture, as the dataset thumbnail draws it, saved as PNG beside the other presentation sources.
  await companionThumbnails({ objectDirectory, publicDirectory: presentation, content: { datasets: { controls: [{ ...shown, thumbnail: 'context.webp' }] } } });
  await sharp(resolve(presentation, 'context.webp')).png().toFile(resolve(presentation, 'context.png'));
  await (await import('node:fs/promises')).rm(resolve(presentation, 'context.webp'));
}
console.log(`src/objects/${id}/source/presentation/context.png`);
