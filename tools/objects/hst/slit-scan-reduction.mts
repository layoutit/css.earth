/** The arithmetic of turning STIS long-slit scans of a body into a map of one absorption band.
 *
 * A narrow slit stepped across a resolved disc samples the surface twice over: along the slit the detector rows are already a
 * picture, and the steps themselves are the second axis. Each row is a whole spectrum, so an absorption band can be measured in
 * every one of them and the measurements laid back on the body.
 *
 * Everything here is pure and covered by [slit-scan.test.mts](slit-scan.test.mts): the pinned definition and its validation, the
 * continuum fit and band integral, the disc geometry read off the scan itself, and the two directions that place a sample on the
 * sky. The parts that read files, ask JPL Horizons and write products are in [slit-scan-map.mts](slit-scan-map.mts). */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

const DEGREE = Math.PI / 180;
/** How much wider than a scan's own step an interval may be before it counts as a slit position the scan never took. */
export const MISSING_STEP_INTERVAL = 1.5;

// ---- the pinned definition --------------------------------------------------------------------------------------------
/** Which way the aperture's first axis (the one `POSTARG1` steps along) lies on the sky, relative to the slit's own position
 * angle. Along the slit the direction is settled (rows grow along `+PA_APER`); across it, it is not, and a scan has to
 * establish it from the data before its map means anything. */
export const ACROSS_SLIT_DIRECTIONS = ['ORIENTAT-90', 'ORIENTAT+90'] as const;
export type AcrossSlitDirection = (typeof ACROSS_SLIT_DIRECTIONS)[number];
/** The sign `skyOffset` uses: `+1` puts `+POSTARG1` at `ORIENTAT+90`, `-1` at `ORIENTAT-90`. */
export const acrossSlitSign = (direction: AcrossSlitDirection) => direction === 'ORIENTAT+90' ? 1 : -1;

export interface ScanFrame {
  readonly name: string; readonly uri: string; readonly bytes: number;
  readonly programme: string; readonly targetName: string;
  /** Why this frame takes no part, empty when it does. A rejection is pinned, so a run that disagrees is an error. */
  readonly rejected?: string;
}
/** A spectrum pinned beside the scan and divided into every extracted row to turn it into reflectance. */
export interface ScanReference {
  readonly name: string; readonly url: string; readonly bytes: number;
  readonly wavelengthColumn: string; readonly fluxColumn: string; readonly note: string;
}
export interface ScanHorizons {
  readonly observer: string; readonly target: string; readonly sunObserver: string; readonly sun: string;
  readonly targetQuantities: string; readonly sunQuantities: string;
  readonly epochsPerRequest: number; readonly responses: string;
}
export interface ScanOrientation { readonly kind: 'iau-pck'; readonly path: string; readonly body: number }
export interface ScanBand {
  readonly id: string; readonly quantity: string; readonly units: string;
  /** The columns every frame is read over. Every other window has to fit inside it. */
  readonly readWindowAngstrom: readonly [number, number];
  /** The windows the continuum polynomial is fitted over, and its order. */
  readonly continuumWindowsAngstrom: readonly (readonly [number, number])[];
  readonly continuumOrder: number;
  /** The window the continuum-removed residual is integrated over, which is the band. */
  readonly bandAngstrom: readonly [number, number];
  /** How much of the band has to have been observed before it is measured at all: the least share of its pixels that may
   * carry a value, and the longest run of them that may not. A band read through holes is not measured, never interpolated. */
  readonly minimumBandCoverage: number;
  readonly maximumBandGapPixels: number;
  /** How the spectrum every row is ratioed against, the one that fixes where zero is, is built. */
  readonly featurelessReference: FeaturelessReference;
}
/** The published method fits a polynomial continuum to each spectrum on its own. That sets no common zero: a polynomial
 * anchored outside the band follows each spectrum's own shape, so a place whose reflectance curves differently between the
 * anchors reads a band strength it does not have. The remedy is the paper's own, stated for its highest-quality spectrum:
 * divide by the average of the spectra that show no band, and measure every row against that. */
export const FEATURELESS_RULES = ['no absorption in the first pass'] as const;
export type FeaturelessRule = (typeof FEATURELESS_RULES)[number];
export interface FeaturelessReference { readonly rule: FeaturelessRule; readonly note: string }
export interface ScanReduction {
  /** Rows this far from the disc, and no further, give the background subtracted from every column. */
  readonly skyRowsFromDisc: readonly [number, number];
  /** The window whose reflected sunlight shows the body's own profile along the slit. */
  readonly discProfileWindowAngstrom: readonly [number, number];
  /** The fraction of the profile's peak the disc's edges are taken at. */
  readonly discEdgeFraction: number;
  /** How far either side of the commanded row the disc is looked for, in rows. */
  readonly rowSearchPixels: number;
  /** A step whose chord is shorter than this says nothing about where the disc centre is. */
  readonly minimumHalfChordArcsec: number;
  /** How far either side of zero the across-slit disc centre is searched for, and at what spacing, in arcseconds. */
  readonly acrossSlitSearchArcsec: number;
  readonly acrossSlitStepArcsec: number;
  /** Half-width of each visit's sky image, in body radii. */
  readonly imageHalfWidthRadii: number;
}
export interface ScanGrid { readonly width: number; readonly height: number; readonly maximumEmissionDegrees: number;
  /** The size of one resolution element on the body, km. Map cells are far smaller than it, so they are not independent, and
   * a median over them is only as well determined as the number of resolution elements it covers. */
  readonly resolutionKm: number }
