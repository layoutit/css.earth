/** Qualify current restored build and reversible mutations of ignored build outputs only. */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { command } from './clone-restore.mts';
import { readDeploymentConfig } from './deployment-config.mts';
import { serialise } from './model.mts';
const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (!values.out) throw new Error('Usage: qualify.mts --out <new evidence directory>');
const out = resolve(values.out), runner = import.meta.dirname;
await mkdir(out, { recursive: true });
let running: ReturnType<typeof spawn> | undefined;
let interrupted = false;
const stop = () => { interrupted = true; running?.kill('SIGTERM'); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
const results: { stage: string; exit: number; seconds: number }[] = [];
async function run(stage: string, file: string, args: string[], expected = 0) {
  if (interrupted) throw new Error('Qualification interrupted');
  console.log(`${stage}: starting`);
  const start = performance.now();
  const result = await new Promise<{ exit: number; log: string }>((accept, reject) => {
    const child = spawn(process.execPath, [resolve(runner, file), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    running = child;
    let log = '';
    child.stdout.on('data', chunk => { log += String(chunk); }); child.stderr.on('data', chunk => { log += String(chunk); });
    const watch = setInterval(() => console.log(`${stage}: running`), 30_000);
    const limit = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); }, 180_000);
    child.once('error', reject);
    child.once('exit', code => { running = undefined; clearInterval(watch); clearTimeout(limit); accept({ exit: code ?? 2, log }); });
  });
  const entry = { stage, exit: result.exit, seconds: Number(((performance.now() - start) / 1000).toFixed(2)) };
  results.push(entry); await writeFile(resolve(out, `${stage}.log`), result.log);
  await writeFile(resolve(out, 'results.json'), serialise(results)); console.log(`${stage}: exit ${entry.exit}, ${entry.seconds}s`);
  if (result.exit !== expected) throw new Error(`${stage}: wanted ${expected}; ${result.log.slice(-1500)}`);
}
const record = (target: string, label: string, expected = 0) => run(`${target}-${label}-record`, 'record.mts', ['--target', target, '--dist', 'dist', '--out', resolve(out, target, label)], expected);
const diff = (target: string, label: string, expected: number) => run(`${target}-${label}-diff`, 'diff.mts', ['--base', resolve(out, target, 'base'), '--head', resolve(out, target, label), '--summary'], expected);
async function mutation(label: string, target: string, file: string, from: string, to: string) {
  if ((await command('git', ['ls-files', '--', file], process.cwd())).trim()) throw new Error(`Refusing mutation of tracked input ${file}`);
  const original = await readFile(file, 'utf8');
  if (!original.includes(from)) throw new Error(`Mutation anchor missing: ${label}`);
  try { await writeFile(file, original.replace(from, to)); await record(target, label); await diff(target, label, 1); }
  finally { await writeFile(file, original); }
}
const config = await readDeploymentConfig(process.cwd());
try {
  for (const target of ['preview', 'netlify', 'cloudflare']) {
    await record(target, 'base'); await run(`${target}-base-check`, 'check.mts', ['--recorded', resolve(out, target, 'base')]);
    await record(target, 'repeat'); await diff(target, 'repeat', 0);
  }
  await mutation('static-byte', 'preview', 'dist/earth/index.html', '<!DOCTYPE html>', '<!DOCTYPE htmL>');
  const bundle = `${config.functionsDirectory}/search.mjs`;
  await mutation('handler-rewrite', 'netlify', bundle, 'html.slice(0, start) + document2.body.innerHTML', 'html.slice(0, start) + "<!-- L2 rewrite mutation -->" + document2.body.innerHTML');
  await mutation('header', 'netlify', bundle, 'headers.set("cache-control", "private, no-store")', 'headers.set("cache-control", "public, max-age=9")');
  await mutation('status', 'netlify', `${config.functionsDirectory}/find.mjs`, 'return json({ error: "Pass object=<body id>." }, 400)', 'return json({ error: "Pass object=<body id>." }, 401)');
  await mutation('body', 'netlify', `${config.functionsDirectory}/find.mjs`, 'Pass object=<body id>.', 'Deliberately changed response.');
  const file = 'src/objects/observable-universe/prepared/world-index.json';
  await rename(file, file + '.l2-mutation');
  try { await record('netlify', 'missing-closure', 2); }
  finally { await rename(file + '.l2-mutation', file); }
  for (const target of ['preview', 'netlify']) { await record(target, 'restored'); await diff(target, 'restored', 0); }
} catch (error) { console.error(String(error)); process.exitCode = 2; }
