import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';
import { type VolumeSlices, type VolumeSliceQuad, type VolumeRecipe, type Vector3, type PreparedCssVolume } from '@cssearth/objects';

import { compileCssVolume } from '../volume-leaves/index.ts';

/** Display support only: preserve the original colors and split each slab's optical depth. */
export function coreSupport(position: readonly number[], fadeStart: number, radius: number): number {
  const t = Math.max(0, Math.min(1, (Math.hypot(...position) - fadeStart) / (radius - fadeStart)));
  return 1 - t * t * (3 - 2 * t);
}

/** Keep the bulge: each slab keeps its original colors and only the optical depth inside the core support, which
 * falls smoothly to zero at the core radius. The outer disc is not drawn. */
export async function prepareFixedDiscVolume({ volume, slices, recipe, outputDirectory, readResource }: {
  volume: PreparedCssVolume; slices: VolumeSlices; recipe: VolumeRecipe; outputDirectory: string;
  readResource?: (path: string) => Promise<Uint8Array>;
}): Promise<PreparedCssVolume> {
  const support = recipe.hybrid;
  if (!support) return volume;
  const read = readResource ?? (path => readFile(resolve(outputDirectory, path)));
  const quads: VolumeSliceQuad[] = [];
  const write = async (quad: Omit<VolumeSliceQuad, 'bytes'>, rgba: Uint8Array) => {
    const bytes = await sharp(rgba, { raw: { width: quad.widthPx, height: quad.heightPx, channels: 4 } }).png().toBuffer();
    const target = resolve(outputDirectory, quad.texturePath);
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
    quads.push({ ...quad, bytes: bytes.length });
  };
  for (const quad of slices.quads) {
    if (quad.alphaCoverage === 0) continue;
    const bytes = await read(quad.texturePath);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== quad.widthPx || info.height !== quad.heightPx) throw new TypeError(`Source slice dimensions differ: ${quad.texturePath}.`);
    const v0 = quad.vertices[0]!, u = quad.vertices[1]!.map((n, axis) => n - v0[axis]!) as Vector3;
    const v = quad.vertices[3]!.map((n, axis) => n - v0[axis]!) as Vector3;
    const point = (x: number, y: number): Vector3 => v0.map((n, axis) => n + u[axis]! * x / info.width + v[axis]! * y / info.height) as Vector3;
    const core = Buffer.from(data);
    let left = info.width, top = info.height, right = -1, bottom = -1, nonzero = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4, alpha = data[i + 3]! / 255;
      const weight = coreSupport(point(x + .5, y + .5), support.fadeStartUnits, support.coreRadiusUnits);
      core[i + 3] = Math.round(255 * (1 - (1 - alpha) ** weight));
      if (core[i + 3]) { nonzero++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    if (!nonzero) continue;
    const widthPx = right - left + 1, heightPx = bottom - top + 1;
    const cropped = await sharp(core, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left, top, width: widthPx, height: heightPx }).raw().toBuffer();
    await write({ ...quad, texturePath: `core/slices/${quad.axis}/${quad.sliceIndex}.png`, widthPx, heightPx,
      vertices: [point(left, top), point(right + 1, top), point(right + 1, bottom + 1), point(left, bottom + 1)],
      center: point((left + right + 1) / 2, (top + bottom + 1) / 2), alphaCoverage: nonzero / (widthPx * heightPx) }, cropped);
  }
  const compiled = compileCssVolume({ id: volume.id, frame: volume.frame, recipe, slices: { ...slices, quads } });
  const sourcePaths = new Set(slices.quads.map(quad => quad.texturePath));
  return { ...volume, stacks: compiled.stacks,
    resources: [...compiled.resources, ...volume.resources.filter(resource => !sourcePaths.has(resource.path))],
    approximation: { source: volume.approximation, hybrid: support,
      method: 'Original prepared slab colors; the optical depth inside the core support is kept, falling smoothly to zero at the core radius.',
      limitations: ['Only the bulge and the inner disc inside the core radius are drawn; the outer disc is omitted.'] } };
}
