/** Hosted, opt-in static-page experiment. Every warm output has a same-source cache-off control. */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { appendFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { finished } from 'node:stream/promises';
import { stripVTControlCharacters } from 'node:util';
import sharp from 'sharp';
import { cacheProof, distIdentity, requireCacheMatch, requireParity, requireSafeRecipe, timingJobs, validationProof, workerProof } from './build-benchmark.mts';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(root, 'output/incremental-benchmark');
const astroCache = resolve(root, 'output/incremental-build/astro-cache');
const shareCache = resolve(root, 'output/share-image-cache');
const cachePaths = [astroCache, shareCache];
export type Scenario = 'seed' | 'unchanged' | 'owner' | 'shared';
const scenarios: readonly Scenario[] = ['seed', 'unchanged', 'owner', 'shared'];
const OWNER = 'src/renderers/css/styles/saturn-surfaces.css', SHARED = 'site/layouts/ObjectLayout.astro';
export const MARKER = 'incremental-benchmark-fixture';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const obj = (value: unknown): Record<string, unknown> => {
  if (!record(value)) throw new TypeError('Expected benchmark object.');
  return value;
};
const str = (value: unknown): string => { if (typeof value !== 'string' || !value) throw new TypeError('Expected nonempty benchmark text.'); return value; };
const positive = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new TypeError('Expected positive benchmark count.'); return value; };
const sha = (value: unknown): string => { const text = str(value); if (!/^[a-f0-9]{40}$/u.test(text)) throw new TypeError('Expected Git identity.'); return text; };
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16e6 }).trim();
const blob = (bytes: Uint8Array) => createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');

export function requireOptIn(event: unknown, repository: string, head: string): void {
  const payload = obj(event), pr = obj(payload.pull_request), source = obj(pr.head);
  if (payload.action === 'labeled' && obj(payload.label).name !== 'compare-incremental') throw new Error('Unrelated label event.');
  if (!['opened', 'synchronize', 'reopened', 'labeled'].includes(str(payload.action)) ||
      str(obj(source.repo).full_name) !== repository || sha(source.sha) !== head ||
      !Array.isArray(pr.labels) || !pr.labels.some(label => obj(label).name === 'compare-incremental')) throw new Error('Requires same-repository opted-in exact-head PR.');
}

/** Literal edits preserve scientific values, inventories, and every other source byte. */
export function fixture(scenario: Scenario, original: string): string {
  if (scenario === 'owner') {
    if (!original.includes('saturn') || original.includes(MARKER)) throw new Error('Owner fixture stylesheet missing or already mutated.');
    return `${original}\n.object-stage:where([data-object-id="saturn"], .${MARKER}) { outline-offset: 1px; }\n`;
  }
  if (scenario === 'shared') {
    const needle = '<html lang="en"';
    if (original.split(needle).length !== 2) throw new Error('Shared fixture HTML missing or ambiguous.');
    return original.replace(needle, `<html data-incremental-benchmark="${MARKER}" lang="en"`);
  }
  return original;
}

export function buildProof(log: string, enabled: boolean, scenario: Scenario): { rendered: number; reused: number; total: number; saturnReused: boolean; share: { written: number; rendered: number; reused: number } } {
  const readable = stripVTControlCharacters(log);
  if (!/Setup complete: [1-9]\d* downloaded, 0 reused\./u.test(readable)) throw new Error('Missing fresh live-R2 prepared-input setup proof.');
  if (!readable.includes('[build] Complete!')) throw new Error('Missing Astro completion.');
  const routes = [...readable.matchAll(/(?:├─|└─) (\/\S+\.html)\s+\(([^)]+)\)/gu)];
  if (routes.length < 900 || new Set(routes.map(match => match[1])).size !== routes.length) throw new Error('Missing complete unique native HTML route counts.');
  const reused = routes.filter(match => /^(?:restored|cached)$/u.test(match[2]!)).length;
  const saturn = routes.find(match => match[1] === '/saturn/index.html');
  if (!saturn) throw new Error('Missing actual Saturn render proof.');
  const saturnReused = /^(?:restored|cached)$/u.test(saturn[2]!);
  if (!enabled && reused) throw new Error('Cache-off control unexpectedly reused pages.');
  if (enabled && scenario === 'unchanged' && reused < routes.length * 0.9) throw new Error('Unchanged warm build did not reuse at least 90% of HTML pages.');
  if (enabled && scenario !== 'unchanged' && (scenario === 'seed' ? reused > 0 : saturnReused || reused === routes.length)) throw new Error('Changed or seed pages were incorrectly reused.');
  const footer = [...readable.matchAll(/Wrote (\d+) share images to dist\/social \([\d.]+ MB; (\d+) rendered, (\d+) reused\)\./gu)].at(-1);
  if (!footer) throw new Error('Missing real share-cache footer.');
  const written = positive(Number(footer[1])), rendered = Number(footer[2]), shareReused = Number(footer[3]);
  if (![rendered, shareReused].every(value => Number.isSafeInteger(value) && value >= 0) || rendered + shareReused !== written) throw new Error('Invalid share-cache counts.');
  return { rendered: routes.length - reused, reused, total: routes.length, saturnReused, share: { written, rendered, reused: shareReused } };
}

