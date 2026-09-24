/** The TIME-TAG rest-frame stage, on event lists small enough to write out by hand. Nothing here asks the network or reads
 * an archive product: the synthetic exposure below is a few thousand events around a dark disc that drifts, written into a
 * FITS file with the same two tables a STIS TIME-TAG product carries. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { headerBlock, padBlock } from '../interferometry/fits-table.mts';
import { readFitsHdus, skyImageAxes, skyProjection } from '@cssearth/fits';
import { centredCrop, readEventsFile, streamEvents, timeTagPicture, timeTagProduct, type TimeTagRun } from './timetag-frame.mts';
import {
  azimuthalRatio, backgroundSurface, boxSums, findDisc, goodTimeIntervals, gridLatitudeDegrees, gridRadii, inGoodTime,
  limbStatistics, liveSeconds, parseTimeTagDefinition, quadraticFit, restFramePixel, significanceBins, sliceLiveSeconds,
  spanSeconds, type TimeTagSector,
} from './timetag-reduction.mts';

const PINNED = resolve(import.meta.dirname, 'programs/europa-transit-2014-01-26.timetag.json');
const definition = parseTimeTagDefinition(JSON.parse(await readFile(PINNED, 'utf8')));

test('the pinned definition parses, and names the file, the target and the claim it is about', () => {
  assert.equal(definition.id, 'europa-transit-2014-01-26');
  assert.equal(definition.target, 'Europa');
  assert.equal(definition.horizonsTarget, '502');
  assert.equal(definition.files.filter(file => file.role === 'events').length, 1);
  for (const file of definition.files) assert.match(file.uri, /^mast:HST\/product\//u, file.name);
  const sector = definition.sectors[0]!;
  assert.deepEqual(sector.annulusRadii, [1, 1.25]);
  assert.deepEqual(sector.latitudeRange, [-60, -40]);
  assert.deepEqual(sector.binPixels, [5, 7]);
  // Sparks et al. and Giono et al. disagree about the same image, so both are pinned and a receipt reports beside both.
  assert.deepEqual(definition.published.map(entry => entry.id).sort(),
    ['europa-radius-pixels', 'giono-2020-z', 'sparks-2016-z-5x5', 'sparks-2016-z-7x7']);
  assert.ok(definition.notes.notVerified.length >= 3, 'what the paper does and this stage does not is written down');
});

test('a definition with a broken pin, an odd grid or a Horizons path is refused', () => {
  const raw = JSON.parse(JSON.stringify(definition)) as Record<string, unknown>;
  const changed = (patch: Record<string, unknown>) => parseTimeTagDefinition({ ...raw, ...patch });
  assert.throws(() => changed({ schema: 'cssearth-hst-timetag-frame@2' }), /Unsupported TIME-TAG definition schema/u);
  assert.throws(() => changed({ files: [{ ...definition.files[1]! }] }), /pins the events file/u);
  assert.throws(() => changed({ grid: { pixels: 511, kmPerPixel: 35 } }), /even number of pixels/u);
  assert.throws(() => changed({ horizons: { ...definition.horizons, responses: '../elsewhere.json' } }), /beside the definition/u);
  assert.throws(() => changed({ tracking: { ...definition.tracking, innerRadii: 3 } }), /inside its surround/u);
  assert.throws(() => changed({ sectors: [{ ...definition.sectors[0]!, latitudeRange: [-60, 200] }] }), /within the poles/u);
  assert.throws(() => changed({ grid: { pixels: 512, kmPerPixel: 0 } }), /positive/u);
});

test('good time is what the detector counted, not the wall span, and a slice inside a dump gets none', () => {
  const intervals = goodTimeIntervals([[100, 150], [0, 40]]);
  assert.deepEqual(intervals, [[0, 40], [100, 150]]);
  assert.equal(liveSeconds(intervals), 90);
  assert.equal(spanSeconds(intervals), 150);
  assert.throws(() => goodTimeIntervals([[10, 10]]), /does not run forwards/u);
  assert.throws(() => goodTimeIntervals([[0, 50], [40, 60]]), /overlaps/u);
  assert.throws(() => goodTimeIntervals([]), /at least one/u);
  // Three slices of fifty seconds: the first is wholly counted, the second is wholly a buffer dump, the third is counted.
  assert.deepEqual([...sliceLiveSeconds(intervals, 3, 150)], [40, 0, 50]);
  assert.equal(inGoodTime(intervals, 20), true);
  assert.equal(inGoodTime(intervals, 70), false);
  assert.equal(inGoodTime(intervals, 150), true);
  assert.equal(inGoodTime(intervals, 151), false);
});

test('box sums add exactly what they cover, and refuse a box reaching outside', () => {
  const values = Float64Array.from({ length: 12 }, (_, index) => index + 1);
  const sum = boxSums(values, 4, 3);
  assert.equal(sum(0, 0, 4, 3), 78);
  assert.equal(sum(0, 0, 1, 1), 1);
  assert.equal(sum(1, 1, 3, 3), 6 + 7 + 10 + 11);
  assert.throws(() => sum(0, 0, 5, 3), /outside the image/u);
  assert.throws(() => boxSums(values, 4, 4), /does not match its size/u);
});

/** A bright field with a dark disc on it, and one unlit corner: the scene the tracker meets on every transit frame. */
function sceneWithDisc(width: number, height: number, centre: readonly [number, number], radius: number, bright: number, dark: number) {
  const values = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const unlit = x < width / 6 && y < height / 6;
    const inside = (x + 0.5 - centre[0]) ** 2 + (y + 0.5 - centre[1]) ** 2 <= radius * radius;
    values[y * width + x] = unlit ? 0 : inside ? dark : bright;
  }
  return values;
}

