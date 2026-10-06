/** Main-only producer: one pinned production-shaped build, sane L2 baselines and L7 measures. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, appendFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { comparisonPreparation, requireUnchangedTracked } from './ci.mts';
import { serverStage } from './server/server-stage.mts';
import { runNode } from './performance-stage.mts';
import { sealCache, packCache } from './cache/base-cache.mts';
import { args, isMain } from './records.mts';
export async function produceBase(checkout: string, out: string, archive: string): Promise<void> {
  const git = (values: string[]) => execFileSync('git', values, { cwd: checkout, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  const commit = git(['rev-parse', 'HEAD']);
  await mkdir(out, { recursive: true });
  const command = async (program: string, values: string[]) => {
    await new Promise<void>((accept, reject) => {
      const child = spawn(program, values, { cwd: checkout, stdio: 'inherit' });
      child.once('error', reject); child.once('exit', code => code === 0 ? accept() : reject(new Error(`Base producer ${program} exit ${code}`)));
    });
  };
  await command('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts']);
  const before = git(['diff', '--binary', '--no-ext-diff', 'HEAD', '--']);
  await command('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', comparisonPreparation(JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8')))]);
  requireUnchangedTracked(before, git(['diff', '--binary', '--no-ext-diff', 'HEAD', '--']));
  await command(process.execPath, [join(checkout, '.github/scripts/build-compare/build.mts'), '--checkout', checkout, '--out', join(out, 'base')]);
  const results = await Promise.allSettled([
    serverStage(checkout, checkout, out, 'pure-move', 'https://earth-assets.lowpoly.cc', undefined, { onlyBase: true }).then(report => {
      if (report.failures.length || report.targets.some(target => !target.base)) throw new Error('Producer L2 sanity failed');
    }),
    runNode('base-measures', [join(checkout, '.github/scripts/performance/measure.mts'), '--dist', join(out, 'base/dist'), '--metadata', join(out, 'base/metadata'), '--out', join(out, 'performance/base'), '--summary', join(out, 'performance/base.md')], checkout).then(result => {
      if (result.exitCode) throw new Error(`Producer L7 failed: ${result.output}`);
    }),
  ]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  // Retain precisely the consumer closure, not logs, temporary packages or producer verdicts.
  for (const path of ['server-answers.json', 'server-answers/temporary']) await rm(join(out, path), { recursive: true, force: true });
  const { files } = await import('./records.mts');
  for (const path of await files(join(out, 'server-answers'))) if (path.endsWith('.log')) await rm(join(out, 'server-answers', path));
  const identity = { commit, toolchain: JSON.parse(await readFile(join(out, 'base/toolchain.json'), 'utf8')) as unknown, lockfile: await readFile(join(checkout, 'pnpm-lock.yaml')) };
  await sealCache(out, identity);
  const bytes = await packCache(out, archive);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `bytes=${bytes}\ncacheable=${bytes < 10_000_000_000}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Base ${commit}: compressed archive ${bytes} bytes. Cache key site-base-v1-${commit}. At or above 10 GB uses the run artifact. Repository cache quota/eviction can still cause misses.\n`);
  await writeFile(`${archive}.size.json`, JSON.stringify({ bytes }));
  console.log('BASE CACHE PRODUCER PASS: sealed all consumer evidence');
}
if (isMain(import.meta.url)) {
  const flags = args(['--checkout', '--out', '--archive']);
  if (!flags.get('--checkout') || !flags.get('--out') || !flags.get('--archive')) throw new Error('Required: --checkout --out --archive');
  await produceBase(resolve(flags.get('--checkout')!), resolve(flags.get('--out')!), resolve(flags.get('--archive')!));
}