export function metadataProof(text: string, candidate: string, version: string): { revisions: number; versions: number } {
  if (/__CSSEARTH_BUILD_(?:VERSION|REVISION)__/u.test(text)) throw new Error('Unstamped metadata token.');
  const revisions = [...text.matchAll(/github\.com\/layoutit\/css\.earth\/blob\/([a-f0-9]{40})\/src\/objects\//gu)];
  const versions = [...text.matchAll(/aria-label=\\?"GitHub v([0-9]+\.[0-9]+)\\?"/gu)];
  if (revisions.some(match => match[1] !== candidate) || versions.some(match => match[1] !== version)) throw new Error('Stale build metadata.');
  return { revisions: revisions.length, versions: versions.length };
}

export async function outputProof(directory: string, scenario: Scenario, candidate: string, version: string): Promise<Record<string, unknown>> {
  const identity = await distIdentity(directory);
  if (identity.htmlPages < 900 || !(await readFile(join(directory, 'index.html'))).length) throw new Error('Production 900 HTML-page gate failed.');
  let revisions = 0, versions = 0, markers = 0;
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:html|json)$/u.test(entry.name)) {
        const text = await readFile(file, 'utf8'), proof = metadataProof(text, candidate, version);
        revisions += proof.revisions; versions += proof.versions;
        if (text.includes(MARKER)) markers++;
      }
    }
  }
  await walk(directory);
  if (!revisions || !versions) throw new Error('Missing positive metadata coverage.');
  const changed = scenario === 'owner' || scenario === 'shared';
  if (changed !== (markers > 0) || (changed && !(await readFile(join(directory, 'saturn/index.html'), 'utf8')).includes(MARKER))) throw new Error('Rendered fixture marker proof failed.');
  return { identity, metadata: { revisions, versions }, markers };
}

