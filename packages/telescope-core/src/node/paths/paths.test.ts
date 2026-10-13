import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { telescopeUserRoot, telescopeWorkspace, workspaceArguments, requireWorkspace, PACKAGE_ROOT } from './index.js';

test('user state defaults to the platform cache and an explicit home wins', () => {
  assert.equal(telescopeUserRoot({}, 'darwin', '/home/test'), '/home/test/Library/Caches/cssearth-telescope');
  assert.equal(telescopeUserRoot({}, 'linux', '/home/test'), '/home/test/.cache/cssearth-telescope');
  assert.equal(telescopeUserRoot({ XDG_CACHE_HOME: '/cache' }, 'linux', '/home/test'), '/cache/cssearth-telescope');
  assert.equal(telescopeUserRoot({ LOCALAPPDATA: '/local' }, 'win32', '/home/test'), '/local/cssearth-telescope');
  assert.equal(telescopeUserRoot({ CSSEARTH_TELESCOPE_HOME: '/chosen', XDG_CACHE_HOME: '/cache' }, 'linux', '/home/test'), '/chosen');
  assert.throws(() => telescopeUserRoot({ CSSEARTH_TELESCOPE_HOME: '' }), /requires a path/u);
});

test('CLI start directories discover workspaces; library defaults require a source entry', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'telescope-roots-')), root = resolve(temporary, 'checkout');
  try {
    await mkdir(resolve(root, 'packages/telescope-cli/src'), { recursive: true });
    await mkdir(resolve(root, 'src/objects'), { recursive: true });
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { telescope: 'node source' } }));
    const source = resolve(root, 'packages/telescope-cli/src/cli.mts'); await writeFile(source, '');
    assert.equal(telescopeWorkspace({}, temporary, source), undefined);
    assert.equal(telescopeWorkspace({}, root, '/installed/telescope.mjs'), root);
    assert.equal(telescopeWorkspace({}, root, source), root);
    assert.equal(telescopeWorkspace({ CSSEARTH_WORKSPACE: root }, temporary, '/installed/telescope.mjs'), root);
    assert.deepEqual(workspaceArguments(['explore'], {}, resolve(root, 'src/objects')), { args: ['explore'], workspace: root });
    assert.equal(telescopeWorkspace({ CSSEARTH_WORKSPACE: 'checkout' }, temporary), root);
    assert.deepEqual(workspaceArguments(['--workspace', 'checkout'], {}, temporary), { args: [], workspace: root });
    assert.deepEqual(workspaceArguments(['explore'], {}, temporary), { args: ['explore'], workspace: undefined });
    const selected = workspaceArguments(['explore', 'eris', '--workspace', root, '--json'], { CSSEARTH_WORKSPACE: '/invalid' });
    assert.deepEqual(selected, { args: ['explore', 'eris', '--json'], workspace: root });
    assert.throws(() => workspaceArguments(['--workspace']), /requires a path/u);
    assert.throws(() => workspaceArguments(['--workspace', root, '--workspace', root]), /only once/u);
    assert.throws(() => telescopeWorkspace({ CSSEARTH_WORKSPACE: temporary }), /this command needs a css\.earth checkout: pass --workspace/u);
    assert.equal(requireWorkspace(root), root);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('library workspace defaults use module location without reading the invoking cwd', t => {
  t.mock.method(process, 'cwd', () => { throw new Error('Library must not read cwd'); });
  assert.equal(telescopeWorkspace({}, undefined, '/installed/telescope.mjs'), undefined);
  assert.equal(telescopeWorkspace({}, undefined, resolve(PACKAGE_ROOT, 'src/node/paths.test.ts')), requireWorkspace());
});

test('relative platform cache values are ignored, independently of cwd', () => {
  for (const value of ['cache', '.', '../cache', '']) {
    assert.equal(telescopeUserRoot({ XDG_CACHE_HOME: value }, 'linux', '/home/test'), '/home/test/.cache/cssearth-telescope');
    assert.equal(telescopeUserRoot({ LOCALAPPDATA: value }, 'win32', '/home/test'), '/home/test/AppData/Local/cssearth-telescope');
  }
});
