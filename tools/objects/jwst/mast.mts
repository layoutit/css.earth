/** MAST access and the pinned-toolchain Python runner shared by the JWST routes: time series (reduce-tso.mts) and imaging
 * (imaging/). A file is taken from a local source when one already holds it at its pinned size, otherwise downloaded with curl,
 * which resumes a partial transfer. Python runs under a resident-memory ceiling: the run is killed, not the machine. */
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256File } from '../../../src/platform/sha256.mts';
import type { EurekaToolchain } from './toolchain.mts';

export const MAST_INVOKE = 'https://mast.stsci.edu/api/v0/invoke';
export const mastDownloadUrl = (uri: string) => `https://mast.stsci.edu/api/v0.1/Download/file?uri=${uri}`;

export interface MastFile { readonly name: string; readonly uri: string; readonly bytes: number; readonly sha256?: string }

const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
export const exists = (path: string) => access(path).then(() => true, () => false);
const run = (command: string, args: readonly string[]) => new Promise<number>(done => { spawn(command, args, { stdio: 'inherit' }).on('close', code => done(code ?? 1)); });

/** The file at its pinned size (and digest, when pinned) in `directory`: linked from a source directory that already has it,
 * or downloaded. MAST drops slow transfers, and one connection can crawl while others run at full speed: a transfer under
 * 500 kB/s for a minute is abandoned and resumed on a fresh connection from where the partial file ends, twenty times at most. */
export async function mastFile(file: MastFile, directory: string, sources: readonly string[] = []): Promise<string> {
  if (!/^[A-Za-z0-9._-]+$/u.test(file.name)) throw new TypeError(`Invalid MAST file name: ${file.name}`);
  await mkdir(directory, { recursive: true });
  const target = resolve(directory, file.name);
  if (await sizeOf(target) !== file.bytes) for (const source of sources) {
    const candidate = resolve(source, file.name);
    if (await sizeOf(candidate) === file.bytes) { await rm(target, { force: true }); await symlink(candidate, target); break; }
  }
  for (let attempt = 1; attempt <= 20 && await sizeOf(target) !== file.bytes; attempt++) {
    if (await sizeOf(target) > file.bytes) await rm(target);
    await run('curl', ['-s', '-L', '-C', '-', '--speed-limit', '500000', '--speed-time', '60', '-o', target, mastDownloadUrl(file.uri)]);
  }
  if (await sizeOf(target) !== file.bytes) throw new Error(`${file.name} did not download to its pinned ${file.bytes} bytes.`);
  if (file.sha256 !== undefined && (await sha256File(target)).sha256 !== file.sha256) throw new Error(`${file.name} differs from its pinned sha256.`);
  return target;
}

/** One MAST API request (https://mast.stsci.edu/api/v0/). */
export async function mastRequest(request: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const response = await fetch(MAST_INVOKE, { method: 'POST', body: new URLSearchParams({ request: JSON.stringify(request) }), signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`MAST request failed: ${response.status}`);
  const body = await response.json() as { data?: Record<string, unknown>[]; status?: string };
  if (!Array.isArray(body.data)) throw new Error(`MAST answered without data (${body.status ?? 'no status'}).`);
  return body.data;
}

/** The free-memory percentage macOS reports; a heavy stage does not start below half. */
export function freeMemoryPercent() {
  const output = spawnSync('memory_pressure', { encoding: 'utf8' }).stdout ?? '';
  const match = /free percentage: (\d+)%/u.exec(output);
  return match ? Number(match[1]) : Number.NaN;
}

/** Run an inline script with the toolchain's Python. The log keeps stdout and stderr; the last stdout line is returned. With
 * `maxRssBytes` the process is sampled every second and killed if its resident memory passes the ceiling, and the peak is
 * reported, so a run that would exhaust the machine fails instead. */
export async function toolchainPython(toolchain: EurekaToolchain, cwd: string, script: string, args: readonly string[], log: string,
  options: { maxRssBytes?: number } = {}): Promise<{ lastLine: string; peakRssBytes: number }> {
  const child = spawn(toolchain.python, ['-c', script, ...args], { cwd, env: { ...process.env, ...toolchain.env } });
  let output = '', stdout = '', peak = 0, killed = false;
  child.stdout.on('data', chunk => { output += String(chunk); stdout += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });
  const watch = setInterval(() => {
    const rss = Number(spawnSync('ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' }).stdout.trim()) * 1024;
    if (Number.isFinite(rss)) peak = Math.max(peak, rss);
    if (options.maxRssBytes !== undefined && rss > options.maxRssBytes && !killed) { killed = true; child.kill('SIGKILL'); }
  }, 1000);
  const status = await new Promise<number>(done => child.on('close', code => done(code ?? 1)));
  clearInterval(watch);
  await writeFile(log, output);
  if (killed) throw new Error(`Python ${args[0] ?? ''} passed its ${(options.maxRssBytes! / 2 ** 30).toFixed(1)} GiB memory ceiling and was stopped; see ${log}.`);
  if (status !== 0) throw new Error(`Python ${args[0] ?? ''} failed; see ${log}.`);
  return { lastLine: stdout.trim().split('\n').at(-1) ?? '', peakRssBytes: peak };
}
