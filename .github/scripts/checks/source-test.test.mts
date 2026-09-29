import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { checkoutState, missingSourceReason, restoredSources } from '@cssearth/objects/node/source-test';

test('restored source paths resolve from the objects package to the repository root', () => {
  assert.equal(restoredSources('saturn', 'manifest.json').skip, false);
  assert.deepEqual(restoredSources('saturn', 'observations/not-restored.tif').missing, ['observations/not-restored.tif']);
});

test('only absent inputs skip: coverage that finds an undeclared file fails', () => {
  assert.equal(missingSourceReason(new Error('Fixture source manifest coverage failed. Undeclared: stray.txt. Missing: none.')), null);
  assert.equal(missingSourceReason(new Error('Fixture source coverage failed. Undeclared: stray.txt. Missing: raw/a.fits.')), null);
  assert.match(missingSourceReason(new Error('Fixture source manifest coverage failed. Undeclared: none. Missing: raw/a.fits.')) ?? '', /Missing: raw\/a\.fits/u);
  assert.equal(missingSourceReason(new Error('an ordinary assertion')), null);
});

test('an untracked source sharp reports missing skips; a tracked one still fails', () => {
  const root = new URL('../../../', import.meta.url).pathname;
  assert.match(missingSourceReason(new Error(`Input file is missing: ${root}src/objects/saturn/source/observations/not-restored.tif`)) ?? '', /saturn: .*not-restored\.tif is not restored/u);
  assert.equal(missingSourceReason(new Error(`Input file is missing: ${root}src/objects/saturn/source/manifest.json`)), null);
});

test('a tracked file a sparse checkout leaves out is absent from this checkout; one missing from its checkout still fails', () => {
  const root = new URL('../../../', import.meta.url).pathname, file = `${root}src/objects/betelgeuse/source/observations/not-here.fits`;
  const missing = Object.assign(new Error(`ENOENT: no such file or directory, open '${file}'`), { code: 'ENOENT', path: file });
  assert.match(missingSourceReason(missing, null, () => 'outside-sparse-checkout') ?? '', /outside this sparse checkout; run git sparse-checkout add '\/src\/objects\/betelgeuse\/source\/observations\/not-here\.fits'/u);
  assert.equal(missingSourceReason(missing, null, () => 'checked-out'), null, 'a tracked file its checkout should hold is a failure');
  assert.match(missingSourceReason(missing, null, () => 'untracked') ?? '', /betelgeuse: .*not-here\.fits is not restored/u);
});

test('the checkout state comes from git: a sparse checkout marks what it leaves out, a full one holds every tracked file', () => {
  const repository = mkdtempSync(resolve(tmpdir(), 'source-test-sparse-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repository, stdio: 'pipe' });
    git('init', '-q'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'test');
    mkdirSync(resolve(repository, 'kept')); mkdirSync(resolve(repository, 'left out'));
    writeFileSync(resolve(repository, 'kept/a.txt'), 'a'); writeFileSync(resolve(repository, 'left out/b c.fits'), 'b');
    git('add', '.'); git('commit', '-qm', 'fixture');
    assert.equal(checkoutState('left out/b c.fits', repository), 'checked-out', 'a full checkout holds every tracked file');
    rmSync(resolve(repository, 'left out/b c.fits'));
    assert.equal(checkoutState('left out/b c.fits', repository), 'checked-out', 'a tracked file deleted from a full checkout is still expected there');
    git('checkout', '-q', '--', '.'); git('sparse-checkout', 'set', '--no-cone', '/kept/');
    assert.equal(checkoutState('left out/b c.fits', repository), 'outside-sparse-checkout');
    assert.equal(checkoutState('kept/a.txt', repository), 'checked-out');
    assert.equal(checkoutState('never/added.fits', repository), 'untracked');
  } finally { rmSync(repository, { recursive: true, force: true }); }
});
