import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBaseline, countModules, growth, isExempt, FREE_ALLOWANCE } from './check-directory-growth.mts';

async function tree(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'directory-growth-'));
  for (const path of Object.keys(files)) {
    await mkdir(join(root, path.slice(0, path.lastIndexOf('/'))), { recursive: true });
    await writeFile(join(root, path), files[path]!);
  }
  return root;
}
const modules = (directory: string, count: number, suffix = '.mts') =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${directory}/m${i}${suffix}`, 'export {}']));

test('counts authored modules per directory, separating tests and ignoring declarations', async () => {
  const root = await tree({ ...modules('src/a', 3), 'src/a/x.test.mts': '', 'src/a/y.d.ts': '',
    'src/a/deep/one.mts': '', 'src/a/notes.md': '' });
  try {
    const counts = await countModules(root, ['src']);
    assert.deepEqual(counts.get('src/a'), { implementations: 3, tests: 1 }, 'declarations and non-code do not count');
    assert.deepEqual(counts.get('src/a/deep'), { implementations: 1, tests: 0 }, 'only files directly in a directory count');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('generated output and required open-ended data sets are exempt', () => {
  for (const directory of ['packages/x/dist', 'src/objects', 'src/objects/mars', 'src/sources',
    'tools/objects/dist', 'src/objects/mars/prepared', 'tests/fixtures', 'tools/objects/hst/programs']) {
    assert.equal(isExempt(directory), true, directory);
  }
  // The contract requires src/objects to be an open-ended registry of 586 bodies; counting it
  // would forbid adding a body. Authored trees are not exempt.
  for (const directory of ['src/platform', 'site', 'tools', 'packages/astronomy/src']) {
    assert.equal(isExempt(directory), false, directory);
  }
});

test('a directory fails only when its implementations grow past the larger of baseline and allowance', async () => {
  const root = await tree({ ...modules('src/big', 30), ...modules('src/small', 5) });
  try {
    const baseline = buildBaseline(await countModules(root, ['src']));
    assert.deepEqual(Object.keys(baseline.directories), ['src/big'], 'only directories over the allowance are recorded');

    // Unchanged tree passes.
    assert.deepEqual(growth(await countModules(root, ['src']), baseline), []);

    // The recorded directory may not grow.
    await writeFile(join(root, 'src/big/extra.mts'), 'export {}');
    assert.deepEqual(growth(await countModules(root, ['src']), baseline),
      [{ directory: 'src/big', kind: 'implementations', was: 30, now: 31 }]);
    await rm(join(root, 'src/big/extra.mts'));

    // An unrecorded directory may grow up to the allowance, and no further.
    const grown = { ...modules('src/small', FREE_ALLOWANCE) };
    for (const path of Object.keys(grown)) await writeFile(join(root, path), 'export {}');
    assert.deepEqual(growth(await countModules(root, ['src']), baseline), [], 'growth up to the allowance is free');
    await writeFile(join(root, `src/small/m${FREE_ALLOWANCE}.mts`), 'export {}');
    assert.deepEqual(growth(await countModules(root, ['src']), baseline),
      [{ directory: 'src/small', kind: 'implementations', was: FREE_ALLOWANCE, now: FREE_ALLOWANCE + 1 }]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('adding a test never fails the ratchet, so the rule cannot discourage testing', async () => {
  const root = await tree({ ...modules('src/big', 30), ...modules('src/big', 25, '.test.mts') });
  try {
    const counts = await countModules(root, ['src']);
    const baseline = buildBaseline(counts);
    await writeFile(join(root, 'src/big/another.test.mts'), 'export {}');
    const after = await countModules(root, ['src']);
    assert.equal(after.get('src/big')!.tests, 26);
    assert.deepEqual(growth(after, baseline), [], 'test growth does not fail');
    assert.deepEqual(growth(after, baseline, ['tests']),
      [{ directory: 'src/big', kind: 'tests', was: 25, now: 26 }], 'but it is still reported');
  } finally { await rm(root, { recursive: true, force: true }); }
});
