import { isArray } from '../src/platform/is-array.mts';
import type {ResizeOptions,WebpOptions} from 'sharp';
import type {SurfacePreviewDirectories} from './surface-preview-source.mts';
import {optionalPreviewJson as optionalJson,parsePreviewControls,parsePreviewSurface} from './surface-preview-source.mts';
import {parseObservationPreviewLens} from './objects/static-surface/source-contract.mts';
import {isRecord,requireRecord,requireArray,requireString,requireFiniteNumber} from './source-values.mts';
import {shape,text,number,array,optional} from './objects/terrestrial-layers/source-records.mts';
const parseObservationPreview=shape({surfaceProjection:optional(text),densities:array(number),width:number,height:number,latitudeSegments:optional(number),lenses:array(parseObservationPreviewLens)});
const parseMinimapFraming=shape({centerLongitudeDegrees:optional(number),excludeLenses:optional(array(text))});
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { orientLatitudeBands } from './objects/static-surface/projection.mts';
import { observationRaster } from './objects/static-surface/raster.mts';
import { recipeSurfacePreviews, assertSurfacePreviewCoverage } from './surface-preview-rasters.mts';
import { OBJECTS } from '../site/objects.mts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
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
export async function prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory }:SurfacePreviewDirectories) {
  const prepared = await optionalJson(resolve(outputDirectory, 'surfaces.json'));
  const rasterInput = await optionalJson(resolve(objectDirectory, 'source/preparation/raster.json'));
  const sourceSurfaces=requireArray(rasterInput?.surfaces ?? []).map(parsePreviewSurface);
  const sourceLenses=requireArray(rasterInput?.lenses ?? []).map(value=>shape({id:text})(value));
  const surfaces = new Map(sourceSurfaces.map(surface => [surface.id, surface] as const));
  // Raster-lane surfaces with a scientific interpretation preview through the same decoders the lane packs with.
  const science = new Map(requireArray(rasterInput?.surfaces ?? []).flatMap(value => { const record = requireRecord(value); return isRecord(record.science) ? [[requireString(record.id), record.science] as const] : []; }));
  for (const surface of requireArray(prepared?.surfaces ?? []).map(parsePreviewSurface)) if (surface.map) surfaces.set(surface.id, surface);
  const framingValue=await optionalJson(resolve(objectDirectory, 'source/presentation/minimap.json'));
  const framing=framingValue && parseMinimapFraming(framingValue);
  const images = [];
  const excluded = framing?.excludeLenses ?? [];
  if (!isArray(excluded) || excluded.some(id => typeof id !== 'string' ||
      !surfaces.has(id) && !sourceLenses.some(lens => lens.id === id))) throw new Error('Invalid excluded minimap lenses');
  // These source recipes compile warped face atlases, not reusable flat maps.
  // Reuse their observation interpretation before projection, including DEM
  // colors, relief and missing coverage. Never show the raw TIFF or an atlas.
  if (rasterInput?.kind === 'observation-lenses') {
    const raster=parseObservationPreview(rasterInput);
    for (const plan of raster.lenses) {
      if (excluded.includes(plan.id)) continue;
      const density = Math.max(...raster.densities);
      let data, info;
      if (raster.surfaceProjection === 'oriented-bands') {
        ({ data, info } = await sharp(resolve(publicDirectory, `${requireString(plan.output)}${density === 2 ? '@2x' : ''}.webp`))
          .raw().toBuffer({ resolveWithObject: true }));
        const scale = plan.rasterScale ?? 1;
        if (info.width !== raster.width * density * scale || info.height !== raster.height * density * scale) throw new Error('Observation preview dimensions drifted.');
        data = orientLatitudeBands(data, { ...info, bandCount: requireFiniteNumber(raster.latitudeSegments) });
      } else {
        ({ data, info } = await observationRaster({
          input: resolve(objectDirectory, 'source', plan.input), plan,
          width: raster.width * density, height: raster.height * density,
        }));
      }
      const path = `minimaps/${plan.id}.webp`;
      await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
      const nearest = nearestDisplay(plan.scientific, plan);
      const result = await sharp(data, { raw: info }).resize(minimapResize(nearest))
        .webp(minimapEncoding(nearest))
        .toFile(resolve(outputDirectory, path));
      images.push({ id: plan.id, path, width: result.width, height: result.height });
    }
  }
  for (const surface of surfaces.values()) {
    if (excluded.includes(surface.id)) continue;
    const input = surface.map ? resolve(publicDirectory, requireString(surface.map.url.split('/').at(-1)))
      : typeof surface.source === 'string' ? resolve(objectDirectory, 'source', surface.source) : null;
    if (!input) continue;
    const path = `minimaps/${surface.id}.webp`;
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true });
    const interpretation = science.get(surface.id);
    const nearest = nearestDisplay(surface, interpretation?.scientific);
    let pipeline;
    if (interpretation && typeof surface.source === 'string') {
      const plan = parseObservationPreviewLens({ id: surface.id, input: surface.source, ...interpretation });
      const recipe = requireRecord(rasterInput);
      const { data, info } = await observationRaster({ input, plan, width: requireFiniteNumber(recipe.width), height: requireFiniteNumber(recipe.height) });
      pipeline = sharp(data, { raw: info }).resize(minimapResize(nearest));
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
  const shell=controls?.lenses ? parsePreviewControls(controls.lenses).controls : [];
  assertSurfacePreviewCoverage(shell.filter(lens => !excluded.includes(lens.id)), images,
    [...(lenses ? parsePreviewControls(lenses).controls : []), ...(bindings ? parsePreviewControls(bindings).controls : [])]);
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
