/** Opt-in share-cache measurement: real production commands, local Worker smoke, no publication. */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { finished } from 'node:stream/promises';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '../../..'), output = resolve(root, 'output/build-benchmark');
const writer = 'site/build/share-images.mts';
export type Role = 'seed' | 'baseline' | 'warm';
const roles: readonly Role[] = ['seed', 'baseline', 'warm'];
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function object(value: unknown): Record<string, unknown> { if (!record(value)) throw new TypeError('Expected benchmark object.'); return value; }
function text(value: unknown): string { if (typeof value !== 'string' || !value) throw new TypeError('Expected nonempty benchmark string.'); return value; }
function positive(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new TypeError('Expected positive benchmark count.'); return value; }
function sha(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{40}$/u.test(result)) throw new TypeError('Expected Git commit/blob identity.'); return result; }
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16e6 }).trim();
const blob = (bytes: Uint8Array) => createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');

export function requireOptIn(event: unknown, repository: string, head: string): { head: string; base: string } {
  const payload = object(event);
  if (payload.action === 'labeled' && object(payload.label).name !== 'compare-build') throw new Error('An unrelated label must not start another benchmark.');
  const pr = object(payload.pull_request), source = object(pr.head), target = object(pr.base);
  if (text(object(source.repo).full_name) !== repository || sha(source.sha) !== head ||
    !Array.isArray(pr.labels) || !pr.labels.some(label => object(label).name === 'compare-build')) throw new Error('Benchmark requires same-repository compare-build PR at its exact head.');
  return { head: sha(source.sha), base: sha(target.sha) };
}

export function requireSafeRecipe(pkg: unknown, env: NodeJS.ProcessEnv): void {
  if (Object.entries(env).some(([key, value]) => key.startsWith('CLOUDFLARE_') && value)) throw new Error('Benchmark must not receive Cloudflare credentials.');
  const scripts = object(object(pkg).scripts), seen = new Set<string>();
  function inspect(name: string): void {
    if (seen.has(name)) return; seen.add(name);
    const source = text(scripts[name]);
    if (/\b(?:wrangler|deploy:cloudflare(?:-preview)?|publish:[\w-]+|publish-(?:runtime-assets|source-cache))\b/u.test(source)) throw new Error('Benchmark recipe contains a publication command.');
    for (const match of source.matchAll(/\bpnpm ([a-z][a-z0-9:-]*)\b/gu)) if (scripts[match[1]!] !== undefined) inspect(match[1]!);
  }
  inspect('build:deploy'); inspect('check:deploy-assets');
}

export function shareCounts(log: string, role: Role): { written: number; rendered: number; reused: number } {
  const footer = [...log.matchAll(/Wrote (\d+) share images to dist\/social \([\d.]+ MB(?:; (\d+) rendered, (\d+) reused)?\)\./gu)].at(-1);
  if (!footer) throw new Error('Production build lacks a complete share-image footer.');
  const written = positive(Number(footer[1])), rendered = role === 'baseline' ? written : Number(footer[2]), reused = role === 'baseline' ? 0 : Number(footer[3]);
  if (!Number.isSafeInteger(rendered) || !Number.isSafeInteger(reused) || rendered < 0 || reused < 0 || rendered + reused !== written ||
    (role === 'warm' && (rendered !== 0 || reused !== written)) || (role === 'seed' && rendered === 0)) throw new Error('Share-image cold/warm proof failed.');
  return { written, rendered, reused };
}

export async function distIdentity(directory: string): Promise<{ files: number; bytes: number; htmlPages: number; gitBlob: string }> {
  const listing: { path: string; bytes: number; blob: string }[] = [];
  async function walk(prefix = ''): Promise<void> {
    for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) { const bytes = await readFile(join(directory, path)); listing.push({ path, bytes: bytes.length, blob: blob(bytes) }); }
      else throw new Error(`Nonregular deploy output: ${path}`);
    }
  }
  await walk(); if (!listing.length) throw new Error('Empty dist cannot establish output parity.');
  listing.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { files: listing.length, bytes: listing.reduce((total, file) => total + file.bytes, 0), htmlPages: listing.filter(file => file.path.endsWith('.html')).length, gitBlob: blob(Buffer.from(JSON.stringify(listing))) };
}

