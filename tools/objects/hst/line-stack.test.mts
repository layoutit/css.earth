import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evidenceFor, productRecordPath } from '@cssearth/telescope';
import { readProductRecord, writeProductRecord } from '@cssearth/telescope/node';
import { PROGRAMS } from './archive.mts';
import {
  accumulatedImage, addSample, discMetrics, gridPoint, limbFallOff, newAccumulator, parseLineStack, quadraticFit, radialProfile, rayleighPerSample,
  rejectionReason, inSubset, sampleFor, clippedMean, median, type StackGrid,
} from './line-stack-reduction.mts';
import { frameEphemeris, horizonsRequestKey, horizonsRowJulianDate, matchHorizonsEpochs, parseHorizonsTable, readHorizonsResponses } from './line-stack-ephemeris.mts';
import { addStackEvidence, lineStackSoftware, readLineStack, stackPath, stackRun } from './line-stack.mts';

const STACK = 'europa-oxygen-aurora';
/** A Horizons response whose rows are in time order while the epochs were asked for in another. */
const RESPONSE = [
  '*******************************************************************************',
  ' Date__(UT)__HR:MN:SC.fff, , , R.A.___(ICRF), DEC____(ICRF),  Ang-diam,    NP.ang,',
  '*******************************************************************************',
  '$$SOE',
  ' 2012-Dec-30 18:00:00.000, , ,  10.000000000,   5.000000000,  1.000000,  20.0000,',
  ' 2012-Dec-30 19:00:00.000, , ,  11.000000000,   6.000000000,  2.000000,  30.0000,',
  ' 2012-Dec-30 20:00:00.000, , ,  12.000000000,   7.000000000,  3.000000,  40.0000,',
  '$$EOE',
  '',
].join('\n');

test('a Horizons row is read at the date it carries', () => {
  assert.equal(horizonsRowJulianDate('2012-Dec-30 12:00:00.000'), 2456292);
  assert.equal(horizonsRowJulianDate(' 2012-Dec-31 00:00:00.000 '), 2456292.5);
  assert.throws(() => horizonsRowJulianDate('2012-Foo-30 12:00:00.000'), /month/u);
  assert.throws(() => horizonsRowJulianDate('30 December 2012'), /Unparsable/u);
});

test('rows are matched back to the epochs by their own timestamp, not by position', () => {
  const table = parseHorizonsTable(RESPONSE);
  assert.deepEqual(table.columns.slice(3), ['R.A.___(ICRF)', 'DEC____(ICRF)', 'Ang-diam', 'NP.ang', '']);
  // Horizons sorts a TLIST by time whatever order it was asked in. Ask for the last epoch first.
  const asked = [horizonsRowJulianDate('2012-Dec-30 20:00:00.000'), horizonsRowJulianDate('2012-Dec-30 18:00:00.000'), horizonsRowJulianDate('2012-Dec-30 19:00:00.000')];
  const matched = matchHorizonsEpochs(table, asked);
  assert.deepEqual(matched.map(row => row[3]), ['12.000000000', '10.000000000', '11.000000000']);
  // Pairing by position would have given the rows in the order the response holds them, which is a different answer.
  assert.notDeepEqual(matched.map(row => row[3]), table.rows.map(row => row[3]));
});

test('an epoch no row answers, or one two rows answer, is an error rather than a guess', () => {
  const table = parseHorizonsTable(RESPONSE);
  assert.throws(() => matchHorizonsEpochs(table, [horizonsRowJulianDate('2012-Dec-30 18:00:00.000'), 2456292, 2456293]), /0 Horizons rows match/u);
  assert.throws(() => matchHorizonsEpochs(table, [2456292, 2456292.5]), /returned 3 rows for 2 epochs/u);
  assert.throws(() => parseHorizonsTable('Horizons could not resolve the target'), /no ephemeris/u);
});

test('a frame’s geometry says how big the body is, how it is turned, and where its planet stands', () => {
  const table = parseHorizonsTable(RESPONSE), rows = table.rows;
  // The primary at a smaller right ascension stands west of the target, so the target is the eastern, leading one.
  const east = frameEphemeris(2456292, { table, row: rows[1]! }, { table, row: rows[0]! });
  assert.equal(east.eastOfPrimary, true);
  assert.equal(east.angularDiameterArcsec, 2);
  assert.equal(east.northPoleAngleDegrees, 30);
  assert.ok(Math.abs(east.primarySeparationArcsec - Math.hypot(3600 * Math.cos(6 * Math.PI / 180), 3600)) < 1e-6);
  assert.ok(Math.abs(east.primaryLimbClearanceArcsec - (east.primarySeparationArcsec - 0.5)) < 1e-9);
  const west = frameEphemeris(2456292, { table, row: rows[1]! }, { table, row: rows[2]! });
  assert.equal(west.eastOfPrimary, false);
});

