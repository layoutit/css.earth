/** Create a disposable sibling and supervise one local production build; never prepares or publishes assets. */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, writeFile, open, stat } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { apply } from './apply.mts';
const exec = promisify(execFile);
const id = process.argv[2];
if (!id || !/^[a-z0-9-]+$/u.test(id)) throw new Error('Expected control or breakage id');
const source = process.cwd(), copy = resolve(dirname(source), basename(source) + '-proof-' + id);
const evidence = resolve(source, 'output/journeys/builds', id);
await mkdir(evidence, { recursive: true }); await mkdir(copy);
for (const name of await readdir(source)) {
  if (['dist', 'output', 'node_modules'].includes(name)) continue;
  await exec('cp', ['-cR', resolve(source, name), resolve(copy, name)]);
}
await exec('cp', ['-cR', resolve(source, 'node_modules'), resolve(copy, 'node_modules')]);
await mkdir(resolve(copy, 'output/tmp'), { recursive: true });
if (id !== 'control') await apply(copy, id);
const at = Date.now(), log = await open(resolve(evidence, 'build.log'), 'w');
await writeFile(resolve(evidence, 'status.json'), JSON.stringify({ state: 'building', copy }));
const child = spawn('pnpm', ['exec', 'astro', 'build', '--config', 'site/astro.config.mts', '--outDir', 'dist-proof'], { cwd: copy,
  env: { ...process.env, TMPDIR: resolve(copy, 'output/tmp'), NODE_OPTIONS: '--max-old-space-size=6144', ASTRO_TELEMETRY_DISABLED: '1', TELEMETRY_DISABLED: '1' },
  detached: true, stdio: ['ignore', log.fd, log.fd] });
const stop = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already closed. */ } } };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const deadline = setTimeout(stop, 15 * 60 * 1000);
let code: number | null;
try { code = await new Promise<number | null>((done, reject) => { child.once('error', reject); child.once('close', done); }); }
finally { clearTimeout(deadline); await log.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
const html = await stat(resolve(copy, 'dist-proof/milky-way/index.html')).catch(() => null);
const success = code === 0 && html !== null && html.size > 0;
await writeFile(resolve(evidence, 'status.json'), JSON.stringify({ state: success ? 'complete' : 'failed', code, copy,
  htmlBytes: html?.size ?? 0, seconds: (Date.now() - at) / 1000 }, null, 2));
if (!success) process.exitCode = 1;
