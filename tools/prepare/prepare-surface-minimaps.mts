import { isArray } from '../../src/platform/is-array.mts';
import type {ResizeOptions,WebpOptions} from 'sharp';
import type {SurfacePreviewDirectories} from './surface-preview-source.mts';
import {optionalPreviewJson as optionalJson,parsePreviewControls,parsePreviewSurface} from './surface-preview-source.mts';
import {isRecord,requireRecord,requireArray,requireString,requireFiniteNumber} from '../sources/source-values.mts';
import {shape,text,number,array,optional} from '../objects/terrestrial-layers/source-records.mts';
const parseMinimapFraming=shape({centerLongitudeDegrees:optional(number),excludeLenses:optional(array(text))});
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { createSurfaceInterpreter, parseInterpreterRecipe, selectSurfaceDependencies, type InterpreterRecipe } from '../objects/observation/interpret.mts';
// One interpreter per object so the sidebar map previews a science surface through the decoder that packed it.
const interpreters = new Map<string, ReturnType<typeof createSurfaceInterpreter>>();
function interpretFor(objectDirectory: string, objectId: string, recipe: InterpreterRecipe, photographs = false) {
  const key = `${objectDirectory}:${photographs ? recipe.surfaces.map(s => s.id).join(',') : 'complete'}`;
  let pending = interpreters.get(key);
  if (!pending) {
    pending = createSurfaceInterpreter({ objectId, displayName: objectId, sourceDirectory: resolve(objectDirectory, 'source'), recipe,
      sourceVerification: photographs ? 'photographs' : 'complete' });
    interpreters.set(key, pending);
  }
  return pending;
}
import { recipeSurfacePreviews, assertSurfacePreviewCoverage } from './surface-preview-rasters.mts';
import { SCENE_OBJECTS } from '../../site/objects.mts';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
// Preserve categorical/numeric cells only where the source contract requests it.
// Ordinary images retain the established resize and WebP presentation.
const nearestDisplay = (...records:unknown[]) => records.some(record => isRecord(record) && (
  record.displaySampling === 'nearest' || record.categorical === true ||
  (isArray(record.categories) && record.categories.length > 0) ||
  record.format === 'facet-scalars' || isRecord(record.scalarMap) && record.scalarMap.sourceFormat === 'facet-scalars'
));
const minimapEncoding = (nearest:boolean):WebpOptions => nearest ? { lossless: true, effort: 4 }
  : { quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true };
const minimapResize = (nearest:boolean):ResizeOptions => ({ width: 640, withoutEnlargement: true,
  ...(nearest ? { kernel: 'nearest' } : {}) });

