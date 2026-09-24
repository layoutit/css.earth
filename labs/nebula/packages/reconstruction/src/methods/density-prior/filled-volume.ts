import { validateBounds } from './bounds.ts';
/** Offline display-volume reconstruction from an exactly partitioned photograph. */
import type { FilledComponent, FilledComponentsResult } from './filled-components.ts';
import type { FilledVolumePart } from './filled-parts.ts';

export type * from './filled-contracts.ts';
import type {Vec3,Bounds3,NumericArray,FilledDepthPrior,FilledVolumeChannels,FilledVolumeOptions,FilledVolumeDiagnostics,FilledVolumeSampler} from './filled-contracts.ts';

interface Term { share: number; family: number; half: number; part: number }
interface Family { pixels: number[]; weight: number; x: number; y: number; mode?: number; offset: number }

const DEFAULT_CHANNELS: FilledVolumeChannels = { compact: true, diffuse: true, extended: true };
const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;
const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

/** C1, compact, exactly normalized quartic kernel. */
function quartic(z: number, center: number, half: number): number {
  const u = (z - center) / half;
  return Math.abs(u) >= 1 ? 0 : 15 / (16 * half) * (1 - u * u) ** 2;
}

function pixelPoint(pixel: number, width: number, height: number, bounds: Bounds3): [number, number] {
  const dx = (bounds.max[0] - bounds.min[0]) / width;
  const dy = (bounds.max[1] - bounds.min[1]) / height;
  return [bounds.min[0] + (pixel % width + .5) * dx,
    bounds.max[1] - (Math.floor(pixel / width) + .5) * dy];
}

function preparePrior(prior: FilledDepthPrior | undefined): {
  sample(x: number, y: number, z: number): number | undefined;
  addColumn(x: number, y: number, scores: Float64Array): void;
  planeSamples(selected: NumericArray, width: number, height: number, bounds: Bounds3,
    margin: number): Family[];
} {
  if (!prior) return { sample: () => undefined, addColumn: () => undefined, planeSamples: () => [] };
  const [nx, ny, nz] = prior.dimensions, normalized = new Float32Array(prior.density.length);
  const populated = new Uint8Array(nx * ny);
  const dz = (prior.boundsKpc.max[2] - prior.boundsKpc.min[2]) / nz;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    let sum = 0;
    for (let z = 0; z < nz; z++) sum += prior.density[(z * ny + y) * nx + x]!;
    if (sum > 0) {
      populated[y * nx + x] = 1;
      for (let z = 0; z < nz; z++) normalized[(z * ny + y) * nx + x] = prior.density[(z * ny + y) * nx + x]! / (sum * dz);
    }
  }
  return {
    sample(x, y, z) {
      if (x < prior.boundsKpc.min[0] || x > prior.boundsKpc.max[0] || y < prior.boundsKpc.min[1] ||
          y > prior.boundsKpc.max[1] || z < prior.boundsKpc.min[2] || z > prior.boundsKpc.max[2]) return undefined;
      const gx = (x - prior.boundsKpc.min[0]) / (prior.boundsKpc.max[0] - prior.boundsKpc.min[0]) * nx - .5;
      const gy = (y - prior.boundsKpc.min[1]) / (prior.boundsKpc.max[1] - prior.boundsKpc.min[1]) * ny - .5;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
      const gz = (z - prior.boundsKpc.min[2]) / dz - .5;
      const z0 = clamp(Math.floor(gz), 0, nz - 1), z1 = clamp(z0 + 1, 0, nz - 1);
      const tz = gz <= 0 ? 0 : gz >= nz - 1 ? 0 : gz - Math.floor(gz);
      let value = 0, used = 0;
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
        const px = x0 + ox, py = y0 + oy;
        if (px < 0 || px >= nx || py < 0 || py >= ny || !populated[py * nx + px]) continue;
        const weight = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty);
        const low = normalized[(z0 * ny + py) * nx + px]!;
        value += weight * (low + (normalized[(z1 * ny + py) * nx + px]! - low) * tz); used += weight;
      }
      return used > 0 ? value / used : undefined;
    },
    addColumn(x, y, scores) {
      if (x < prior.boundsKpc.min[0] || x > prior.boundsKpc.max[0] || y < prior.boundsKpc.min[1] || y > prior.boundsKpc.max[1]) return;
      const gx = (x - prior.boundsKpc.min[0]) / (prior.boundsKpc.max[0] - prior.boundsKpc.min[0]) * nx - .5;
      const gy = (y - prior.boundsKpc.min[1]) / (prior.boundsKpc.max[1] - prior.boundsKpc.min[1]) * ny - .5;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0; let used = 0;
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
        const px = x0 + ox, py = y0 + oy;
        if (px >= 0 && px < nx && py >= 0 && py < ny && populated[py * nx + px]) used +=
          (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty);
      }
      if (!(used > 0)) return;
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
        const px = x0 + ox, py = y0 + oy;
        if (px < 0 || px >= nx || py < 0 || py >= ny || !populated[py * nx + px]) continue;
        const weight = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty) / used;
        for (let z = 0; z < nz; z++) scores[z] += weight * normalized[(z * ny + py) * nx + px]!;
      }
    },
    planeSamples(selected, width, height, bounds, margin) {
      const photoWeights = new Float64Array(nx * ny);
      for (let pixel = 0; pixel < selected.length; pixel++) {
        const light = selected[pixel]!; if (!(light > 0)) continue;
        const [x, y] = pixelPoint(pixel, width, height, bounds);
        const gx = (x - prior.boundsKpc.min[0]) / (prior.boundsKpc.max[0] - prior.boundsKpc.min[0]) * nx - .5;
        const gy = (y - prior.boundsKpc.min[1]) / (prior.boundsKpc.max[1] - prior.boundsKpc.min[1]) * ny - .5;
        const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0; let used = 0;
        for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
          const px = x0 + ox, py = y0 + oy;
          if (px >= 0 && px < nx && py >= 0 && py < ny && populated[py * nx + px]) used +=
            (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty);
        }
        if (!(used > 0)) continue;
        for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
          const px = x0 + ox, py = y0 + oy;
          if (px < 0 || px >= nx || py < 0 || py >= ny || !populated[py * nx + px]) continue;
          photoWeights[py * nx + px] += light * (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty) / used;
        }
      }
      const samples: Family[] = [];
      for (let py = 0; py < ny; py++) for (let px = 0; px < nx; px++) {
        const weight = photoWeights[py * nx + px]!; if (!(weight > 0)) continue;
        let winner = -1, best = 0;
        for (let zi = 0; zi < nz; zi++) {
          const value = normalized[(zi * ny + py) * nx + px]!;
          const center = prior.boundsKpc.min[2] + (zi + .5) * dz;
          const local = value > 0 && value >= (zi > 0 ? normalized[((zi - 1) * ny + py) * nx + px]! : -Infinity) &&
            value >= (zi + 1 < nz ? normalized[((zi + 1) * ny + py) * nx + px]! : -Infinity);
          if (local && center >= bounds.min[2] + margin && center <= bounds.max[2] - margin && value > best) {
            winner = zi; best = value;
          }
        }
        if (winner < 0) continue;
        samples.push({ pixels: [], weight, x: prior.boundsKpc.min[0] + (px + .5) / nx *
          (prior.boundsKpc.max[0] - prior.boundsKpc.min[0]), y: prior.boundsKpc.min[1] + (py + .5) / ny *
          (prior.boundsKpc.max[1] - prior.boundsKpc.min[1]),
        mode: prior.boundsKpc.min[2] + (winner + .5) * dz, offset: 0 });
      }
      return samples;
    },
  };
}

