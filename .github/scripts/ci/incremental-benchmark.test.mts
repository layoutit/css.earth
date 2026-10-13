import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { buildProof, command, commandEnvironment, fixture, MARKER, metadataProof, outputProof, planGeneratedReset, requireChanged, requireOptIn, requireUntrackedGenerated, resetGenerated, transferProof, withFixture } from './incremental-benchmark.mts';

const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = 'layoutit/css.earth';
const event = { action: 'opened', pull_request: { head: { sha: head, repo: { full_name: repository } }, labels: [{ name: 'compare-incremental' }] } };
test('distinct opt-in, exact head, repository and allowed event all required', () => {
  requireOptIn(event, repository, head);
  for (const change of [{ ...event, action: 'closed' }, { ...event, action: 'labeled', label: { name: 'compare-build' } },
    { ...event, pull_request: { ...event.pull_request, labels: [] } }, { ...event, pull_request: { ...event.pull_request, labels: [{ name: 'compare-build' }] } }]) assert.throws(() => requireOptIn(change, repository, head));
  assert.throws(() => requireOptIn(event, 'fork/repo', head)); assert.throws(() => requireOptIn(event, repository, base));
});

function buildLog(reuse: boolean): string {
  return ['Setup complete: 12000 downloaded, 0 reused.', '[build] Complete!',
    ...Array.from({ length: 900 }, (_, index) => `12:00:00   ├─ /${index ? `page${index}` : 'saturn'}/index.html (${reuse ? 'restored' : '1.32ms'})`),
    'Wrote 4340 share images to dist/social (30.6 MB; 0 rendered, 4340 reused).'].join('\n');
}
test('native counts require completed full HTML routes, misses on mutations and actual unchanged hits', () => {
  const warm = buildProof(buildLog(true), true, 'unchanged');
  assert.equal(warm.reused, 900); assert.equal(warm.rendered, 0);
  assert.equal(buildProof(buildLog(false), true, 'owner').rendered, 900); // broad invalidation is evidence, not failure
  buildProof(buildLog(false), false, 'unchanged'); buildProof(buildLog(false), true, 'seed');
  assert.throws(() => buildProof(buildLog(true), true, 'owner'), /incorrectly reused/u);
  assert.throws(() => buildProof(buildLog(true), true, 'shared'), /incorrectly reused/u);
  assert.throws(() => buildProof(buildLog(true), false, 'unchanged'), /Cache-off/u);
  assert.throws(() => buildProof(buildLog(false), true, 'unchanged'), /did not reuse/u);
  for (const log of [buildLog(true).replace('Setup complete: 12000 downloaded, 0 reused.', ''), buildLog(true).replace('[build] Complete!', ''),
    buildLog(true).replace(/^.*page899.*\n/mu, ''), buildLog(true).replace(/^.*Wrote .*$/mu, ''), buildLog(true).replace('/saturn/', '/absent/')]) assert.throws(() => buildProof(log, true, 'unchanged'));
});

test('default commands explicitly remove inherited opt-in and tokens, warm commands retain only explicit opt-in', () => {
  const env = { GITHUB_TOKEN: 'x', GH_TOKEN: 'x', BENCHMARK_TOKEN: 'x', COMMIT_REF: base, CSSEARTH_INCREMENTAL_BUILD: '1', ASSET_ORIGIN: 'https://example.com' };
  assert.deepEqual(commandEnvironment(env, false), { ASSET_ORIGIN: 'https://example.com' });
  assert.deepEqual(commandEnvironment(env, true), { ASSET_ORIGIN: 'https://example.com', CSSEARTH_INCREMENTAL_BUILD: '1' });
  assert.throws(() => commandEnvironment({ CLOUDFLARE_API_TOKEN: 'x' }, true));
});

