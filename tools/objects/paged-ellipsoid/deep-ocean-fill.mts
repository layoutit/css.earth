import { resolve } from 'node:path';
import sharp from 'sharp';
import type { RasterInfo } from '../observation/raster.mts';

// NASA replaced deep ocean in the plain Blue Marble Next Generation editions
// with one arbitrary reflectance instead of an observation (Stoeckli et al.
// 2005, section 2.4). Those pixels carry no measurement, so a declared second
// edition of the same month may supply them. The rule reads the plain source
// value: only pixels that carry the stated constant are replaced, and the
// weight fades to zero at the edge of that region so the replacement never
// changes an observed pixel and never leaves a step where the two meet.
export interface DeepOceanFillRecipe {
  path: string;
  replacedColor: readonly [number, number, number];
  tolerance: number;
  blendSourcePixels: number;
}
export interface DeepOceanFillSource extends RasterInfo {
  data: Uint8Array;
  /** Replacement weight, 0 to 255, on the plain source grid. */
  weight: Uint8Array;
  channels: 3;
  recipe: DeepOceanFillRecipe;
  /** Area-weighted share of the sphere the selection covers, for provenance. */
  selectedSphereShare: number;
}
export interface ResizedDeepOceanFill extends RasterInfo {data: Buffer; weight: Buffer; channels: 3}

const CHAMFER_ORTHOGONAL = 3, CHAMFER_DIAGONAL = 4;
const cache = new Map<string, Promise<DeepOceanFillSource>>();

export function parseDeepOceanFillRecipe(value: unknown): DeepOceanFillRecipe {
  const candidate = value as Partial<DeepOceanFillRecipe> | null;
  const color = candidate?.replacedColor;
  if (!candidate || typeof candidate.path !== 'string' || !candidate.path ||
      !Array.isArray(color) || color.length !== 3 ||
      color.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255) ||
      !Number.isInteger(candidate.tolerance) || candidate.tolerance! < 0 || candidate.tolerance! > 32 ||
      !Number.isInteger(candidate.blendSourcePixels) || candidate.blendSourcePixels! < 0 || candidate.blendSourcePixels! > 512) {
    throw new TypeError('Invalid deep ocean fill replacement recipe.');
  }
  return { path: candidate.path, replacedColor: [color[0], color[1], color[2]],
    tolerance: candidate.tolerance!, blendSourcePixels: candidate.blendSourcePixels! };
}

/**
 * Decode the declared second edition and measure the replacement weight on the
 * plain grid. One object's preparation reads the same pair repeatedly, for the
 * atlas pages, the pole atlas, the cutaway exterior and the small previews, so
 * the measured result is kept for the process. Callers that already hold the
 * decoded plain grid pass it; the others decode it once here.
 */
export function readDeepOceanFill(sourceDirectory: string, recipe: DeepOceanFillRecipe,
  plainPath: string, plain?: RasterInfo & {data: Uint8Array}): Promise<DeepOceanFillSource> {
  const path = resolve(sourceDirectory, recipe.path), source = resolve(sourceDirectory, plainPath);
  const key = [path, source, recipe.replacedColor.join(','), recipe.tolerance, recipe.blendSourcePixels].join('|');
  const existing = cache.get(key);
  if (existing) return existing;
  const prepared = prepare(path, source, recipe, plain);
  cache.set(key, prepared);
  return prepared;
}

/** Release the decoded second edition once an object's preparation is complete. */
export function clearDeepOceanFillCache() { cache.clear(); }

const decode = (path: string) => sharp(path, { limitInputPixels: false, unlimited: true })
  .removeAlpha().raw().toBuffer({ resolveWithObject: true });

async function prepare(path: string, source: string, recipe: DeepOceanFillRecipe,
  supplied?: RasterInfo & {data: Uint8Array}): Promise<DeepOceanFillSource> {
  const plain = supplied ?? await decode(source);
  const decoded = 'info' in plain
    ? { data: plain.data, width: plain.info.width, height: plain.info.height, channels: plain.info.channels }
    : plain;
  const { data, info } = await decode(path);
  if (info.channels !== 3 || info.width !== decoded.width || info.height !== decoded.height ||
      decoded.channels !== 3 || data.length !== decoded.data.length) {
    throw new Error('The deep ocean fill replacement must be a complete RGB grid on the plain source grid.');
  }
  const { weight, selectedSphereShare } = measureReplacementWeight(recipe, decoded);
  return { data, weight, width: info.width, height: info.height, channels: 3, recipe, selectedSphereShare };
}

/** Resample the replacement and its weight onto a canonical map grid. */
export async function resizeDeepOceanFill(source: DeepOceanFillSource, width: number, height: number): Promise<ResizedDeepOceanFill> {
  const fit = { fit: 'fill', kernel: 'lanczos3' } as const;
  const [data, weight] = await Promise.all([
    sharp(source.data, { raw: { width: source.width, height: source.height, channels: 3 } })
      .resize(width, height, fit).raw().toBuffer(),
    sharp(source.weight, { raw: { width: source.width, height: source.height, channels: 1 } })
      .resize(width, height, fit).raw().toBuffer(),
  ]);
  return { data, weight, width, height, channels: 3 };
}

