import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { compareImages, measureSource, readContinuumImage } from './alma-image.mts';

/** A synthetic ALMA-shaped continuum image: a limb-darkened disc of a stated size through a stated Gaussian beam. */
function syntheticImage(options: { size: number; pixelMas: number; discMas: number; beamMas: number; peak: number; noise?: number; seed?: number }) {
  const { size, pixelMas, discMas, beamMas, peak } = options;
  const cards: string[] = [];
  const card = (key: string, value: string) => cards.push(`${key.padEnd(8)}= ${value.padStart(20)}`.padEnd(80));
  card('SIMPLE', 'T'); card('BITPIX', '-32'); card('NAXIS', '2'); card('NAXIS1', String(size)); card('NAXIS2', String(size));
  card('CDELT1', (-pixelMas / 3.6e6).toExponential(10)); card('CDELT2', (pixelMas / 3.6e6).toExponential(10));
  card('BMAJ', (beamMas / 3.6e6).toExponential(10)); card('BMIN', (beamMas / 3.6e6).toExponential(10)); card('BPA', '0.0');
  const header = Buffer.from([...cards, 'END'.padEnd(80)].join('').padEnd(Math.ceil((cards.length + 1) * 80 / 2880) * 2880));
  const data = Buffer.alloc(Math.ceil(size * size * 4 / 2880) * 2880);
  // A disc convolved with a Gaussian, evaluated directly: the radial profile of a beam-smoothed disc is close enough to a
  // logistic falloff over one beam for a size measurement to be exercised.
  const sigma = beamMas / (2 * Math.sqrt(2 * Math.log(2)));
  let state = (options.seed ?? 1) >>> 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 4294967296) - 0.5; };
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - centre, y - centre) * pixelMas;
    const edge = 0.5 * (1 - Math.tanh((r - discMas / 2) / (sigma * 0.85)));
    data.writeFloatBE(peak * edge + (options.noise ?? 0) * random(), (y * size + x) * 4);
  }
  return Buffer.concat([header, data]);
}

test('a synthetic disc is measured back at its stated size, peak and beam coverage', () => {
  const bytes = syntheticImage({ size: 256, pixelMas: 2, discMas: 60, beamMas: 20, peak: 0.05, noise: 5e-5 });
  const image = readContinuumImage(bytes);
  assert.ok(Math.abs(image.pixelMas - 2) < 1e-6);
  assert.ok(Math.abs(image.beamMajorMas - 20) < 1e-6);
  const measured = measureSource(image);
  assert.ok(Math.abs(measured.halfPowerDiameterMas - 60) < 3, `half-power diameter ${measured.halfPowerDiameterMas}`);
  assert.ok(Math.abs(measured.peak - 0.05) / 0.05 < 0.05);
  assert.ok(measured.signalToNoise > 100);
  // A 60 mas disc through a 20 mas beam covers about nine beam areas.
  assert.ok(measured.beamAreas > 7 && measured.beamAreas < 12, `beam areas ${measured.beamAreas}`);
});

test('an image compared with itself matches, and a different size and peak are reported as such', () => {
  const same = readContinuumImage(syntheticImage({ size: 256, pixelMas: 2, discMas: 60, beamMas: 20, peak: 0.05 }));
  const self = compareImages(same, same);
  assert.ok(self.correlation > 0.999, `self correlation ${self.correlation}`);
  assert.equal(self.peakRatio, 1);
  assert.equal(self.diameterDifferenceMas, 0);
  const bigger = readContinuumImage(syntheticImage({ size: 256, pixelMas: 2, discMas: 72, beamMas: 20, peak: 0.1 }));
  const against = compareImages(bigger, same);
  assert.ok(Math.abs(against.peakRatio - 2) < 0.1, `peak ratio ${against.peakRatio}`);
  assert.ok(against.diameterDifferenceMas > 8, `diameter difference ${against.diameterDifferenceMas}`);
  // Two discs are still both discs: the correlation stays high and is not the size test.
  assert.ok(against.correlation > 0.8);
});

test('an image this route cannot measure is refused rather than guessed at', () => {
  const eightBit = syntheticImage({ size: 64, pixelMas: 2, discMas: 20, beamMas: 8, peak: 1 });
  const broken = Buffer.from(eightBit); broken.write('BITPIX  =                    8', 80);
  assert.throws(() => readContinuumImage(broken), /32-bit floating point/u);
  const oblong = Buffer.from(eightBit); oblong.write(`CDELT2  = ${(3 / 3.6e6).toExponential(10).padStart(20)}`, 6 * 80);
  assert.throws(() => readContinuumImage(oblong), /square pixels/u);
});
