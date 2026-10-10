/** The transit chart's files, recipe and refusals (transit-chart.mts), offline. */
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { Archive } from '../archives/archives.mts';
import { installTransitChart, type Fold, type FoldMeasure, type TessArchive } from './transit-chart.mts';

const test = sourceTest();
const archive = (row: string): Archive => ({ async text() { return `tic_id,pl_trandur\n${row}\n`; }, async bytes() { throw new Error('none'); }, async exists() { return false; } });
/** A fold whose dip is `at` for every shift, or a function of the shift. */
const fold = (at: FoldMeasure | ((shift: number) => FoldMeasure)): Fold => ({ midBmjd: () => 60500, measure: (_c, _d, shift) => typeof at === 'function' ? at(shift) : at });
const tess = (sectors: number[]): TessArchive => ({
  async lightCurves() { return sectors.map(sector => ({ name: `tess2024000000000-s00${sector}-0000000000000042-0000-s_lc.fits`, uri: `mast:TESS/product/s${sector}.fits`, bytes: 3, sector })); },
  async download() { return Buffer.from('lc!'); },
});

test('a planet with 2-minute light curves gets a folded-transit chart over the sectors MAST gives, oldest first', async () => {
  const files = new Map<string, string | Buffer>();
  const result = await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([60, 12]), fold(({ transits: 5, depthPpm: 900, errorPpm: 40 })));
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
  assert.match((await installTransitChart(files, 'x-b', 'X b', archive(',2.0'), tess([12]), fold(({ transits: 5, depthPpm: 900, errorPpm: 40 })))).report, /no TIC id or transit duration/u);
  assert.match((await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([]), fold(({ transits: 5, depthPpm: 900, errorPpm: 40 })))).report, /TESS holds no 2-minute SPOC light curve of TIC 42/u);
  const empty = await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([12]), fold(({ transits: 0, depthPpm: 0, errorPpm: Infinity })));
  assert.match(empty.report, /no whole transit in TESS sectors 12/u);
  assert.equal(empty.recipe, undefined);
  // HD 101581 c's case: its dip is 176 min late, inside 3 sigma of an ephemeris uncertain by 99 min, so the chart aligns on it.
  const aligned = await installTransitChart(new Map(), 'x-b', 'X b', archive('"TIC 42",2.0'), tess([12]),
    fold(shift => shift === 176 ? { transits: 9, depthPpm: 140, errorPpm: 16 } : { transits: 9, depthPpm: 0, errorPpm: 16 }), () => 99 / 1440);
  assert.equal((aligned.recipe as { alignMinutes?: number }).alignMinutes, 176);
  assert.match(aligned.report, /aligned 176 min \(1 sigma 99 min\)/u);
  // HR 858 b's case: a dip 344 min off an ephemeris good to 8 min lies beyond the search, so there is no chart.
  const hr858 = await installTransitChart(new Map(), 'x-b', 'X b', archive('"TIC 42",2.0'), tess([12]),
    fold(shift => shift === -344 ? { transits: 22, depthPpm: 144, errorPpm: 7 } : { transits: 22, depthPpm: -31, errorPpm: 6 }), () => 8 / 1440);
  assert.match(hr858.report, /show no 5-sigma dip within 3 sigma \(24 min\) of its ephemeris/u);
  // Kepler-1542 c's case: a 40 ppm dip in noise of 30 ppm is not measured, so it is not drawn.
  const faint = await installTransitChart(files, 'x-b', 'X b', archive('"TIC 42",2.0'), tess([12]), fold(({ transits: 30, depthPpm: 40, errorPpm: 30 })));
  assert.match(faint.report, /TESS sectors 12 show no 5-sigma dip at its ephemeris \(best 40 ± 30 ppm over 30 transits\)/u);
  assert.equal(files.size, 0, 'nothing is written without a chart');
});

/** An archive that also answers the table of Kepler names, and a MAST whose TESS and Kepler files differ by their bytes. */
const keplerArchive: Archive = { async text(url) { return decodeURIComponent(url).includes('keplernames') ? 'kepid,kepler_name\n"6541920","Kepler-11 b"\n' : 'tic_id,pl_trandur\n"TIC 42",4.1\n'; }, async bytes() { throw new Error('none'); }, async exists() { return false; } };
const mast = (sectors: number[], quarters: number[]): TessArchive => ({
  ...tess(sectors),
  async keplerLightCurves(kic) { return quarters.map(quarter => ({ name: `kplr00${kic}-20090000000${quarter}_llc.fits`, uri: `mast:KEPLER/url/q${quarter}.fits`, bytes: 3, sector: quarter })); },
  async download(file) { return Buffer.from(file.name.startsWith('kplr') ? 'kp!' : 'lc!'); },
});
/** A fold that measures the dip only in Kepler's files. */
const keplerOnly = (dip: FoldMeasure): Fold => ({ midBmjd: () => 55500, measure: curves => String(curves[0]) === 'kp!' ? dip : { transits: 6, depthPpm: 300, errorPpm: 250 } });

