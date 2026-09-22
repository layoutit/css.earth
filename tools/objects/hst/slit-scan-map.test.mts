/** What the slit-scan band map does, checked without a network and without a Hubble product.
 *
 * The reduction is pure, so every step of it is put on a spectrum, a profile and a scan this file makes up and whose answer is
 * known in advance: the continuum fit, the band integral, the disc's chord, the across-slit centre a set of chords implies, the
 * two directions that place a sample on the sky, and the resampling that turns a scan into a picture. Two more checks read the
 * checked-in Europa scan itself and confirm that what the tool would run is what the definition pins. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { PROGRAMS } from './archive.mts';
import { overlapAgreement, readReferenceSpectrum, scanPath, strongest } from './slit-scan-map.mts';
import {
  acrossSlitCentre, acrossSlitSign, addFeatureless, apertureOffset, bandFromReflectance, bandStrength, discChord,
  featurelessMean, newFeatureless, parseSlitScan, polynomialFit, quantiles, ratioAgainst, referenceFlux, reflectance,
  scanImage, skyOffset, type ReferenceSpectrum, type ScanBand, type ScanReduction, type SlitScanDefinition,
} from './slit-scan-reduction.mts';

const REDUCTION: ScanReduction = { skyRowsFromDisc: [40, 110], discProfileWindowAngstrom: [4000, 5500], discEdgeFraction: 0.5,
  rowSearchPixels: 25, minimumHalfChordArcsec: 0.15, acrossSlitSearchArcsec: 0.3, acrossSlitStepArcsec: 0.002, imageHalfWidthRadii: 2.5 };
const BAND: ScanBand = { id: 'band', quantity: 'BAND STRENGTH', units: 'Angstrom', readWindowAngstrom: [3000, 5700],
  continuumWindowsAngstrom: [[3100, 3500], [5300, 5500]], continuumOrder: 3, bandAngstrom: [3500, 5300],
  minimumBandCoverage: 0.9, maximumBandGapPixels: 5,
  featurelessReference: { rule: 'no absorption in the first pass', note: 'test' } };
/** A reference spectrum with structure in it, so that dividing by it is a real step rather than a no-op. */
const reference = (): ReferenceSpectrum => {
  const count = 600, wavelengthAngstrom = new Float64Array(count), flux = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    wavelengthAngstrom[index] = 2900 + index * 5;
    flux[index] = 100 + 0.02 * (wavelengthAngstrom[index]! - 2900) + 8 * Math.sin(wavelengthAngstrom[index]! / 37);
  }
  return { wavelengthAngstrom, flux };
};

test('a polynomial fit returns the polynomial the points came from', () => {
  const x = Array.from({ length: 40 }, (_, index) => (index - 20) / 10);
  const truth = (value: number) => 1.5 - 0.75 * value + 2 * value ** 2 - 0.4 * value ** 3;
  const fitted = polynomialFit(x, x.map(truth), 3);
  for (const value of [-2, -0.3, 0, 1.1, 1.9]) assert.ok(Math.abs(fitted(value) - truth(value)) < 1e-9, `${value}`);
  assert.throws(() => polynomialFit([1, 2], [1, 2], 3), /needs more than 3 points/u);
  assert.throws(() => polynomialFit([1, 2, 3], [1, 2], 1), /as many abscissae as ordinates/u);
});

test('a reference spectrum is interpolated inside its range and refuses to answer outside it', () => {
  const spectrum: ReferenceSpectrum = { wavelengthAngstrom: Float64Array.from([100, 200, 400]), flux: Float64Array.from([1, 3, 7]) };
  assert.equal(referenceFlux(spectrum, 100), 1);
  assert.equal(referenceFlux(spectrum, 150), 2);
  assert.equal(referenceFlux(spectrum, 300), 5);
  assert.equal(referenceFlux(spectrum, 400), 7);
  assert.ok(Number.isNaN(referenceFlux(spectrum, 99)));
  assert.ok(Number.isNaN(referenceFlux(spectrum, 401)));
});