test('one Horizons request is named by its observer, body, quantities and epochs', () => {
  assert.equal(horizonsRequestKey('500@-48', '502', '1,13', [2456292, 2456292.5]), '500@-48|502|1,13|2456292.000000 2456292.500000');
});

test('a sample becomes Rayleigh through the frame’s own slit conversion', () => {
  // CONT2EML is the width of wavelength one slit width subtends: 0.584 Å per pixel times 2.0" of slit at 0.0246" per pixel.
  const cont2eml = 0.584 * (2.0 / 0.0246);
  assert.ok(Math.abs(cont2eml - 47.4797) < 1e-3, `${cont2eml}`);
  // The rest is hc/λ and the definition of a Rayleigh: 1/(hc · 1.87038e-6) = 2.6913e13 to five figures.
  const factor = rayleighPerSample(cont2eml, 1355.6) / (cont2eml * 1355.6);
  assert.ok(Math.abs(factor / 2.6913e13 - 1) < 1e-4, `${factor}`);
  assert.ok(Math.abs(rayleighPerSample(cont2eml, 1355.6) / (cont2eml * 1355.6 * 2.6913e13) - 1) < 1e-4);
  // One rectified sample of 1e-16 erg s⁻¹ cm⁻² Å⁻¹ arcsec⁻² at 1355.6 Å is a few Rayleigh.
  assert.ok(Math.abs(1e-16 * rayleighPerSample(cont2eml, 1355.6) - 173.4) < 0.5);
  assert.throws(() => rayleighPerSample(0, 1355.6), /positive/u);
});

test('a point placed east of the body lands on the left of the picture', () => {
  const grid: StackGrid = { pixels: 41, halfWidthRadii: 2 }, radiusPixels = 10, lineColumn = 100, discRow = 200;
  // ORIENTAT 0 puts detector +y at sky north; the body's pole angle is 0 too, so the picture needs no turning. Image +x is
  // then a quarter turn from north on the side the handedness names — west for the adopted one — so east is detector −x.
  const rotationRadians = 0;
  const eastward = { column: lineColumn - 0.6 * radiusPixels, row: discRow };
  const brightest = (handedness: 'ORIENTAT-90' | 'ORIENTAT+90') => {
    let best = Infinity, at = { x: 0, y: 0 };
    for (let row = 0; row < grid.pixels; row++) for (let column = 0; column < grid.pixels; column++) {
      const point = gridPoint(grid, column, row), sample = sampleFor(point, { lineColumn, discRow, radiusPixels, rotationRadians, handedness });
      const distance = Math.hypot(sample.column - eastward.column, sample.row - eastward.row);
      if (distance < best) { best = distance; at = point; }
    }
    return at;
  };
  assert.ok(brightest('ORIENTAT-90').x < 0, 'east is left under the adopted handedness');
  assert.ok(brightest('ORIENTAT+90').x > 0, 'the mirrored handedness puts the same point on the right');
  // North is up whichever way the across-slit axis runs, because the rotation is applied along the slit.
  assert.ok(sampleFor({ x: 0, y: 1 }, { lineColumn, discRow, radiusPixels, rotationRadians, handedness: 'ORIENTAT-90' }).row > discRow);
});

