import { readFitsPrimary } from '@cssearth/fits';
import { clamp } from '@cssearth/core';
/** Data-defined latitude/longitude/color mapping of a FITS observation map (moved from the retired static lane). Decoding
 * belongs to @cssearth/fits. */
export type FitsColor = {kind: 'signed-asinh'; palette: readonly (readonly number[])[]; softening: number; maximum: number}
  | {kind: 'positive-log'; palette: readonly (readonly number[])[]; range: readonly [number, number]};
export interface FitsMapRecipe {bitpix: number; width: number; height: number; latitude: 'sine-latitude' | 'equirectangular'; positiveOnly?: boolean; nearestLatitudeLimit: number; color: FitsColor;}
export function prepareFitsMap(bytes: Buffer, width: number, height: number, recipe: FitsMapRecipe) {
  const fits = readFitsPrimary(bytes);
  if (fits.bitpix !== recipe.bitpix || fits.width !== recipe.width || fits.height !== recipe.height) throw new Error('Pinned synoptic FITS geometry changed.');
  if (!['sine-latitude', 'equirectangular'].includes(recipe.latitude)) throw new TypeError('Unsupported synoptic latitude mapping.');
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const sourceY = recipe.latitude === 'sine-latitude'
      ? clamp(Math.round((Math.sin(latitude) + 1) / 2 * (fits.height - 1)), 0, fits.height - 1)
      : clamp(Math.round((1 - (y + 0.5) / height) * fits.height), 0, fits.height - 1);
    for (let x = 0; x < width; x++) {
      // Source columns run in increasing longitude, as the mesh places every atlas: east longitude grows from the left edge.
      const sourceX = modulo(Math.floor((x + 0.5) / width * fits.width), fits.width);
      const value = nearestValidValue(fits, sourceX, sourceY, recipe);
      const color = scientificFalseColor(value, recipe.color);
      const offset = (y * width + x) * 4;
      output.set(color, offset); output[offset + 3] = 255;
    }
  }
  return output;
}

export function scientificFalseColor(value: number, color: FitsColor): readonly number[] {
  if (color.kind === 'signed-asinh') {
    const [negative, neutral, positive] = color.palette;
    if (!Number.isFinite(value)) return neutral;
    const signed = clamp(Math.asinh(value / color.softening) / Math.asinh(color.maximum / color.softening), -1, 1);
    const end = signed < 0 ? negative : positive, amount = Math.abs(signed);
    return neutral.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  }
  if (color.kind !== 'positive-log') throw new TypeError('Unsupported scientific color transform.');
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const normalized = safe === 0 ? 0 : clamp((Math.log(safe) - Math.log(color.range[0])) / (Math.log(color.range[1]) - Math.log(color.range[0])), 0, 1);
  const scaled = normalized * (color.palette.length - 1), left = Math.min(color.palette.length - 2, Math.floor(scaled)), amount = scaled - left;
  return color.palette[left].map((channel, index) => Math.round(channel + (color.palette[left + 1][index] - channel) * amount));
}

function nearestValidValue(fits: ReturnType<typeof readFitsPrimary>, x: number, y: number, recipe: FitsMapRecipe) {
  const valid = (value: number) => Number.isFinite(value) && (!recipe.positiveOnly || value > 0);
  const direct = fits.values[y * fits.width + x];
  if (valid(direct)) return direct;
  for (let distance = 1; distance <= recipe.nearestLatitudeLimit; distance++) {
    for (const candidateY of [y - distance, y + distance]) {
      if (candidateY < 0 || candidateY >= fits.height) continue;
      const candidate = fits.values[candidateY * fits.width + x];
      if (valid(candidate)) return candidate;
    }
  }
  return 0;
}
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
