import assert from 'node:assert/strict';
import test from 'node:test';
import { CORONA_GRID, coronaFiles, coronaPhysics, parseCoronae, type CoronaInputs, type CoronaMapInput, type CoronaStar } from './corona-bank.mts';

const PARSEC_M = 3.085677581491367e16, TILT = 30 * Math.PI / 180;
const source = (catalogueId: string) => ({ catalogueId, url: `https://example.org/${catalogueId}`, label: `Paper ${catalogueId}`, locator: 'Table 1' });
const spec = (over: Record<string, unknown> = {}) => ({ coronae: [{ host: 'test-star', bank: 'test-star-corona', maps: [{ surface: 'radial-field-a', id: 'jan-2020', label: 'Jan 2020' }, { surface: 'radial-field-b', id: 'jun-2020', label: 'Jun 2020' }],
  xray: { ...source('xray-catalogue'), fluxErgCm2S: 3.4e-12, band: '0.1 to 2.4 keV' }, temperature: { relation: 'johnstone-guedel-2015' }, massLoss: { relation: 'wood-2021' }, ...over }] });
/** A star of the Sun's size 17 pc away on the x axis, seen with its rotation axis toward north: the grid's axes are its own. */
const STAR: CoronaStar = { id: 'test-star', name: 'Test Star', colorHex: '#ffe6d0', massSolar: 1.2, radiusSolar: 1.1, radiusM: 1.1 * 6.957e8, originM: [17 * PARSEC_M, 0, 0], inclinationDegrees: 90, rotationRecord: 'src/objects/test-star/source/preparation/rotation.json',
  bodyFromGrid: (x, y, z) => [Math.acos(y / Math.hypot(x, y, z)), (Math.atan2(-x, -z) + 2 * Math.PI) % (2 * Math.PI)] };
/** A dipole tilted 30° toward longitude `toward`, 10 gauss at its pole. */
const map = (surface: string, id: string, label: string, toward: number): CoronaMapInput => ({ entry: { surface, id, label },
  sample: (longitude, latitude) => { const theta = (90 - latitude) * Math.PI / 180, phi = (longitude - toward) * Math.PI / 180; return 10 * (Math.cos(TILT) * Math.cos(theta) + Math.sin(TILT) * Math.sin(theta) * Math.cos(phi)); },
  science: { units: 'G', variable: 'B radial' }, manifestInput: { id: `test-star-${surface}`, path: `science/paper/${surface}.dat`, origin: 'https://example.org/maps.zip', sourceUrl: 'https://example.org/maps', title: `Map ${label}`, credit: 'Mapper et al. (2021)', displayCredit: 'Mapper et al.',
    license: 'CC BY 4.0', acquisition: 'Member of maps.zip, extracted unchanged.', sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'zenodo-1', role: 'material', evidence: 'https://example.org/maps' }] } } });
