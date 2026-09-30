/** Offline RGBA support sprites. Rectangles only pack masks; they never define structure support. */
import type { StructureRegion } from '@cssearth/nebula-reconstruction/evidence/wavelets';

export interface AtlasRegion {
  id: string; scale: number; morphology: StructureRegion['morphology'];
  bounds: { x: number; y: number; width: number; height: number };
  centroid: [number, number]; areaPixels: number; contrast: number; elongation: number;
  atlas: { index: number; x: number; y: number; width: number; height: number }; parentId?: string;
}
interface Placement { region: StructureRegion; x: number; y: number; width: number; height: number; index: number }

export function createSupportAtlases(regions: StructureRegion[], width: number, height: number, edge = 2048) {
  if (![width, height, edge].every(n => Number.isInteger(n) && n > 0) || width > edge - 4 || height > edge - 4 || edge > 4096)
    throw new TypeError('Bounded full image and atlas sizes required.');
  const padding = 2, placements: Placement[] = [], pageHeights: number[] = [];
  let x = padding, y = padding, shelfHeight = 0, index = 0;
  for (const region of [...regions].sort((a, b) => (b.bounds.maxY - b.bounds.minY) - (a.bounds.maxY - a.bounds.minY) || a.id.localeCompare(b.id))) {
    const w = region.bounds.maxX - region.bounds.minX + 1, h = region.bounds.maxY - region.bounds.minY + 1;
    if (w < 1 || h < 1 || w > width || h > height || region.support.length === 0) throw new TypeError('Invalid region support bounds.');
    if (x + w + padding > edge) { x = padding; y += shelfHeight + padding; shelfHeight = 0; }
    if (y + h + padding > edge) { index++; x = padding; y = padding; shelfHeight = 0; }
    placements.push({ region, x, y, width: w, height: h, index });
    x += w + padding; shelfHeight = Math.max(shelfHeight, h); pageHeights[index] = Math.max(pageHeights[index] ?? 0, y + h + padding);
  }
  const pages = pageHeights.map(h => ({ width: edge, height: h, pixels: Buffer.alloc(edge * h * 4) }));
  const catalog: AtlasRegion[] = [];
  for (const placement of placements) {
    const { region, index, x, y, width: w, height: h } = placement, page = pages[index]!;
    const support = new Set(region.support);
    for (const pixel of region.support) {
      const px = pixel % width, py = Math.floor(pixel / width);
      if (pixel >= width * height || px < region.bounds.minX || px > region.bounds.maxX || py < region.bounds.minY || py > region.bounds.maxY)
        throw new TypeError('Region support leaves its actual raster bounds.');
      const boundary = px === 0 || py === 0 || px === width - 1 || py === height - 1 ||
        !support.has(pixel - 1) || !support.has(pixel + 1) || !support.has(pixel - width) || !support.has(pixel + width);
      const p = ((y + py - region.bounds.minY) * page.width + x + px - region.bounds.minX) * 4;
      page.pixels.set([72, 220, 255, boundary ? 210 : 56], p);
    }
    catalog.push({ id: region.id, scale: region.scale, morphology: region.morphology,
      bounds: { x: region.bounds.minX, y: region.bounds.minY, width: w, height: h },
      centroid: [region.centroid[0] + .5, region.centroid[1] + .5], areaPixels: region.support.length,
      contrast: region.peakCoefficient, elongation: Math.max(1, region.axisLengths[0] / Math.max(.5, region.axisLengths[1])),
      atlas: { index, x, y, width: w, height: h }, ...(region.parentId ? { parentId: region.parentId } : {}) });
  }
  catalog.sort((a, b) => a.scale - b.scale || a.id.localeCompare(b.id));
  return { pages, regions: catalog };
}