export interface PublishedValue { readonly claim: string; readonly source: string; readonly value?: string }
export interface SlitScanDefinition {
  readonly schema: 'cssearth-hst-slit-scan-map@1';
  readonly id: string; readonly target: string; readonly bodyRadiusKm: number;
  readonly instrument: string; readonly opticalElement: string; readonly aperture: string;
  readonly acrossSlitDirection: AcrossSlitDirection;
  readonly horizons: ScanHorizons; readonly orientation: ScanOrientation; readonly reference: ScanReference;
  readonly band: ScanBand; readonly reduction: ScanReduction; readonly grid: ScanGrid;
  readonly published: readonly PublishedValue[];
  readonly notes: { readonly method: readonly string[]; readonly measured: readonly string[]; readonly notVerified: readonly string[] };
  readonly frames: readonly ScanFrame[];
}

const window = (value: unknown, label: string): readonly [number, number] => {
  const pair = requireArray(value, label).map(entry => requireFiniteNumber(entry, label));
  if (pair.length !== 2 || !(pair[0]! < pair[1]!)) throw new TypeError(`${label} is a rising pair of wavelengths.`);
  return [pair[0]!, pair[1]!];
};
const inside = (outer: readonly [number, number], inner: readonly [number, number], label: string) => {
  if (inner[0] < outer[0] || inner[1] > outer[1]) throw new TypeError(`${label} reaches outside the read window.`);
};

/** The pinned scan definition, validated. Nothing about one body is written into the tool, so everything the reduction needs
 * is read from here and every value is checked before a frame is opened. */
