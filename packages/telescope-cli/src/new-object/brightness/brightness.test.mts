import assert from 'node:assert/strict';
import test from 'node:test';
import { surfaceMapFiles } from '../maps/surface-maps.mts';
import { adoptPeriod, measuredPeriod, starMetadata } from '../metadata/star-metadata.mts';
import { BRIGHTNESS_CONSUMER, BRIGHTNESS_MAPS, brightnessChoice, brightnessSourceRecords, monthsOf, reducedBrightness, missionDay, shortMonthsOf, tinted } from './brightness-maps.mts';
import { withBrightnessReadme, withMeasuredRotation, withTessLight } from './brightness.mts';

const TABLE = 'TITLE     = "test"\nVARIABLES = "Longitude [Deg]" "Latitude [Deg]" "Brightness [%]"\nZONE I=2, J=2, K=1, ZONETYPE=Ordered\n';
const receipt = (from: string, source: string) => ({ schema: 'cssearth-tess-rotation@1', star: { id: 'hd-1', name: 'HD 1' }, light: { gaiaDr3: '1', magnitude: 6.8, neighbours: 16, neighbourShare: 0.0029 }, rotation: { detected: true, periodDays: 4.85, amplitude: 0.085 }, toolchain: { id: 'tess-photometry', requirements: ['numpy==2.5.3', 'lightkurve==2.6.0'] },
  map: { sector: 95, table: 'hd-1-s0095.dat', degree: 5, inclinationDegrees: 60, inclinationFrom: from, inclinationSource: source, periodDays: 4.85, residual: 0.00509, noise: 0.00173, darkestPercent: 93.4, brightestPercent: 104.2, starry: '1.2.0' } });
/** Sector 95's light: 3 August to 29 August 2025 as TESS times. */
const LIGHT = { sector: 95, time: [3890.5, 3903.2, 3916.9], flux: [1.01, 0.99, 1] };
const HOST = () => ({ content: { datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } }, manifest: { inputs: [{ id: 'star-color', path: 'photometry/color.json', consumers: ['datasets'] }] },
  raster: { surfaces: [{ id: 'color', output: 'hd-1-surface-{id}{suffix}.webp', thumbnail: 'hd-1-dataset-{id}.webp', science: { kind: 'stellar-photometric-color' } }, { id: 'radial-field-2007-06', output: 'x', thumbnail: 'y', science: { kind: 'terrestrial-scientific', consumer: 'espadons-zdi' } }] },
  descriptor: { properties: { recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'color', source: 'content', material: 'emission' }, { id: 'radial-field-2007-06', source: 'content', material: 'emission' }] }] } } } });

