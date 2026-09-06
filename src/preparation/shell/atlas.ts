/** RGBA triangle coverage and source-lighting samples, baked without browser APIs. */
import sharp from 'sharp';
import type { ShellRecipe } from './config.js';

export function shellRim(facing: number, fadeFacing: number): number {
  const t = Math.max(0, Math.min(1, facing / fadeFacing));
  return (1 - Math.max(0, Math.min(1, facing))) * t * t * (3 - 2 * t);
}
function srgbByte(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
}
export async function prepareShellAtlas(recipe: ShellRecipe): Promise<{ png: Buffer; width: number; height: number }> {
  const { tileSize, columns, frames } = recipe.atlas, rows = Math.ceil(frames / columns);
  const width = tileSize * columns, height = tileSize * rows, rgba = Buffer.alloc(width * height * 4);
  for (let frame = 0; frame < frames; frame++) {
    const rim = shellRim(frame / (frames - 1), recipe.material.rimFadeFacing);
    const rgb = recipe.material.colorLinear.map(channel => srgbByte(channel * rim));
    const ox = frame % columns * tileSize, oy = Math.floor(frame / columns) * tileSize;
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      // Exact pixel-area integration for this grid-aligned right triangle.
      const coverage = x + y < tileSize - 1 ? 1 : x + y === tileSize - 1 ? 0.5 : 0;
      const at = ((oy + y) * width + ox + x) * 4;
      rgba[at] = rgb[0]!; rgba[at + 1] = rgb[1]!; rgba[at + 2] = rgb[2]!;
      rgba[at + 3] = Math.round(255 * recipe.material.opacity * rim * coverage);
    }
  }
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  return { png, width, height };
}
