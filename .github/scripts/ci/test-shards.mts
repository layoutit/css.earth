/** Deterministic universe matrix and native Node file sharding; no duration history or verdict cache. */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { scriptTestFiles } from '../../../packages/core/src/node/script-test-files.ts';

export interface TestShard { lane: 'packages' | 'site'; shard: number; total: number; }
export interface TestSelection { packages: string; files: string; }
const root = resolve(import.meta.dirname, '../../..');

export function selectedTestFiles(directory: string, lane: TestShard['lane'], selection: TestSelection): string[] {
  const manifest: unknown = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const files = scriptTestFiles(directory, manifest, [`test:${lane}`]).get(`test:${lane}`)!;
  if (lane === 'site' || selection.packages === 'all') return [...files];
  const packages = new Set(selection.packages.split(/\s+/u).filter(Boolean));
  const extra = new Set(selection.files.split(/\s+/u).filter(Boolean));
  for (const file of extra) if (!files.includes(file)) throw new TypeError(`Selected test is outside the packages lane: ${file}`);
  return files.filter(file => packages.has(/^packages\/([^/]+)\//u.exec(file)?.[1] ?? '') || extra.has(file));
}

export function universeTestMatrix(directory: string, selection: TestSelection): TestShard[] {
  const total = selection.packages === 'all' ? 3 : selectedTestFiles(directory, 'packages', selection).length <= 40 ? 1 : 2;
  return [...Array.from({ length: total }, (_, index): TestShard => ({ lane: 'packages', shard: index + 1, total })),
    ...Array.from({ length: 3 }, (_, index): TestShard => ({ lane: 'site', shard: index + 1, total: 3 }))];
}

/** Mirrors Node 22's sorted file-index modulo partition, independent of scheduling/completion times. */
export function shardFiles(files: readonly string[], shard: number, total: number): string[] {
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(shard) || shard < 1 || shard > total) throw new TypeError('Invalid test shard.');
  return [...new Set(files)].sort().filter((_, index) => index % total === shard - 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const selection = { packages: process.env.CI_TEST_PACKAGES ?? 'all', files: process.env.CI_TEST_FILES ?? '' };
  if (process.argv.length === 3 && process.argv[2] === '--matrix') {
    const matrix = JSON.stringify({ include: universeTestMatrix(root, selection) });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `test_matrix=${matrix}\n`);
    console.log(matrix);
  } else if (process.argv.length === 3 && process.argv[2] === '--run') {
    const lane = process.env.CI_UNIVERSE_LANE;
    if (lane !== 'site' && lane !== 'packages') throw new TypeError('Unknown universe test lane.');
    const shard = Number(process.env.CI_TEST_SHARD), total = Number(process.env.CI_TEST_SHARDS);
    const files = selectedTestFiles(root, lane, selection);
    const selected = shardFiles(files, shard, total);
    if (!universeTestMatrix(root, selection).some(row => row.lane === lane && row.shard === shard && row.total === total)) throw new TypeError('Unexpected universe test shard.');
    console.log(`${lane} shard ${shard}/${total}: ${selected.length}/${files.length} test files`);
    if (!selected.length) throw new TypeError('Selected shard has no test files.');
    // Pass the entire sorted set: Node owns the actual partition, with the existing imports/mocks/timeouts.
    const result = spawnSync('pnpm', ['test:run', `--test-shard=${shard}/${total}`, ...files], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else throw new TypeError('Usage: node .github/scripts/ci/test-shards.mts --matrix|--run');
}