test('actual fixtures change only declared markup/style bytes, and restoration survives callback failure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'incremental-fixture-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const css = await readFile(resolve(import.meta.dirname, '../../../src/renderers/css/styles/saturn-surfaces.css'), 'utf8');
  assert.equal(fixture('owner', css).slice(0, css.length), css); assert.match(fixture('owner', css), /outline-offset: 1px/u);
  const layout = await readFile(resolve(import.meta.dirname, '../../../site/layouts/ObjectLayout.astro'), 'utf8');
  assert.equal(fixture('shared', layout).replace(`data-incremental-benchmark="${MARKER}" `, ''), layout);
  for (const [scenario, original] of [['owner', css], ['shared', layout]] as const) {
    const file = join(directory, scenario); await writeFile(file, original);
    await assert.rejects(withFixture(file, scenario, async changed => { assert.match(changed.toString(), new RegExp(MARKER)); assert.equal(await readFile(file, 'utf8'), fixture(scenario, original)); throw new Error('failed build'); }), /failed build/u);
    assert.equal(await readFile(file, 'utf8'), original);
    await withFixture(file, scenario, async () => {}); assert.equal(await readFile(file, 'utf8'), original);
  }
  assert.throws(() => fixture('shared', '<html>')); assert.throws(() => fixture('owner', MARKER));
});

test('generated-input reset refuses any tracked file under a deletion candidate', () => {
  requireUntrackedGenerated(['src/objects/saturn/prepared', 'packages/bake/dist'], ['src/objects/saturn/object.json']);
  for (const file of ['src/objects/saturn/prepared', 'src/objects/saturn/prepared/content.json']) assert.throws(() => requireUntrackedGenerated(['src/objects/saturn/prepared'], [file]));
});

test('actual reset removes generated banks and preserves tracked site/prepared inputs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'incremental-reset-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const put = async (path: string, value = 'generated') => { await mkdir(resolve(directory, path, '..'), { recursive: true }); await writeFile(join(directory, path), value); };
  await put('.gitignore', '/site/prepared/generated.json\n/src/objects/*/prepared/\n/packages/*/dist/\n');
  await put('site/prepared/retained.mts', 'tracked source'); await put('site/prepared/generated.json');
  await put('src/objects/saturn/prepared/content.json'); await put('packages/bake/dist/index.js');
  execFileSync('git', ['init', '-q'], { cwd: directory }); execFileSync('git', ['add', '.gitignore', 'site/prepared/retained.mts'], { cwd: directory });
  assert.ok(await resetGenerated(directory) >= 0);
  assert.equal(await readFile(join(directory, 'site/prepared/retained.mts'), 'utf8'), 'tracked source');
  for (const path of ['site/prepared/generated.json', 'src/objects/saturn/prepared/content.json', 'packages/bake/dist/index.js']) await assert.rejects(readFile(join(directory, path)), { code: 'ENOENT' });
});

test('reset planner handles a real Git listing above the default 1 MiB process buffer without deleting inputs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'incremental-large-index-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'src/objects/saturn/prepared'), { recursive: true });
  await mkdir(join(directory, 'packages/bake/dist'), { recursive: true });
  await mkdir(join(directory, 'site/prepared'), { recursive: true });
  await writeFile(join(directory, 'site/prepared/retained.mts'), 'tracked source');
  await writeFile(join(directory, 'src/objects/saturn/prepared/content.json'), 'prepared bank');
  execFileSync('git', ['init', '-q'], { cwd: directory });
  execFileSync('git', ['add', 'site/prepared/retained.mts'], { cwd: directory });
  const empty = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: directory, input: '', encoding: 'utf8' }).trim();
  const entries = Array.from({ length: 12000 }, (_, index) => `100644 ${empty}\ttracked/${index}-${'x'.repeat(100)}\n`).join('');
  execFileSync('git', ['update-index', '--index-info'], { cwd: directory, input: entries });
  const listing = execFileSync('git', ['ls-files'], { cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.ok(Buffer.byteLength(listing) > 1024 * 1024);
  assert.throws(() => execFileSync('git', ['ls-files'], { cwd: directory, encoding: 'utf8', maxBuffer: 1024 * 1024 }), { code: 'ENOBUFS' });
  const paths = await planGeneratedReset(directory);
  assert.ok(paths.includes('src/objects/saturn/prepared')); assert.ok(paths.includes('packages/bake/dist'));
  assert.ok(!paths.includes('site/prepared')); assert.ok(!paths.includes('site/prepared/retained.mts'));
  assert.equal(await readFile(join(directory, 'site/prepared/retained.mts'), 'utf8'), 'tracked source');
  assert.equal(await readFile(join(directory, 'src/objects/saturn/prepared/content.json'), 'utf8'), 'prepared bank');
});

