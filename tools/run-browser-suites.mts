import { spawn, spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The browser suites under site/test are plain scripts: each takes the site
// origin, drives Chromium and exits non-zero on the first failed assertion.
// Nothing ran them together, so they drifted out of every routine check.
// This runner starts one dev server, runs every suite against it in sequence
// and reports the outcome per suite, so `pnpm test:browser:all` is one command.
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

export async function listBrowserSuites(): Promise<string[]> {
  return (await readdir(resolve(root, suiteDirectory))).filter(name => name.endsWith('-browser.mts')).sort();
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
    const results = await runBrowserSuites(options);
    console.log('\nBrowser suites:');
    for (const result of results) console.log(`  ${result.status.padEnd(7)} ${String(result.seconds).padStart(4)}s  ${result.suite}${result.reason ? `  (${result.reason})` : ''}`);
    const failed = results.filter(result => result.status === 'failed');
    console.log(`\n${results.filter(r => r.status === 'passed').length} passed, ${failed.length} failed, ${results.filter(r => r.status === 'skipped').length} skipped`);
    if (failed.length) process.exitCode = 1;
  }
}
