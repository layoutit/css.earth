import type {RasterImage} from '../objects/observation/raster.mts';
import type {SurfacePreviewDirectories} from './surface-preview-source.mts';
import {optionalPreviewJson as optionalJson,parsePreviewControls,parsePolarPreview,parseObservedPreview,parseSpectralPreview,parseGeometryPreview} from './surface-preview-source.mts';
import {parsePagedProfile} from '../objects/paged-ellipsoid/profile-source.mts';
import {requireRecord} from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import { createProjectiveSurfaceRasterLayout } from '../../src/platform/projective-surface-raster.mts';
import { latitudeRasterBands } from '../objects/giant-layers/geometry.mts';
import { preparePagedSurfaceMap } from '../objects/paged-ellipsoid/assets.mts';

// Reverse only the declared lossless packing, before downsizing. Unrepresented
// polar rows stay transparent; a polar sprite is not an equirectangular map.
export function unpackSurfacePreview({ data, info }:RasterImage, options:Parameters<typeof createProjectiveSurfaceRasterLayout>[0]) {
  const layout = createProjectiveSurfaceRasterLayout(options);
  if (info.width !== layout.packedWidth || info.height !== layout.packedHeight || info.channels !== 4) {
    throw new Error('Surface preview packing does not match the prepared image.');
  }
  const output = Buffer.alloc(layout.width * layout.height * 4);
  for (const band of layout.bands) for (let row = 0; row < band.height; row++) {
    const from = ((band.packedY + band.height - 1 - row) * info.width + layout.gutter) * 4;
    const to = (band.y + row) * layout.width * 4;
    data.copy(output, to, from, from + layout.width * 4);
  }
  return { data: output, info: { width: layout.width, height: layout.height, channels: 4 as const } };
}

export function assertSurfacePreviewCoverage(controls:readonly {id:string;volume?:unknown}[], images:readonly {id:string}[], bindings:readonly {id:string;view?:string;overlayId?:string}[] = []) {
  const available = new Set(images.map(image => image.id));
  const nonSurface = new Set(bindings.filter(lens => lens.view === 'interior' || lens.overlayId).map(lens => lens.id));
  // A dataset that names a companion cloud draws no surface of its own; it borrows one, and that one has a preview.
  const missing = controls.filter(lens => (lens.volume === undefined || (lens.volume as { surface?: string }).surface === lens.id)
    && !available.has(lens.id) && !nonSurface.has(lens.id));
  if (missing.length) throw new Error(`Missing prepared surface previews: ${missing.map(lens => lens.id).join(', ')}`);
}

/** Small previews for preparation recipes that do not publish surfaces.json. */
export async function* recipeSurfacePreviews({ objectDirectory, publicDirectory, outputDirectory }:SurfacePreviewDirectories) {
  const config = (name:string) => optionalJson(resolve(objectDirectory, 'source/preparation', `${name}.json`));
  const [rawObservations, rawPaged, rawSpectral, rawGeometry, rawLenses] = await Promise.all([
    ...['observations', 'paged-ellipsoid', 'surface', 'geometry'].map(config),
    optionalJson(resolve(outputDirectory, 'lenses.json')),
  ]);
  // One-channel grayscale maps are expanded to sRGB before the RGBA unpacking.
  const read = async (file:string) => {
    const image = sharp(resolve(publicDirectory, basename(file))), { channels = 3 } = await image.metadata();
    return (channels < 3 ? image.toColourspace('srgb') : image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  };
  const packed = async (file:string, layout:Parameters<typeof createProjectiveSurfaceRasterLayout>[0]) => unpackSurfacePreview(await read(file), layout);
  if (rawObservations?.schema === 'cssearth-observed-polar-surfaces@1') {
    const observations=parsePolarPreview(rawObservations);
    const width = observations.dimensions.width * 2, height = observations.dimensions.height * 2;
    const layout = { width, height, bands: latitudeRasterBands(observations.packing.latitudeBoundsDegrees, height), gutter: observations.packing.gutter * 2 };
    for (const lens of observations.lenses) yield { id: lens.id, raster: await packed(lens.files.surface2x, layout) };
  }
  if (rawObservations?.schema === 'cssearth-observed-surfaces@1') {
    const observations=parseObservedPreview(rawObservations);
    for (const lens of observations.lenses) {
      const product = lens.products.find(p => p.kind === 'surface' && p.filename.includes('@2x')) ?? lens.products.find(p => p.kind === 'surface');
      if(!product)throw new TypeError("Observed preview requires a surface product.");
      const image = await read(product.filename);
      // Only the drawn surface product carries packing; projection and alpha products of the same lens do not.
      if (!product.packing) throw new TypeError("Observed preview surface product requires its packing.");
      const { bandCount, gutter } = product.packing;
      const width = image.info.width - 2 * gutter, height = image.info.height - 2 * gutter * bandCount;
      yield { id: lens.id, raster: unpackSurfacePreview(image, { width, height, bandCount, gutter }) };
    }
  }
  if (rawPaged?.schema === 'cssearth-paged-ellipsoid@1') {
    const paged=parsePagedProfile(rawPaged),lenses=parsePreviewControls(rawLenses);
    for (const map of paged.surface.maps) {
      const lens = lenses.controls.find(l => l.thumbnailUrl === `${paged.publicBase}${map.thumbnail}`);
      if (!lens) throw new Error(`Surface preview has no dataset: ${map.name}`);
      // A small preview wants the canonical adjusted map, the one the README
      // says every Earth view shares, not the untouched source grid the page
      // bake samples per output coordinate.
      yield { id: lens.id, raster: await preparePagedSurfaceMap({ config: paged, sourceDirectory: resolve(objectDirectory, 'source'), map: { ...map, nativePhotographicSampling: false } }) };
    }
  }
  if (rawSpectral?.schema === 'cssearth-spectral-material-variants@1') {
    const spectral=parseSpectralPreview(rawSpectral),geometry=parseGeometryPreview(rawGeometry);
    const p = geometry.parameters, cell = p.planetRasterCellSize;
    const normal = spectral.descriptor.controls.find(l => l.surfaceUrl && l.view !== 'interior');
    if(!normal?.surfaceUrl)throw new TypeError("Spectral preview requires its normal surface.");
    yield { id: normal.id, raster: await packed(normal.surfaceUrl, { width: p.longitudeSegments * cell, height: p.latitudeSegments * cell, bandCount: p.latitudeSegments, gutter: cell / 4 }) };
    const { body2xWidth: width, body2xHeight: height, latitudeBandCount: bandCount } = spectral.parameters;
    for (const lens of spectral.lenses) yield { id: lens.id, raster: await packed(`${spectral.namespace}-surface-${lens.id}@2x.webp`, { width, height, bandCount, gutter: height / bandCount / 4 }) };
  }
}