export function requireCacheMatch(matched: string, seed: string, primary: string): void {
  if (!seed || !primary || seed === primary || matched !== seed) throw new Error('Warm run must restore the exact seed under a distinct primary key.');
}
export function cacheProof(payload: unknown, key: string, ref: string): Record<string, unknown> | null {
  const caches = object(payload).actions_caches; if (!Array.isArray(caches)) throw new TypeError('Cache API response is incomplete.');
  for (const entry of caches) {
    const cache = object(entry);
    if (cache.key === key && cache.ref === ref && typeof cache.size_in_bytes === 'number' && cache.size_in_bytes > 0) {
      return { id: positive(cache.id), key, ref, sizeBytes: positive(cache.size_in_bytes), createdAt: text(cache.created_at) };
    }
  }
  return null;
}

async function api(path: string): Promise<unknown> {
  const token = text(process.env.BENCHMARK_TOKEN), repository = text(process.env.GITHUB_REPOSITORY);
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) throw new Error('Invalid benchmark repository.');
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/${path}`, { signal: AbortSignal.timeout(15000),
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) throw new Error(`Read-only benchmark API HTTP ${response.status}.`);
  return response.json();
}

async function verifySaved(key: string): Promise<Record<string, unknown>> {
  const ref = text(process.env.GITHUB_REF);
  for (let attempt = 0; attempt < 12; attempt++) {
    const proof = cacheProof(await api(`caches?key=${encodeURIComponent(key)}&ref=${encodeURIComponent(ref)}&per_page=100`), key, ref);
    if (proof) return proof;
    if (attempt < 11) await new Promise(accept => setTimeout(accept, 5000));
  }
  throw new Error('Cache save reported no exact nonempty entry after bounded polling.');
}

export function timingJobs(payload: unknown): Record<string, unknown>[] {
  const jobs = object(payload).jobs; if (!Array.isArray(jobs)) throw new TypeError('Missing jobs timing response.');
  return jobs.map(value => {
    const job = object(value); if (!Array.isArray(job.steps)) throw new TypeError('Missing job steps.');
    return { id: positive(job.id), name: text(job.name), startedAt: text(job.started_at),
      completedAt: job.completed_at, status: job.status, conclusion: job.conclusion, steps: job.steps.map(value => {
        const step = object(value); return { name: text(step.name), status: step.status, conclusion: step.conclusion, startedAt: step.started_at, completedAt: step.completed_at };
      }) };
  });
}

export function cacheTransferSeconds(values: readonly Record<string, unknown>[]): Record<string, number> {
  const required = ['Save seed share cache', 'Restore exact seed share cache', 'Save warm share cache'];
  const result: Record<string, number> = {};
  for (const name of required) {
    const step = values.flatMap(job => Array.isArray(job.steps) ? job.steps.map(object) : []).find(step => step.name === name);
    if (!step || step.conclusion !== 'success') throw new Error(`Cache transfer lacks completed success: ${name}.`);
    const seconds = (Date.parse(text(step.completedAt)) - Date.parse(text(step.startedAt))) / 1000;
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Cache transfer lacks real timestamps: ${name}.`);
    result[name] = seconds;
  }
  return result;
}

async function jobs(): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = timingJobs(await api(`runs/${positive(Number(process.env.GITHUB_RUN_ID))}/attempts/${positive(Number(process.env.GITHUB_RUN_ATTEMPT))}/jobs?per_page=100&page=${page}`));
    result.push(...batch); if (batch.length < 100) return result;
  }
  throw new Error('Benchmark jobs pagination exceeded its bound.');
}

