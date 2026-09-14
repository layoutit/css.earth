import type {ShapeModelConfig} from './source.mts';
interface OutputDirectories {publicDirectory:string;publicBase:string;}
import sharp from 'sharp';
import { lambertAttenuationAtlas } from '../terrestrial-layers/solid-raster.mts';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster } from '../../../src/platform/prepare-solid-body-surface.mts';
import { prepareGlbSurface } from './glb-surface.mts';
import { packProjectiveSurfaceRaster } from '../../../src/platform/projective-surface-raster.mts';

/** Preserve the illustrative base color; view-dependent lighting is a separate prepared layer. */
export async function prepareModelRasters({ config, axes, publicDirectory, publicBase, sourceDirectory, lensId }:OutputDirectories & {config:ShapeModelConfig;axes:readonly number[];sourceDirectory:string;lensId?:string}) {
  const { width, height, latitudeSegments, longitudeSegments, poleSize } = config.mesh;
  const { pixels, ...source } = await prepareGlbSurface(resolve(sourceDirectory, config.surfaceModel), width, height);
  const emit = async (name:string, data:Buffer, w:number, h:number) => {
    const bytes = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
    await writeFile(resolve(publicDirectory, name), bytes);
    return publicBase + name;
  };
  const projected = reprojectSolidBodySurfaceRaster(pixels, { width, height, latitudeSegments, longitudeSegments, seamOverlap: config.mesh.seamOverlap });
  const packed = packProjectiveSurfaceRaster(projected, { width, height, bandCount: latitudeSegments, gutter: height / latitudeSegments / 4 });
  const poles = prepareSolidBodyPoleRaster(pixels, { width, height, tileSize: poleSize,
    radius: config.displayRadius, polarRadius: config.displayRadius * axes[2] / axes[0], latitudeSegments });
  // Sidebar images use the interpreted flat map, before face projection and gutters.
  let map;
  if (lensId) {
    const flat = sharp(pixels, { raw: { width, height, channels: 4 } });
    await flat.clone().resize({ width: 640, withoutEnlargement: true }).webp({ lossless: true })
      .toFile(resolve(publicDirectory, `${lensId}-map.webp`));
    await flat.clone().resize(48, 48).webp({ lossless: true })
      .toFile(resolve(publicDirectory, `${lensId}-thumbnail.webp`));
    map = { url: publicBase + `${lensId}-map.webp`, width: Math.min(width, 640), height: Math.round(height * Math.min(width, 640) / width) };
  }
  return { source, map, textures: {
    surface: await emit('surface.webp', packed.data, packed.packedWidth, packed.packedHeight),
    poles: await emit('poles.webp', poles, poleSize * 2, poleSize),
  } };
}

export async function prepareRingRaster({ config, publicDirectory, publicBase }:OutputDirectories & {config:ShapeModelConfig}) {
  const width = 2048, height = 32, ring = config.ring;
  if(!ring)throw new TypeError("Ring raster needs an authored ring.");
  await sharp({ create: { width, height, channels: 4,
    background: { r: ring.displayValue, g: ring.displayValue, b: ring.displayValue, alpha: ring.displayOpacity } } })
    .webp({ lossless: true }).toFile(resolve(publicDirectory, 'ring.webp'));
  return { url: publicBase + 'ring.webp', width, height };
}

// A tiny schematic marker, generated from the same axes, not borrowed imagery.
export async function prepareSphereLighting({ publicDirectory, publicBase }:OutputDirectories) {
  const size = 512;
  const atlas = lambertAttenuationAtlas({ frameSize: size, columns: 2, frameCount: 2,
    terminatorWidth: .1, directionalAmbient: .05, fullPhaseAmbient: .35,
    fullPhaseDiffuse: .65, maximumOpacity: .95 });
  await sharp(atlas.pixels, { raw: { width: atlas.width, height: atlas.height, channels: 4 } })
    .extract({ left: size, top: 0, width: size, height: size })
    .webp({ lossless: true }).toFile(resolve(publicDirectory, 'lighting.webp'));
  return publicBase + 'lighting.webp';
}