function strongestEligibleMode(prior: FilledDepthPrior | undefined, prepared: ReturnType<typeof preparePrior>, family: Family, width: number,
  height: number, bounds: Bounds3, margin: number): number | undefined {
  if (!prior) return undefined;
  const nz = prior.dimensions[2], scores = new Float64Array(nz);
  for (const pixel of family.pixels) {
    const [x, y] = pixelPoint(pixel, width, height, bounds);
    prepared.addColumn(x, y, scores);
  }
  const dz = (prior.boundsKpc.max[2] - prior.boundsKpc.min[2]) / nz;
  let winner = -1, score = 0;
  for (let index = 0; index < nz; index++) {
    const center = prior.boundsKpc.min[2] + (index + .5) * dz, value = scores[index]!;
    const local = value > 0 && value >= (scores[index - 1] ?? -Infinity) && value >= (scores[index + 1] ?? -Infinity);
    if (local && center >= bounds.min[2] + margin && center <= bounds.max[2] - margin && value > score) {
      winner = index; score = value;
    }
  }
  return winner < 0 ? undefined : prior.boundsKpc.min[2] + (winner + .5) * dz;
}

function solvePlane(families: Family[], midpoint: number): [number, number, number] {
  const located = families.filter(family => family.mode !== undefined);
  if (!located.length) return [midpoint, 0, 0];
  const weight = located.reduce((sum, item) => sum + item.weight, 0);
  const meanX = located.reduce((sum, item) => sum + item.x * item.weight, 0) / weight;
  const meanY = located.reduce((sum, item) => sum + item.y * item.weight, 0) / weight;
  const meanZ = located.reduce((sum, item) => sum + item.mode! * item.weight, 0) / weight;
  let xx = 0, yy = 0, xy = 0, xz = 0, yz = 0;
  for (const family of located) {
    const x = family.x - meanX, y = family.y - meanY, z = family.mode! - meanZ, w = family.weight;
    xx += w * x * x; yy += w * y * y; xy += w * x * y; xz += w * x * z; yz += w * y * z;
  }
  const determinant = xx * yy - xy * xy;
  let xSlope = 0, ySlope = 0;
  if (determinant > 1e-12 * Math.max(1, xx * yy)) {
    xSlope = (xz * yy - yz * xy) / determinant;
    ySlope = (yz * xx - xz * xy) / determinant;
  } else if (xx >= yy && xx > 1e-12) xSlope = xz / xx;
  else if (yy > 1e-12) ySlope = yz / yy;
  return [meanZ - xSlope * meanX - ySlope * meanY, xSlope, ySlope];
}

