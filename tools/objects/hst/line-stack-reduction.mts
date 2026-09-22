/** The arithmetic of stacking STIS long-slit line images of a moving target in the target's own frame.
 *
 * A long-slit exposure of a body that is smaller than the slit is already an image in one direction: along the slit the body
 * is resolved, across the slit each column is a wavelength. At a line the body's own glow therefore paints a picture of
 * itself, one whose across-slit axis is wavelength rather than sky, and which is only a picture as far as the line is
 * narrow. That is the "monochromatic line image" the published method works with, and this module holds every step of it
 * that is pure arithmetic: the sky level, the reflected-sunlight model, the conversion from the rectified product's own flux
 * units to Rayleigh, the rotation into the body's frame, the exposure-weighted stack, and the measurements a receipt states.
 *
 * Nothing here reads a file, asks a service or knows what body it is working on. What is Europa-specific — the lines, the
 * masked wavelengths, the windows, the grid, the rejection rule — arrives as a pinned stack definition, parsed here and
 * used by [line-stack.mts](line-stack.mts). Sources for the recipe are named in that definition and in
 * [docs/hubble.md](../../../docs/hubble.md). */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

// ---- brightness -------------------------------------------------------------------------------------------------------
/** Planck's constant times the speed of light, erg Å, from the SI definitions of h and c. */
export const PLANCK_TIMES_LIGHT_ERG_ANGSTROM = 6.62607015e-27 * 2.99792458e18;
/** One Rayleigh as a column emission rate per square arcsecond: 1e6/(4π) photons cm⁻² s⁻¹ sr⁻¹, and a steradian is
 * (180·3600/π)² square arcseconds. 1.87038e-6 photons cm⁻² s⁻¹ arcsec⁻². */
export const RAYLEIGH_PHOTONS_PER_ARCSEC2 = 1e6 / (4 * Math.PI) / ((180 * 3600 / Math.PI) ** 2);

/** The factor that turns one rectified sample — erg s⁻¹ cm⁻² Å⁻¹ arcsec⁻² — into Rayleigh at one line.
 *
 * A rectified spectrum holds flux per Å, so a line's whole brightness is the sample times the width of wavelength one slit
 * width subtends. That width is the product's own `CONT2EML` card, the continuum-to-emission-line conversion for the slit it
 * was taken through, and is not computed here: the header states it. The rest is photon energy hc/λ and the definition of a
 * Rayleigh above. */
export function rayleighPerSample(continuumToEmissionLineAngstrom: number, wavelengthAngstrom: number): number {
  if (!(continuumToEmissionLineAngstrom > 0) || !(wavelengthAngstrom > 0)) throw new RangeError('A line conversion needs a positive CONT2EML and wavelength.');
  return continuumToEmissionLineAngstrom * wavelengthAngstrom / PLANCK_TIMES_LIGHT_ERG_ANGSTROM / RAYLEIGH_PHOTONS_PER_ARCSEC2;
}

// ---- small statistics -------------------------------------------------------------------------------------------------
/** The upper median of a sample, and zero for an empty one. */
export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
}
/** The robust scatter of a sample: 1.4826 times the median absolute deviation, which is the standard deviation of a normal
 * one and is not moved by a few bright pixels. */
export function robustScatter(values: readonly number[]): number {
  const centre = median(values);
  return 1.4826 * median(values.map(value => Math.abs(value - centre)));
}
/** A mean with the outliers clipped at a multiple of the robust scatter. A *median* is wrong for a sky level on low counts:
 * on a Poisson sample of a few photons it sits below the mean and leaves a positive pedestal in the stack. */
export function clippedMean(values: readonly number[], sigma: number): number {
  if (!values.length) return 0;
  const centre = median(values), scatter = robustScatter(values);
  const kept = scatter > 0 ? values.filter(value => Math.abs(value - centre) < sigma * scatter) : values;
  return kept.reduce((total, value) => total + value, 0) / kept.length;
}