test('a frame is rejected on the target name or on how close the planet’s limb comes', () => {
  const rule = { targetNamePattern: 'TRANSIT', minimumPrimaryLimbClearanceArcsec: 8 };
  assert.equal(rejectionReason({ targetName: 'EUROPA-TRANSIT-1', primaryLimbClearanceArcsec: 40 }, rule), 'transit target');
  assert.equal(rejectionReason({ targetName: 'EUROPA-AROUND-TRANSIT', primaryLimbClearanceArcsec: 40 }, rule), 'transit target');
  assert.equal(rejectionReason({ targetName: 'EUROPA-EAST-A', primaryLimbClearanceArcsec: 7.4 }, rule), 'the primary\'s limb 7.4" away');
  assert.equal(rejectionReason({ targetName: 'EUROPA-EAST-A', primaryLimbClearanceArcsec: 8 }, rule), '');
  assert.equal(rejectionReason({ targetName: 'EUROPA-ECLIPSE-1', primaryLimbClearanceArcsec: 30 }, rule), '');
  assert.equal(inSubset({ targetName: 'EUROPA-ECLIPSE-1', eastOfPrimary: true }, { id: 'eclipse', rule: 'target name matches', targetNamePattern: 'ECLIPSE' }), true);
  assert.equal(inSubset({ targetName: 'EUROPA-EAST-A', eastOfPrimary: true }, { id: 'east', rule: 'east of the primary' }), true);
  assert.equal(inSubset({ targetName: 'EUROPA-EAST-A', eastOfPrimary: true }, { id: 'west', rule: 'west of the primary' }), false);
  assert.equal(inSubset({ targetName: 'ANYTHING', eastOfPrimary: false }, { id: 'all', rule: 'every frame' }), true);
});

test('a small stack keeps the exposure weighting, the asymmetry and the fall-off', () => {
  const grid: StackGrid = { pixels: 41, halfWidthRadii: 3 }, accumulator = newAccumulator(grid.pixels);
  // A disc twice as bright on its +x half, falling away outside the limb, built by hand and put in one sample at a time.
  for (let row = 0; row < grid.pixels; row++) for (let column = 0; column < grid.pixels; column++) {
    const point = gridPoint(grid, column, row), radius = Math.hypot(point.x, point.y), index = row * grid.pixels + column;
    const half = point.x > 0 ? 2 : 1;                 // the +x half is twice as bright, on the disc and above the limb alike
    const value = half * (radius <= 1 ? 50 : 50 * Math.exp(-(radius - 1) * 1560.8 / 500));
    addSample(accumulator, index, value, 600);
    addSample(accumulator, index, value, 1200);       // a longer exposure of the same brightness must not move the mean
  }
  const { values, errors } = accumulatedImage(accumulator);
  const metrics = discMetrics(values, grid);
  assert.ok(Math.abs(metrics.duskDawnRatio - 2) < 0.02, `${metrics.duskDawnRatio}`);
  assert.ok(Math.abs(values[20 * grid.pixels + 25]! - 100) < 1e-9, 'the weighted mean of one brightness is that brightness');
  // The same brightness twice, at two exposures, has no scatter: the standard error is zero up to double rounding.
  assert.ok(errors.every(value => Number.isNaN(value) || value < 1e-5));
  assert.ok(Math.abs(metrics.centroidRadii[1]) < 1e-9, 'the disc is not displaced along y');
  const fall = limbFallOff(values, grid, 1560.8);
  assert.ok(Math.abs(fall.eFoldingKm - 500) < 25, `${fall.eFoldingKm}`);
  const profile = radialProfile(values, accumulator.weight, grid, 0.25);
  assert.ok(profile[0]!.meanRayleigh > profile.at(-1)!.meanRayleigh);
  // A pixel no frame reached is NaN, not zero, and takes no part in a mean.
  const empty = accumulatedImage(newAccumulator(3));
  assert.ok(empty.values.every(Number.isNaN));
});

test('the small statistics behave as the recipe needs them to', () => {
  assert.equal(median([]), 0);
  assert.equal(median([3, 1, 2]), 2);
  // A clipped mean drops the outlier and keeps the level; a median of a low-count sky would sit below it.
  assert.ok(Math.abs(clippedMean([10, 11, 9, 10, 1000], 4) - 10) < 1e-9);
  const fit = quadraticFit([[-2, 4], [-1, 1], [0, 0], [1, 1], [2, 4]]);
  assert.ok(Math.abs(fit(3) - 9) < 1e-9);
  assert.equal(quadraticFit([[0, 1], [1, 2]])(5), 0, 'too few points fit nothing rather than guessing');
});

