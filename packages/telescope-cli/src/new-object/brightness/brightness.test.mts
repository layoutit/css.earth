import assert from 'node:assert/strict';
import test from 'node:test';
import { surfaceMapFiles } from '../maps/surface-maps.mts';
import { adoptPeriod, measuredPeriod, starMetadata } from '../metadata/star-metadata.mts';
import { BRIGHTNESS_CONSUMER, BRIGHTNESS_MAPS, brightnessChoice, brightnessSourceRecords, monthsOf, reducedBrightness, missionDay, shortMonthsOf, tinted } from './brightness-maps.mts';
import { withBrightnessReadme, withMeasuredRotation, withPixelLight } from './brightness.mts';

const TABLE = 'TITLE     = "test"\nVARIABLES = "Longitude [Deg]" "Latitude [Deg]" "Brightness [%]"\nZONE I=2, J=2, K=1, ZONETYPE=Ordered\n';
const HOLCOMB = { id: 'holcomb-2022', citation: 'Holcomb et al. (2022, ApJ 936, 138)', url: 'https://arxiv.org/abs/2206.10629', where: 'Sects. II and III', lightCurve: 'the TESS mission\'s 2-minute light curve of a sector, reduced by its PDC-MAP pipeline and binned to 30 minutes',
  asks: 'the peaks of the light\'s autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star\'s sectors and in all of them together', reliability: 'On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set.' };
const SAYS = 'a period of 4.85 d from the autocorrelation, whose peaks have a height of 0.33, a width of 0.43 and a fit of 0.95';
/** A star with one TESS sector, judged by Holcomb et al. (2022) on the mission's 2-minute light curve. */
const receipt = (from: string, source: string) => ({ schema: 'cssearth-tess-rotation@2', star: { id: 'hd-1', name: 'HD 1' }, light: { gaiaDr3: '1', magnitude: 6.8, neighbours: 16, neighbourShare: 0.0029 }, mission: 'TESS', method: HOLCOMB,
  tried: [{ mission: 'TESS', window: 95, method: 'holcomb-2022', analysis: { periodDays: 4.85, height: 0.33, width: 0.43, fit: 0.95, centre: 0.001, range: 0.085 }, says: SAYS, verdict: { detected: true, periodDays: 4.85, amplitude: 0.085 } }],
  rotation: { detected: true, periodDays: 4.85, amplitude: 0.085 } as { detected: boolean; periodDays?: number; lightPeriodDays?: number; amplitude?: number; reason?: string }, toolchain: { id: 'tess-photometry', requirements: ['numpy==2.5.3', 'lightkurve==2.6.0', 'star-privateer==1.3.1', 'spinspotter==0.2.0'] },
  maps: [{ mission: 'TESS', window: 95, table: 'hd-1-s0095.dat', degree: 5, inclinationDegrees: 60, inclinationFrom: from, inclinationSource: source, periodDays: 4.85, residual: 0.00509, noise: 0.00173, darkestPercent: 93.4, brightestPercent: 104.2, starry: '1.2.0' }] });
/** Sector 95's light: 3 August to 29 August 2025 as TESS times. */
const LIGHT = { sector: 95, time: [3890.5, 3903.2, 3916.9], flux: [1.01, 0.99, 1] };
const HOST = () => ({ content: { datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } }, manifest: { inputs: [{ id: 'star-color', path: 'photometry/color.json', consumers: ['datasets'] }] },
  raster: { surfaces: [{ id: 'color', output: 'hd-1-surface-{id}{suffix}.webp', thumbnail: 'hd-1-dataset-{id}.webp', science: { kind: 'stellar-photometric-color' } }, { id: 'radial-field-2007-06', output: 'x', thumbnail: 'y', science: { kind: 'terrestrial-scientific', consumer: 'espadons-zdi' } }] },
  descriptor: { properties: { recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'color', source: 'content', material: 'emission' }, { id: 'radial-field-2007-06', source: 'content', material: 'emission' }] }] } } } });