/** A least-squares quadratic through points already given as (offset, value), returned as a function of the offset.
 * Solved by Gaussian elimination on the three normal equations; a singular or empty system gives a flat zero. */
export function quadraticFit(points: readonly (readonly [number, number])[]): (offset: number) => number {
  let n = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const [u, v] of points) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) throw new RangeError('A quadratic fit takes finite points.');
    n++; s1 += u; s2 += u * u; s3 += u ** 3; s4 += u ** 4; t0 += v; t1 += u * v; t2 += u * u * v;
  }
  if (n < 3) return () => 0;
  const matrix = [[n, s1, s2], [s1, s2, s3], [s2, s3, s4]], right = [t0, t1, t2];
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(matrix[k]![i]!) > Math.abs(matrix[pivot]![i]!)) pivot = k;
    [matrix[i], matrix[pivot]] = [matrix[pivot]!, matrix[i]!]; [right[i], right[pivot]] = [right[pivot]!, right[i]!];
    if (matrix[i]![i]! === 0) return () => 0;
    for (let k = i + 1; k < 3; k++) {
      const factor = matrix[k]![i]! / matrix[i]![i]!;
      for (let j = i; j < 3; j++) matrix[k]![j]! -= factor * matrix[i]![j]!;
      right[k]! -= factor * right[i]!;
    }
  }
  const c = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = right[i]!;
    for (let j = i + 1; j < 3; j++) sum -= matrix[i]![j]! * c[j]!;
    c[i] = sum / matrix[i]![i]!;
  }
  return offset => c[0]! + c[1]! * offset + c[2]! * offset * offset;
}

// ---- the stack definition ---------------------------------------------------------------------------------------------
/** Which way image `+x` — increasing wavelength — lies on the sky, as a position angle from the frame's own `ORIENTAT`. */
export const HANDEDNESS = ['ORIENTAT-90', 'ORIENTAT+90'] as const;
export type Handedness = (typeof HANDEDNESS)[number];
/** `+1` puts increasing wavelength at `ORIENTAT-90`, which displayed with `+x` to the right is north up and east left. */
export const handednessSign = (handedness: Handedness) => handedness === 'ORIENTAT-90' ? 1 : -1;

export const SUBSET_RULES = ['every frame', 'east of the primary', 'west of the primary', 'target name matches'] as const;
export type SubsetRule = (typeof SUBSET_RULES)[number];

export interface StackLine { readonly id: string; readonly wavelengthAngstrom: number; readonly removeReflectedContinuum: boolean; readonly note?: string }
export interface StackSubset { readonly id: string; readonly rule: SubsetRule; readonly targetNamePattern?: string }
export interface StackRejection { readonly targetNamePattern: string; readonly minimumPrimaryLimbClearanceArcsec: number }
export interface StackGrid { readonly pixels: number; readonly halfWidthRadii: number }
export interface StackFrame {
  readonly name: string; readonly uri: string; readonly bytes: number; readonly sha256: string;
  readonly programme: string; readonly targetName: string;
  /** Why this frame is not stacked, as the rejection rule states it. Absent for a frame that is used. */
  readonly rejected?: string;
}
export interface StackHorizons {
  readonly observer: string; readonly target: string; readonly primary: string;
  readonly targetQuantities: string; readonly primaryQuantities: string;
  /** How many mid-exposure epochs one request asks for. It fixes which pinned response answers which frames. */
  readonly epochsPerRequest: number;
  /** The file beside the definition that holds those requests' raw text. */
  readonly responses: string;
}
export interface StackReduction {
  readonly readWindowAngstrom: readonly [number, number];
  readonly skyRowsFromDisc: readonly [number, number];
  readonly skyClipSigma: number;
  readonly continuumRowWindowAngstrom: readonly [number, number];
  readonly discProfileWindowAngstrom: readonly [number, number];
  readonly discProfileHalfHeightRadii: number;
  readonly continuumFitHalfWidthPixels: number;
  readonly lineMaskAngstrom: readonly (readonly [number, number])[];
  readonly rowSearchPixels: number;
  readonly rowDetectionContrast: number;
  readonly acrossSlitLineAngstrom: number;
  readonly acrossSlitHalfWidthArcsec: number;
  readonly acrossSlitMinimumSnr: number;
  readonly acrossSlitMaximumOffsetArcsec: number;
  readonly airglowOnDiscRadii: number;
  readonly airglowOffDiscRadii: readonly [number, number];
  /** A target the Sun does not light — a body in eclipse — reflects nothing, so neither the row nor the across-slit fit can
   * be made from reflected light and the pointing is taken as commanded. Frames whose target name matches are treated so. */
  readonly unlitTargetNamePattern: string;
}
/** A value someone else published, kept beside the stack so that a receipt can put this run's number next to it. `set` and
 * `metric` name what it is comparable with; a value with `valueHigh` is a published range rather than one number. */