export function parseSlitScan(value: unknown): SlitScanDefinition {
  const row = requireRecord(value, 'slit scan');
  if (row.schema !== 'cssearth-hst-slit-scan-map@1') throw new TypeError('Unsupported slit scan definition.');
  const id = requireString(row.id, 'id');
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) throw new TypeError(`${id} is not a scan id.`);
  const bodyRadiusKm = requireFiniteNumber(row.bodyRadiusKm, 'bodyRadiusKm');
  if (!(bodyRadiusKm > 0)) throw new TypeError('A body has a positive radius.');
  const direction = requireString(row.acrossSlitDirection, 'acrossSlitDirection');
  if (!(ACROSS_SLIT_DIRECTIONS as readonly string[]).includes(direction)) throw new TypeError(`${direction} is not an across-slit direction.`);

  const horizonsRow = requireRecord(row.horizons, 'horizons');
  const epochsPerRequest = requireFiniteNumber(horizonsRow.epochsPerRequest, 'epochsPerRequest');
  if (!Number.isSafeInteger(epochsPerRequest) || epochsPerRequest < 1) throw new TypeError('epochsPerRequest is a positive whole number.');
  const horizons: ScanHorizons = { observer: requireString(horizonsRow.observer, 'observer'), target: requireString(horizonsRow.target, 'target'),
    sunObserver: requireString(horizonsRow.sunObserver, 'sunObserver'), sun: requireString(horizonsRow.sun, 'sun'),
    targetQuantities: requireString(horizonsRow.targetQuantities, 'targetQuantities'), sunQuantities: requireString(horizonsRow.sunQuantities, 'sunQuantities'),
    epochsPerRequest, responses: requireString(horizonsRow.responses, 'responses') };

  const orientationRow = requireRecord(row.orientation, 'orientation');
  if (orientationRow.kind !== 'iau-pck') throw new TypeError('The rotation model is an IAU text PCK.');
  const body = requireFiniteNumber(orientationRow.body, 'orientation body');
  if (!Number.isSafeInteger(body)) throw new TypeError('An IAU pole model names its NAIF body code.');
  const orientation: ScanOrientation = { kind: 'iau-pck', path: requireString(orientationRow.path, 'orientation path'), body };

  const referenceRow = requireRecord(row.reference, 'reference');
  const reference: ScanReference = { name: requireString(referenceRow.name, 'reference name'), url: requireString(referenceRow.url, 'reference url'),
    bytes: requireFiniteNumber(referenceRow.bytes, 'reference bytes'),
    wavelengthColumn: requireString(referenceRow.wavelengthColumn, 'wavelengthColumn'), fluxColumn: requireString(referenceRow.fluxColumn, 'fluxColumn'),
    note: requireString(referenceRow.note, 'reference note') };
  if (!/^https:\/\//u.test(reference.url)) throw new TypeError('The reference spectrum names an https URL.');

  const bandRow = requireRecord(row.band, 'band');
  const readWindowAngstrom = window(bandRow.readWindowAngstrom, 'readWindowAngstrom');
  const bandAngstrom = window(bandRow.bandAngstrom, 'bandAngstrom');
  const continuumWindowsAngstrom = requireArray(bandRow.continuumWindowsAngstrom, 'continuumWindowsAngstrom').map(entry => window(entry, 'continuum window'));
  const continuumOrder = requireFiniteNumber(bandRow.continuumOrder, 'continuumOrder');
  if (!Number.isSafeInteger(continuumOrder) || continuumOrder < 1 || continuumOrder > 5) throw new TypeError('The continuum order is a small whole number.');
  if (!continuumWindowsAngstrom.length) throw new TypeError('A continuum is fitted over at least one window.');
  inside(readWindowAngstrom, bandAngstrom, 'bandAngstrom');
  for (const entry of continuumWindowsAngstrom) inside(readWindowAngstrom, entry, 'a continuum window');
  const featurelessRow = requireRecord(bandRow.featurelessReference, 'featurelessReference');
  const rule = requireString(featurelessRow.rule, 'featureless rule');
  if (!(FEATURELESS_RULES as readonly string[]).includes(rule)) throw new TypeError(`${rule} is not a featureless-reference rule.`);
  const minimumBandCoverage = requireFiniteNumber(bandRow.minimumBandCoverage, 'minimumBandCoverage');
  const maximumBandGapPixels = requireFiniteNumber(bandRow.maximumBandGapPixels, 'maximumBandGapPixels');
  if (!(minimumBandCoverage > 0) || !(minimumBandCoverage <= 1)) throw new TypeError('minimumBandCoverage is a share of the band above nothing and at most all of it.');
  if (!Number.isSafeInteger(maximumBandGapPixels) || maximumBandGapPixels < 0) throw new TypeError('maximumBandGapPixels is a whole number of pixels.');
  const band: ScanBand = { id: requireString(bandRow.id, 'band id'), quantity: requireString(bandRow.quantity, 'band quantity'),
    units: requireString(bandRow.units, 'band units'), readWindowAngstrom, continuumWindowsAngstrom, continuumOrder, bandAngstrom,
    minimumBandCoverage, maximumBandGapPixels,
    featurelessReference: { rule: rule as FeaturelessRule, note: requireString(featurelessRow.note, 'featureless note') } };

  const reductionRow = requireRecord(row.reduction, 'reduction');
  const skyRowsFromDisc = window(reductionRow.skyRowsFromDisc, 'skyRowsFromDisc');
  const discProfileWindowAngstrom = window(reductionRow.discProfileWindowAngstrom, 'discProfileWindowAngstrom');
  inside(readWindowAngstrom, discProfileWindowAngstrom, 'discProfileWindowAngstrom');
  const positive = (key: string) => { const n = requireFiniteNumber(reductionRow[key], key); if (!(n > 0)) throw new TypeError(`${key} is positive.`); return n; };
  const discEdgeFraction = positive('discEdgeFraction');
  if (!(discEdgeFraction < 1)) throw new TypeError('discEdgeFraction is a fraction of the profile peak.');
  const reduction: ScanReduction = { skyRowsFromDisc, discProfileWindowAngstrom, discEdgeFraction,
    rowSearchPixels: positive('rowSearchPixels'), minimumHalfChordArcsec: positive('minimumHalfChordArcsec'),
    acrossSlitSearchArcsec: positive('acrossSlitSearchArcsec'), acrossSlitStepArcsec: positive('acrossSlitStepArcsec'),
    imageHalfWidthRadii: positive('imageHalfWidthRadii') };

  const gridRow = requireRecord(row.grid, 'grid');
  const grid: ScanGrid = { width: requireFiniteNumber(gridRow.width, 'grid width'), height: requireFiniteNumber(gridRow.height, 'grid height'),
    maximumEmissionDegrees: requireFiniteNumber(gridRow.maximumEmissionDegrees, 'maximumEmissionDegrees'),
    resolutionKm: requireFiniteNumber(gridRow.resolutionKm, 'resolutionKm') };
  if (!(grid.resolutionKm > 0)) throw new TypeError('A resolution element has a positive size.');
  if (!Number.isSafeInteger(grid.width) || !Number.isSafeInteger(grid.height) || grid.width !== 2 * grid.height)
    throw new TypeError('A full-world grid is twice as wide as it is tall.');
  if (!(grid.maximumEmissionDegrees > 0) || !(grid.maximumEmissionDegrees < 90)) throw new TypeError('The emission limit is inside a right angle.');

  const frames = requireArray(row.frames, 'frames').map(entry => {
    const frame = requireRecord(entry, 'frame'), name = requireString(frame.name, 'frame name');
    if (!/^[a-z0-9]+_x2d\.fits$/u.test(name)) throw new TypeError(`${name} is not a rectified STIS product.`);
    if (frame.uri !== `mast:HST/product/${name}`) throw new TypeError(`${name} is pinned by its own MAST URI.`);
    const bytes = requireFiniteNumber(frame.bytes, 'frame bytes');
    if (!Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`${name} carries its byte count.`);
    const rejected = frame.rejected === undefined ? undefined : requireString(frame.rejected, 'frame rejected');
    return { name, uri: frame.uri, bytes, programme: requireString(frame.programme, 'programme'), targetName: requireString(frame.targetName, 'targetName'),
      ...rejected === undefined ? {} : { rejected } };
  });
  if (!frames.length) throw new TypeError('A scan pins at least one frame.');
  if (new Set(frames.map(frame => frame.name)).size !== frames.length) throw new TypeError('A frame is pinned twice.');

  const published = requireArray(row.published ?? [], 'published').map(entry => {
    const value = requireRecord(entry, 'published value');
    return { claim: requireString(value.claim, 'claim'), source: requireString(value.source, 'source'),
      ...value.value === undefined ? {} : { value: requireString(value.value, 'value') } };
  });
  const notesRow = requireRecord(row.notes, 'notes');
  const lines = (key: string) => requireArray(notesRow[key], key).map(entry => requireString(entry, key));
  return { schema: 'cssearth-hst-slit-scan-map@1', id, target: requireString(row.target, 'target'), bodyRadiusKm,
    instrument: requireString(row.instrument, 'instrument'), opticalElement: requireString(row.opticalElement, 'opticalElement'),
    aperture: requireString(row.aperture, 'aperture'), acrossSlitDirection: direction as AcrossSlitDirection,
    horizons, orientation, reference, band, reduction, grid, published,
    notes: { method: lines('method'), measured: lines('measured'), notVerified: lines('notVerified') }, frames };
}

