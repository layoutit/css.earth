import assert from 'node:assert/strict';
import test from 'node:test';
import { surfaceMapFiles } from '../maps/surface-maps.mts';
import { adoptPeriod, measuredPeriod, starMetadata } from '../metadata/star-metadata.mts';
import { BRIGHTNESS_CONSUMER, BRIGHTNESS_MAPS, brightnessChoice, brightnessSourceRecords, reducedBrightness } from './brightness-maps.mts';
import { withMeasuredRotation } from './brightness.mts';

const TABLE = 'TITLE     = "test"\nVARIABLES = "Longitude [Deg]" "Latitude [Deg]" "Brightness [%]"\nZONE I=2, J=2, K=1, ZONETYPE=Ordered\n';
const receipt = (from: string, source: string) => ({ schema: 'cssearth-tess-rotation@1', star: { id: 'hd-1', name: 'HD 1' }, light: { gaiaDr3: '1', magnitude: 6.8, neighbours: 16, neighbourShare: 0.0029 }, rotation: { detected: true, periodDays: 4.85, amplitude: 0.085 }, toolchain: { id: 'tess-photometry', requirements: ['numpy==2.5.3', 'lightkurve==2.6.0'] },
  map: { sector: 95, table: 'hd-1-s0095.dat', degree: 5, inclinationDegrees: 60, inclinationFrom: from, inclinationSource: source, periodDays: 4.85, residual: 0.00509, noise: 0.00173, darkestPercent: 93.4, brightestPercent: 104.2, starry: '1.2.0' } });
const HOST = () => ({ content: { datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } }, manifest: { inputs: [{ id: 'star-color', path: 'photometry/color.json', consumers: ['datasets'] }] },
  raster: { surfaces: [{ id: 'color', output: 'hd-1-surface-{id}{suffix}.webp', thumbnail: 'hd-1-dataset-{id}.webp', science: { kind: 'stellar-photometric-color' } }, { id: 'radial-field-2007-06', output: 'x', thumbnail: 'y', science: { kind: 'terrestrial-scientific', consumer: 'espadons-zdi' } }] },
  descriptor: { properties: { recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'color', source: 'content', material: 'emission' }, { id: 'radial-field-2007-06', source: 'content', material: 'emission' }] }] } } } });

