/** Probe the real preview's prepared-file HTTP middleware through the supervised host boundary. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { object } from './model.mts';
export async function preparedProbe(root: string): Promise<void> {
  const child = spawn(process.execPath, [resolve(import.meta.dirname, 'host.mts'), 'preview', resolve(root, 'dist')], { cwd: root, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let log = '';
  child.stderr?.on('data', chunk => { log += String(chunk); });
  const pending = () => new Promise<Record<string, unknown>>((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Prepared host timed out: ${log}`)), 120_000);
    const done = (message: unknown) => { clearTimeout(timeout); child.removeListener('exit', ended); const value = object(message); if (value.error) reject(new Error(String(value.error))); else accept(value); };
    const ended = (code: number | null) => { clearTimeout(timeout); child.removeListener('message', done); reject(new Error(`Prepared host exited ${String(code)}: ${log}`)); };
    child.once('message', done); child.once('exit', ended);
  });
  try {
    assert.equal((await pending()).ready, true);
    const ask = async (headers: Record<string, string>) => {
      const result = pending(); child.send(JSON.stringify({ path: '/src/objects/earth/prepared/runtime.json', method: 'GET', headers: { 'Accept-Encoding': 'identity', ...headers } })); return result;
    };
    const plain = await ask({}), ranged = await ask({ Range: 'bytes=0-63' });
    assert.equal(plain.status, 200); assert.equal(ranged.status, 200, 'Prepared middleware currently ignores Range');
    assert.equal(typeof plain.bytes, 'string'); assert.equal(ranged.bytes, plain.bytes);
    assert.ok(typeof plain.bytes === 'string' && Buffer.from(plain.bytes, 'base64').length > 64);
    console.log('Prepared HTTP middleware: Range ignored; two identical 200 bodies');
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null && child.signalCode === null) await new Promise<void>(accept => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); accept(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); accept(); });
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await preparedProbe(process.cwd()); } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