// ---- the band ---------------------------------------------------------------------------------------------------------
/** A polynomial of the given order through the points, by normal equations with Gauss-Jordan elimination, together with the
 * inverse of its normal matrix. The abscissa is scaled by the caller; over a few thousand Ångström the raw wavelength would
 * make the normal matrix hopeless.
 *
 * The inverse is what carries the fit's own uncertainty. A continuum fitted to noisy anchor pixels is not exact, and the same
 * fitted curve divides every pixel of the band, so the anchors' noise enters the band's integral once, correlated across it.
 * `normalInverse` is (AᵀA)⁻¹ for the unweighted estimator this uses, from which `bandFromReflectance` builds the derivative
 * of the answer with respect to every pixel that went into it. */
export interface PolynomialFit {
  readonly coefficients: readonly number[];
  /** (AᵀA)⁻¹ for the fitted basis, symmetric, of side `order + 1`. */
  readonly normalInverse: readonly (readonly number[])[];
  evaluate(value: number): number;
}
/** The basis this fits in: 1, t, t², … up to the order. */
export const polynomialBasis = (value: number, order: number) => Array.from({ length: order + 1 }, (_, power) => value ** power);

export function polynomialFitDetail(x: readonly number[], y: readonly number[], order: number): PolynomialFit {
  if (x.length !== y.length) throw new RangeError('A fit takes as many abscissae as ordinates.');
  if (x.length <= order) throw new RangeError(`A polynomial of order ${order} needs more than ${order} points.`);
  const size = order + 1, columns = size + 1 + size;
  // [ AᵀA | Aᵀy | I ]: one elimination gives the coefficients and the inverse together.
  const matrix = Array.from({ length: size }, () => new Float64Array(columns));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) { let total = 0; for (let k = 0; k < x.length; k++) total += x[k]! ** (i + j); matrix[i]![j] = total; }
    let total = 0;
    for (let k = 0; k < x.length; k++) total += y[k]! * x[k]! ** i;
    matrix[i]![size] = total;
    matrix[i]![size + 1 + i] = 1;
  }
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let candidate = column + 1; candidate < size; candidate++) if (Math.abs(matrix[candidate]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = candidate;
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    const divisor = matrix[column]![column]!;
    if (!Number.isFinite(divisor) || divisor === 0) throw new RangeError('The continuum fit is singular.');
    for (let j = column; j < columns; j++) matrix[column]![j]! /= divisor;
    for (let r = 0; r < size; r++) if (r !== column) { const factor = matrix[r]![column]!; for (let j = column; j < columns; j++) matrix[r]![j]! -= factor * matrix[column]![j]!; }
  }
  const coefficients = Array.from({ length: size }, (_, i) => matrix[i]![size]!);
  const normalInverse = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => matrix[i]![size + 1 + j]!));
  return { coefficients, normalInverse,
    evaluate: value => coefficients.reduce((total, coefficient, power) => total + coefficient * value ** power, 0) };
}
/** The fitted polynomial alone, for callers that do not need its uncertainty. */
export const polynomialFit = (x: readonly number[], y: readonly number[], order: number) => polynomialFitDetail(x, y, order).evaluate;

/** A reference spectrum as two rising, matched arrays, linearly interpolated. */
export interface ReferenceSpectrum { readonly wavelengthAngstrom: Float64Array; readonly flux: Float64Array }
export function referenceFlux(reference: ReferenceSpectrum, angstrom: number): number {
  const wavelengths = reference.wavelengthAngstrom, last = wavelengths.length - 1;
  if (!(angstrom >= wavelengths[0]!) || !(angstrom <= wavelengths[last]!)) return Number.NaN;
  let low = 0, high = last;
  while (high - low > 1) { const middle = (low + high) >> 1; if (wavelengths[middle]! <= angstrom) low = middle; else high = middle; }
  const span = wavelengths[high]! - wavelengths[low]!;
  const fraction = span > 0 ? (angstrom - wavelengths[low]!) / span : 0;
  return reference.flux[low]! * (1 - fraction) + reference.flux[high]! * fraction;
}

