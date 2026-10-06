/** A planet with a map moves from the emissive lane to the lit one (star-lit.mts): a small package in memory, built the way the
 * nine hand-made heat-map planets were. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PackageFiles } from '../dataset.mts';
import { HOSTED_PLANET_STYLESHEET } from '../new-hosted-planet.mts';
import { LIT_NOTE, LIT_README, starLight } from './star-lit.mts';

const o = 'src/objects/x-b', json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const emissive = (kind = 'terrestrial-scientific'): PackageFiles => new Map([
  [`${o}/README.md`, '# X b\n\n## Sources\n\n**Map.** A heat map.\n\n## Evidence\n\nNone.\n'],
  [`${o}/object.json`, json({ properties: { preparation: { steps: ['verify-sources', 'assets', 'datasets', 'starfield', 'scene'] },
    recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'temperature', source: 'content', material: 'emission' }, { id: 'illustration', source: 'content', material: 'emission' }] }],
      materials: [{ id: 'emission', source: 'raster', model: 'emissive' }], emission: { source: 'raster', material: 'emission' } },
    page: { stylesheets: ['src/renderers/css/styles/body-surfaces.css', 'src/renderers/css/styles/x-b-surfaces.css'] } } })],
  [`${o}/source/preparation/raster.json`, json({ surfaces: [{ id: 'temperature', science: { kind } }, { id: 'illustration', science: { kind: 'equirectangular-illustration' } }], emission: { limbSize: 512 } })],
  [`${o}/source/preparation/geometry.json`, json({ output: { materialSchema: 'cssx-b-prepared-emission@1' } })],
  [`${o}/source/preparation/presentation.json`, json({ namespace: 'x-b', mode: 'emissive' })],
  [`${o}/source/content/object.json`, json({ datasets: { controls: [{ id: 'temperature', notes: 'A heat map.' }, { id: 'illustration' }] }, settings: { titleKey: 'settings', controls: [] } })],
  [`${o}/source/manifest.json`, json({ inputs: [{ id: 'x-b-preparation-geometry', origin: 'Repository-authored CSS geometry profile: 248-unit sphere, 16 x 32 leaves, emissive material' }, { id: 'x-b-preparation-presentation', origin: 'Repository-authored presentation profile: emissive mode' }] })]]);
const read = (files: PackageFiles, path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;

test('a hosted planet whose datasets are maps moves to the lit lane, once', () => {
  const files = emissive();
  assert.deepEqual(starLight(files, 'x-b', true), { retired: 'src/renderers/css/styles/x-b-surfaces.css' });
  const raster = read(files, 'source/preparation/raster.json'), descriptor = read(files, 'object.json').properties;
  assert.equal(raster.emission, undefined);
  assert.deepEqual(Object.keys(raster.lighting), ['bank', 'presentationSize', 'metadata']);
  assert.deepEqual([raster.lighting.bank, raster.lighting.presentationSize, Object.keys(raster.lighting.metadata)], ['sphere', 460, ['sourceRadius', 'limbMeaning']]);
  assert.deepEqual(descriptor.recipe.materials, [{ id: 'lighting', source: 'raster', model: 'lit' }]);
  assert.equal(descriptor.recipe.emission, undefined);
  assert.deepEqual(descriptor.recipe.surfaces[0].datasets.map((dataset: { material: string }) => dataset.material), ['lighting', 'lighting']);
  assert.deepEqual(descriptor.preparation.steps, ['verify-sources', 'assets', 'datasets', 'starfield', 'sky-sun', 'scene']);
  assert.deepEqual(descriptor.page.stylesheets, ['src/renderers/css/styles/body-surfaces.css', HOSTED_PLANET_STYLESHEET]);
  assert.equal(read(files, 'source/preparation/geometry.json').output.materialSchema, 'cssx-b-prepared-lighting@1');
  assert.equal(read(files, 'source/preparation/presentation.json').mode, 'composite');
  assert.deepEqual(read(files, 'source/content/object.json').datasets.controls.map((control: { notes?: string }) => control.notes), [`A heat map.${LIT_NOTE}`, undefined]);
  assert.deepEqual(read(files, 'source/content/object.json').settings.controls, [{ kind: 'toggle', name: 'shadows', label: 'Shadows', checked: false }]);
  assert.deepEqual(read(files, 'source/manifest.json').inputs.map((input: { origin: string }) => input.origin), ['Repository-authored CSS geometry profile: 248-unit sphere, 16 x 32 leaves, lit material', 'Repository-authored presentation profile: composite mode']);
  assert.equal(String(files.get(`${o}/README.md`)), `# X b\n\n## Sources\n\n**Map.** A heat map.\n\n${LIT_README}\n\n## Evidence\n\nNone.\n`);
  // It is lit now: a second run changes nothing.
  assert.deepEqual(starLight(files, 'x-b', true), { why: 'it is lit by its star already' });
});

test('a body seen by its own light stays self-luminous', () => {
  assert.deepEqual(starLight(emissive('disc-integrated-band-color'), 'x-b', true), { why: 'its temperature dataset is its own light (disc-integrated-band-color), so it stays self-luminous' });
  assert.deepEqual(starLight(emissive(), 'x-b', false), { why: 'it is not on an orbit around a star that could light it' });
});
