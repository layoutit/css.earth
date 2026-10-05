/** Dependency-free cross-step supervisor: install before loading the dependency-bearing lane. */
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
export interface LaunchOptions { head: string; base: string; out: string; archive: string; ready: string; state: string }
export type WorkerRun = (program: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<number>;
const run: WorkerRun = (program, args, cwd, env) => new Promise((accept, reject) => {
  const child = spawn(program, args, { cwd, env, stdio: 'inherit' });
  child.once('error', reject); child.once('exit', code => accept(code ?? 2));
});
export async function worker(options: LaunchOptions, execute: WorkerRun = run): Promise<number> {
  let code = 2;
  try {
    code = await execute('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], options.head, process.env);
    if (!code) code = await execute(process.execPath, [join(options.head, '.github/scripts/build-compare/ci.mts'), '--head', options.head, '--base', options.base, '--out', options.out, '--base-cache', options.archive, '--cache-ready', options.ready], options.head, { ...process.env, HEAD_INSTALLED: 'true' });
  } catch (error) { console.error(error); code = 2; }
  await writeFile(join(options.state, 'exit'), `${code}\n`);
  return code;
}
export async function launch(options: LaunchOptions): Promise<void> {
  await mkdir(options.state, { recursive: true });
  const log = openSync(join(options.state, 'lane.log'), 'w');
  try {
    const args = [resolve(import.meta.filename), '--worker', ...Object.entries(options).flatMap(([key, value]) => [`--${key}`, value])];
    const child = spawn(process.execPath, args, { cwd: options.head, env: process.env, detached: true, stdio: ['ignore', log, log] });
    await new Promise<void>((accept, reject) => { child.once('spawn', accept); child.once('error', reject); });
    await writeFile(join(options.state, 'pid'), `${child.pid}\n`);
    child.unref();
    console.log(`HEAD SUPERVISOR STARTED: ${child.pid}; terminal evidence required in ${join(options.state, 'exit')}`);
  } finally { closeSync(log); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { worker: { type: 'boolean' }, head: { type: 'string' }, base: { type: 'string' }, out: { type: 'string' }, archive: { type: 'string' }, ready: { type: 'string' }, state: { type: 'string' } } });
  if (!values.head || !values.base || !values.out || !values.archive || !values.ready || !values.state) throw new Error('Required: --head --base --out --archive --ready --state');
  const options: LaunchOptions = { head: resolve(values.head), base: resolve(values.base), out: resolve(values.out), archive: resolve(values.archive), ready: resolve(values.ready), state: resolve(values.state) };
  if (values.worker) process.exitCode = await worker(options); else await launch(options);
}
