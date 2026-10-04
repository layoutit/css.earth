import assert from 'node:assert/strict';
import { it as test } from 'node:test';
import { runToolchainProcess } from './process.js';

test('a command that never ran says why instead of reporting a null status', () => {
  assert.throws(() => runToolchainProcess('cssearth-no-such-binary', ['--version']),
    (error: unknown) => error instanceof Error && /could not run: .*ENOENT/u.test(error.message) && !/status null/u.test(error.message));
});

test('a command killed by a signal names the signal, and a non-zero exit keeps its status', () => {
  assert.throws(() => runToolchainProcess(process.execPath, ['-e', "process.kill(process.pid, 'SIGKILL')"]), /killed by SIGKILL/u);
  assert.throws(() => runToolchainProcess(process.execPath, ['-e', 'process.exit(3)']), /failed \(status 3\)/u);
  assert.equal(runToolchainProcess(process.execPath, ['-e', "process.stdout.write('ok')"]), 'ok');
});
