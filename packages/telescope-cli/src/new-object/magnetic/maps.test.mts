import assert from 'node:assert/strict';
import test from 'node:test';
import { isConventionOnly, magneticMapFiles, MAP_CONSUMER, parseMagneticMaps, reducedMap, scaleEnd, tiltedRotation } from './map-datasets.mts';

const TABLE = 'TITLE     = "test"\nVARIABLES = "Longitude [Deg]" "Latitude [Deg]" "B<sub>R</sub> [G]" "B<sub>A</sub> [G]" "B<sub>M</sub> [G]"\nZONE I=2, J=2, K=1, ZONETYPE=Ordered\n';
const receipt = (program: string, mean: number, radial: [number, number]) => ({ schema: 'cssearth-espadons-map@2', program, target: { name: 'HD 1' }, inputs: { toolchain: { requirements: ['numpy==2.5.3', 'LSDpy==1.0.0', 'specpolFlow==1.1.0'] } }, mask: { korg: '1.3.1' },
  profiles: { spectra: [{ product: '1p', utc: '2007-06-23T12:00:38', used: true }, { product: '2p', utc: '2007-06-30T08:00:00', used: false }, { product: '3p', utc: '2007-07-04T13:58:12', used: true }] },
  map: { spectraUsed: 2, star: { inclinationDegrees: { value: 72, source: 'Paper A, Table 4' }, periodDays: { value: 11.454, source: 'Paper A, Table 4' } }, chosen: { meanGauss: mean, radialGauss: radial, chiSquare: 1.2, chiSquareNoField: 13.06 } } });
const program = (published?: unknown) => ({ observations: [{ proposal: '07AC27' }, { proposal: '07AC27' }, { proposal: '07AF02' }], ...(published ? { published } : {}) });
const HOST = () => ({ content: { datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } }, manifest: { inputs: [{ id: 'star-color', path: 'photometry/color.json', consumers: ['datasets'] }] },
  raster: { surfaces: [{ id: 'color', output: 'hd-1-surface-{id}{suffix}.webp', thumbnail: 'hd-1-dataset-{id}.webp', science: { kind: 'stellar-photometric-color' } }] },
  descriptor: { properties: { recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'color', source: 'content', material: 'emission' }] }] } } } });

test('a spec of magnetic maps is read, and refused by what it lacks', () => {
  const spec = { magneticMaps: [{ host: 'hd-1', maps: [{ program: 'hd-1-2007-06', id: 'radial-field-2007-06', label: 'Jun 2007' }] }] };
  assert.deepEqual(parseMagneticMaps(spec), spec.magneticMaps);
  assert.throws(() => parseMagneticMaps({ magneticMaps: [{ host: 'hd-1', maps: [] }] }), /at least one map/u);
  assert.throws(() => parseMagneticMaps({ magneticMaps: [{ host: 'hd-1', maps: [{ program: 'A', id: 'x', label: 'Jun' }] }] }), /lower-case ids/u);
  assert.throws(() => parseMagneticMaps({ magneticMaps: [spec.magneticMaps[0], spec.magneticMaps[0]] }), /listed twice/u);
  assert.deepEqual([0.9, 1, 11.3, 72.9, 121, 980].map(scaleEnd), [1, 1, 12, 80, 150, 1000]);
});

