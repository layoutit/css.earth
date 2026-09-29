import sharp from 'sharp';
import type { InteriorComparison } from './compare-photographic-interiors.mts';

/** Evidence illustration only; stretches never feed registration or surfaces. */
export async function writeInteriorComparison(result: InteriorComparison, path: string) {
  sharp.concurrency(1); sharp.cache(false);
  const { width, height, actual, alignedActual, predicted, valid } = result.buffers;
  const samples = Array.from(valid.keys()).filter(index => valid[index] === 1);
  const range = (values: ArrayLike<number>) => {
    const sorted = samples.map(index => values[index]).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) throw new Error('No finite diagnostic samples.');
    return [sorted[0], sorted[Math.floor((sorted.length - 1) * .99)]];
  };
  const targetRange = range(actual), predictedRange = range(predicted);
  const rgb = Buffer.alloc(width * 3 * height * 3);
  const arrays = [actual, alignedActual, predicted];
  for (let panel = 0; panel < 3; panel++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x, value = arrays[panel][index], bounds = panel === 2 ? predictedRange : targetRange;
    const gray = Number.isFinite(value) ? Math.round(255 * Math.max(0, Math.min(1, (value - bounds[0]) / Math.max(Number.EPSILON, bounds[1] - bounds[0])))) : 0;
    const excluded = panel > 0 && !valid[index];
    rgb.set(excluded ? [30, 38, 46] : [gray, gray, gray], (y * width * 3 + panel * width + x) * 3);
  }
  const scale = 3, header = 44, footer = 52, w = width * 3 * scale, h = height * scale + header + footer;
  const raster = await sharp(rgb, { raw: { width: width * 3, height, channels: 3 } }).resize(width * 3 * scale, height * scale, { kernel: 'nearest' }).png().toBuffer();
  const boxes = [1, 2].flatMap(panel => result.regions.map(region => {
    const x = (panel * width + region.left - result.crop.left) * scale, y = (region.top - result.crop.top) * scale + header;
    return `<rect x="${x}" y="${y}" width="${(region.right - region.left + 1) * scale}" height="${(region.bottom - region.top + 1) * scale}" fill="none" stroke="${region.partition === 'fit' ? '#e5ae45' : '#50dacc'}" stroke-width="1"/>`;
  })).join('');
  const titles = ['Native target', 'Target after fitted translation', 'Reference projected through mesh'];
  const labels = titles.map((title, index) => `<text x="${index * width * scale + 12}" y="27">${title}</text>`).join('');
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g fill="#eef0f4" font-family="sans-serif" font-size="16">${labels}<text x="12" y="${h - 31}">Gold: fit regions. Cyan: independent holdouts. Blue-gray: excluded pixels.</text><text x="12" y="${h - 10}">Native pixels enlarged 3x; separate display stretches. Relative alignment, not absolute surface accuracy.</text></g>${boxes}</svg>`);
  await sharp({ create: { width: w, height: h, channels: 3, background: '#101419' } }).composite([
    { input: raster, left: 0, top: header }, { input: overlay, left: 0, top: 0 },
  ]).png().toFile(path);
}
