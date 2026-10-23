import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { cameraPoseToReferenceFrame, presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { PreparedCssVolume, PreparedVolumeLeaf } from '@cssearth/objects';
import { axisWeights, preparedVolumeCameraTransform } from '../../../renderer/src/volume/prepared-volume-projection.ts';
import { mergedOpticalOpacity } from '../../../renderer/src/volume/optical-opacity.ts';
import { cylindricalSideTransform } from '../../../renderer/src/volume/cylindrical-far-plane.ts';
import { decodeLightImage, integratedStackLight, projectLightImage } from './galaxy-far-projection.mts';

export function galaxyFarPublication(volume: PreparedCssVolume, azimuth: number, elevation: number) {
  const phi = azimuth, theta = Math.PI / 2 - elevation;
  const distance = 6.25 * Math.max(...volume.frame.boundsUnits.max.map((value, i) => value - volume.frame.boundsUnits.min[i]!));
  const centre = volume.frame.boundsUnits.min.map((value, i) => (value + volume.frame.boundsUnits.max[i]!) / 2);
  const direction = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
  const positionM = centre.map((value, i) => (value + distance * direction[i]!) * volume.frame.metersPerUnit);
  const orientationXyzw = [-Math.sin(phi) * Math.sin(theta / 2), Math.cos(phi) * Math.sin(theta / 2), 0, Math.cos(theta / 2)] as const;
  return { world: { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
    pose: cameraPoseToReferenceFrame({ positionM: [positionM[0]!, positionM[1]!, positionM[2]!], orientationXyzw }, volume.frame) },
  viewport: { widthPixels: 1440, heightPixels: 900, focalPixels: 900, principalOffsetPixels: [0, 0] as const } };
}

type Projected = ReturnType<typeof projectLightImage>;
/** Independent RGBA bake quadrature, with premultiplied bilinear sampling and physical back-to-front order. */
function sample(image: Projected, sx: number, sy: number, focal: number): readonly number[] {
  const { u, v, c, leaf, pixels } = image;
  const a = focal * u[0]! + sx * u[2]!, b = focal * v[0]! + sx * v[2]!;
  const d = focal * u[1]! + sy * u[2]!, e = focal * v[1]! + sy * v[2]!;
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-10) return [0, 0, 0, 0];
  const rx = sx * (focal - c[2]!) - focal * c[0]!, ry = sy * (focal - c[2]!) - focal * c[1]!;
  const x = (rx * e - b * ry) / det, y = (a * ry - rx * d) / det;
  if (x < 0 || y < 0 || x >= leaf.widthPx || y >= leaf.heightPx) return [0, 0, 0, 0];
  const tx = Math.max(0, Math.min(leaf.widthPx - 1, x - .5)), ty = Math.max(0, Math.min(leaf.heightPx - 1, y - .5));
  const ix = Math.floor(tx), iy = Math.floor(ty), fx = tx - ix, fy = ty - iy;
  const result = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
    const offset = (Math.min(leaf.heightPx - 1, iy + j) * leaf.widthPx + Math.min(leaf.widthPx - 1, ix + i)) * 4;
    const alpha = pixels[offset + 3]! / 255 * weight;
    result[3] += alpha;
    for (let channel = 0; channel < 3; channel++) result[channel] += pixels[offset + channel]! * alpha;
  }
  return result;
}

