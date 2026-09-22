import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipelineImaging, precisePhaseCentre, tcleanCalls } from './alma-imaging.mts';
import { parseContinuumRanges } from './alma-calibration.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name: string) => readFile(resolve(root, 'tests/fixtures/alma', name), 'utf8');

test('the pipeline’s own continuum imaging of a field is read from its command log', async () => {
  const imaging = pipelineImaging(await read('casa_commands.tclean.log'), 'R_Dor');
  // Not the settings a reasonable guess would pick: 471 GHz is 3 per cent from 455, so the band carries a spectral slope.
  assert.equal(imaging.deconvolver, 'mtmfs');
  assert.equal(imaging.terms, 2);
  assert.equal(imaging.cell, '0.0055arcsec');
  assert.deepEqual([...imaging.imageSize], [3200, 3200]);
  assert.equal(imaging.weighting, 'briggs');
  assert.equal(imaging.robust, 0.5);
  assert.equal(imaging.threshold, '0.000949Jy');
  assert.equal(imaging.intent, 'OBSERVE_TARGET#ON_SOURCE');
  assert.ok(imaging.phaseCentre?.startsWith('ICRS 04:36:45'));
  assert.ok(imaging.imageName.includes('cont.selfcal'), 'the delivered image is the self-calibrated continuum');
  // A selection that holds commas is one string, not several: ten scans, four windows.
  assert.equal(imaging.scan, '9,11,13,15,22,24,26,30,33,37');
  // Every antenna, cross-correlations only: the trailing & is what keeps the auto-correlations out of the weights.
  assert.ok(imaging.arguments.get('antenna')?.endsWith("&']"), `antenna selection ${imaging.arguments.get('antenna')}`);
  assert.deepEqual(imaging.spw.split(',').map(part => part.split(':')[0]), ['25', '27', '29', '31']);
  assert.ok(imaging.arguments.has('pbcor') && imaging.arguments.has('usemask'));
});

test('the imaged selection is the frame-converted one, not cont.dat’s own numbers', async () => {
  const imaging = pipelineImaging(await read('casa_commands.tclean.log'), 'R_Dor');
  const stated = parseContinuumRanges(await read('cont.dat')).get('R_Dor')!;
  // The same eighteen ranges, but cont.dat states them in LSRK and tclean receives them in the measurement set's frame.
  const imagedRanges = imaging.spw.split(',').flatMap(part => (part.split(':')[1] ?? '').split(';')).filter(Boolean);
  assert.equal(imagedRanges.length, stated.length);
  const firstImaged = Number(imagedRanges[0]!.split('~')[0]);
  assert.ok(Math.abs(firstImaged - stated[0]!.lowGHz) > 0.005, 'the frames differ by more than a rounding');
  assert.ok(Math.abs(firstImaged - stated[0]!.lowGHz) < 0.2, 'but they describe the same edge');
});

test('a log without the field, and calls that are not tclean, are handled rather than half-read', async () => {
  const log = await read('casa_commands.tclean.log');
  assert.equal(tcleanCalls(log).length, 4);
  assert.equal(tcleanCalls('mytclean(vis=1)').length, 0, 'a name ending in tclean is not tclean');
  assert.equal(tcleanCalls("tclean(vis='a(b).ms', field='X')").length, 1, 'parentheses inside a string do not close the call');
  assert.throws(() => pipelineImaging(log, 'Betelgeuse'), /records no tclean/u);
  assert.throws(() => pipelineImaging("tclean(field='X', imagename='x.cont')", 'X'), /no spectral-window selection/u);
});

test('the phase centre comes unrounded from the pipeline\u2019s image, and only when it is the logged centre', () => {
  // R Doradus band 8: the log's centre and the archive image's reference pixel.
  const header = { RADESYS: 'ICRS', CTYPE1: 'RA---SIN', CTYPE2: 'DEC--SIN', CRVAL1: 69.18898818777, CRVAL2: -62.07767209321, CRPIX1: 1601, CRPIX2: 1601 };
  const centre = precisePhaseCentre('ICRS 04:36:45.3572 -062.04.39.619', header, [3200, 3200]);
  assert.equal(centre.phaseCentre, 'ICRS 69.18898818777deg -62.07767209321deg');
  // The shortening that moved the grid: 0.25 mas in right ascension and 0.54 mas in declination.
  assert.ok(Math.abs(centre.offsetRaMas - 0.245) < 0.01 && Math.abs(centre.offsetDecMas - 0.536) < 0.01, JSON.stringify(centre));
  // Farther than the log's last digit is another centre, not a more precise one.
  assert.throws(() => precisePhaseCentre('ICRS 04:36:45.3582 -062.04.39.619', header, [3200, 3200]), /last digit/u);
  assert.throws(() => precisePhaseCentre('ICRS 04:36:45.3572 -062.04.39.619', { ...header, CRPIX1: 1600 }, [3200, 3200]), /reference pixel/u);
  assert.throws(() => precisePhaseCentre('ICRS 04:36:45.3572 -062.04.39.619', { ...header, RADESYS: 'FK5' }, [3200, 3200]), /FK5/u);
});
