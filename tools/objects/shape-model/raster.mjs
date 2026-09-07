import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster } from '../../../src/platform/prepare-solid-body-surface.mjs';
import { prepareGlbSurface } from './glb-surface.mjs';
import { packProjectiveSurfaceRaster } from '../../../src/platform/projective-surface-raster.mjs';

/** Preserve the illustrative base color under even flood illumination. */
export async function prepareModelRasters({ config, axes, publicDirectory, publicBase, sourceDirectory }) {
  const { width, height, latitudeSegments, longitudeSegments, poleSize } = config.mesh;
  const { pixels } = await prepareGlbSurface(resolve(sourceDirectory, config.surfaceModel), width, height);
  const emit = async (name, data, w, h) => {
    const bytes = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
    await writeFile(resolve(publicDirectory, name), bytes);
    return publicBase + name;
  };
  const projected = reprojectSolidBodySurfaceRaster(pixels, { width, height, latitudeSegments, longitudeSegments, seamOverlap: config.mesh.seamOverlap });
  const packed = packProjectiveSurfaceRaster(projected, { width, height, bandCount: latitudeSegments, gutter: height / latitudeSegments / 4 });
  const poles = prepareSolidBodyPoleRaster(pixels, { width, height, tileSize: poleSize,
    radius: config.displayRadius, polarRadius: config.displayRadius * axes[2] / axes[0], latitudeSegments });
  return {
    surface: await emit('surface.webp', packed.data, packed.packedWidth, packed.packedHeight),
    poles: await emit('poles.webp', poles, poleSize * 2, poleSize),
  };
}

export async function prepareRingRaster({ config, publicDirectory, publicBase }) {
  const width = 2048, height = 32, ring = config.ring;
  await sharp({ create: { width, height, channels: 4,
    background: { r: ring.displayValue, g: ring.displayValue, b: ring.displayValue, alpha: ring.displayOpacity } } })
    .webp({ lossless: true }).toFile(resolve(publicDirectory, 'ring.webp'));
  return { url: publicBase + 'ring.webp', width, height };
}

// A tiny schematic marker, generated from the same axes, not borrowed imagery.
export async function prepareModelMarker(axes) {
  const size = 64, pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + .5 - size / 2) / 29, dy = (y + .5 - size / 2) / (29 * axes[2] / axes[0]);
    if (dx * dx + dy * dy > 1) continue;
    const value = Math.round(110 + 105 * Math.sqrt(1 - dx * dx - dy * dy));
    pixels.set([value, value, value, 255], (y * size + x) * 4);
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).webp({ lossless: true }).toBuffer();
}
