// Entry: node site/build/prepare/companion-context.mts <object id>. An object with no surface has no picture of its own: its
// list marker is drawn from the bank its default dataset shows. This writes that picture as the object's marker source,
// `source/presentation/context.png`, which its source manifest records with this generator.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { companionThumbnails } from './surfaceless-scene.ts';

const root = resolve(import.meta.dirname, '../../..'), [id] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: companion-context.mts <object id>');
const objectDirectory = resolve(root, 'src/objects', id), presentation = resolve(objectDirectory, 'source/presentation');
const content = JSON.parse(await readFile(resolve(objectDirectory, 'source/content/object.json'), 'utf8')) as { datasets: { defaultDataset: string; controls: { id: string; thumbnail?: string; volume?: unknown }[] } };
const shown = content.datasets.controls.find(control => control.id === content.datasets.defaultDataset);
if (!shown?.volume) throw new TypeError(`src/objects/${id}/source/content/object.json: the default dataset shows no companion bank to picture.`);
// The companion's picture, as the dataset thumbnail draws it, saved as PNG beside the other presentation sources.
await companionThumbnails({ objectDirectory, publicDirectory: presentation, content: { datasets: { controls: [{ ...shown, thumbnail: 'context.webp' }] } } });
await sharp(resolve(presentation, 'context.webp')).png().toFile(resolve(presentation, 'context.png'));
await (await import('node:fs/promises')).rm(resolve(presentation, 'context.webp'));
console.log(`src/objects/${id}/source/presentation/context.png`);
