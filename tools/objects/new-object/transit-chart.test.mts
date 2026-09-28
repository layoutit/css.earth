/** The transit chart's files, recipe and refusals (transit-chart.mts), offline. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import type { Archive } from './archives.mts';
import { installTransitChart, type TessArchive } from './transit-chart.mts';

const test = sourceTest();
const archive = (row: string): Archive => ({ async text() { return `tic_id,pl_trandur\n${row}\n`; }, async bytes() { throw new Error('none'); }, async exists() { return false; } });
const tess = (sectors: number[]): TessArchive => ({
  async lightCurves() { return sectors.map(sector => ({ name: `tess2024000000000-s00${sector}-0000000000000042-0000-s_lc.fits`, uri: `mast:TESS/product/s${sector}.fits`, bytes: 3, sector })); },
  async download() { return Buffer.from('lc!'); },
});

test('a planet with 2-minute light curves gets a folded-transit chart over the sectors MAST gives, oldest first', async () => {
  const files = new Map<string, string | Buffer>();
  const result = await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([60, 12]), () => ({ transits: 5, depthPpm: 900, errorPpm: 40 }));
  assert.equal(result.report, 'x-b: transit from TESS sectors 12, 60');
  const recipe = result.recipe as { sources: string[]; durationHours: number; binMinutes: number; planet: string; notes: string[] };
  assert.deepEqual([recipe.planet, recipe.durationHours, recipe.binMinutes], ['x-b', 2, 8], 'the archive duration, about fifteen bins across it');
  assert.deepEqual(recipe.sources, ['photometry/tess/tess2024000000000-s0012-0000000000000042-0000-s_lc.fits', 'photometry/tess/tess2024000000000-s0060-0000000000000042-0000-s_lc.fits']);
  assert.ok(recipe.sources.every(path => files.has(`src/objects/x-b/source/${path}`)), 'each file is written where the recipe reads it');
  assert.deepEqual(result.inputs!.map(input => input.id), ['x-b-tess-sector-12', 'x-b-tess-sector-60']);
  assert.ok(recipe.notes.every(note => note.length <= 52));
  // Planets of one star cite one record of its light curves, never one each (the catalogue refuses a duplicate identity).
  const record = JSON.parse(String(files.get('src/sources/mast-tess-spoc-tic-42.json'))) as { id: string; identifiers: { value: string }[] };
  assert.deepEqual([record.id, record.identifiers[0]!.value], ['mast-tess-spoc-tic-42', '42']);
  assert.ok(result.inputs!.every(input => (input as { sourceBinding: { references: { catalogueId: string }[] } }).sourceBinding.references[0]!.catalogueId === 'mast-tess-spoc-tic-42'));
});

test('no TIC id, no 2-minute light curve, or no whole transit in it gives no chart, and says which', async () => {
  const files = new Map<string, string | Buffer>();
  assert.match((await installTransitChart(files, 'x-b', 'X b', archive(',2.0'), tess([12]), () => ({ transits: 5, depthPpm: 900, errorPpm: 40 }))).report, /no TIC id or transit duration/u);
  assert.match((await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([]), () => ({ transits: 5, depthPpm: 900, errorPpm: 40 }))).report, /TESS holds no 2-minute SPOC light curve of TIC 42/u);
  const empty = await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([12]), () => ({ transits: 0, depthPpm: 0, errorPpm: Infinity }));
  assert.match(empty.report, /no whole transit in TESS sectors 12/u);
  assert.equal(empty.recipe, undefined);
  // Kepler-1542 c's case: a 40 ppm dip in noise of 30 ppm is not measured, so it is not drawn.
  const faint = await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([12]), () => ({ transits: 30, depthPpm: 40, errorPpm: 30 }));
  assert.match(faint.report, /TESS sectors 12 do not resolve its transit \(40 ± 30 ppm over 30 transits, under 5 sigma\)/u);
  assert.equal(files.size, 0, 'nothing is written without a chart');
});
