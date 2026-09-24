import type { ShapeModelConfig } from './source.mts';
import sharp from 'sharp';
import { lambertAttenuationAtlas } from '../terrestrial-layers/lambert-atlas.mts';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster } from '../../../src/platform/prepare-solid-body-surface.mts';
import { packProjectiveSurfaceRaster } from '../../../src/platform/projective-surface-raster.mts';
import { loadDiscIntegratedColor } from '../observation/disc-integrated-color.mts';
import { prepareGlbSurface } from './glb-surface.mts';
interface OutputDirectories {publicDirectory:string;publicBase:string;}

function uniformSurface(width:number, height:number, [red, green, blue]:readonly number[]) {
  const data = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set([red!, green!, blue!, 255], offset);
  return data;
}

/** One base-color map per lens; view-dependent lighting is a separate prepared layer. A lens is a measured uniform
 * colour, the neutral gray display convention, or an illustration carried through a published model's own UVs. */
export async function prepareModelRasters({ config, axes, publicDirectory, publicBase, sourceDirectory, lensIds, readSource }:OutputDirectories & {config:ShapeModelConfig;axes:readonly number[];sourceDirectory:string;lensIds:readonly string[];readSource:(path:string)=>Promise<Buffer>}) {
  const { width, height, latitudeSegments, longitudeSegments, poleSize } = config.mesh;
  const surfaces = config.surfaces ?? [];
  if (surfaces.length ? surfaces.map(surface => surface.lens).join() !== lensIds.join() : lensIds.length !== 1)
    throw new TypeError(`${config.displayName}: shape surfaces must name the authored lenses in order.`);
  const emit = async (name:string, data:Buffer, w:number, h:number) => {
    const bytes = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
    await writeFile(resolve(publicDirectory, name), bytes);
    return publicBase + name;
  };
  const lenses = [];
  for (const [index, lensId] of lensIds.entries()) {
    const surface = surfaces[index];
    let pixels:Buffer, source;
    if (!surface) {
      // Without a surface the body shows the shared neutral gray (#808080 sRGB): a display convention, not a colour.
      pixels = uniformSurface(width, height, [128, 128, 128]); source = { neutral: true as const };
    } else if (surface.science.kind === 'disc-integrated-color') {
      // The published whole-disc colour and V geometric albedo, uniform over the body: one mean, no map.
      const color = await loadDiscIntegratedColor(readSource, surface.science, surface.source);
      pixels = uniformSurface(width, height, color.srgb);
      source = { discIntegratedColor: { source: surface.source, srgb: color.srgb, linearSrgb: color.linear, filterReflectance: color.reflectance } };
    } else if (surface.science.kind === 'glb-base-color') {
      // An illustration: the model's base-color texture through its own UVs. Not an observation; display coordinates are arbitrary.
      if (surface.science.model !== surface.source) throw new TypeError(`${config.displayName}/${lensId}: science.model must equal the surface source.`);
      await readSource(surface.source);
      const { pixels: model, ...modelSource } = await prepareGlbSurface(resolve(sourceDirectory, surface.source), width, height);
      pixels = model; source = { illustrativeModel: { source: surface.source, ...modelSource } };
    } else throw new TypeError(`${config.displayName}: unknown shape surface kind ${surface.science.kind}.`);
    const projected = reprojectSolidBodySurfaceRaster(pixels, { width, height, latitudeSegments, longitudeSegments, seamOverlap: config.mesh.seamOverlap });
    const packed = packProjectiveSurfaceRaster(projected, { width, height, bandCount: latitudeSegments, gutter: height / latitudeSegments / 4 });
    const poles = prepareSolidBodyPoleRaster(pixels, { width, height, tileSize: poleSize,
      radius: config.displayRadius, polarRadius: config.displayRadius * axes[2] / axes[0], latitudeSegments });
    // Sidebar images use the interpreted flat map, before face projection and gutters.
    const flat = sharp(pixels, { raw: { width, height, channels: 4 } });
    await flat.clone().resize({ width: 640, withoutEnlargement: true }).webp({ lossless: true })
      .toFile(resolve(publicDirectory, `${lensId}-map.webp`));
    await flat.clone().resize(48, 48).webp({ lossless: true })
      .toFile(resolve(publicDirectory, `${lensId}-thumbnail.webp`));
    const map = { url: publicBase + `${lensId}-map.webp`, width: Math.min(width, 640), height: Math.round(height * Math.min(width, 640) / width) };
    lenses.push({ id: lensId, source, map, textures: {
      surface: await emit(`surface-${lensId}.webp`, packed.data, packed.packedWidth, packed.packedHeight),
      poles: await emit(`poles-${lensId}.webp`, poles, poleSize * 2, poleSize),
    } });
  }
  return lenses;
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