function componentFamilies(components: readonly FilledComponent[], width: number, pixels: number): {
  families: Family[]; componentFamily: Int32Array;
} {
  const parents = Int32Array.from(components, (_, index) => index);
  const find = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]!]!; index = parents[index]!; } return index; };
  const join = (a: number, b: number): void => { a = find(a); b = find(b); if (a !== b) parents[Math.max(a, b)] = Math.min(a, b); };
  const owners: number[][] = Array.from({ length: pixels }, () => []);
  components.forEach((component, index) => { for (const pixel of component.pixels) owners[pixel]!.push(index); });
  components.forEach((component, index) => {
    for (const pixel of component.pixels) {
      const x = pixel % width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy || x + dx < 0 || x + dx >= width) continue;
        const neighbor = pixel + dy * width + dx;
        if (neighbor < 0 || neighbor >= pixels) continue;
        for (const other of owners[neighbor]!) if (components[other]!.scale !== component.scale) join(index, other);
      }
      for (const other of owners[pixel]!) if (components[other]!.scale !== component.scale) join(index, other);
    }
  });
  const roots = new Map<number, number>(), families: Family[] = [], componentFamily = new Int32Array(components.length);
  components.forEach((component, index) => {
    const root = find(index); let familyIndex = roots.get(root);
    if (familyIndex === undefined) { familyIndex = families.length; roots.set(root, familyIndex); families.push({ pixels: [], weight: 0, x: 0, y: 0, offset: 0 }); }
    componentFamily[index] = familyIndex;
    const family = families[familyIndex]!, weight = component.integratedIntensity;
    family.weight += weight; family.x += component.centroid[0] * weight; family.y += component.centroid[1] * weight;
    for (const pixel of component.pixels) family.pixels.push(pixel);
  });
  for (const family of families) { family.x /= family.weight; family.y /= family.weight; family.pixels = [...new Set(family.pixels)].sort((a, b) => a - b); }
  return { families, componentFamily };
}

function footprintDistances(component: FilledComponent, width: number): Float32Array {
  const localWidth = component.bounds.maxX - component.bounds.minX + 3;
  const localHeight = component.bounds.maxY - component.bounds.minY + 3;
  const distance = new Float32Array(localWidth * localHeight);
  const support = new Uint8Array(distance.length);
  for (const pixel of component.pixels) {
    const x = pixel % width - component.bounds.minX + 1;
    const y = Math.floor(pixel / width) - component.bounds.minY + 1;
    support[y * localWidth + x] = 1;
  }
  distance.fill(Number.POSITIVE_INFINITY);
  for (let index = 0; index < distance.length; index++) if (!support[index]) distance[index] = 0;
  const diagonal = Math.SQRT2;
  for (let y = 1; y < localHeight - 1; y++) for (let x = 1; x < localWidth - 1; x++) {
    const index = y * localWidth + x;
    if (!support[index]) continue;
    distance[index] = Math.min(distance[index]!, distance[index - 1]! + 1, distance[index - localWidth]! + 1,
      distance[index - localWidth - 1]! + diagonal, distance[index - localWidth + 1]! + diagonal);
  }
  for (let y = localHeight - 2; y >= 1; y--) for (let x = localWidth - 2; x >= 1; x--) {
    const index = y * localWidth + x;
    if (!support[index]) continue;
    distance[index] = Math.min(distance[index]!, distance[index + 1]! + 1, distance[index + localWidth]! + 1,
      distance[index + localWidth - 1]! + diagonal, distance[index + localWidth + 1]! + diagonal);
  }
  const result = new Float32Array(component.pixels.length);
  for (let entry = 0; entry < component.pixels.length; entry++) {
    const pixel = component.pixels[entry]!, x = pixel % width - component.bounds.minX + 1;
    const y = Math.floor(pixel / width) - component.bounds.minY + 1;
    result[entry] = distance[y * localWidth + x]!;
  }
  return result;
}

