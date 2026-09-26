import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// "planet" names a planet. The shell, the runtime and the tools that serve every object say object, as OBJECTS and
// the object adapter do; the eight planet ids are only a reporting filter. Science code about planets lies outside.
const root = resolve(import.meta.dirname, '../..');
const SERVES_EVERY_OBJECT = ['site', 'src/platform', 'src/navigation', 'src/renderers', 'packages/renderer', 'src/preparation', 'packages/bake/src/raster', 'src/styles',
  'tools/cli', 'tools/prepare', 'tools/assets', 'tools/contract', 'tools/sources', 'tools/ci', 'atlas'];
const SCIENCE_TERM = /exoplanet|planetar|dwarf.?planet|hosted.?planet|minor.?planet/iu;
/** Names in those directories that do mean planets, and why. */
const PLANET_NAMES = new Map([
  ['PLANET_IDS', 'the eight planets, from @cssearth/astronomy'],
  ['PLANET_NAVIGATION_OBJECTS', 'search objects classified as planets'],
  ['PLANET_MARKER_PLANETS', 'the Sun and the eight planets keep shared marker sources'],
  ['MarkerPlanet', 'one of those markers'],
  ['markerPlanets', 'those markers'],
  ['planetIds', 'the planetary-context chart covers the eight planets'],
  ['selectedPlanetIds', 'the planetary-context chart covers the eight planets'],
  ['availablePlanetIds', 'the planetary-context chart covers the eight planets'],
  ['requiredPlanets', 'the planetary-context chart covers the eight planets'],
  ['planetArgument', 'the planetary-context chart covers the eight planets'],
  ['planetCount', 'counts the planet markers'],
  ['planetRadiusKm', "a planet's structure or atmosphere model (Mercury, Earth, Mars, Venus)"],
  ['planetRasterCellSize', "Saturn's layered-oblate lane serves one planet"],
]);
/** Hyphenated names there that are not classes: a removed file, prose and a planet fixture. */
const PLANET_HYPHENATED = new Set(['planet-markers', 'planet-radius', 'planet-specific', 'planet-specific-filter', 'future-planet']);

const tracked = (...paths: string[]) => execFileSync('git', ['ls-files', '-z', '--', ...paths], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(path => path && !path.includes('/evidence/'));
const code = tracked(...SERVES_EVERY_OBJECT).filter(path => /\.(?:ts|mts|mjs|js|astro|css)$/u.test(path) && path !== 'site/test/object-vocabulary.test.mts');
const occurrences = (pattern: RegExp, keep: (name: string) => boolean) => code.flatMap(path =>
  [...readFileSync(resolve(root, path), 'utf8').matchAll(pattern)].map(match => match[0]).filter(name => !keep(name))
    .map(name => `${path}: ${name}`));

test('code that serves every object names no planet it does not mean', () => {
  const names = occurrences(/(?<![\w$])[A-Za-z_$][\w$]*(?:planet|Planet|PLANET)[\w$]*|(?<![\w$])(?:planet|Planet|PLANET)[\w$]+/gu,
    name => /^(?:planets?|Planets?|PLANETS?)$/u.test(name) || SCIENCE_TERM.test(name) || PLANET_NAMES.has(name));
  assert.deepEqual(names, [], 'Say object, or add the name to PLANET_NAMES with the reason it is a planet.');
});

test('classes and custom properties of the shared shell say object', () => {
  const classes = occurrences(/(?<![\w-])(?:--)?[a-z0-9-]*planet-[a-z0-9-]+/gu,
    name => SCIENCE_TERM.test(name) || PLANET_HYPHENATED.has(name));
  assert.deepEqual(classes, []);
});

test('no path that serves every object names a planet', () => {
  const paths = tracked(...SERVES_EVERY_OBJECT, 'data', 'packages/engine').filter(path => /planet/iu.test(path) && !SCIENCE_TERM.test(path));
  assert.deepEqual(paths, []);
});

test('authored object records key their identity as objectId', () => {
  const records = tracked('src/objects').filter(path => path.endsWith('.json') && readFileSync(resolve(root, path), 'utf8').includes('"planetId"'));
  assert.deepEqual(records, []);
});