test('the body is found by the light it blocks, not by being the darkest place in the frame', () => {
  const width = 120, height = 120, radius = 10;
  const image = sceneWithDisc(width, height, [70.5, 44.5], radius, 40, 6);
  const found = findDisc(image, { width, height, radiusPixels: radius, innerRadii: 0.7, outerRadii: 2.2,
    brightSurround: 20, guess: { x: width / 2, y: height / 2 }, searchPixels: width });
  // The disc was drawn about the continuous point (70.5, 44.5), and that is what comes back: not the index 70, 44.
  assert.ok(Math.abs(found.x - 70.5) < 0.1, `x ${found.x}`);
  assert.ok(Math.abs(found.y - 44.5) < 0.1, `y ${found.y}`);
  assert.ok(found.significance > 10, `significance ${found.significance}`);
  assert.ok(found.surround > 35, `surround ${found.surround}`);
  // The unlit corner is darker than the body and holds no light at all; a search that scored contrast would settle there.
  assert.ok(found.x > width / 4 && found.y > height / 4, 'the unlit corner is not the body');
  // With no bright surround anywhere, nothing is the body and that is said rather than guessed.
  assert.throws(() => findDisc(image, { width, height, radiusPixels: radius, innerRadii: 0.7, outerRadii: 2.2,
    brightSurround: 1e6, guess: { x: width / 2, y: height / 2 }, searchPixels: width }), /bright enough surround/u);
});

test('an event is counted in the pixel it falls in, so the body\'s own place is the middle corner', () => {
  const frame = { positionAngleDegrees: 0, scale: 1, pixels: 100 };
  // The body stands at continuous 50, the corner between pixels 49 and 50, so the two pixels either side of it share it.
  assert.deepEqual(restFramePixel(0.2, 0.2, frame), [50, 50]);
  assert.deepEqual(restFramePixel(-0.2, -0.2, frame), [49, 49]);
  // Rounding instead of flooring would put both of those in pixel 50 and carry every symmetric cloud half a pixel west
  // and half a pixel north.
  assert.deepEqual(restFramePixel(0.9, 0.9, frame), [50, 50]);
  assert.deepEqual(restFramePixel(-0.9, -0.9, frame), [49, 49]);
});

test('the grid runs north up and east left, and rotates by the aperture angle with no flip', () => {
  const frame = { positionAngleDegrees: 0, scale: 1, pixels: 100 };
  // At a position angle of zero the detector's second axis points north, so its first axis points west.
  assert.deepEqual(restFramePixel(10, 0, frame), [60, 50]);
  assert.deepEqual(restFramePixel(0, 10, frame), [50, 60]);
  // A quarter turn east carries the detector's first axis onto north.
  const turned = { ...frame, positionAngleDegrees: 90 };
  assert.deepEqual(restFramePixel(10, 0, turned), [50, 60]);
  assert.deepEqual(restFramePixel(0, 10, turned), [40, 50]);
  // The scale is output pixels per detector pixel, and an event beyond the grid is not counted anywhere.
  assert.deepEqual(restFramePixel(10, 0, { ...frame, scale: 2 }), [70, 50]);
  assert.equal(restFramePixel(1000, 0, frame), undefined);
  assert.equal(restFramePixel(0, -1000, frame), undefined);
});