export interface PublishedValue {
  readonly id: string; readonly quantity: string; readonly value: number; readonly uncertainty?: number; readonly valueHigh?: number;
  readonly unit: string; readonly source: string; readonly set?: string; readonly metric?: string;
}
export interface LineStackDefinition {
  readonly schema: 'cssearth-hst-line-stack@1';
  readonly id: string;
  readonly target: string;
  readonly bodyRadiusKm: number;
  readonly instrument: string;
  readonly opticalElement: string;
  readonly handedness: Handedness;
  readonly horizons: StackHorizons;
  readonly grid: StackGrid;
  readonly lines: readonly StackLine[];
  readonly subsets: readonly StackSubset[];
  readonly rejection: StackRejection;
  readonly reduction: StackReduction;
  readonly frames: readonly StackFrame[];
  readonly published: readonly PublishedValue[];
  /** What this stack's numbers rest on, kept beside the pin so that every receipt carries it: what the run measures, and
   * what it assumes or cannot show. A receipt states both, unsoftened. */
  readonly notes: { readonly measured: readonly string[]; readonly notVerified: readonly string[] };
}

const NAME = /^[a-z0-9][a-z0-9-]*$/u;
const pair = (value: unknown, label: string): [number, number] => {
  const values = requireArray(value, label).map(entry => requireFiniteNumber(entry, label));
  if (values.length !== 2) throw new TypeError(`${label} is a pair.`);
  return [values[0]!, values[1]!];
};
const ordered = (value: unknown, label: string): [number, number] => {
  const [low, high] = pair(value, label);
  if (!(low < high)) throw new TypeError(`${label} runs from low to high.`);
  return [low, high];
};
const positive = (value: unknown, label: string) => {
  const number = requireFiniteNumber(value, label);
  if (!(number > 0)) throw new TypeError(`${label} is positive.`);
  return number;
};

