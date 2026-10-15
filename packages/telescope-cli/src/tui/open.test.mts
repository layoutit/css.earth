import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test, mock } from 'node:test';
import type { SpawnOptions } from 'node:child_process';
import { openExternal } from './open.mts';

class Child extends EventEmitter {
  unreferenced = false;
  unref() { this.unreferenced = true; }
}

test('the opener starts the platform desktop command detached with ignored streams and never awaits it', () => {
  for (const [platform, expected] of [['darwin', 'open'], ['linux', 'xdg-open'], ['win32', 'cmd.exe']] as const) {
    const child = new Child(), calls: { command: string; args: readonly string[]; options: SpawnOptions }[] = [];
    const url = 'https://example.org/paper?q=a&other=%PATH%"test';
    const result = openExternal(url, platform, (command, args, options) => { calls.push({ command, args, options }); return child; });
    assert.equal(result, undefined); assert.equal(child.unreferenced, true);
    assert.equal(calls.length, 1);
    const call = calls[0]!;
    assert.equal(call.command, expected);
    assert.equal(call.options.detached, true); assert.equal(call.options.stdio, 'ignore');
    assert.equal(call.options.shell, undefined);
    if (platform === 'win32') {
      assert.deepEqual(call.args, ['/d', '/v:off', '/s', '/c', 'start', '""', '"%CSSEARTH_TELESCOPE_OPEN_TARGET%"']);
      assert.equal(call.options.env?.CSSEARTH_TELESCOPE_OPEN_TARGET, url.replaceAll('"', '%22'));
      assert.equal(call.options.windowsVerbatimArguments, true);
    } else assert.deepEqual(call.args, [url]);
  }
});

test('an unavailable desktop opener reports an asynchronous launch error without an unhandled event', () => {
  const child = new Child(), writes: string[] = [];
  const write = mock.method(process.stderr, 'write', (text: string) => { writes.push(text); return true; });
  try {
    openExternal('https://example.org/paper', 'linux', () => child);
    child.emit('error', new Error('ENOENT'));
    assert.deepEqual(writes, ['Could not open https://example.org/paper: ENOENT\n']);
  } finally { write.mock.restore(); }
});