test('a reduced map becomes the star page\'s records, on one scale, each sentence saying whose map it is', () => {
  const entry = parseMagneticMaps({ magneticMaps: [{ host: 'hd-1', maps: [{ program: 'hd-1-2007-06', id: 'radial-field-2007-06', label: 'Jun 2007' }, { program: 'hd-1-2013-09', id: 'radial-field-2013-09', label: 'Sep 2013' }] }] })[0]!;
  const first = reducedMap(entry.maps[0]!, receipt('hd-1-2007-06', 23.5, [-72.9, 34.5]), program({ paper: 'Fares et al. (2010)', meanGauss: { value: 22, source: 'Table 2' } }), TABLE), second = reducedMap(entry.maps[1]!, receipt('hd-1-2013-09', 41, [-121, 79.7]), program(), TABLE);
  assert.deepEqual([first.spectra, first.fromUtc, first.toUtc, first.proposals, first.codes], [2, '2007-06-23T12:00:38', '2007-07-04T13:58:12', ['07AC27', '07AF02'], ['Korg 1.3.1', 'LSDpy 1.0.0', 'specpolFlow 1.1.0', 'ZDIpy']]);
  const { files, report } = magneticMapFiles(entry, { id: 'hd-1', name: 'HD 1' }, [first, second], HOST()), read = (path: string) => JSON.parse(files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.equal(files.get('src/objects/hd-1/source/science/espadons/hd-1-2007-06.dat'), TABLE); assert.match(report, /2 radial-field maps on one scale of ±150 G/u);
  const surfaces = read('source/preparation/raster.json').surfaces, map = surfaces[1].science;
  assert.deepEqual(surfaces.map((surface: { id: string }) => surface.id), ['color', 'radial-field-2007-06', 'radial-field-2013-09']);
  // The corona route finds a radial field in gauss by these two; both maps share the scale of the stronger one.
  assert.deepEqual([map.format, map.variable, map.units, map.minimum, map.maximum, map.consumer, map.outlineLatitudes, surfaces[2].science.maximum, surfaces[1].output], ['tecplot-lonlat-map', 'B<sub>R</sub> [G]', 'G', -150, 150, MAP_CONSUMER, [-72], 150, 'hd-1-surface-{id}{suffix}.webp']);
  assert.match(map.description, /2 ESPaDOnS spectra of 23 June 2007 to 4 July 2007 \(reduced chi-square 1\.20, against 13\.1 with no field\); mean field 24 G\. A reduction made in this project, not a published map\./u);
  const controls = read('source/content/object.json').datasets.controls, control = controls[1];
  assert.deepEqual([controls.length, control.step, control.surface, control.source.id], [3, { group: 'radial', label: 'Jun 2007' }, 'hd-1-surface-radial-field-2007-06@2x.webp', 'hd-1-espadons-map-radial-field-2007-06']);
  assert.match(control.notes, /not a published map\. Fares et al\. \(2010\) map the same run with a mean field of 22 G; this map has 24 G\. Step through the 2 maps/u); assert.doesNotMatch(controls[2].notes, /same run/u);
  const input = read('source/manifest.json').inputs[1]; assert.equal(input.path, 'science/espadons/hd-1-2007-06.dat'); assert.match(input.credit, /CFHT programs 07AC27, 07AF02.*Korg 1\.3\.1, LSDpy 1\.0\.0/u); assert.match(input.acquisition, /reduce\.mts with the program hd-1-2007-06/u);
  assert.deepEqual(read('object.json').properties.recipe.surfaces[0].datasets, [{ id: 'color', source: 'content', material: 'emission' }, { id: 'radial-field-2007-06', source: 'content', material: 'emission' }, { id: 'radial-field-2013-09', source: 'content', material: 'emission' }]);
  assert.deepEqual(read('text.json').datasets['radial-field-2013-09'], { title: 'Radial field, Sep 2013', detail: '2 epochs, mapped here', summary: 'The star\'s magnetic field, mapped in this project from archived spectra by how it polarises starlight.' });
  // Run again with one map fewer: the dropped map's records go, the star's own stay.
  const again = magneticMapFiles({ host: 'hd-1', maps: [entry.maps[1]!] }, { id: 'hd-1', name: 'HD 1' }, [second], { content: read('source/content/object.json'), text: read('text.json'), manifest: read('source/manifest.json'), raster: read('source/preparation/raster.json'), descriptor: read('object.json') });
  const kept = (path: string) => JSON.parse(again.files.get(`src/objects/hd-1/${path}`)!) as Record<string, any>;
  assert.deepEqual(kept('source/preparation/raster.json').surfaces.map((surface: { id: string }) => surface.id), ['color', 'radial-field-2013-09']); assert.equal(kept('source/content/object.json').datasets.controls[1].step, undefined);   // one map: no step group assert.deepEqual(kept('source/content/object.json').datasets.controls.map((one: { id: string }) => one.id), ['color', 'radial-field-2013-09']);
  assert.deepEqual(Object.keys(kept('text.json').datasets), ['color', 'radial-field-2013-09']); assert.deepEqual(kept('object.json').properties.recipe.surfaces[0].datasets.map((one: { id: string }) => one.id), ['color', 'radial-field-2013-09']); assert.equal(kept('source/manifest.json').inputs.length, 2); assert.equal(kept('source/preparation/raster.json').surfaces[1].science.maximum, 150);
  // A page whose axis is a convention takes the maps' tilt: the pole leans toward us, and the record says where the tilt is printed.
  const convention = { schema: 'cssearth-display-orientation@1', rightAscensionDegrees: 26.8, declinationDegrees: 72.5, displayMeridianDegrees: -90, source: 'No measured rotation axis or period is used.' }, tilted = tiltedRotation(convention, { rightAscensionDegrees: 206.8134, declinationDegrees: 17.4572 }, first);
  assert.equal(isConventionOnly(convention), true); assert.equal(isConventionOnly(tilted), false); assert.match(String(tilted.source), /Spin inclination 72 degrees from the line of sight \(Paper A, Table 4\) and rotation period 11\.454 d/u);
  const rad = Math.PI / 180, toEarth = [-Math.cos(17.4572 * rad) * Math.cos(206.8134 * rad), -Math.cos(17.4572 * rad) * Math.sin(206.8134 * rad), -Math.sin(17.4572 * rad)], ra = Number(tilted.rightAscensionDegrees) * rad, dec = Number(tilted.declinationDegrees) * rad, pole = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  assert.ok(Math.abs(Math.acos(pole[0]! * toEarth[0]! + pole[1]! * toEarth[1]! + pole[2]! * toEarth[2]!) / rad - 72) < 1e-6); assert.ok([90, 270].some(value => Math.abs(Number(tilted.displayMeridianDegrees) - value) < 1e-3));
  // A dataset of that id that is not one of these maps is never overwritten.
  const taken = HOST(); taken.raster.surfaces.push({ id: 'radial-field-2013-09', output: 'x', thumbnail: 'y', science: { kind: 'other' } });
  assert.throws(() => magneticMapFiles({ host: 'hd-1', maps: [entry.maps[1]!] }, { id: 'hd-1', name: 'HD 1' }, [second], taken), /already exists and is not one of these maps/u);
  assert.throws(() => reducedMap(entry.maps[0]!, { ...receipt('x', 1, [-1, 1]), map: {} }, program(), TABLE), /no step of the ladder was chosen/u);
});

test('a run that names its star is that star\'s alone; any other is the star\'s at its place', async () => {
  const { isRunOf } = await import('./maps.mts');
  // EQ Pegasi A and B are 5.8 arcseconds apart.
  const a = { object: 'eq-pegasi-a', ra: 352.9674, dec: 19.9373 }, unnamed = { ra: 352.9674, dec: 19.9373 };
  assert.equal(isRunOf(a, 'eq-pegasi-a', 352.9691, 19.9372), true); assert.equal(isRunOf(a, 'eq-pegasi-b', 352.9691, 19.9372), false);
  assert.equal(isRunOf(unnamed, 'eq-pegasi-b', 352.9691, 19.9372), true); assert.equal(isRunOf(unnamed, 'elsewhere', 10, 19.9372), false);
});
