// Run every per-body unit test file under tests/objects/unit, one process per
// file, and report per file. Body tests read restored source inputs, prepared
// state and published scene assets that a slim checkout (CI) does not carry.
// With --skip-missing-inputs a file whose every failure is a missing local
// input is reported as skipped with the missing path; an assertion failure
// still fails the run. Without the flag every failure fails the run.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface ObjectTestFileResult { file: string; status: 'passed' | 'failed' | 'skipped'; detail: string; }
export interface ObjectTestOptions { root?: string; files?: readonly string[]; skipMissingInputs?: boolean; concurrency?: number;
  run?: (file: string, root: string) => Promise<{ exitCode: number | null; output: string }>; }

const MISSING_INPUT = [
  /ENOENT: no such file or directory, (?:open|realpath|scandir|stat|lstat) '([^']+)'/u,
  /source manifest coverage failed\. Undeclared: [^.]*\. Missing: ([^\n]+?)\.?$/mu,
  /Source coverage failed\. Undeclared: [^.]*\. Missing: ([^\n]+?)\.?$/mu,
  /spawn (\S+cwebp\S*) ENOENT/u,
];

export async function discoverObjectTests(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.test\.m(?:j|t)s$/u.test(entry.name)) files.push(path);
    }
  }
  await walk(resolve(root, 'tests/objects/unit'));
  return files.sort();
}

/** Diagnostics of every failing test in a TAP stream: the lines between `not ok` and its closing `...`. */
export function failingDiagnostics(output: string): string[] {
  const failures: string[] = [];
  let current: string[] | null = null;
  for (const line of output.split('\n')) {
    if (/^\s*not ok \d+ - /u.test(line)) { current = [line]; continue; }
    if (current) {
      current.push(line);
      if (/^\s*\.\.\.\s*$/u.test(line)) { failures.push(current.join('\n')); current = null; }
    }
  }
  if (current) failures.push(current.join('\n'));
  return failures;
}

/** A failing file is skipped only when each of its failures names a missing local input. */
export function classify(exitCode: number | null, output: string, skipMissingInputs: boolean): Pick<ObjectTestFileResult, 'status' | 'detail'> {
  if (exitCode === 0) return { status: 'passed', detail: '' };
  const failures = failingDiagnostics(output);
  const missing = failures.map(text => MISSING_INPUT.map(pattern => pattern.exec(text)?.[1]).find(value => value !== undefined));
  if (skipMissingInputs && failures.length > 0 && missing.every(value => value !== undefined)) {
    return { status: 'skipped', detail: `missing local input ${[...new Set(missing)].join(', ')}` };
  }
  const lines = failures[0]?.split('\n') ?? [];
  const errorLine = lines.find(line => /^\s+[A-Z]\w*Error\b/u.test(line)) ?? lines[lines.findIndex(line => /^\s+error: \|-?$/u.test(line)) + 1];
  const first = failures.length ? (errorLine ?? lines[0])?.trim() : undefined;
  return { status: 'failed', detail: first || `exit ${exitCode}` };
}

function runFile(file: string, root: string): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.once('error', reject);
    child.once('close', exitCode => resolvePromise({ exitCode, output: Buffer.concat(chunks).toString('utf8') }));
  });
}

export async function runObjectTests({ root = process.cwd(), files, skipMissingInputs = false, concurrency = Math.max(1, Math.min(6, availableParallelism() - 1)), run = runFile }: ObjectTestOptions = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError('Concurrency must be a positive integer.');
  const queue = [...(files ?? await discoverObjectTests(root))];
  const results: ObjectTestFileResult[] = [];
  async function worker(): Promise<void> {
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      const { exitCode, output } = await run(file, root);
      results.push({ file: relative(root, file), ...classify(exitCode, output, skipMissingInputs) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  results.sort((left, right) => left.file.localeCompare(right.file));
  const count = (status: ObjectTestFileResult['status']) => results.filter(result => result.status === status).length;
  return { results, passed: count('passed'), failed: count('failed'), skipped: count('skipped') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flags = process.argv.slice(2);
  const skipMissingInputs = flags.includes('--skip-missing-inputs');
  const concurrencyFlag = flags.find(flag => flag.startsWith('--concurrency='));
  const unknown = flags.filter(flag => flag !== '--skip-missing-inputs' && !flag.startsWith('--concurrency='));
  if (unknown.length) throw new TypeError(`Usage: test-objects.mts [--skip-missing-inputs] [--concurrency=N]; unknown ${unknown.join(' ')}`);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const report = await runObjectTests({ root, skipMissingInputs, ...(concurrencyFlag ? { concurrency: Number(concurrencyFlag.slice('--concurrency='.length)) } : {}) });
  for (const result of report.results) if (result.status !== 'passed') console.log(`${result.status === 'failed' ? 'FAIL' : 'SKIP'} ${result.file}: ${result.detail}`);
  console.log(`Object unit test files: ${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped for missing local inputs.`);
  if (report.failed > 0) process.exitCode = 1;
}
