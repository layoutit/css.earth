import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { bold, breadcrumb, clipLine, cut, dim, green, inverse, pad, plain, red, visibleWidth, wrap, yellow } from './style.mts';
import { liveBlock } from './live-block.mts';
import { FakeTerminal } from './fake-terminal.mts';
import { ENTER_SCREEN, LEAVE_SCREEN, processTerminal } from './terminal.mts';
import { screenFrame } from './screen.mts';
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

test('alternate sessions restore the normal buffer, cursor, input mode and listeners on close and process exit', () => {
  for (const exit of [false, true]) {
    const input = new Input(), output = new Output(), lifecycle = new EventEmitter();
    input.pause();
    const close = processTerminal(input, output, lifecycle).listen(() => {}, () => {}, { alternateScreen: true });
    assert.equal(input.isRaw, true);
    if (exit) lifecycle.emit('exit');
    else close();
    close();
    assert.equal(output.read().toString(), ENTER_SCREEN + LEAVE_SCREEN);
    assert.equal(input.isRaw, false); assert.equal(input.isPaused(), true);
    assert.equal(input.listenerCount('keypress'), 0); assert.equal(output.listenerCount('resize'), 0);
    assert.equal(lifecycle.listenerCount('exit'), 0); assert.equal(lifecycle.listenerCount('SIGINT'), 0);
    assert.equal(lifecycle.listenerCount('SIGTERM'), 0);
    input.destroy(); output.destroy();
  }
});

test('a raw-mode startup error restores the alternate buffer and listeners', () => {
  class RefusedInput extends Input {
    override setRawMode(enabled: boolean): this {
      if (enabled) throw new Error('raw refused');
      return super.setRawMode(enabled);
    }
  }
  const input = new RefusedInput(), output = new Output(), lifecycle = new EventEmitter();
  assert.throws(() => processTerminal(input, output, lifecycle).listen(() => {}, () => {}, { alternateScreen: true }), /raw refused/u);
  assert.equal(output.read().toString(), ENTER_SCREEN + LEAVE_SCREEN);
  assert.equal(input.listenerCount('keypress'), 0); assert.equal(lifecycle.listenerCount('exit'), 0);
  input.destroy(); output.destroy();
});

test('alternate frames home the cursor, erase tails and below, and never scroll at one row', () => {
  const terminal = new FakeTerminal(8, 1);
  terminal.write('prior');
  const close = terminal.listen(() => {}, () => {}, { alternateScreen: true });
  terminal.write(screenFrame(['long line here', 'outside window'], 8, 1));
  assert.deepEqual(terminal.screen, ['long li…']);
  terminal.write(screenFrame(['short'], 8, 1));
  assert.deepEqual(terminal.screen, ['short']);
  assert.deepEqual(terminal.scrollback, []);
  close(); assert.deepEqual(terminal.screen, ['prior']);
});

test('line clipping counts terminal cells, preserves ANSI, and never splits a grapheme', () => {
  assert.equal(clipLine(bold('abcdefgh'), 4), '\x1b[1mabc…\x1b[0m');
  assert.equal(clipLine(dim('fits'), 4), dim('fits'));
  assert.equal(visibleWidth('界e\u0301🪐'), 5);
  assert.equal(plain(clipLine(bold('界e\u0301🪐tail'), 4)), '界e\u0301…');
  assert.equal(plain(clipLine('界界', 2)), '…');
  assert.equal(clipLine('anything', 0), '');
  assert.equal(plain(clipLine('ab\ncd\tEF', 5)), 'ab c…');
});

test('the fake terminal models physical wrapping rather than just recording writes', () => {
  const terminal = new FakeTerminal(4, 10);
  terminal.write('abcdefghij\nnext');
  assert.deepEqual(terminal.screen, ['abcd', 'efgh', 'ij', 'next']);
  assert.equal(terminal.wraps, 2);
  terminal.resize(8, 10);
  assert.deepEqual(terminal.screen, ['abcdefgh', 'ij', 'next']);
});

test('normal-buffer scrollback survives viewport erasure and returns on expansion', () => {
  const terminal = new FakeTerminal(120, 40);
  const old = Array.from({ length: 20 }, (_, index) => `old row ${index}`);
  terminal.write(old.join('\n') + '\n');
  terminal.resize(63, 10);
  assert.deepEqual(terminal.scrollback, old.slice(0, 11));
  terminal.write('\x1b[H\x1b[Jfinal\n');
  assert.deepEqual(terminal.screen, ['final', '', '', '', '', '', '', '', '', '']);
  terminal.resize(120, 40);
  assert.deepEqual(terminal.screen, [...old.slice(0, 11), 'final', '', '', '', '', '', '', '', '', '']);
});

test('all live and final lines are clipped centrally so the retained block cannot wrap', () => {
  const terminal = new FakeTerminal(8, 10), block = liveBlock(terminal);
  block.draw([bold('abcdefghijk'), 'second line']);
  assert.deepEqual(terminal.screen, ['abcdefg…', 'second …', '']);
  block.draw(['short']);
  assert.equal(terminal.screen.filter(Boolean).join('\n'), 'short');
  assert.equal(terminal.wraps, 0); block.done();
  const small = new FakeTerminal(8, 2), final = liveBlock(small);
  final.draw(['abcdefghijk', 'second line']); final.done(['abcdefghijk', 'second line']);
  assert.equal(small.wraps, 0);
  assert.match(small.writes.join(''), /abcdefg…/u);
});

test('resize rewinds reflowed physical rows, erases from the block start, and preserves preceding output', () => {
  const terminal = new FakeTerminal(20, 20);
  terminal.write('prior command\n');
  const block = liveBlock(terminal);
  block.draw(['abcdefghijklmnop', 'old panel tail', 'last old row']);
  terminal.resize(8, 20); block.draw(['new first', 'new last']);
  assert.equal(terminal.writes.at(-1), '\x1b[6F\x1b[Jnew fir…\x1b[0m\x1b[K\nnew last\x1b[K\n');
  assert.equal(terminal.screen.join('\n').trimEnd(), 'prior co\nmmand\nnew fir…\nnew last');
  terminal.resize(20, 20); block.draw(['expanded']);
  assert.equal(terminal.screen.join('\n').trimEnd(), 'prior command\nexpanded');
  assert.equal(terminal.wraps, 0); block.done();
  assert.ok(!terminal.writes.join('').includes('\x1b[2J'));
});
