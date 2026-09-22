/**
 * The observer-camera route measured against a mapped surface. Vesta ships a Dawn mosaic in the Claudia system and
 * the survey holds deconvolved SPHERE frames of it, so for once the route can be judged against a map rather than
 * against a silhouette or a reviewer: the frames are cast through the shipped terrain with the pinned Dawn pole
 * model, and the correlation with the mosaic is swept over a turn about the pole and over both mirrors.
 *
 * What passes: the peak lies within a few degrees of zero and beats both mirrors on the frames that show markings.
 * What is also measured: with the IAU 2015 pole model instead of Dawn's, the same frames peak 210 degrees away,
 * which is the stated difference between the two prime meridians, so a kernel in the wrong longitude system is
 * caught by this test and not by any silhouette.
 */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('vesta');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFitsHdu } from '../../../../tools/fits/fits.mts';
import { decodeCalibratedCamera } from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';
import { pckOrientation, type BodyOrientation } from '../../../../tools/objects/terrestrial-layers/observer-camera.mts';
import { horizonsRows, zimpolExposure } from '../../../../tools/objects/terrestrial-layers/observer-cameras.mts';
import { limbCentre, observerCaster, radiusFieldMesh, registrationSweep, type SurfaceReference } from '../../../../tools/objects/terrestrial-layers/registration-sweeps.mts';
import { loadPdsScalarGrid } from '../../../../tools/objects/terrestrial-layers/pds-scalar-grid.mts';
import { loadNativePhotograph } from '../../../../tools/objects/terrestrial-layers/native-photograph-source.mts';
import { parseTextKernel } from '../../../../tools/spice/text-kernel.mts';
import { parseLeapSeconds } from '../../../../tools/spice/lsk.mts';
import { requireArray, requireRecord, requireString } from '../../../../tools/sources/source-values.mts';

const ROOT = resolve(import.meta.dirname, '../../../..'), SOURCE = resolve(ROOT, 'src/objects/vesta/source');
const DEGREE = Math.PI / 180, VESTA = 2000004;
const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const numbers = (line: string) => (line.match(/-?\d+\.\d+(?:E[+-]\d+)?/g) ?? []).map(Number);

/** The frames judged: the two sequences with the strongest markings, five exposures each, ninety seconds apart. */
const FRAMES = ['2018-06-08T05_27_05.809', '2018-06-08T05_28_36.976', '2018-06-08T05_30_08.079', '2018-06-08T05_31_38.064', '2018-06-08T05_33_07.995',
  '2018-07-10T01_59_52.994', '2018-07-10T02_01_24.552', '2018-07-10T02_02_56.662', '2018-07-10T02_04_25.643', '2018-07-10T02_05_56.594'];

const leapSeconds = async () => parseLeapSeconds(parseTextKernel(await readFile(resolve(ROOT, 'src/spice/cassini/lsk/naif0012.tls'), 'utf8'), 'naif0012.tls'));
const orientationFrom = async (kernel: string) => pckOrientation(parseTextKernel(await readFile(kernel, 'utf8'), kernel), VESTA, await leapSeconds());

async function surface() {
  const manifest = requireRecord(JSON.parse(await readFile(resolve(SOURCE, 'manifest.json'), 'utf8')));
  const recipe = requireRecord(JSON.parse(await readFile(resolve(SOURCE, 'preparation/terrestrial.json'), 'utf8')));
  const terrain = requireRecord(requireRecord(recipe.geometry).radialTerrain);
  const grid = await loadPdsScalarGrid(resolve(SOURCE, requireString(terrain.path)), terrain.grid);
  // One-degree vertices are about a pixel apart at this disc size, and the shipped terrain reader supplies every radius.
  const mesh = radiusFieldMesh(grid.sample, 1);
  const normal = requireArray(requireRecord(recipe.raster).observations).map(value => requireRecord(value)).find(entry => entry.id === 'normal');
  const input = requireArray(manifest.inputs).map(value => requireRecord(value)).find(entry => entry.path === 'maps/vesta-true-color.png');
  if (!normal || !input) throw new Error('Vesta no longer states its Dawn colour mosaic.');
  const photograph = await loadNativePhotograph(SOURCE, input, normal.validity), rgb = [0, 0, 0];
  const mosaic: SurfaceReference = { sample: (longitude, latitude) => photograph.sample(longitude, latitude, rgb) ? 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] : null };
  return { mesh, mosaic };
}