const inputs = (): CoronaInputs => ({ star: STAR, maps: [map('radial-field-a', 'jan-2020', 'Jan 2020', 0), map('radial-field-b', 'jun-2020', 'Jun 2020', 90)], checked: '2026-10-05',
  host: { content: { datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color', thumbnail: 'test-star-dataset-color.webp' }, { id: 'corona-old', label: 'Derived corona', volume: { objectId: 'test-star-corona', datasetId: 'old' } }] } },
    text: { datasets: { color: { title: 'Photosphere color' }, 'corona-old': { title: 'Derived corona, old' }, 'corona-jan-2020': { title: 'x', sources: [{ catalogueId: 'zenodo-1', url: 'https://example.org/maps', label: 'Mapper et al.: the magnetic map', checked: '2026-01-02' }] } } } } });

test('a corona entry is refused by the field it lacks', () => {
  assert.equal(parseCoronae(spec())[0]!.maps.length, 2);
  assert.throws(() => parseCoronae(spec({ maps: [] })), /names no map/u);
  assert.throws(() => parseCoronae(spec({ maps: [{ surface: 'a', id: 'x', label: 'A' }, { surface: 'b', id: 'x', label: 'B' }] })), /share an id/u);
  assert.throws(() => parseCoronae(spec({ temperature: { relation: 'guess' } })), /johnstone-guedel-2015/u);
  assert.throws(() => parseCoronae(spec({ massLoss: { solar: -1, ...source('wind') } })), /must be positive/u);
  assert.throws(() => parseCoronae(spec({ tint: 'red' })), /unknown fields tint/u);
  assert.deepEqual(parseCoronae(spec({ massLoss: { solar: 30, ...source('wind') } }))[0]!.massLoss, { ...source('wind'), solar: 30 });
});

test('the amount of gas follows the cited numbers, and a star that cannot hold its corona is refused', () => {
  const [entry] = parseCoronae(spec()), physics = coronaPhysics(entry!, STAR);
  assert.equal(physics.xrayLuminosityErgS.toExponential(2), '1.18e+29');
  assert.equal(physics.measuredTemperature, false); assert.equal(physics.measuredMassLoss, false); assert.equal(physics.refused, undefined);
  assert.ok(physics.wind.criticalRadii > 1);
  const measured = coronaPhysics(parseCoronae(spec({ temperature: { kelvin: 3e6, ...source('temperature') }, massLoss: { solar: 2, ...source('wind') } }))[0]!, STAR);
  assert.equal(measured.kelvin, 3e6); assert.equal(measured.massLossSolar, 2); assert.equal(measured.measuredMassLoss, true);
  assert.match(coronaPhysics(parseCoronae(spec({ xray: { ...source('xray-catalogue'), fluxErgCm2S: 5e-11, band: 'x' } }))[0]!, STAR).refused ?? '', /not held by this star/u);
  assert.throws(() => coronaFiles(parseCoronae(spec({ xray: { ...source('xray-catalogue'), fluxErgCm2S: 5e-11, band: 'x' } }))[0]!, inputs()), /Test Star: gas at/u);
});

test('an entry writes its bank and the star\'s dataset steps, and says what is derived', () => {
  const [entry] = parseCoronae(spec()), { files, readme, previews, report } = coronaFiles(entry!, inputs()), read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>, s = 'src/objects/test-star-corona/source';
  assert.deepEqual([...files.keys()].filter(path => path.startsWith(s)).map(path => path.slice(s.length + 1)).sort(), ['corona-parameters.json', 'delivery.json', 'density-jan-2020.ktx2', 'density-jun-2020.ktx2', 'manifest.json', 'presentation.json', 'provenance.json', 'volume-jan-2020.json', 'volume-jun-2020.json']);
  assert.deepEqual(previews.map(preview => preview.path), [`${s}/previews/jan-2020.png`, `${s}/previews/jun-2020.png`]);
  const delivery = read(`${s}/delivery.json`), manifest = read(`${s}/manifest.json`), presentation = read(`${s}/presentation.json`);
  assert.equal(delivery.attachedTo, 'test-star'); assert.equal(delivery.defaultDataset, 'jun-2020'); assert.equal(delivery.framingRadiusUnits, CORONA_GRID.halfUnits);
  assert.ok(Math.abs(delivery.sky.distancePc - 17) < 1e-9 && Math.abs(delivery.sky.centerIcrsDegrees[0]) < 1e-9);
  // Every dataset is bound to its own map, at the path the star's package holds it.
  assert.deepEqual(manifest.inputs.map((input: any) => [input.id, input.datasetId, input.path]), [['map-jan-2020', 'jan-2020', 'src/objects/test-star/source/science/paper/radial-field-a.dat'], ['map-jun-2020', 'jun-2020', 'src/objects/test-star/source/science/paper/radial-field-b.dat'], ['corona-parameters', undefined, `${s}/corona-parameters.json`]]);
  for (const dataset of presentation.datasets) { assert.ok(dataset.summary.length <= 125, dataset.summary); assert.match(dataset.description, /No telescope has imaged this corona, and this is not a published result/u); assert.match(dataset.facts[0].value, /^Derived here/u); assert.match(dataset.description, /not measured/u); }
  assert.equal(read('src/objects/test-star-corona/object.json').properties.host, 'test-star');
  // The star: the bank's old control is replaced by one step for each map, opening on the last.
  const controls = read('src/objects/test-star/source/content/object.json').datasets.controls, text = read('src/objects/test-star/text.json').datasets;
  assert.deepEqual(controls.map((control: any) => control.id), ['color', 'corona-jan-2020', 'corona-jun-2020']);
  assert.deepEqual(controls[2].step, { group: 'derived-corona', label: 'Jun 2020', autoplay: false, opens: 'last' });
  assert.deepEqual(controls[2].volume, { objectId: 'test-star-corona', datasetId: 'jun-2020', surface: 'color' });
  assert.deepEqual(Object.keys(text), ['color', 'corona-jan-2020', 'corona-jun-2020']);
  // A source already cited in the same words keeps the day it was read.
  assert.equal(text['corona-jan-2020'].sources[0].checked, '2026-01-02'); assert.equal(text['corona-jun-2020'].sources[0].checked, '2026-10-05');
  assert.deepEqual(text['corona-jun-2020'].sources.map((one: any) => one.catalogueId), ['zenodo-1', 'xray-catalogue', 'arxiv-1505-00643', 'arxiv-2105-00019']);
  assert.match(readme, /derived here from one of the star's observed magnetic maps/u); assert.match(readme, /The mass loss is not measured/u); assert.match(report, /2 map\(s\)/u);
  // The two maps differ only by where the dipole leans, so their grids differ and hold as much.
  assert.notDeepEqual(files.get(`${s}/density-jan-2020.ktx2`), files.get(`${s}/density-jun-2020.ktx2`));
  assert.deepEqual(coronaFiles(entry!, inputs()).files.get(`${s}/density-jan-2020.ktx2`), files.get(`${s}/density-jan-2020.ktx2`));
});