/** A pinned stack definition, with every external value checked. */
export function parseLineStack(value: unknown): LineStackDefinition {
  const row = requireRecord(value, 'line stack');
  if (row.schema !== 'cssearth-hst-line-stack@1') throw new TypeError('Unsupported HST line stack.');
  const id = requireString(row.id, 'Stack id');
  if (!NAME.test(id)) throw new TypeError(`${id} is not a stack id.`);
  const handedness = requireString(row.handedness, 'Handedness');
  if (!(HANDEDNESS as readonly string[]).includes(handedness)) throw new TypeError(`${handedness} is not a handedness.`);
  const horizonsRow = requireRecord(row.horizons, 'Horizons request');
  const epochsPerRequest = positive(horizonsRow.epochsPerRequest, 'Epochs per request');
  if (!Number.isSafeInteger(epochsPerRequest)) throw new TypeError('Epochs per request is a whole number.');
  const horizons: StackHorizons = {
    observer: requireString(horizonsRow.observer, 'Horizons observer'), target: requireString(horizonsRow.target, 'Horizons target'),
    primary: requireString(horizonsRow.primary, 'Horizons primary'), targetQuantities: requireString(horizonsRow.targetQuantities, 'Horizons quantities'),
    primaryQuantities: requireString(horizonsRow.primaryQuantities, 'Horizons quantities'), epochsPerRequest,
    responses: requireString(horizonsRow.responses, 'Horizons responses'),
  };
  if (!/^[A-Za-z0-9._-]+$/u.test(horizons.responses)) throw new TypeError('The pinned Horizons responses are a file name beside the definition.');
  const gridRow = requireRecord(row.grid, 'Grid');
  const pixels = positive(gridRow.pixels, 'Grid pixels'), halfWidthRadii = positive(gridRow.halfWidthRadii, 'Grid half width');
  if (!Number.isSafeInteger(pixels) || pixels < 3) throw new TypeError('A grid is at least three whole pixels across.');
  const lines = requireArray(row.lines, 'Lines').map((entry): StackLine => {
    const line = requireRecord(entry, 'Line'), lineId = requireString(line.id, 'Line id');
    if (!NAME.test(lineId)) throw new TypeError(`${lineId} is not a line id.`);
    if (typeof line.removeReflectedContinuum !== 'boolean') throw new TypeError(`${lineId}: state whether the reflected continuum is removed.`);
    return { id: lineId, wavelengthAngstrom: positive(line.wavelengthAngstrom, 'Line wavelength'), removeReflectedContinuum: line.removeReflectedContinuum,
      ...line.note === undefined ? {} : { note: requireString(line.note, 'Line note') } };
  });
  if (!lines.length) throw new TypeError('A stack extracts at least one line.');
  const subsets = requireArray(row.subsets, 'Subsets').map((entry): StackSubset => {
    const subset = requireRecord(entry, 'Subset'), subsetId = requireString(subset.id, 'Subset id'), rule = requireString(subset.rule, 'Subset rule');
    if (!NAME.test(subsetId)) throw new TypeError(`${subsetId} is not a subset id.`);
    if (!(SUBSET_RULES as readonly string[]).includes(rule)) throw new TypeError(`${rule} is not a subset rule.`);
    if (rule === 'target name matches') return { id: subsetId, rule, targetNamePattern: requireString(subset.targetNamePattern, 'Subset pattern') };
    return { id: subsetId, rule: rule as SubsetRule };
  });
  if (!subsets.length) throw new TypeError('A stack writes at least one subset.');
  for (const list of [lines.map(line => line.id), subsets.map(subset => subset.id)])
    if (new Set(list).size !== list.length) throw new TypeError('A line or subset id appears twice.');
  const rejectionRow = requireRecord(row.rejection, 'Rejection rule');
  const rejection: StackRejection = { targetNamePattern: requireString(rejectionRow.targetNamePattern, 'Rejection pattern'),
    minimumPrimaryLimbClearanceArcsec: positive(rejectionRow.minimumPrimaryLimbClearanceArcsec, 'Limb clearance') };
  const r = requireRecord(row.reduction, 'Reduction');
  const reduction: StackReduction = {
    readWindowAngstrom: ordered(r.readWindowAngstrom, 'Read window'), skyRowsFromDisc: ordered(r.skyRowsFromDisc, 'Sky rows'),
    skyClipSigma: positive(r.skyClipSigma, 'Sky clip'), continuumRowWindowAngstrom: ordered(r.continuumRowWindowAngstrom, 'Continuum row window'),
    discProfileWindowAngstrom: ordered(r.discProfileWindowAngstrom, 'Disc profile window'), discProfileHalfHeightRadii: positive(r.discProfileHalfHeightRadii, 'Disc profile height'),
    continuumFitHalfWidthPixels: positive(r.continuumFitHalfWidthPixels, 'Continuum fit width'),
    lineMaskAngstrom: requireArray(r.lineMaskAngstrom, 'Line mask').map(entry => ordered(entry, 'Line mask')),
    rowSearchPixels: positive(r.rowSearchPixels, 'Row search'), rowDetectionContrast: positive(r.rowDetectionContrast, 'Row contrast'),
    acrossSlitLineAngstrom: positive(r.acrossSlitLineAngstrom, 'Across-slit line'), acrossSlitHalfWidthArcsec: positive(r.acrossSlitHalfWidthArcsec, 'Across-slit width'),
    acrossSlitMinimumSnr: positive(r.acrossSlitMinimumSnr, 'Across-slit SNR'), acrossSlitMaximumOffsetArcsec: positive(r.acrossSlitMaximumOffsetArcsec, 'Across-slit offset'),
    airglowOnDiscRadii: positive(r.airglowOnDiscRadii, 'Airglow on-disc radius'), airglowOffDiscRadii: ordered(r.airglowOffDiscRadii, 'Airglow off-disc radii'),
    unlitTargetNamePattern: requireString(r.unlitTargetNamePattern, 'Unlit target pattern'),
  };
  const frames = requireArray(row.frames, 'Frames').map((entry): StackFrame => {
    const frame = requireRecord(entry, 'Frame'), name = requireString(frame.name, 'Frame name'), sha256 = requireString(frame.sha256, 'Frame digest');
    const bytes = requireFiniteNumber(frame.bytes, 'Frame bytes');
    if (!/^[a-z0-9]+_x2d\.fits$/u.test(name)) throw new TypeError(`${name} is not a rectified STIS product.`);
    if (requireString(frame.uri, 'Frame URI') !== `mast:HST/product/${name}`) throw new TypeError(`${name}: a frame is pinned by its MAST URI.`);
    if (!/^[0-9a-f]{64}$/u.test(sha256) || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`${name}: a frame is pinned by byte count and digest.`);
    return { name, uri: `mast:HST/product/${name}`, bytes, sha256, programme: requireString(frame.programme, 'Frame programme'),
      targetName: requireString(frame.targetName, 'Frame target'), ...frame.rejected === undefined ? {} : { rejected: requireString(frame.rejected, 'Rejection') } };
  });
  if (!frames.length) throw new TypeError('A stack pins at least one frame.');
  if (new Set(frames.map(frame => frame.name)).size !== frames.length) throw new TypeError('A frame is pinned twice.');
  const published = requireArray(row.published, 'Published values').map((entry): PublishedValue => {
    const value = requireRecord(entry, 'Published value');
    return { id: requireString(value.id, 'Published id'), quantity: requireString(value.quantity, 'Published quantity'),
      value: requireFiniteNumber(value.value, 'Published value'), unit: requireString(value.unit, 'Published unit'), source: requireString(value.source, 'Published source'),
      ...value.uncertainty === undefined ? {} : { uncertainty: requireFiniteNumber(value.uncertainty, 'Published uncertainty') },
      ...value.valueHigh === undefined ? {} : { valueHigh: requireFiniteNumber(value.valueHigh, 'Published range') },
      ...value.set === undefined ? {} : { set: requireString(value.set, 'Published set') },
      ...value.metric === undefined ? {} : { metric: requireString(value.metric, 'Published metric') } };
  });
  const notesRow = requireRecord(row.notes, 'Notes');
  const statements = (value: unknown, label: string) => requireArray(value, label).map(entry => requireString(entry, label));
  const notes = { measured: statements(notesRow.measured, 'Measured'), notVerified: statements(notesRow.notVerified, 'Not verified') };
  if (!notes.notVerified.length) throw new TypeError('A stack states what it does not verify.');
  return { schema: 'cssearth-hst-line-stack@1', id, target: requireString(row.target, 'Target'), bodyRadiusKm: positive(row.bodyRadiusKm, 'Body radius'),
    instrument: requireString(row.instrument, 'Instrument'), opticalElement: requireString(row.opticalElement, 'Optical element'),
    handedness: handedness as Handedness, horizons, grid: { pixels, halfWidthRadii }, lines, subsets, rejection, reduction, frames, published, notes };
}

