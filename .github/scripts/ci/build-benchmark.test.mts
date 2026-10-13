import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { cacheProof, cacheTransferSeconds, command, distIdentity, requireBuildOutput, requireCacheMatch, requireOptIn, requireParity, requireSafeRecipe, shareCounts, timingJobs } from './build-benchmark.mts';

test('actual command drains inherited stdout and stderr after its direct child exits', { timeout: 10000 }, async t => {
  const name = `drain-regression-${process.pid}`, output = resolve(import.meta.dirname, '../../../output/build-benchmark');
  await mkdir(output, { recursive: true }); t.after(() => rm(join(output, `${name}.log`), { force: true }));
  const result = await command(name, process.execPath, [resolve(import.meta.dirname, 'fixtures/build-benchmark-drain.mts')]);
  assert.deepEqual(shareCounts(result.log, 'warm'), { written: 37, rendered: 0, reused: 37 });
  assert.match(result.log, /LATE_STDERR_DRAINED/u);
  assert.equal(await readFile(join(output, `${name}.log`), 'utf8'), result.log);
});

test('actual command rejects spawn errors and releases its log', { timeout: 10000 }, async t => {
  const name = `spawn-regression-${process.pid}`, output = resolve(import.meta.dirname, '../../../output/build-benchmark');
  await mkdir(output, { recursive: true }); t.after(() => rm(join(output, `${name}.log`), { force: true }));
  await assert.rejects(command(name, join(output, 'absent-command'), []), { code: 'ENOENT' });
  assert.equal(await readFile(join(output, `${name}.log`), 'utf8'), '');
});