test('a band strength is the area of the absorption, and a spectrum with no band measures none', () => {
  const solar = reference();
  const spectrum = (depth: number) => {
    const wavelengthAngstrom: number[] = [], flux: number[] = [], error: number[] = [];
    for (let angstrom = 3000; angstrom <= 5700; angstrom += 2.746) {
      // A flat reflectance times the reference spectrum, with a Gaussian absorption of known area cut out of it.
      const absorbed = 1 - depth * Math.exp(-(((angstrom - 4500) / 300) ** 2) / 2);
      wavelengthAngstrom.push(angstrom); flux.push(0.6 * absorbed * referenceFlux(solar, angstrom)); error.push(0.0006 * referenceFlux(solar, angstrom));
    }
    return { wavelengthAngstrom, flux, error };
  };
  const flat = bandStrength(spectrum(0), solar, BAND);
  assert.ok(flat, 'a flat spectrum still measures');
  assert.ok(Math.abs(flat.equivalentWidthAngstrom) < 1, `a flat spectrum has no band: ${flat.equivalentWidthAngstrom}`);
  assert.ok(Math.abs(flat.continuumLevel - 0.6) < 1e-3, `${flat.continuumLevel}`);

  const absorbed = bandStrength(spectrum(0.05), solar, BAND);
  assert.ok(absorbed);
  // A Gaussian of depth 0.05 and sigma 300 A has area 0.05 * 300 * sqrt(2 pi) = 37.6 A; the continuum is fitted outside the
  // band, so what is measured is that area less whatever the wings put under the fit.
  assert.ok(Math.abs(absorbed.equivalentWidthAngstrom - 37.6) < 4, `${absorbed.equivalentWidthAngstrom}`);
  assert.ok(absorbed.sigmaAngstrom > 0 && absorbed.sigmaAngstrom < 2, `${absorbed.sigmaAngstrom}`);
  // A deeper band measures proportionally deeper.
  const deeper = bandStrength(spectrum(0.1), solar, BAND)!;
  assert.ok(Math.abs(deeper.equivalentWidthAngstrom / absorbed.equivalentWidthAngstrom - 2) < 0.02, `${deeper.equivalentWidthAngstrom}`);
});

test('a band strength is refused where the reference spectrum does not reach', () => {
  const solar: ReferenceSpectrum = { wavelengthAngstrom: Float64Array.from([5600, 5700]), flux: Float64Array.from([1, 1]) };
  const wavelengthAngstrom = Array.from({ length: 100 }, (_, index) => 3000 + index * 27);
  assert.equal(bandStrength({ wavelengthAngstrom, flux: wavelengthAngstrom.map(() => 1), error: wavelengthAngstrom.map(() => 0.01) }, solar, BAND), null);
});

test('the disc chord is the run of rows the body fills, and its middle is the body centre', () => {
  const profile = new Array(257).fill(0.02);
  for (let row = 110; row <= 129; row++) profile[row] = 1;
  const chord = discChord(profile, 125, REDUCTION, 0.0508);
  assert.equal(chord.centreRow, 119.5);
  assert.ok(Math.abs(chord.halfChordArcsec - 10 * 0.0508) < 1e-9, `${chord.halfChordArcsec}`);
  assert.equal(chord.peak, 1);
  // An empty slit gives no chord at all rather than a spurious one.
  assert.deepEqual(discChord(new Array(257).fill(0), 125, REDUCTION, 0.0508), { centreRow: 125, halfChordArcsec: 0, peak: 0 });
});

test('the across-slit centre is the offset the scan’s own chords imply', () => {
  const radius = 0.41, truth = 0.07;
  const steps = Array.from({ length: 15 }, (_, index) => {
    const postArg1Arcsec = -0.42 + index * 0.06;
    return { postArg1Arcsec, halfChordArcsec: Math.sqrt(Math.max(0, radius ** 2 - (postArg1Arcsec - truth) ** 2)) };
  });
  const centre = acrossSlitCentre(steps, radius, REDUCTION);
  assert.ok(Math.abs(centre.offsetArcsec - truth) <= REDUCTION.acrossSlitStepArcsec, `${centre.offsetArcsec}`);
  assert.ok(centre.rmsArcsec < 1e-3, `${centre.rmsArcsec}`);
  assert.ok(centre.steps >= 10 && centre.steps <= 15, `${centre.steps}`);
  assert.throws(() => acrossSlitCentre(steps.slice(0, 1), radius, REDUCTION), /three steps that cross the disc/u);
});

