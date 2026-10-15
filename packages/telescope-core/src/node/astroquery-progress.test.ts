import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { ChildProcess } from 'node:child_process';
import * as processes from 'node:child_process';
import { PassThrough } from 'node:stream';
import { withDownloadProgress, type DownloadProgress } from './download-progress.js';

let child: ChildProcess, input = '';
mock.module('node:child_process', { namedExports: { ...processes, spawn: () => {
  child = new ChildProcess(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin.on('data', chunk => { input += String(chunk); });
  return child;
} } });
const { runAstroqueryProcess } = await import('./astroquery.js');
test('worker transport consumes split progress lines without stderr noise and forwards cancellation to discovery too', async () => {
  const events: DownloadProgress[] = [], controller = new AbortController();
  const pending = withDownloadProgress({ report: event => events.push(event), signal: controller.signal, retainPartial: true },
    () => runAstroqueryProcess('fixture-python', {}, { operation: 'vo-download', url: 'https://fixture.test', destination: '/science', byteLimit: 10, parameters: {} }));
  child!.stderr!.emit('data', 'VO prog'); child!.stderr!.emit('data', 'ress: {"received":4,"total":10}\nVO progress: {"received":10,"total":10,"checking":true}\n');
  child!.stdout!.emit('data', '{"finished":true}'); child!.emit('close', 0);
  assert.deepEqual(await pending, { finished: true }); assert.deepEqual(events, [{ received: 4, total: 10, checking: false }, { received: 10, total: 10, checking: true }]);
  assert.equal(JSON.parse(input).retainPartial, true); assert.equal(JSON.parse(input).progress, true);
  const discovery = withDownloadProgress({ report: () => {}, signal: controller.signal, retainPartial: false },
    () => runAstroqueryProcess('fixture-python', {}, { operation: 'vo-tap', service: 'https://fixture.test', query: 'fixture', maxrec: 1, directory: '/fixture', byteLimit: 10 }));
  let killed = false;
  child!.kill = () => { killed = true; child!.emit('close', null); return true; };
  const rejected = assert.rejects(discovery, /stop/u); controller.abort(new Error('stop')); await rejected; assert.equal(killed, true);
});