export interface BandStrength {
  /** The width of a complete absorption with the same area, in Ångström: positive where the band absorbs. */
  readonly equivalentWidthAngstrom: number;
  /** Everything this row's answer is uncertain by: its own noise and the shared spectrum's, added in quadrature. */
  readonly sigmaAngstrom: number;
  /** The part of that which came from the one spectrum every row was divided by. It is the same draw everywhere, so it does
   * not average down over a map, and a mean of many cells is no better determined than this. */
  readonly referenceSigmaAngstrom: number;
  /** The fitted continuum's mean level across the band, in the reflectance the division produced. */
  readonly continuumLevel: number;
  /** The share of the band's pixels that were observed, and the longest run of them that was not. */
  readonly bandCoverage: number;
  readonly longestGapPixels: number;
}
/** One row turned into reflectance: its flux divided by the reference spectrum.
 *
 * **The grid is kept whole.** A column the reference does not reach, or one the frame has no value for, becomes NaN in place
 * rather than disappearing. Dropping it would close the gap it left, and every later step measures wavelength intervals from
 * the neighbours it can see: a band observed at one pixel would then integrate as though that pixel stood for all of it. */
export interface Reflectance {
  readonly wavelengthAngstrom: readonly number[]; readonly value: readonly number[]; readonly error: readonly number[];
  /** The part of the error every row carries alike, because it came from one spectrum they were all divided by. It travels
   * beside the row's own noise instead of inside it: within one row it behaves like any other per-wavelength error, but it is
   * the same draw in every row, so it does not average down over a map and must never be added in as though it did. */
  readonly commonError?: readonly number[];
}
export function reflectance(spectrum: { readonly wavelengthAngstrom: readonly number[]; readonly flux: readonly number[]; readonly error: readonly number[] },
  reference: ReferenceSpectrum): Reflectance {
  const wavelengthAngstrom = [...spectrum.wavelengthAngstrom], value: number[] = [], error: number[] = [];
  for (let index = 0; index < wavelengthAngstrom.length; index++) {
    const solar = referenceFlux(reference, wavelengthAngstrom[index]!), flux = spectrum.flux[index]!;
    const usable = solar > 0 && Number.isFinite(flux);
    value.push(usable ? flux / solar : Number.NaN); error.push(usable ? Math.abs(spectrum.error[index]!) / solar : Number.NaN);
  }
  return { wavelengthAngstrom, value, error };
}

/** The mean of the rows that show no band, on the one wavelength grid every frame of a scan shares. A row whose grid differs
 * is refused rather than interpolated: the whole point of the ratio is that the two spectra carry the same instrument. */
export interface FeaturelessAccumulator { wavelengthAngstrom: readonly number[] | null; sum: Float64Array | null; weight: Float64Array | null;
  /** Sum of w²σ² per column, which is the numerator of the weighted mean's own variance. */
  squaredWeight: Float64Array | null; rows: number }
export const newFeatureless = (): FeaturelessAccumulator => ({ wavelengthAngstrom: null, sum: null, weight: null, squaredWeight: null, rows: 0 });
export function addFeatureless(accumulator: FeaturelessAccumulator, row: Reflectance, weight: number) {
  if (!accumulator.sum) { accumulator.wavelengthAngstrom = row.wavelengthAngstrom; accumulator.sum = new Float64Array(row.value.length);
    accumulator.weight = new Float64Array(row.value.length); accumulator.squaredWeight = new Float64Array(row.value.length); }
  if (accumulator.wavelengthAngstrom!.length !== row.wavelengthAngstrom.length || accumulator.wavelengthAngstrom![0] !== row.wavelengthAngstrom[0])
    throw new RangeError('A featureless reference is built on one wavelength grid.');
  // A column this row has no value for takes no part in that column's mean, and only in that column's.
  for (let index = 0; index < row.value.length; index++) {
    if (!Number.isFinite(row.value[index]!)) continue;
    accumulator.sum[index]! += weight * row.value[index]!; accumulator.weight![index]! += weight;
    const sigma = row.error[index]!;
    accumulator.squaredWeight![index]! += (weight * (Number.isFinite(sigma) ? sigma : 0)) ** 2;
  }
  accumulator.rows++;
}
/** The accumulated featureless spectrum and its own error, NaN in any column no row filled, or null when no row showed no
 * band.
 *
 * It is a plain weighted mean, the weight being each row's exposure, not an inverse-variance one: the rows differ in where
 * they are on the body far more than in how noisy they are, and weighting by noise would quietly let the brightest ground
 * decide what zero is. Its error is the matching one for that mean, `sqrt(sum w² σ²) / sum w`, so two independent samples of
 * sigma 0.1 average to sigma 0.0707 rather than to nothing. */
export function featurelessMean(accumulator: FeaturelessAccumulator): Reflectance | null {
  if (!accumulator.sum || !accumulator.rows) return null;
  const value = Array.from(accumulator.sum, (total, index) => accumulator.weight![index]! > 0 ? total / accumulator.weight![index]! : Number.NaN);
  const error = value.map((_, index) => accumulator.weight![index]! > 0 ? Math.sqrt(accumulator.squaredWeight![index]!) / accumulator.weight![index]! : Number.NaN);
  return { wavelengthAngstrom: accumulator.wavelengthAngstrom!, value, error };
}

/** One row against the featureless spectrum. Dividing two spectra the same instrument took at the same resolution cancels
 * whatever the reference spectrum got wrong (the same solar lines sit in both), and it moves zero to where the band is
 * absent, rather than to wherever a polynomial fitted outside the band happens to land. */