test('a planet of a Kepler star that TESS does not resolve is folded from the star\'s Kepler quarters', async () => {
  const files = new Map<string, string | Buffer>();
  const result = await installTransitChart(files, 'x-b', 'X b', keplerArchive, mast([75, 81], [5, 3, 1, 2]), keplerOnly({ transits: 120, depthPpm: 250, errorPpm: 12 }));
  assert.equal(result.report, 'x-b: transit from Kepler quarters 1 to 3, 5');
  const recipe = result.recipe as { sources: string[]; binMinutes: number; notes: string[]; metadata: Record<string, unknown>; description: string };
  assert.deepEqual(recipe.sources, [1, 2, 3, 5].map(quarter => `photometry/kepler/kplr006541920-20090000000${quarter}_llc.fits`));
  assert.ok(recipe.sources.every(path => String(files.get(`src/objects/x-b/source/${path}`)) === 'kp!'), 'Kepler\'s files are the ones written');
  assert.equal(recipe.binMinutes, 30, 'no bin is narrower than the 30-minute cadence');
  assert.deepEqual(recipe.metadata, { kic: 'KIC 6541920', quarters: [1, 2, 3, 5], pipeline: 'Kepler pipeline, PDCSAP flux, quality 0' });
  assert.match(recipe.description, /as Kepler recorded it: 4 quarters \(1 to 3, 5\) of the Kepler pipeline's 30-minute light curves of KIC 6541920/u);
  assert.ok(recipe.notes.every(note => note.length <= 52) && recipe.notes[0] === 'Kepler 30-min · quarters 1 to 3, 5');
  assert.deepEqual(result.inputs!.map(input => input.id), [1, 2, 3, 5].map(quarter => `x-b-kepler-quarter-${quarter}`));
  const record = JSON.parse(String(files.get('src/sources/mast-kepler-kic-6541920.json'))) as { identifiers: { type: string; value: string }[]; title: string };
  assert.deepEqual([record.identifiers[0], record.title], [{ type: 'KIC', value: '6541920' }, 'Kepler long-cadence light curves of KIC 6541920, quarters 1 to 3, 5']);
  assert.equal(result.readme, 'its transit in 4 Kepler quarters (1 to 3, 5), folded onto its orbit');
  // A star whose detector module failed misses a quarter a year: the note gives the count and span where the list does not fit.
  const gapped = await installTransitChart(new Map(), 'x-b', 'X b', keplerArchive, mast([], [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17]), keplerOnly({ transits: 6, depthPpm: 4000, errorPpm: 30 }));
  assert.equal((gapped.recipe as { notes: string[] }).notes[0], 'Kepler 30-min · 14 quarters, 1 to 17');
  assert.match((gapped.recipe as { description: string }).description, /14 quarters \(1 to 7, 9 to 11, 13 to 15, 17\)/u);
});

test('Kepler is asked only after TESS, and a dip neither resolves gives both reasons', async () => {
  // TESS measures the dip: its sectors are the chart's, and Kepler is never asked.
  const seen = await installTransitChart(new Map(), 'x-b', 'X b', keplerArchive, { ...mast([75], [1]), async keplerLightCurves() { throw new Error('not asked'); } }, fold({ transits: 5, depthPpm: 900, errorPpm: 40 }));
  assert.equal(seen.report, 'x-b: transit from TESS sectors 75');
  const neither = await installTransitChart(new Map(), 'x-b', 'X b', keplerArchive, mast([75], [1, 2]), keplerOnly({ transits: 14, depthPpm: 94, errorPpm: 24 }));
  assert.equal(neither.report, 'x-b: TESS sectors 75 show no 5-sigma dip at its ephemeris (best 300 ± 250 ppm over 6 transits); Kepler quarters 1 to 2 show no 5-sigma dip at its ephemeris (best 94 ± 24 ppm over 14 transits), so no transit chart');
  const unwatched = await installTransitChart(new Map(), 'x-b', 'X b', keplerArchive, mast([75], []), keplerOnly({ transits: 14, depthPpm: 94, errorPpm: 24 }));
  assert.match(unwatched.report, /Kepler holds no long-cadence light curve of KIC 6541920/u);
  // A star the table of Kepler names does not hold is TESS's alone.
  const other = await installTransitChart(new Map(), 'x-b', 'X b', archive('"TIC 42",2.0'), mast([75], [1]), keplerOnly({ transits: 120, depthPpm: 250, errorPpm: 12 }));
  assert.equal(other.report, 'x-b: TESS sectors 75 show no 5-sigma dip at its ephemeris (best 300 ± 250 ppm over 6 transits), so no transit chart');
});