test('along the slit a sample lies on the slit’s own position angle, and across it on one of the two right angles', () => {
  // With the slit due north, a sample one arcsecond up the rows is one arcsecond north and nothing east.
  const along = skyOffset(1, 0, 0, 'ORIENTAT-90');
  assert.ok(Math.abs(along.north - 1) < 1e-12 && Math.abs(along.east) < 1e-12);
  // The across-slit axis is then east or west, and the two directions are that choice.
  assert.ok(Math.abs(skyOffset(0, 1, 0, 'ORIENTAT+90').east - 1) < 1e-12);
  assert.ok(Math.abs(skyOffset(0, 1, 0, 'ORIENTAT-90').east + 1) < 1e-12);
  assert.equal(acrossSlitSign('ORIENTAT+90'), 1);
  assert.equal(acrossSlitSign('ORIENTAT-90'), -1);
  // A slit at 90 degrees puts the rows due east.
  const rolled = skyOffset(1, 0, 90, 'ORIENTAT-90');
  assert.ok(Math.abs(rolled.east - 1) < 1e-12 && Math.abs(rolled.north) < 1e-12);
  for (const direction of ['ORIENTAT-90', 'ORIENTAT+90'] as const) for (const orientat of [0, 37.5, 90.382, 200]) {
    const sky = skyOffset(0.31, -0.17, orientat, direction), back = apertureOffset(sky.east, sky.north, orientat, direction);
    assert.ok(Math.abs(back.along - 0.31) < 1e-12 && Math.abs(back.across + 0.17) < 1e-12, `${direction} ${orientat}`);
  }
});

test('a scan resamples to a sky picture, and the opposite across-slit direction mirrors it', () => {
  const steps = 15, rows = 61, plateScaleArcsec = 0.05, postArg1Arcsec = Array.from({ length: steps }, (_, index) => -0.42 + index * 0.06);
  const value: (number | null)[][] = [], sigma: number[][] = [];
  for (let step = 0; step < steps; step++) {
    value.push(new Array(rows).fill(1)); sigma.push(new Array(rows).fill(0.1));
    // One step and one row carry a mark, at a known place in the scan: the tenth step (+0.12 arcseconds) and ten rows above
    // the centre.
    if (step === 9) value[step]![40] = 9;
  }
  const sampling = { postArg1Arcsec, value, sigma, discRow: 30, acrossSlitCentreArcsec: 0, plateScaleArcsec, orientatDegrees: 0 };
  const image = scanImage(sampling, 41, plateScaleArcsec, 'ORIENTAT-90');
  assert.ok(image.filled > 500, `${image.filled}`);
  const brightest = (depth: Float64Array) => {
    let best = -Infinity, at = -1;
    for (let cell = 0; cell < depth.length; cell++) if (Number.isFinite(depth[cell]!) && depth[cell]! > best) { best = depth[cell]!; at = cell; }
    return { x: at % 41, y: Math.floor(at / 41), value: best };
  };
  // The slit is due north, the mark sits ten rows above the disc centre, so it is ten pixels north of the middle. The step is
  // commanded +0.12 arcseconds, which carries the body -0.12 arcseconds through the slit: with +POSTARG1 at ORIENTAT-90 that
  // places the mark 0.12 arcseconds, a little over two pixels, east of the middle, and east is the left of the picture.
  const adopted = brightest(image.depth);
  assert.equal(adopted.y, 30, 'ten pixels north of the middle row');
  assert.equal(adopted.x, 18, 'a little over two pixels east of the middle column');
  const mirrored = brightest(scanImage(sampling, 41, plateScaleArcsec, 'ORIENTAT+90').depth);
  assert.equal(mirrored.y, 30, 'the along-slit place does not move');
  assert.equal(mirrored.x, 41 - 1 - adopted.x, 'the across-slit place reflects about the middle');
  assert.throws(() => scanImage(sampling, 40, plateScaleArcsec, 'ORIENTAT-90'), /odd number of pixels/u);
});

