import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { FakeTerminal } from './fake-terminal.mts';
import { GLOBE_FRAMES } from './globe-frames.mts';
import { header, HEADER_WIDTH, helpScreen, renderHelp } from './help.mts';
import { plain, visibleWidth } from './style.mts';
import { WORDMARK } from '../banner.mts';
import { VERSION } from '../version.mts';
import { SHORT_HELP, helpText } from '../help.mts';
import { writeHelp } from '../help-output.mts';
import { guided } from '../cli.mts';
import type { CliIo } from '../cli/cli-io.mts';

test('the committed globe has 60 fixed ten-row frames and preserves approved frame zero', () => {
  assert.equal(GLOBE_FRAMES.length, 60);
  assert.deepEqual(GLOBE_FRAMES[0], ['     ...#...###..', '   ##......########', ' .........#####.####.',
    '........############..', '.#......###########...', '.####.........####....', '.####........####.#...',
    ' .##..........##.....', '   .#..............', '     ..#......#..']);
  const outline = [[5, 12], [3, 16], [1, 20], [0, 22], [0, 22], [0, 22], [0, 22], [1, 20], [3, 16], [5, 12]];
  for (const frame of GLOBE_FRAMES) {
    assert.equal(frame.length, 10);
    frame.forEach((line, row) => {
      const [indent = 0, width = 0] = outline[row]!;
      assert.equal(line.length, indent + width); assert.match(line.slice(indent), /^[#.]+$/u);
    });
  }
  assert.equal(new Set(GLOBE_FRAMES.map(frame => frame.join('\n'))).size, 60);
});

test('the header centers its wordmark, pitch and globe with one empty row above', () => {
  const lines = header(0, HEADER_WIDTH).map(plain), narrow = header(0, HEADER_WIDTH - 1).map(plain);
  assert.equal(lines[0], ''); assert.equal(lines.length, 11); assert.equal(narrow.length, 11);
  assert.deepEqual(narrow.slice(1, 6), WORDMARK);
  assert.equal(narrow[6], `telescope v${VERSION} · by layoutit`);
  assert.equal(narrow[7], '');
  assert.deepEqual(narrow.slice(8), ["Browse the world's telescope archives and get real",
    'astronomy data: images, spectra and cubes from', 'ALMA, ESO, Hubble, JWST, Keck, Chandra and more.']);
  for (let row = 1; row < lines.length; row++) {
    assert.equal(lines[row], narrow[row]!.padEnd(HEADER_WIDTH - 22) + GLOBE_FRAMES[0]![row - 1]);
  }
  assert.deepEqual(header(60, HEADER_WIDTH), header(0, HEADER_WIDTH));
  assert.ok(lines.every(line => visibleWidth(line) <= HEADER_WIDTH));
  const metadata: unknown = createRequire(import.meta.url)('@cssearth/telescope/package.json');
  assert.ok(metadata && typeof metadata === 'object' && 'version' in metadata);
  assert.equal(VERSION, metadata.version);
});

test('the help body preserves the approved wording, spacing, also line and fine print', () => {
  const body = renderHelp(0, 80).map(plain).slice(11);
  assert.deepEqual(body, ['', '  telescope explore TARGET              Find observations and pick one',
    '  telescope get RUN --pick N            Retrieve a saved pick',
    '  telescope outputs ARTIFACT.json       List what it can become',
    '  telescope export RESULT --output TYPE Make an image, viewer or table', '',
    '  also: papers · leads · stars · skill · toolchain', '',
    'Details: telescope help COMMAND · --json for scripts and agents']);
});

test('help turns exactly once at 50 ms with an injected clock, then restores the cursor', async () => {
  const terminal = new FakeTerminal();
  assert.equal(await helpScreen(terminal), 0);
  assert.deepEqual(terminal.delays, Array.from({ length: 60 }, () => 50));
  const frames = terminal.writes.filter(text => text.includes('Find observations and pick one'));
  assert.equal(frames.length, 61);
  assert.equal(frames[0], renderHelp(0, terminal.columns).map(line => `${line}\x1b[K\n`).join(''));
  assert.ok(frames[15]!.includes(GLOBE_FRAMES[15]![3]!));
  assert.equal(frames.at(-1), `\x1b[20F${frames[0]}`);
  assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), '\x1b[?25h');
});