test('a point off the limb is placed at the latitude its height stands for', () => {
  const pixels = 200, radiusPixels = 50;
  assert.equal(Math.round(gridRadii(100 + 50, 100, pixels, radiusPixels) * 100) / 100, 1.01);
  // The equator is level with the centre; the south pole is a whole radius below it, on either side of the body.
  assert.ok(Math.abs(gridLatitudeDegrees(150, 100, pixels, radiusPixels)) < 1);
  assert.ok(Math.abs(gridLatitudeDegrees(100, 50, pixels, radiusPixels) + 90) < 1);
  assert.ok(Math.abs(gridLatitudeDegrees(100, 150, pixels, radiusPixels) - 90) < 1);
  const southWest = gridLatitudeDegrees(100 + 50 * Math.cos(Math.PI / 4), 100 - 50 * Math.sin(Math.PI / 4), pixels, radiusPixels);
  const southEast = gridLatitudeDegrees(100 - 50 * Math.cos(Math.PI / 4), 100 - 50 * Math.sin(Math.PI / 4), pixels, radiusPixels);
  assert.ok(Math.abs(southWest + 45) < 1, `${southWest}`);
  assert.ok(Math.abs(southEast + 45) < 1, `${southEast}`);
});

test('the background surface recovers a gradient it was given, and refuses a fit it cannot determine', () => {
  const pixels = 60, radiusPixels = 10;
  const truth = new Float64Array(pixels * pixels);
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) truth[y * pixels + x] = 100 + 0.5 * x - 0.25 * y + 0.01 * x * y;
  const fitted = backgroundSurface(truth, pixels, radiusPixels, 1.6, 3);
  for (let index = 0; index < truth.length; index++) assert.ok(Math.abs(fitted[index]! - truth[index]!) < 1e-6, `pixel ${index}`);
  assert.throws(() => backgroundSurface(truth, pixels, radiusPixels, 100, 3), /Fewer background pixels/u);
  assert.throws(() => backgroundSurface(truth, pixels, radiusPixels, 1.6, 9), /degree 0 to 6/u);
});

test('a field that matches its model gives no significance, and light taken out of one bin gives the Poisson amount', () => {
  const pixels = 60, radiusPixels = 6, seconds = 100, level = 4;
  const values = new Float64Array(pixels * pixels).fill(level);
  const background = backgroundSurface(values, pixels, radiusPixels, 1.6, 1);
  const model = azimuthalRatio(values, background, pixels, radiusPixels, 6);
  for (const bin of significanceBins(values, model, pixels, radiusPixels, seconds, 5, [1, 5])) assert.ok(Math.abs(bin.z) < 1e-6, `${bin.z}`);
  // Take a tenth of the light out of one five by five bin. It expected 25 x 4 x 100 = 10000 counts, so 1000 missing is ten
  // standard deviations of the hundred the model implies.
  const dimmed = Float64Array.from(values);
  for (let y = 30; y < 35; y++) for (let x = 30; x < 35; x++) dimmed[y * pixels + x] = level * 0.9;
  const bins = significanceBins(dimmed, model, pixels, radiusPixels, seconds, 5, [0, 10]);
  const hit = bins.find(bin => Math.abs(bin.column - 32) < 0.01 && Math.abs(bin.row - 32) < 0.01)!;
  assert.ok(Math.abs(hit.z - 10) < 1e-6, `${hit.z}`);
  assert.throws(() => significanceBins(values, model, pixels, radiusPixels, 0, 5, [1, 5]), /positive time/u);
  assert.throws(() => significanceBins(values, model, pixels, radiusPixels, seconds, 0, [1, 5]), /whole number of pixels/u);
});