test('a reference spectrum is read out of the binary table it is distributed as', () => {
  const card = (key: string, value: string | number | boolean) =>
    `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value.padEnd(8)}'`.padEnd(20) : String(value === true ? 'T' : value).padStart(20)}`.padEnd(80);
  const block = (cards: readonly string[]) => { const text = [...cards, 'END'.padEnd(80)].join(''); return Buffer.from(text.padEnd(Math.ceil(text.length / 2880) * 2880), 'ascii'); };
  const rows = 3, data = Buffer.alloc(2880);
  [[3000, 5], [4000, 7], [5000, 11]].forEach(([wavelength, flux], row) => { data.writeFloatBE(wavelength!, row * 8); data.writeFloatBE(flux!, row * 8 + 4); });
  const bytes = Buffer.concat([
    block([card('SIMPLE', true), card('BITPIX', 8), card('NAXIS', 0), card('EXTEND', true)]),
    block([card('XTENSION', 'BINTABLE'), card('BITPIX', 8), card('NAXIS', 2), card('NAXIS1', 8), card('NAXIS2', rows), card('PCOUNT', 0), card('GCOUNT', 1),
      card('TFIELDS', 2), card('TFORM1', 'E'), card('TTYPE1', 'WAVELENGTH'), card('TFORM2', 'E'), card('TTYPE2', 'FLUX')]),
    data]);
  const definition = { reference: { name: 'test.fits', wavelengthColumn: 'WAVELENGTH', fluxColumn: 'FLUX' } } as unknown as SlitScanDefinition;
  const spectrum = readReferenceSpectrum(bytes, definition);
  assert.deepEqual([...spectrum.wavelengthAngstrom], [3000, 4000, 5000]);
  assert.deepEqual([...spectrum.flux], [5, 7, 11]);
  const wrongColumn = { reference: { name: 'test.fits', wavelengthColumn: 'LAMBDA', fluxColumn: 'FLUX' } } as unknown as SlitScanDefinition;
  assert.throws(() => readReferenceSpectrum(bytes, wrongColumn), /holds no LAMBDA/u);
});

test('the strongest cell and the quantiles are read off the grid the map states', () => {
  const definition = { grid: { width: 8, height: 4, maximumEmissionDegrees: 60 } } as unknown as SlitScanDefinition;
  const depth = new Float32Array(32).fill(Number.NaN);
  depth[8 + 2] = 5; depth[8 + 3] = 9; depth[16 + 1] = 1;
  const peak = strongest(definition, depth);
  assert.equal(peak.value, 9);
  assert.equal(peak.latitude, 90 - 1.5 * 45);
  assert.equal(peak.westLongitude, 360 - 3.5 * 45);
  assert.deepEqual(quantiles([3, 1, 2, 5, 4], [0, 0.5, 1]), [1, 3, 5]);
  assert.deepEqual(quantiles([3, Number.NaN, 1], [0.5]), [3]);
  assert.ok(quantiles([], [0.5]).every(Number.isNaN));
  assert.throws(() => strongest(definition, new Float32Array(32).fill(Number.NaN)), /kept no cell/u);
});

test('overlap agreement counts the pairs that disagree and how far apart they sit', () => {
  const agreement = overlapAgreement([{ first: 0, second: 1, cells: 100, rmsDifference: 10, correlation: 0.8 },
    { first: 0, second: 2, cells: 300, rmsDifference: 30, correlation: -0.5 }]);
  assert.equal(agreement.pairs, 2);
  assert.equal(agreement.negativePairs, 1);
  assert.equal(agreement.cells, 400);
  assert.equal(agreement.rmsDifference, 26.46);
  assert.equal(agreement.meanCorrelation, -0.175);
});

test('the pinned Europa scan is a scan this tool would run', async () => {
  const definition = parseSlitScan(JSON.parse(await readFile(scanPath('europa-salt-map'), 'utf8')));
  assert.equal(definition.instrument, 'STIS/CCD');
  assert.equal(definition.opticalElement, 'G430L');
  assert.equal(definition.aperture, '52X0.1');
  assert.equal(definition.frames.length, 60);
  assert.ok(definition.frames.every(frame => frame.programme === '14650'), 'every frame is programme 14650');
  assert.equal(new Set(definition.frames.map(frame => frame.name.slice(0, 6))).size, 4, 'four visits');
  // Every Horizons request the run will make is answered by the pinned responses, so a re-run asks the network for nothing.
  const responses = JSON.parse(await readFile(resolve(PROGRAMS, definition.horizons.responses), 'utf8')) as Record<string, string>;
  const keys = Object.keys(responses);
  assert.equal(keys.length, Math.ceil(definition.frames.length / definition.horizons.epochsPerRequest) * 2);
  assert.ok(keys.every(key => key.startsWith(`${definition.horizons.observer}|`) || key.startsWith(`${definition.horizons.sunObserver}|`)), 'the pinned requests are the scan’s own');
  assert.ok(Object.values(responses).every(text => text.includes('$$SOE') && text.includes('$$EOE')), 'every pinned response holds a table');
});

test('a scan definition is refused when it does not describe a scan', async () => {
  const good = JSON.parse(await readFile(scanPath('europa-salt-map'), 'utf8')) as Record<string, unknown>;
  const broken = (change: (value: Record<string, unknown>) => void) => { const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>; change(copy); return () => parseSlitScan(copy); };
  assert.throws(broken(value => { value.schema = 'something-else'; }), /Unsupported slit scan definition/u);
  assert.throws(broken(value => { (value.band as Record<string, unknown>).bandAngstrom = [2000, 5300]; }), /reaches outside the read window/u);
  assert.throws(broken(value => { (value.grid as Record<string, unknown>).width = 361; }), /twice as wide as it is tall/u);
  assert.throws(broken(value => { value.acrossSlitDirection = 'sideways'; }), /is not an across-slit direction/u);
  assert.throws(broken(value => { (value.frames as Record<string, unknown>[])[1] = (value.frames as Record<string, unknown>[])[0]!; }), /pinned twice/u);
  assert.throws(broken(value => { (value.frames as Record<string, unknown>[])[0]!.name = 'od9l12010_x1d.fits'; }), /not a rectified STIS product/u);
  assert.throws(broken(value => { (value.reference as Record<string, unknown>).url = 'http://example.invalid/x.fits'; }), /https URL/u);
  assert.throws(broken(value => { (value.band as Record<string, unknown>).continuumOrder = 0; }), /continuum order is a small whole number/u);
});

/** A row of a body whose reflectance has a known shape, seen through the reference spectrum. */
const row = (depth: number, tilt: number, solar: ReferenceSpectrum) => {
  const wavelengthAngstrom: number[] = [], flux: number[] = [], error: number[] = [];
  for (let angstrom = 3000; angstrom <= 5700; angstrom += 2.746) {
    const shape = (1 + tilt * (angstrom - 4400) / 1000) * (1 - depth * Math.exp(-(((angstrom - 4500) / 300) ** 2) / 2));
    wavelengthAngstrom.push(angstrom); flux.push(0.6 * shape * referenceFlux(solar, angstrom)); error.push(0.0006 * referenceFlux(solar, angstrom));
  }
  return { wavelengthAngstrom, flux, error };
};

test('reflectance is the flux over the reference, on the columns the reference reaches', () => {
  const solar: ReferenceSpectrum = { wavelengthAngstrom: Float64Array.from([3000, 4000]), flux: Float64Array.from([2, 4]) };
  const measured = reflectance({ wavelengthAngstrom: [2000, 3000, 3500, 4000, 5000], flux: [9, 2, 6, 8, 9], error: [1, 1, 3, 2, 1] }, solar);
  // The grid stays whole: a column the reference cannot answer becomes NaN in place, so the gap it leaves stays a gap.
  assert.deepEqual([...measured.wavelengthAngstrom], [2000, 3000, 3500, 4000, 5000]);
  assert.deepEqual([...measured.value].map(value => Number.isNaN(value) ? 'gap' : value), ['gap', 1, 2, 2, 'gap']);
  assert.deepEqual([...measured.error].map(value => Number.isNaN(value) ? 'gap' : value), ['gap', 0.5, 1, 0.5, 'gap']);
  const missing = reflectance({ wavelengthAngstrom: [3000, 3500, 4000], flux: [2, Number.NaN, 8], error: [1, 1, 2] }, solar);
  assert.equal(missing.wavelengthAngstrom.length, 3);
  assert.ok(Number.isNaN(missing.value[1]!));
});

test('the featureless spectrum is the weighted mean of the rows put into it, on one grid', () => {
  const empty = newFeatureless();
  assert.equal(featurelessMean(empty), null, 'nothing averages to nothing');
  const grid = [100, 200, 300];
  addFeatureless(empty, { wavelengthAngstrom: grid, value: [1, 2, 3], error: [0, 0, 0] }, 1);
  addFeatureless(empty, { wavelengthAngstrom: grid, value: [3, 4, 5], error: [0, 0, 0] }, 3);
  const mean = featurelessMean(empty);
  assert.deepEqual([...mean!.value], [2.5, 3.5, 4.5]);
  assert.equal(empty.rows, 2);
  // Errorless rows average to an errorless mean, but a mean of noisy ones carries the noise it is left with.
  assert.deepEqual([...mean!.error], [0, 0, 0]);
  assert.throws(() => addFeatureless(empty, { wavelengthAngstrom: [100, 200], value: [1, 2], error: [0, 0] }, 1), /one wavelength grid/u);
});

test('a row against the featureless spectrum measures no band where the two are the same', () => {
  const solar = reference(), featureless = reflectance(row(0, 0.05, solar), solar);
  const flat = bandFromReflectance(ratioAgainst(featureless, featureless), BAND)!;
  assert.ok(Math.abs(flat.equivalentWidthAngstrom) < 1e-6, `a spectrum against itself has no band: ${flat.equivalentWidthAngstrom}`);
  assert.throws(() => ratioAgainst(featureless, { wavelengthAngstrom: [1, 2], value: [1, 1], error: [0, 0] }), /one wavelength grid/u);
});

test('the ratio moves zero to where the band is absent without moving the band that is there', () => {
  const solar = reference();
  // Two rows with no band but different continuum curvature, and one with a band. The published continuum alone reads a band
  // strength off the curvature; against the mean of the two featureless rows, they read nothing and the third still reads.
  const featurelessRows = [reflectance(row(0, 0.02, solar), solar), reflectance(row(0, 0.09, solar), solar)];
  const banded = reflectance(row(0.05, 0.055, solar), solar);
  const accumulator = newFeatureless();
  for (const entry of featurelessRows) addFeatureless(accumulator, entry, 1);
  const featureless = featurelessMean(accumulator)!;
  const against = (entry: typeof banded) => bandFromReflectance(ratioAgainst(entry, featureless), BAND)!.equivalentWidthAngstrom;
  const median = (featurelessRows.map(against)[0]! + featurelessRows.map(against)[1]!) / 2;
  assert.ok(Math.abs(median) < 1, `the featureless rows average to no band: ${median}`);
  // The band survives, at close to the area it was given (0.05 * 300 * sqrt(2 pi) = 37.6 A).
  assert.ok(Math.abs(against(banded) - 37.6) < 5, `${against(banded)}`);
});

test('a scan definition is refused without a featureless rule or a resolution', async () => {
  const good = JSON.parse(await readFile(scanPath('europa-salt-map'), 'utf8')) as Record<string, unknown>;
  const broken = (change: (value: Record<string, unknown>) => void) => { const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>; change(copy); return () => parseSlitScan(copy); };
  assert.throws(broken(value => { ((value.band as Record<string, unknown>).featurelessReference as Record<string, unknown>).rule = 'whatever'; }), /not a featureless-reference rule/u);
  assert.throws(broken(value => { (value.grid as Record<string, unknown>).resolutionKm = 0; }), /positive size/u);
});

/** A flat spectrum on a regular grid, with independent noise of a stated size in the anchors and in the band. */
const noisy = (anchorError: number, bandError: number, noise: (index: number) => number = () => 0) => {
  const wavelengthAngstrom = Array.from({ length: 541 }, (_, index) => 3000 + index * 5);
  const anchor = (angstrom: number) => BAND.continuumWindowsAngstrom.some(([low, high]) => angstrom >= low && angstrom <= high);
  const error = wavelengthAngstrom.map(angstrom => anchor(angstrom) ? anchorError : bandError);
  return { wavelengthAngstrom, value: wavelengthAngstrom.map((angstrom, index) => 1 + noise(index) * (anchor(angstrom) ? anchorError : bandError)), error };
};

test('the band’s sigma carries the continuum fit’s own uncertainty, and a Monte Carlo agrees with it', () => {
  // The anchors' noise reaches the answer through the one continuum every band pixel is divided by, so raising it has to
  // raise the reported sigma: treating the fitted continuum as exact understates the error by two orders of magnitude.
  const low = bandFromReflectance(noisy(0.001, 0.001), BAND)!, high = bandFromReflectance(noisy(0.1, 0.001), BAND)!;
  assert.ok(Math.abs(high.sigmaAngstrom / low.sigmaAngstrom - 100) < 1, `sigma scales with the anchors: ${high.sigmaAngstrom / low.sigmaAngstrom}`);

  let seed = 4321;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  const widths: number[] = [], sigmas: number[] = [];
  for (let trial = 0; trial < 400; trial++) {
    const draw = new Map<number, number>();
    const measured = bandFromReflectance(noisy(0.01, 0.001, index => draw.get(index) ?? (draw.set(index, normal()), draw.get(index)!)), BAND)!;
    widths.push(measured.equivalentWidthAngstrom); sigmas.push(measured.sigmaAngstrom);
  }
  const mean = widths.reduce((total, value) => total + value, 0) / widths.length;
  const spread = Math.sqrt(widths.reduce((total, value) => total + (value - mean) ** 2, 0) / (widths.length - 1));
  const reported = sigmas.reduce((total, value) => total + value, 0) / sigmas.length;
  assert.ok(Math.abs(reported / spread - 1) < 0.1, `the reported sigma is the scatter of the answer: ${reported} against ${spread}`);
});

test('a band read through holes is refused, and a pixel stands only for its own bin', () => {
  const grid = Array.from({ length: 541 }, (_, index) => 3000 + index * 5);
  const line = (keep: (angstrom: number) => boolean) => ({ wavelengthAngstrom: grid,
    value: grid.map(angstrom => keep(angstrom) ? (angstrom === 4400 ? 0.5 : 1) : Number.NaN), error: grid.map(() => 0.001) });
  // One 5 A bin half absorbed, everything else observed: the band is 5 A wide times 50 per cent.
  const complete = bandFromReflectance(line(() => true), BAND)!;
  assert.ok(Math.abs(complete.equivalentWidthAngstrom - 2.5) < 1e-6, `${complete.equivalentWidthAngstrom}`);
  assert.equal(complete.bandCoverage, 1);
  assert.equal(complete.longestGapPixels, 0);
  // The same one bin, with the rest of the band unobserved. It must not stand for the whole band.
  assert.equal(bandFromReflectance(line(angstrom => !(angstrom > 3500 && angstrom < 5300) || angstrom === 4400), BAND), null);
  // A few scattered missing pixels are still measured, and the answer does not grow with the holes.
  const speckled = bandFromReflectance(line(angstrom => angstrom !== 4200 && angstrom !== 4600 && angstrom !== 5000), BAND)!;
  assert.ok(Math.abs(speckled.equivalentWidthAngstrom - 2.5) < 1e-6, `${speckled.equivalentWidthAngstrom}`);
  assert.ok(speckled.bandCoverage > 0.99 && speckled.bandCoverage < 1);
  // A run of missing pixels longer than the definition allows is refused even when most of the band is there.
  assert.equal(bandFromReflectance(line(angstrom => !(angstrom >= 4000 && angstrom <= 4040)), BAND), null);
});

test('a scan that lost an interior step leaves a gap rather than closing up', () => {
  // A field that rises linearly with the slit position, so a misplaced step reads a value that names it.
  const field = (steps: number[]) => scanImage({ postArg1Arcsec: steps, value: steps.map(step => Array(5).fill(step)), sigma: steps.map(() => Array(5).fill(1)),
    discRow: 2, acrossSlitCentreArcsec: 0, plateScaleArcsec: 1, orientatDegrees: 0 }, 11, 1, 'ORIENTAT-90').depth[5 * 11 + 3]!;
  assert.equal(field([0, 1, 2, 3, 4]), 2, 'the sky place that step 2 scanned reads 2');
  assert.ok(Number.isNaN(field([0, 1, 3, 4])), 'with that step gone the place is unread, not read as 3');
  // The steps either side of the hole are still placed by their own coordinates, not by counting slots.
  const kept = scanImage({ postArg1Arcsec: [0, 1, 3, 4], value: [0, 1, 3, 4].map(step => Array(5).fill(step)), sigma: [0, 1, 3, 4].map(() => Array(5).fill(1)),
    discRow: 2, acrossSlitCentreArcsec: 0, plateScaleArcsec: 1, orientatDegrees: 0 }, 11, 1, 'ORIENTAT-90');
  assert.equal(kept.depth[5 * 11 + 4], 1, 'the step at 1 is still at 1');
  assert.equal(kept.depth[5 * 11 + 1], 4, 'the step at 4 is still at 4');
  assert.throws(() => scanImage({ postArg1Arcsec: [0, 2, 1], value: [[1], [1], [1]], sigma: [[1], [1], [1]],
    discRow: 0, acrossSlitCentreArcsec: 0, plateScaleArcsec: 1, orientatDegrees: 0 }, 5, 1, 'ORIENTAT-90'), /steps rise/u);
});

test('the featureless spectrum carries its own error, and the ratio passes it on', () => {
  // Two independent samples of sigma 0.1, equally weighted, average to sigma 0.0707, not to nothing.
  const two = newFeatureless();
  addFeatureless(two, { wavelengthAngstrom: [100], value: [1], error: [0.1] }, 1);
  addFeatureless(two, { wavelengthAngstrom: [100], value: [1], error: [0.1] }, 1);
  const mean = featurelessMean(two)!;
  assert.ok(Math.abs(mean.error[0]! - 0.1 / Math.SQRT2) < 1e-12, `${mean.error[0]}`);
  assert.ok(Math.abs(mean.value[0]! - 1) < 1e-12);
  // Exposure weighting, and its matching error: sqrt(sum w^2 s^2) / sum w.
  const weighted = newFeatureless();
  addFeatureless(weighted, { wavelengthAngstrom: [100], value: [1], error: [0.1] }, 3);
  addFeatureless(weighted, { wavelengthAngstrom: [100], value: [1], error: [0.2] }, 1);
  assert.ok(Math.abs(featurelessMean(weighted)!.error[0]! - Math.hypot(3 * 0.1, 1 * 0.2) / 4) < 1e-12);

  // The ratio keeps the row's own noise apart from the spectrum's, and the spectrum's grows with it.
  const row = { wavelengthAngstrom: [100], value: [2], error: [0.02] };
  const quiet = ratioAgainst(row, { wavelengthAngstrom: [100], value: [1], error: [0] });
  const noisy = ratioAgainst(row, { wavelengthAngstrom: [100], value: [1], error: [0.05] });
  assert.ok(Math.abs(quiet.error[0]! - 0.02) < 1e-12 && quiet.commonError![0] === 0);
  assert.ok(Math.abs(noisy.error[0]! - 0.02) < 1e-12, 'the row\u2019s own error does not change');
  assert.ok(Math.abs(noisy.commonError![0]! - 2 * 0.05) < 1e-12, `r * sigma_d / d: ${noisy.commonError![0]}`);
});

test('a noisy shared reference reaches the band\u2019s sigma, and a Monte Carlo agrees with it', () => {
  const grid = Array.from({ length: 541 }, (_, index) => 3000 + index * 5);
  const flat = (error: number) => ({ wavelengthAngstrom: grid, value: grid.map(() => 1), error: grid.map(() => error) });
  const against = (referenceError: number) => bandFromReflectance(ratioAgainst(flat(1e-6), { wavelengthAngstrom: grid, value: grid.map(() => 1), error: grid.map(() => referenceError) }), BAND)!;
  const small = against(0.001), large = against(0.01);
  assert.ok(small.referenceSigmaAngstrom > 0, 'the reference reaches the answer at all');
  assert.ok(Math.abs(large.referenceSigmaAngstrom / small.referenceSigmaAngstrom - 10) < 0.01, `it grows with the reference: ${large.referenceSigmaAngstrom / small.referenceSigmaAngstrom}`);
  assert.ok(Math.abs(large.sigmaAngstrom - large.referenceSigmaAngstrom) < 1e-6, 'with a silent row the whole sigma is the reference');

  // Draw the shared reference itself and see the answer move by what the sigma says.
  let seed = 987654321;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  const widths: number[] = [];
  for (let trial = 0; trial < 400; trial++) {
    const drawn = { wavelengthAngstrom: grid, value: grid.map(() => 1 + normal() * 0.01), error: grid.map(() => 0.01) };
    widths.push(bandFromReflectance(ratioAgainst(flat(1e-6), drawn), BAND)!.equivalentWidthAngstrom);
  }
  const mean = widths.reduce((total, value) => total + value, 0) / widths.length;
  const spread = Math.sqrt(widths.reduce((total, value) => total + (value - mean) ** 2, 0) / (widths.length - 1));
  assert.ok(Math.abs(large.referenceSigmaAngstrom / spread - 1) < 0.1, `the reported reference sigma is the scatter: ${large.referenceSigmaAngstrom} against ${spread}`);
});