// A dedicated sidebar asset: never transport a globe-resolution map for a minimap.
export async function prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs }:SurfacePreviewDirectories & { photographs?: readonly string[] }) {
  const prepared = await optionalJson(resolve(outputDirectory, 'surfaces.json'));
  const rasterInput = await optionalJson(resolve(objectDirectory, 'source/preparation/raster.json'));
  const sourceSurfaces=requireArray(rasterInput?.surfaces ?? []).map(parsePreviewSurface);
  const sourceLenses=requireArray(rasterInput?.lenses ?? []).map(value=>shape({id:text})(value));
  const surfaces = new Map(sourceSurfaces.map(surface => [surface.id, surface] as const));
  const selected = photographs ? new Set(photographs) : null;
  // Raster-lane surfaces with a scientific interpretation preview through the same decoders the lane packs with.
  const science = new Map(requireArray(rasterInput?.surfaces ?? []).flatMap(value => { const record = requireRecord(value); return isRecord(record.science) ? [[requireString(record.id), record.science] as const] : []; }));
  for (const surface of requireArray(prepared?.surfaces ?? []).map(parsePreviewSurface)) if (surface.map && (!selected || !surfaces.has(surface.id))) surfaces.set(surface.id, surface);
  if (selected && (!selected.size || selected.size !== photographs!.length || [...selected].some(id => !surfaces.has(id))))
    throw new TypeError('Choose existing photographic surfaces for minimap refresh.');
  const framingValue=await optionalJson(resolve(objectDirectory, 'source/presentation/minimap.json'));
  const framing=framingValue && parseMinimapFraming(framingValue);
  const images = [];
  const excluded = framing?.excludeLenses ?? [];
  if (!isArray(excluded) || excluded.some(id => typeof id !== 'string' ||
      !surfaces.has(id) && !sourceLenses.some(lens => lens.id === id))) throw new Error('Invalid excluded minimap lenses');
  for (const surface of surfaces.values()) {
    if (excluded.includes(surface.id) || selected && !selected.has(surface.id)) continue;
    const input = surface.map ? resolve(publicDirectory, requireString(surface.map.url.split('/').at(-1)))
      : typeof surface.source === 'string' ? resolve(objectDirectory, 'source', surface.source) : null;
    if (!input) continue;
    const path = `minimaps/${surface.id}.webp`;
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
    const interpretation = science.get(surface.id);
    const nearest = nearestDisplay(surface, interpretation?.scientific, interpretation);
    let pipeline;
    if (interpretation && typeof surface.source === 'string') {
      const recipe = requireRecord(rasterInput);
      const width = requireFiniteNumber(recipe.width), height = requireFiniteNumber(recipe.height);
      const parsed = parseInterpreterRecipe(recipe);
      const subset = selected ? selectSurfaceDependencies(parsed, [...selected]) : parsed;
      const { data, channels } = await (await interpretFor(objectDirectory, basename(objectDirectory), subset, Boolean(selected)))({ id: surface.id, source: surface.source, science: interpretation }, width, height, 1);
      pipeline = sharp(data, { raw: { width, height, channels } }).resize(minimapResize(nearest));
    } else pipeline = sharp(input).resize(minimapResize(nearest));
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
    const result = await pipeline.webp(minimapEncoding(nearest))
      .toFile(resolve(outputDirectory, path));
    images.push({ id: surface.id, path, width: result.width, height: result.height,
      ...(surface.attribution ? { attribution: surface.attribution } : {}) });
  }
  if (!selected) for await (const preview of recipeSurfacePreviews({ objectDirectory, publicDirectory, outputDirectory })) {
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
  const shell=controls?.lenses ? parsePreviewControls(controls.lenses).controls : [];
  assertSurfacePreviewCoverage(shell.filter(lens => !excluded.includes(lens.id) && (!selected || selected.has(lens.id))), images,
    [...(lenses ? parsePreviewControls(lenses).controls : []), ...(bindings ? parsePreviewControls(bindings).controls : [])]);
  if (selected) {
    const existing = await optionalJson(resolve(outputDirectory, 'minimaps.json'));
    const previous = requireArray(existing?.images).map(value => ({ ...requireRecord(value), ...shape({ id: text, path: text, width: number, height: number })(value) }));
    if (images.some(image => !previous.some(item => item.id === image.id))) throw new TypeError('Photographic refresh cannot add a minimap.');
    const replacements = new Map(images.map(image => [image.id, image]));
    await writeFile(resolve(outputDirectory, 'minimaps.json'), JSON.stringify({ images: previous.map(image => replacements.get(image.id) ?? image) }) + '\n');
  } else await writeFile(resolve(outputDirectory, 'minimaps.json'), JSON.stringify({ images }) + '\n');
  return images;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const requested = process.argv.slice(2);
  for (const { id } of SCENE_OBJECTS) {
    if (requested.length && !requested.includes(id)) continue;
    const objectDirectory = resolve(projectRoot, 'src/objects', id);
    const images = await prepareSurfaceMinimaps({ objectDirectory,
      publicDirectory: resolve(projectRoot, 'public/scenes', id), outputDirectory: resolve(objectDirectory, 'prepared') });
    console.log(`${id}: ${images.length} prepared minimaps`);
  }
}
