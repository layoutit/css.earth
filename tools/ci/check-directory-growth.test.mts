import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { buildBaseline, countModules, growth, isExempt, trackedFiles, FREE_ALLOWANCE } from './check-directory-growth.mts';

/** Stand in for `git ls-files`, so a unit test owns its file list instead of a repository. */
const listing = (...files: string[]) => async () => files;
const modules = (directory: string, count: number, suffix = '.mts') =>
  Array.from({ length: count }, (_, i) => `${directory}/m${i}${suffix}`);

test('counts authored modules per directory, separating tests and ignoring declarations', async () => {
  const counts = await countModules('.', listing(
    'src/a/one.mts', 'src/a/two.ts', 'src/a/page.astro',
    'src/a/x.test.mts', 'src/a/y-browser.mts',
    'src/a/z.d.ts', 'src/a/w.d.mts', 'src/a/notes.md', 'src/a/data.json',
    'src/a/deep/nested.mts'));
  assert.deepEqual(counts.get('src/a'), { implementations: 3, tests: 2 },
    'declarations, markdown and JSON do not count; browser suites count as tests');
  assert.deepEqual(counts.get('src/a/deep'), { implementations: 1, tests: 0 },
    'a file counts only for the directory that directly holds it');
});

test('generated output and the required open-ended registries are exempt', () => {
  for (const directory of ['packages/x/dist', 'tools/objects/dist', 'src/objects', 'src/objects/mars',
    'src/objects/mars/prepared', 'src/sources', 'packages/astronomy/src/data/generated',
    'tests/fixtures', 'tools/objects/hst/programs']) {
    assert.equal(isExempt(directory), true, directory);
  }
  // The object contract requires src/objects to be an open-ended registry of 586 bodies, so
  // counting it would forbid adding one. Authored trees are never exempt.
  for (const directory of ['src/platform', 'site', 'tools', 'packages/astronomy/src', 'packages/renderer/src']) {
    assert.equal(isExempt(directory), false, directory);
  }
});

test('a directory fails only when implementations grow past the larger of baseline and allowance', async () => {
  const big = modules('src/big', 30), small = modules('src/small', 5);
  const baseline = buildBaseline(await countModules('.', listing(...big, ...small)));
  assert.deepEqual(Object.keys(baseline.directories), ['src/big'], 'only directories over the allowance are recorded');

  assert.deepEqual(growth(await countModules('.', listing(...big, ...small)), baseline), [],
    'an unchanged tree passes');

  assert.deepEqual(growth(await countModules('.', listing(...big, 'src/big/extra.mts', ...small)), baseline),
    [{ directory: 'src/big', kind: 'implementations', was: 30, now: 31 }],
    'a recorded directory may not grow');

  const grown = modules('src/small', FREE_ALLOWANCE);
  assert.deepEqual(growth(await countModules('.', listing(...big, ...grown)), baseline), [],
    'an unrecorded directory may grow up to the allowance');
  assert.deepEqual(growth(await countModules('.', listing(...big, ...grown, `src/small/m${FREE_ALLOWANCE}.mts`)), baseline),
    [{ directory: 'src/small', kind: 'implementations', was: FREE_ALLOWANCE, now: FREE_ALLOWANCE + 1 }],
    'and no further');
});

test('adding a test never fails the ratchet, so the rule cannot discourage testing', async () => {
  const files = [...modules('src/big', 30), ...modules('src/big', 25, '.test.mts')];
  const baseline = buildBaseline(await countModules('.', listing(...files)));
  const after = await countModules('.', listing(...files, 'src/big/another.test.mts'));
  assert.equal(after.get('src/big')!.tests, 26);
  assert.deepEqual(growth(after, baseline), [], 'test growth does not fail the check');
  assert.deepEqual(growth(after, baseline, ['tests']),
    [{ directory: 'src/big', kind: 'tests', was: 25, now: 26 }], 'but it is still reported');
});

test('the real count comes from git, so generated output cannot enter the baseline', async () => {
  const files = await trackedFiles();
  // src/platform/solar-geometry.mts is 26,968 generated lines and is gitignored; site's
  // prepared-object-catalog.mts is generated too. Counting the working tree would put both in the
  // baseline and make it depend on whether `pnpm prebuild` had run.
  for (const generated of ['src/platform/solar-geometry.mts', 'site/prepared-object-catalog.mts',
    'site/prepared-context-objects.mts']) {
    assert.equal(files.includes(generated), false, `${generated} must not be counted`);
  }
  const counts = await countModules();
  assert.ok((counts.get('src/platform')?.implementations ?? 0) > 0, 'the real tree is still counted');
});