const metadata = `aria-label="GitHub v0.123" https://github.com/layoutit/css.earth/blob/${head}/src/objects/saturn/README.md`;
test('metadata validator detects stale revisions, stale versions and unfinalized tokens', () => {
  assert.deepEqual(metadataProof(metadata, head, '0.123'), { revisions: 1, versions: 1 });
  assert.throws(() => metadataProof(metadata, base, '0.123'));
  assert.throws(() => metadataProof(metadata, head, '0.124'));
  for (const token of ['__CSSEARTH_BUILD_VERSION__', '__CSSEARTH_BUILD_REVISION__']) assert.throws(() => metadataProof(metadata + token, head, '0.123'));
});
test('full output proof requires real page membership, positive metadata and an emitted mutation marker', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'incremental-output-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'saturn'));
  await Promise.all(Array.from({ length: 899 }, (_, index) => writeFile(join(directory, `${index ? `page${index}` : 'index'}.html`), '<html></html>')));
  await writeFile(join(directory, 'saturn/index.html'), `<html>${metadata} ${MARKER}</html>`);
  const result = await outputProof(directory, 'owner', head, '0.123'); assert.equal(result.markers, 1);
  await assert.rejects(outputProof(directory, 'unchanged', head, '0.123'), /marker proof/u);
  await writeFile(join(directory, 'saturn/index.html'), `<html>${metadata}</html>`);
  await assert.rejects(outputProof(directory, 'owner', head, '0.123'), /marker proof/u);
  await writeFile(join(directory, 'saturn/index.html'), '<html></html>');
  await assert.rejects(outputProof(directory, 'unchanged', head, '0.123'), /positive metadata/u);
  await rm(join(directory, 'page898.html'));
  await assert.rejects(outputProof(directory, 'unchanged', head, '0.123'), /900 HTML/u);
});

test('mutation must differ from seed even when fresh and warm agree', () => {
  const seed = { output: { gitBlob: head } };
  requireChanged({ output: { gitBlob: base }, markers: 1 }, seed, 'owner');
  for (const actual of [{ output: { gitBlob: head }, markers: 1 }, { output: { gitBlob: base }, markers: 0 }, { output: { gitBlob: base } }]) assert.throws(() => requireChanged(actual, seed, 'owner'));
});

function step(name: string) { return { name, conclusion: 'success', startedAt: '2026-10-14T00:00:00Z', completedAt: '2026-10-14T00:00:04Z' }; }
test('cache timing requires both exact completed seed save and pair restore/save steps', () => {
  const jobs = [{ name: 'Incremental seed', steps: [step('Save seed static cache')] }, { name: 'Incremental owner', steps: [step('Restore exact seed static cache'), step('Save measured static cache')] }];
  assert.deepEqual(transferProof(jobs, 'owner'), { 'Save seed static cache': 4, 'Restore exact seed static cache': 4, 'Save measured static cache': 4 });
  for (const bad of [jobs.slice(1), [jobs[0]!], [jobs[0]!, { ...jobs[1], steps: [] }], [jobs[0]!, { ...jobs[1], steps: [step('Restore exact seed static cache'), { ...step('Save measured static cache'), conclusion: null }] }]]) assert.throws(() => transferProof(bad, 'owner'));
});

