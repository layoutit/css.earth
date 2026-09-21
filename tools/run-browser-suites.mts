import { spawn, spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The browser suites under site/test are plain scripts: each takes the site
// origin, drives Chromium and exits non-zero on the first failed assertion.
// Nothing ran them together, so they drifted out of every routine check.
// This runner starts one dev server, runs every suite against it in sequence
// and reports the outcome per suite, so `pnpm test:browser:all` is one command.
// site/test/browser-suites.json records which suites a routine run must pass
// and why the others do not yet; the run fails only when a result differs.
const root = fileURLToPath(new URL('../', import.meta.url));
const suiteDirectory = 'site/test';

/** Suites that need more than an origin stay opt-in; the reason is the contract. */
const OPT_IN: Readonly<Record<string, string>> = Object.freeze({
  'mars-calibration-interaction-browser.mts': 'needs the Google Earth Pro oracle captures under output/',
  'mars-calibration-oracle-browser.mts': 'needs the Google Earth Pro oracle captures under output/',
  'capture-rendered-motion.mts': 'capture tool, not a check',
  'diagnostic-recorder-browser.mts': 'records traces for the performance notes',
  'performance-capture-browser.mts': 'records traces for the performance notes',
});

export interface SuiteResult { readonly suite: string; readonly status: 'passed' | 'failed' | 'skipped'; readonly seconds: number; readonly reason?: string; }
/** The checked-in expectation per suite: which ones a routine run must pass, and why the others do not yet. */
export interface SuiteExpectation { readonly expect: 'pass' | 'fail' | 'intermittent'; readonly reason?: string }
export interface SuiteExpectations { readonly [suite: string]: SuiteExpectation }

/** Compare one result with its record. An intermittent suite passes and fails on the same
 * build, so either outcome matches; its reason says how often each was measured. */
export function compareWithExpectation(result: SuiteResult, expectation: SuiteExpectation | undefined): { readonly differs: boolean; readonly note?: string } {
  const expected = expectation?.expect ?? 'pass';
  if (result.status === 'skipped') return { differs: false, note: result.reason };
  if (expected === 'intermittent') return { differs: false, note: `intermittent: ${expectation?.reason ?? 'passes and fails on the same build'}` };
  if (result.status === 'failed' && expected === 'fail') return { differs: false, note: `known: ${expectation?.reason ?? 'expected failure'}` };
  if (result.status === 'passed' && expected === 'fail') return { differs: true, note: 'passes now: set expect to pass in browser-suites.json' };
  return { differs: result.status === 'failed', note: result.reason };
}
export async function readSuiteExpectations(): Promise<SuiteExpectations> {
  const { readFile } = await import('node:fs/promises');
  const value: unknown = JSON.parse(await readFile(resolve(root, suiteDirectory, 'browser-suites.json'), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('browser-suites.json must be a record of suite expectations.');
  for (const [suite, entry] of Object.entries(value)) {
    const { expect, reason } = (entry ?? {}) as { expect?: unknown; reason?: unknown };
    if (!entry || typeof entry !== 'object' || !['pass', 'fail', 'intermittent'].includes(expect as string)) throw new TypeError(`browser-suites.json: ${suite} needs expect: pass | fail | intermittent.`);
    if (expect !== 'pass' && (typeof reason !== 'string' || !reason.trim())) throw new TypeError(`browser-suites.json: ${suite} needs a measured reason.`);
  }
  return value as SuiteExpectations;
}

export async function listBrowserSuites(): Promise<string[]> {
  return (await readdir(resolve(root, suiteDirectory))).filter(name => name.endsWith('-browser.mts')).sort();
}

/** A prepared input the suites read through the running site. It is generated, not checked in,
 * and a missing one does not fail the site: it serves an empty placeholder instead. Feature and
 * city search then return nothing, and a suite looking for a named feature waits out its timeout
 * on a row that was never going to appear. Say so before the first browser starts. */
export function preparedInputProblem(name: string, value: unknown): string | null {
  const count: unknown = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).count : undefined;
  if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) return null;
  return `${name} holds no rows (count ${JSON.stringify(count) ?? 'missing'}). Feature and city search will return `
    + 'nothing, so every suite that looks for a named feature fails on a row that cannot appear. Restore this '
    + 'generated file from another checkout, or run node tools/prepare-feature-index.mts.';
}

/** Checks the prepared inputs the suites depend on, before any browser starts. */
export async function requirePreparedInputs(): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const name = 'site/prepared-feature-index.json';
  let value: unknown;
  try { value = JSON.parse(await readFile(resolve(root, name), 'utf8')); }
  catch (error) { throw new Error(`${name} could not be read. Run node tools/prepare-feature-index.mts.`, { cause: error }); }
  const problem = preparedInputProblem(name, value);
  if (problem) throw new Error(problem);
}