export async function prepareCylindricalSide(volume: PreparedCssVolume, prepared: string) {
  const directory = pathToFileURL(resolve(prepared) + '/');
  const slabs = await Promise.all(['x', 'y'].map(axis => Promise.all(volume.stacks.find(stack => stack.axis === axis)!.leaves.map(leaf => decodeLightImage(leaf, directory)))));
  const centre = volume.frame.boundsUnits.min.map((value, i) => (value + volume.frame.boundsUnits.max[i]!) / 2);
  const span = Math.max(...volume.frame.boundsUnits.max.map((value, i) => value - volume.frame.boundsUnits.min[i]!));
  const width = 1024, height = 256, widthCss = span * 2.5 * 50, heightCss = span * .625 * 50;
  const texturePath = 'b30-far-planes/side.png', highTexturePath = 'b30-far-planes/side-high.png';
  const leaf: PreparedVolumeLeaf = { id: 'far-side', centerUnits: [centre[0]!, centre[1]!, centre[2]!], texturePath, widthPx: width, heightPx: height,
    style: { width: `${widthCss}px`, height: `${heightCss}px`, backgroundSize: `${widthCss}px ${heightCss}px`, backgroundPosition: '0px 0px',
      transform: `matrix3d(1,0,0,0,0,0,-1,0,0,1,0,0,${centre[1]! * 50 - widthCss / 2},${centre[0]! * 50},${centre[2]! * 50 + heightCss / 2},1)` } };
  const atlases = [new Uint8Array(width * height * 16 * 4), new Uint8Array(width * height * 16 * 4)];
  const coefficients: [number, number, number][][] = [];
  for (let index = 0; index < 16; index++) {
    const azimuth = index * Math.PI / 8, publication = galaxyFarPublication(volume, azimuth, 0);
    const strengths = axisWeights(presentPhysicalPoseInVolume(publication.world.pose, volume.frame), volume.stacks, volume.frame.boundsUnits);
    const sideTotal = strengths[0]!.weight + strengths[1]!.weight;
    const view = preparedVolumeCameraTransform(publication, volume.frame);
    const rotated = { ...leaf, style: { ...leaf.style, transform: cylindricalSideTransform(leaf, azimuth) } };
    const plane = projectLightImage({ leaf: rotated, pixels: new Uint8Array() }, view);
    const stacks = slabs.map(stack => stack.map(image => projectLightImage(image, view)).sort((a, b) => a.depth - b.depth));
    const frames: Uint8Array[] = [];
    for (const gain of [1, 3]) {
      const pixels = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const point = plane.c.map((value, i) => value + plane.u[i]! * (x + .5) + plane.v[i]! * (y + .5));
        const sx = view.focalPixels * point[0]! / (view.focalPixels - point[2]!), sy = view.focalPixels * point[1]! / (view.focalPixels - point[2]!);
        const rgb = [0, 0, 0];
        for (const [axis, stack] of stacks.entries()) {
          const weight = strengths[axis]!.weight / sideTotal;
          if (weight === 0) continue;
          const opacity = mergedOpticalOpacity(strengths[axis]!.opticalGain * gain), light = [0, 0, 0];
          for (const image of stack) {
            const value = sample(image, sx, sy, view.focalPixels), alpha = value[3]! * opacity;
            for (let channel = 0; channel < 3; channel++) light[channel] = value[channel]! * opacity + light[channel]! * (1 - alpha);
          }
          // Black-matted root source-over coefficients give these normalized linear shares (ceiling applied by runtime).
          for (let channel = 0; channel < 3; channel++) rgb[channel] += light[channel]! * weight;
        }
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(rgb[channel]!);
        pixels[offset + 3] = 255;
      }
      frames.push(pixels);
    }
    for (let level = 0; level < 2; level++) for (let y = 0; y < height; y++)
      atlases[level]!.set(frames[level]!.subarray(y * width * 4, (y + 1) * width * 4), (y * width * 16 + index * width) * 4);
    const samples: [number, number, number][] = [];
    for (const degrees of [...Array.from({ length: 16 }, (_, i) => i), 30, 60, 85, 90]) {
      const pub = galaxyFarPublication(volume, azimuth, degrees * Math.PI / 180), camera = preparedVolumeCameraTransform(pub, volume.frame);
      const strengths = axisWeights(presentPhysicalPoseInVolume(pub.world.pose, volume.frame), volume.stacks, volume.frame.boundsUnits);
      const sideTotal = strengths[0]!.weight + strengths[1]!.weight;
      if (sideTotal < 1e-10) { samples.push([degrees, 1, 0]); continue; }
      let target = 0;
      for (const [axis, stack] of slabs.entries()) if (strengths[axis]!.weight > 0)
        target += integratedStackLight(stack.map(image => projectLightImage(image, camera)), mergedOpticalOpacity(strengths[axis]!.opticalGain), camera.focalPixels, 2) * strengths[axis]!.weight / sideTotal;
      const [low, high] = frames.map(pixels => integratedStackLight([projectLightImage({ leaf: rotated, pixels }, camera)], 1, camera.focalPixels, 2));
      const normal = target < low! ? target / low! : 1;
      const bright = target > low! && high! > low! ? (target - low!) / (high! - low!) : 0;
      if (normal < 0 || normal > 1 || bright < 0 || bright > 1.001) throw new TypeError(`Side light outside baked endpoints at ${index}/${degrees}.`);
      samples.push([degrees, normal, Math.min(1, bright)]);
    }
    coefficients.push(samples);
    console.log('SIDE VIEW BAKED', index, 'of 16');
  }
  const resources = [];
  for (const [level, pixels] of atlases.entries()) {
    const path = level ? highTexturePath : texturePath;
    const bytes = await sharp(pixels, { raw: { width: width * 16, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(resolve(prepared, path), bytes);
    resources.push({ path, bytes: bytes.length, width: width * 16, height });
  }
  return { side: { leaf, highTexturePath, views: 16 as const, coefficients }, resources };
}
