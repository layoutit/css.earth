/** MAST access and the pinned-toolchain Python runner shared by the JWST routes: time series (reduce-tso.mts) and imaging
 * (imaging/). Astroquery owns MAST queries and complete-file downloads. cssEarth owns byte validation and the reducers.
 * Python reducers run under a resident-memory ceiling: the run is killed, not the machine. */
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256File } from '../../../src/platform/sha256.mts';
import { requireRecord, requireString } from '../../source-values.mts';
import { astroquery, astroqueryRows } from '../astroquery/client.mts';
import type { EurekaToolchain } from './toolchain.mts';

export const MAST_CACHE = resolve(import.meta.dirname, '../../../output/archive-cache/mast');
/** Canonical MAST file URL, retained for provenance and bounded FITS-header range reads only. */
export const mastDownloadUrl = (uri: string) => `https://mast.stsci.edu/api/v0.1/Download/file?uri=${uri}`;

export interface MastFile { readonly name: string; readonly uri: string; readonly bytes: number; readonly sha256?: string }

const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
export const exists = (path: string) => access(path).then(() => true, () => false);
/** The file at its pinned size (and digest, when pinned) in `directory`: linked from a source directory that already has it,
 * or downloaded by Astroquery's MAST client. cssEarth checks the size and optional digest after the client returns. */
export async function mastFile(file: MastFile, directory: string, sources: readonly string[] = []): Promise<string> {
  if (!/^[A-Za-z0-9._-]+$/u.test(file.name)) throw new TypeError(`Invalid MAST file name: ${file.name}`);
  await mkdir(directory, { recursive: true });
  const target = resolve(directory, file.name);
  if (await sizeOf(target) !== file.bytes) for (const source of sources) {
    const candidate = resolve(source, file.name);
    if (await sizeOf(candidate) === file.bytes) { await rm(target, { force: true }); await symlink(candidate, target); break; }
  }
  if (await sizeOf(target) !== file.bytes) {
    await rm(target, { force: true });
    await astroquery({ operation: 'mast-download', uri: file.uri, destination: target });
  }
  if (await sizeOf(target) !== file.bytes) throw new Error(`${file.name} did not download to its pinned ${file.bytes} bytes.`);
  if (file.sha256 !== undefined && (await sha256File(target)).sha256 !== file.sha256) throw new Error(`${file.name} differs from its pinned sha256.`);
  return target;
}

/** One MAST request through Astroquery. Existing callers retain the MAST service vocabulary while no longer own its protocol. */
export async function mastRequest(request: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const service = requireString(request.service, 'MAST service'), parameters = requireRecord(request.params, 'MAST parameters');
  const pagesize = request.pagesize === undefined ? undefined : Number(request.pagesize), page = request.page === undefined ? undefined : Number(request.page);
  if (pagesize !== undefined && (!Number.isSafeInteger(pagesize) || pagesize <= 0)) throw new TypeError('MAST pagesize must be a positive integer.');
  if (page !== undefined && (!Number.isSafeInteger(page) || page <= 0)) throw new TypeError('MAST page must be a positive integer.');
  return [...await astroqueryRows({ operation: 'mast-service', service, parameters, ...(pagesize === undefined ? {} : { pagesize }), ...(page === undefined ? {} : { page }) })];
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
