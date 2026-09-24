import { validateBounds } from './bounds.ts';
/** Offline, photograph-column-preserving coherent depth assignment. */
import type { StructureRegion } from '@cssearth/nebula-reconstruction/evidence/wavelets';

type Vec3 = [number, number, number];
type Bounds3 = { min: Vec3; max: Vec3 };
type NumericArray = Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike>;

export type CoherentPhotoTarget = {
  width: number;
  height: number;
  rgba: Uint8Array<ArrayBufferLike>;
} | {
  width: number;
  height: number;
  rgb: Uint8Array<ArrayBufferLike>;
  /** Normalized display intensity multiplying the supplied RGB channels. */
  luminance: Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike>;
};

export interface CoarseStellarDensityPrior {
  density: NumericArray;
  dimensions: Vec3;
  boundsKpc: Bounds3;
}

export interface CoherentVolumeOptions {
  target: CoherentPhotoTarget;
  /** Image XY extent and finite reconstructed Z extent. Raster row zero is max Y. */
  boundsKpc: Bounds3;
  /** Automatically detected supports. Actual cross-scale overlap defines shared families. */
  catalog: readonly StructureRegion[];
  densityPrior?: CoarseStellarDensityPrior;
  /** Optical-column share retained in the common broad component for catalogued pixels. */
  baseFraction?: number;
  baseHalfThicknessKpc: number;
  structureHalfThicknessKpc: number;
  /** Multiplier applied once per structure scale; defaults to one. */
  scaleThicknessFactor?: number;
  /** Maximum coherent centre shift across a family footprint; defaults to zero. */
  maxDepthVariationKpc?: number;
  exposureGain?: number;
  maxDisplaySignal?: number;
}

export interface CoherentDepthSupport {
  id: string;
  regionIds: string[];
  pixelCount: number;
  centerKpc: number;
  minKpc: number;
  maxKpc: number;
  halfThicknessKpc: number;
  depthVariationKpc: number;
  spanPixels: [number, number];
  spanKpc: [number, number];
  priorModeKpc?: number;
  priorModesKpc: number[];
  priorSupport: number;
  placement: 'family-mode' | 'shared-mode' | 'bounds-midpoint';
}

export interface CoherentVolumeDiagnostics {
  photoDimensions: [number, number];
  boundsKpc: Bounds3;
  assignmentCoverage: {
    positiveTargetPixels: number;
    catalogSupportedPositivePixels: number;
    fraction: number;
    localizedOpticalFraction: number;
    unassignedOpticalFraction: number;
    /** Numeric presence only; this is not an extraction-quality or scientific-validity gate. */
    hasLocalizedAssignment: boolean;
  };
  baseDepthSupport: { centerKpc: number; minKpc: number; maxKpc: number; halfThicknessKpc: number };
  depthSupports: CoherentDepthSupport[];
  familyCount: number;
  recommendedMinimumZSamples: number;
  priors: {
    provided: boolean;
    dimensions?: Vec3;
    positiveVoxels: number;
    baseModeKpc?: number;
    familiesWithOwnMode: number;
    familiesUsingSharedMode: number;
    familiesUsingBoundsMidpoint: number;
    selection: string;
  };
  opticalTransfer: string;
  claimLimitations: string[];
}

export interface CoherentVolumeSampler {
  /** Allocation-free optical RGB emissivity per kpc; compatible with master-slice sampling. */
  sample(xKpc: number, yKpc: number, zKpc: number, out: Vec3): void;
  diagnostics: CoherentVolumeDiagnostics;
}