/** No credential reaches the build, and the opt-in value is explicit for each invocation. */
export function commandEnvironment(env: NodeJS.ProcessEnv, enabled: boolean): NodeJS.ProcessEnv {
  const result = { ...env };
  for (const key of ['BENCHMARK_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'COMMIT_REF', 'CSSEARTH_INCREMENTAL_BUILD']) delete result[key];
  if (Object.entries(result).some(([key, value]) => key.startsWith('CLOUDFLARE_') && value)) throw new Error('Cloudflare credentials forbidden.');
  if (enabled) result.CSSEARTH_INCREMENTAL_BUILD = '1';
  return result;
}

export async function command(name: string, program: string, args: string[], enabled: boolean, timeoutMs = 1200000): Promise<{ seconds: number; log: string }> {
  await mkdir(output, { recursive: true });
  const started = performance.now(), path = join(output, `${name}.log`), stream = createWriteStream(path);
  let streamError: unknown;
  const flushed = finished(stream).catch(error => { streamError = error; });
  const child = spawn(program, args, { cwd: root, env: commandEnvironment(process.env, enabled), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let last = '', timedOut = false;
  const consume = (bytes: Buffer) => { stream.write(bytes); process.stdout.write(bytes); last = bytes.toString().trim().split('\n').at(-1) ?? last; };
  child.stdout.on('data', consume); child.stderr.on('data', consume);
  const heartbeat = setInterval(() => console.log(`INCREMENTAL ${name} ${((performance.now() - started) / 1000).toFixed(1)}s ${last.slice(0, 180)}`), 30000);
  let kill: NodeJS.Timeout | undefined;
  const deadline = setTimeout(() => {
    timedOut = true; const pid = child.pid;
    if (pid) { try { process.kill(-pid, 'SIGTERM'); } catch { /* exited */ }
      kill = setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* exited */ } }, 5000); }
  }, positive(timeoutMs));
  let code: number | null;
  try { code = await new Promise<number | null>((accept, reject) => { child.once('error', reject); child.once('close', accept); }); }
  finally { clearInterval(heartbeat); clearTimeout(deadline); if (kill) clearTimeout(kill); stream.end(); await flushed; if (streamError) throw streamError; }
  if (code !== 0 || timedOut) throw new Error(`${name} failed (${code}) or timed out.`);
  return { seconds: (performance.now() - started) / 1000, log: await readFile(path, 'utf8') };
}

async function api(path: string): Promise<unknown> {
  const repository = str(process.env.GITHUB_REPOSITORY);
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) throw new Error('Invalid repository.');
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/${path}`, { signal: AbortSignal.timeout(15000), headers: {
    authorization: `Bearer ${str(process.env.BENCHMARK_TOKEN)}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) throw new Error(`Read-only API HTTP ${response.status}.`);
  return response.json();
}
async function saved(key: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const proof = cacheProof(await api(`caches?key=${encodeURIComponent(key)}&ref=${encodeURIComponent(str(process.env.GITHUB_REF))}&per_page=100`), key, str(process.env.GITHUB_REF));
    if (proof) return proof;
    if (attempt < 11) await new Promise(accept => setTimeout(accept, 5000));
  }
  throw new Error('Missing exact nonempty saved cache API entry.');
}
export function transferProof(jobs: readonly Record<string, unknown>[], scenario: Scenario): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [jobName, names] of [
    ['Incremental seed', ['Save seed static cache']],
    ...(scenario === 'seed' ? [] : [[`Incremental ${scenario}`, ['Restore exact seed static cache', 'Save measured static cache']]]),
  ]) {
    const job = jobs.find(value => value.name === jobName);
    if (!job || !Array.isArray(job.steps)) throw new Error(`Missing transfer job ${String(jobName)}.`);
    for (const name of names!) {
      const step = job.steps.map(obj).find(value => value.name === name);
      if (!step || step.conclusion !== 'success') throw new Error(`Missing successful transfer ${name}.`);
      const seconds = (Date.parse(str(step.completedAt)) - Date.parse(str(step.startedAt))) / 1000;
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Missing real transfer timestamps.');
      result[name] = seconds;
    }
  }
  return result;
}
async function jobs(): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = timingJobs(await api(`runs/${positive(Number(process.env.GITHUB_RUN_ID))}/attempts/${positive(Number(process.env.GITHUB_RUN_ATTEMPT))}/jobs?per_page=100&page=${page}`));
    result.push(...batch); if (batch.length < 100) return result;
  }
  throw new Error('Jobs API pagination exceeded bound.');
}
const emit = async (name: string, value: string) => { if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); };
const state = async () => obj(JSON.parse(await readFile(join(output, 'result.json'), 'utf8')));
const save = async (value: Record<string, unknown>) => writeFile(join(output, 'result.json'), JSON.stringify(value, null, 2));

