import assert from 'node:assert/strict';
import { it as test } from 'node:test';
import { runToolchainProcess } from './process.js';
import { withToolchainProgress, hasToolchainProgress } from './progress.js';

test('a command that never ran says why instead of reporting a null status', () => {
  assert.throws(() => runToolchainProcess('cssearth-no-such-binary', ['--version']),
    (error: unknown) => error instanceof Error && /could not run: .*ENOENT/u.test(error.message) && !/status null/u.test(error.message));
});

test('a command killed by a signal names the signal, and a non-zero exit keeps its status', () => {
  assert.throws(() => runToolchainProcess(process.execPath, ['-e', "process.kill(process.pid, 'SIGKILL')"]), /killed by SIGKILL/u);
  assert.throws(() => runToolchainProcess(process.execPath, ['-e', 'process.exit(3)']), /failed \(status 3\)/u);
  assert.equal(runToolchainProcess(process.execPath, ['-e', "process.stdout.write('ok')"]), 'ok');
});

test('async processes retain stdout, exit codes, diagnostic tails and spawn failures', async () => {
  const { runToolchainProcessAsync } = await import('./process.js');
  assert.equal(await runToolchainProcessAsync(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input: 'payload' }), 'payload');
  await assert.rejects(runToolchainProcessAsync('cssearth-no-such-binary', []), /could not run: .*ENOENT/u);
  await assert.rejects(runToolchainProcessAsync(process.execPath, ['-e', "process.stderr.write('x'.repeat(3000)+'tail'); process.exit(7)"]),
    error => error instanceof Error && /failed \(status 7\)/u.test(error.message) && error.message.endsWith('x'.repeat(1996) + 'tail'));
  await assert.rejects(runToolchainProcessAsync(process.execPath, ['-e', "process.kill(process.pid, 'SIGKILL')"]), /killed by SIGKILL/u);
  await assert.rejects(runToolchainProcessAsync(process.execPath, ['-e', "process.stdout.write('too long')"], { maxBuffer: 2 }), /maxBuffer/u);
});

test('async abort waits for process close and prevents pre-aborted commands from starting', async () => {
  const { runToolchainProcessAsync } = await import('./process.js');
  const controller = new AbortController();
  let ready = false;
  await assert.rejects(runToolchainProcessAsync(process.execPath, ['-e', "process.stdout.write('ready'); setInterval(() => {}, 1000)"], {
    signal: controller.signal, output: text => { if (text === 'ready') { ready = true; controller.abort(); } },
  }), /installation aborted/u);
  assert.equal(ready, true);
  await assert.rejects(runToolchainProcessAsync('cssearth-no-such-binary', [], { signal: controller.signal }), { name: 'AbortError' });
});

test('abort does not release its caller until a terminating child has closed', async () => {
  const { runToolchainProcessAsync } = await import('./process.js');
  const controller = new AbortController();
  let stopped = false;
  await assert.rejects(runToolchainProcessAsync(process.execPath, ['-e', `
process.on('SIGTERM', () => setTimeout(() => { process.stdout.write('stopped'); process.exit(0); }, 75));
process.stdout.write('ready'); setInterval(() => {}, 1000);
`], { signal: controller.signal, output: text => {
    if (text.includes('ready')) controller.abort();
    if (text.includes('stopped')) stopped = true;
  } }), /installation aborted/u);
  assert.equal(stopped, true, 'the process must finish before the installer can release its lock');
});

test('streaming native installers keep their output without acquiring a capture limit', async () => {
  const { runToolchainProcessAsync } = await import('./process.js');
  let output = '';
  assert.equal(await runToolchainProcessAsync(process.execPath, ['-e', "process.stdout.write('native build log')"], {
    maxBuffer: 2, captureOutput: false, output: text => { output += text; },
  }), '');
  assert.equal(output, 'native build log');
});

test('default process cancellation inherits its signal without enabling progress output', async () => {
  const { runToolchainProcessAsync } = await import('./process.js');
  const controller = new AbortController();
  let stopped = false;
  await assert.rejects(withToolchainProgress({ signal: controller.signal }, async () => {
    assert.equal(hasToolchainProgress(), false);
    return runToolchainProcessAsync(process.execPath, ['-e', `
process.on('SIGTERM', () => setTimeout(() => { process.stdout.write('stopped'); process.exit(0); }, 75));
process.stdout.write('ready'); setInterval(() => {}, 1000);
`], { output: text => {
      if (text.includes('ready')) controller.abort();
      if (text.includes('stopped')) stopped = true;
    } });
  }), /installation aborted/u);
  assert.equal(stopped, true);
});

test('a default process owns signal cancellation and removes its handlers after closing', async () => {
  const { runToolchainProcessAsync } = await import('./process.js');
  const before = ['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal));
  let stopped = false;
  await assert.rejects(runToolchainProcessAsync(process.execPath, ['-e', `
process.on('SIGTERM', () => setTimeout(() => { process.stdout.write('stopped'); process.exit(0); }, 75));
process.stdout.write('ready'); setInterval(() => {}, 1000);
`], { output: text => {
    if (text.includes('ready')) process.emit('SIGINT');
    if (text.includes('stopped')) stopped = true;
  } }), /installation aborted/u);
  assert.equal(stopped, true);
  assert.deepEqual(['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal)), before);
});