export function ratioAgainst(row: Reflectance, featureless: Reflectance): Reflectance {
  if (row.wavelengthAngstrom.length !== featureless.wavelengthAngstrom.length || row.wavelengthAngstrom[0] !== featureless.wavelengthAngstrom[0])
    throw new RangeError('A row and the featureless spectrum are on one wavelength grid.');
  const value: number[] = [], error: number[] = [], commonError: number[] = [];
  for (let index = 0; index < row.value.length; index++) {
    const divisor = featureless.value[index]!, numerator = row.value[index]!;
    if (!(divisor > 0)) { value.push(Number.NaN); error.push(Number.NaN); commonError.push(Number.NaN); continue; }
    // r = y / d, so the row's own noise enters as sigma_y / d and the spectrum's as r * sigma_d / d. The second is the same
    // draw for every row, so it is kept apart from the first rather than summed into it.
    const divisorSigma = featureless.error[index], shared = row.commonError?.[index];
    value.push(numerator / divisor);
    error.push(row.error[index]! / divisor);
    const fromDivisor = Number.isFinite(divisorSigma) ? Math.abs(numerator) * divisorSigma! / (divisor * divisor) : 0;
    const carried = Number.isFinite(shared) ? shared! / divisor : 0;
    commonError.push(Math.hypot(fromDivisor, carried));
  }
  return { wavelengthAngstrom: row.wavelengthAngstrom, value, error, commonError };
}

/** One row's band strength: a polynomial continuum fitted over the windows that skip the band, and the continuum-removed
 * residual integrated across it. */
export function bandFromReflectance(row: Reflectance, band: ScanBand): BandStrength | null {
  const count = row.wavelengthAngstrom.length;
  const middle = (band.readWindowAngstrom[0] + band.readWindowAngstrom[1]) / 2, scale = 1000;
  const abscissa = (angstrom: number) => (angstrom - middle) / scale;
  // Every pixel keeps the width of its own bin, taken from the grid the frame was read on. A pixel whose neighbours are
  // missing still stands for its own bin and no more: widening it would let a band nobody observed integrate to a detection.
  const width = (index: number) => {
    const before = row.wavelengthAngstrom[index - 1], after = row.wavelengthAngstrom[index + 1];
    if (before !== undefined && after !== undefined) return (after - before) / 2;
    if (after !== undefined) return after - row.wavelengthAngstrom[index]!;
    if (before !== undefined) return row.wavelengthAngstrom[index]! - before;
    return 0;
  };
  const inBand = (angstrom: number) => angstrom >= band.bandAngstrom[0] && angstrom <= band.bandAngstrom[1];
  const inAnchor = (angstrom: number) => band.continuumWindowsAngstrom.some(([low, high]) => angstrom >= low && angstrom <= high);

  // The band has to be observed before it can be measured: enough of its pixels, and no long stretch of them missing.
  let bandPixels = 0, observed = 0, gap = 0, longestGap = 0;
  for (let index = 0; index < count; index++) {
    if (!inBand(row.wavelengthAngstrom[index]!)) continue;
    bandPixels++;
    if (Number.isFinite(row.value[index]!)) { observed++; gap = 0; } else { gap++; longestGap = Math.max(longestGap, gap); }
  }
  if (!bandPixels || observed / bandPixels < band.minimumBandCoverage || longestGap > band.maximumBandGapPixels) return null;

  const fitX: number[] = [], fitY: number[] = [], fitIndex: number[] = [];
  for (let index = 0; index < count; index++) {
    const angstrom = row.wavelengthAngstrom[index]!;
    if (!inAnchor(angstrom) || !Number.isFinite(row.value[index]!)) continue;
    fitX.push(abscissa(angstrom)); fitY.push(row.value[index]!); fitIndex.push(index);
  }
  if (fitX.length <= band.continuumOrder * 4) return null;
  const fit = polynomialFitDetail(fitX, fitY, band.continuumOrder), order = band.continuumOrder;

  // The answer's derivative with respect to every pixel that went into it, so that one variance covers both the band pixels'
  // own noise and the anchors' noise carried through the one continuum they all share.
  const derivative = new Float64Array(count);
  const gradient = new Float64Array(order + 1);
  let equivalentWidth = 0, level = 0, samples = 0;
  for (let index = 0; index < count; index++) {
    const angstrom = row.wavelengthAngstrom[index]!;
    if (!inBand(angstrom) || !Number.isFinite(row.value[index]!)) continue;
    const fitted = fit.evaluate(abscissa(angstrom));
    if (!(fitted > 0)) return null;
    const bin = width(index);
    equivalentWidth += (1 - row.value[index]! / fitted) * bin;
    derivative[index]! -= bin / fitted;
    // d(equivalent width)/d(continuum at this pixel), gathered onto the fitted coefficients through this pixel's basis.
    const share = row.value[index]! * bin / (fitted * fitted), basis = polynomialBasis(abscissa(angstrom), order);
    for (let power = 0; power <= order; power++) gradient[power]! += share * basis[power]!;
    level += fitted; samples++;
  }
  if (!samples || !Number.isFinite(equivalentWidth)) return null;
  // h = (AᵀA)⁻¹ g carries that gradient back onto the anchor pixels the coefficients came from.
  const carried = Array.from({ length: order + 1 }, (_, i) => {
    let total = 0;
    for (let j = 0; j <= order; j++) total += fit.normalInverse[i]![j]! * gradient[j]!;
    return total;
  });
  for (let anchor = 0; anchor < fitIndex.length; anchor++) {
    const basis = polynomialBasis(fitX[anchor]!, order);
    let total = 0;
    for (let power = 0; power <= order; power++) total += basis[power]! * carried[power]!;
    derivative[fitIndex[anchor]!]! += total;
  }
  // One derivative vector, two errors carried through it: the row's own noise, independent from cell to cell, and the shared
  // spectrum's, which is independent from wavelength to wavelength inside this row but identical in every other row.
  let variance = 0, common = 0;
  for (let index = 0; index < count; index++) {
    if (derivative[index] === 0) continue;
    const sigma = row.error[index]!, shared = row.commonError?.[index];
    if (Number.isFinite(sigma)) variance += (derivative[index]! * sigma) ** 2;
    if (Number.isFinite(shared)) common += (derivative[index]! * shared!) ** 2;
  }
  return { equivalentWidthAngstrom: equivalentWidth, sigmaAngstrom: Math.sqrt(variance + common), referenceSigmaAngstrom: Math.sqrt(common),
    continuumLevel: level / samples, bandCoverage: observed / bandPixels, longestGapPixels: longestGap };
}

