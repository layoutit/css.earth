/** Offline lane dry run and mutations of the exact-answer enforcement rules. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packagedFunction, readDeploymentConfig } from '../server-answers/deployment-config.mts';
import { serverVerdict, retainRecordingPair } from './server-policy.mts';
import { serverStage, serverSummary, supervisedRun, type Run } from './server-stage.mts';

const contract = (decide: typeof serverVerdict) => {
  for (const mode of ['report', 'pure-move', 'semantic'] as const) {
    for (const [differences, failures] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      assert.equal(decide(mode, differences!, failures!), mode === 'report' ? 0 : failures ? 2 : differences ? 1 : 0);
    }
  }
};
test('report always passes L2, and both declared modes reject every difference and sanity/tool failure', () => { contract(serverVerdict); });
test('deleting any enforcement rule makes the same verdict contract red', async () => {
  const root = await mkdtemp(join(tmpdir(), 'answer-policy-'));
  try {
    const source = await readFile(new URL('./server-policy.mts', import.meta.url), 'utf8');
    const rules = ["if (mode === 'report') return 0;", 'if (failures > 0) return 2;', 'differences > 0 ? 1 : 0'];
    for (const [index, rule] of rules.entries()) {
      assert.ok(source.includes(rule));
      const file = join(root, `mutant-${index}.mts`);
      await writeFile(file, source.replace(rule, index === 2 ? '0' : ''));
      const mutant = await import(pathToFileURL(file).href);
      assert.throws(() => contract(mutant.serverVerdict), assert.AssertionError);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('recording pairs obey a combined strict 40 MB upload ceiling', () => {
  assert.equal(retainRecordingPair(0, 36_000_000), true);
  assert.equal(retainRecordingPair(36_000_000, 36_000_000), false);
  assert.equal(retainRecordingPair(0, 40_000_000), false);
});
async function dryRun(mode: 'report' | 'pure-move' | 'semantic', broken = false) {
  const root = await mkdtemp(join(tmpdir(), 'answer-lane-'));
  const out = join(root, 'out'), base = join(root, 'base'), head = join(root, 'head');
  const calls: string[] = [];
  try {
    for (const [side, checkout] of [['base', base], ['head', head]] as const) {
      await mkdir(join(out, side, 'dist/catalogue'), { recursive: true });
      await writeFile(join(out, side, 'dist/catalogue/index.json'), '{"entries":[]}');
      await mkdir(join(checkout, 'bundled'), { recursive: true });
      await writeFile(join(checkout, 'bundled/search.mjs'), 'bundle');
      await writeFile(join(checkout, 'bundled/worker.mjs'), 'worker');
      await writeFile(join(checkout, 'package.json'), JSON.stringify({ scripts: { 'build:deploy': 'node prepare.mts && astro build && node site/build/share-images.mts && node packages/bake/cli/run-implemented-objects.mts assemble && node moved/netlify.mts', 'deploy:cloudflare-preview': 'node moved/worker.mts --noindex && npx deploy' } }));
      await writeFile(join(checkout, 'netlify.toml'), '[functions]\ndirectory = "bundled"\nincluded_files = ["dist/catalogue/index.json"]\n');
      await writeFile(join(checkout, 'wrangler.jsonc'), '{"main":"bundled/worker.mjs","assets":{}}');
    }
    const run: Run = async (stage, _program, args, cwd, env) => {
      calls.push(stage);
      assert.ok(!args.includes('astro build'));
      if (stage.includes('-bundle-')) {
        assert.match(env.NODE_OPTIONS ?? '', /offline\.mts/u);
        await writeFile(join(cwd, 'dist/staged-by-bundler.txt'), 'L2 only');
        assert.match(args.at(-1) ?? '', /node moved\/(netlify|worker)\.mts$/u);
        assert.ok(!(args.at(-1) ?? '').includes('--noindex'));
      }
      if (stage.includes('-record-')) {
        assert.equal(await realpath(join(cwd, 'dist')), join(await realpath(cwd), 'dist'));
        const pack = await packagedFunction(cwd, 'search', await readDeploymentConfig(cwd));
        try { assert.equal(await readFile(join(pack.root, 'dist/catalogue/index.json'), 'utf8'), '{"entries":[]}'); }
        finally { await rm(pack.root, { recursive: true, force: true }); }
        assert.equal(args[args.indexOf('--asset-origin') + 1], 'https://earth-assets.lowpoly.cc');
        const dir = args[args.indexOf('--out') + 1]!;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'index.json'), '{"requests":["one","two"]}');
      }
      if (stage.includes('-check-') && !(broken && stage === 'base-check-netlify')) return { exitCode: 0, output: 'Sane baseline: 2 answers; closure covered' };
      if (broken && stage === 'base-check-netlify') return { exitCode: 1, output: 'sanity mutation' };
      return { exitCode: stage === 'diff-preview' ? 1 : 0, output: JSON.stringify({ differences: stage === 'diff-preview' ? [{ file: 'one.json', dimension: 'headers.cache-control' }] : [] }) };
    };
    const report = await serverStage(base, head, out, mode, 'https://earth-assets.lowpoly.cc', run);
    assert.equal(report.exitCode, mode === 'report' ? 0 : broken ? 2 : 1);
    assert.equal(report.targets[0]?.base, 2);
    assert.ok(serverSummary(report).includes('one.json — headers.cache-control'));
    assert.equal(report.timings.length, broken ? 18 : 19);
    assert.equal(calls.filter(call => call.includes('-bundle-')).length, 4);
    assert.equal(calls.filter(call => call.includes('-record-')).length, 6);
    assert.equal(calls.filter(call => call.includes('-check-')).length, 6);
    assert.equal(JSON.parse(await readFile(join(out, 'server-answers.json'), 'utf8')).exitCode, report.exitCode);
    assert.ok((await readFile(join(out, 'server-answers/artifacts/preview-diff.json'), 'utf8')).includes('cache-control'));
    assert.ok(report.retainedBytes > 0);
    for (const side of ['base', 'head']) assert.equal(await readFile(join(out, side, 'dist/catalogue/index.json'), 'utf8'), '{"entries":[]}');
    await assert.rejects(readFile(join(out, 'head/dist/staged-by-bundler.txt')), /ENOENT/u);
    if (!broken) {
      const before = await readFile(join(out, 'server-answers.json'));
      calls.length = 0;
      const cached = await serverStage(base, head, out, mode, 'https://earth-assets.lowpoly.cc', run, { cachedBase: true });
      assert.equal(cached.exitCode, report.exitCode);
      assert.ok(!calls.some(call => call.startsWith('base-')), 'no base bundles, recordings or checks on a cache hit');
      assert.equal(calls.filter(call => call.startsWith('head-record-')).length, 3);
      assert.deepEqual(await readFile(join(out, 'server-answers.json')), before, 'cached and fresh L2 reports are byte-identical');
    }

  } finally { await rm(root, { recursive: true, force: true }); }
}
test('offline dry run reuses both outputs, resolves moved bundles, checks six recordings and retains small diffs', async () => { await dryRun('semantic'); });
test('report-mode sanity failure is a notice; enforced sanity failure blocks', async () => { await dryRun('report', true); await dryRun('pure-move', true); });
test('subprocess supervision retains failure logs and enforces the total budget', async () => {
  const out = await mkdtemp(join(tmpdir(), 'answer-watch-'));
  try {
    const result = await supervisedRun(out)('failure', process.execPath, ['-e', 'console.error("positive failure evidence");process.exitCode=1'], out, process.env);
    assert.equal(result.exitCode, 1);
    assert.match(await readFile(join(out, 'failure.log'), 'utf8'), /positive failure evidence/u);
    const hung = await supervisedRun(out, 80)('hung', process.execPath, ['-e', 'setInterval(() => {}, 1000)'], out, process.env);
    assert.equal(hung.exitCode, 2);
    assert.match(hung.output, /budget exhausted/u);
    await assert.rejects(supervisedRun(out, 0)('expired', process.execPath, [], out, process.env), /budget exhausted/u);
  } finally { await rm(out, { recursive: true, force: true }); }
});