// ---- selection --------------------------------------------------------------------------------------------------------
/** Why a frame is not stacked, or an empty string when it is kept.
 *
 * Two things spoil a long-slit image of a moon: the planet's disc behind it, and the planet's own scattered light beside it.
 * The first is named in the observation's target (a transit), the second is measured — the sky distance from the body to the
 * planet's limb at the frame's own epoch. */
export function rejectionReason(frame: { readonly targetName: string; readonly primaryLimbClearanceArcsec: number }, rule: StackRejection): string {
  if (new RegExp(rule.targetNamePattern, 'u').test(frame.targetName)) return 'transit target';
  if (frame.primaryLimbClearanceArcsec < rule.minimumPrimaryLimbClearanceArcsec) return `the primary's limb ${frame.primaryLimbClearanceArcsec.toFixed(1)}" away`;
  return '';
}

/** Whether a frame belongs to a subset. */
export function inSubset(frame: { readonly targetName: string; readonly eastOfPrimary: boolean }, subset: StackSubset): boolean {
  switch (subset.rule) {
    case 'every frame': return true;
    case 'east of the primary': return frame.eastOfPrimary;
    case 'west of the primary': return !frame.eastOfPrimary;
    case 'target name matches': return new RegExp(subset.targetNamePattern ?? '(?!)', 'u').test(frame.targetName);
  }
}