export function createFilledVolumeSampler(options: FilledVolumeOptions): FilledVolumeSampler {
  const { target, decomposition, boundsKpc: bounds, depth } = options;
  validateBounds(bounds, 'boundsKpc');
  const pixels = target.width * target.height;
  if (!Number.isInteger(target.width) || target.width < 1 || !Number.isInteger(target.height) || target.height < 1 ||
      target.rgb.length !== 3 * pixels || target.intensity.length !== pixels || decomposition.compact.length !== pixels ||
      decomposition.diffuse.length !== pixels) throw new TypeError('Target and decomposition rasters must have matching positive dimensions.');
  for (const array of [target.intensity, decomposition.compact, decomposition.diffuse]) if (array.some(value => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Target and decomposition values must be finite and nonnegative.');
  }
  const depthValues = [depth.broadHalfThicknessKpc, depth.diffuseHalfThicknessKpc,
    depth.extendedMinimumHalfThicknessKpc, depth.extendedDepthAspectRatio,
    depth.compactMinimumHalfThicknessKpc, depth.compactDepthAspectRatio, depth.maxHalfThicknessKpc];
  const zSpan = bounds.max[2] - bounds.min[2];
  if (depthValues.some(value => !finitePositive(value)) || depth.maxHalfThicknessKpc > zSpan / 2 ||
      depth.extendedMinimumHalfThicknessKpc > depth.maxHalfThicknessKpc ||
      depth.compactMinimumHalfThicknessKpc > depth.maxHalfThicknessKpc ||
      depth.broadHalfThicknessKpc > zSpan / 2 || depth.diffuseHalfThicknessKpc > zSpan / 2) {
    throw new TypeError('Depth controls must be finite positive supports contained by the Z bounds.');
  }
  if (options.densityPrior) {
    validateBounds(options.densityPrior.boundsKpc, 'densityPrior.boundsKpc');
    const [nx, ny, nz] = options.densityPrior.dimensions;
    if (![nx, ny, nz].every(value => Number.isInteger(value) && value > 0) || options.densityPrior.density.length !== nx * ny * nz ||
        options.densityPrior.density.some(value => !Number.isFinite(value) || value < 0) ||
        options.densityPrior.boundsKpc.min[2] < bounds.min[2] || options.densityPrior.boundsKpc.max[2] > bounds.max[2]) {
      throw new TypeError('Density prior must be a finite nonnegative XYZ raster contained by the sampler Z bounds.');
    }
  }
  const channels = { ...DEFAULT_CHANNELS, ...options.channels };
  const exposure = options.exposureGain ?? 1, maxSignal = options.maxDisplaySignal ?? .995;
  const priorWeight = options.diffusePriorWeight ?? .25;
  if (!finitePositive(exposure) || !(maxSignal > 0 && maxSignal < 1) || !(priorWeight >= 0 && priorWeight <= 1)) {
    throw new TypeError('Optical and prior weights are outside their valid intervals.');
  }
  const extendedAt: Term[][] = Array.from({ length: pixels }, () => []);
  const reconstructed = Float64Array.from(decomposition.compact, value => value);
  const familyData = componentFamilies(decomposition.components, target.width, pixels);
  const preparedPrior = preparePrior(options.densityPrior);
  const dx = (bounds.max[0] - bounds.min[0]) / target.width;
  const dy = (bounds.max[1] - bounds.min[1]) / target.height;
  decomposition.components.forEach((component, componentIndex) => {
    let previous = -1;
    if (component.pixels.length !== component.contributions.length || !finitePositive(component.integratedIntensity)) throw new TypeError('Filled component metadata is inconsistent.');
    const distances = footprintDistances(component, target.width);
    for (let entry = 0; entry < component.pixels.length; entry++) {
      const pixel = component.pixels[entry]!, contribution = component.contributions[entry]!;
      if (pixel <= previous || pixel >= pixels || !finitePositive(contribution)) throw new TypeError('Component supports must be sorted, unique, in range, and strictly positive.');
      previous = pixel; reconstructed[pixel] += contribution;
      const half = Math.min(depth.maxHalfThicknessKpc, Math.sqrt(depth.extendedMinimumHalfThicknessKpc ** 2 +
        (depth.extendedDepthAspectRatio * distances[entry]! * Math.sqrt(dx * dy)) ** 2));
      extendedAt[pixel]!.push({ share: contribution, family: familyData.componentFamily[componentIndex]!, half,
        part: componentIndex });
    }
  });
  let maxAccountingError = 0;
  for (let pixel = 0; pixel < pixels; pixel++) {
    reconstructed[pixel] += decomposition.diffuse[pixel]!;
    maxAccountingError = Math.max(maxAccountingError, Math.abs(reconstructed[pixel]! - target.intensity[pixel]!));
  }
  if (maxAccountingError > 2e-5) throw new TypeError(`Filled decomposition does not reconstruct target intensity (maximum error ${maxAccountingError}).`);

  const selected = new Float32Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    let value = (channels.compact ? decomposition.compact[pixel]! : 0) +
      (channels.diffuse ? decomposition.diffuse[pixel]! : 0);
    if (channels.extended) for (const term of extendedAt[pixel]!) value += term.share;
    selected[pixel] = value;
  }

  const midpoint = (bounds.min[2] + bounds.max[2]) / 2;
  for (const family of familyData.families) {
    family.x = bounds.min[0] + (family.x + .5) * dx;
    family.y = bounds.max[1] - (family.y + .5) * dy;
    family.mode = strongestEligibleMode(options.densityPrior, preparedPrior, family, target.width, target.height, bounds, depth.maxHalfThicknessKpc);
  }
  const planeSamples = preparedPrior.planeSamples(selected, target.width, target.height, bounds,
    depth.maxHalfThicknessKpc);
  let [intercept, xSlope, ySlope] = solvePlane(planeSamples, midpoint);
  const maxOffset = options.depth.maxLocalDepthOffsetKpc ?? Math.min(depth.maxHalfThicknessKpc, zSpan * .1);
  for (const family of familyData.families) family.offset = family.mode === undefined ? 0 :
    clamp(family.mode - (intercept + xSlope * family.x + ySlope * family.y), -maxOffset, maxOffset);
  let largestSupport = 0;
  if (channels.extended && decomposition.components.length) largestSupport = Math.max(largestSupport, depth.maxHalfThicknessKpc);
  if (channels.diffuse && decomposition.diffuse.some(value => value > 0)) largestSupport = Math.max(largestSupport, depth.diffuseHalfThicknessKpc);
  if (channels.compact && decomposition.compact.some(value => value > 0)) largestSupport = Math.max(largestSupport,
    Math.min(depth.maxHalfThicknessKpc, Math.sqrt(depth.compactMinimumHalfThicknessKpc ** 2 +
      (depth.compactDepthAspectRatio * Math.sqrt(dx * dy)) ** 2)));
  const available = zSpan / 2 - largestSupport;
  let compression = 1;
  const constrain = (x: number, y: number, offset: number): void => {
    const excursion = Math.abs(intercept + xSlope * x + ySlope * y + offset - midpoint);
    if (excursion > 0) compression = Math.min(compression, available / excursion);
  };
  for (let pixel = 0; pixel < pixels; pixel++) if (selected[pixel]! > 0) {
    const [x, y] = pixelPoint(pixel, target.width, target.height, bounds); constrain(x, y, 0);
  }
  for (const family of familyData.families) for (const pixel of family.pixels) {
    const [x, y] = pixelPoint(pixel, target.width, target.height, bounds); constrain(x, y, family.offset);
  }
  compression = clamp(compression, 0, 1);
  intercept = midpoint + (intercept - midpoint) * compression; xSlope *= compression; ySlope *= compression;
  for (const family of familyData.families) family.offset *= compression;
  const centerAt = (family: number, x: number, y: number): number => intercept + xSlope * x + ySlope * y + (familyData.families[family]?.offset ?? 0);

  const compactFamily = new Int32Array(pixels).fill(-1); let compactCount = 0;
  for (let start = 0; start < pixels; start++) if (decomposition.compact[start]! > 0 && compactFamily[start] < 0) {
    const queue = [start]; compactFamily[start] = compactCount;
    for (let head = 0; head < queue.length; head++) {
      const pixel = queue[head]!, x = pixel % target.width;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy || x + ox < 0 || x + ox >= target.width) continue;
        const next = pixel + oy * target.width + ox;
        if (next >= 0 && next < pixels && decomposition.compact[next]! > 0 && compactFamily[next] < 0) {
          compactFamily[next] = compactCount; queue.push(next);
        }
      }
    }
    compactCount++;
  }
  const optical = new Float32Array(3 * pixels), display = new Float32Array(3 * pixels);
  let positiveSelected = 0, clippedSelected = 0;
  for (let pixel = 0; pixel < pixels; pixel++) {
    const value = selected[pixel]!;
    if (!(value > 0)) continue;
    positiveSelected++;
    const sourceIntensity = target.intensity[pixel]!;
    const scale = sourceIntensity > 0 ? value / sourceIntensity : 0;
    const r = target.rgb[3 * pixel]! / 255 * scale, g = target.rgb[3 * pixel + 1]! / 255 * scale;
    const b = target.rgb[3 * pixel + 2]! / 255 * scale, huePeak = Math.max(r, g, b);
    const clippedPeak = Math.min(maxSignal, huePeak), displayScale = huePeak > 0 ? clippedPeak / huePeak : 0;
    const peakOptical = -Math.log(1 - clippedPeak) / exposure;
    if (huePeak > maxSignal) clippedSelected++;
    for (let channel = 0; channel < 3; channel++) {
      const hue = huePeak > 0 ? [r, g, b][channel]! / huePeak : 1;
      display[3 * pixel + channel] = [r, g, b][channel]! * displayScale; optical[3 * pixel + channel] = peakOptical * hue;
    }
  }
  const broadProfile = (x: number, y: number, z: number): number => preparedPrior.sample(x, y, z) ?? quartic(z, midpoint, depth.broadHalfThicknessKpc);
  const coherentProfile = (pixel: number, x: number, y: number, z: number): number => {
    const total = selected[pixel]!; if (!(total > 0)) return 0;
    let value = 0;
    if (channels.diffuse) {
      const share = decomposition.diffuse[pixel]! / total;
      const local = quartic(z, intercept + xSlope * x + ySlope * y, depth.diffuseHalfThicknessKpc);
      const prior = preparedPrior.sample(x, y, z);
      value += share * (prior === undefined ? local : (1 - priorWeight) * local + priorWeight * prior);
    }
    if (channels.compact && decomposition.compact[pixel]! > 0) {
      const half = Math.min(depth.maxHalfThicknessKpc, Math.sqrt(depth.compactMinimumHalfThicknessKpc ** 2 +
        (depth.compactDepthAspectRatio * Math.sqrt(dx * dy)) ** 2));
      value += decomposition.compact[pixel]! / total * quartic(z, intercept + xSlope * x + ySlope * y, half);
    }
    if (channels.extended) for (const term of extendedAt[pixel]!) value += term.share / total * quartic(z, centerAt(term.family, x, y), term.half);
    return value;
  };
  const sample = (x: number, y: number, z: number, out: Vec3): void => {
    out[0] = out[1] = out[2] = 0;
    if (x < bounds.min[0] || x >= bounds.max[0] || y <= bounds.min[1] || y > bounds.max[1] || z < bounds.min[2] || z > bounds.max[2]) return;
    const gx = (x - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * target.width - .5;
    const gy = (bounds.max[1] - y) / (bounds.max[1] - bounds.min[1]) * target.height - .5;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
    for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
      const px = x0 + ox, py = y0 + oy; if (px < 0 || px >= target.width || py < 0 || py >= target.height) continue;
      const weight = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty); if (!(weight > 0)) continue;
      const pixel = py * target.width + px;
      const profile = options.mode === 'broad' ? broadProfile(x, y, z) : coherentProfile(pixel, x, y, z);
      for (let channel = 0; channel < 3; channel++) out[channel] += weight * optical[3 * pixel + channel]! * profile;
    }
  };
  const copyPixel = (source: Float32Array, pixel: number, out: Vec3): void => {
    if (!Number.isInteger(pixel) || pixel < 0 || pixel >= pixels) throw new RangeError('Pixel is outside the target raster.');
    out[0] = source[3 * pixel]!; out[1] = source[3 * pixel + 1]!; out[2] = source[3 * pixel + 2]!;
  };
  const usesRawPrior = options.mode === 'broad' || Boolean(options.densityPrior && channels.diffuse &&
    priorWeight > 0 && decomposition.diffuse.some(value => value > 0));
  let supportBoundsKpc: Bounds3 = { min: [...bounds.min] as Vec3, max: [...bounds.max] as Vec3 };
  if (!usesRawPrior && positiveSelected > 0) {
    let minX = bounds.max[0], minY = bounds.max[1], minZ = bounds.max[2];
    let maxX = bounds.min[0], maxY = bounds.min[1], maxZ = bounds.min[2];
    const include = (pixel: number, offset: number, half: number): void => {
      const [x, y] = pixelPoint(pixel, target.width, target.height, bounds);
      // Bilinear reconstruction reaches one raster pitch around an active centre.
      const x0 = Math.max(bounds.min[0], x - dx), x1 = Math.min(bounds.max[0], x + dx);
      const y0 = Math.max(bounds.min[1], y - dy), y1 = Math.min(bounds.max[1], y + dy);
      minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
      minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
      const variation = Math.abs(xSlope) * dx + Math.abs(ySlope) * dy;
      const center = intercept + xSlope * x + ySlope * y + offset;
      minZ = Math.min(minZ, center - half - variation);
      maxZ = Math.max(maxZ, center + half + variation);
    };
    const compactHalf = Math.min(depth.maxHalfThicknessKpc, Math.sqrt(depth.compactMinimumHalfThicknessKpc ** 2 +
      (depth.compactDepthAspectRatio * Math.sqrt(dx * dy)) ** 2));
    for (let pixel = 0; pixel < pixels; pixel++) {
      if (channels.diffuse && decomposition.diffuse[pixel]! > 0) include(pixel, 0, depth.diffuseHalfThicknessKpc);
      if (channels.compact && decomposition.compact[pixel]! > 0) include(pixel, 0, compactHalf);
      if (channels.extended) for (const term of extendedAt[pixel]!) include(pixel,
        familyData.families[term.family]!.offset, term.half);
    }
    supportBoundsKpc = { min: [minX, minY, Math.max(bounds.min[2], minZ)],
      max: [maxX, maxY, Math.min(bounds.max[2], maxZ)] };
  }
  const standaloneOptical = (intensity: NumericArray): Float32Array => {
    const result = new Float32Array(3 * pixels);
    for (let pixel = 0; pixel < pixels; pixel++) {
      const fraction = target.intensity[pixel]! > 0 ? intensity[pixel]! / target.intensity[pixel]! : 0;
      const rgb = [target.rgb[3 * pixel]! / 255 * fraction, target.rgb[3 * pixel + 1]! / 255 * fraction,
        target.rgb[3 * pixel + 2]! / 255 * fraction];
      const peak = Math.max(...rgb), clipped = Math.min(maxSignal, peak);
      const strength = peak > 0 ? -Math.log(1 - clipped) / (exposure * peak) : 0;
      for (let channel = 0; channel < 3; channel++) result[3 * pixel + channel] = rgb[channel]! * strength;
    }
    return result;
  };
  const compactOptical = standaloneOptical(decomposition.compact), diffuseOptical = standaloneOptical(decomposition.diffuse);
  const entryAt = (component: FilledComponent, pixel: number): number => {
    let lo = 0, hi = component.pixels.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (component.pixels[mid]! < pixel) lo = mid + 1; else hi = mid; }
    return lo < component.pixels.length && component.pixels[lo] === pixel ? lo : -1;
  };
  const partSample = (part: number, x: number, y: number, z: number, out: Vec3): void => {
    out[0] = out[1] = out[2] = 0;
    if (x < bounds.min[0] || x >= bounds.max[0] || y <= bounds.min[1] || y > bounds.max[1] ||
        z < bounds.min[2] || z > bounds.max[2]) return;
    const gx = (x - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * target.width - .5;
    const gy = (bounds.max[1] - y) / (bounds.max[1] - bounds.min[1]) * target.height - .5;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
    for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
      const px = x0 + ox, py = y0 + oy; if (px < 0 || px >= target.width || py < 0 || py >= target.height) continue;
      const weight = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty); if (!(weight > 0)) continue;
      const pixel = py * target.width + px;
      if (part < decomposition.components.length) {
        const component = decomposition.components[part]!, entry = entryAt(component, pixel); if (entry < 0) continue;
        const term = extendedAt[pixel]!.find(candidate => candidate.part === part)!;
        const share = selected[pixel]! > 0 ? component.contributions[entry]! / selected[pixel]! : 0;
        const profile = quartic(z, centerAt(term.family, x, y), term.half);
        for (let channel = 0; channel < 3; channel++) out[channel] += weight * optical[3 * pixel + channel]! * share * profile;
      } else {
        const compact = part === decomposition.components.length, source = compact ? compactOptical : diffuseOptical;
        const half = compact ? Math.min(depth.maxHalfThicknessKpc, Math.sqrt(depth.compactMinimumHalfThicknessKpc ** 2 +
          (depth.compactDepthAspectRatio * Math.sqrt(dx * dy)) ** 2)) : depth.diffuseHalfThicknessKpc;
        const profile = quartic(z, intercept + xSlope * x + ySlope * y, half);
        for (let channel = 0; channel < 3; channel++) out[channel] += weight * source[3 * pixel + channel]! * profile;
      }
    }
  };
  const boundsFor = (part: number): Bounds3 => {
    let minX = bounds.max[0], minY = bounds.max[1], minZ = bounds.max[2], maxX = bounds.min[0], maxY = bounds.min[1], maxZ = bounds.min[2];
    const include = (pixel: number, offset: number, half: number): void => {
      const [x, y] = pixelPoint(pixel, target.width, target.height, bounds), variation = Math.abs(xSlope) * dx + Math.abs(ySlope) * dy;
      minX = Math.min(minX, Math.max(bounds.min[0], x - dx)); maxX = Math.max(maxX, Math.min(bounds.max[0], x + dx));
      minY = Math.min(minY, Math.max(bounds.min[1], y - dy)); maxY = Math.max(maxY, Math.min(bounds.max[1], y + dy));
      const center = intercept + xSlope * x + ySlope * y + offset;
      minZ = Math.min(minZ, center - half - variation); maxZ = Math.max(maxZ, center + half + variation);
    };
    if (part < decomposition.components.length) {
      const component = decomposition.components[part]!;
      for (const pixel of component.pixels) { const term = extendedAt[pixel]!.find(candidate => candidate.part === part)!;
        include(pixel, familyData.families[term.family]!.offset, term.half); }
    } else {
      const compact = part === decomposition.components.length, map = compact ? decomposition.compact : decomposition.diffuse;
      const half = compact ? Math.min(depth.maxHalfThicknessKpc, Math.sqrt(depth.compactMinimumHalfThicknessKpc ** 2 +
        (depth.compactDepthAspectRatio * Math.sqrt(dx * dy)) ** 2)) : depth.diffuseHalfThicknessKpc;
      for (let pixel = 0; pixel < pixels; pixel++) if (map[pixel]! > 0) include(pixel, 0, half);
    }
    return { min: [minX, minY, Math.max(bounds.min[2], minZ)], max: [maxX, maxY, Math.min(bounds.max[2], maxZ)] };
  };
  const partRows = [...decomposition.components.map((component, part) => ({ id: `extended:${component.id}`, kind: 'extended' as const,
    componentId: component.id, scale: component.scale, radius: component.radius, integratedIntensity: component.integratedIntensity,
    supportBoundsKpc: boundsFor(part), sample: (x: number, y: number, z: number, out: Vec3) => partSample(part, x, y, z, out),
    integratedTargetAtPixel(pixel: number, out: Vec3) { const entry = entryAt(component, pixel), share = entry >= 0 && selected[pixel]! > 0 ? component.contributions[entry]! / selected[pixel]! : 0;
      for (let channel = 0; channel < 3; channel++) out[channel] = optical[3 * pixel + channel]! * share; },
    interpretation: 'Morphological extended-image contribution using the frozen reference geometry; not a measured gas structure.' })),
  ...(['compact', 'diffuse'] as const).map((kind, offset) => { const part = decomposition.components.length + offset;
    const map = kind === 'compact' ? decomposition.compact : decomposition.diffuse, source = kind === 'compact' ? compactOptical : diffuseOptical;
    let integratedIntensity = 0; for (const value of map) integratedIntensity += value;
    return { id: `channel:${kind}`, kind, integratedIntensity, supportBoundsKpc: boundsFor(part),
      sample: (x: number, y: number, z: number, out: Vec3) => partSample(part, x, y, z, out),
      integratedTargetAtPixel(pixel: number, out: Vec3) { copyPixel(source, pixel, out); },
      interpretation: kind === 'compact' ? 'Separately calibrated compact-source candidate image channel; no stellar membership is asserted.' :
        'Separately calibrated diffuse image remainder on the frozen reference plane; not measured gas depth.' }; })] satisfies FilledVolumePart[];
  let positivePrior = 0; if (options.densityPrior) for (const value of options.densityPrior.density) if (value > 0) positivePrior++;
  return { sample, integratedTargetAtPixel: (pixel, out) => copyPixel(optical, pixel, out),
    displayTargetAtPixel: (pixel, out) => copyPixel(display, pixel, out),
    supportBoundsKpc,
    parts: Object.freeze(partRows),
    diagnostics: { mode: options.mode, channels, photoDimensions: [target.width, target.height], positiveSelectedPixels: positiveSelected,
      clippedSelectedPixels: clippedSelected,
      maxInputAccountingError: maxAccountingError, compactFamilyCount: compactCount, extendedFamilyCount: familyData.families.length,
      prior: { provided: Boolean(options.densityPrior), positiveVoxels: positivePrior,
        locatedFamilies: familyData.families.filter(family => family.mode !== undefined).length },
      depthPlane: { interceptKpc: intercept, xSlope, ySlope, compression },
      halfThicknessKpc: { minimum: Math.min(depth.compactMinimumHalfThicknessKpc, depth.extendedMinimumHalfThicknessKpc), maximum: depth.maxHalfThicknessKpc },
      opticalTransfer: 'Selected display intensity is mapped once through -log(1-signal)/exposure; normalized depth profiles preserve that optical column.',
      claimLimitations: ['This is a display reconstruction, not a physical gas-density or distance measurement.',
        'The stellar density is only a weak relative depth prior.', 'Compact candidates are an explicit image channel, not claimed stellar membership.'] } };
}