/** Mix the replacement into an already display-adjusted canonical map, in place. */
export function applyDeepOceanFill(base: Buffer, resized: ResizedDeepOceanFill, { width, height, channels }: RasterInfo) {
  if (resized.width !== width || resized.height !== height || base.length !== width * height * channels) {
    throw new Error('The deep ocean fill replacement does not match its canonical map grid.');
  }
  for (let pixel = 0; pixel < width * height; pixel++) {
    const alpha = resized.weight[pixel] / 255;
    if (alpha <= 0) continue;
    for (let channel = 0; channel < 3; channel++) {
      const target = pixel * channels + channel;
      base[target] = Math.round(base[target] * (1 - alpha) + resized.data[pixel * 3 + channel] * alpha);
    }
  }
  return base;
}

/** The plain edition carries the constant here, so the pixel holds no observation. */
function measureReplacementWeight(recipe: DeepOceanFillRecipe, plain: RasterInfo & {data: Uint8Array}) {
  const { width, height } = plain, pixels = width * height;
  const [red, green, blue] = recipe.replacedColor, { tolerance } = recipe;
  const limit = CHAMFER_ORTHOGONAL * recipe.blendSourcePixels + CHAMFER_DIAGONAL;
  const distance = new Uint16Array(pixels);
  let selectedWeight = 0, sphereWeight = 0;
  for (let y = 0; y < height; y++) {
    const latitudeWeight = Math.cos((0.5 - (y + 0.5) / height) * Math.PI);
    const base = y * width;
    let selectedInRow = 0;
    for (let x = 0; x < width; x++) {
      const offset = (base + x) * 3;
      if (Math.abs(plain.data[offset] - red) <= tolerance &&
          Math.abs(plain.data[offset + 1] - green) <= tolerance &&
          Math.abs(plain.data[offset + 2] - blue) <= tolerance) {
        distance[base + x] = limit;
        selectedInRow++;
      }
    }
    sphereWeight += latitudeWeight * width;
    selectedWeight += latitudeWeight * selectedInRow;
  }
  // Chamfer distance into the selected region, so the replacement weight rises
  // from nothing at the region's edge. Longitude wraps: each row closes its lap
  // over the blend width. Latitude does not wrap; the polar rows replicate.
  const tail = recipe.blendSourcePixels + 1;
  const pass = (fromRow: number, toRow: number, step: number) => {
    for (let y = fromRow; y !== toRow; y += step) {
      const base = y * width, neighbour = base - step * width;
      const across = y !== fromRow;
      if (step > 0) {
        for (let x = 0; x < width; x++) {
          const index = base + x;
          if (distance[index] === 0) continue;
          let best = distance[base + (x === 0 ? width - 1 : x - 1)] + CHAMFER_ORTHOGONAL;
          if (across) {
            const up = distance[neighbour + x] + CHAMFER_ORTHOGONAL;
            if (up < best) best = up;
            const left = distance[neighbour + (x === 0 ? width - 1 : x - 1)] + CHAMFER_DIAGONAL;
            if (left < best) best = left;
            const right = distance[neighbour + (x === width - 1 ? 0 : x + 1)] + CHAMFER_DIAGONAL;
            if (right < best) best = right;
          }
          if (best < distance[index]) distance[index] = best;
        }
        for (let lap = 0; lap < tail; lap++) {
          const x = lap % width, index = base + x;
          if (distance[index] === 0) continue;
          const best = distance[base + (x === 0 ? width - 1 : x - 1)] + CHAMFER_ORTHOGONAL;
          if (best < distance[index]) distance[index] = best;
        }
      } else {
        for (let x = width - 1; x >= 0; x--) {
          const index = base + x;
          if (distance[index] === 0) continue;
          let best = distance[base + (x === width - 1 ? 0 : x + 1)] + CHAMFER_ORTHOGONAL;
          if (across) {
            const down = distance[neighbour + x] + CHAMFER_ORTHOGONAL;
            if (down < best) best = down;
            const left = distance[neighbour + (x === 0 ? width - 1 : x - 1)] + CHAMFER_DIAGONAL;
            if (left < best) best = left;
            const right = distance[neighbour + (x === width - 1 ? 0 : x + 1)] + CHAMFER_DIAGONAL;
            if (right < best) best = right;
          }
          if (best < distance[index]) distance[index] = best;
        }
        for (let lap = 0; lap < tail; lap++) {
          const x = (width - 1 - lap % width + width) % width, index = base + x;
          if (distance[index] === 0) continue;
          const best = distance[base + (x === width - 1 ? 0 : x + 1)] + CHAMFER_ORTHOGONAL;
          if (best < distance[index]) distance[index] = best;
        }
      }
    }
  };
  pass(0, height, 1);
  pass(height - 1, -1, -1);
  const weight = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index++) {
    const progress = limit === 0 ? (distance[index] > 0 ? 1 : 0) : Math.min(1, distance[index] / (CHAMFER_ORTHOGONAL * recipe.blendSourcePixels));
    weight[index] = Math.round(255 * progress * progress * (3 - 2 * progress));
  }
  return { weight, selectedSphereShare: selectedWeight / sphereWeight };
}

