import type { CurvatureMaterial } from "./contracts.mts";
import sharp from 'sharp';
import { resolve } from 'node:path';
export async function writeCurvatureMaterial({ publicDirectory, material, density }: {publicDirectory: string; material: CurvatureMaterial; density: number}) {
  const size = material.frameSize * density;
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * material.radiusScale;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / radius;
      const ny = (y - center) / radius;
      const radialSquared = nx * nx + ny * ny;
      if (radialSquared > 1) continue;
      const normalZ = Math.sqrt(1 - radialSquared);
      const illumination = material.limbFloor +
        normalZ * (1 - material.limbFloor);
      pixels[(y * size + x) * 4 + 3] = Math.round(
        Math.max(0, Math.min(1, 1 - illumination)) * 255,
      );
    }
  }
  const suffix = density === 2 ? "@2x" : "";
  await sharp(pixels, {
    raw: { width: size, height: size, channels: 4 },
  }).webp({ lossless: true, alphaQuality: 100 }).toFile(resolve(
    publicDirectory,
    `${material.output}${suffix}.webp`,
  ));
}