test('a brightness map becomes the star page\'s records, saying it is made here and what a light curve cannot fix', () => {
  const choice = brightnessChoice('hd-1', 'TESS', 95); assert.deepEqual(choice, { program: 'hd-1-s0095', id: 'brightness-sector-95', label: 'Sector 95' });
  const map = reducedBrightness(choice, receipt('assumed', 'assumed: no tilt of the star is known'), TABLE, LIGHT);
  assert.deepEqual([map.window, map.periodDays, map.tiltFrom, map.codes], [95, 4.85, 'assumed', ['lightkurve 2.6.0', 'SpinSpotter 0.2.0', 'starry 1.2.0']]);
  const { files, report } = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1' }, [map], HOST()), read = (path: string) => JSON.parse(files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.equal(files.get('src/objects/hd-1/source/science/tess/pdcsap/hd-1-s0095.dat'), TABLE); assert.match(report, /1 brightness map on one scale of 92% to 108% \(Sector 95: turns in 4\.85 days, light swings 8\.5%\)/u);
  // A map of another kind on the page is left as it is; the scale is centred on the star's mean surface.
  const surfaces = read('source/preparation/raster.json').surfaces, science = surfaces[2].science;
  assert.deepEqual(surfaces.map((surface: { id: string }) => surface.id), ['color', 'radial-field-2007-06', 'brightness-sector-95']);
  assert.deepEqual([science.variable, science.units, science.minimum, science.maximum, science.labels, science.consumer, science.outlineLatitudes], ['Brightness [%]', '%', 92, 108, ['92%', '100%', '108%'], BRIGHTNESS_CONSUMER, undefined]);
  assert.match(science.description, /turns once in 4\.85 days.*fitted with starry to the TESS mission's own 2-minute light curve of sector 95 \(its PDC-MAP flux\) \(the light varies by 8\.5%; the map's curve leaves a scatter of 0\.51%, the light's own noise being 0\.17%\)\. A light curve fixes how bright each longitude is, not the latitude of what darkens it\. In this sector the method of Holcomb et al\. \(2022, ApJ 936, 138\) finds a period of 4\.85 d from the autocorrelation, whose peaks have a height of 0\.33, a width of 0\.43 and a fit of 0\.95; its criteria accept that as the star's rotation\..*No tilt of this star's axis is known: the map is made at 60°.*Gaia DR3 lists 16 other stars within 63 arcseconds, with 0\.29% of their light and the star's together\. A reduction made in this project, not a published map\./u);
  const control = read('source/content/object.json').datasets.controls[1]; assert.deepEqual([control.label, control.step, control.legend.meta, control.source.id], ['Brightness map', undefined, '%', 'hd-1-tess-map-brightness-sector-95']);
  assert.match(control.notes, /worked out in this project.*The light curve is the mission's own; the criteria of Holcomb et al\. \(2022, ApJ 936, 138\) decide that it shows the star turning, and starry.*their latitudes are not/u); assert.doesNotMatch(control.legendNote, /Black line/u);
  // The table is built here and kept out of git, so it is a generated intermediate of the manifest, not an input.
  assert.equal(read('source/manifest.json').inputs.length, 1); const input = read('source/manifest.json').generatedIntermediates[0]; assert.equal(input.path, 'science/tess/pdcsap/hd-1-s0095.dat'); assert.match(input.credit, /^NASA TESS mission light curve \(PDC-MAP\), sector 95, from MAST; its rotation judged by the criteria of Holcomb et al\. \(2022, ApJ 936, 138\); map made in this project with lightkurve 2\.6\.0, SpinSpotter 0\.2\.0 and starry 1\.2\.0\./u);
  // The table is built here and kept out of git: its input names the command that makes it.
  assert.equal(input.generator, 'packages/telescope-cli/src/archives/tess/reduce.mts'); assert.match(input.acquisition, /Restored from the source cache; not tracked/u);
  assert.deepEqual(input.sourceBinding.references.map((reference: { catalogueId: string }) => reference.catalogueId), ['mast-tess-light-curves', 'arxiv-2206-10629', 'arxiv-1810-06559', 'gaia-2023-dr3']);
  assert.deepEqual([...brightnessSourceRecords('2026-10-06', [map]).keys()], ['src/sources/arxiv-2206-10629.json', 'src/sources/mast-tess-light-curves.json', 'src/sources/arxiv-1810-06559.json']);
  assert.deepEqual(read('object.json').properties.recipe.surfaces[0].datasets.map((one: { id: string }) => one.id), ['color', 'radial-field-2007-06', 'brightness-sector-95']);
  // With the star's color, the page opens on the star in that color at the map's own contrast, then its map, then what it had.
  const colored = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1', colorHex: '#ffc08b' }, [map], HOST()), shown = (path: string) => JSON.parse(colored.files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.equal(colored.opensOn, 'color-brightness'); assert.deepEqual([shown('source/content/object.json').datasets.defaultDataset, shown('source/content/object.json').datasets.controls.map((one: { id: string }) => one.id)], ['color-brightness', ['color-brightness', 'brightness-sector-95', 'color']]);
  const own = shown('source/preparation/raster.json').surfaces.at(-1).science;
  assert.equal(own.limbStrength, 1.5); assert.deepEqual([own.id, own.limbOf, own.minimum, own.maximum, own.colors.length, own.colors.at(-1), shown('source/preparation/raster.json').surfaces.at(-1).falseColor], ['color-brightness', 'color', 92, 108, 5, '#ffc08b', false]);
  // The Brightness map's own scale, from a darker, richer step of the star's hue up to its color; a color with no hue stays neutral.
  assert.deepEqual(own.colors, tinted('#ffc08b')); assert.deepEqual(tinted('#ffc08b'), ['#7f4600', '#9f6423', '#bf8346', '#dfa168', '#ffc08b']); assert.deepEqual(tinted('#ffffff'), ['#808080', '#a0a0a0', '#c0c0c0', '#dfdfdf', '#ffffff']);
  assert.match(shown('source/content/object.json').datasets.controls[0].notes, /in TESS's images of August 2025.*The contrast is drawn far stronger than it is, so the eye can see it: the darkest part gives 10\.4% less light than the brightest, and is drawn as a much darker tone of the star's own hue; the Brightness map's scale has the measured values.*Their latitudes and shapes are not.*No change of color is drawn/u);
  assert.deepEqual(shown('text.json').datasets['color-brightness'], { title: 'Color + brightness, Aug 2025', detail: 'TESS sector 95', summary: 'The star in its own color, darker where its light shows it darker; the contrast is drawn stronger to be seen.' });
  assert.equal(shown('text.json').datasets['brightness-sector-95'].detail, 'Sector 95, mapped here'); assert.equal(shortMonthsOf('2025-12-20', '2026-01-15'), 'Dec 2025 to Jan 2026'); assert.equal(monthsOf('2025-08-29', '2025-09-22'), 'August and September 2025'); assert.equal(monthsOf('2017-03-08', '2017-05-27'), 'March to May 2017'); assert.equal(missionDay(3890.5), '2025-08-03');
  // Written again over its own records, nothing moves and the page is not said to open elsewhere.
  const again = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1', colorHex: '#ffc08b' }, [map], { content: shown('source/content/object.json'), text: shown('text.json'), manifest: shown('source/manifest.json'), raster: shown('source/preparation/raster.json'), descriptor: shown('object.json') });
  assert.equal(again.opensOn, undefined); assert.equal(again.files.get('src/objects/hd-1/source/content/object.json'), colored.files.get('src/objects/hd-1/source/content/object.json')); assert.equal(again.files.get('src/objects/hd-1/source/preparation/raster.json'), colored.files.get('src/objects/hd-1/source/preparation/raster.json'));
  // Only a page that measures the star's axis draws the star at the map's tilt, and outlines what it never shows.
  const drawn = reducedBrightness(choice, receipt('page', 'rotation.json: the measured axis the star\'s page draws'), TABLE, LIGHT), outlined = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1' }, [drawn], HOST());
  assert.deepEqual((JSON.parse(outlined.files.get('src/objects/hd-1/source/preparation/raster.json')!) as Record<string, any>).surfaces[2].science.outlineLatitudes, [-60]);
  assert.throws(() => reducedBrightness(choice, { ...receipt('page', 'x'), rotation: { detected: false, reason: 'Too faint.' } }, TABLE, LIGHT), /rotation is not seen \(Too faint\.\)/u);
  // A light that repeats twice a turn says so.
  const twice = reducedBrightness(choice, { ...receipt('assumed', 'assumed'), rotation: { detected: true, periodDays: 4.85, lightPeriodDays: 2.42, amplitude: 0.0075 } }, TABLE, LIGHT);
  assert.match(BRIGHTNESS_MAPS.words(twice, { star: { id: 'hd-1', name: 'HD 1' }, count: 1, epochs: '1 epoch', tilt: 60, outlined: false }).notes, /The light repeats every 2\.42 days, half the rotation period the catalogues print/u);
  assert.throws(() => reducedBrightness(brightnessChoice('hd-1', 'TESS', 27), receipt('page', 'x'), TABLE, LIGHT), /holds no map of that window/u);
});

test('a K2 map is of the mission\'s own light curve and names the published method that judged it a rotation', () => {
  // K2-136 in campaign 13: the receipt names Reinhold & Hekker (2020), the light curve they use and what their three methods measured.
  const k2 = { ...receipt('record', 'measurements.json, spinInclinationDegrees'), light: { gaiaDr3: '1', magnitude: 10.1, neighbours: 0, neighbourShare: 0 }, rotation: { detected: true, periodDays: 14.46, amplitude: 0.0067 },
    toolchain: { id: 'tess-photometry', requirements: ['lightkurve==2.6.0', 'star-privateer==1.3.1'] },
    method: { id: 'reinhold-hekker-2020', citation: 'Reinhold & Hekker (2020, A&A 635, A43)', url: 'https://arxiv.org/abs/2001.08214', where: 'Sects. 2 and 3', lightCurve: 'the K2 mission\'s long-cadence light curve of a campaign, reduced by its PDC-MAP pipeline', asks: 'the periodogram, the wavelet and the autocorrelation to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3',
      reliability: 'Of the paper\'s stars observed in two campaigns, 75.7% gave periods within 20% of each other.' },
    tried: [{ mission: 'K2', window: 5, verdict: { detected: false } }, { mission: 'K2', window: 13, method: 'reinhold-hekker-2020', says: 'periodogram 15.00 d, wavelet 14.63 d, autocorrelation 13.75 d; periodogram peak 0.56', analysis: { spanDays: 80.5, variabilityRange: 0.0067, peakHeight: 0.561, lombScargleDays: 15.002, waveletDays: 14.629, autocorrelationDays: 13.75 } }],
    mission: 'K2', maps: [{ ...receipt('record', 'x').maps[0]!, mission: 'K2', window: 13, table: 'hd-1-c13.dat', periodDays: 14.46, inclinationFrom: 'record', inclinationSource: 'measurements.json, spinInclinationDegrees' }] };
  const choice = brightnessChoice('hd-1', 'K2', 13); assert.deepEqual(choice, { program: 'hd-1-c13', id: 'brightness-campaign-13', label: 'Campaign 13' });
  // K2's clock starts at BJD 2,454,833: day 2988.5 is 9 March 2017.
  const map = reducedBrightness(choice, k2, TABLE, { time: [2988.5, 3030, 3068.5], flux: [1, 1, 1] });
  assert.deepEqual([map.mission, map.window, map.fromUtc, map.toUtc, map.method!.periodsDays, map.codes], ['K2', 13, '2017-03-09', '2017-05-28', [15.002, 14.629, 13.75], ['lightkurve 2.6.0', 'star-privateer 1.3.1', 'starry 1.2.0']]);
  const { files } = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1' }, [map], HOST()), read = (path: string) => JSON.parse(files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  // Its table, surface and input carry K2's own names, and its input is bound to the mission's light curves, the method's paper and starry's.
  assert.equal(files.get('src/objects/hd-1/source/science/k2/pdcsap/hd-1-c13.dat'), TABLE); const surface = read('source/preparation/raster.json').surfaces[2].science, input = read('source/manifest.json').generatedIntermediates[0];
  assert.equal(surface.consumer, 'k2-starry'); assert.match(surface.description, /fitted with starry to the K2 mission's own light curve of campaign 13 \(its PDC-MAP flux\) \(the light varies by 0\.67%;.*The period is the mean of three methods' periods \(periodogram 15\.00 d, wavelet 14\.63 d, autocorrelation 13\.75 d; periodogram peak 0\.56\), accepted by the criteria of Reinhold & Hekker \(2020, A&A 635, A43\).*Gaia DR3 lists no other star within 16 arcseconds of it\. A reduction made/u);
  assert.equal(input.id, 'hd-1-k2-map-brightness-campaign-13'); assert.match(input.credit, /^NASA K2 mission light curve \(PDC-MAP\), campaign 13, from MAST; its rotation judged by the criteria of Reinhold & Hekker \(2020, A&A 635, A43\); map made in this project with lightkurve 2\.6\.0, star-privateer 1\.3\.1 and starry 1\.2\.0\./u);
  assert.match(read('source/content/object.json').datasets.controls[1].notes, /The light curve is the mission's own; the criteria of Reinhold & Hekker \(2020, A&A 635, A43\) decide that it shows the star turning, and starry finds the map/u);
  assert.deepEqual(input.sourceBinding.references.map((reference: { catalogueId: string; role: string }) => [reference.catalogueId, reference.role]), [['mast-k2-light-curves', 'material'], ['arxiv-2001-08214', 'method'], ['arxiv-1810-06559', 'method'], ['gaia-2023-dr3', 'reference']]);
  assert.deepEqual([...brightnessSourceRecords('2026-10-06', [map]).keys()], ['src/sources/arxiv-2001-08214.json', 'src/sources/mast-k2-light-curves.json', 'src/sources/arxiv-1810-06559.json']);
  // The README's evidence is the method's: its three periods, its peak, what it asks and how reliable its paper found it.
  const readme = withBrightnessReadme('# HD 1\n\n## Sources\n\nGaia.\n\n## Evidence\n\nRun.\n\n## Known problems\n\n- None.\n', map, 15);
  assert.match(readme, /\*\*Brightness from K2\.\*\* The Color \+ brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 13 \(March to May 2017; its PDC-MAP flux, kept at \[MAST\].*It is the light curve \[Reinhold & Hekker \(2020, A&A 635, A43\)\]\(https:\/\/arxiv\.org\/abs\/2001\.08214\) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry \(Luger et al\. 2019\) makes the map/su);
  assert.match(readme, /In K2 campaign 13 the light varies by 0\.67% \(the range between its 5th and 95th percentiles\)\. The periodogram, the wavelet and the autocorrelation give 15\.00, 14\.63 and 13\.75 d, and the periodogram's peak has a height of 0\.56: within what Reinhold & Hekker \(2020, A&A 635, A43\) ask of a rotation \(the three within two days of each other, a peak over 0\.3\)\. The period is their mean, 14\.46 d\. Of the paper's stars observed in two campaigns, 75\.7%.*The star's record holds 15 d from the catalogues.*Gaia DR3 lists no other star within 16 arcseconds\./su);
  assert.match(String(withMeasuredRotation({ shape: 'sphere' }, map).rotationPeriodMeasuredSource), /from the K2 mission's own light curve of campaign 13 \(.*reduce\.mts\), by the method and criteria of Reinhold & Hekker \(2020, A&A 635, A43\): 14\.46 d/u);
  // A star observed in two campaigns has one period, the mean of theirs, and its texts say so.
  const two = { ...k2, rotation: { detected: true, periodDays: 14.2, amplitude: 0.006 }, tried: [...k2.tried.slice(1), { mission: 'K2', window: 18, method: 'reinhold-hekker-2020', says: 'periodogram 14.10 d, wavelet 13.90 d, autocorrelation 13.80 d; periodogram peak 0.48', analysis: { spanDays: 50.8, variabilityRange: 0.0053, peakHeight: 0.48, lombScargleDays: 14.1, waveletDays: 13.9, autocorrelationDays: 13.8 } }],
    maps: [{ ...k2.maps[0]!, periodDays: 14.2 }, { ...k2.maps[0]!, window: 18, table: 'hd-1-c18.dat', periodDays: 14.2 }] };
  const later = brightnessChoice('hd-1', 'K2', 18), both = [reducedBrightness(choice, two, TABLE, { time: [2988.5, 3068.5], flux: [1, 1] }), reducedBrightness(later, two, TABLE, { time: [3419.5, 3470.3], flux: [1, 1] })];
  assert.equal(both[1]!.method!.campaigns, 2); assert.match(BRIGHTNESS_MAPS.words(both[1]!, { star: { id: 'hd-1', name: 'HD 1' }, count: 2, epochs: '2 epochs', tilt: 60, outlined: false }).description, /This campaign's three methods give its period \(periodogram 14\.10 d, wavelet 13\.90 d, autocorrelation 13\.80 d; periodogram peak 0\.48\), accepted by the criteria of Reinhold & Hekker.*the star's period is the mean of its 2 accepted campaigns/u);
  const twice = withBrightnessReadme('# HD 1\n\n## Sources\n\nGaia.\n\n## Evidence\n\nRun.\n\n## Known problems\n\n- None.\n', both[1]!, 15, both);
  assert.match(twice, /the K2 mission's own light curves of campaigns 13 and 18 \(the newest of May to July 2018; their PDC-MAP flux.*They are the light curves \[Reinhold & Hekker.*decide whether each shows the star turning/su);
  assert.match(twice, /K2 observed the star in campaigns 13 and 18, and the light of each meets what Reinhold & Hekker \(2020, A&A 635, A43\) ask of a rotation.*: campaign 13 gives 15\.00, 14\.63 and 13\.75 d with a peak of 0\.56; campaign 18 gives 14\.10, 13\.90 and 13\.80 d with a peak of 0\.48\. The star's period is the mean of the campaigns' 14\.46 and 13\.93 d: 14\.2 d, as the paper takes it for a star observed more than once\./su);
  assert.match(String(withMeasuredRotation({ shape: 'sphere' }, both[1]!, both).rotationPeriodMeasuredSource), /light curves of campaigns 13 and 18 \(.*\), by the method and criteria of Reinhold & Hekker \(2020, A&A 635, A43\): 14\.2 d, the mean of the campaigns' 14\.46 and 13\.93 d,/u);
  // A K2 receipt that names no method is of an earlier reduction; one without Gaia's count of neighbours says nothing of them.
  assert.throws(() => reducedBrightness(choice, { ...k2, method: undefined }, TABLE, { time: [2988.5, 3068.5], flux: [1, 1] }), /names no published method/u);
  assert.equal(reducedBrightness(choice, { ...k2, light: undefined }, TABLE, { time: [2988.5, 3068.5], flux: [1, 1] }).neighbours, undefined);
});

test('the period measured on the way goes into the star\'s record, and counts among its catalogued periods', () => {
  const seen = reducedBrightness(brightnessChoice('hd-1', 'TESS', 95), receipt('assumed', 'assumed'), TABLE, LIGHT), record = withMeasuredRotation({ schema: 'cssearth-uniform-disc-star@1', radiusKm: 600000, shape: 'sphere' }, seen);
  assert.deepEqual(Object.keys(record), ['schema', 'radiusKm', 'rotationPeriodMeasuredDays', 'rotationPeriodMeasuredSource', 'rotationLightSwingPercent', 'shape']);
  assert.deepEqual([record.rotationPeriodMeasuredDays, record.rotationLightSwingPercent], [4.85, 8.5]); assert.match(String(record.rotationPeriodMeasuredSource), /from the TESS mission's own 2-minute light curve of sector 95 \(.*\), by the method and criteria of Holcomb et al\. \(2022, ApJ 936, 138\): 4\.85 d, the light swinging by 8\.5%/u);
  // Written again, the record does not grow.
  assert.deepEqual(withMeasuredRotation(record, seen), record);
  const measured = measuredPeriod(record)!; assert.equal(measured.days, 4.85);
  // Alone it is adopted; between two catalogued periods that disagree it sides with the one it matches.
  assert.equal(starMetadata({ measuredAxis: false }, undefined, undefined, undefined, [], measured).rotationPeriodDays, 4.85);
  const disputed = [{ days: 4.9, source: 'Table A' }, { days: 2.4, source: 'Table B' }]; assert.equal(adoptPeriod(disputed), undefined);
  const settled = starMetadata({ measuredAxis: false }, undefined, undefined, undefined, disputed, measured);
  assert.equal(settled.rotationPeriodDays, 4.85); assert.match(String(settled.rotationPeriodSource), /The middle of 3 periods, catalogued and measured here, 2 of them within 20% of it/u);
});

test('the star\'s README says what its brightness datasets are made from, once', () => {
  const map = reducedBrightness(brightnessChoice('hd-1', 'TESS', 95), receipt('assumed', 'assumed'), TABLE, LIGHT);
  const readme = '# HD 1\n\n## Sources\n\n**Placement.** Gaia.\n\n## Evidence\n\nRun of today.\n\n## Known problems\n\n- The radius is a model value.\n\n[Investigation ledger](investigations.json) · [Inputs](source/manifest.json)\n';
  const written = withBrightnessReadme(readme, map, 4.9), sections = written.split(/^## /mu);
  assert.match(sections[1]!, /^Sources\n\n\*\*Placement\.\*\* Gaia\.\n\n\*\*Brightness from TESS\.\*\* The Color \+ brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 95 \(August 2025; its PDC-MAP flux.*It is the light curve \[Holcomb et al\. \(2022, ApJ 936, 138\)\]\(https:\/\/arxiv\.org\/abs\/2206\.10629\) use, and their criteria decide whether it shows the star turning: SpinSpotter, their code, measures it, and starry.*restored from the source cache\.\n\n$/su);
  assert.match(sections[2]!, /Holcomb et al\. \(2022, ApJ 936, 138\) ask the peaks of the light's autocorrelation to have a height over a quarter of their width.*together\. Sector 95 gives a period of 4\.85 d from the autocorrelation, whose peaks have a height of 0\.33, a width of 0\.43 and a fit of 0\.95\. The star's period is 4\.85 d\. The light varies by 8\.5% \(the range between its 5th and 95th percentiles\)\. On the stars its authors inspected by eye, 4\.9%.*The star's record holds 4\.9 d from the catalogues\. The map's light curve leaves a scatter of 0\.51%.*16 other stars/su);
  assert.match(sections[3]!, /- The radius is a model value\.\n\n- \*\*Brightness from TESS\.\*\*.*made at 60°, the middle tilt.*\n\n\[Investigation ledger\]/su);
  assert.equal(withBrightnessReadme(written, map, 4.9), written); assert.equal(withBrightnessReadme('# HD 1\n\nNo sections.\n', map), '# HD 1\n\nNo sections.\n');
});

test('every star the reduction looked at carries what its light showed, or why it was not read', () => {
  const record = { schema: 'cssearth-uniform-disc-star@1', radiusKm: 600000, shape: 'sphere' };
  // A star read and quiet: the reduction's own sentence, the sector and the scatter of the kept light curve.
  const quiet = withPixelLight(record, { rotation: { detected: false, reason: 'No period stands out: the strongest, 4.13 d, has a periodogram power of 0.03, under the 0.3 a rotation asks for.' }, tried: [{ sector: 42, lightCurve: 'x.curve.json' }] }, { flux: [1.002, 0.998, 1.002, 0.998] });
  assert.deepEqual(Object.keys(quiet), ['schema', 'radiusKm', 'pixelLight', 'pixelLightMission', 'pixelLightWindow', 'pixelLightScatterPercent', 'pixelLightSource', 'shape']);
  assert.deepEqual([quiet.pixelLightMission, quiet.pixelLightWindow, quiet.pixelLightScatterPercent], ['TESS', 42, 0.2]); assert.match(String(quiet.pixelLight), /^No period stands out/u); assert.match(String(quiet.pixelLightSource), /TESS light curves of sector 42.*standard deviation of the light in 30-minute bins/u);
  // A K2 star names its campaign.
  const campaign = withPixelLight(record, { rotation: { detected: false, reason: 'No period stands out.' }, tried: [{ mission: 'K2', window: 13 }] }); assert.deepEqual([campaign.pixelLightMission, campaign.pixelLightWindow], ['K2', 13]); assert.match(String(campaign.pixelLightSource), /K2 light curves of campaign 13/u);
  // A star with a rotation says so; one refused before any pixel was fetched keeps the reason and names no sector.
  assert.match(String(withPixelLight(record, receipt('assumed', 'assumed')).pixelLight), /rotation is seen: 4\.85 d, the light swinging by 8\.5%/u);
  const shared = withPixelLight(quiet, { rotation: { detected: false, reason: 'Other stars give 50% of the light within 63 arcseconds of the star.' }, tried: [] });
  assert.deepEqual([shared.pixelLightWindow, shared.pixelLightScatterPercent], [undefined, undefined]); assert.match(String(shared.pixelLightSource), /the star's pixels were not read/u);
  assert.deepEqual(withPixelLight(quiet, { rotation: { detected: false, reason: 'No period stands out: the strongest, 4.13 d, has a periodogram power of 0.03, under the 0.3 a rotation asks for.' }, tried: [{ sector: 42 }] }, { flux: [1.002, 0.998, 1.002, 0.998] }), quiet);
});