test('the pinned Europa stack parses, and its frames, rejections and Horizons responses hold together', async () => {
  const definition = await readLineStack(STACK);
  assert.equal(definition.target, 'Europa');
  assert.equal(definition.handedness, 'ORIENTAT-90');
  assert.equal(definition.frames.length, 140);
  assert.equal(definition.frames.filter(frame => frame.rejected).length, 28);
  assert.equal(definition.lines.length, 3);
  assert.ok(definition.lines.some(line => line.id === 'oi1356' && line.wavelengthAngstrom === 1355.6 && line.removeReflectedContinuum));
  assert.ok(definition.frames.every(frame => /^\d+$/u.test(frame.programme)));
  assert.equal(new Set(definition.frames.filter(frame => !frame.rejected).map(frame => frame.programme)).size, 5);
  // Every window the reduction uses has to fall inside the columns the frames are read over.
  const { readWindowAngstrom: read, continuumRowWindowAngstrom: continuum, discProfileWindowAngstrom: albedo } = definition.reduction;
  assert.ok(read[0] < continuum[0] && continuum[1] < read[1] && read[0] < albedo[0] && albedo[1] < read[1]);
  assert.ok(read[0] < definition.reduction.acrossSlitLineAngstrom - definition.reduction.acrossSlitHalfWidthArcsec / 0.0246 * 0.584);
  // The pinned responses answer every request this stack makes: batches of 20 epochs, two bodies each.
  const responses = await readHorizonsResponses(join(PROGRAMS, definition.horizons.responses));
  assert.equal(Object.keys(responses).length, 2 * Math.ceil(definition.frames.length / definition.horizons.epochsPerRequest));
  for (const text of Object.values(responses)) assert.ok(parseHorizonsTable(text).rows.length <= definition.horizons.epochsPerRequest);
  assert.ok(definition.published.some(value => value.id === 'dusk-dawn-1356' && value.value === 1.59 && value.source.includes('10.1002/2015JA022073')));
  assert.ok(definition.notes.notVerified.some(note => note.startsWith('Handedness')));
});

test('the receipt states this run’s numbers beside the published ones', async () => {
  const definition = await readLineStack(STACK);
  const receipt = JSON.parse(await readFile(join(PROGRAMS, `${STACK}.stack.reproduction.json`), 'utf8')) as {
    stack: string; frames: { pinned: number; used: number; visits: number; exposureHours: number };
    sets: { set: string; duskDawnRatio: number; discMeanRayleigh: number }[];
    published: { id: string; value: number; uncertainty?: number; valueHigh?: number; measured: number | null }[];
    mirroredHandedness: { set: string; adoptedDuskDawnRatio: number; mirroredDuskDawnRatio: number }[] | null;
    notVerified: string[];
  };
  assert.equal(receipt.stack, STACK);
  assert.equal(receipt.frames.pinned, definition.frames.length);
  assert.equal(receipt.frames.used, definition.frames.filter(frame => !frame.rejected).length);
  assert.deepEqual(receipt.sets.map(set => set.set).sort(), definition.lines.flatMap(line => definition.subsets.map(subset => `${line.id}-${subset.id}`)).sort());
  assert.deepEqual(receipt.notVerified, [...definition.notes.notVerified]);
  // The published dusk/dawn ratio is met within its own uncertainty, and the mirrored handedness does not reproduce it.
  const dusk = receipt.published.find(value => value.id === 'dusk-dawn-1356')!;
  assert.ok(dusk.measured !== null && Math.abs(dusk.measured - dusk.value) <= (dusk.uncertainty ?? 0), `${dusk.measured}`);
  const mirror = receipt.mirroredHandedness?.find(entry => entry.set === 'oi1356-all');
  assert.ok(mirror && mirror.adoptedDuskDawnRatio > 1.3 && mirror.mirroredDuskDawnRatio < 1.2, JSON.stringify(mirror));
  const disc = receipt.published.find(value => value.id === 'disc-1356')!;
  assert.ok(disc.measured !== null && disc.measured > disc.value && disc.measured < disc.valueHigh!);
});