test('actual subprocess receives opt-in, drains late output, and rejects missing command', { timeout: 10000 }, async t => {
  const name = `incremental-command-${process.pid}`, output = resolve(import.meta.dirname, '../../../output/incremental-benchmark');
  t.after(() => rm(join(output, `${name}.log`), { force: true }));
  const envResult = await command(name, process.execPath, ['-e', 'console.log(process.env.CSSEARTH_INCREMENTAL_BUILD)'], true);
  assert.match(envResult.log, /^1\n/mu);
  const result = await command(name, process.execPath, [resolve(import.meta.dirname, 'fixtures/build-benchmark-drain.mts')], true);
  assert.match(result.log, /LATE_STDERR_DRAINED/u);
  assert.match(result.log, /Wrote 37 share images/u);
  assert.equal(await readFile(join(output, `${name}.log`), 'utf8'), result.log);
  await assert.rejects(command(name, process.execPath, ['-e', 'setInterval(() => {}, 1000)'], false, 50), /timed out/u);
  await assert.rejects(command(name, join(output, 'missing-command'), [], false), { code: 'ENOENT' });
});

function workflowContract(source: string): void {
  const workflow: unknown = parse(source);
  assert.ok(workflow && typeof workflow === 'object' && !Array.isArray(workflow));
  function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
  assert.ok(isRecord(workflow)); const record = workflow;
  assert.deepEqual(record.permissions, { contents: 'read', actions: 'read' });
  assert.doesNotMatch(source, /secrets\.|upload-artifact|deploy:cloudflare|wrangler|publish:/u);
  assert.match(source, /same|compare-incremental/u);
  assert.match(source, /head\.repo\.full_name == github\.repository/u);
  assert.match(source, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'compare-incremental'\)/u);
  assert.match(source, /github\.event\.action != 'labeled' \|\| github\.event\.label\.name == 'compare-incremental'/u);
  assert.equal((source.match(/fetch-depth: 0/gu) ?? []).length, 2);
  assert.equal((source.match(/ref: \$\{\{ github.event.pull_request.head.sha \}\}/gu) ?? []).length, 2);
  assert.equal((source.match(/persist-credentials: false/gu) ?? []).length, 2);
  assert.match(source, /scenario: \[unchanged, owner, shared\]/u);
  assert.match(source, /fail-on-cache-miss: true/u);
  for (const name of ['Save seed static cache', 'Restore exact seed static cache', 'Save measured static cache']) assert.match(source, new RegExp(`name: ${name}`));
  const lines = source.split('\n');
  const pathLines = lines.filter(line => /^            output\//u.test(line));
  assert.deepEqual(pathLines.sort(), Array(3).fill(['            output/incremental-build/astro-cache', '            output/share-image-cache']).flat().sort());
  assert.equal((source.match(/run: node .github\/scripts\/ci\/incremental-benchmark.mts (?:plan|run|finish) /gu) ?? []).length, 6);
}

test('workflow keeps candidate/permissions/cache scope and no-publish contract; deletion mutations fail', async () => {
  const source = await readFile(resolve(import.meta.dirname, '../../workflows/incremental-benchmark.yml'), 'utf8');
  workflowContract(source);
  for (const changed of [source.replace('contents: read', 'contents: write'), source.replace('fetch-depth: 0', 'fetch-depth: 1'),
    source.replace('head.repo.full_name == github.repository', 'true'), source.replace("contains(github.event.pull_request.labels.*.name, 'compare-incremental')", 'true'),
    source.replace('fail-on-cache-miss: true', 'fail-on-cache-miss: false'), source.replace('output/share-image-cache', 'src/objects'),
    source.replace('name: Save measured static cache', 'name: Skipped save'), source.replace('TZ: UTC', 'TOKEN: ${{ secrets.X }}')]) assert.throws(() => workflowContract(changed));
});
