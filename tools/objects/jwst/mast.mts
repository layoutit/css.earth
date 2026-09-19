/** JWST runtime helpers and a compatibility re-export of the shared MAST boundary used by older JWST routes.
 * Astroquery owns MAST queries and complete-file downloads. cssEarth owns byte validation and the reducers.
 * Python reducers run under a resident-memory ceiling: the run is killed, not the machine. */
import { spawn, spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '../../source-values.mts';
import type { EurekaToolchain } from './toolchain.mts';

export { MAST_CACHE, exists, mastDownloadUrl, mastFile, mastRequest, mastService, type MastFile } from '../astronomy-packages/mast.mts';

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
