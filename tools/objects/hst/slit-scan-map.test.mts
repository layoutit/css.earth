/** What the slit-scan band map does, checked without a network and without a Hubble product.
 *
 * The reduction is pure, so every step of it is put on a spectrum, a profile and a scan this file makes up and whose answer is
 * known in advance: the continuum fit, the band integral, the disc's chord, the across-slit centre a set of chords implies, the
 * two directions that place a sample on the sky, and the resampling that turns a scan into a picture. Two more checks read the
 * checked-in Europa scan itself and confirm that what the tool would run is what the definition pins. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { PROGRAMS } from './archive.mts';
import { overlapAgreement, readReferenceSpectrum, scanPath, strongest } from './slit-scan-map.mts';
import {
  acrossSlitCentre, acrossSlitSign, apertureOffset, bandStrength, discChord, parseSlitScan, polynomialFit, quantiles,
  referenceFlux, scanImage, skyOffset, type ReferenceSpectrum, type ScanBand, type ScanReduction, type SlitScanDefinition,
} from './slit-scan-reduction.mts';

const REDUCTION: ScanReduction = { skyRowsFromDisc: [40, 110], discProfileWindowAngstrom: [4000, 5500], discEdgeFraction: 0.5,
  rowSearchPixels: 25, minimumHalfChordArcsec: 0.15, acrossSlitSearchArcsec: 0.3, acrossSlitStepArcsec: 0.002, imageHalfWidthRadii: 2.5 };
const BAND: ScanBand = { id: 'band', quantity: 'BAND STRENGTH', units: 'Angstrom', readWindowAngstrom: [3000, 5700],
  continuumWindowsAngstrom: [[3100, 3500], [5300, 5500]], continuumOrder: 3, bandAngstrom: [3500, 5300] };
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
    // One step and one row carry a mark, at a known place in the scan: the tenth step — +0.12 arcseconds — and ten rows above
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
  // places the mark 0.12 arcseconds — a little over two pixels — east of the middle, and east is the left of the picture.
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
  assert.throws(broken(value => { (value.frames as Record<string, unknown>[])[0]!.sha256 = 'nope'; }), /byte count and sha256/u);
  assert.throws(broken(value => { (value.frames as Record<string, unknown>[])[0]!.name = 'od9l12010_x1d.fits'; }), /not a rectified STIS product/u);
  assert.throws(broken(value => { (value.reference as Record<string, unknown>).url = 'http://example.invalid/x.fits'; }), /pinned by https URL and sha256/u);
  assert.throws(broken(value => { (value.band as Record<string, unknown>).continuumOrder = 0; }), /continuum order is a small whole number/u);
});
