import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyAffectedChanges, classifyAffectedPaths, loadCiAreasConfig, parseCiAreasConfig, patternToRegExp,
} from './ci-affected.mts';
import type { CiAreasConfig } from './ci-affected.mts';

const CONFIG: CiAreasConfig = {
  shared: ['package.json', 'tools/prepare-catalog.mts', 'tools/objects/**'],
  areas: [
    { id: 'object', patterns: ['src/objects/*/**'], jobs: [] },
    { id: 'renderer', patterns: ['src/renderers/**'], jobs: ['typecheck', 'universe'] },
    { id: 'site', patterns: ['site/**'], jobs: ['typecheck', 'universe'] },
    { id: 'tooling', patterns: ['tools/**', 'packages/**', 'labs/nebula/**'], jobs: ['typecheck', 'nebula'] },
    { id: 'docs', patterns: ['**/*.md', 'docs/**', 'LICENSE*'], jobs: [] },
  ],
};

test('patternToRegExp: ** matches any depth, * matches within one segment', () => {
  assert.equal(patternToRegExp('tools/**').test('tools/a.mts'), true);
  assert.equal(patternToRegExp('tools/**').test('tools/nested/deep/a.mts'), true);
  assert.equal(patternToRegExp('tools/**').test('other/a.mts'), false);
  assert.equal(patternToRegExp('src/objects/*/**').test('src/objects/earth/README.md'), true);
  assert.equal(patternToRegExp('src/objects/*/**').test('src/objects/earth/source/x.png'), true);
  assert.equal(patternToRegExp('src/objects/*/**').test('src/objects/earth'), false);
  assert.equal(patternToRegExp('**/*.md').test('README.md'), true);
  assert.equal(patternToRegExp('**/*.md').test('docs/deep/guide.md'), true);
  assert.equal(patternToRegExp('**/*.md').test('README.mdx'), false);
  assert.equal(patternToRegExp('LICENSE*').test('LICENSE'), true);
  assert.equal(patternToRegExp('LICENSE*').test('LICENSE.md'), true);
  assert.equal(patternToRegExp('LICENSE*').test('docs/LICENSE.md'), false);
  assert.equal(patternToRegExp('tsconfig*.json').test('tsconfig.tests.json'), true);
});

test('classifyAffectedPaths: an object-only change needs no heavy job', () => {
  const result = classifyAffectedPaths(['src/objects/earth/README.md', 'src/objects/earth/source/a.png'], CONFIG);
  assert.equal(result.shared, false);
  assert.deepEqual(result.areaIds, ['object']);
  assert.deepEqual([...result.jobs], []);
});

test('classifyAffectedPaths: a renderer-only change needs typecheck and universe, not nebula or preparation', () => {
  const result = classifyAffectedPaths(['src/renderers/css/dist-src/thing.ts'], CONFIG);
  assert.equal(result.shared, false);
  assert.deepEqual(result.areaIds, ['renderer']);
  assert.deepEqual([...result.jobs].sort(), ['typecheck', 'universe']);
});

test('classifyAffectedPaths: mixing object and renderer paths unions their jobs', () => {
  const result = classifyAffectedPaths(['src/objects/mars/README.md', 'src/renderers/css/camera.ts'], CONFIG);
  assert.deepEqual(result.areaIds, ['object', 'renderer']);
  assert.deepEqual([...result.jobs].sort(), ['typecheck', 'universe']);
});

test('classifyAffectedPaths: a tooling-only change needs typecheck and nebula, not universe or preparation', () => {
  const result = classifyAffectedPaths(['tools/fits.mts', 'packages/astronomy/src/a.ts'], CONFIG);
  assert.deepEqual([...result.areaIds].sort(), ['tooling']);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck']);
});

test('classifyAffectedPaths: a docs-only change needs no heavy job', () => {
  const result = classifyAffectedPaths(['README.md', 'docs/guide.md'], CONFIG);
  assert.deepEqual(result.areaIds, ['docs']);
  assert.deepEqual([...result.jobs], []);
});

test('classifyAffectedPaths: a shared path forces every heavy job even alongside an object path', () => {
  // Mutation check: one shared file among many otherwise-narrow paths must flip the whole verdict, not just be
  // counted alongside it — the same shape as classify-changes.mts's docs-only mutation check.
  const result = classifyAffectedPaths(['src/objects/earth/README.md', 'package.json'], CONFIG);
  assert.equal(result.shared, true);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck', 'universe', 'universePreparation']);
});

test('classifyAffectedPaths: preparation pipeline core under tools/objects/ is shared, not tooling', () => {
  const result = classifyAffectedPaths(['tools/objects/terrestrial-layers/operations.mts'], CONFIG);
  assert.equal(result.shared, true);
});

test('classifyAffectedPaths: a path matching no area is treated as shared ("unsure means shared")', () => {
  const result = classifyAffectedPaths(['netlify/functions/search.ts'], CONFIG);
  assert.equal(result.shared, true);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck', 'universe', 'universePreparation']);
});

test('classifyAffectedPaths: an empty diff is shared, never a reason to skip', () => {
  const result = classifyAffectedPaths([], CONFIG);
  assert.equal(result.shared, true);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck', 'universe', 'universePreparation']);
});

test('classifyAffectedChanges: an unresolved push base is treated as shared', async () => {
  const result = await classifyAffectedChanges('push', '0000000000000000000000000000000000000000', {
    changedPaths: async () => undefined,
    config: async () => CONFIG,
  });
  assert.equal(result.shared, true);
});

test('classifyAffectedChanges: computes paths and config through the injected collaborators', async () => {
  const result = await classifyAffectedChanges('pr', 'origin/main', {
    changedPaths: async () => ['src/objects/venus/README.md'],
    config: async () => CONFIG,
  });
  assert.deepEqual(result.areaIds, ['object']);
  assert.deepEqual([...result.jobs], []);
});

test('parseCiAreasConfig: rejects an area that names an unrecognized job', () => {
  assert.throws(() => parseCiAreasConfig({
    shared: [], areas: [{ id: 'bad', patterns: ['x/**'], jobs: ['not-a-job'] }],
  }), /not a recognized job/);
});

test('parseCiAreasConfig: rejects a config missing required fields', () => {
  assert.throws(() => parseCiAreasConfig({ shared: [] }));
  assert.throws(() => parseCiAreasConfig({ areas: [] }));
  assert.throws(() => parseCiAreasConfig(null));
});

test('the checked-in .github/ci-areas.json parses and classifies as documented', async () => {
  const config = await loadCiAreasConfig();
  assert.ok(config.areas.length >= 5, 'expected at least the object, renderer, site, tooling and docs areas');
  const object = classifyAffectedPaths(['src/objects/pluto/README.md'], config);
  assert.equal(object.shared, false);
  assert.deepEqual([...object.jobs], []);
  const renderer = classifyAffectedPaths(['src/renderers/css/navigation/camera.ts'], config);
  assert.deepEqual([...renderer.jobs].sort(), ['typecheck', 'universe']);
  const lockfile = classifyAffectedPaths(['pnpm-lock.yaml'], config);
  assert.equal(lockfile.shared, true);
});
