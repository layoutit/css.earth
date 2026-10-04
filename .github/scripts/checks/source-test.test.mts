import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { checkoutState, missingSourceReason, restoredSources, sourceLoad, sourceValues } from '@cssearth/objects/node/source-test';
import { readOracleInput } from '@cssearth/core/oracle';
import { projectRoot } from '@cssearth/core/node';
import { MissingSourceInputError } from '@cssearth/core';

test('restored source paths resolve from the objects package to the repository root', () => {
  assert.equal(restoredSources('saturn', 'manifest.json').skip, false);
  assert.deepEqual(restoredSources('saturn', 'observations/not-restored.tif').missing, ['observations/not-restored.tif']);
});

test('only absent inputs skip: coverage that finds an undeclared file fails', () => {
  // An undeclared file is a plain Error; absent declared files are a MissingSourceInputError, whatever the message says.
  assert.equal(missingSourceReason(new Error('Fixture source manifest coverage failed. Undeclared: stray.txt. Missing: none.')), null);
  assert.equal(missingSourceReason(new Error('Fixture source coverage failed. Undeclared: stray.txt. Missing: raw/a.fits.')), null);
  assert.match(missingSourceReason(new MissingSourceInputError('Fixture source manifest coverage failed. Undeclared: none. Missing: raw/a.fits.')) ?? '', /Missing: raw\/a\.fits/u);
  assert.equal(missingSourceReason(new Error('an ordinary assertion')), null);
});

test('skipping follows the error code, not the wording of the message', () => {
  for (const message of ['x', 'Missing oracle input a.fits.', 'The Eureka! toolchain is not installed']) {
    assert.notEqual(missingSourceReason(new MissingSourceInputError(message)), null, `a coded absence skips whatever it says: ${message}`);
    assert.equal(missingSourceReason(new Error(message)), null, `the same words without the code are a failure: ${message}`);
  }
});


test('an untracked source sharp reports missing skips; a tracked one still fails', () => {
  const root = projectRoot(import.meta.url) + '/';
  assert.match(missingSourceReason(new Error(`Input file is missing: ${root}src/objects/saturn/source/observations/not-restored.tif`)) ?? '', /saturn: .*not-restored\.tif is not restored/u);
  assert.equal(missingSourceReason(new Error(`Input file is missing: ${root}src/objects/saturn/source/manifest.json`)), null);
});

test('a tracked file a sparse checkout leaves out is absent from this checkout; one missing from its checkout still fails', () => {
  const root = projectRoot(import.meta.url) + '/', file = `${root}src/objects/betelgeuse/source/observations/not-here.fits`;
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

test('an oracle input that is not restored is a skip, whichever layer reports the absence', async () => {
  // CI runs without restored sources by design: the oracle reader's absence error must stay recognizable as an unrestored source.
  const error = await readOracleInput({ path: 'src/objects/pallas/source/shape/2_Pallas_mpcd.obj' }).then(() => null, (reason: unknown) => reason);
  assert.ok(error instanceof Error);
  assert.notEqual(missingSourceReason(error), null);
  assert.equal(missingSourceReason(new Error('Oracle source size differs from its record: x')), null, 'a wrong size stays a failure');
});

test('sourceLoad discriminates absence and cannot supply fake values', async () => {
  const absent = await sourceLoad(() => { throw new MissingSourceInputError('absent'); });
  assert.notEqual(absent.skip, false);
  assert.equal(Object.hasOwn(absent, 'values'), false);
  assert.throws(() => sourceValues(absent), MissingSourceInputError);
  const present = await sourceLoad(() => ({ value: 7 }));
  assert.equal(present.skip, false);
  assert.deepEqual(sourceValues(present), { value: 7 });
  await assert.rejects(sourceLoad(() => { throw new Error('ordinary'); }), /ordinary/u);
});
test('source restore instructions belong to the caller', () => {
  assert.match(missingSourceReason(new MissingSourceInputError('absent'), 'probe', undefined, id => `restore ${id}`) ?? '', /run restore probe/u);
});