test('a stacked set’s record pins the frames that went into that set, and what placed them', async () => {
  const definition = await readLineStack(STACK), line = definition.lines.find(entry => entry.id === 'oi1356')!;
  const used = definition.frames.filter(frame => !frame.rejected).slice(0, 3).map(frame => frame.name);
  const made = await stackRun(definition, line, 'all', used, await lineStackSoftware());
  assert.equal(made.telescope, 'HST');
  assert.equal(made.stage, 'line-stack');
  assert.deepEqual(made.inputs.slice(0, 2).map(input => input.role), ['stack definition', 'Horizons responses']);
  assert.equal(made.inputs[0]!.bytes, (await stat(stackPath(STACK))).size, 'the definition as it is on disk');
  // The frames of this set, at the sizes the definition records, and nothing of the frames another set holds.
  assert.deepEqual(made.inputs.slice(2).map(input => input.identity), [...used].sort().map(name => definition.frames.find(frame => frame.name === name)!.uri));
  assert.ok(made.inputs.slice(2).every(input => input.bytes > 0));
  assert.deepEqual([made.parameters.line, made.parameters.subset, made.parameters.handedness, made.parameters.gridPixels],
    ['oi1356', 'all', definition.handedness, definition.grid.pixels]);
  // There is no installed toolchain: the version is the digest of the modules that did the arithmetic.
  assert.equal(made.toolchainDigest, undefined);
  assert.match(made.software[0]!.version, /^[0-9a-f]{64}$/u);
  await assert.rejects(stackRun(definition, line, 'all', ['o8k901010_x1d.fits'], await lineStackSoftware()), /not a frame the definition pins/u);
});

test('the receipt’s two checks reach a stack’s record as the different kinds of evidence they are', async () => {
  const work = await mkdtemp(join(tmpdir(), 'line-stack-record-'));
  try {
    const definition = await readLineStack(STACK), line = definition.lines.find(entry => entry.id === 'oi1356')!;
    const name = 'oi1356-all.fits', product = join(work, name);
    await writeFile(product, 'a stacked set');
    await writeProductRecord(productRecordPath(product), await stackRun(definition, line, 'all', [definition.frames.find(frame => !frame.rejected)!.name], await lineStackSoftware()),
      [{ path: name, file: product, units: 'R' }]);
    const receipt = resolve(work, 'comparison.json'); await writeFile(receipt, '{}');
    const records = await addStackEvidence(work, receipt, {
      sets: [{ set: 'oi1356-all' }, { set: 'oi1304-all' }],
      published: [{ quantity: 'dusk-to-dawn ratio at 1356 A', source: 'Roth et al. 2016, 10.1002/2015JA022073', set: 'oi1356-all', measured: 1.55 },
        { quantity: 'disc mean at 1304 A', source: 'Roth et al. 2016, 10.1002/2015JA022073', set: 'oi1356-all', measured: null }],
      mirroredHandedness: [{ set: 'oi1356-all' }],
    });
    assert.deepEqual(records, [`${name}.product.json`], 'a set the receipt checked nothing of takes no evidence');
    const record = (await readProductRecord(productRecordPath(product)))!;
    const published = evidenceFor(record, name, 'published-value'), consistency = evidenceFor(record, name, 'internal-consistency');
    assert.equal(published.length, 1);
    assert.ok(published[0]!.receipt.endsWith('.evidence.json'));
    assert.match(published[0]!.establishes, /Roth et al\. 2016/u);
    assert.ok(!published[0]!.establishes.includes('disc mean at 1304 A'), 'a published value this run did not measure is not reported as checked');
    assert.equal(consistency.length, 1);
    assert.match(consistency[0]!.establishes, /opposite handedness/u);
    assert.match(consistency[0]!.establishes, /nothing outside\s+them is checked/u);
    assert.equal(evidenceFor(record, name, 'archive-agreement').length, 0, 'neither check is agreement with an archive product');
    // A set whose product no stage recorded is refused rather than reported as checked.
    await assert.rejects(addStackEvidence(work, receipt, { sets: [{ set: 'oi1304-all' }],
      published: [{ quantity: 'disc mean', source: 'Roth et al. 2016', set: 'oi1304-all', measured: 120 }], mirroredHandedness: null }), /no product record/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('a stack definition refuses what it cannot check', async () => {
  const definition = JSON.parse(await readFile(join(PROGRAMS, `${STACK}.stack.json`), 'utf8')) as Record<string, unknown>;
  assert.doesNotThrow(() => parseLineStack(definition));
  assert.throws(() => parseLineStack({ ...definition, schema: 'other' }), /Unsupported/u);
  assert.throws(() => parseLineStack({ ...definition, handedness: 'ORIENTAT' }), /handedness/u);
  assert.throws(() => parseLineStack({ ...definition, notes: { measured: [], notVerified: [] } }), /does not verify/u);
  const frames = definition.frames as Record<string, unknown>[];
  assert.throws(() => parseLineStack({ ...definition, frames: [frames[0]!, frames[0]!] }), /twice/u);
  assert.throws(() => parseLineStack({ ...definition, subsets: [{ id: 'all', rule: 'somehow' }] }), /subset rule/u);
});