test('a limb sector reports its darkest bin, the same band mirrored, and the scatter both should be read against', () => {
  const pixels = 240, radiusPixels = 40, seconds = 100, level = 20;
  const values = new Float64Array(pixels * pixels).fill(level);
  // A patch of missing light just off the limb, in the southern half: the shape a plume claim takes.
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
    const radii = gridRadii(x, y, pixels, radiusPixels), latitude = gridLatitudeDegrees(x, y, pixels, radiusPixels);
    if (radii > 1.02 && radii < 1.12 && latitude < -44 && latitude > -52 && x > pixels / 2) values[y * pixels + x] = level * 0.85;
  }
  const background = backgroundSurface(values, pixels, radiusPixels, 1.6, 1);
  const model = azimuthalRatio(values, background, pixels, radiusPixels, 6);
  const sector: TimeTagSector = { id: 'south', annulusRadii: [1, 1.25], latitudeRange: [-60, -40], controlRadii: [1.5, 2.5], binPixels: [5] };
  const statistics = limbStatistics(values, model, pixels, radiusPixels, seconds, sector, 5);
  assert.equal(statistics.sector, 'south');
  assert.ok(statistics.claimed.darkest.z > 5, `darkest ${statistics.claimed.darkest.z}`);
  assert.ok(statistics.claimed.darkest.latitudeDegrees < -40 && statistics.claimed.darkest.latitudeDegrees > -60);
  assert.deepEqual(statistics.mirrored.latitudeRange, [40, 60]);
  // The patch is on one side only, so the mirrored band shows nothing like it.
  assert.ok(statistics.mirrored.darkest.z < statistics.claimed.darkest.z / 2, `mirrored ${statistics.mirrored.darkest.z}`);
  // Away from the body the data are the model to the last bit, so the control scatter is nothing and dividing by it says so.
  assert.ok(statistics.control.standardDeviation < 1e-6, `${statistics.control.standardDeviation}`);
  assert.ok(statistics.darkestOverControlScatter > 1e6, `${statistics.darkestOverControlScatter}`);
  // The annulus around the body does carry the patch, so that scatter is real and the bin is read against it.
  assert.ok(statistics.annulus.standardDeviation > 0.5, `${statistics.annulus.standardDeviation}`);
  assert.ok(statistics.darkestOverAnnulusScatter > 1, `${statistics.darkestOverAnnulusScatter}`);
  assert.throws(() => limbStatistics(values, model, pixels, radiusPixels, seconds, { ...sector, latitudeRange: [89, 90] }, 5), /holds no bins/u);
});

// ---- a synthetic TIME-TAG file ----------------------------------------------------------------------------------------
const card = (key: string, value: string | number | boolean, comment?: string) => [key, value, comment] as const;

/** A TIME-TAG product with the two tables STIS writes: EVENTS of TIME, AXIS1, AXIS2 and DETAXIS1, and GTI of START and STOP. */
function timeTagFile(events: readonly (readonly [number, number, number])[], intervals: readonly (readonly [number, number])[],
  header: { rootname: string; aperture: string; opticalElement: string; tickSeconds: number; positionAngle: number; exposure: number }) {
  const rows = Buffer.alloc(events.length * 10);
  events.forEach(([ticks, x, y], index) => {
    rows.writeInt32BE(ticks, index * 10); rows.writeInt16BE(x, index * 10 + 4); rows.writeInt16BE(y, index * 10 + 6); rows.writeInt16BE(x, index * 10 + 8);
  });
  const gti = Buffer.alloc(intervals.length * 16);
  intervals.forEach(([start, stop], index) => { gti.writeDoubleBE(start, index * 16); gti.writeDoubleBE(stop, index * 16 + 8); });
  return Buffer.concat([
    headerBlock([card('SIMPLE', true), card('BITPIX', 8), card('NAXIS', 0), card('EXTEND', true),
      card('ROOTNAME', header.rootname), card('APERTURE', header.aperture), card('OPT_ELEM', header.opticalElement),
      card('TEXPSTRT', 56683.76083348), card('TEXPEND', 56683.78984969)]),
    headerBlock([card('XTENSION', 'BINTABLE'), card('BITPIX', 8), card('NAXIS', 2), card('NAXIS1', 10), card('NAXIS2', events.length),
      card('PCOUNT', 0), card('GCOUNT', 1), card('TFIELDS', 4), card('EXTNAME', 'EVENTS'),
      card('TTYPE1', 'TIME'), card('TFORM1', '1J'), card('TUNIT1', 'seconds'), card('TSCAL1', header.tickSeconds), card('TZERO1', 0),
      card('TTYPE2', 'AXIS1'), card('TFORM2', '1I'), card('TTYPE3', 'AXIS2'), card('TFORM3', '1I'),
      card('TTYPE4', 'DETAXIS1'), card('TFORM4', '1I'),
      card('EXPTIME', header.exposure), card('PA_APER', header.positionAngle)]),
    padBlock(rows),
    headerBlock([card('XTENSION', 'BINTABLE'), card('BITPIX', 8), card('NAXIS', 2), card('NAXIS1', 16), card('NAXIS2', intervals.length),
      card('PCOUNT', 0), card('GCOUNT', 1), card('TFIELDS', 2), card('EXTNAME', 'GTI'),
      card('TTYPE1', 'START'), card('TFORM1', '1D'), card('TUNIT1', 'seconds'), card('TTYPE2', 'STOP'), card('TFORM2', '1D')]),
    padBlock(gti),
  ]);
}