test('a brightness map becomes the star page\'s records, saying it is made here and what a light curve cannot fix', () => {
  const choice = brightnessChoice('hd-1', 'TESS', 95); assert.deepEqual(choice, { program: 'hd-1-s0095', id: 'brightness-sector-95', label: 'Sector 95' });
  const map = reducedBrightness(choice, receipt('assumed', 'assumed: no tilt of the star is known'), TABLE, LIGHT);
  assert.deepEqual([map.window, map.periodDays, map.tiltFrom, map.codes], [95, 4.85, 'assumed', ['lightkurve 2.6.0', 'starry 1.2.0']]);
  const { files, report } = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1' }, [map], HOST()), read = (path: string) => JSON.parse(files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.equal(files.get('src/objects/hd-1/source/science/tess/hd-1-s0095.dat'), TABLE); assert.match(report, /1 brightness map on one scale of 92% to 108% \(Sector 95: turns in 4\.85 days, light swings 8\.5%\)/u);
  // A map of another kind on the page is left as it is; the scale is centred on the star's mean surface.
  const surfaces = read('source/preparation/raster.json').surfaces, science = surfaces[2].science;
  assert.deepEqual(surfaces.map((surface: { id: string }) => surface.id), ['color', 'radial-field-2007-06', 'brightness-sector-95']);
  assert.deepEqual([science.variable, science.units, science.minimum, science.maximum, science.labels, science.consumer, science.outlineLatitudes], ['Brightness [%]', '%', 92, 108, ['92%', '100%', '108%'], BRIGHTNESS_CONSUMER, undefined]);
  assert.match(science.description, /turns once in 4\.85 days.*sector 95 \(the light swings by 8\.5%; the map's curve leaves a scatter of 0\.51%, the light's own noise being 0\.17%\)\. A light curve fixes how bright each longitude is, not the latitude.*No tilt of this star's axis is known: the map is made at 60°.*Gaia DR3 lists 16 other stars within 63 arcseconds, giving 0\.29% of the light in the star's pixels\. A reduction made in this project, not a published map\./u);
  const control = read('source/content/object.json').datasets.controls[1]; assert.deepEqual([control.label, control.step, control.legend.meta, control.source.id], ['Brightness map', undefined, '%', 'hd-1-tess-map-brightness-sector-95']);
  assert.match(control.notes, /worked out in this project.*lightkurve.*starry.*their latitudes are not/u); assert.doesNotMatch(control.legendNote, /Black line/u);
  // The table is built here and kept out of git, so it is a generated intermediate of the manifest, not an input.
  assert.equal(read('source/manifest.json').inputs.length, 1); const input = read('source/manifest.json').generatedIntermediates[0]; assert.equal(input.path, 'science/tess/hd-1-s0095.dat'); assert.match(input.credit, /TESS full-frame images, sector 95.*lightkurve 2\.6\.0 and starry 1\.2\.0/u);
  // The table is built here and kept out of git: its input names the command that makes it.
  assert.equal(input.generator, 'packages/telescope-cli/src/archives/tess/reduce.mts'); assert.match(input.acquisition, /Restored from the source cache; not tracked/u);
  assert.deepEqual(input.sourceBinding.references.map((reference: { catalogueId: string }) => reference.catalogueId), [...[...brightnessSourceRecords('2026-10-06').keys()].map(path => path.slice('src/sources/'.length, -'.json'.length)), 'gaia-2023-dr3']);
  assert.deepEqual(read('object.json').properties.recipe.surfaces[0].datasets.map((one: { id: string }) => one.id), ['color', 'radial-field-2007-06', 'brightness-sector-95']);
  // With the star's color, the page opens on the star in that color at the map's own contrast, then its map, then what it had.
  const colored = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1', colorHex: '#ffc08b' }, [map], HOST()), shown = (path: string) => JSON.parse(colored.files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.equal(colored.opensOn, 'color-brightness'); assert.deepEqual([shown('source/content/object.json').datasets.defaultDataset, shown('source/content/object.json').datasets.controls.map((one: { id: string }) => one.id)], ['color-brightness', ['color-brightness', 'brightness-sector-95', 'color']]);
  const own = shown('source/preparation/raster.json').surfaces.at(-1).science;
  assert.deepEqual([own.id, own.limbOf, own.minimum, own.maximum, own.colors.length, own.colors.at(-1), shown('source/preparation/raster.json').surfaces.at(-1).falseColor], ['color-brightness', 'color', 92, 108, 5, '#ffc08b', false]);
  // The Brightness map's own scale and grays, tinted with the star's color: its darkest gray (26 of 255) is a tenth of the color.
  assert.deepEqual(own.colors, tinted('#ffc08b')); assert.deepEqual(tinted('#ffc08b'), ['#1a140e', '#5c4532', '#9c7555', '#d6a175', '#ffc08b']);
  assert.match(shown('source/content/object.json').datasets.controls[0].notes, /in TESS's images of August 2025.*The contrast is drawn far stronger than it is, so the eye can see it: the darkest part gives 10\.4% less light than the brightest, and is drawn as dark as on the Brightness map, whose scale has the measured values.*Their latitudes and shapes are not.*No change of color is drawn/u);
  assert.deepEqual(shown('text.json').datasets['color-brightness'], { title: 'Color + brightness, Aug 2025', detail: 'TESS sector 95', summary: 'The star in its own color, darker where its light shows it darker; the contrast is drawn stronger to be seen.' });
  assert.equal(shown('text.json').datasets['brightness-sector-95'].detail, 'Sector 95, mapped here'); assert.equal(shortMonthsOf('2025-12-20', '2026-01-15'), 'Dec 2025 to Jan 2026'); assert.equal(monthsOf('2025-08-29', '2025-09-22'), 'August and September 2025'); assert.equal(missionDay(3890.5), '2025-08-03');
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
  assert.throws(() => reducedBrightness(brightnessChoice('hd-1', 'TESS', 27), receipt('page', 'x'), TABLE, LIGHT), /do not describe one map/u);
});

test('the period measured on the way goes into the star\'s record, and counts among its catalogued periods', () => {
  const record = withMeasuredRotation({ schema: 'cssearth-uniform-disc-star@1', radiusKm: 600000, shape: 'sphere' }, { periodDays: 4.85, mission: 'TESS', window: 95, amplitude: 0.085 });
  assert.deepEqual(Object.keys(record), ['schema', 'radiusKm', 'rotationPeriodMeasuredDays', 'rotationPeriodMeasuredSource', 'rotationLightSwingPercent', 'shape']);
  assert.deepEqual([record.rotationPeriodMeasuredDays, record.rotationLightSwingPercent], [4.85, 8.5]); assert.match(String(record.rotationPeriodMeasuredSource), /TESS full-frame images of sector 95.*4\.85 d, the light swinging by 8\.5%/u);
  // Written again, the record does not grow.
  assert.deepEqual(withMeasuredRotation(record, { periodDays: 4.85, mission: 'TESS', window: 95, amplitude: 0.085 }), record);
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
  assert.match(sections[1]!, /^Sources\n\n\*\*Placement\.\*\* Gaia\.\n\n\*\*Brightness from TESS\.\*\* The Color \+ brightness and Brightness map datasets.*sector 95 \(August 2025\).*restored from the source cache\.\n\n$/su);
  assert.match(sections[2]!, /swings by 8\.5% with a period of 4\.85 d.*The star's record holds 4\.9 d from the catalogues\. The map's light curve leaves a scatter of 0\.51%.*16 other stars/su);
  assert.match(sections[3]!, /- The radius is a model value\.\n\n- \*\*Brightness from TESS\.\*\*.*made at 60°, the middle tilt.*\n\n\[Investigation ledger\]/su);
  assert.equal(withBrightnessReadme(written, map, 4.9), written); assert.equal(withBrightnessReadme('# HD 1\n\nNo sections.\n', map), '# HD 1\n\nNo sections.\n');
});

test('every star the reduction looked at carries what its light showed, or why it was not read', () => {
  const record = { schema: 'cssearth-uniform-disc-star@1', radiusKm: 600000, shape: 'sphere' };
  // A star read and quiet: the reduction's own sentence, the sector and the scatter of the kept light curve.
  const quiet = withTessLight(record, { rotation: { detected: false, reason: 'No period stands out: the strongest, 4.13 d, has a periodogram power of 0.03, under the 0.3 a rotation asks for.' }, tried: [{ sector: 42, lightCurve: 'x.curve.json' }] }, { flux: [1.002, 0.998, 1.002, 0.998] });
  assert.deepEqual(Object.keys(quiet), ['schema', 'radiusKm', 'tessLight', 'tessLightSector', 'tessLightScatterPercent', 'tessLightSource', 'shape']);
  assert.deepEqual([quiet.tessLightSector, quiet.tessLightScatterPercent], [42, 0.2]); assert.match(String(quiet.tessLight), /^No period stands out/u); assert.match(String(quiet.tessLightSource), /sector 42.*standard deviation of the light in 30-minute bins/u);
  // A star with a rotation says so; one refused before any pixel was fetched keeps the reason and names no sector.
  assert.match(String(withTessLight(record, receipt('assumed', 'assumed')).tessLight), /rotation is seen: 4\.85 d, the light swinging by 8\.5%/u);
  const shared = withTessLight(quiet, { rotation: { detected: false, reason: 'Other stars give 50% of the light within 63 arcseconds of the star.' }, tried: [] });
  assert.deepEqual([shared.tessLightSector, shared.tessLightScatterPercent], [undefined, undefined]); assert.match(String(shared.tessLightSource), /the star's TESS pixels were not read/u);
  assert.deepEqual(withTessLight(quiet, { rotation: { detected: false, reason: 'No period stands out: the strongest, 4.13 d, has a periodogram power of 0.03, under the 0.3 a rotation asks for.' }, tried: [{ sector: 42 }] }, { flux: [1.002, 0.998, 1.002, 0.998] }), quiet);
});
