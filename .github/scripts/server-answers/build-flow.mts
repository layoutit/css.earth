/** Build clean restored revisions and compare all server targets, retaining timed evidence. */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildRevision } from './build-revision.mts';
import { readDeploymentConfig } from './deployment-config.mts';
import { cloneRestore, command, terminate } from './clone-restore.mts';

interface Measurement { stage: string; seconds: number; exit: number; command?: string[]; }
const source = process.cwd();
const { values } = parseArgs({ options: { out: { type: 'string' }, revision: { type: 'string', default: 'HEAD' }, 'head-ref': { type: 'string' }, 'compare-ref': { type: 'string' }, qualification: { type: 'boolean', default: false } } });
if (!values.out) throw new Error('Usage: build-flow.mts --out <new evidence directory> [--revision HEAD] [--compare-ref <head>] [--qualification] [--head-ref <empty commit>]');
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const measurements: Measurement[] = [];
const copies: string[] = [];
const disk: { stage: string; allocatedKiB: number; apparentKiB: number }[] = [];
async function measureDisk(stage: string, path: string): Promise<void> {
  const allocatedKiB = Number((await command('du', ['-sk', path], source)).split(/\s/u)[0]);
  const apparentKiB = Number((await command('du', process.platform === 'darwin' ? ['-Ask', path] : ['--apparent-size', '-sk', path], source)).split(/\s/u)[0]);
  if (!Number.isFinite(allocatedKiB) || !Number.isFinite(apparentKiB)) throw new Error('Invalid disk measurement');
  disk.push({ stage, allocatedKiB, apparentKiB });
  await writeFile(resolve(out, 'disk.json'), JSON.stringify(disk, null, 2) + '\n');
}
let running: ReturnType<typeof spawn> | undefined;
let interrupted = false;
const interrupt = () => { interrupted = true; if (running) terminate(running); };
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

