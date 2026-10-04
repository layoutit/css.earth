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
  // The planet of a binary's primary is listed under the system's name; a planet of the secondary is not it.
  assert.deepEqual(parseSpitzerEclipses(TABLE, 'HAT-P-1 A b').map(row => row.temperatureK), [1733, 1073]);
  assert.deepEqual(parseSpitzerEclipses(TABLE, 'HAT-P-1 B b'), []);
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
  // TRAPPIST-1f also carries an illustration: the glow replaces the neutral shape, and the illustration stays beside it.
  assert.deepEqual(after('source/content/object.json').datasets.controls.map((entry: { id: string }) => entry.id), ['thermal', 'illustration']);
  assert.deepEqual(after('source/preparation/raster.json').surfaces.map((entry: { id: string }) => entry.id), ['thermal', 'illustration']);
  assert.deepEqual(Object.keys(after('text.json').datasets).sort(), ['illustration', 'thermal']);
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

test('a measured day side too cool to glow, or on an eccentric orbit, is its own false-color dataset on one shared scale', async () => {
  const { DAYSIDE_SCALE, daysideLine, installDaysideDataset } = await import('./thermal/dayside-dataset.mts');
  const cool = (await thermalFromArchive(archive(), 'WASP-29 b')).cool!;
  assert.deepEqual([cool.temperatureK, cool.uncertaintyK, cool.wavelengthMicrometres], [913, 60, 4.5], 'the lookup hands back a measurement it cannot show as a glow');
  const id = 'trappist-1f', o = `src/objects/${id}`, paths = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];
  const files = new Map<string, string | Buffer>(await Promise.all(paths.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  assert.deepEqual(installDaysideDataset(files, id, 'TRAPPIST-1f', cool, false), { promoted: true });
  assert.deepEqual(after('source/photometry/dayside-temperature.json').temperatureK, { value: 913, lower: 853, upper: 973 });
  const surface = after('source/preparation/raster.json').surfaces.at(-1), content = after('source/content/object.json'), control = content.datasets.controls.at(-1);
  assert.deepEqual([surface.id, surface.science.format, surface.science.minimum, surface.science.maximum, surface.science.labels], ['dayside', 'measured-dayside', DAYSIDE_SCALE.minimum, DAYSIDE_SCALE.maximum, ['300', '1650', '3000']]);
  const shown = content.datasets.controls.map((entry: { id: string }) => entry.id);
  assert.deepEqual([content.datasets.defaultDataset, shown.includes('shape'), shown.at(-1), control.label], ['dayside', true, 'dayside', 'Day side'], 'the shape stays beside it');
  assert.match(control.notes, /^The day side of TRAPPIST-1f is 913 K: its brightness temperature at 4\.5 µm \(Spitzer IRAC\).*The night side is not measured and is left blank\./u);
  assert.deepEqual(after('text.json').datasets.dayside, { title: 'Measured day side', detail: 'Measured in eclipse', summary: 'The day side is 913 K, measured at 4.5 µm. The night side is not measured.' });
  assert.match(daysideLine(cool, false), /^\*\*Measured day side\.\*\* .*913 K at 4\.5 µm \(Deming et al\. 2023.*It is too cool for a visible glow/u);
  // On an eccentric orbit the texts say when the temperature holds, and the dataset replaces itself.
  const hot = (await thermalFromArchive(archive(), 'HAT-P-1 b')).thermal!;
  assert.deepEqual(installDaysideDataset(files, id, 'TRAPPIST-1f', hot, true), { promoted: false });
  assert.equal(after('source/preparation/raster.json').surfaces.filter((entry: { id: string }) => entry.id === 'dayside').length, 1);
  assert.equal(after('text.json').datasets.dayside.summary, 'The day side is 1,733 K at secondary eclipse, measured at 3.6 µm. The night side is not measured.');
  assert.match(after('source/content/object.json').datasets.controls.at(-1).notes, /The orbit is eccentric, so the temperature holds for the moment of eclipse, not round the orbit\./u);
  assert.match(daysideLine(hot, true), /at secondary eclipse,.*No black-body glow is shown, since the temperature holds for one moment of the orbit\.$/u);
  assert.throws(() => installDaysideDataset(files, id, 'TRAPPIST-1f', { ...cool, temperatureK: 250 }, false), /a dayside temperature of 250 K is outside the 300 to 3000 K scale/u);
});

test('a small planet of a red dwarf takes the bare-rock maximum, and only when it is like the rocks that test it', async () => {
  const { ROCK_TEST, rockEstimate } = await import('./planet-datasets.mts');
  const star = { id: 'gj-806', kelvin: 3600, source: 'Palle et al. 2023, the stellar temperature of the default parameter set (https://example.org)' }, orbit = { aOverRstar: 7.3, source: 'Palle et al. 2023 (2023A&A...678A..80P): a/R* 7.3' };
  const { rock } = rockEstimate(8489.3, star, orbit);
  // 3600 / sqrt(7.3) = 1332 K of irradiation; times (2/3)^(1/4) = 1204 K.
  assert.deepEqual([rock?.temperatureK, rock?.rock, rock?.url], [1204, true, 'https://arxiv.org/abs/2412.06573']);
  assert.equal(rock?.source, "computed from gj-806's temperature, 3600 K, and the orbit's a/R* 7.3, as T* (R*/a)^(1/2) (2/3)^(1/4)");
  assert.match(rockEstimate(1.8 * 6371, star, orbit).why ?? '', /at 1\.80 Earth radii it is larger than the rocks the estimate was tested on/u);
  assert.match(rockEstimate(8489.3, { ...star, kelvin: 4100 }, orbit).why ?? '', /its star, at 4100 K, is hotter than the red dwarfs the estimate was tested on/u);
  assert.match(rockEstimate(8489.3, star, { ...orbit, aOverRstar: 3 }).why ?? '', /its irradiation temperature, 2078 K, is outside the 480 to 1,930 K the estimate was tested on/u);
  // Installed, every text says it is a bare-rock estimate and states the test with its outlier.
  const id = 'trappist-1f', o = `src/objects/${id}`, paths = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json', 'source/manifest.json'];
  const files = new Map<string, string | Buffer>(await Promise.all(paths.map(async path => [`${o}/${path}`, await readFile(resolve(WORKSPACE, o, path), 'utf8')] as const)));
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const installed = await installThermalDataset(files, id, 'TRAPPIST-1f', rock!, undefined), control = after('source/content/object.json').datasets.controls[0];
  assert.equal(control.qualification, 'An estimate, not a measurement: black-body color at 1,204 K, the bare-rock maximum for its orbit.');
  assert.ok(control.notes.includes(ROCK_TEST) && control.notes.includes('the hottest day side a dark, airless rock can have on its orbit'));
  assert.equal(after('text.json').datasets.thermal.summary, 'Not measured: the color of a black body at the 1,204 K a dark, airless rock would reach there.');
  assert.match(thermalColorLine(rock!, installed.hex), /^\*\*Color\.\*\* An estimate, not a measurement: a black body at 1,204 K, the hottest day side a dark, airless rock can have on its orbit.*GJ 357 b, measured since, is 35% above it/u);
});