/** Events of a bright field with a dark disc on it, the disc drifting linearly, at whole detector coordinates. */
function driftingDiscEvents(options: { detector: number; radius: number; from: readonly [number, number]; to: readonly [number, number];
  span: number; step: number; tickSeconds: number; bright: number }) {
  const events: [number, number, number][] = [];
  for (let time = 0; time < options.span; time += options.step) {
    const share = time / options.span;
    const cx = options.from[0] + (options.to[0] - options.from[0]) * share, cy = options.from[1] + (options.to[1] - options.from[1]) * share;
    for (let y = 0; y < options.detector; y++) for (let x = 0; x < options.detector; x++) {
      const inside = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= options.radius * options.radius;
      for (let count = 0; count < (inside ? 0 : options.bright); count++) events.push([Math.round(time / options.tickSeconds), x, y]);
    }
  }
  return events;
}

test('a synthetic exposure reads back, streams every event, and its drift is recovered to under a pixel', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-timetag-'));
  const detector = 64, radius = 8, span = 240, step = 10, tickSeconds = definition.tickSeconds;
  const events = driftingDiscEvents({ detector, radius, from: [20.5, 24.5], to: [44.5, 40.5], span, step, tickSeconds, bright: 3 });
  const intervals = [[0, 100], [120, span]] as const;
  const path = resolve(directory, 'synthetic_tag.fits');
  await writeFile(path, timeTagFile(events, intervals,
    { rootname: definition.rootname, aperture: definition.aperture, opticalElement: definition.opticalElement,
      tickSeconds, positionAngle: 30, exposure: 220 }));
  const file = await readEventsFile(path, definition);
  assert.equal(file.events, events.length);
  assert.equal(file.rowBytes, 10);
  assert.equal(file.positionAngleDegrees, 30);
  assert.equal(file.tickSeconds, tickSeconds);
  assert.deepEqual(file.intervals.map(interval => [...interval]), intervals.map(interval => [...interval]));
  assert.equal(liveSeconds(file.intervals), 220);
  assert.equal(spanSeconds(file.intervals), span);

  let streamed = 0, firstSeconds = Number.POSITIVE_INFINITY, lastSeconds = 0;
  await streamEvents(file, seconds => { streamed++; firstSeconds = Math.min(firstSeconds, seconds); lastSeconds = Math.max(lastSeconds, seconds); });
  assert.equal(streamed, events.length, 'every event is streamed, across block boundaries');
  assert.equal(firstSeconds, 0);
  assert.ok(Math.abs(lastSeconds - (span - step)) < 1e-6, `${lastSeconds}`);

  // Follow the disc the way the stage does: bin the events into slices, find it in each, and fit a smooth drift through them.
  const slices = 8, sliceSeconds = span / slices, images = Array.from({ length: slices }, () => new Float64Array(detector * detector));
  await streamEvents(file, (seconds, x, y) => { images[Math.min(slices - 1, Math.floor(seconds / sliceSeconds))]![y * detector + x]!++; });
  const live = sliceLiveSeconds(file.intervals, slices, span);
  const track: [number, number, number][] = [];
  let guess = { x: detector / 2, y: detector / 2 };
  for (const [slice, image] of images.entries()) {
    if (live[slice]! <= 0) continue;
    const found = findDisc(image, { width: detector, height: detector, radiusPixels: radius, innerRadii: 0.7, outerRadii: 2.2,
      brightSurround: 0.5, guess, searchPixels: detector });
    guess = { x: found.x, y: found.y };
    track.push([(slice + 0.5) * sliceSeconds, found.x, found.y]);
  }
  assert.equal(track.length, slices, 'a slice inside the buffer dump still collected events before and after it');
  const driftX = quadraticFit(track.map(([time, x]) => [time - span / 2, x] as const));
  const driftY = quadraticFit(track.map(([time, , y]) => [time - span / 2, y] as const));
  for (const [time, x, y] of track) {
    assert.ok(Math.abs(driftX(time - span / 2) - x) < 1, `x at ${time}`);
    assert.ok(Math.abs(driftY(time - span / 2) - y) < 1, `y at ${time}`);
  }
  // The disc was commanded from (20.5, 24.5) to (44.5, 40.5), so it moved 24 pixels across and 16 up.
  assert.ok(Math.abs((driftX(span / 2) - driftX(-span / 2)) - 24) < 1.5, `${driftX(span / 2) - driftX(-span / 2)}`);
  assert.ok(Math.abs((driftY(span / 2) - driftY(-span / 2)) - 16) < 1.5, `${driftY(span / 2) - driftY(-span / 2)}`);
});

