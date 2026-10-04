/** A planet's glow, measured or expected (planet-datasets.mts), offline: the Spitzer eclipse catalogue's own lines, the
 * archive's answers reduced to the rows the rules read, and TRAPPIST-1f's package, still a neutral shape, as the planet. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import type { Archive } from './archives/archives.mts';
import { EMISSION_COLUMNS, EQUILIBRIUM_QUERY, EQUILIBRIUM_TEST, SPITZER_ECLIPSES, equilibriumFromArchive, installThermalDataset, parseEquilibriumRows, parseSpitzerEclipses, thermalColorLine, thermalFromArchive, type EquilibriumSpec } from './planet-datasets.mts';

// Three lines of the catalogue's table 2 as the CDS serves them: both bands, a band never observed (0), and a non-detection.
const TABLE = ['HAT-P-01   2.97e-06 2.87e-07 7.26e-07 4.90e-07 1733  64   65 1073 206  298',
  'WASP-013   0.00e+00 0.00e+00 1.99e-06 1.91e-07    0   0    0 1512  69   70',
  'WASP-029   1.20e-07 9.00e-08 3.10e-07 6.00e-08  703 120  703  913  58   60'].join('\n');
const PS = ['pl_name,pl_eqt,pl_eqterr1,pl_eqterr2,pl_refname,default_flag,pl_pubdate',
  '"HAT-P-14 b",1570,34,-34,"<a refstr=TORRES_ET_AL__2010 href=https://ui.adsabs.harvard.edu/abs/2010ApJ...715..458T/abstract target=ref>Torres et al. 2010</a>",0,"2010-06"',
  '"HAT-P-14 b",1624,,,"<a refstr=SOUTHWORTH_2012 href=https://ui.adsabs.harvard.edu/abs/2012MNRAS.426.1291S/abstract target=ref>Southworth 2012</a>",1,"2012-11"',
  '"TOI-707 b",464.18,,,"<a refstr=EXOFOP href=https://exofop.ipac.caltech.edu/tess/view_toi.php target=ref>ExoFOP</a>",0,"2017-07"',
  '"WASP-99 b",1480,40,-40,"<a refstr=HELLIER_ET_AL__2014 href=https://ui.adsabs.harvard.edu/abs/2014MNRAS.440.1982H/abstract target=ref>Hellier et al. 2014</a>",0,"2014-05"',
  '"WASP-99 b",1530,,,"<a refstr=BONOMO_ET_AL__2017 href=https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract target=ref>Bonomo et al. 2017</a>",0,"2017-06"'].join('\n');
const archive = (asked: string[] = []): Archive => ({ exists: async () => false, bytes: async () => { throw new Error('Unexpected bytes request'); },
  text: async url => { asked.push(url); return url === SPITZER_ECLIPSES.table ? TABLE : url.includes(encodeURIComponent(EQUILIBRIUM_QUERY).slice(0, 20)) || url.includes('pl_eqt') ? PS : `${EMISSION_COLUMNS}\n`; } });

test('the Spitzer eclipse catalogue is read by its fixed columns, a planet found whatever its zero padding', () => {
  const rows = parseSpitzerEclipses(TABLE, 'HAT-P-1 b');
  assert.deepEqual(rows.map(row => [row.wavelengthMicrometres, row.temperatureK, row.temperatureErrorK, row.label, row.facility]), [[3.6, 1733, 65, 'Deming et al. 2023', 'Spitzer'], [4.5, 1073, 298, 'Deming et al. 2023', 'Spitzer']]);
  // A band Spitzer never observed is printed as 0; a temperature whose lower error reaches it is not a detection.
  assert.deepEqual(parseSpitzerEclipses(TABLE, 'WASP-13 b').map(row => [row.wavelengthMicrometres, row.temperatureK]), [[4.5, 1512]]);
  assert.deepEqual(parseSpitzerEclipses(TABLE, 'WASP-29 b').map(row => [row.wavelengthMicrometres, row.temperatureK]), [[4.5, 913]]);
  // The catalogue lists planets b only, and a planet it lacks has no rows.
  assert.deepEqual(parseSpitzerEclipses(TABLE, 'HAT-P-1 c'), []);
  assert.deepEqual(parseSpitzerEclipses(TABLE, 'HAT-P-11 b'), []);
  assert.throws(() => parseSpitzerEclipses('HAT-P-01   2.97e-06 2.87e-07 7.26e-07 4.90e-07 17x3  64   65 1073 206  298', 'HAT-P-1 b'), /J\/AJ\/165\/104 table 2: the 3\.6 µm cells of HAT-P-01 are not numbers; the table's layout has changed/u);
});

test('a planet the archive\'s emission table lacks takes its day side from the catalogue, asked once for a run', async () => {
  const asked: string[] = [], source = archive(asked);
  const first = await thermalFromArchive(source, 'HAT-P-1 b');
  assert.deepEqual([first.thermal?.temperatureK, first.thermal?.uncertaintyK, first.thermal?.wavelengthMicrometres, first.thermal?.facility, first.csv], [1733, 65, 3.6, 'Spitzer IRAC', '']);
  assert.equal(first.thermal?.source, "Deming et al. 2023, dayside brightness temperature at 3.6 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)");
  assert.equal(first.thermal?.chosen, '2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength');
  const cool = await thermalFromArchive(source, 'WASP-29 b');
  assert.match(cool.why ?? '', /^its dayside brightness temperature, 913 K \(Deming et al\. 2023\), is too cool to glow/u);
  assert.match((await thermalFromArchive(source, 'HAT-P-11 b')).why ?? '', /no measured dayside brightness temperature in the archive's emission table or the Spitzer eclipse catalogue/u);
  assert.equal(asked.filter(url => url === SPITZER_ECLIPSES.table).length, 1);
});

test('the equilibrium temperature is the default parameter set\'s, else the latest paper\'s, never a candidate list\'s', async () => {
  assert.deepEqual([...parseEquilibriumRows(PS).keys()], ['HAT-P-14 b', 'WASP-99 b'], 'ExoFOP is not a paper');
  const asked: string[] = [], source = archive(asked);
  const chosen = (await equilibriumFromArchive(source, 'HAT-P-14 b')).equilibrium;
  assert.deepEqual(chosen, { temperatureK: 1624, source: 'Southworth 2012, equilibrium temperature (NASA Exoplanet Archive planetary systems table)', url: 'https://ui.adsabs.harvard.edu/abs/2012MNRAS.426.1291S/abstract',
    chosen: "2 papers in the archive print one; the archive's default parameter set" });
  const latest = (await equilibriumFromArchive(source, 'WASP-99 b')).equilibrium;
  assert.deepEqual([latest?.temperatureK, latest?.chosen], [1530, '2 papers in the archive print one; the most recently published']);
  assert.equal((await equilibriumFromArchive(source, 'TOI-707 b')).why, 'no paper in the archive prints its equilibrium temperature');
  assert.equal(asked.length, 1, 'one request for the whole run');
  assert.throws(() => parseEquilibriumRows('pl_name,pl_eqt\n'), /answered with columns pl_name,pl_eqt, not pl_name,pl_eqt,pl_eqterr1/u);
});

test('an expected glow says it is an estimate everywhere, and a measured day side replaces it', async () => {
  const id = 'trappist-1f', o = `src/objects/${id}`, paths = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];
  const files = new Map<string, string | Buffer>(await Promise.all(paths.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const estimate: EquilibriumSpec = { temperatureK: 1624, source: 'Southworth 2012, equilibrium temperature (NASA Exoplanet Archive planetary systems table)', url: 'https://ui.adsabs.harvard.edu/abs/2012MNRAS.426.1291S/abstract', chosen: "2 papers in the archive print one; the archive's default parameter set" };
  const installed = await installThermalDataset(files, id, 'TRAPPIST-1f', estimate, undefined);
  const science = after('source/preparation/raster.json').surfaces[0].science, control = after('source/content/object.json').datasets.controls[0];
  assert.equal(science.kind, 'equilibrium-thermal-color');
  assert.match(science.qualification, /^An estimate, not a measurement: the color of a black body at the equilibrium temperature 1,624 K \(Southworth 2012/u);
  assert.deepEqual([control.label, control.qualification], ['Expected glow', 'An estimate, not a measurement: black-body color at its published equilibrium temperature, 1,624 K.']);
  assert.match(control.notes, new RegExp(`^Nobody has measured TRAPPIST-1f's heat\\. This is the color of a black body at 1,624 K, the equilibrium temperature its paper computes from its star's light .*${EQUILIBRIUM_TEST.replace(/[()]/gu, '\\$&')}\\.`, 'u'));
  assert.deepEqual(after('text.json').datasets.thermal, { title: 'Estimated heat', detail: 'An estimate, not measured', summary: "Not measured: the color of a black body at the 1,624 K its paper computes from its star's light." });
  assert.equal(after('source/photometry/thermal-color.json').temperature.estimate, true);
  assert.match(installed.credit, /^Color: an estimate, a black body at the 1,624 K equilibrium temperature of Southworth 2012/u);
  assert.match(thermalColorLine(estimate, installed.hex), /^\*\*Color\.\*\* An estimate, not a measurement: a black body at the 1,624 K equilibrium temperature of Southworth 2012.*within 20% of this kind of estimate for 83% \(Deming et al\. 2023\); see \[the expected glow\]/u);
  // Measured later, the same dataset is rebuilt as a measurement, with one color input.
  const measured = (await thermalFromArchive(archive(), 'HAT-P-1 b')).thermal!;
  await installThermalDataset(files, id, 'TRAPPIST-1f', measured, undefined);
  assert.equal(after('source/preparation/raster.json').surfaces[0].science.kind, 'dayside-thermal-color');
  assert.equal(after('source/content/object.json').datasets.controls[0].label, 'Thermal glow');
  assert.equal(after('source/photometry/thermal-color.json').temperature.estimate, undefined);
  assert.equal(after('source/manifest.json').inputs.filter((input: { id: string }) => input.id === 'trappist-1f-thermal-color').length, 1);
  assert.match(thermalColorLine(measured, '#ff7c00'), /^\*\*Color\.\*\* A black body at the 1,733 K dayside brightness temperature measured in secondary eclipse at 3\.6 µm/u);
});