// ---- the output grid --------------------------------------------------------------------------------------------------
/** Where one output pixel sits in the body's frame, in body radii, `+x` right and `+y` up. The first row of the image is the
 * top one, which is the body's north. */
export function gridPoint(grid: StackGrid, column: number, row: number): { x: number; y: number } {
  return { x: ((column + 0.5) / grid.pixels * 2 - 1) * grid.halfWidthRadii, y: (1 - (row + 0.5) / grid.pixels * 2) * grid.halfWidthRadii };
}

/** Where a frame's body sits and how it is turned. `rotationRadians` is the body's north pole angle less the frame's
 * `ORIENTAT`: both are position angles on the sky, so their difference turns the detector's rows onto the body's north. */
export interface FramePlacement {
  readonly lineColumn: number; readonly discRow: number; readonly radiusPixels: number; readonly rotationRadians: number; readonly handedness: Handedness;
}
/** The detector sample one output pixel takes, nearest neighbour.
 *
 * `+y` on the detector is `ORIENTAT` on the sky, north when the rotation is zero; `+x` is a quarter turn from it, on the side
 * the handedness states. With `+x` at `ORIENTAT-90` and the output displayed with `+x` to the right, the picture is north up
 * and east left, the ordinary sky convention. */
export function sampleFor(point: { x: number; y: number }, placement: FramePlacement): { column: number; row: number } {
  const cos = Math.cos(placement.rotationRadians), sin = Math.sin(placement.rotationRadians), sign = handednessSign(placement.handedness);
  return { column: Math.round(placement.lineColumn + sign * placement.radiusPixels * (point.x * cos - point.y * sin)),
    row: Math.round(placement.discRow + placement.radiusPixels * (point.x * sin + point.y * cos)) };
}

// ---- the stack --------------------------------------------------------------------------------------------------------
export interface StackAccumulator {
  readonly pixels: number; readonly sum: Float64Array; readonly sumSquares: Float64Array; readonly weight: Float64Array; readonly count: Int32Array;
  exposureSeconds: number; readonly frames: string[];
}
export const newAccumulator = (pixels: number): StackAccumulator => ({ pixels, sum: new Float64Array(pixels * pixels), sumSquares: new Float64Array(pixels * pixels),
  weight: new Float64Array(pixels * pixels), count: new Int32Array(pixels * pixels), exposureSeconds: 0, frames: [] });

