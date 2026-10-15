import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { requestTransferConsent, reportToolchainProgress } from '@cssearth/telescope-core/node';
import * as toolchains from './toolchains/astronomy-toolchains.mts';
import * as sessions from './session.mts';
import { FakeTerminal } from './tui/fake-terminal.mts';
import type { CliIo } from './cli-io.mts';

let installs = 0;
async function install(): Promise<string> {
  installs++;
  reportToolchainProgress({ type: 'step', step: 'python', status: 'started', label: 'Python 3.12' });
  reportToolchainProgress({ type: 'installed' });
  return 'fixture installed';
}
mock.module('./toolchains/astronomy-toolchains.mts', { namedExports: { ...toolchains, manageToolchain: install } });
mock.module('./session.mts', { namedExports: { ...sessions, saveSession: async () => {
  await requestTransferConsent({ kind: 'toolchain', name: 'astronomy Python toolchain', bytes: 1e9, destination: '/tmp/fixture', packages: ['Python'] });
  await install();
  throw new Error('fixture query finished');
} } });
const { main } = await import('./cli.mts');
function capture(tty = true) {
  const terminal = new FakeTerminal(), stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY: tty, stdoutIsTTY: tty, stderrIsTTY: tty, terminal,
    write: text => stdout.push(text), error: text => stderr.push(text), question: async () => assert.fail('legacy prompt'), close: () => {} };
  return { terminal, io, stdout, stderr };
}
async function waitForConsent(terminal: FakeTerminal): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!terminal.listening) {
    if (Date.now() >= deadline) assert.fail('consent screen did not start');
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

test('explicit TTY install asks before work, declines cleanly, and completion stays on stderr', async () => {
  for (const accepted of [false, true]) {
    const output = capture(), before = installs;
    const work = main(['toolchain', 'install', 'astroquery'], undefined, output.io.write, output.io);
    await waitForConsent(output.terminal); assert.equal(installs, before);
    await output.terminal.press({ name: accepted ? 'return' : 'escape' });
    assert.equal(await work, 0); assert.equal(installs, before + Number(accepted));
    assert.equal(output.stdout.join(''), ''); assert.equal(output.stderr.join(''), '');
    assert.equal(output.terminal.listening, false);
    assert.match(output.terminal.writes.join(''), accepted ? /Installed\./u : /Not installed\./u);
  }
});

test('implicit TTY refusal makes the caller report its missing toolchain', async () => {
  const output = capture(), before = installs;
  const work = main(['query', 'fixture', '--out', '/tmp/fixture-query'], undefined, output.io.write, output.io);
  await waitForConsent(output.terminal); await output.terminal.press({ name: 'escape' });
  assert.equal(await work, 1); assert.equal(installs, before);
  assert.match(output.stderr.join(''), /astronomy packages are not installed: telescope toolchain install astroquery/u);
  assert.equal(output.terminal.listening, false);
});

test('explicit JSON and pipes preserve their message documents and never draw or ask', async () => {
  for (const [tty, json] of [[false, false], [false, true], [true, true]] as const) {
    const output = capture(tty);
    assert.equal(await main(['toolchain', 'install', 'astroquery', ...(json ? ['--json'] : [])], undefined, output.io.write, output.io), 0);
    assert.equal(output.stdout.join(''), json ? '{"toolchain":"astroquery","mode":"install","message":"fixture installed"}\n' : 'fixture installed\n');
    assert.equal(output.stderr.join(''), ''); assert.deepEqual(output.terminal.writes, []);
  }
});