test('short and narrow windows show a single still without waiting for animation', async () => {
  for (const [columns, rows] of [[80, 20], [HEADER_WIDTH - 1, 40]]) {
    const terminal = new FakeTerminal(columns, rows);
    assert.equal(await helpScreen(terminal), 0); assert.deepEqual(terminal.delays, []);
    const frames = terminal.writes.filter(text => text.includes('Find observations and pick one'));
    assert.equal(frames.length, 1); assert.equal(terminal.listening, false);
    if (columns! < HEADER_WIDTH) assert.doesNotMatch(frames[0]!, /[.#]{8}/u);
  }
});

test('Ctrl-C aborts the animation, restores the terminal and returns 130', async () => {
  const terminal = new FakeTerminal();
  terminal.onDelay = () => { void terminal.press({ name: 'c', ctrl: true }); };
  assert.equal(await helpScreen(terminal), 130);
  assert.equal(terminal.delays.length, 1); assert.equal(terminal.listening, false);
  assert.equal(terminal.writes.at(-1), '\x1b[?25h');
});

test('EOF stops the help animation and restores the terminal with a quit exit code', async () => {
  const terminal = new FakeTerminal();
  terminal.onDelay = () => { void terminal.press({ name: 'eof' }); };
  assert.equal(await helpScreen(terminal), 0);
  assert.equal(terminal.delays.length, 1); assert.equal(terminal.listening, false);
  assert.equal(terminal.writes.at(-1), '\x1b[?25h');
});

test('resize redraws the current frame and stops animation when the header no longer fits', async () => {
  const terminal = new FakeTerminal();
  terminal.onDelay = () => terminal.resize(60, 40);
  assert.equal(await helpScreen(terminal), 0);
  assert.equal(terminal.delays.length, 1);
  assert.doesNotMatch(terminal.writes.at(-2)!, /[.#]{8}/u);
});

test('the common help dispatcher draws only for interactive input and output without JSON', async () => {
  for (const [stdinIsTTY, stdoutIsTTY, stderrIsTTY, json] of [[false, true, true, false], [true, false, true, false], [true, true, false, false], [true, true, true, true], [true, true, true, false]] as const) {
    const terminal = new FakeTerminal(), output: string[] = [];
    const io: CliIo = { stdinIsTTY, stdoutIsTTY, stderrIsTTY, terminal, write: text => output.push(text), error: () => assert.fail('error'),
      question: async () => assert.fail('prompt'), close: () => {} };
    assert.equal(await writeHelp('', io, json), 0);
    if (stdinIsTTY && stdoutIsTTY && stderrIsTTY && !json) { assert.deepEqual(output, []); assert.ok(terminal.writes.length > 60); }
    else { assert.equal(output.join(''), SHORT_HELP); assert.deepEqual(terminal.writes, []); }
    output.length = 0; terminal.writes.length = 0;
    assert.equal(await writeHelp('explore', io, json), 0);
    assert.equal(output.join(''), helpText('explore')); assert.deepEqual(terminal.writes, []);
  }
});

test('the worker TTY help keeps screen bytes off its IPC stdout', async () => {
  const child = fork(new URL('../cli.mts', import.meta.url), ['help'], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'], timeout: 20_000,
    env: { ...process.env, CSSEARTH_TELESCOPE_STDIN_TTY: '1', CSSEARTH_TELESCOPE_STDOUT_TTY: '1', CSSEARTH_TELESCOPE_STDERR_TTY: '1' },
  });
  let stdout = '', stderr = '';
  const messages: unknown[] = [];
  child.stdout?.setEncoding('utf8').on('data', text => { stdout += text; });
  child.stderr?.setEncoding('utf8').on('data', text => { stderr += text; });
  child.on('message', message => messages.push(message));
  child.stdin?.end();
  const [code] = await once(child, 'close');
  assert.equal(code, 0, stderr);
  assert.equal(stdout, ''); assert.deepEqual(messages, []);
  assert.match(stderr, /Find observations and pick one/u); assert.match(stderr, /\x1b\[\?25h/u);
});

test('redirected worker stderr gets plain help over IPC even when stdin and stdout are TTYs', async () => {
  const child = fork(new URL('../cli.mts', import.meta.url), ['help'], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'], timeout: 20_000,
    env: { ...process.env, NODE_NO_WARNINGS: '1', CSSEARTH_TELESCOPE_STDIN_TTY: '1', CSSEARTH_TELESCOPE_STDOUT_TTY: '1', CSSEARTH_TELESCOPE_STDERR_TTY: '0' },
  });
  let stdout = '', stderr = '';
  const messages: unknown[] = [];
  child.stdout?.setEncoding('utf8').on('data', text => { stdout += text; });
  child.stderr?.setEncoding('utf8').on('data', text => { stderr += text; });
  child.on('message', message => messages.push(message)); child.stdin?.end();
  const [code] = await once(child, 'close');
  assert.equal(code, 0, stderr); assert.equal(stdout, ''); assert.equal(stderr, '');
  assert.deepEqual(messages, [{ text: SHORT_HELP }]);
});

test('guided dispatch requires stdin, stdout and the stderr drawing surface to be terminals', () => {
  const tty = { stdinIsTTY: true, stdoutIsTTY: true, stderrIsTTY: true };
  assert.equal(guided({ json: false }, tty), true);
  for (const io of [{ ...tty, stdinIsTTY: false }, { ...tty, stdoutIsTTY: false },
    { ...tty, stderrIsTTY: false }, { stdinIsTTY: true, stdoutIsTTY: true }]) {
    assert.equal(guided({ json: false }, io), false);
  }
  assert.equal(guided({ json: true }, tty), false);
});
