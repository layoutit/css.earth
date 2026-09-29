import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readArrayPlane, type SkyPlane } from './disc-envelope.mts';
import { midplaneGeometry } from './edge-on-disc.mts';


/** A synthetic edge-on disc to render: density falling as a power of the radius in the plane of the midplane, a gaussian height
 * over a floor, tilted from edge-on toward the stated side (sky basis east, north, toward the observer; x is west). */
interface EdgeOnDiscModel { positionAngleDeg: number; inclinationDeg: number; starOffsetUnits: number; nearSidePositionAngleDeg: number; slope: number; referenceUnits: number; heightOfRadius: number; minimumHeightUnits: number }
function edgeOnDiscDensity(model: EdgeOnDiscModel) {
  const phi = model.positionAngleDeg * Math.PI / 180, i = model.inclinationDeg * Math.PI / 180;
  const along = [Math.sin(phi), Math.cos(phi)], minor = [Math.cos(phi), -Math.sin(phi)];
  const near = Math.cos((model.nearSidePositionAngleDeg - (model.positionAngleDeg + 90)) * Math.PI / 180) >= 0 ? 1 : -1;
  const inPlaneMinor = [minor[0]! * Math.cos(i), minor[1]! * Math.cos(i), near * Math.sin(i)], normal = [-near * minor[0]! * Math.sin(i), -near * minor[1]! * Math.sin(i), Math.cos(i)];
  return (x: number, y: number, z: number) => {
    const e = -x, n = y, a = e * along[0]! + n * along[1]!, b = e * inPlaneMinor[0]! + n * inPlaneMinor[1]! + z * inPlaneMinor[2]!;
    const height = e * normal[0]! + n * normal[1]! + z * normal[2]!, radius = Math.hypot(a, b), h = Math.max(model.minimumHeightUnits, model.heightOfRadius * radius);
    return (Math.max(radius, model.minimumHeightUnits) / model.referenceUnits) ** model.slope * Math.exp(-((height / h) ** 2) / 2);
  };
}

const SIZE = 96, HALF = 150, STEP = 2 * HALF / SIZE;

/** A sky plane rendered from a density: each column integrated along the line of sight, plus a stated noise. */
function render(density: (x: number, y: number, z: number) => number, noise: number): SkyPlane {
  const plane = new Float32Array(SIZE * SIZE);
  let seed = 11;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 - 0.5; };
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const x = -HALF + (i + 0.5) * STEP, y = -HALF + (j + 0.5) * STEP;
    let column = 0;
    for (let k = 0; k < SIZE; k++) column += density(x, y, -HALF + (k + 0.5) * STEP) * STEP;
    plane[j * SIZE + i] = column + noise * random() * 3.4;
  }
  return { size: SIZE, halfUnits: HALF, step: STEP, plane, background: 0, noise, backgroundPixels: 1000, mosaicArcsecPerPixel: 0.03, starPixel: [0, 0], unit: 'contrast' };
}
const disc: EdgeOnDiscModel = { positionAngleDeg: 30, inclinationDeg: 89, starOffsetUnits: 0, nearSidePositionAngleDeg: 300, slope: -2.5, referenceUnits: 40, heightOfRadius: 0.04, minimumHeightUnits: 6 };

test('the midplane of an edge-on disc is recovered from its own projection', () => {
  const sky = render(edgeOnDiscDensity(disc), 0.002);
  const geometry = midplaneGeometry(sky, { innerMaskUnits: 40, outerUnits: 130, halfHeightUnits: 20 });
  assert.ok(Math.abs(geometry.positionAngleDeg - 30) < 1, `position angle ${geometry.positionAngleDeg}`);
  assert.ok(Math.abs(geometry.starOffsetUnits) < 1.5, `offset ${geometry.starOffsetUnits}`);
});

test('the midplane is measured on its ridge, not pulled toward a fainter tilted component', () => {
  // A main disc at 30 degrees and a secondary one a fifth as bright, tilted 6 degrees from it: the ridge stays on the main disc.
  const main = edgeOnDiscDensity(disc), secondary = edgeOnDiscDensity({ ...disc, positionAngleDeg: 36 });
  const sky = render((x, y, z) => main(x, y, z) + 0.2 * secondary(x, y, z), 0.002);
  const geometry = midplaneGeometry(sky, { innerMaskUnits: 40, outerUnits: 130, halfHeightUnits: 20 });
  assert.ok(Math.abs(geometry.positionAngleDeg - 30) < 1.5, `position angle ${geometry.positionAngleDeg}`);
});

/** A minimal FITS primary image, BITPIX -64, big-endian. */
function fitsImage(width: number, height: number, value: (x: number, y: number) => number) {
  const cards = [`SIMPLE  =                    T`, `BITPIX  =                  -64`, `NAXIS   =                    2`, `NAXIS1  = ${String(width).padStart(20)}`, `NAXIS2  = ${String(height).padStart(20)}`, 'END'];
  const header = Buffer.alloc(2880, ' '); cards.forEach((card, k) => header.write(card.padEnd(80), k * 80, 'latin1'));
  const data = Buffer.alloc(Math.ceil(width * height * 8 / 2880) * 2880);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.writeDoubleBE(value(x, y), (y * width + x) * 8);
  return Buffer.concat([header, data]);
}

test('a deposited array is read north up and east left about its centre: a source north-east of the star lands north-east', async () => {
  // A 61 x 61 array with its star at the centre (30, 30) and one bright pixel 10 columns toward lower column and 10 rows up:
  // with east left, lower column is east, so the source is north-east, at position angle 45 degrees.
  const directory = await mkdtemp(join(tmpdir(), 'array-plane-')), path = join(directory, 'image.fits');
  await writeFile(path, fitsImage(61, 61, (x, y) => x === 20 && y === 40 ? 1000 : 0));
  const sky = await readArrayPlane(path, { pixelArcsec: 0.1, orientation: 'north-up-east-left', starPixel: 'array-centre', arcsecPerUnit: 0.1, halfUnits: 30, size: 60, backgroundAnnulusArcsec: [2.5, 3] });
  let best = -Infinity, at: [number, number] = [0, 0];
  for (let j = 0; j < sky.size; j++) for (let i = 0; i < sky.size; i++) if (sky.plane[j * sky.size + i]! > best) { best = sky.plane[j * sky.size + i]!; at = [-sky.halfUnits + (i + 0.5) * sky.step, -sky.halfUnits + (j + 0.5) * sky.step]; }
  // Sky-plane x grows west and y north, so north-east is negative x and positive y.
  assert.ok(Math.abs(at[0] + 10) <= 1 && Math.abs(at[1] - 10) <= 1, `brightest sample at ${at}`);
});