async function waitForServer(origin: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(origin, { signal: AbortSignal.timeout(5000) }); if (response.ok) return; }
    catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Site did not answer at ${origin} within ${timeoutMs / 1000} s.`);
}

export function runSuite(suite: string, origin: string, { timeoutMs = 20 * 60 * 1000 } = {}): SuiteResult {
  const started = Date.now();
  const result = spawnSync(process.execPath, [resolve(root, suiteDirectory, suite), origin], {
    cwd: root, stdio: 'inherit', timeout: timeoutMs,
    // Suites read the origin from argv[2], CSSEARTH_TEST_ORIGIN or ORIGIN; set all three.
    env: { ...process.env, CSSEARTH_TEST_ORIGIN: origin, ORIGIN: origin },
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (result.error) return { suite, status: 'failed', seconds, reason: result.error.message };
  return { suite, status: result.status === 0 ? 'passed' : 'failed', seconds, ...(result.status === 0 ? {} : { reason: `exit ${result.status ?? result.signal}` }) };
}

export async function runBrowserSuites({ origin, port = 4230, only, includeOptIn = false, objects }: { origin?: string; port?: number; only?: string; includeOptIn?: boolean; objects?: string }): Promise<SuiteResult[]> {
  if (objects) process.env.CSSEARTH_TEST_OBJECTS = objects;
  await requirePreparedInputs();
  const suites = (await listBrowserSuites()).filter(suite => !only || suite.includes(only));
  let server: ReturnType<typeof spawn> | null = null;
  let target = origin;
  if (!target) {
    target = `http://127.0.0.1:${port}`;
    server = spawn('pnpm', ['exec', 'astro', 'dev', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], detached: true });
    await waitForServer(target, 180000);
  }
  const results: SuiteResult[] = [];
  try {
    for (const suite of suites) {
      const optIn = OPT_IN[suite];
      if (optIn && !includeOptIn) { results.push({ suite, status: 'skipped', seconds: 0, reason: optIn }); continue; }
      console.log(`\n=== ${suite} → ${target}`);
      results.push(runSuite(suite, target));
    }
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ } }
  }
  return results;
}

function usage(): never {
  throw new TypeError('Usage: run-browser-suites [--origin=<url> | --port=<n>] [--only=<substring>] [--objects=all|<id,id>] [--include-opt-in] [--list]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options: { origin?: string; port?: number; only?: string; includeOptIn?: boolean; objects?: string } = {};
  let list = false;
  for (const argument of process.argv.slice(2)) {
    const [key, value] = argument.split('=', 2);
    if (key === '--origin' && value) options.origin = value;
    else if (key === '--port' && value && /^\d+$/.test(value)) options.port = Number(value);
    else if (key === '--only' && value) options.only = value;
    else if (key === '--objects' && value) options.objects = value;
    else if (argument === '--include-opt-in') options.includeOptIn = true;
    else if (argument === '--list') list = true;
    else usage();
  }
  if (list) {
    for (const suite of await listBrowserSuites()) console.log(`${suite}${OPT_IN[suite] ? `  (opt-in: ${OPT_IN[suite]})` : ''}`);
  } else {
    const expectations = await readSuiteExpectations();
    const results = await runBrowserSuites(options);
    console.log('\nBrowser suites:');
    const unexpected: string[] = [];
    for (const result of results) {
      const { differs, note } = compareWithExpectation(result, expectations[result.suite]);
      if (differs) unexpected.push(result.suite);
      console.log(`  ${result.status.padEnd(7)} ${String(result.seconds).padStart(4)}s  ${result.suite}${note ? `  (${note})` : ''}`);
    }
    const counts = { passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, skipped: results.filter(r => r.status === 'skipped').length };
    console.log(`\n${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped; ${unexpected.length} differ from browser-suites.json${unexpected.length ? `: ${unexpected.join(', ')}` : ''}`);
    if (unexpected.length) process.exitCode = 1;
  }
}
