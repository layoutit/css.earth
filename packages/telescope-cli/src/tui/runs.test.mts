import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { main, type CliIo, type CliServices } from '../cli.mts';
import { parseCli } from '../cli-arguments.mts';
import { helpText } from '../help.mts';
import { VERSION } from '../version.mts';
import { FakeTerminal } from './fake-terminal.mts';
import { exploreSession } from './fixtures/explore.mts';
import type { ExploreServices } from './explore.mts';
import type { SavedRun } from './saved-runs.mts';
import { NO_SAVED_RUNS, renderRuns, runsScreen } from './runs.mts';
import { plain } from './style.mts';

const runs: readonly SavedRun[] = [
  { run: './telescope-runs/new', target: 'Betelgeuse', at: '2026-10-15T10:00:00Z', observations: 33, downloaded: 2, partial: 1, made: 3 },
  { run: './telescope-runs/old', target: 'Eris', at: '2026-10-14T10:00:00Z', observations: 8, downloaded: 0, partial: 0, made: 0 },
];
const now = () => Date.parse('2026-10-15T10:12:00Z');
async function until(condition: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!condition()) { if (Date.now() > deadline) assert.fail('screen did not reach its expected state'); await new Promise<void>(resolve => setImmediate(resolve)); }
}
test('runs render the approved breadcrumb, spacing, wording, colors, ages and active path', () => {
  const lines = renderRuns(runs, 0, now());
  assert.deepEqual(lines.map(plain), [`telescope › runs   v${VERSION}`, '', 'Your runs', '',
    '> Betelgeuse    12 min ago   33 observations   ✓ 2 downloaded  ◐ 1 partial  · 3 made',
    '  Eris          1 d ago       8 observations   nothing downloaded', '',
    '↑↓ choose · enter reopen · esc quit   ./telescope-runs/new']);
  assert.ok(lines[4]!.includes('\x1b[32m✓ 2 downloaded\x1b[39m'));
  assert.ok(lines[4]!.includes('\x1b[33m◐ 1 partial\x1b[39m'));
  assert.ok(lines[4]!.includes('\x1b[2m  · 3 made\x1b[22m'));
  assert.match(plain(renderRuns(runs, 1, now() + 2 * 3600000)[4]!), /2 h ago/u);
});

test('arrow keys clamp, Enter selects, Escape and Ctrl-C restore the cursor; tall blocks draw final state only', async () => {
  for (const ending of ['return', 'escape', 'c'] as const) {
    const terminal = new FakeTerminal(160), running = runsScreen(runs, terminal, now);
    await terminal.press({ name: 'up' }, { name: 'down' }, { name: 'down' });
    assert.match(terminal.screen.join('\n'), /> Eris/u);
    assert.match(terminal.screen.join('\n'), /esc quit   \.\/telescope-runs\/old/u);
    await terminal.press({ name: ending, ctrl: ending === 'c' });
    assert.deepEqual(await running, ending === 'return' ? { code: 0, run: runs[1] } : { code: ending === 'c' ? 130 : 0 });
    assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), '\x1b[?25h');
    assert.doesNotMatch(terminal.writes.join(''), /\x1b\[2J|\x1b\[\?1049h/u);
  }
  const short = new FakeTerminal(160, 5), running = runsScreen(runs, short, now);
  assert.doesNotMatch(short.writes.join(''), /Your runs/u);
  await short.press({ name: 'down' }, { name: 'escape' }); await running;
  assert.equal(short.writes.filter(text => text.includes('Your runs')).length, 1);
  assert.match(short.writes.join(''), /> Eris/u);
  const empty = new FakeTerminal();
  assert.deepEqual(await runsScreen([], empty), { code: 0 });
  assert.deepEqual(empty.writes, [`${NO_SAVED_RUNS}\n`]); assert.equal(empty.listening, false);
});

test('open parses only its directory and flags and has a discoverable help topic', () => {
  assert.deepEqual(parseCli(['open']), { command: 'open', directory: resolve('telescope-runs'), json: false, verbose: false });
  assert.deepEqual(parseCli(['open', 'saved', '--json']), { command: 'open', directory: resolve('saved'), json: true, verbose: false });
  for (const args of [['open', 'a', 'b'], ['open', '--out', 'saved'], ['open', '--json', '--json']]) assert.throws(() => parseCli(args));
  for (const topic of ['open', 'all']) assert.match(helpText(topic), /telescope open \[DIRECTORY\] \[--json\]/u);
  assert.match(helpText('open'), /newest first.*without searching/u);
});