const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = 'layoutit/cssEarth';
const event = { action: 'opened', pull_request: { head: { sha: head, repo: { full_name: repository } }, base: { sha: base }, labels: [{ name: 'compare-build' }] } };
test('only labelled same-repository PR at its exact head can run', () => {
  assert.deepEqual(requireOptIn(event, repository, head), { head, base });
  for (const invalid of [{}, { pull_request: { ...event.pull_request, labels: [] } },
    { pull_request: { ...event.pull_request, head: { sha: head, repo: { full_name: 'fork/repo' } } } }]) assert.throws(() => requireOptIn(invalid, repository, head));
  assert.throws(() => requireOptIn(event, repository, base));
});
test('unrelated label events cannot start another opted-in benchmark', () => {
  for (const action of ['opened', 'synchronize', 'reopened']) assert.deepEqual(requireOptIn({ ...event, action }, repository, head), { head, base });
  assert.deepEqual(requireOptIn({ ...event, action: 'labeled', label: { name: 'compare-build' } }, repository, head), { head, base });
  assert.throws(() => requireOptIn({ ...event, action: 'labeled', label: { name: 'documentation' } }, repository, head), /unrelated label/u);
});
test('production recipe cannot carry publication commands or credentials through the benchmark', () => {
  const pkg = { scripts: { 'build:deploy': 'pnpm prepare && astro build && node site/build/share-images.mts', prepare: 'node prepare.mts', 'check:deploy-assets': 'node check.mts' } };
  requireSafeRecipe(pkg, {});
  assert.throws(() => requireSafeRecipe(pkg, { CLOUDFLARE_API_TOKEN: 'credential' }));
  for (const publish of ['pnpm deploy:cloudflare', 'wrangler deploy', 'node publish-runtime-assets.mts', 'pnpm publish:runtime-assets']) {
    assert.throws(() => requireSafeRecipe({ scripts: { ...pkg.scripts, prepare: publish } }, {}));
  }
});
test('real footer counts are dynamic and warm reuse must be complete', () => {
  assert.deepEqual(shareCounts('Wrote 37 share images to dist/social (1.0 MB; 31 rendered, 6 reused).', 'seed'), { written: 37, rendered: 31, reused: 6 });
  assert.deepEqual(shareCounts('Wrote 37 share images to dist/social (1.0 MB).', 'baseline'), { written: 37, rendered: 37, reused: 0 });
  assert.equal(shareCounts('Wrote 37 share images to dist/social (1.0 MB; 0 rendered, 37 reused).', 'warm').reused, 37);
  for (const log of ['', 'Wrote 0 share images to dist/social (0.0 MB; 0 rendered, 0 reused).', 'Wrote 37 share images to dist/social (1.0 MB; 1 rendered, 36 reused).']) assert.throws(() => shareCounts(log, 'warm'));
});
test('warm restoration requires exact seed match and a distinct save key', () => {
  requireCacheMatch('seed', 'seed', 'warm');
  for (const [matched, seed, warm] of [['seed-extra', 'seed', 'warm'], ['', 'seed', 'warm'], ['seed', 'seed', 'seed']]) assert.throws(() => requireCacheMatch(matched!, seed!, warm!));
});
test('save proof requires actual new exact-key/ref nonempty API entry, not an action success', () => {
  const entry = { id: 10, key: 'new-seed', ref: 'refs/pull/1/merge', size_in_bytes: 1234, created_at: '2026-10-13T00:00:00Z' };
  assert.equal(cacheProof({ actions_caches: [entry] }, entry.key, entry.ref)?.sizeBytes, 1234);
  for (const invalid of [{ ...entry, key: 'old' }, { ...entry, ref: 'refs/heads/main' }, { ...entry, size_in_bytes: 0 }]) assert.equal(cacheProof({ actions_caches: [invalid] }, entry.key, entry.ref), null);
  assert.equal(cacheProof({ actions_caches: [] }, entry.key, entry.ref), null);
  assert.throws(() => cacheProof({}, entry.key, entry.ref));
});
test('all-dist identity covers membership, names, sizes and actual bytes independent of traversal order', async t => {
  const root = await mkdtemp(join(tmpdir(), 'build-benchmark-')); t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(distIdentity(root), /Empty dist/u);
  await writeFile(join(root, 'a.html'), 'first'); await mkdir(join(root, 'nested')); await writeFile(join(root, 'nested', 'b.json'), 'second');
  const first = await distIdentity(root); assert.equal(first.files, 2); assert.equal(first.bytes, 11); assert.equal(first.htmlPages, 1);
  await writeFile(join(root, 'a.html'), 'other'); assert.notEqual((await distIdentity(root)).gitBlob, first.gitBlob);
  await writeFile(join(root, 'a.html'), 'first'); assert.deepEqual(await distIdentity(root), first);
  await writeFile(join(root, 'extra.html'), 'x'); assert.notEqual((await distIdentity(root)).gitBlob, first.gitBlob);
});
test('output and toolchain parity rejects empty/missing reports and changed candidate bytes', () => {
  const result = { candidate: head, output: { files: 5, bytes: 500, gitBlob: base }, share: { written: 3 },
    toolchain: { node: 'v24', platform: 'linux', arch: 'x64', sharp: { vips: '1' }, packageBlob: head, lockBlob: base } };
  requireParity(result, result);
  for (const invalid of [{}, { ...result, candidate: base }, { ...result, output: { ...result.output, gitBlob: head } },
    { ...result, output: { ...result.output, files: 0 } }, { ...result, toolchain: { ...result.toolchain, node: 'v22' } }]) assert.throws(() => requireParity(result, invalid));
});
test('actual dist membership must clear the production default 900 HTML-page gate', async t => {
  const root = await mkdtemp(join(tmpdir(), 'build-benchmark-pages-')); t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(Array.from({ length: 899 }, (_, index) => writeFile(join(root, `${index}.html`), '<html></html>')));
  await writeFile(join(root, 'extra.json'), '{}');
  await assert.rejects(async () => requireBuildOutput('seed', { output: await distIdentity(root) }), /production 900 HTML-page gate/u);
  await writeFile(join(root, '899.html'), '<html></html>');
  requireBuildOutput('seed', { output: await distIdentity(root) });
});
test('pre-Worker admission compares baseline to seed and warm to both peer outputs using production environment', () => {
  const result = { candidate: head, output: { files: 901, bytes: 5000, htmlPages: 900, gitBlob: base }, share: { written: 37 },
    toolchain: { node: 'v24', platform: 'linux', arch: 'x64', sharp: { vips: '1' }, packageBlob: head, lockBlob: base } };
  const previousSeed = process.env.BENCHMARK_SEED_RESULT, previousBaseline = process.env.BENCHMARK_BASELINE_RESULT;
  try {
    process.env.BENCHMARK_SEED_RESULT = JSON.stringify(result); process.env.BENCHMARK_BASELINE_RESULT = JSON.stringify(result);
    requireBuildOutput('baseline', result); requireBuildOutput('warm', result);
    const different = { ...result, output: { ...result.output, gitBlob: head } };
    process.env.BENCHMARK_SEED_RESULT = JSON.stringify(different);
    assert.throws(() => requireBuildOutput('baseline', result), /Candidate output parity/u);
    assert.throws(() => requireBuildOutput('warm', result), /Candidate output parity/u);
    process.env.BENCHMARK_SEED_RESULT = JSON.stringify(result); process.env.BENCHMARK_BASELINE_RESULT = JSON.stringify(different);
    assert.throws(() => requireBuildOutput('warm', result), /Candidate output parity/u);
  } finally {
    if (previousSeed === undefined) delete process.env.BENCHMARK_SEED_RESULT; else process.env.BENCHMARK_SEED_RESULT = previousSeed;
    if (previousBaseline === undefined) delete process.env.BENCHMARK_BASELINE_RESULT; else process.env.BENCHMARK_BASELINE_RESULT = previousBaseline;
  }
});
test('actual production runner admits identity and toolchain before invoking Worker smoke', async () => {
  const source = await readFile(new URL('./build-benchmark.mts', import.meta.url), 'utf8');
  const identity = source.indexOf('result.output = await distIdentity'), toolchain = source.indexOf('result.toolchain ='),
    admission = source.indexOf('requireBuildOutput(role, result);'), worker = source.indexOf("const worker = await command('worker'");
  assert.ok(identity >= 0 && toolchain > identity && admission > toolchain && worker > admission);
});