async function stage(label: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (interrupted) throw new Error('Interrupted');
  const started = performance.now();
  const log = createWriteStream(resolve(out, `${label}.log`), { flags: 'wx' });
  console.log(`${label}: starting`);
  const code = await new Promise<number>((accept, reject) => {
    const child = spawn(args[0]!, args.slice(1), { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    running = child;
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const watch = setInterval(() => console.log(`${label}: running ${(performance.now() - started) / 1000 | 0}s`), 30_000);
    const deadline = setTimeout(() => { terminate(child); setTimeout(() => terminate(child, 'SIGKILL'), 5000).unref(); }, 15 * 60_000);
    const done = () => { clearInterval(watch); clearTimeout(deadline); running = undefined; log.end(); };
    child.once('error', error => { done(); reject(error); });
    child.once('exit', exit => { done(); accept(exit ?? 2); });
  });
  const measurement = { stage: label, command: args, seconds: Number(((performance.now() - started) / 1000).toFixed(2)), exit: code };
  measurements.push(measurement);
  await writeFile(resolve(out, 'measurements.json'), JSON.stringify({ revision: values.revision, headRef: values['head-ref'] ?? null, measurements }, null, 2) + '\n');
  console.log(`${label}: exit ${code}, ${measurement.seconds}s`);
  return code;
}

async function build(label: string, revision: string): Promise<string> {
  const destination = `${source}-server-answers-${process.pid}-${label}`;
  const started = performance.now();
  const restored = await cloneRestore(source, destination, revision);
  copies.push(destination);
  await measureDisk(`${label}-restored`, destination);
  measurements.push({ stage: `${label}-clone-restore`, seconds: Number(((performance.now() - started) / 1000).toFixed(2)), exit: 0 });
  await writeFile(resolve(out, `${label}-revision.json`), JSON.stringify(restored) + '\n');
  await buildRevision(destination, async (step, index, env) => {
    if (await stage(`${label}-build-${index}`, [process.env.SHELL ?? '/bin/sh', '-c', step], destination, env) !== 0) throw new Error(`${label}: build step failed: ${step}`);
  });
  await measureDisk(`${label}-built`, destination);
  const config = await readDeploymentConfig(destination);
  for (const path of ['dist/earth/index.html', config.workerMain]) {
    if ((await stat(resolve(destination, path))).size === 0) throw new Error(`${label}: empty build artifact ${path}`);
  }
  if (!(await readFile(resolve(destination, 'dist/earth/index.html'), 'utf8')).includes('https://assets.invalid')) throw new Error('Asset-origin build did not rewrite Earth HTML.');
  const recordingEnv = { ...process.env, NODE_OPTIONS: '--max-old-space-size=6144' };
  let failedTarget = false;
  for (const target of ['preview', 'cloudflare']) {
    const recording = resolve(out, label, target);
    const args = [process.execPath, resolve(import.meta.dirname, 'record.mts'), '--target', target, '--dist', 'dist', '--out', recording];
    if (await stage(`${label}-record-${target}`, args, destination, recordingEnv) !== 0) { failedTarget = true; continue; }
    if ((await stat(resolve(recording, 'index.json'))).size === 0) throw new Error(`${label} ${target} recorded no index.`);
    if (await stage(`${label}-check-${target}`, [process.execPath, resolve(import.meta.dirname, 'check.mts'), '--recorded', recording], destination, recordingEnv) !== 0) failedTarget = true;
  }
  if (failedTarget) throw new Error(`${label}: one or more targets failed recording or sanity; read the target logs.`);
  await rm(destination, { recursive: true, force: true });
  copies.splice(copies.indexOf(destination), 1);
  return label;
}

try {
  if (!values['compare-ref'] && !values.qualification) throw new Error('Choose --compare-ref or --qualification');
  const revision = (await command('git', ['rev-parse', `${values.revision}^{commit}`], source)).trim();
  await build('base', revision);
  if (values.qualification) await build('repeat', revision);
  let differences = 0;
  const comparisons: Record<string, number> = {};
  const compare = async (head: string) => {
    for (const target of ['preview', 'cloudflare']) {
      const code = await stage(`diff-${head}-${target}`, [process.execPath, resolve(import.meta.dirname, 'diff.mts'), '--base', resolve(out, 'base', target), '--head', resolve(out, head, target), '--summary'], source);
      differences = Math.max(differences, code);
      comparisons[`${head}-${target}`] = code;
    }
  };
  if (values.qualification) await compare('repeat');
  if (values['compare-ref']) { await build('head', values['compare-ref']); await compare('head'); }
  if (values['head-ref']) {
    if (!values.qualification) throw new Error('--head-ref requires --qualification');
    const head = (await command('git', ['rev-parse', `${values['head-ref']}^{commit}`], source)).trim();
    if (head === revision || (await command('git', ['diff', '--name-only', revision, head], source)).trim()) throw new Error('--head-ref must identify a distinct commit with the identical tracked tree.');
    const counts = await Promise.all([revision, head].map(ref => command('git', ['rev-list', '--count', ref], source)));
    if (counts[0] === counts[1]) throw new Error('--head-ref must have a different commit count to exercise version normalization.');
    await build('version', head);
    await compare('version');
  }

  await writeFile(resolve(out, 'result.json'), JSON.stringify({ revision, comparisons, sameRevision: values.qualification && Object.entries(comparisons).filter(([name]) => name.startsWith('repeat-')).every(([, code]) => code === 0), versionVariant: Boolean(values['head-ref']), assetOrigin: true, exit: differences, measurements }, null, 2) + '\n');
  process.exitCode = differences;
} catch (error) {
  console.error(String(error));
  process.exitCode = 2;
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ error: String(error), measurements }, null, 2) + '\n');
} finally {
  if (running) terminate(running);
  for (const copy of copies) await rm(copy, { recursive: true, force: true });
}