/** The first pass: reflectance straight into the continuum fit, which is what the published method does to each spectrum on
 * its own. It sets no common zero, and the receipt reports what it gave beside what the ratio gave. */
export const bandStrength = (spectrum: { readonly wavelengthAngstrom: readonly number[]; readonly flux: readonly number[]; readonly error: readonly number[] },
  reference: ReferenceSpectrum, band: ScanBand) => bandFromReflectance(reflectance(spectrum, reference), band);

// ---- the disc in the scan ---------------------------------------------------------------------------------------------
export interface Chord { readonly centreRow: number; readonly halfChordArcsec: number; readonly peak: number }
/** Where the disc crosses the slit in one frame, from the sunlight it reflects: the rows between the two places where the
 * along-slit profile falls to a fraction of its peak. That is the body's chord at this step, and its middle is the body's
 * centre along the slit. */
export function discChord(profile: readonly number[], commandedRow: number, reduction: ScanReduction, plateScaleArcsec: number): Chord {
  const first = Math.max(0, Math.round(commandedRow - reduction.rowSearchPixels));
  const last = Math.min(profile.length - 1, Math.round(commandedRow + reduction.rowSearchPixels));
  let peak = -Infinity, peakRow = Math.round(commandedRow);
  for (let row = first; row <= last; row++) if (profile[row]! > peak) { peak = profile[row]!; peakRow = row; }
  if (!(peak > 0)) return { centreRow: commandedRow, halfChordArcsec: 0, peak: 0 };
  const edge = peak * reduction.discEdgeFraction;
  let low = peakRow, high = peakRow;
  while (low > 0 && profile[low - 1]! > edge) low--;
  while (high < profile.length - 1 && profile[high + 1]! > edge) high++;
  return { centreRow: (low + high) / 2, halfChordArcsec: (high - low + 1) / 2 * plateScaleArcsec, peak };
}

export interface AcrossSlitCentre { readonly offsetArcsec: number; readonly rmsArcsec: number; readonly steps: number }
/** Where the disc centre sits across the slit, from the chords alone: a step at across-slit distance `d` from the centre cuts a
 * half-chord of `sqrt(R² − d²)`, so the offset that best explains every step's chord is the centre. The body's radius comes
 * from the ephemeris, so this measures the pointing rather than assuming it. */
export function acrossSlitCentre(steps: readonly { readonly postArg1Arcsec: number; readonly halfChordArcsec: number }[],
  radiusArcsec: number, reduction: ScanReduction): AcrossSlitCentre {
  const used = steps.filter(step => step.halfChordArcsec >= reduction.minimumHalfChordArcsec);
  if (used.length < 3) throw new Error(`A scan needs three steps that cross the disc; ${used.length} did.`);
  let best = 0, bestCost = Infinity;
  for (let offset = -reduction.acrossSlitSearchArcsec; offset <= reduction.acrossSlitSearchArcsec + 1e-12; offset += reduction.acrossSlitStepArcsec) {
    let cost = 0;
    for (const step of used) cost += (step.halfChordArcsec - Math.sqrt(Math.max(0, radiusArcsec ** 2 - (step.postArg1Arcsec - offset) ** 2))) ** 2;
    if (cost < bestCost) { bestCost = cost; best = offset; }
  }
  return { offsetArcsec: best, rmsArcsec: Math.sqrt(bestCost / used.length), steps: used.length };
}

// ---- the two directions -----------------------------------------------------------------------------------------------
/** Where a sample sits on the sky, in arcseconds east and north of the body centre.
 *
 * `alongArcsec` runs along the slit, positive toward higher detector rows, which lie along `+ORIENTAT`. `acrossArcsec` runs
 * along the aperture's first axis, which lies ninety degrees away. On which side is what `direction` states. */
