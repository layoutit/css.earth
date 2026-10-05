/** Verify the portable clone boundary and child supervision without creating worktrees. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test from 'node:test';
import { cloneRestore, command, terminate } from './clone-restore.mts';

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
