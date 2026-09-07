import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { OBJECTS } from '../site/objects.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
async function optionalJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// A dedicated sidebar asset: never transport a globe-resolution map for a minimap.
export async function prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory }) {
  const prepared = await optionalJson(resolve(outputDirectory, 'surfaces.json'));
  const raster = await optionalJson(resolve(objectDirectory, 'source/preparation/raster.json'));
  const surfaces = new Map((raster?.surfaces ?? []).map(surface => [surface.id, surface]));
  for (const surface of prepared?.surfaces ?? []) if (surface.map) surfaces.set(surface.id, surface);
  // Paged surfaces use packed scene atlases. Their authored map inputs, not
  // atlas URLs, provide the equirectangular preview consumed by this panel.
  const paged = await optionalJson(resolve(objectDirectory, 'source/preparation/paged-ellipsoid.json'));
  const bindings = await optionalJson(resolve(objectDirectory, 'source/content/lens-bindings.json'));
  for (const lens of bindings?.controls ?? []) {
    const map = paged?.surface?.maps?.find(map => map.name === lens.surfacePagePrefix);
    if (map) surfaces.set(lens.id, { id: lens.id, source: map.path });
  }
  const images = [];
  for (const surface of surfaces.values()) {
    const input = surface.map ? resolve(publicDirectory, surface.map.url.split('/').at(-1))
      : typeof surface.source === 'string' ? resolve(objectDirectory, 'source', surface.source) : null;
    if (!input) continue;
    const path = `minimaps/${surface.id}.webp`;
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
    const result = await sharp(input).resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
      .toFile(resolve(outputDirectory, path));
    images.push({ id: surface.id, path, width: result.width, height: result.height });
  }
  await writeFile(resolve(outputDirectory, 'minimaps.json'), JSON.stringify({ images }) + '\n');
  return images;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const requested = process.argv.slice(2);
  for (const { id } of OBJECTS) {
    if (requested.length && !requested.includes(id)) continue;
    const objectDirectory = resolve(projectRoot, 'src/planets', id);
    const images = await prepareSurfaceMinimaps({ objectDirectory,
      publicDirectory: resolve(projectRoot, 'public/scenes', id), outputDirectory: resolve(objectDirectory, 'prepared') });
    console.log(`${id}: ${images.length} prepared minimaps`);
  }
}