export function skyOffset(alongArcsec: number, acrossArcsec: number, orientatDegrees: number, direction: AcrossSlitDirection): { east: number; north: number } {
  const angle = orientatDegrees * DEGREE, sign = acrossSlitSign(direction);
  return { east: alongArcsec * Math.sin(angle) + sign * acrossArcsec * Math.cos(angle),
    north: alongArcsec * Math.cos(angle) - sign * acrossArcsec * Math.sin(angle) };
}
/** The inverse: which sample a place on the sky was taken by. */
export function apertureOffset(east: number, north: number, orientatDegrees: number, direction: AcrossSlitDirection): { along: number; across: number } {
  const angle = orientatDegrees * DEGREE, sign = acrossSlitSign(direction);
  return { along: east * Math.sin(angle) + north * Math.cos(angle), across: sign * (east * Math.cos(angle) - north * Math.sin(angle)) };
}

// ---- the scan as a picture --------------------------------------------------------------------------------------------
export interface ScanSampling {
  /** The steps in the order they were taken across the slit, by their commanded offset, and the reading of each row at each. */
  readonly postArg1Arcsec: readonly number[];
  readonly value: readonly (readonly (number | null)[])[];
  readonly sigma: readonly (readonly number[])[];
  /** The body centre: which detector row, and which commanded across-slit offset. */
  readonly discRow: number; readonly acrossSlitCentreArcsec: number;
  readonly plateScaleArcsec: number; readonly orientatDegrees: number;
}
export interface ScanImage { readonly pixels: number; readonly arcsecPerPixel: number; readonly depth: Float64Array; readonly error: Float64Array; readonly filled: number }

/** One visit's scan on a square sky grid, north up and east left, the layout `projectBandMap` reads, stored bottom row first.
 *
 * Each output pixel is carried back to the step and row that sampled it and read there by bilinear interpolation, so the
 * picture is the scan's own sampling resampled once, with nothing invented between steps the scan did not take. */
export function scanImage(sampling: ScanSampling, pixels: number, arcsecPerPixel: number, direction: AcrossSlitDirection): ScanImage {
  if (!Number.isSafeInteger(pixels) || pixels < 3 || pixels % 2 === 0) throw new RangeError('A scan image is an odd number of pixels across.');
  const steps = sampling.postArg1Arcsec;
  if (steps.length < 2) throw new RangeError('A scan holds at least two steps.');
  for (let index = 1; index < steps.length; index++) if (!(steps[index]! > steps[index - 1]!)) throw new RangeError('A scan\u2019s steps rise.');
  // The scan's own step, as the median of the intervals it actually holds. A wider interval is a step the scan does not have,
  // because its frame was never taken or was rejected, and nothing is read across it.
  const intervals = steps.slice(1).map((value, index) => value - steps[index]!).sort((a, b) => a - b);
  const spacing = intervals[intervals.length >> 1]!;
  if (!(spacing > 0)) throw new RangeError('A scan steps by a non-zero amount.');
  const widestReadableInterval = spacing * MISSING_STEP_INTERVAL;
  const half = (pixels - 1) / 2, depth = new Float64Array(pixels * pixels).fill(Number.NaN), error = new Float64Array(pixels * pixels).fill(Number.NaN);
  const rows = sampling.value[0]!.length;
  let filled = 0;
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
    const north = (y - half) * arcsecPerPixel, east = -(x - half) * arcsecPerPixel;
    const offset = apertureOffset(east, north, sampling.orientatDegrees, direction);
    // The body-relative across-slit offset is the negative of the commanded step, because stepping the telescope one way
    // carries the body the other way through the slit.
    const commanded = sampling.acrossSlitCentreArcsec - offset.across;
    const rowPlace = sampling.discRow + offset.along / sampling.plateScaleArcsec;
    // Which two steps actually bracket this place, by their own commanded offsets rather than by counting array slots.
    let stepLow = -1;
    for (let index = 0; index + 1 < steps.length; index++) if (commanded >= steps[index]! && commanded <= steps[index + 1]!) { stepLow = index; break; }
    if (stepLow < 0) continue;
    // A bracket wider than the scan's own step spans a slit position the scan never took. Reading across it would invent the
    // surface in between, so the gap stays a gap.
    if (steps[stepLow + 1]! - steps[stepLow]! > widestReadableInterval) continue;
    const rowLow = Math.floor(rowPlace);
    if (rowLow < 0 || rowLow + 1 >= rows) continue;
    const stepFraction = (commanded - steps[stepLow]!) / (steps[stepLow + 1]! - steps[stepLow]!), rowFraction = rowPlace - rowLow;
    const corners = [[stepLow, rowLow], [stepLow + 1, rowLow], [stepLow, rowLow + 1], [stepLow + 1, rowLow + 1]] as const;
    const weights = [(1 - stepFraction) * (1 - rowFraction), stepFraction * (1 - rowFraction), (1 - stepFraction) * rowFraction, stepFraction * rowFraction];
    const values = corners.map(([step, row]) => sampling.value[step]![row]!);
    if (values.some(value => value === null || value === undefined || !Number.isFinite(value))) continue;
    let sum = 0, variance = 0;
    corners.forEach(([step, row], index) => { sum += weights[index]! * values[index]!; variance += (weights[index]! * sampling.sigma[step]![row]!) ** 2; });
    depth[y * pixels + x] = sum; error[y * pixels + x] = Math.sqrt(variance); filled++;
  }
  return { pixels, arcsecPerPixel, depth, error, filled };
}

/** The quantiles a receipt states, over the values a map kept. */
export function quantiles(values: readonly number[], fractions: readonly number[]): number[] {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return fractions.map(() => Number.NaN);
  return fractions.map(fraction => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))))]!);
}