export async function command(name: string, program: string, args: string[]): Promise<{ seconds: number; log: string }> {
  const start = performance.now(), path = resolve(output, `${name}.log`), stream = createWriteStream(path);
  let logError: unknown;
  const flushed = finished(stream).catch(error => { logError = error; });
  const env = { ...process.env }; delete env.BENCHMARK_TOKEN; delete env.GITHUB_TOKEN; delete env.GH_TOKEN; delete env.CSSEARTH_INCREMENTAL_BUILD;
  const child = spawn(program, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let last = '', timedOut = false;
  const consume = (bytes: Buffer) => { stream.write(bytes); process.stdout.write(bytes); last = bytes.toString().trim().split('\n').at(-1) ?? last; };
  child.stdout.on('data', consume); child.stderr.on('data', consume);
  const heartbeat = setInterval(() => console.log(`BENCHMARK ${name} ${((performance.now() - start) / 1000).toFixed(1)}s ${last.slice(0, 180)}`), 30000);
  let kill: NodeJS.Timeout | undefined;
  const deadline = setTimeout(() => { timedOut = true; const pid = child.pid; if (pid) { try { process.kill(-pid, 'SIGTERM'); } catch { /* already exited */ } kill = setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* already exited */ } }, 5000); } }, 1200000);
  let code: number | null;
  try {
    code = await new Promise<number | null>((accept, reject) => { child.once('error', reject); child.once('close', accept); });
  } finally {
    clearInterval(heartbeat); clearTimeout(deadline); if (kill) clearTimeout(kill);
    stream.end(); await flushed;
    if (logError) throw logError;
  }
  if (code !== 0 || timedOut) throw new Error(`${name} failed (${code}) or timed out.`);
  return { seconds: (performance.now() - start) / 1000, log: await readFile(path, 'utf8') };
}

async function emit(name: string, value: string): Promise<void> { if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); }
async function state(): Promise<Record<string, unknown>> { return object(JSON.parse(await readFile(resolve(output, 'result.json'), 'utf8'))); }
async function save(value: Record<string, unknown>): Promise<void> { await writeFile(resolve(output, 'result.json'), JSON.stringify(value, null, 2)); }

async function plan(role: Role): Promise<void> {
  const candidate = sha(process.env.BENCHMARK_HEAD), event: unknown = JSON.parse(await readFile(text(process.env.GITHUB_EVENT_PATH), 'utf8'));
  const selected = requireOptIn(event, text(process.env.GITHUB_REPOSITORY), candidate);
  if (git('rev-parse', 'HEAD') !== candidate) throw new Error('Benchmark checkout differs from candidate head.');
  requireSafeRecipe(JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')), process.env);
  const base = git('merge-base', candidate, selected.base);
  const nonce = `${text(process.env.RUNNER_OS)}-${text(process.env.RUNNER_ARCH)}-${candidate}-${positive(Number(process.env.GITHUB_RUN_ID))}-${positive(Number(process.env.GITHUB_RUN_ATTEMPT))}`;
  const seedKey = `share-build-v1-${nonce}-seed`, warmKey = `share-build-v1-${nonce}-warm`;
  await mkdir(output, { recursive: true });
  await save({ role, candidate, baseline: base, seedKey, warmKey });
  await emit('seed_key', seedKey); await emit('warm_key', warmKey);
}

async function run(role: Role): Promise<void> {
  const result = await state(); if (result.role !== role || git('rev-parse', 'HEAD') !== result.candidate) throw new Error('Benchmark role/head changed.');
  const cache = resolve(root, 'output/share-image-cache');
  if (role === 'warm') requireCacheMatch(text(process.env.BENCHMARK_MATCHED_KEY), text(result.seedKey), text(result.warmKey));
  else { try { if ((await readdir(cache)).length) throw new Error('Cold job received ambient share cache.'); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; } }
  const original = await readFile(resolve(root, writer));
  result.candidateWriterBlob = blob(original);
  if (role === 'baseline') {
    const control = execFileSync('git', ['show', `${sha(result.baseline)}:${writer}`], { cwd: root, maxBuffer: 16e6 });
    result.controlWriterBlob = blob(control); await writeFile(resolve(root, writer), control);
  }
  let build;
  try { build = await command('build', 'pnpm', ['build:deploy']); }
  finally { if (role === 'baseline') await writeFile(resolve(root, writer), original); }
  if (!(await readFile(resolve(root, writer))).equals(original) || git('rev-parse', 'HEAD') !== result.candidate) throw new Error('Benchmark source/head was not preserved.');
  if (!build.log.includes('[build] Complete!')) throw new Error('Production build lacks Astro completion.');
  result.share = shareCounts(build.log, role); result.buildSeconds = build.seconds;
  const validation = await command('validation', 'pnpm', ['check:deploy-assets']);
  if (!/Verified [1-9]\d* emitted runtime asset URL/u.test(validation.log)) throw new Error('Deploy asset validation lacks positive coverage.');
  git('diff', '--exit-code', '--quiet', '--', 'src/objects');
  positive((await readFile(resolve(root, 'dist/index.html'))).length);
  result.validationSeconds = validation.seconds;
  result.output = await distIdentity(resolve(root, 'dist'));
  result.toolchain = { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model, image: process.env.ImageVersion,
    sharp: sharp.versions, packageBlob: blob(await readFile(resolve(root, 'package.json'))), lockBlob: blob(await readFile(resolve(root, 'pnpm-lock.yaml'))) };
  requireBuildOutput(role, result);
  const worker = await command('worker', process.execPath, ['deploy/cloudflare/bundle-worker.mts']);
  if (!/a search for "europa" answers [1-9]\d* objects and [1-9]\d* features; \/earth\/\?q=europa renders/u.test(worker.log)) throw new Error('Local Worker lacks completed search/page proof.');
  result.workerSeconds = worker.seconds;
  await save(result);
}

export function requireBuildOutput(role: Role, result: unknown): void {
  if (positive(object(object(result).output).htmlPages) < 900) throw new Error('Refusing a truncated build below the production 900 HTML-page gate.');
  if (role !== 'seed') requireParity(result, JSON.parse(text(process.env.BENCHMARK_SEED_RESULT)));
  if (role === 'warm') requireParity(result, JSON.parse(text(process.env.BENCHMARK_BASELINE_RESULT)));
}

export function requireParity(actual: unknown, expected: unknown): void {
  const a = object(actual), b = object(expected);
  for (const value of [a, b]) {
    sha(value.candidate); const output = object(value.output);
    positive(output.files); positive(output.bytes); sha(output.gitBlob); positive(object(value.share).written);
  }
  for (const key of ['candidate', 'output']) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) throw new Error(`Candidate output parity failed: ${key}.`);
  if (object(a.share).written !== object(b.share).written) throw new Error('Share-image inventory parity failed.');
  const at = object(a.toolchain), bt = object(b.toolchain);
  for (const key of ['node', 'platform', 'arch', 'sharp', 'packageBlob', 'lockBlob']) if (JSON.stringify(at[key]) !== JSON.stringify(bt[key])) throw new Error(`Render toolchain differs: ${key}.`);
}

