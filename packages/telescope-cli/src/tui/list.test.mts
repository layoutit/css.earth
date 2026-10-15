import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeTerminal } from './fake-terminal.mts';
import { listScreen, renderList, writeList, type ListSpec } from './list.mts';
import { bold, dim, plain } from './style.mts';
import type { CliIo } from '../cli-io.mts';

const rows = Array.from({ length: 30 }, (_, index) => `item ${String(index + 1).padStart(2, '0')}`);
function fixture(open: (row: string) => string | Promise<string> = () => 'Opened in browser'): ListSpec<string> {
  return { title: bold('Papers'), crumbs: ['telescope', 'papers'], columns: [{ head: 'Title', width: 12, get: row => row }],
    rows, text: row => row, panel: row => ['DETAIL', row, ...Array.from({ length: 20 }, (_, index) => `panel ${index}`)],
    enter: { label: 'open', run: open }, plain: row => row };
}
const latest = (terminal: FakeTerminal) => plain(terminal.writes.filter(text => text.includes('↑↓ scroll')).at(-1) ?? '');

test('the pure list matches table, fixed panel, search cursor, breadcrumb and range layout', () => {
  const lines = renderList(fixture(), { query: '', active: 0, opened: new Map() }, 80);
  assert.equal(lines.length, 20);
  assert.equal(plain(lines[4]!), '    Title           DETAIL');
  assert.equal(plain(lines[5]!), ' > item 01          item 01');
  assert.equal(plain(lines[17]!), '                    panel 11');
  assert.ok(lines.at(-1)!.startsWith('/ \x1b[7m \x1b[27m'));
  assert.match(plain(lines.at(-1)!), /1–12 of 30 · ↑↓ scroll · enter open · esc quit/u);
  const narrow = renderList(fixture(), { query: 'item 02', active: 0, opened: new Map() }, 63);
  assert.equal(narrow.length, 19); assert.doesNotMatch(narrow.join(''), /DETAIL/u);
  assert.match(narrow[0]!, /\x1b\[1m“item 02”\x1b\[22m/u);
  assert.match(plain(narrow.at(-1)!), /1 match · 1–1 of 1/u);
});

test('scripted arrows, pages, search, Enter and Escape leave an opened row in the same list', async () => {
  const terminal = new FakeTerminal(), opened: string[] = [];
  const running = listScreen(fixture(row => { opened.push(row); return 'Opened in browser'; }), terminal);
  await terminal.press({ name: 'pagedown' }); assert.match(latest(terminal), / > item 13/u);
  await terminal.press({ name: 'pageup' }, { name: 'down' }, { name: 'up' }); assert.match(latest(terminal), / > item 01/u);
  await terminal.press({ text: 'item 02' }, { name: 'return' });
  assert.deepEqual(opened, ['item 02']); assert.match(latest(terminal), /✓> item 02/u);
  assert.match(latest(terminal), /Opened in browser/u); assert.equal(terminal.listening, true);
  await terminal.press({ name: 'backspace' }); assert.match(latest(terminal), /12 match/u);
  terminal.resize(63, 40); assert.doesNotMatch(latest(terminal), /DETAIL/u);
  await terminal.press({ name: 'escape' }); assert.equal(await running, 0);
  assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), '\x1b[?25h');
});

test('empty matches clamp navigation and Enter has no action', async () => {
  const terminal = new FakeTerminal(), opened: string[] = [];
  const running = listScreen(fixture(row => { opened.push(row); return 'opened'; }), terminal);
  await terminal.press({ text: 'missing' }, { name: 'down' }, { name: 'pagedown' }, { name: 'return' });
  assert.match(latest(terminal), /no match/u); assert.match(latest(terminal), /0 match · 0 ·/u);
  assert.deepEqual(opened, []);
  await terminal.press({ name: 'c', ctrl: true }); assert.equal(await running, 130);
  assert.equal(terminal.listening, false);
});

test('a failed Enter action restores the terminal and propagates its error', async () => {
  const terminal = new FakeTerminal();
  const running = listScreen(fixture(async () => { throw new Error('browser failed'); }), terminal);
  const rejected = assert.rejects(running, /browser failed/u);
  await terminal.press({ name: 'return' }); await rejected;
  assert.equal(terminal.listening, false); assert.equal(terminal.writes.at(-1), '\x1b[?25h');
});

test('list fallback never acquires a terminal for pipes, non-TTY input or JSON', async () => {
  for (const [stdinIsTTY, stdoutIsTTY, json] of [[false, true, false], [true, false, false], [true, true, true]]) {
    const terminal = new FakeTerminal(), output: string[] = [];
    const io: CliIo = { stdinIsTTY: stdinIsTTY!, stdoutIsTTY: stdoutIsTTY!, terminal, write: text => output.push(text),
      error: () => assert.fail('stderr'), question: async () => assert.fail('prompt'), close: () => {} };
    assert.equal(await writeList(fixture(), io, json!), 0);
    assert.equal(output.join(''), ['Papers', ...rows].join('\n') + '\n');
    assert.deepEqual(terminal.writes, []);
  }
});