test('a brightness map becomes the star page\'s records, saying it is made here and what a light curve cannot fix', () => {
  const choice = brightnessChoice('hd-1', 95); assert.deepEqual(choice, { program: 'hd-1-s0095', id: 'brightness-sector-95', label: 'Sector 95' });
  const map = reducedBrightness(choice, receipt('assumed', 'assumed: no tilt of the star is known'), TABLE);
  assert.deepEqual([map.sector, map.periodDays, map.tiltFrom, map.codes], [95, 4.85, 'assumed', ['lightkurve 2.6.0', 'starry 1.2.0']]);
  const { files, report } = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1' }, [map], HOST()), read = (path: string) => JSON.parse(files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.equal(files.get('src/objects/hd-1/source/science/tess/hd-1-s0095.dat'), TABLE); assert.match(report, /1 brightness map on one scale of 92% to 108% \(Sector 95: turns in 4\.85 days, light swings 8\.5%\)/u);
  // A map of another kind on the page is left as it is; the scale is centred on the star's mean surface.
  const surfaces = read('source/preparation/raster.json').surfaces, science = surfaces[2].science;
  assert.deepEqual(surfaces.map((surface: { id: string }) => surface.id), ['color', 'radial-field-2007-06', 'brightness-sector-95']);
  assert.deepEqual([science.variable, science.units, science.minimum, science.maximum, science.labels, science.consumer, science.outlineLatitudes], ['Brightness [%]', '%', 92, 108, ['92%', '100%', '108%'], BRIGHTNESS_CONSUMER, undefined]);
  assert.match(science.description, /turns once in 4\.85 days.*sector 95 \(the light swings by 8\.5%; the map's curve leaves a scatter of 0\.51%, the light's own noise being 0\.17%\)\. A light curve fixes how bright each longitude is, not the latitude.*No tilt of this star's axis is known: the map is made at 60°.*Gaia DR3 lists 16 other stars within 63 arcseconds, giving 0\.29% of the light in the star's pixels\. A reduction made in this project, not a published map\./u);
  const control = read('source/content/object.json').datasets.controls[1]; assert.deepEqual([control.label, control.step, control.legend.meta, control.source.id], ['Brightness map', undefined, '%', 'hd-1-tess-map-brightness-sector-95']);
  assert.match(control.notes, /worked out in this project.*lightkurve.*starry.*their latitudes are not/u); assert.doesNotMatch(control.legendNote, /Black line/u);
  const input = read('source/manifest.json').inputs[1]; assert.equal(input.path, 'science/tess/hd-1-s0095.dat'); assert.match(input.credit, /TESS full-frame images, sector 95.*lightkurve 2\.6\.0 and starry 1\.2\.0/u);
  // The table is built here and kept out of git: its input names the command that makes it.
  assert.equal(input.generator, 'packages/telescope-cli/src/archives/tess/reduce.mts'); assert.match(input.acquisition, /Restored from the source cache; not tracked/u);
  assert.deepEqual(input.sourceBinding.references.map((reference: { catalogueId: string }) => reference.catalogueId), [...[...brightnessSourceRecords('2026-10-06').keys()].map(path => path.slice('src/sources/'.length, -'.json'.length)), 'gaia-2023-dr3']);
  assert.deepEqual(read('object.json').properties.recipe.surfaces[0].datasets.map((one: { id: string }) => one.id), ['color', 'radial-field-2007-06', 'brightness-sector-95']);
  // Only a page that measures the star's axis draws the star at the map's tilt, and outlines what it never shows.
  const drawn = reducedBrightness(choice, receipt('page', 'rotation.json: the measured axis the star\'s page draws'), TABLE), outlined = surfaceMapFiles(BRIGHTNESS_MAPS, { host: 'hd-1', maps: [choice] }, { id: 'hd-1', name: 'HD 1' }, [drawn], HOST());
  assert.deepEqual((JSON.parse(outlined.files.get('src/objects/hd-1/source/preparation/raster.json')!) as Record<string, any>).surfaces[2].science.outlineLatitudes, [-60]);
  assert.throws(() => reducedBrightness(choice, { ...receipt('page', 'x'), rotation: { detected: false, reason: 'Too faint.' } }, TABLE), /rotation is not seen \(Too faint\.\)/u);
  assert.throws(() => reducedBrightness(brightnessChoice('hd-1', 27), receipt('page', 'x'), TABLE), /do not describe one map/u);
});

test('the period measured on the way goes into the star\'s record, and counts among its catalogued periods', () => {
  const record = withMeasuredRotation({ schema: 'cssearth-uniform-disc-star@1', radiusKm: 600000, shape: 'sphere' }, { periodDays: 4.85, sector: 95, amplitude: 0.085 });
  assert.deepEqual(Object.keys(record), ['schema', 'radiusKm', 'rotationPeriodMeasuredDays', 'rotationPeriodMeasuredSource', 'rotationLightSwingPercent', 'shape']);
  assert.deepEqual([record.rotationPeriodMeasuredDays, record.rotationLightSwingPercent], [4.85, 8.5]); assert.match(String(record.rotationPeriodMeasuredSource), /TESS full-frame images of sector 95.*4\.85 d, the light swinging by 8\.5%/u);
  // Written again, the record does not grow.
  assert.deepEqual(withMeasuredRotation(record, { periodDays: 4.85, sector: 95, amplitude: 0.085 }), record);
  const measured = measuredPeriod(record)!; assert.equal(measured.days, 4.85);
  // Alone it is adopted; between two catalogued periods that disagree it sides with the one it matches.
  assert.equal(starMetadata({ measuredAxis: false }, undefined, undefined, undefined, [], measured).rotationPeriodDays, 4.85);
  const disputed = [{ days: 4.9, source: 'Table A' }, { days: 2.4, source: 'Table B' }]; assert.equal(adoptPeriod(disputed), undefined);
  const settled = starMetadata({ measuredAxis: false }, undefined, undefined, undefined, disputed, measured);
  assert.equal(settled.rotationPeriodDays, 4.85); assert.match(String(settled.rotationPeriodSource), /The middle of 3 periods, catalogued and measured here, 2 of them within 20% of it/u);
});
