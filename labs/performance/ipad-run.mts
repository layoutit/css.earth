#!/usr/bin/env node
/** Run an ordered cssEarth journey in the visible iPad Safari tab with a trace and native screen filmstrip. */
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { requireFiniteNumber } from '@cssearth/core';
import { readPreparedObjects } from '@cssearth/objects/node';
import { captureIosMoment } from './ios-capture.mts';
import { startIpadDeviceSession, type IpadDeviceSession } from './ipad-device-session.mts';
import { JOURNEY_INPUT_SOURCE, compileJourney, parseJourney, parseJourneyArgs } from './ipad-journey.mts';
import { makeIpadStrip } from './ipad-strip.mts';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const requireSceneObject = readPreparedObjects(root).requireSceneObject;

function localAddress(): string {
  const address = networkInterfaces().en0?.find(entry => entry.family === 'IPv4' && !entry.internal)?.address;
  if (!address) throw new Error('No LAN IPv4 address on en0. Pass --origin http://<Mac-IP>:<preview-port>.');
  return address;
}

function takeOption(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new TypeError(`${flag} needs a value.`);
  args.splice(index, 2);
  if (args.includes(flag)) throw new TypeError(`${flag} may appear once.`);
  return value;
}

async function assertLocalBuiltPreview(origin: URL): Promise<void> {
  const allowed = new Set([localAddress(), '127.0.0.1', 'localhost']);
  if (origin.protocol !== 'http:' || !allowed.has(origin.hostname) || !origin.port)
    throw new Error('The iPad journey needs a local HTTP built preview on the Mac LAN.');
  const { stdout } = await exec('lsof', ['-nP', '-F', 'p', `-iTCP:${origin.port}`, '-sTCP:LISTEN']);
  const pid = stdout.split('\n').find(line => /^p\d+$/u.test(line))?.slice(1);
  if (!pid) throw new Error(`No preview server listens on port ${origin.port}. Start one with pnpm preview -- --host 0.0.0.0 --port ${origin.port}.`);
  const owner = (await exec('lsof', ['-nP', '-a', '-p', pid, '-d', 'cwd', '-Fn'])).stdout.split('\n').find(line => line.startsWith('n'))?.slice(1);
  if (!owner || resolve(owner) !== root) throw new Error(`Port ${origin.port} belongs to ${owner ?? 'an unknown checkout'}, not ${root}.`);
  const command = (await exec('ps', ['-p', pid, '-o', 'command='])).stdout;
  if (!/\b(?:astro|vite)(?:\.mjs)?\s+preview\b/u.test(command) && !command.includes('site/server/preview.mts'))
    throw new Error(`Port ${origin.port} is not a built preview. Server: ${command.trim()}`);
  const response = await fetch(new URL('/index.html', origin), { signal: AbortSignal.timeout(12_000) });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Built preview on ${origin.origin} did not respond (${response.status}).`);
}

/** The iPad's default target: this checkout's dev server on the LAN (launch.json `ipad-root`), started here when none
 * listens. A code change is one reload away; a production build (--built) took 4 minutes of 7,915 pages a change
 * (2026-09-30) while the iPad sat idle. */
async function ensureDevServer(origin: URL): Promise<void> {
  const allowed = new Set([localAddress(), '127.0.0.1', 'localhost']);
  if (origin.protocol !== 'http:' || !allowed.has(origin.hostname) || !origin.port) throw new Error('The iPad dev target is a local HTTP origin on the Mac LAN.');
  const listening = await exec('lsof', ['-nP', '-F', 'p', `-iTCP:${origin.port}`, '-sTCP:LISTEN']).then(result => result.stdout, () => '');
  const pid = listening.split('\n').find(line => /^p\d+$/u.test(line))?.slice(1);
  if (pid) {
    const owner = (await exec('lsof', ['-nP', '-a', '-p', pid, '-d', 'cwd', '-Fn'])).stdout.split('\n').find(line => line.startsWith('n'))?.slice(1);
    if (!owner || resolve(owner) !== root) throw new Error(`Port ${origin.port} belongs to ${owner ?? 'an unknown checkout'}, not ${root}: stop it or pass --origin.`);
    return;
  }
  const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  const child = spawn(process.execPath, [resolve(root, 'node_modules/astro/bin/astro.mjs'), 'dev', '--host', '0.0.0.0', '--port', origin.port],
    { cwd: root, detached: true, stdio: 'ignore', env: { ...process.env, COMMIT_REF: head } });
  child.unref();
  console.error(`Started the dev server on ${origin.origin} (pid ${child.pid}); it keeps running for the next journey.`);
}

async function ensureCurrentBuild(): Promise<void> {
  const built = await stat(resolve(root, 'dist/index.html')).catch(() => null);
  const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  const sourcePaths = ['site', 'src', 'packages', 'astro.config.mts'];
  // Git identifies the sources: a build made from a clean checkout of HEAD is current; any local change rebuilds.
  const status = await exec('git', ['status', '--porcelain', '--', ...sourcePaths], { cwd: root });
  const clean = status.stdout.trim() === '';
  const marker = await readFile(resolve(root, 'dist/.cssearth-performance-build.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (built && clean && marker?.schema === 'cssearth-performance-build@2' && marker.head === head && marker.clean === true) return;
  console.error('Built preview is missing the current performance build; rebuilding before the iPad trace…');
  // The dedicated tracer checkout has its prepared assets installed already.
  // Rebuilding the site does not need to re-run source processing for every journey.
  await exec('pnpm', ['exec', 'astro', 'build', '--mode', 'performance'], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  await writeFile(resolve(root, 'dist/.cssearth-performance-build.json'), JSON.stringify({
    schema: 'cssearth-performance-build@2', head, clean, builtAt: new Date().toISOString(),
  }) + '\n');
}

export async function runIpadJourney(argv: readonly string[]): Promise<string> {
  const runStarted = Date.now();
  const stage = (label: string) => console.error(`iPad ${label}: ${((Date.now() - runStarted) / 1000).toFixed(1)} s`);
  const args = [...argv];
  const live = args.includes('--live');
  if (live) args.splice(args.indexOf('--live'), 1);
  // A production build answers load and byte questions; frames are measured on the dev server, one reload per change.
  const built = args.includes('--built');
  if (built) args.splice(args.indexOf('--built'), 1);
  if (live && built) throw new TypeError('--live and --built name different targets.');
  const scenarioFile = takeOption(args, '--scenario');
  const originText = takeOption(args, '--origin') ?? (live ? 'https://css.earth' : `http://${localAddress()}:${built ? 4212 : 4210}`);
  const name = takeOption(args, '--name') ?? 'ipad-journey';
  const udid = takeOption(args, '--device');
  const native = takeOption(args, '--native') ?? 'off';
  if (!['off', 'page', 'all'].includes(native)) throw new TypeError('--native must be off, page or all.');
  const debug = args.includes('--debug');
  if (debug) args.splice(args.indexOf('--debug'), 1);
  const heapSnapshot = args.includes('--heap-snapshot');
  if (heapSnapshot) args.splice(args.indexOf('--heap-snapshot'), 1);
  const styleWrites = args.includes('--style-writes');
  if (styleWrites) args.splice(args.indexOf('--style-writes'), 1);
  const tail = requireFiniteNumber(Number(takeOption(args, '--tail') ?? '2'), '--tail');
  if (!/^[a-z0-9-]+$/u.test(name)) throw new TypeError('--name needs lowercase words and dashes.');
  if (tail < 0 || tail > 30) throw new RangeError('--tail must be 0–30 seconds.');
  if (scenarioFile && args.length) throw new TypeError('--scenario cannot be combined with ordered journey flags.');
  const journey = scenarioFile ? parseJourney(JSON.parse(await readFile(resolve(scenarioFile), 'utf8'))) : parseJourneyArgs(args);
  if (!journey.start) throw new TypeError('A journey needs --start <object> (or JSON start) so the first iPad view is deterministic.');
  if (!journey.actions.length) throw new TypeError('A journey needs at least one action after its start.');
  const origin = new URL(originText);
  if (origin.pathname !== '/' || origin.search || origin.hash) throw new TypeError('--origin must contain only scheme, host and port.');
  if (live) {
    if (origin.protocol !== 'https:' || origin.username || origin.password) throw new TypeError('--live requires an HTTPS origin without credentials.');
  } else if (built) {
    await ensureCurrentBuild();
    await assertLocalBuiltPreview(origin);
    stage('built preview ready');
  } else {
    await ensureDevServer(origin);
    stage('dev server ready');
  }
  const route = requireSceneObject(journey.start).route;
  const startUrl = new URL(route, origin).href;
  // A dev server compiles a page on its first request: wait for that here, once, not on the iPad.
  const response = await fetch(startUrl, { signal: AbortSignal.timeout(built || live ? 12_000 : 180_000) }).catch(async error => {
    if (built || live) throw error;
    await new Promise(resolve => setTimeout(resolve, 2000));
    return fetch(startUrl, { signal: AbortSignal.timeout(180_000) });
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`The target has no start route ${route} (${response.status}).`);
  const flightSource = live ? 'objectnavigate' : 'scene-router';
  const steps = [...compileJourney(journey, flightSource), ...(tail ? [{ wait: tail }] as const : [])];
  const inputSources = [...new Set(journey.actions.flatMap(action => {
    if ('fly' in action) return [flightSource];
    if ('zoom' in action || 'tap' in action || 'drag' in action || 'type' in action || 'script' in action) return [JOURNEY_INPUT_SOURCE];
    return [];
  }))];
  const temporary = await mkdtemp(join(tmpdir(), 'cssearth-ipad-journey-'));
  const stepsPath = join(temporary, 'steps.json');
  await writeFile(stepsPath, JSON.stringify(steps));
  let deviceSession: IpadDeviceSession | null = null;
  try {
    console.error(`Recording ${journey.start} on the visible iPad Safari tab at ${origin.origin} (${inputSources.length ? inputSources.join(', ') : 'no page input'}).`);
    deviceSession = await startIpadDeviceSession(startUrl, udid);
    stage('visible Safari ready');
    const { out, report } = await captureIosMoment(['--device', ...(udid ? [udid] : []), '--name', name,
      '--expect-url', startUrl, '--steps', stepsPath, '--strict-steps', '--stage-timing', '--no-device-monitors', '--screens',
      // A local preview's source maps do not describe a deployed build.
      '--dist', built ? 'dist' : '', '--settle', '2', '--native', native,
      ...(debug ? ['--debug'] : []), ...(heapSnapshot ? ['--heap-snapshot'] : []), ...(styleWrites ? ['--style-writes'] : [])], deviceSession);
    stage('WebKit capture complete');
    if (!report.filmstrip || report.filmstrip.frames < 1) throw new Error(`Trace ${out} has no native iPad screen frames.`);
    await writeFile(resolve(out, 'journey.json'), JSON.stringify({ schema: 'cssearth-ipad-journey@1', inputSources,
      target: live ? 'live' : built ? 'preview' : 'dev', initialUrl: startUrl, journey, steps, recordedAt: new Date().toISOString() }, null, 2) + '\n');
    const strip = await makeIpadStrip(out);
    await exec(process.execPath, [resolve(root, 'labs/performance/webkit-devtools-trace.mts'), out], { cwd: root });
    stage('trace and filmstrip exported');
    console.log(`Trace: ${resolve(out, 'trace.devtools.json')}`);
    console.log(`Native iPad filmstrip: ${strip}`);
    console.log(`Report: ${resolve(out, 'report.json')}`);
    return out;
  } finally {
    await deviceSession?.close();
    stage('device session closed');
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runIpadJourney(process.argv.slice(2)).catch((error: unknown) => {
    // Some device failures reject with an empty message; the stack still says where.
    console.error(`ipad-run: ${error instanceof Error ? error.message || error.stack || error.name : String(error)}`);
    process.exitCode = 1;
  });
}