interface Family {
  root: number;
  regions: number[];
  pixels: number[];
  maxScale: number;
  centerX: number;
  centerY: number;
  directionX: number;
  directionY: number;
  projectionRadius: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerZ: number;
  halfThickness: number;
  variation: number;
  scores?: Float64Array;
  diagnostics?: CoherentDepthSupport;
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

function compactProfile(z: number, center: number, halfThickness: number): number {
  const distance = Math.abs(z - center);
  return distance >= halfThickness ? 0 : (1 + Math.cos(Math.PI * distance / halfThickness)) /
    (2 * halfThickness);
}

function overlapMode(scores: Float64Array, minZ: number, cellZ: number,
  eligibleMin = -Infinity, eligibleMax = Infinity): {
  winner?: number; modes: number[]; support: number;
} {
  let support = 0;
  let winner = -1;
  const modes: number[] = [];
  for (let z = 0; z < scores.length; z++) {
    const score = scores[z]!;
    support += score;
    const center = minZ + (z + .5) * cellZ;
    const isMode = score > 0 && score >= (scores[z - 1] ?? -Infinity) &&
      score >= (scores[z + 1] ?? -Infinity);
    if (isMode) modes.push(center);
    if (isMode && center >= eligibleMin && center <= eligibleMax && score > (scores[winner] ?? 0)) winner = z;
  }
  return { ...(winner >= 0 ? { winner: minZ + (winner + .5) * cellZ } : {}), modes, support };
}

function targetOptical(target: CoherentPhotoTarget, exposure: number, maxSignal: number): {
  optical: Float32Array; intensity: Float32Array; positive: number;
} {
  const pixels = target.width * target.height;
  const optical = new Float32Array(3 * pixels);
  const intensity = new Float32Array(pixels);
  let positive = 0;
  for (let pixel = 0; pixel < pixels; pixel++) {
    let red: number;
    let green: number;
    let blue: number;
    if ('rgba' in target) {
      const alpha = target.rgba[4 * pixel + 3]! / 255;
      red = target.rgba[4 * pixel]! / 255 * alpha;
      green = target.rgba[4 * pixel + 1]! / 255 * alpha;
      blue = target.rgba[4 * pixel + 2]! / 255 * alpha;
    } else {
      const strength = target.luminance[pixel]!;
      red = target.rgb[3 * pixel]! / 255 * strength;
      green = target.rgb[3 * pixel + 1]! / 255 * strength;
      blue = target.rgb[3 * pixel + 2]! / 255 * strength;
    }
    const peak = Math.max(red, green, blue);
    intensity[pixel] = peak;
    if (!(peak > 0)) continue;
    positive++;
    const peakOptical = -Math.log(1 - Math.min(maxSignal, peak)) / exposure;
    optical[3 * pixel] = peakOptical * red / peak;
    optical[3 * pixel + 1] = peakOptical * green / peak;
    optical[3 * pixel + 2] = peakOptical * blue / peak;
  }
  return { optical, intensity, positive };
}

function makeFamilies(catalog: readonly StructureRegion[], width: number, height: number): {
  families: Family[]; pixelFamily: Int32Array;
} {
  const pixels = width * height;
  const ids = new Map<string, number>();
  const parents = catalog.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) {
      const next = parents[index]!;
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const join = (left: number, right: number): void => {
    const a = find(left), b = find(right);
    if (a !== b) parents[Math.max(a, b)] = Math.min(a, b);
  };
  catalog.forEach((region, index) => {
    if (!region.id || ids.has(region.id)) throw new TypeError('Structure region ids must be unique and nonempty.');
    if (region.support.length < 1) throw new TypeError('Structure supports must be nonempty.');
    ids.set(region.id, index);
    let previous = -1;
    for (const pixel of region.support) {
      if (!Number.isInteger(pixel) || pixel >= pixels || pixel <= previous) {
        throw new TypeError('Structure supports must be sorted unique in-range raster indices.');
      }
      previous = pixel;
    }
  });
  catalog.forEach((region, index) => {
    if (region.parentId !== undefined) {
      const parent = ids.get(region.parentId);
      if (parent === undefined) throw new TypeError(`Unknown structure parent ${region.parentId}.`);
      let left = 0, right = 0, overlaps = false;
      while (left < region.support.length && right < catalog[parent]!.support.length) {
        const a = region.support[left]!, b = catalog[parent]!.support[right]!;
        if (a === b) { overlaps = true; break; }
        if (a < b) left++; else right++;
      }
      if (!overlaps) throw new TypeError(`Structure parent ${region.parentId} does not overlap ${region.id}.`);
      join(index, parent);
    }
  });
  const firstAtPixel = new Int32Array(pixels).fill(-1);
  catalog.forEach((region, index) => {
    for (const pixel of region.support) {
      const first = firstAtPixel[pixel]!;
      if (first >= 0) {
        if (catalog[first]!.scale === region.scale) {
          throw new TypeError(`Same-scale structure supports overlap at pixel ${pixel}.`);
        }
        join(first, index);
      } else firstAtPixel[pixel] = index;
    }
  });
  const byRoot = new Map<number, Family>();
  catalog.forEach((region, index) => {
    const root = find(index);
    let family = byRoot.get(root);
    if (!family) {
      family = { root, regions: [], pixels: [], maxScale: 0, centerX: 0, centerY: 0,
        directionX: 1, directionY: 0, projectionRadius: 1,
        minX: width, minY: height, maxX: -1, maxY: -1,
        centerZ: 0, halfThickness: 0, variation: 0 };
      byRoot.set(root, family);
    }
    family.regions.push(index);
    family.maxScale = Math.max(family.maxScale, region.scale);
  });
  const families = [...byRoot.values()].sort((a, b) => catalog[a.root]!.id.localeCompare(catalog[b.root]!.id));
  const familyByRoot = new Map(families.map((family, index) => [find(family.root), index]));
  const pixelFamily = new Int32Array(pixels).fill(-1);
  catalog.forEach((region, index) => {
    const familyIndex = familyByRoot.get(find(index))!;
    for (const pixel of region.support) pixelFamily[pixel] = familyIndex;
  });
  for (let pixel = 0; pixel < pixels; pixel++) {
    const family = pixelFamily[pixel]!;
    if (family >= 0) families[family]!.pixels.push(pixel);
  }
  return { families, pixelFamily };
}

function setFamilyGeometry(family: Family, catalog: readonly StructureRegion[], width: number): void {
  const anchorIndex = family.regions.reduce((best, index) => {
    const left = catalog[index]!, right = catalog[best]!;
    return left.scale > right.scale || left.scale === right.scale && left.support.length > right.support.length ? index : best;
  }, family.regions[0]!);
  const anchor = catalog[anchorIndex]!;
  family.centerX = anchor.centroid[0];
  family.centerY = anchor.centroid[1];
  const radians = anchor.orientationDeg * Math.PI / 180;
  family.directionX = Math.cos(radians);
  family.directionY = Math.sin(radians);
  family.projectionRadius = .5;
  for (const pixel of family.pixels) {
    const x = pixel % width, y = Math.floor(pixel / width);
    family.minX = Math.min(family.minX, x); family.maxX = Math.max(family.maxX, x);
    family.minY = Math.min(family.minY, y); family.maxY = Math.max(family.maxY, y);
    family.projectionRadius = Math.max(family.projectionRadius, Math.abs((x - family.centerX) *
      family.directionX + (y - family.centerY) * family.directionY));
  }
}

/** Builds a deterministic sampler without allocating a 3D RGB volume. */
export function createCoherentVolumeSampler(options: CoherentVolumeOptions): CoherentVolumeSampler {
  const { target, boundsKpc: bounds } = options;
  validateBounds(bounds, 'Volume bounds');
  if (!Number.isInteger(target.width) || target.width < 1 || !Number.isInteger(target.height) ||
      target.height < 1 || target.width * target.height > 50_000_000) {
    throw new TypeError('Target must be a positive raster of at most 50,000,000 pixels.');
  }
  const pixelCount = target.width * target.height;
  if ('rgba' in target ? target.rgba.length !== 4 * pixelCount :
    target.rgb.length !== 3 * pixelCount || target.luminance.length !== pixelCount) {
    throw new TypeError('Target channels must match its declared dimensions.');
  }
  if (!('rgba' in target) && target.luminance.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError('Target luminance multipliers must be finite values from zero to one.');
  }
  const zSpan = bounds.max[2] - bounds.min[2];
  const baseFraction = options.baseFraction ?? .2;
  const scaleFactor = options.scaleThicknessFactor ?? 1;
  const requestedVariation = options.maxDepthVariationKpc ?? 0;
  const exposure = options.exposureGain ?? 1;
  const maxSignal = options.maxDisplaySignal ?? .98;
  if (!Number.isFinite(baseFraction) || baseFraction < 0 || baseFraction > 1 ||
      !Number.isFinite(options.baseHalfThicknessKpc) || options.baseHalfThicknessKpc <= 0 ||
      options.baseHalfThicknessKpc > zSpan / 2 || !Number.isFinite(options.structureHalfThicknessKpc) ||
      options.structureHalfThicknessKpc <= 0 || options.structureHalfThicknessKpc > zSpan / 2 ||
      !Number.isFinite(scaleFactor) || scaleFactor <= 0 || !Number.isFinite(requestedVariation) ||
      requestedVariation < 0 || !Number.isFinite(exposure) || exposure <= 0 ||
      !Number.isFinite(maxSignal) || maxSignal <= 0 || maxSignal >= 1) {
    throw new TypeError('Invalid coherent depth or optical transfer settings.');
  }
  const targetData = targetOptical(target, exposure, maxSignal);
  const { families, pixelFamily } = makeFamilies(options.catalog, target.width, target.height);
  families.forEach(family => {
    setFamilyGeometry(family, options.catalog, target.width);
    family.halfThickness = Math.min(zSpan / 2,
      options.structureHalfThicknessKpc * scaleFactor ** family.maxScale);
    family.variation = Math.min(requestedVariation, zSpan / 2 - family.halfThickness);
  });

  let densityDepth = 0, densityMinZ = bounds.min[2], densityCellZ = zSpan;
  let positiveVoxels = 0;
  let globalScores: Float64Array | undefined;
  if (options.densityPrior) {
    const prior = options.densityPrior;
    validateBounds(prior.boundsKpc, 'Density-prior bounds');
    const [priorWidth, priorHeight, priorDepth] = prior.dimensions;
    const count = priorWidth * priorHeight * priorDepth;
    if (prior.dimensions.some(value => !Number.isInteger(value) || value < 1 || value > 1024) ||
        count > 16_777_216 || prior.density.length !== count ||
        prior.density.some(value => !Number.isFinite(value) || value < 0)) {
      throw new TypeError('Density prior must match a finite nonnegative grid of at most 16,777,216 voxels.');
    }
    for (const value of prior.density) if (value > 0) positiveVoxels++;
    densityDepth = priorDepth;
    densityMinZ = prior.boundsKpc.min[2];
    densityCellZ = (prior.boundsKpc.max[2] - densityMinZ) / priorDepth;
    globalScores = new Float64Array(priorDepth);
    families.forEach(family => { family.scores = new Float64Array(priorDepth); });
    const priorSpanX = prior.boundsKpc.max[0] - prior.boundsKpc.min[0];
    const priorSpanY = prior.boundsKpc.max[1] - prior.boundsKpc.min[1];
    const targetSpanX = bounds.max[0] - bounds.min[0], targetSpanY = bounds.max[1] - bounds.min[1];
    const globalCellWeights = new Float64Array(priorWidth * priorHeight);
    const familyCellWeights = families.map(() => new Map<number, number>());
    for (let py = 0; py < target.height; py++) for (let px = 0; px < target.width; px++) {
      const pixel = py * target.width + px, weight = targetData.intensity[pixel]!;
      if (!(weight > 0)) continue;
      const worldX = bounds.min[0] + (px + .5) / target.width * targetSpanX;
      const worldY = bounds.max[1] - (py + .5) / target.height * targetSpanY;
      const x = Math.floor((worldX - prior.boundsKpc.min[0]) / priorSpanX * priorWidth);
      const y = Math.floor((worldY - prior.boundsKpc.min[1]) / priorSpanY * priorHeight);
      if (x < 0 || x >= priorWidth || y < 0 || y >= priorHeight) continue;
      const cell = y * priorWidth + x;
      globalCellWeights[cell] += weight;
      const familyIndex = pixelFamily[pixel]!;
      if (familyIndex >= 0) {
        const weights = familyCellWeights[familyIndex]!;
        weights.set(cell, (weights.get(cell) ?? 0) + weight);
      }
    }
    for (let z = 0; z < priorDepth; z++) for (let cell = 0; cell < globalCellWeights.length; cell++) {
      globalScores[z] += prior.density[z * globalCellWeights.length + cell]! * globalCellWeights[cell]!;
    }
    familyCellWeights.forEach((weights, familyIndex) => {
      for (const [cell, weight] of weights) for (let z = 0; z < priorDepth; z++) {
        families[familyIndex]!.scores![z] += prior.density[z * globalCellWeights.length + cell]! * weight;
      }
    });
  }
  const midpoint = (bounds.min[2] + bounds.max[2]) / 2;
  const globalMode = globalScores ? overlapMode(globalScores, densityMinZ, densityCellZ,
    bounds.min[2] + options.baseHalfThicknessKpc, bounds.max[2] - options.baseHalfThicknessKpc) :
    { modes: [] as number[], support: 0 };
  const baseCenter = globalMode.winner ?? midpoint;
  let ownModes = 0, sharedModes = 0, midpointFallbacks = 0;
  for (const [familyIndex, family] of families.entries()) {
    const eligibleMin = bounds.min[2] + family.halfThickness + family.variation;
    const eligibleMax = bounds.max[2] - family.halfThickness - family.variation;
    const own = family.scores ? overlapMode(family.scores, densityMinZ, densityCellZ,
      eligibleMin, eligibleMax) :
      { modes: [] as number[], support: 0 };
    const shared = globalScores ? overlapMode(globalScores, densityMinZ, densityCellZ,
      eligibleMin, eligibleMax) : { modes: [] as number[], support: 0 };
    let placement: CoherentDepthSupport['placement'];
    let selected: number;
    if (own.winner !== undefined) {
      selected = own.winner; placement = 'family-mode'; ownModes++;
    } else if (shared.winner !== undefined) {
      selected = shared.winner; placement = 'shared-mode'; sharedModes++;
    } else {
      selected = midpoint; placement = 'bounds-midpoint'; midpointFallbacks++;
    }
    family.centerZ = selected;
    const id = `family-${String(familyIndex).padStart(4, '0')}`;
    family.diagnostics = { id, regionIds: family.regions.map(index => options.catalog[index]!.id).sort(),
      pixelCount: family.pixels.length, centerKpc: family.centerZ,
      minKpc: family.centerZ - family.halfThickness - family.variation,
      maxKpc: family.centerZ + family.halfThickness + family.variation,
      halfThicknessKpc: family.halfThickness, depthVariationKpc: family.variation,
      spanPixels: [family.maxX - family.minX + 1, family.maxY - family.minY + 1],
      spanKpc: [0, 0],
      ...(own.winner !== undefined ? { priorModeKpc: own.winner } : {}), priorModesKpc: own.modes,
      priorSupport: own.support, placement };
    family.diagnostics.spanKpc = [family.diagnostics.spanPixels[0] / target.width *
      (bounds.max[0] - bounds.min[0]), family.diagnostics.spanPixels[1] / target.height *
      (bounds.max[1] - bounds.min[1])];
  }

  const localCenter = (family: Family, pixel: number): number => {
    if (!(family.variation > 0)) return family.centerZ;
    const x = pixel % target.width, y = Math.floor(pixel / target.width);
    const projected = ((x - family.centerX) * family.directionX + (y - family.centerY) *
      family.directionY) / family.projectionRadius;
    return family.centerZ + clamp(projected, -1, 1) * family.variation;
  };
  const columnProfile = (pixel: number, z: number): number => {
    const familyIndex = pixelFamily[pixel]!;
    if (familyIndex < 0 || baseFraction === 1) return compactProfile(z, baseCenter,
      options.baseHalfThicknessKpc);
    const family = families[familyIndex]!;
    return baseFraction * compactProfile(z, baseCenter, options.baseHalfThicknessKpc) +
      (1 - baseFraction) * compactProfile(z, localCenter(family, pixel), family.halfThickness);
  };
  const accumulate = (pixel: number, weight: number, z: number, out: Vec3): void => {
    if (!(weight > 0)) return;
    const profile = columnProfile(pixel, z) * weight;
    out[0] += targetData.optical[3 * pixel]! * profile;
    out[1] += targetData.optical[3 * pixel + 1]! * profile;
    out[2] += targetData.optical[3 * pixel + 2]! * profile;
  };
  const sample = (xKpc: number, yKpc: number, zKpc: number, out: Vec3): void => {
    out[0] = out[1] = out[2] = 0;
    if (!Number.isFinite(xKpc) || !Number.isFinite(yKpc) || !Number.isFinite(zKpc) ||
        xKpc < bounds.min[0] || xKpc > bounds.max[0] || yKpc < bounds.min[1] ||
        yKpc > bounds.max[1] || zKpc < bounds.min[2] || zKpc > bounds.max[2]) return;
    const gx = clamp((xKpc - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * target.width - .5,
      0, target.width - 1);
    const gy = clamp((bounds.max[1] - yKpc) / (bounds.max[1] - bounds.min[1]) * target.height - .5,
      0, target.height - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(target.width - 1, x0 + 1), y1 = Math.min(target.height - 1, y0 + 1);
    const tx = gx - x0, ty = gy - y0;
    accumulate(y0 * target.width + x0, (1 - tx) * (1 - ty), zKpc, out);
    accumulate(y0 * target.width + x1, tx * (1 - ty), zKpc, out);
    accumulate(y1 * target.width + x0, (1 - tx) * ty, zKpc, out);
    accumulate(y1 * target.width + x1, tx * ty, zKpc, out);
  };

  let supportedPositive = 0, totalOptical = 0, localizedOptical = 0;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const opticalPeak = Math.max(targetData.optical[3 * pixel]!, targetData.optical[3 * pixel + 1]!,
      targetData.optical[3 * pixel + 2]!);
    totalOptical += opticalPeak;
    if (pixelFamily[pixel]! >= 0 && opticalPeak > 0) {
      supportedPositive++;
      localizedOptical += opticalPeak * (1 - baseFraction);
    }
  }
  let thinnestHalfThickness = options.baseHalfThicknessKpc;
  for (const family of families) thinnestHalfThickness = Math.min(thinnestHalfThickness, family.halfThickness);
  return { sample, diagnostics: {
    photoDimensions: [target.width, target.height], boundsKpc: { min: [...bounds.min], max: [...bounds.max] },
    assignmentCoverage: { positiveTargetPixels: targetData.positive,
      catalogSupportedPositivePixels: supportedPositive,
      fraction: targetData.positive ? supportedPositive / targetData.positive : 0,
      localizedOpticalFraction: totalOptical ? localizedOptical / totalOptical : 0,
      unassignedOpticalFraction: totalOptical ? 1 - localizedOptical / totalOptical : 0,
      hasLocalizedAssignment: localizedOptical > 0 },
    baseDepthSupport: { centerKpc: baseCenter, minKpc: baseCenter - options.baseHalfThicknessKpc,
      maxKpc: baseCenter + options.baseHalfThicknessKpc,
      halfThicknessKpc: options.baseHalfThicknessKpc },
    depthSupports: families.map(family => family.diagnostics!),
    familyCount: families.length,
    recommendedMinimumZSamples: Math.ceil(4 * zSpan / thinnestHalfThickness),
    priors: { provided: Boolean(options.densityPrior),
      ...(options.densityPrior ? { dimensions: [...options.densityPrior.dimensions] as Vec3 } : {}),
      positiveVoxels, ...(globalMode.winner !== undefined ? { baseModeKpc: globalMode.winner } : {}),
      familiesWithOwnMode: ownModes, familiesUsingSharedMode: sharedModes,
      familiesUsingBoundsMidpoint: midpointFallbacks,
      selection: 'Each connected cross-scale family selects one strongest sampled stellar-density Z mode; separated modes are never averaged.' },
    opticalTransfer: 'RGBA uses photo-master RGB×alpha and shared-opacity mapping; RGB+luminance uses the supplied normalized intensity multiplier.',
    claimLimitations: [
      'Depth and thickness are deterministic display-model priors, not measured gas geometry.',
      'The stellar density is a weak placement prior and does not identify corresponding gas clouds.',
      'A preserved reference projection does not validate side or oblique views.',
      'Occlusion, extinction and calibrated photometry are unsupported.',
    ],
  } };
}