test('a file whose tick, rootname or aperture is not the pinned one is refused before it is reduced', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-timetag-'));
  const events = [[0, 10, 10], [8000, 11, 11]] as const;
  const write = async (name: string, header: Parameters<typeof timeTagFile>[2]) => {
    const path = resolve(directory, name);
    await writeFile(path, timeTagFile(events, [[0, 10]], header));
    return path;
  };
  const good = { rootname: definition.rootname, aperture: definition.aperture, opticalElement: definition.opticalElement,
    tickSeconds: definition.tickSeconds, positionAngle: 0, exposure: 10 };
  await assert.rejects(readEventsFile(await write('tick.fits', { ...good, tickSeconds: 0.001 }), definition), /counts time in/u);
  await assert.rejects(readEventsFile(await write('root.fits', { ...good, rootname: 'oc7u02zzq' }), definition), /carries rootname/u);
  await assert.rejects(readEventsFile(await write('aper.fits', { ...good, aperture: 'F25QTZ' }), definition), /not the pinned/u);
});

test('the shared sky reader accepts the grid this stage states, and reads it as north up and east left', () => {
  const scale = 35 / 1560.8 * 40.67 * 0.0123709925 / 3600;
  const header = { CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CUNIT1: 'deg', CUNIT2: 'deg', RADESYS: 'ICRS',
    CRPIX1: 256.5, CRPIX2: 256.5, CRVAL1: 103.695471778, CRVAL2: 23.019927083,
    CD1_1: -scale, CD1_2: 0, CD2_1: 0, CD2_2: scale };
  const axes = skyImageAxes(header);
  assert.equal(axes.eastRight, false);
  assert.equal(axes.northUp, true);
  assert.equal(axes.unit, 'deg');
  assert.ok(Math.abs(axes.scale[0]! - scale) < 1e-15);
});

test('the picture is the middle of the image, rows and columns in order, and a crop that does not fit is refused', async () => {
  const { centredCrop } = await import('./timetag-frame.mts');
  const size = 8, values = Float64Array.from({ length: size * size }, (_, index) => index), crop = centredCrop(values, size, 2);
  assert.equal(crop.size, 4);
  assert.deepEqual([...crop.values.subarray(0, 4)], [18, 19, 20, 21]);
  assert.deepEqual([...crop.values.subarray(12, 16)], [42, 43, 44, 45]);
  assert.throws(() => centredCrop(values, size, 5), /does not fit/u);
});

/** A run with nothing in it but the geometry the written headers are made of, so the cards can be tested on their own. */
function runOf(pixels: number, kmPerPixel: number, positionAngleDegrees: number, rate: Float64Array): TimeTagRun {
  const patched = parseTimeTagDefinition({ ...JSON.parse(JSON.stringify(definition)) as Record<string, unknown>, grid: { pixels, kmPerPixel } });
  const place = { julianDate: 2456684.275341585, rightAscensionDegrees: 103.695471778, declinationDegrees: 23.019927083, angularDiameterArcsec: 1.0063 };
  const radiusDetectorPixels = place.angularDiameterArcsec / 2 / patched.plateScaleArcsec;
  const empty = new Float64Array(pixels * pixels);
  return {
    definition: patched, inputs: [], place, radiusDetectorPixels, radiusGridPixels: patched.bodyRadiusKm / kmPerPixel,
    file: { path: '', rootname: patched.rootname, aperture: patched.aperture, opticalElement: patched.opticalElement,
      exposureSeconds: 100, startMjd: 56683.76083348, endMjd: 56683.78984969, positionAngleDegrees,
      events: 0, rowBytes: 10, dataStart: 0, tickSeconds: patched.tickSeconds, intervals: [[0, 100]] },
    track: [], trackResidualPixels: [], driftPixels: 0, liveSeconds: 100, spanSeconds: 100,
    eventsPlaced: 0, eventsOutsideGrid: 0, eventsOutsideGoodTime: 0,
    rate, background: empty, model: empty, counts: Float64Array.from(rate), statistics: [],
  };
}

