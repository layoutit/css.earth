/** RGBA triangle coverage and source-lighting samples, baked without browser APIs. */
import sharp from 'sharp';
import type { ShellRecipe } from './config.ts';

export function shellRim(facing: number, fadeFacing: number): number {
  const t = Math.max(0, Math.min(1, facing / fadeFacing));
  return (1 - Math.max(0, Math.min(1, facing))) * t * t * (3 - 2 * t);
}
function srgbByte(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
}
/** Exact intersection of a source pixel square with the three authored triangle half-planes. */
export function shellTriangleCoverage(x: number, y: number, tileSize: number, inset: number): number {
  if (x + 1 <= inset || y + 1 <= inset || x + y >= tileSize) return 0;
  if (x >= inset && y >= inset && x + y + 2 <= tileSize) return 1;
  let polygon = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  for (const distance of [(p: number[]) => p[0]! - inset, (p: number[]) => p[1]! - inset,
    (p: number[]) => tileSize - p[0]! - p[1]!]) {
    const clipped: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!, da = distance(a), db = distance(b);
      if (da >= 0) clipped.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db); clipped.push([a[0]! + t * (b[0]! - a[0]!), a[1]! + t * (b[1]! - a[1]!)]);
      }
    }
    polygon = clipped;
  }
  return Math.abs(polygon.reduce((area, a, i) => {
    const b = polygon[(i + 1) % polygon.length]!; return area + a[0]! * b[1]! - a[1]! * b[0]!;
  }, 0)) / 2;
}
export async function prepareShellAtlas(recipe: ShellRecipe): Promise<{ png: Buffer; width: number; height: number }> {
  const { tileSize, columns, frames } = recipe.atlas, rows = Math.ceil(frames / columns);
  const width = tileSize * columns, height = tileSize * rows, rgba = Buffer.alloc(width * height * 4);
  const corners: [number, number, number][] = [];
  const levels = recipe.atlas.facingLevels;
  const inset = recipe.atlas.triangleInsetPixels ?? 0, triangleSize = tileSize - 2 * inset;
  if (levels) {
    for (let a = 0; a < levels.length; a++) for (let b = a; b < levels.length; b++) for (let c = b; c < levels.length; c++) {
      corners.push([levels[a]!, levels[b]!, levels[c]!]);
    }
  }
  for (let frame = 0; frame < frames; frame++) {
    const [a, b, c] = corners[frame] ?? [frame / (frames - 1), frame / (frames - 1), frame / (frames - 1)];
    const ox = frame % columns * tileSize, oy = Math.floor(frame / columns) * tileSize;
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      // Exact pixel-area integration for this grid-aligned right triangle.
      const coverage = shellTriangleCoverage(x, y, tileSize, inset);
      // Pixel-centre barycentric interpolation is continuous on shared triangle edges.
      const u = (x + .5 - inset) / triangleSize, v = (y + .5 - inset) / triangleSize;
      const rim = shellRim(a * (1 - u - v) + b * u + c * v, recipe.material.rimFadeFacing);
      const rgb = recipe.material.colorLinear.map(channel => srgbByte(channel * rim));
      const at = ((oy + y) * width + ox + x) * 4;
      rgba[at] = rgb[0]!; rgba[at + 1] = rgb[1]!; rgba[at + 2] = rgb[2]!;
      const opacity = recipe.material.opacity * rim;
      // All three image edges carry fractional coverage; their optical depths add
      // under ordinary source-over. Linear alpha*coverage leaves dark seams.
      rgba[at + 3] = Math.round(255 * (inset > 0 ? 1 - (1 - opacity) ** coverage : opacity * coverage));
    }
  }
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  return { png, width, height };
}
