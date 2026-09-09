import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { orientLatitudeBands } from './objects/static-surface/projection.mjs';
import { observationRaster } from './objects/static-surface/raster.mjs';
import { recipeSurfacePreviews, assertSurfacePreviewCoverage } from './surface-preview-rasters.mjs';
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
  const framing = await optionalJson(resolve(objectDirectory, 'source/presentation/minimap.json'));
  const images = [];
  const excluded = framing?.excludeLenses ?? [];
  if (!Array.isArray(excluded) || excluded.some(id => typeof id !== 'string' ||
      !surfaces.has(id) && !raster?.lenses?.some(lens => lens.id === id))) throw new Error('Invalid excluded minimap lenses');
  // These source recipes compile warped face atlases, not reusable flat maps.
  // Reuse their observation interpretation before projection, including DEM
  // colors, relief and missing coverage. Never show the raw TIFF or an atlas.
  if (raster?.kind === 'observation-lenses') {
    for (const plan of raster.lenses) {
      if (excluded.includes(plan.id)) continue;
      const density = Math.max(...raster.densities);
      let data, info;
      if (raster.surfaceProjection === 'oriented-bands') {
        ({ data, info } = await sharp(resolve(publicDirectory, `${plan.output}${density === 2 ? '@2x' : ''}.webp`))
          .raw().toBuffer({ resolveWithObject: true }));
        if (info.width !== raster.width * density || info.height !== raster.height * density) throw new Error('Observation preview dimensions drifted.');
        data = orientLatitudeBands(data, { ...info, bandCount: raster.latitudeSegments });
      } else {
        ({ data, info } = await observationRaster({
          input: resolve(objectDirectory, 'source', plan.input), plan,
          width: raster.width * density, height: raster.height * density,
        }));
      }
      const path = `minimaps/${plan.id}.webp`;
      await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
      const result = await sharp(data, { raw: info }).resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
        .toFile(resolve(outputDirectory, path));
      images.push({ id: plan.id, path, width: result.width, height: result.height });
    }
  }
  for (const surface of surfaces.values()) {
    if (excluded.includes(surface.id)) continue;
    const input = surface.map ? resolve(publicDirectory, surface.map.url.split('/').at(-1))
      : typeof surface.source === 'string' ? resolve(objectDirectory, 'source', surface.source) : null;
    if (!input) continue;
    const path = `minimaps/${surface.id}.webp`;
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
    let pipeline = sharp(input).resize({ width: 640, withoutEnlargement: true });
    if (framing?.centerLongitudeDegrees !== undefined) {
      if (!Number.isFinite(framing.centerLongitudeDegrees)) throw new Error('Invalid minimap framing');
      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
      const offset = Math.round(((framing.centerLongitudeDegrees - 180) % 360 + 360) % 360 / 360 * info.width);
      const shifted = Buffer.alloc(data.length);
      for (let y = 0; y < info.height; y++) {
        const row = y * info.width * info.channels, split = offset * info.channels;
        data.copy(shifted, row, row + split, row + info.width * info.channels);
        data.copy(shifted, row + (info.width - offset) * info.channels, row, row + split);
      }
      pipeline = sharp(shifted, { raw: info });
    }
    const result = await pipeline.webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
      .toFile(resolve(outputDirectory, path));
    images.push({ id: surface.id, path, width: result.width, height: result.height,
      ...(surface.attribution ? { attribution: surface.attribution } : {}) });
  }
  for await (const preview of recipeSurfacePreviews({ objectDirectory, publicDirectory, outputDirectory })) {
    if (images.some(image => image.id === preview.id)) continue;
    const path = `minimaps/${preview.id}.webp`;
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
    const result = await sharp(preview.raster.data, { raw: preview.raster.info })
      .resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
      .toFile(resolve(outputDirectory, path));
    images.push({ id: preview.id, path, width: result.width, height: result.height });
  }
  const [controls, lenses, bindings] = await Promise.all([
    optionalJson(resolve(outputDirectory, 'controls.json')),
    optionalJson(resolve(outputDirectory, 'lenses.json')),
    optionalJson(resolve(objectDirectory, 'source/content/lens-bindings.json')),
  ]);
  assertSurfacePreviewCoverage(controls?.lenses?.controls ?? [], images,
    [...(lenses?.controls ?? []), ...(bindings?.controls ?? [])]);
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
