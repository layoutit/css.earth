import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { bold, breadcrumb, cut, dim, green, inverse, pad, plain, red, visibleWidth, wrap, yellow } from './style.mts';
import { liveBlock } from './live-block.mts';
import { FakeTerminal } from './fake-terminal.mts';
import { processTerminal } from './terminal.mts';
import { VERSION } from '../version.mts';

test('styles, visible widths and breadcrumbs retain the mock punctuation and ANSI boundaries', () => {
  assert.equal(visibleWidth(bold('µ –')), 3);
  assert.equal(pad(dim('µ–'), 4), '\x1b[2mµ–\x1b[22m  ');
  assert.equal(cut('abcdefgh', 4), 'abc…');
  assert.deepEqual(wrap('one two three', 7), ['one two', 'three']);
  assert.equal(green('✓'), '\x1b[32m✓\x1b[39m');
  assert.equal(yellow('x'), '\x1b[33mx\x1b[39m');
  assert.equal(red('x'), '\x1b[31mx\x1b[39m');
  assert.equal(inverse(' '), '\x1b[7m \x1b[27m');
  assert.equal(breadcrumb(['telescope', 'A', 'B']),
    dim('telescope') + dim(' › ') + dim('A') + dim(' › ') + bold('B') + dim(`   v${VERSION}`));
});

test('the live block erases old tails and returns below the shorter block', () => {
  const terminal = new FakeTerminal(), block = liveBlock(terminal);
  block.draw(['long first', 'second', 'third']); block.draw(['short']); block.draw(['again']); block.done();
  assert.deepEqual(terminal.writes, ['\x1b[?25l', 'long first\x1b[K\nsecond\x1b[K\nthird\x1b[K\n',
    '\x1b[3Fshort\x1b[K\n\x1b[2K\n\x1b[2K\n\x1b[2F', '\x1b[1Fagain\x1b[K\n', '\x1b[?25h']);
  assert.ok(!terminal.writes.join('').includes('\x1b[2J'));
});

test('a block at least as tall as the window prints only its final state', () => {
  const terminal = new FakeTerminal(80, 2), block = liveBlock(terminal);
  block.draw(['first', 'state']); block.draw(['second', 'state']);
  assert.deepEqual(terminal.writes, ['\x1b[?25l']);
  block.done(['final', 'state']); block.done(['duplicate']);
  assert.deepEqual(terminal.writes, ['\x1b[?25l', 'final\nstate\n', '\x1b[?25h']);
});

class Input extends PassThrough {
  isRaw = false;
  setRawMode(enabled: boolean): this { this.isRaw = enabled; return this; }
}
class Output extends PassThrough { columns = 91; rows = 32; }

test('the real terminal adapter uses its writer and restores raw mode, pause state and listeners', async () => {
  const input = new Input(), output = new Output(), lifecycle = new EventEmitter();
  input.pause();
  const terminal = processTerminal(input, output, lifecycle), keys: string[] = [];
  let resizes = 0;
  const close = terminal.listen(key => keys.push(key.ctrl ? 'interrupt' : key.name ?? ''), () => { resizes++; });
  assert.equal(input.isRaw, true); assert.equal(input.isPaused(), false);
  input.emit('keypress', undefined, { name: 'down' }); output.emit('resize'); lifecycle.emit('SIGINT');
  terminal.write('screen');
  assert.deepEqual(keys, ['down', 'interrupt']); assert.equal(resizes, 1);
  assert.equal(terminal.columns, 91); assert.equal(terminal.rows, 32);
  close(); close();
  assert.equal(input.isRaw, false); assert.equal(input.isPaused(), true);
  assert.equal(input.listenerCount('keypress'), 0); assert.equal(output.listenerCount('resize'), 0);
  assert.equal(lifecycle.listenerCount('SIGINT'), 0); assert.equal(lifecycle.listenerCount('exit'), 0);
  assert.equal(output.read().toString(), 'screen\x1b[?25h');
  await assert.rejects(terminal.delay(50, AbortSignal.abort()));
  input.destroy(); output.destroy();
});

test('process exit restores a previously raw input without changing its original mode', () => {
  const input = new Input(), output = new Output(), lifecycle = new EventEmitter();
  input.setRawMode(true);
  processTerminal(input, output, lifecycle).listen(() => {}, () => {});
  lifecycle.emit('exit');
  assert.equal(input.isRaw, true); assert.equal(input.listenerCount('keypress'), 0);
  assert.equal(plain(output.read().toString()), '');
  input.destroy(); output.destroy();
});

test('closing a newly opened stdin stops the resumed stream from keeping the process alive', () => {
  const input = new Input(), output = new Output(), lifecycle = new EventEmitter();
  assert.equal(input.readableFlowing, null); assert.equal(input.isPaused(), false);
  const close = processTerminal(input, output, lifecycle).listen(() => {}, () => {});
  assert.equal(input.readableFlowing, true);
  close();
  assert.equal(input.readableFlowing, false); assert.equal(input.isRaw, false);
  input.destroy(); output.destroy();
});