async function sightings() {
  const observer = horizonsRows(await readFile(resolve(SOURCE, 'reference/horizons-sphere-observer.txt'), 'utf8'));
  const heliocentric = horizonsRows(await readFile(resolve(SOURCE, 'reference/horizons-sphere-heliocentric.txt'), 'utf8')).filter(line => line.trimStart().startsWith('X ='));
  const rowJd = (line: string) => { const m = line.match(/(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/)!; return Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5], 0) / 86_400_000 + 2440587.5 + Number(m[6]) / 86_400; };
  const frames = [];
  for (const stamp of FRAMES) {
    const bytes = await readFile(resolve(SOURCE, `observations/d4Vesta_${stamp}_zpl_science_imaging_cam1.fits`)), { header } = readFitsHdu(bytes), exposure = zimpolExposure(header);
    const row = observer.findIndex(line => Math.abs(rowJd(line) - exposure.startJd) < 2 / 86_400);
    assert.ok(row >= 0, `a pinned Horizons row exists for ${exposure.start}`);
    const [rightAscension, declination, , rangeAu] = numbers(observer[row].slice(25).replace(/^\s*[a-zA-Z*]{1,2}\s+/, ' '));
    const [sunX, sunY, sunZ] = numbers(heliocentric[row]), magnitude = Math.hypot(sunX, sunY, sunZ);
    frames.push({ stamp, image: decodeCalibratedCamera(bytes, 'fits-zimpol-intensity'), sighting: { epochJd: exposure.startJd + exposure.exposureSeconds / 2 / 86_400,
      targetRightAscensionDegrees: rightAscension, targetDeclinationDegrees: declination, rangeAu, sunRightAscensionDegrees: ((Math.atan2(-sunY, -sunX) / DEGREE) + 360) % 360,
      sunDeclinationDegrees: Math.asin(-sunZ / magnitude) / DEGREE, pixelAngleMicroradians: exposure.pixelAngleMicroradians } });
  }
  return frames;
}

const judge = (frame: Awaited<ReturnType<typeof sightings>>[number], orientation: BodyOrientation, { mesh, mosaic }: Awaited<ReturnType<typeof surface>>, exactHalfWidth: number) => {
  const limb = limbCentre(frame.image, frame.sighting, orientation, mesh.positions);
  // The mosaic carries Dawn's own relief shading, so the prediction is lit as a smooth disc and the relief is not applied twice.
  return registrationSweep(frame.image, observerCaster({ ...frame.sighting, center: limb.center }, orientation), mesh, mosaic, { shading: 'radial', coarseStep: 5, exactHalfWidth });
};

test('the SPHERE frames register to the Dawn mosaic through the pinned Dawn pole model', async () => {
  const [shape, frames, dawn] = await Promise.all([surface(), sightings(), orientationFrom(resolve(SOURCE, 'reference/dawn_vesta_v04.tpc'))]);
  const offsets: number[] = [];
  for (const frame of frames) {
    const result = judge(frame, dawn, shape, 6);
    offsets.push(result.exact.offsetDegrees);
    assert.ok(Math.abs(result.exact.offsetDegrees) <= 4, `${frame.stamp}: the peak lies within four degrees of the model (${result.exact.offsetDegrees}°, r ${result.exact.correlation.toFixed(3)})`);
    assert.ok(result.mirrorMargin >= 1.3, `${frame.stamp}: the model beats both mirrors (margin ${result.mirrorMargin.toFixed(2)})`);
    assert.ok(result.exact.correlation >= 0.1, `${frame.stamp}: the frame shows markings the mosaic explains (r ${result.exact.correlation.toFixed(3)})`);
  }
  const sorted = [...offsets].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  assert.ok(Math.abs(median) <= 2, `the median offset over ${offsets.length} frames is within two degrees (${median}°)`);
});

test('the IAU 2015 pole model puts the same frames 210 degrees away, the stated distance between its prime meridian and Dawn\'s', async () => {
  const [shape, frames, iau] = await Promise.all([surface(), sightings(), orientationFrom(resolve(ROOT, 'src/spice/cassini/pck/pck00011.tpc'))]);
  for (const frame of frames.slice(0, 2)) {
    const result = judge(frame, iau, shape, 0);
    // 210 degrees one way is 150 the other; the peak must sit that far from the model, and nowhere near it.
    const turn = ((-result.coarse.offsetDegrees % 360) + 540) % 360 - 180;
    assert.ok(Math.abs(Math.abs(turn) - 150) <= 6, `${frame.stamp}: the peak sits 150 degrees from the model, which is 210 the other way (${turn}°)`);
  }
});
