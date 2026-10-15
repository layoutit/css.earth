import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { FakeTerminal } from './fake-terminal.mts';
import { createInstallScreen, initialInstallState, installFreeGb, installProgress, NOT_INSTALLED, renderInstall, renderInstallConsent } from './install.mts';
import { plain } from './style.mts';
import { GLOBE_FRAMES } from './globe-frames.mts';
import { consentHandler, type ConsentState } from '../cli-consent.mts';
import { DownloadCancelledError, withToolchainProgress, reportToolchainProgress } from '@cssearth/telescope-core/node';
import type { CliIo } from '../cli-io.mts';

class InstallTerminal extends FakeTerminal {
  private tick: (() => void) | undefined;
  override async delay(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.delays.push(milliseconds);
    await new Promise<void>(resolve => {
      const done = () => { signal.removeEventListener('abort', done); this.tick = undefined; resolve(); };
      this.tick = done; signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
    signal.throwIfAborted();
  }
  async advance(): Promise<void> { this.tick?.(); await new Promise<void>(resolve => setImmediate(resolve)); }
}
const next = () => new Promise<void>(resolve => setImmediate(resolve));

test('consent wording, breadcrumb, step names and Try lines preserve the approved shape', () => {
  const consent = renderInstallConsent('42', 140).map(plain);
  assert.match(consent[0]!, /telescope › toolchain › install   v/u);
  assert.deepEqual(consent.slice(-5), ['', 'This needs the astronomy tools first.',
    '  Python and its astronomy packages · about 1 GB · installed once, shared by every run · 42 GB free', '',
    '  Install them now?  enter yes · esc not now']);
  let state = initialInstallState();
  state = installProgress(state, { type: 'step', step: 'micromamba', status: 'started' });
  state = installProgress(state, { type: 'download', received: 7_300_000, total: 14_600_000 });
  const lines = renderInstall(state, 140).map(plain);
  assert.match(lines.find(line => line.includes('micromamba'))!, /7.3 MB of 14.6 MB ━{12}─{12} 50%/u);
  state = installProgress(state, { type: 'step', step: 'python', status: 'started', label: 'Python 3.12' });
  const python = renderInstall(state, 140).map(plain).find(line => line.includes('Python 3.12'))!;
  assert.doesNotMatch(python, /%/u); assert.match(python, /━/u);
  const done = renderInstall(installProgress(state, { type: 'installed' }), 140).map(plain);
  assert.deepEqual(done.slice(-5), ['', 'Try:', '  telescope explore Betelgeuse      find observations and pick one',
    '  telescope explore "Crab Nebula"   any star, galaxy, nebula or planet', '  telescope help                    every command']);
  assert.equal(done.filter(line => line.endsWith('done')).length, 4);
});

test('Enter accepts, scripted progress turns the globe and completion restores the terminal', async () => {
  const terminal = new InstallTerminal(140, 40), controller = new AbortController(), screen = createInstallScreen(terminal, controller);
  const consent = screen.consent('42');
  assert.equal(terminal.listening, true); assert.doesNotMatch(terminal.writes.join(''), /Installing astronomy/u);
  await terminal.press({ name: 'x', text: 'x' });
  assert.doesNotMatch(terminal.writes.join(''), /Installing astronomy/u);
  await terminal.press({ name: 'return' }); assert.equal(await consent, true);
  screen.progress({ type: 'step', step: 'micromamba', status: 'started' });
  await terminal.advance();
  assert.ok(terminal.writes.at(-1)!.includes(GLOBE_FRAMES[1]![0]!));
  screen.progress({ type: 'download', received: 10, total: 20 });
  screen.progress({ type: 'step', step: 'micromamba', status: 'finished' });
  screen.progress({ type: 'installed' });
  assert.match(terminal.screen.join('\n'), /Installed\./u); assert.equal(terminal.listening, false);
  assert.equal(screen.active, false); assert.equal(controller.signal.aborted, false);
  assert.equal(terminal.writes.at(-1), '\x1b[?25h');
  assert.doesNotMatch(terminal.writes.join(''), /\x1b\[2J|\x1b\[\?1049h/u);
});

test('Escape declines, Ctrl-C aborts consent and a running install, with cleanup on every exit', async () => {
  for (const phase of ['escape', 'consent-interrupt', 'install-interrupt', 'failure']) {
    const terminal = new InstallTerminal(), controller = new AbortController(), screen = createInstallScreen(terminal, controller);
    const consent = screen.consent('42');
    if (phase === 'escape') await terminal.press({ name: 'escape' });
    else if (phase === 'consent-interrupt') await terminal.press({ name: 'c', ctrl: true });
    else { await terminal.press({ name: 'return' }); assert.equal(await consent, true); }
    if (phase === 'install-interrupt') await terminal.press({ name: 'c', ctrl: true });
    else if (phase === 'failure') screen.close();
    else { assert.equal(await consent, false); assert.ok(plain(terminal.writes.join('')).includes(NOT_INSTALLED)); }
    assert.equal(controller.signal.aborted, phase.includes('interrupt'));
    assert.equal(terminal.listening, false); assert.equal(screen.active, false);
  }
});

test('short windows show consent before keys and only the final progress state', async () => {
  const terminal = new InstallTerminal(140, 10), screen = createInstallScreen(terminal, new AbortController());
  const consent = screen.consent('42');
  assert.match(terminal.writes.join(''), /Install them now/u);
  await terminal.press({ name: 'return' }); assert.equal(await consent, true);
  await terminal.advance(); assert.doesNotMatch(terminal.writes.join(''), /Installing astronomy/u);
  screen.progress({ type: 'installed' });
  assert.equal(terminal.writes.filter(text => text.includes('Installed.')).length, 1);
  assert.equal(terminal.listening, false);
});

test('consent dispatch uses injected stderr terminal and gates install progress before work', async () => {
  const terminal = new InstallTerminal(), state: ConsentState = { installController: new AbortController() };
  const io: CliIo = { stdinIsTTY: true, stdoutIsTTY: true, stderrIsTTY: true, terminal,
    write: () => assert.fail('stdout screen bytes'), error: () => assert.fail('legacy notice'),
    question: async () => assert.fail('legacy prompt'), close: () => {} };
  const info = { kind: 'toolchain' as const, name: 'astroquery', bytes: 1e9, destination: tmpdir(), packages: ['Python'] };
  let installed = false;
  const request = consentHandler(io, { json: false }, state)(info).then(() => { installed = true; });
  while (!terminal.listening) await next();
  const declined = assert.rejects(request, DownloadCancelledError);
  assert.equal(installed, false); await terminal.press({ name: 'escape' });
  await declined; assert.equal(installed, false);
  assert.equal(state.toolchainDeclined, true);
  const accepted: ConsentState = { installController: new AbortController() };
  const install = consentHandler(io, { json: false }, accepted)(info);
  while (!terminal.listening) await next();
  await terminal.press({ name: 'return' }); await install;
  await withToolchainProgress({ report: event => accepted.install?.progress(event), signal: accepted.installController!.signal }, async () => {
    reportToolchainProgress({ type: 'installed' });
  });
  assert.equal(terminal.listening, false);
});

test('free space comes from the nearest existing ancestor on the user-root volume', async () => {
  const root = tmpdir(), { bavail, bsize } = await statfs(root);
  const actual = Number(await installFreeGb(`${root}/telescope-no-existing-root/child`));
  assert.ok(Math.abs(actual - Number((bavail * bsize / 1024 ** 3).toFixed(0))) <= 1);
});
