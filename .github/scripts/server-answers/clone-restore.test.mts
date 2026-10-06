/** Verify the portable clone boundary and child supervision without creating worktrees. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readlink, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { cloneRestore, command, inLayout, terminate } from './clone-restore.mts';

test('clone restoration refuses nested and unrelated destinations before cloning', async () => {
  await assert.rejects(cloneRestore(process.cwd(), resolve('output/forbidden-clone')), /new sibling/u);
  await assert.rejects(cloneRestore(process.cwd(), resolve('../unrelated-clone')), /new sibling/u);
});

test('command supervision returns positive output and rejects unsuccessful commands', async () => {
  assert.equal(await command(process.execPath, ['-e', 'process.stdout.write("positive signal")'], process.cwd()), 'positive signal');
  await assert.rejects(command(process.execPath, ['-e', 'process.stderr.write("expected failure"); process.exit(7)'], process.cwd()), /exited 7: expected failure/u);
});

test('termination stops the supervised process group', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: process.platform !== 'win32', stdio: 'ignore' });
  const exited = once(child, 'exit');
  await once(child, 'spawn');
  terminate(child);
  const [code, signal] = await exited;
  assert.equal(code, null);
  assert.equal(signal, 'SIGTERM');
  terminate(child);
});

test('a public input lands in the public directory of the revision it is restored into', () => {
  assert.equal(inLayout('site/public/navigation/sprites/', 'site/public', 'public'), 'public/navigation/sprites/');
  assert.equal(inLayout('public/navigation/sprites/', 'public', 'site/public'), 'site/public/navigation/sprites/');
  assert.equal(inLayout('site/public/a', 'site/public', 'site/public'), 'site/public/a');
  assert.equal(inLayout('site/publication/a', 'site/public', 'public'), 'site/publication/a');
  assert.equal(inLayout('node_modules/', 'site/public', 'public'), 'node_modules/');
});

test('restoring a revision from before public/ moved keeps that revision in its own layout', async () => {
  const parent = await realpath(await mkdtemp(resolve(tmpdir(), 'clone-restore-')));
  const root = resolve(parent, 'repo'), clone = resolve(parent, 'repo-old');
  const write = async (path: string, text: string) => { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); };
  const git = (...args: string[]) => command('git', args, root);
  try {
    await mkdir(root);
    await git('init', '-q');
    await git('config', 'user.name', 'test'); await git('config', 'user.email', 'test@example.com');
    await write('.gitignore', '/public/navigation/sprites/\n/public/scenes/\n');
    await write('public/navigation/kept.txt', 'tracked');
    await git('add', '.'); await git('commit', '-q', '--no-verify', '-m', 'chore: old layout');
    const old = (await git('rev-parse', 'HEAD')).trim();
    await git('mv', 'public', 'site-public'); await mkdir(resolve(root, 'site')); await git('mv', 'site-public', 'site/public');
    await write('.gitignore', '/site/public/navigation/sprites/\n/site/public/scenes/\n');
    await git('add', '.'); await git('commit', '-q', '--no-verify', '-m', 'chore: new layout');
    await write('site/public/navigation/sprites/a.txt', 'sprite');
    await mkdir(resolve(root, 'site/public/scenes'), { recursive: true });
    assert.equal((await cloneRestore(root, clone, old)).restored, 1);
    assert.equal(existsSync(resolve(clone, 'public/navigation/sprites/a.txt')), true);
    assert.equal(existsSync(resolve(clone, 'site/public')), false, 'no second public directory appears in the old revision');
    assert.equal(await readlink(resolve(clone, 'public/scenes')), resolve(root, 'site/public/scenes'));
  } finally { await rm(parent, { recursive: true, force: true }); }
});