/** One sample of one frame, weighted by that frame's exposure. */
export function addSample(accumulator: StackAccumulator, index: number, rayleigh: number, exposureSeconds: number) {
  accumulator.sum[index]! += rayleigh * exposureSeconds;
  accumulator.sumSquares[index]! += rayleigh * rayleigh * exposureSeconds;
  accumulator.weight[index]! += exposureSeconds;
  accumulator.count[index]!++;
}

/** The exposure-weighted mean and its standard error, with pixels no frame reached left as NaN. */
export function accumulatedImage(accumulator: StackAccumulator): { values: Float64Array; errors: Float64Array } {
  const values = new Float64Array(accumulator.sum.length), errors = new Float64Array(accumulator.sum.length);
  for (let index = 0; index < values.length; index++) {
    const weight = accumulator.weight[index]!;
    if (weight <= 0) { values[index] = NaN; errors[index] = NaN; continue; }
    const mean = accumulator.sum[index]! / weight, variance = Math.max(0, accumulator.sumSquares[index]! / weight - mean * mean);
    values[index] = mean;
    errors[index] = accumulator.count[index]! > 1 ? Math.sqrt(variance / (accumulator.count[index]! - 1)) : NaN;
  }
  return { values, errors };
}

// ---- what the stack says ----------------------------------------------------------------------------------------------
/** The radius of a pixel's centre in body radii. */
const radiusAt = (grid: StackGrid, index: number) => {
  const point = gridPoint(grid, index % grid.pixels, Math.floor(index / grid.pixels));
  return Math.hypot(point.x, point.y);
};
/** The unweighted mean of the finite pixels in a ring. */
export function ringMean(values: Float64Array, grid: StackGrid, from: number, to: number): number {
  let sum = 0, count = 0;
  for (let index = 0; index < values.length; index++) {
    const value = values[index]!;
    if (!Number.isFinite(value)) continue;
    const radius = radiusAt(grid, index);
    if (radius >= from && radius < to) { sum += value; count++; }
  }
  return count ? sum / count : NaN;
}

export interface DiscMetrics {
  readonly discMeanRayleigh: number; readonly aboveLimbMeanRayleigh: number;
  readonly duskDawnRatio: number; readonly duskDawnRatioAboveLimb: number;
  readonly centroidRadii: readonly [number, number]; readonly peakRayleigh: number;
}
/** What a stacked image says about the body: how bright the disc is, how bright the ring just above the limb is, how much
 * brighter the `+x` half is than the `−x` half, where the brightness centre sits, and the brightest pixel.
 *
 * The halves are compared with a gap of `centreGapRadii` about the middle so that the comparison is of the two limbs and not
 * of the seam between them; above the limb the whole half is used, because there is no seam there. */
export function discMetrics(values: Float64Array, grid: StackGrid, discRadii = 1.25, aboveLimb: readonly [number, number] = [1.25, 1.5], centreGapRadii = 0.15): DiscMetrics {
  let disc = 0, discCount = 0, high = 0, highCount = 0, peak = -Infinity;
  let dusk = 0, duskCount = 0, dawn = 0, dawnCount = 0, duskHigh = 0, duskHighCount = 0, dawnHigh = 0, dawnHighCount = 0;
  let momentX = 0, momentY = 0, momentWeight = 0;
  for (let index = 0; index < values.length; index++) {
    const value = values[index]!;
    if (!Number.isFinite(value)) continue;
    const point = gridPoint(grid, index % grid.pixels, Math.floor(index / grid.pixels)), radius = Math.hypot(point.x, point.y);
    if (radius < discRadii) {
      disc += value; discCount++;
      if (point.x > centreGapRadii) { dusk += value; duskCount++; } else if (point.x < -centreGapRadii) { dawn += value; dawnCount++; }
      if (value > 0) { momentX += value * point.x; momentY += value * point.y; momentWeight += value; }
      peak = Math.max(peak, value);
    }
    if (radius >= aboveLimb[0] && radius < aboveLimb[1]) {
      high += value; highCount++;
      if (point.x > 0) { duskHigh += value; duskHighCount++; } else { dawnHigh += value; dawnHighCount++; }
    }
  }
  return { discMeanRayleigh: disc / discCount, aboveLimbMeanRayleigh: high / highCount,
    duskDawnRatio: (dusk / duskCount) / (dawn / dawnCount), duskDawnRatioAboveLimb: (duskHigh / duskHighCount) / (dawnHigh / dawnHighCount),
    centroidRadii: [momentX / momentWeight, momentY / momentWeight], peakRayleigh: peak };
}

