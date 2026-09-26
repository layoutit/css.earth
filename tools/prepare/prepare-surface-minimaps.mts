import { refuseDirectRun } from '../cli/library-entry.mts';
import { isArray, isRecord, requireRecord, requireArray, requireString, requireFiniteNumber, shape, text, number, array, optional } from '@cssearth/core';
import type {ResizeOptions,Sharp} from 'sharp';
import { DECORATIVE_WEBP, composeLimbPreview } from '@cssearth/bake/raster';
import type {SurfacePreviewDirectories} from './surface-preview-source.mts';
import {optionalPreviewJson as optionalJson,parsePreviewControls,parsePreviewSurface} from './surface-preview-source.mts';
const parseMinimapFraming=shape({centerLongitudeDegrees:optional(number),excludeLenses:optional(array(text))});
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
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

// Preserve categorical/numeric cells only where the source contract requests it.
// Ordinary images retain the established resize and WebP presentation.
const nearestDisplay = (...records:unknown[]) => records.some(record => isRecord(record) && (
  record.displaySampling === 'nearest' || record.categorical === true ||
  (isArray(record.categories) && record.categories.length > 0) ||
  record.format === 'facet-scalars' || isRecord(record.scalarMap) && record.scalarMap.sourceFormat === 'facet-scalars'
));
/** The sidebar map is decoration: the body carries the data. A nearest-sampled map keeps the smaller of the decorative
 * encoding and lossless: noisy category maps (the Moon's and Titan's geology) grow as lossy WebP. */
async function writeMinimap(pipeline:Sharp, nearest:boolean, file:string) {
  const lossy = await pipeline.clone().webp(DECORATIVE_WEBP).toBuffer({ resolveWithObject: true });
  const lossless = nearest ? await pipeline.clone().webp({ lossless: true, effort: 4 }).toBuffer({ resolveWithObject: true }) : null;
  const chosen = lossless && lossless.data.length < lossy.data.length ? lossless : lossy;
  await writeFile(file, chosen.data);
  return chosen.info;
}
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
  const limbPreviews = new Set(requireArray(rasterInput?.surfaces ?? []).flatMap(value => {
    const record = requireRecord(value);
    return record.thumbnailFromLimbPlate === true ? [requireString(record.id)] : [];
  }));
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
      const interpreted = await (await interpretFor(objectDirectory, basename(objectDirectory), subset, Boolean(selected)))({ id: surface.id, source: surface.source, science: interpretation }, width, height, 1);
      const emission = requireRecord(recipe).emission;
      // A shadow's sphere is not drawn: its preview is what is, the off-limb image with the shadow disc over its centre.
      if (limbPreviews.has(surface.id) && interpreted.plates?.limb) {
        const plate = interpreted.plates.limb, disc = composeLimbPreview(plate, interpreted.data);
        pipeline = sharp(disc, { raw: { width: plate.size, height: plate.size, channels: 4 } })
          .resize(320, 320, { kernel: 'lanczos3' })
          .extend({ left: 160, right: 160, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } });
      } else if (interpretation.kind === 'black-shadow' && interpretation.offLimb !== undefined && interpreted.plates && isRecord(emission)) {
        const plate = interpreted.plates.offLimb, disc = requireFiniteNumber(emission.bodyDiameter) / requireFiniteNumber(emission.offLimbSize) * plate.size / 2;
        const rgb = Buffer.alloc(plate.size * plate.size * 3);
        for (let y = 0; y < plate.size; y++) for (let x = 0; x < plate.size; x++) {
          const i = y * plate.size + x, alpha = plate.data[i * 4 + 3]! / 255;
          const covered = Math.max(0, Math.min(1, disc - Math.hypot(x + 0.5 - plate.size / 2, y + 0.5 - plate.size / 2) + 0.5));
          for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(plate.data[i * 4 + c]! * alpha * (1 - covered));
        }
        pipeline = sharp(rgb, { raw: { width: plate.size, height: plate.size, channels: 3 } }).resize(minimapResize(false));
      } else pipeline = sharp(interpreted.data, { raw: { width, height, channels: interpreted.channels } }).resize(minimapResize(nearest));
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
    const result = await writeMinimap(pipeline, nearest, resolve(outputDirectory, path));
    images.push({ id: surface.id, path, width: result.width, height: result.height,
      ...(surface.attribution ? { attribution: surface.attribution } : {}) });
  }
  if (!selected) for await (const preview of recipeSurfacePreviews({ objectDirectory, publicDirectory, outputDirectory })) {
    if (images.some(image => image.id === preview.id)) continue;
    const path = `minimaps/${preview.id}.webp`;
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
    const result = await writeMinimap(sharp(preview.raster.data, { raw: preview.raster.info })
      .resize({ width: 640, withoutEnlargement: true }), false, resolve(outputDirectory, path));
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

refuseDirectRun(import.meta);