async function finish(role: Role): Promise<void> {
  const result = await state(); if (result.role !== role) throw new Error('Benchmark result role changed.');
  if (role !== 'baseline') result.cacheProof = await verifySaved(text(role === 'seed' ? result.seedKey : result.warmKey));
  if (role !== 'seed') requireParity(result, JSON.parse(text(process.env.BENCHMARK_SEED_RESULT)));
  if (role === 'warm') {
    requireParity(result, JSON.parse(text(process.env.BENCHMARK_BASELINE_RESULT)));
    let values: Record<string, unknown>[] = [], transfers: Record<string, number> | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      values = await jobs();
      try { transfers = cacheTransferSeconds(values); break; }
      catch (error) { if (attempt === 11) throw error; await new Promise(accept => setTimeout(accept, 5000)); }
    }
    result.jobs = values; result.cacheTransferSeconds = transfers;
    const run = object(await api(`runs/${positive(Number(process.env.GITHUB_RUN_ID))}`));
    result.schedulerWaitingContext = { workflowCreatedAt: text(run.created_at), attemptStartedAt: text(run.run_started_at),
      note: 'Job started_at and prerequisite completed_at measure waiting separately; Jobs API supplies no per-job queued timestamp.' };
  }
  result.status = 'BUILD_BENCHMARK_OK';
  await save(result); const serialized = JSON.stringify(result);
  console.log(`BUILD_BENCHMARK_RESULT ${serialized}`); await emit('result', serialized);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Share-image build benchmark: ${role}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`);
}

if (import.meta.main) {
  const [mode, selected] = process.argv.slice(2);
  if (!roles.some(role => role === selected)) throw new Error('Expected seed, baseline or warm role.');
  const role = roles.find(role => role === selected)!;
  if (mode === 'plan') await plan(role);
  else if (mode === 'run') await run(role);
  else if (mode === 'finish') await finish(role);
  else throw new Error('Expected plan, run or finish command.');
}
