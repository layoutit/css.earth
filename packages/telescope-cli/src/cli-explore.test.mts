import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { requestTransferConsent, reportToolchainProgress } from '@cssearth/telescope-core/node';
import * as query from './observation-query/query.mts';
import type { CliServices } from './cli.mts';
import type { CliIo } from './cli-io.mts';
import type { ExploreServices } from './tui/explore.mts';
import { FakeTerminal } from './tui/fake-terminal.mts';
import { exploreSession } from './tui/fixtures/explore.mts';
import { parseCli } from './cli-arguments.mts';

mock.module('./observation-query/query.mts', { namedExports: { ...query, loadTargetCatalogue: async () => [{ id: 'star', name: 'Star', aliases: [] }] } });
const { main } = await import('./cli.mts');
const unused = async (): Promise<never> => { throw new Error('unexpected service'); };
function api(exploration?: ExploreServices): CliServices {
  return { exploration, familyCoverageLedger: () => [], importLocalArtifact: unused, saveExploration: unused, getSession: unused,
    listArtifactOutputs: unused, exportOutput: unused, projectOutput: unused, exportSphere: unused, exportSpatialObject: unused, executeFamilyOperation: unused };
}
function capture() {
  const terminal = new FakeTerminal(150), stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY: true, stdoutIsTTY: true, stderrIsTTY: true, terminal, write: text => stdout.push(text), error: text => stderr.push(text), question: async () => assert.fail('line prompt'), close: () => {} };
  return { terminal, stdout, stderr, io };
}
async function until(condition: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!condition()) { if (Date.now() > deadline) assert.fail('CLI screen did not reach expected state'); await new Promise<void>(resolve => setImmediate(resolve)); }
}
function services(opened: string[]): ExploreServices {
  return { catalogue: async () => [{ id: 'star', name: 'Star', aliases: [] }], search: async () => exploreSession(), statuses: async () => new Map(),
    size: async () => 10, free: async () => 100, get: async () => '/run/pick-1/result.json',
    outputs: async () => [{ name: 'Image', description: 'PNG with a scale bar', run: async () => 'figure.png' }],
    preview: async () => ({ kind: 'none', reason: 'the archive has no preview for this one' }), open: file => { opened.push(file); } };
}
test('TTY explore enters the persistent flow, writes screen bytes only to stderr, and honors --no-open', async () => {
  for (const noOpen of [false, true]) {
    const screen = capture(), opened: string[] = [];
    const running = main(['explore', 'star', ...(noOpen ? ['--no-open'] : [])], undefined, screen.io.write, screen.io, api(services(opened)));
    await until(() => screen.terminal.screen.join('\n').includes('Start (UTC)'));
    await screen.terminal.press({ name: 'return' }); await until(() => screen.terminal.screen.join('\n').includes('Download it?'));
    await screen.terminal.press({ name: 'return' }); await until(() => screen.terminal.screen.join('\n').includes('What do you want to make?'));
    await screen.terminal.press({ name: 'return' }); await until(() => screen.terminal.screen.join('\n').includes('✓ figure.png'));
    assert.deepEqual(opened, noOpen ? [] : ['figure.png']); assert.equal(screen.terminal.listening, true);
    assert.deepEqual(screen.stdout, []); assert.deepEqual(screen.stderr, []);
    await screen.terminal.press({ text: 'q' }); assert.equal(await running, 0);
    assert.deepEqual(screen.stdout, ['Kept /run/pick-1/ · made figure.png\n']); assert.equal(screen.terminal.listening, false);
  }
  assert.throws(() => parseCli(['explore', 'star', '--no-open', '--no-open']), /Repeated/u);
});

test('default explore adapter suspends for installation, restores search after completion, and never hides a caught refusal', async () => {
  for (const accepted of [false, true]) {
    const screen = capture();
    const injected: CliServices = { ...api(), saveExploration: async () => {
      try {
        await requestTransferConsent({ kind: 'toolchain', name: 'astroquery', bytes: 1e9, packages: ['Python'], destination: '/tmp/toolchain' });
        reportToolchainProgress({ type: 'installed' });
      } catch { /* Real archive providers preserve a refusal as an unavailable-provider issue. */ }
      return exploreSession();
    } };
    const running = main(['explore', 'star'], undefined, screen.io.write, screen.io, injected);
    await until(() => screen.terminal.screen.join('\n').includes('Install them now?'));
    await screen.terminal.press({ name: accepted ? 'return' : 'escape' });
    if (accepted) {
      await until(() => screen.terminal.screen.join('\n').includes('Start (UTC)'));
      await screen.terminal.press({ name: 'escape' }); assert.equal(await running, 0);
    } else { assert.equal(await running, 1); assert.match(screen.stderr.join(''), /telescope toolchain install astroquery/u); assert.deepEqual(screen.stdout, []); }
    assert.equal(screen.terminal.listening, false);
  }
});

test('default explore adapter preserves filters before positional and explicit targets, including suggestions', async () => {
  for (const target of ['star', 'starr']) for (const explicit of [false, true]) {
    const screen = capture(), searched: string[][] = [];
    const args = ['--kind', 'image', '--instrument', 'star', '--any-time', ...(explicit ? ['--target', target] : [target]), '--wavelength', '1,2'];
    const running = main(['explore', ...args], undefined, screen.io.write, screen.io, { ...api(), saveExploration: async (_root, request) => {
      searched.push([...request]);
      const parsed = parseCli(['explore', ...request]);
      assert.equal(parsed.command, 'explore');
      if (parsed.command !== 'explore') assert.fail('expected explore');
      assert.equal(parsed.request.target, 'star'); assert.equal(parsed.request.kind, 'image');
      return exploreSession();
    } });
    if (target === 'starr') {
      await until(() => screen.terminal.screen.join('\n').includes('Did you mean:'));
      assert.deepEqual(searched, []); await screen.terminal.press({ name: 'return' });
    }
    await until(() => screen.terminal.screen.join('\n').includes('Start (UTC)'));
    assert.deepEqual(searched, [['--kind', 'image', '--instrument', 'star', '--any-time', ...(explicit ? ['--target', 'star'] : ['star']), '--wavelength', '1,2']]);
    await screen.terminal.press({ name: 'escape' }); assert.equal(await running, 0);
    assert.deepEqual(screen.stderr, []);
  }
});


test('declined installation during get exits the suspended screen even if retrieval caught the refusal', async () => {
  const screen = capture();
  const injected: CliServices = { ...api(), saveExploration: async () => exploreSession(), getSession: async () => {
    try { await requestTransferConsent({ kind: 'toolchain', name: 'astroquery', bytes: 1e9, packages: ['Python'], destination: '/tmp/toolchain' }); } catch { /* provider records the refusal */ }
    return { resultPath: '/run/pick-1/result.json', product: '/run/pick-1/science.fits', reused: false };
  } };
  const running = main(['explore', 'star'], undefined, screen.io.write, screen.io, injected);
  await until(() => screen.terminal.screen.join('\n').includes('Start (UTC)'));
  await screen.terminal.press({ name: 'return' }); await until(() => screen.terminal.screen.join('\n').includes('Download it?'));
  await screen.terminal.press({ name: 'return' }); await until(() => screen.terminal.screen.join('\n').includes('Install them now?'));
  await screen.terminal.press({ name: 'escape' });
  assert.equal(await running, 1); assert.equal(screen.terminal.listening, false);
  assert.match(screen.stderr.join(''), /telescope toolchain install astroquery/u); assert.deepEqual(screen.stdout, []);
});
