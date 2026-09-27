#!/usr/bin/env node
/** Run an ordered cssEarth journey in the visible iPad Safari tab with a trace and native screen filmstrip. */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { requireFiniteNumber } from '@cssearth/core';
import { requireSceneObject } from '../../site/objects.mts';
import { captureIosMoment } from './ios-capture.mts';
import { startIpadDeviceSession, type IpadDeviceSession } from './ipad-device-session.mts';
import { JOURNEY_INPUT_SOURCE, compileJourney, parseJourney, parseJourneyArgs } from './ipad-journey.mts';
import { makeIpadStrip } from './ipad-strip.mts';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');

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
  if (!/\b(?:astro|vite)(?:\.mjs)?\s+preview\b/u.test(command) && !command.includes('tools/cli/preview.mts'))
    throw new Error(`Port ${origin.port} is not a built preview. Server: ${command.trim()}`);
  const response = await fetch(new URL('/index.html', origin), { signal: AbortSignal.timeout(12_000) });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Built preview on ${origin.origin} did not respond (${response.status}).`);
}

async function ensureCurrentBuild(): Promise<void> {
  const built = await stat(resolve(root, 'dist/index.html')).catch(() => null);
  const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  const sourcePaths = ['site', 'src', 'packages', 'astro.config.mts', 'tools/prepared', 'tools/prepare'];
  const diff = await exec('git', ['diff', '--binary', 'HEAD', '--', ...sourcePaths], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const untracked = await exec('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', ...sourcePaths], { cwd: root });
  const digest = createHash('sha256').update(diff.stdout);
  for (const path of untracked.stdout.split('\0').filter(Boolean)) digest.update(path).update(await readFile(resolve(root, path)));
  const sourceDigest = digest.digest('hex');
  const marker = await readFile(resolve(root, 'dist/.cssearth-performance-build.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (built && marker?.schema === 'cssearth-performance-build@1' && marker.head === head && marker.sourceDigest === sourceDigest) return;
  console.error('Built preview is missing the current performance build; rebuilding before the iPad trace…');
  // The dedicated tracer checkout has its prepared assets installed already.
  // Rebuilding the site does not need to re-run source processing for every journey.
  await exec('pnpm', ['exec', 'astro', 'build', '--mode', 'performance'], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  await writeFile(resolve(root, 'dist/.cssearth-performance-build.json'), JSON.stringify({
    schema: 'cssearth-performance-build@1', head, sourceDigest, builtAt: new Date().toISOString(),
  }) + '\n');
}

export async function runIpadJourney(argv: readonly string[]): Promise<string> {
  const runStarted = Date.now();
  const stage = (label: string) => console.error(`iPad ${label}: ${((Date.now() - runStarted) / 1000).toFixed(1)} s`);
  const args = [...argv];
  const live = args.includes('--live');
  if (live) args.splice(args.indexOf('--live'), 1);
  const scenarioFile = takeOption(args, '--scenario');
  const originText = takeOption(args, '--origin') ?? (live ? 'https://css.earth' : `http://${localAddress()}:4212`);
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
  } else {
    await ensureCurrentBuild();
    await assertLocalBuiltPreview(origin);
    stage('built preview ready');
  }
  const route = requireSceneObject(journey.start).route;
  const startUrl = new URL(route, origin).href;
  const response = await fetch(startUrl, { signal: AbortSignal.timeout(12_000) });
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
      '--dist', live ? '' : 'dist', '--settle', '2', '--native', native,
      ...(debug ? ['--debug'] : []), ...(heapSnapshot ? ['--heap-snapshot'] : []), ...(styleWrites ? ['--style-writes'] : [])], deviceSession);
    stage('WebKit capture complete');
    if (!report.filmstrip || report.filmstrip.frames < 1) throw new Error(`Trace ${out} has no native iPad screen frames.`);
    await writeFile(resolve(out, 'journey.json'), JSON.stringify({ schema: 'cssearth-ipad-journey@1', inputSources,
      target: live ? 'live' : 'preview', initialUrl: startUrl, journey, steps, recordedAt: new Date().toISOString() }, null, 2) + '\n');
    const strip = await makeIpadStrip(out);
    await exec(process.execPath, [resolve(root, 'tools/performance/webkit-devtools-trace.mts'), out], { cwd: root });
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
    console.error(`ipad-run: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