async function plan(scenario: Scenario): Promise<void> {
  const candidate = sha(process.env.BENCHMARK_HEAD);
  requireOptIn(JSON.parse(await readFile(str(process.env.GITHUB_EVENT_PATH), 'utf8')), str(process.env.GITHUB_REPOSITORY), candidate);
  if (git('rev-parse', 'HEAD') !== candidate || git('rev-parse', '--is-shallow-repository') !== 'false') throw new Error('Needs exact candidate full-history checkout.');
  requireSafeRecipe(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')), process.env);
  commandEnvironment(process.env, false);
  const nonce = `${str(process.env.RUNNER_OS)}-${str(process.env.RUNNER_ARCH)}-${candidate}-${positive(Number(process.env.GITHUB_RUN_ID))}-${positive(Number(process.env.GITHUB_RUN_ATTEMPT))}`;
  const seedKey = `static-build-v1-${nonce}-seed`, measuredKey = `static-build-v1-${nonce}-${scenario}`;
  await mkdir(output, { recursive: true }); await save({ scenario, candidate, seedKey, measuredKey });
  await emit('seed_key', seedKey); await emit('measured_key', measuredKey);
}

async function cacheContents(): Promise<unknown> {
  const astro = await distIdentity(astroCache), share = await distIdentity(shareCache);
  const manifest = obj(JSON.parse(await readFile(join(astroCache, 'incremental-build.json'), 'utf8')));
  if (!Object.keys(obj(manifest.routes)).length || !astro.htmlPages || share.files < 1) throw new Error('Restored cache lacks native manifest, cached HTML or share images.');
  return { astro, share };
}
export function requireUntrackedGenerated(paths: readonly string[], tracked: readonly string[]): void {
  for (const path of paths) if (tracked.some(file => file === path || file.startsWith(`${path}/`))) throw new Error(`Refusing to reset tracked input ${path}.`);
}
export async function planGeneratedReset(directory = root): Promise<string[]> {
  // This checkout's tracked listing exceeds Node's default 1 MiB child-process buffer.
  const listed = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim().split('\n').filter(Boolean);
  const sitePreparedFiles = listed('ls-files', '--others', '--ignored', '--exclude-standard', '--', 'site/prepared');
  const paths = [...sitePreparedFiles, 'site/public/scenes', 'node_modules/.astro',
    ...(await readdir(join(directory, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => `src/objects/${entry.name}/prepared`),
    ...(await readdir(join(directory, 'packages'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => `packages/${entry.name}/dist`)];
  requireUntrackedGenerated(paths, listed('ls-files'));
  return paths;
}
export async function resetGenerated(directory = root): Promise<number> {
  const started = performance.now(), paths = await planGeneratedReset(directory);
  // Each timed recipe independently downloads and verifies the published prepared closure.
  for (const path of paths) await rm(join(directory, path), { recursive: true, force: true });
  return (performance.now() - started) / 1000;
}
export async function withFixture(path: string, scenario: Scenario, action: (changed: Buffer) => Promise<void>): Promise<void> {
  const original = await readFile(path), changed = Buffer.from(fixture(scenario, original.toString('utf8')));
  try {
    if (!changed.equals(original)) await writeFile(path, changed);
    await action(changed);
    if (!(await readFile(path)).equals(changed)) throw new Error('Build rewrote fixture source.');
  } finally { await writeFile(path, original); }
  if (!(await readFile(path)).equals(original)) throw new Error('Fixture restoration failed.');
}
async function measured(name: string, enabled: boolean, scenario: Scenario, candidate: string): Promise<Record<string, unknown>> {
  const resetSeconds = await resetGenerated();
  await rm(join(root, 'dist'), { recursive: true, force: true });
  const build = await command(`${name}-build`, 'pnpm', ['build:deploy'], enabled), native = buildProof(build.log, enabled, scenario);
  const validation = await command(`${name}-assets`, 'pnpm', ['check:deploy-assets'], enabled); validationProof(validation.log);
  const count = Number(git('rev-list', '--count', 'HEAD')), version = `${Math.floor(count / 10000)}.${count % 10000}`;
  const proofStarted = performance.now(), proof = await outputProof(join(root, 'dist'), scenario, candidate, version);
  const outputProofSeconds = (performance.now() - proofStarted) / 1000;
  const result: Record<string, unknown> = { candidate, output: proof.identity, metadata: proof.metadata, markers: proof.markers,
    native, share: native.share, resetSeconds, outputProofSeconds, buildSeconds: build.seconds, validationSeconds: validation.seconds,
    toolchain: { node: process.version, platform: process.platform, arch: process.arch, sharp: sharp.versions,
      packageBlob: blob(await readFile(join(root, 'package.json'))), lockBlob: blob(await readFile(join(root, 'pnpm-lock.yaml'))) } };
  const worker = await command(`${name}-worker`, process.execPath, ['deploy/cloudflare/bundle-worker.mts'], enabled); workerProof(worker.log);
  result.workerSeconds = worker.seconds;
  result.coreSeconds = build.seconds + validation.seconds + worker.seconds;
  result.totalSeconds = resetSeconds + outputProofSeconds + build.seconds + validation.seconds + worker.seconds;
  return result;
}
export function requireChanged(actual: unknown, seed: unknown, scenario: Scenario): void {
  const a = obj(actual), b = obj(seed);
  if (scenario === 'unchanged') requireParity(a, b);
  else if (sha(obj(a.output).gitBlob) === sha(obj(b.output).gitBlob) || !positive(a.markers)) throw new Error('Mutation did not change emitted output.');
}

async function run(scenario: Scenario): Promise<void> {
  const runStarted = performance.now(), result = await state(), candidate = sha(result.candidate);
  if (result.scenario !== scenario || git('rev-parse', 'HEAD') !== candidate) throw new Error('Scenario/head changed.');
  git('diff', '--exit-code', '--quiet', '--', 'src/objects');
  const fixturePath = scenario === 'owner' ? OWNER : SHARED, original = await readFile(join(root, fixturePath));
  const changed = Buffer.from(fixture(scenario, original.toString('utf8')));
  result.source = { path: fixturePath, originalBlob: blob(original), measuredBlob: blob(changed) };
  result.host = { cpu: cpus()[0]?.model, cpus: cpus().length, image: process.env.ImageVersion };
  if (scenario === 'seed') {
    for (const path of cachePaths) await rm(path, { recursive: true, force: true });
    result.seed = await measured('seed', true, 'seed', candidate);
    result.cacheContents = await cacheContents();
  } else {
    requireCacheMatch(str(process.env.BENCHMARK_MATCHED_KEY), str(result.seedKey), str(result.measuredKey));
    const seedResult = obj(JSON.parse(str(process.env.BENCHMARK_SEED_RESULT)));
    if (seedResult.status !== 'INCREMENTAL_BENCHMARK_OK' || seedResult.candidate !== candidate) throw new Error('Missing successful exact-head seed.');
    result.restoredCache = await cacheContents();
    if (JSON.stringify(result.restoredCache) !== JSON.stringify(seedResult.cacheContents)) throw new Error('Restored cache bytes differ from seed.');
    const backup = join(output, 'seed-share');
    let started = performance.now(); await rm(backup, { recursive: true, force: true }); await cp(shareCache, backup, { recursive: true });
    result.shareSnapshotSeconds = (performance.now() - started) / 1000;
    await withFixture(join(root, fixturePath), scenario, async () => {
      result.warm = await measured('warm', true, scenario, candidate);
      if (!(await readFile(join(root, fixturePath))).equals(changed)) throw new Error('Build rewrote fixture source.');
      started = performance.now(); await rm(shareCache, { recursive: true, force: true }); await cp(backup, shareCache, { recursive: true });
      result.shareResetSeconds = (performance.now() - started) / 1000;
      result.fresh = await measured('fresh', false, scenario, candidate);
      if (!(await readFile(join(root, fixturePath))).equals(changed)) throw new Error('Control rewrote fixture source.');
      requireParity(result.warm, result.fresh); requireChanged(result.warm, seedResult.seed, scenario);
      result.cacheContents = await cacheContents();
    });
  }
  if (!(await readFile(join(root, fixturePath))).equals(original) || git('rev-parse', 'HEAD') !== candidate) throw new Error('Original fixture/head not restored.');
  git('diff', '--exit-code', '--quiet', '--', 'src/objects', fixturePath);
  result.sourceRestored = true; result.runSeconds = (performance.now() - runStarted) / 1000; await save(result);
}
async function finish(scenario: Scenario): Promise<void> {
  const result = await state(); if (result.scenario !== scenario || result.sourceRestored !== true) throw new Error('Incomplete result.');
  result.cacheProof = await saved(str(scenario === 'seed' ? result.seedKey : result.measuredKey));
  let timing: Record<string, number> | undefined;
  for (let attempt = 0; attempt < 12; attempt++) {
    const values = await jobs();
    try { timing = transferProof(values, scenario); result.jobs = values; break; }
    catch (error) { if (attempt === 11) throw error; await new Promise(accept => setTimeout(accept, 5000)); }
  }
  result.cacheTransferSeconds = timing;
  if (scenario !== 'seed') {
    const warm = obj(result.warm), fresh = obj(result.fresh);
    requireParity(warm, fresh);
    result.warmWithTransferAndSnapshotSeconds = Number(warm.totalSeconds) + Number(result.shareSnapshotSeconds) + timing!['Restore exact seed static cache']! + timing!['Save measured static cache']!;
    result.freshWithResetSeconds = Number(fresh.totalSeconds) + Number(result.shareResetSeconds);
  }
  result.status = 'INCREMENTAL_BENCHMARK_OK'; await save(result);
  console.log(`INCREMENTAL_BENCHMARK_RESULT ${JSON.stringify(result)}`);
  // Keep the cross-job output below GitHub's 1 MB job-output limit; detailed timing stays in logs and summaries.
  const compact = { candidate: result.candidate, status: result.status, seed: result.seed, cacheContents: result.cacheContents, cacheProof: result.cacheProof };
  await emit('result', JSON.stringify(compact));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Static incremental benchmark: ${scenario}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`);
}
if (import.meta.main) {
  const [mode, selected] = process.argv.slice(2), scenario = scenarios.find(value => value === selected);
  if (!scenario) throw new Error('Expected seed, unchanged, owner or shared.');
  if (mode === 'plan') await plan(scenario); else if (mode === 'run') await run(scenario); else if (mode === 'finish') await finish(scenario);
  else throw new Error('Expected plan, run or finish.');
}