test('documented jobs timestamps prove completed cache transfer costs without inventing queued timestamps', () => {
  const names = ['Save seed share cache', 'Restore exact seed share cache', 'Save warm share cache'];
  const parsed = timingJobs({ jobs: [{ id: 10, name: 'benchmark', started_at: '2026-10-13T00:00:00Z', completed_at: null,
    steps: names.map(name => ({ name, status: 'completed', conclusion: 'success', started_at: '2026-10-13T00:00:01Z', completed_at: '2026-10-13T00:00:03Z' })) }] });
  assert.deepEqual(cacheTransferSeconds(parsed), Object.fromEntries(names.map(name => [name, 2])));
  assert.throws(() => cacheTransferSeconds([]));
  assert.throws(() => cacheTransferSeconds([{ steps: [{ name: names[0], conclusion: 'skipped' }] }]));
});

function workflowContract(value: unknown): void {
  assert.ok(value && typeof value === 'object' && 'jobs' in value && 'permissions' in value && 'on' in value);
  const source = JSON.stringify(value); assert.doesNotMatch(source, /secrets\.|CLOUDFLARE_|upload-artifact|deploy:cloudflare|wrangler/u);
  assert.deepEqual(value.permissions, { contents: 'read', actions: 'read' });
  const jobs = value.jobs; assert.ok(jobs && typeof jobs === 'object'); assert.deepEqual(Object.keys(jobs), ['seed', 'baseline', 'warm']);
  const definitions = Object.values(jobs);
  const seed = definitions[0]; assert.ok(seed && typeof seed === 'object' && 'if' in seed);
  assert.equal(seed.if, seedGuard);
  for (const job of definitions) {
    assert.ok(job && typeof job === 'object' && 'steps' in job && 'runs-on' in job && Array.isArray(job.steps)); assert.equal(job['runs-on'], 'ubuntu-24.04');
    for (const step of job.steps) {
      assert.ok(step && typeof step === 'object');
      if (String(step.uses).startsWith('actions/checkout@')) { assert.equal(step.with.ref, '${{ github.event.pull_request.head.sha }}'); assert.equal(step.with['fetch-depth'], 0); assert.equal(step.with['persist-credentials'], false); }
      if (String(step.uses).startsWith('actions/setup-node@')) { assert.equal(step.with['node-version'], '24'); assert.equal(step.with.cache, undefined); }
      if (String(step.uses).startsWith('actions/cache')) assert.equal(step.with.path, 'output/share-image-cache');
      assert.equal(step['continue-on-error'], undefined);
    }
  }
  const warm = definitions[2]; assert.ok(warm && typeof warm === 'object' && 'steps' in warm && Array.isArray(warm.steps));
  for (const role of ['baseline', 'warm']) {
    const job = definitions[role === 'baseline' ? 1 : 2]; assert.ok(job && typeof job === 'object' && 'steps' in job && Array.isArray(job.steps));
    const run = job.steps.find((step: Record<string, unknown>) => String(step.run).endsWith(` run ${role}`)); assert.ok(run);
    assert.equal(run.env.BENCHMARK_SEED_RESULT, '${{ needs.seed.outputs.result }}');
    if (role === 'warm') assert.equal(run.env.BENCHMARK_BASELINE_RESULT, '${{ needs.baseline.outputs.result }}');
  }
  const restore = warm.steps.find((step: Record<string, unknown>) => step.id === 'restored'); assert.ok(restore); assert.equal(restore.with['fail-on-cache-miss'], true);
  assert.equal(restore.with['restore-keys'], '${{ needs.seed.outputs.cache_key }}'); assert.equal(restore.with.key, '${{ steps.plan.outputs.warm_key }}');
  const save = warm.steps.find((step: Record<string, unknown>) => step.name === 'Save warm share cache'); assert.ok(save); assert.equal(save.with.key, restore.with.key);
  assert.ok(warm.steps.find((step: Record<string, unknown>) => String(step.run).endsWith(' finish warm')));
}
const seedGuard = "github.event.pull_request.head.repo.full_name == github.repository && contains(github.event.pull_request.labels.*.name, 'compare-build') && (github.event.action != 'labeled' || github.event.label.name == 'compare-build')";
const workflowSource = await readFile(new URL('../../workflows/build-benchmark.yml', import.meta.url), 'utf8');
test('actual benchmark workflow is opt-in, exact-head, read-only, symmetric and nonpublishing', () => workflowContract(parse(workflowSource)));
test('deleting opt-in/cache guards or adding publication/secret access fails the workflow contract', () => {
  for (const change of [
    workflowSource.replace(`    if: ${seedGuard}\n`, ''),
    workflowSource.replace(" && (github.event.action != 'labeled' || github.event.label.name == 'compare-build')", ''),
    workflowSource.replace('          fail-on-cache-miss: true', '          fail-on-cache-miss: false'),
    workflowSource.replace('run: node .github/scripts/ci/build-benchmark.mts finish warm', 'run: pnpm deploy:cloudflare'),
    workflowSource.replace("  TZ: UTC", '  TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}'),
    workflowSource.replace('      - name: Save warm share cache', '      - name: Skipped save'),
  ]) assert.throws(() => workflowContract(parse(change)));
});
