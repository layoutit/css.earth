import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';
import { sha256 } from '@cssearth/core/node';
import type { VolumeSlices, VolumeSliceQuad } from '@cssearth/volume-core/contracts/volume-slices';
import type { VolumeRecipe, Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import { compileCssVolume } from '../../renderers/css/preparation/volume.js';
import type { PreparedCssVolume } from '../../renderers/css/volume/types.js';

/** Display support only: preserve the original colors and split each slab's optical depth. */
export function coreSupport(position: readonly number[], fadeStart: number, radius: number): number {
  const t = Math.max(0, Math.min(1, (Math.hypot(...position) - fadeStart) / (radius - fadeStart)));
  return 1 - t * t * (3 - 2 * t);
}

/** Collapse outer Z slabs onto their physical midplane; retain original sampling in the bulge. */
export async function prepareFixedDiscVolume({ volume, slices, recipe, outputDirectory, readResource }: {
  volume: PreparedCssVolume; slices: VolumeSlices; recipe: VolumeRecipe; outputDirectory: string;
  readResource?: (path: string) => Promise<Uint8Array>;
}): Promise<PreparedCssVolume> {
  const support = recipe.hybrid;
  if (!support) return volume;
  const read = readResource ?? (path => readFile(resolve(outputDirectory, path)));
  const { min, max } = slices.boundsUnits, size = recipe.bake.imageWidth;
  const height = Math.round(size * (max[1] - min[1]) / (max[0] - min[0]));
  const disc = new Float64Array(size * height * 4), quads: VolumeSliceQuad[] = [];
  const write = async (quad: Omit<VolumeSliceQuad, 'sha256' | 'bytes'>, rgba: Uint8Array) => {
    const bytes = await sharp(rgba, { raw: { width: quad.widthPx, height: quad.heightPx, channels: 4 } }).png().toBuffer();
    const target = resolve(outputDirectory, quad.texturePath);
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
    const result = { ...quad, sha256: sha256(bytes), bytes: bytes.length }; quads.push(result); return result;
  };
  // Z index increases away from the far side of the prepared +Z view: ordinary source-over keeps its original order.
  for (const quad of slices.quads) {
    if (quad.alphaCoverage === 0) continue;
    const bytes = await read(quad.texturePath);
    if (bytes.byteLength !== quad.bytes || sha256(bytes) !== quad.sha256) throw new TypeError(`Source slice identity mismatch: ${quad.texturePath}`);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== quad.widthPx || info.height !== quad.heightPx) throw new TypeError('Source slice dimensions differ.');
    const v0 = quad.vertices[0]!, u = quad.vertices[1]!.map((n, axis) => n - v0[axis]!) as Vector3;
    const v = quad.vertices[3]!.map((n, axis) => n - v0[axis]!) as Vector3;
    const point = (x: number, y: number): Vector3 => v0.map((n, axis) => n + u[axis]! * x / info.width + v[axis]! * y / info.height) as Vector3;
    const core = Buffer.from(data);
    let left = info.width, top = info.height, right = -1, bottom = -1, nonzero = 0;
    const offsetX = Math.round((v0[0] - min[0]) * size / (max[0] - min[0]));
    const offsetY = Math.round((max[1] - v0[1]) * height / (max[1] - min[1]));
    if (quad.axis === 'z') {
      const pixelX = (max[0] - min[0]) / size, pixelY = (max[1] - min[1]) / height;
      if (Math.abs(u[0] / info.width - pixelX) > 1e-8 || Math.abs(v[1] / info.height + pixelY) > 1e-8 ||
          Math.abs(v0[0] - min[0] - offsetX * pixelX) > 1e-8 || Math.abs(max[1] - v0[1] - offsetY * pixelY) > 1e-8)
        throw new TypeError('Disc source pixels must preserve the model XY sampling grid.');
    }
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4, alpha = data[i + 3]! / 255;
      const weight = coreSupport(point(x + .5, y + .5), support.fadeStartUnits, support.coreRadiusUnits);
      core[i + 3] = Math.round(255 * (1 - (1 - alpha) ** weight));
      if (core[i + 3]) { nonzero++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      if (quad.axis === 'z') {
        const dx = offsetX + x, dy = offsetY + y;
        if (dx < 0 || dy < 0 || dx >= size || dy >= height) throw new TypeError('Disc source pixel escapes its physical bounds.');
        const p = (dy * size + dx) * 4, outer = 1 - (1 - alpha) ** (1 - weight);
        for (let channel = 0; channel < 3; channel++) disc[p + channel] = data[i + channel]! / 255 * outer + disc[p + channel]! * (1 - outer);
        disc[p + 3] = outer + disc[p + 3]! * (1 - outer);
      }
    }
    if (!nonzero) continue;
    const widthPx = right - left + 1, heightPx = bottom - top + 1;
    const cropped = await sharp(core, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left, top, width: widthPx, height: heightPx }).raw().toBuffer();
    await write({ ...quad, texturePath: `core/slices/${quad.axis}/${quad.sliceIndex}.png`, widthPx, heightPx,
      vertices: [point(left, top), point(right + 1, top), point(right + 1, bottom + 1), point(left, bottom + 1)],
      center: point((left + right + 1) / 2, (top + bottom + 1) / 2), alphaCoverage: nonzero / (widthPx * heightPx) }, cropped);
  }
  const rgba = Buffer.alloc(size * height * 4);
  let discPixels = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    const alpha = disc[p + 3]!; rgba[p + 3] = Math.round(alpha * 255);
    if (rgba[p + 3]) discPixels++;
    if (alpha > 0) for (let c = 0; c < 3; c++) rgba[p + c] = Math.round(disc[p + c]! / alpha * 255);
  }
  const plane = await write({ id: 'outer-disc', axis: 'z', sliceIndex: -1, texturePath: 'outer-disc.png', widthPx: size, heightPx: height,
    vertices: [[min[0], max[1], 0], [max[0], max[1], 0], [max[0], min[1], 0], [min[0], min[1], 0]],
    uvs: [[0,0],[1,0],[1,1],[0,1]], center: [(min[0]+max[0])/2,(min[1]+max[1])/2,0], normal: [0,0,-1], alphaCoverage: discPixels / (size * height) }, rgba);
  const compiled = compileCssVolume({ id: volume.id, frame: volume.frame, recipe, slices: { ...slices, quads } });
  const sourcePaths = new Set(slices.quads.map(quad => quad.texturePath));
  return { ...volume, stacks: compiled.stacks.map(stack => ({ ...stack, leaves: stack.leaves.filter(leaf => leaf.id !== plane.id) })),
    detailPlanes: compiled.stacks.flatMap(stack => stack.leaves.filter(leaf => leaf.id === plane.id)),
    resources: [...compiled.resources, ...volume.resources.filter(resource => !sourcePaths.has(resource.path))],
    approximation: { source: volume.approximation, hybrid: support,
      method: 'Original prepared slab colors; complementary optical-depth support. Outer Z slabs composite onto the original model XY plane at z=0.',
      limitations: ['The outer disk is flat; it loses thickness, vertical parallax and depth ordering with the bulge.'] } };
}