function capture(stdinIsTTY: boolean, stdoutIsTTY: boolean, stderrIsTTY: boolean, terminal = new FakeTerminal(100)) {
  const stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY, stdoutIsTTY, stderrIsTTY, terminal, write: text => stdout.push(text), error: text => stderr.push(text),
    question: async () => { throw new Error('Unexpected prompt'); }, close: () => {} };
  return { io, stdout, stderr, terminal };
}
test('CLI open keeps JSON and every redirected stream path plain, including the worker IPC path', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'open-cli-'));
  try {
    const path = resolve(root, 'saved'); await mkdir(path);
    await writeFile(resolve(path, 'explore.json'), JSON.stringify(exploreSession()));
    for (const [stdin, stdout, stderr, json] of [[false, true, true, false], [true, false, true, false], [true, true, false, false], [true, true, true, true]]) {
      const f = capture(stdin!, stdout!, stderr!);
      assert.equal(await main(['open', root, ...(json ? ['--json'] : [])], root, f.io.write, f.io), 0, f.stderr.join(''));
      const text = f.stdout.join('');
      if (json) assert.deepEqual(JSON.parse(text), [{ run: path, target: 'Star', at: exploreSession().createdAt, observations: 2, downloaded: 0, partial: 0, made: 0 }]);
      else assert.equal(text, `${path}  Star  2 observations  0 downloaded\n`);
      assert.doesNotMatch(text, /\x1b/u); assert.deepEqual(f.stderr, []); assert.deepEqual(f.terminal.writes, []);
    }
    const worker = spawnSync(process.execPath, [new URL('../cli.mts', import.meta.url).pathname, 'open', root, '--json'],
      { encoding: 'utf8', timeout: 30000, env: { ...process.env, CSSEARTH_TELESCOPE_STDIN_TTY: '0', CSSEARTH_TELESCOPE_STDOUT_TTY: '0', CSSEARTH_TELESCOPE_STDERR_TTY: '0' } });
    assert.equal(worker.status, 0, worker.stderr); assert.equal(JSON.parse(worker.stdout)[0].run, path); assert.equal(worker.stderr, '');
    const empty = capture(false, false, false);
    assert.equal(await main(['open', resolve(root, 'missing'), '--json'], root, empty.io.write, empty.io), 0);
    assert.equal(empty.stdout.join(''), '[]\n');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI Enter reopens saved explore directly, preserving its file and never calling catalogue or search', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'open-reopen-'));
  const unused = async (): Promise<never> => { throw new Error('Unexpected service call'); };
  try {
    const directory = resolve(root, 'saved'); await mkdir(directory);
    const path = resolve(directory, 'explore.json'), bytes = JSON.stringify(exploreSession()); await writeFile(path, bytes);
    const services: ExploreServices = { catalogue: unused, search: unused, statuses: async session => {
      assert.equal(session.directory, directory); assert.equal(session.choices[1]!.display.instrument, 'UVES');
      return new Map([[2, { state: 'partial', bytes: 3 }]]);
    }, size: unused, free: unused, get: unused, outputs: unused, preview: unused, open: unused };
    const api: CliServices = { exploration: services, saveExploration: unused, getSession: unused, importLocalArtifact: unused,
      listArtifactOutputs: unused, exportOutput: unused, projectOutput: unused, exportSphere: unused, exportSpatialObject: unused,
      executeFamilyOperation: unused, familyCoverageLedger: () => [] };
    const f = capture(true, true, true), running = main(['open', root], root, f.io.write, f.io, api);
    await until(() => f.terminal.screen.join('\n').includes('Your runs'));
    await f.terminal.press({ name: 'return' });
    await until(() => f.terminal.screen.join('\n').includes('Start (UTC)'));
    assert.match(f.terminal.screen.join('\n'), /telescope › Star/u);
    assert.match(f.terminal.screen.join('\n'), /◐.*UVES/u);
    assert.deepEqual(f.stdout, []);
    await f.terminal.press({ name: 'escape' });
    assert.equal(await running, 0, f.stderr.join(''));
    assert.equal(f.stdout.join(''), `Saved ${directory} · reopen it with: telescope open\n`);
    assert.equal(await readFile(path, 'utf8'), bytes); assert.equal(f.terminal.listening, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