/** The exposure-weighted radial profile, in rings of `step` body radii. `error` is the standard error over the pixels of the
 * ring; it says nothing about the far-field pedestal below, which is a systematic of the reduction. */
export function radialProfile(values: Float64Array, weights: Float64Array, grid: StackGrid, step: number): { radiusRadii: number; meanRayleigh: number; errorRayleigh: number; pixels: number }[] {
  const rings: { radiusRadii: number; meanRayleigh: number; errorRayleigh: number; pixels: number }[] = [];
  for (let from = 0; from < grid.halfWidthRadii - 1e-9; from += step) {
    const sample: number[] = [], sampleWeights: number[] = [];
    for (let index = 0; index < values.length; index++) {
      const value = values[index]!;
      if (!Number.isFinite(value)) continue;
      const radius = radiusAt(grid, index);
      if (radius >= from && radius < from + step) { sample.push(value); sampleWeights.push(weights[index]!); }
    }
    if (!sample.length) continue;
    const total = sampleWeights.reduce((a, b) => a + b, 0);
    const mean = sample.reduce((sum, value, i) => sum + value * sampleWeights[i]!, 0) / total;
    const spread = Math.sqrt(sample.reduce((sum, value, i) => sum + sampleWeights[i]! * (value - mean) ** 2, 0) / total);
    rings.push({ radiusRadii: from + step / 2, meanRayleigh: mean, errorRayleigh: spread / Math.sqrt(sample.length), pixels: sample.length });
  }
  return rings;
}

export interface LimbFallOff { readonly pedestalRayleigh: number; readonly limbRayleigh: number; readonly eFoldingKm: number; readonly rings: number }
/** How the glow falls away above the limb, as an exponential in radius fitted to the ring means after the far-field level is
 * removed. That far level is a background of the reduction rather than the body, so the fit is of what stands above it. */
export function limbFallOff(values: Float64Array, grid: StackGrid, bodyRadiusKm: number,
  window: readonly [number, number] = [1.05, 1.65], step = 0.05, pedestalRing: readonly [number, number] = [2.5, 3.0]): LimbFallOff {
  const pedestal = ringMean(values, grid, pedestalRing[0], pedestalRing[1]), points: [number, number][] = [];
  for (let radius = window[0]; radius < window[1] - 1e-9; radius += step) {
    const value = ringMean(values, grid, radius, radius + step) - pedestal;
    if (value > 0) points.push([(radius + step / 2 - 1) * bodyRadiusKm, Math.log(value)]);
  }
  const limb = ringMean(values, grid, 1.0, 1.0 + step) - pedestal;
  if (points.length < 2) return { pedestalRayleigh: pedestal, limbRayleigh: limb, eFoldingKm: NaN, rings: points.length };
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length, meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  let top = 0, bottom = 0;
  for (const [x, y] of points) { top += (x - meanX) * (y - meanY); bottom += (x - meanX) ** 2; }
  return { pedestalRayleigh: pedestal, limbRayleigh: limb, eFoldingKm: -bottom / top, rings: points.length };
}