/** Deterministic offsets in exactly opposed pairs, so the continuous cloud's centroid is zero to the last bit. */
function symmetricOffsets(count: number, spread: number) {
  let state = 20140126;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  const offsets: [number, number][] = [];
  for (let index = 0; index < count; index++) {
    const dx = (random() - 0.5) * 2 * spread, dy = (random() - 0.5) * 2 * spread;
    offsets.push([dx, dy], [-dx, -dy]);
  }
  return offsets;
}

test('a symmetric cloud of events about the target keeps its centroid on the target, in the grid and through the WCS', () => {
  const pixels = 128, kmPerPixel = 200, positionAngle = 50.9865;
  const rate = new Float64Array(pixels * pixels);
  const run = runOf(pixels, kmPerPixel, positionAngle, rate);
  const frame = { positionAngleDegrees: positionAngle, scale: run.definition.bodyRadiusKm / run.radiusDetectorPixels / kmPerPixel, pixels };
  let placed = 0, sumColumn = 0, sumRow = 0;
  for (const [dx, dy] of symmetricOffsets(40000, 120)) {
    const at = restFramePixel(dx, dy, frame);
    if (!at) continue;
    rate[at[1] * pixels + at[0]]!++; placed++; sumColumn += at[0]; sumRow += at[1];
  }
  assert.ok(placed > 60000, `${placed} events landed on the grid`);
  // In the grid's own coordinates: the centroid of the pixel centres, measured from where the target stands.
  const offColumn = sumColumn / placed + 0.5 - pixels / 2, offRow = sumRow / placed + 0.5 - pixels / 2;
  assert.ok(Math.abs(offColumn) < 0.01, `column centroid ${offColumn} pixels off the target`);
  assert.ok(Math.abs(offRow) < 0.01, `row centroid ${offRow} pixels off the target`);

  // And through the WCS the image states: the target's own direction has to land on that same centroid.
  const science = readFitsHdus(timeTagProduct(run))[1]!.header;
  const projection = skyProjection(science);
  const [targetColumn, targetRow] = projection.pixelOf(run.place.rightAscensionDegrees, run.place.declinationDegrees)!;
  assert.ok(Math.abs(targetColumn - sumColumn / placed) < 0.01, `WCS puts the target ${targetColumn - sumColumn / placed} pixels from the centroid`);
  assert.ok(Math.abs(targetRow - sumRow / placed) < 0.01, `WCS puts the target ${targetRow - sumRow / placed} pixels from the centroid`);
  const [ra, dec] = projection.skyOf(sumColumn / placed, sumRow / placed);
  assert.ok(Math.abs(ra - run.place.rightAscensionDegrees) < 1e-7, `${ra}`);
  assert.ok(Math.abs(dec - run.place.declinationDegrees) < 1e-7, `${dec}`);

  // The picture is a crop of the same grid, so its own WCS has to put the target on the cropped centroid too.
  const picture = readFitsHdus(timeTagPicture(run))[0]!.header;
  const half = Math.ceil(4 * run.radiusGridPixels), from = pixels / 2 - half;
  const [pictureColumn, pictureRow] = skyProjection(picture).pixelOf(run.place.rightAscensionDegrees, run.place.declinationDegrees)!;
  assert.equal(picture.NAXIS1, 2 * half);
  assert.ok(Math.abs(pictureColumn - (sumColumn / placed - from)) < 0.01, `${pictureColumn}`);
  assert.ok(Math.abs(pictureRow - (sumRow / placed - from)) < 0.01, `${pictureRow}`);
});

test('a centred crop is refused on an odd grid, and keeps the target in the middle of what it takes', () => {
  assert.throws(() => centredCrop(new Float64Array(49), 7, 2), /even number of pixels/u);
  const size = 8, values = Float64Array.from({ length: size * size }, (_, index) => index);
  // The target stands at continuous 4; the crop starts at 2, so it stands at continuous 2 in a crop 4 across.
  assert.equal(centredCrop(values, size, 2).values[0], 18);
});
