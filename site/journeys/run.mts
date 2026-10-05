/** Browser journey runner; a repeat only passes after exact trace and pixel comparison. */
import { parseArgs } from 'node:util';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, rm, writeFile, readFile, readdir, rename } from 'node:fs/promises';
import { chromium, webkit, type Browser } from 'playwright';
import { startServer } from './harness/server.mts';
import { profiles } from './harness/profiles.mts';
import { recorder } from './harness/recorder.mts';
import { journeyApi } from './harness/api.mts';
import { parseTrace, json } from './harness/trace.mts';
import { installLockstep } from './harness/lockstep.mts';
import { traceHistogram, ambiguousChunks } from './harness/canonical.mts';
import { compareDirectories } from './harness/differ.mts';
import { coverageGate, manifestIds, unreachableIds, validateExercises } from './manifest.mts';
import { combinationReport, combinationContract } from './combinations.mts';
import { parseWrappers } from './harness/binding-sites.mts';
import { parseEntries } from './harness/reachability.mts';
import { signature, qualifications, qualificationFile } from './qualification.mts';
import { journeys, selectJourneys } from './registry.mts';
export async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: { dist: { type: 'string' }, checkout: { type: 'string' }, out: { type: 'string' }, profile: { type: 'string', default: 'chromium-desktop' },
    journey: { type: 'string' }, credit: { type: 'string' }, combinations: { type: 'boolean', default: false }, coverage: { type: 'boolean', default: false }, require: { type: 'boolean', default: false }, gate: { type: 'boolean', default: false }, repeat: { type: 'string', default: '2' } } });
  const ids = await manifestIds();
  validateExercises(journeys, ids);
  if (values.credit) {
    if (!values.journey || !values.profile) throw new Error('Credit needs journey/profile');
    const journey = journeys.find(row => row.id === values.journey);
    if (!journey) throw new Error('Unknown credit journey');
    let observed: string[] | undefined, combinations: string[] | undefined;
    for (let batch = 1; batch <= 4; batch++) {
      const root = resolve(values.credit, `batch-${batch}`);
      const result: unknown = JSON.parse(await readFile(resolve(root, 'reachability.json'), 'utf8'));
      if (!result || typeof result !== 'object' || !('passed' in result) || result.passed !== true || !('repeat' in result) || result.repeat !== 10
        || !('signature' in result) || result.signature !== signature(journey) || !('observed' in result) || !Array.isArray(result.observed)
        || !result.observed.every(id => typeof id === 'string')) throw new Error('Missing exact instrumented ten-capture batch');
      const batchCombinations: unknown = Reflect.get(result, 'combinations');
      if (!Array.isArray(batchCombinations) || !batchCombinations.every(value => typeof value === 'string')) throw new Error('Missing combination observations');
      combinations = combinations === undefined ? batchCombinations : combinations.filter(value => batchCombinations.includes(value));
      const batchObserved = result.observed;
      observed = observed === undefined ? batchObserved : observed.filter(id => batchObserved.includes(id));
      if (batch > 1 && (await compareDirectories(resolve(values.credit, 'batch-1/run-1'), resolve(root, 'run-1'))).length) throw new Error('Qualification boundary differs');
    }
    const evidence = qualifications().filter(row => row.journey !== journey.id || row.profile !== values.profile);
    evidence.push({ journey: journey.id, profile: values.profile, signature: signature(journey), observed: observed ?? [], combinations: combinations ?? [], captures: 40, evidence: relative(process.cwd(), resolve(values.credit)) });
    const pending = new URL('observed-qualification.pending.json', qualificationFile);
    try {
      await writeFile(pending, JSON.stringify(evidence, null, 2) + '\n');
      await rename(pending, qualificationFile);
    } finally { await rm(pending, { force: true }); }
    console.log('CREDITED: 40 exact instrumented captures'); return 0;
  }
  if (values.require && !values.coverage) throw new Error('--require needs --coverage');
  if (values.combinations) {
    const profile = args.some(arg => arg === '--profile' || arg.startsWith('--profile=')) ? values.profile : undefined;
    if (profile && !profiles[profile]) throw new Error('Unknown combination profile');
    const report = combinationReport(journeys, await combinationContract(), qualifications(), profile);
    console.log(report.counts); console.log(JSON.stringify(report, null, 2)); return 0;
  }
  if (values.coverage) {
    if (!profiles[values.profile]) throw new Error(`Unknown profile ${values.profile}`);
    const selectedProfile = args.some(arg => arg === '--profile' || arg.startsWith('--profile=')) ? values.profile : undefined;
    const result = coverageGate(journeys, ids, await unreachableIds(), selectedProfile);
    console.log(result.counts);
    if (values.require) for (const id of result.missing) console.log(`UNREACHED ${id}`);
    else console.log(JSON.stringify(result.report, null, 2));
    return values.require && !result.passed ? 1 : 0;
  }
  if (!values.dist || !values.out) throw new Error('Expected --dist and --out');
  const manifest: unknown = JSON.parse(await readFile(resolve(import.meta.dirname, 'manifest-entries.json'), 'utf8'));
  const entries = parseEntries(manifest), wrappers = parseWrappers(manifest);
  const observedRuns: string[][] = [], combinationRuns: string[][] = [];
  const profile = profiles[values.profile];
  if (!profile) throw new Error(`Unknown profile ${values.profile}`);
  const selected = selectJourneys(values.profile, values.journey, values.gate);
  const repeat = Number(values.repeat);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error('Repeat must be 1..20');
  await mkdir(resolve('output/journeys'), { recursive: true });
  const assetFiles = await readdir(resolve(values.dist, '_astro'));
  const chunkAmbiguities = ambiguousChunks(assetFiles.map(file => '/_astro/' + file));
  const files = assetFiles.filter(file => file.endsWith('.js'));
  const parents = new Map<string, Set<string>>();
  for (const file of files) {
    const source = await readFile(resolve(values.dist, '_astro', file), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/gu)) {
      const target = '/_astro/' + match[1], callers = parents.get(target) ?? new Set<string>();
      callers.add('/_astro/' + file); parents.set(target, callers);
    }
  }
  const volatileInitiators = profile.engine === 'chromium' && !profile.lockstep ? [...parents].filter(([, callers]) => callers.size > 1)
    .sort(([a], [b]) => a.localeCompare(b)).map(([url, callers]) => ({ url, scripts: [...callers].sort(),
      cause: 'Verified concurrent static imports share one deduplicated module request; CDP reports whichever importer wins the real transport race.' })) : [];
  const timings: { stage: string; seconds: number }[] = [];
  const started = Date.now();
  const server = await startServer(values.dist, values.checkout);
  const previousTmp = process.env.TMPDIR;
  const temporary = await mkdtemp(resolve('output/journeys/browser-'));
  process.env.TMPDIR = temporary;
  timings.push({ stage: 'preview', seconds: (Date.now() - started) / 1000 });
  let activeBrowser: Browser | undefined, interrupted = false, assertionFailed = false;
  const interrupt = () => { interrupted = true; process.exitCode = 130; void activeBrowser?.close(); void server.close(); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    for (let run = 1; run <= repeat; run++) {
      const browser = await (profile.engine === 'chromium' ? chromium : webkit).launch({ headless: true });
      activeBrowser = browser;
      if (interrupted) { await browser.close(); return 130; }
      try {
        for (const journey of selected) {
          const at = Date.now(), context = await browser.newContext({ ...profile, serviceWorkers: 'block' }), page = await context.newPage();
          try {
            await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
            await page.clock.pauseAt(new Date('2026-01-01T00:00:00.000Z'));
            const trace = parseTrace({ schema: 'cssearth-journey@1', journey: journey.id, profile: values.profile,
              observed: [], chunkAmbiguities, toolchain: { browser: browser.version(), profile: json(profile), node: process.versions.node }, exercises: journey.exercises,
              observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
            const out = resolve(values.out, `run-${run}`, values.profile, journey.id);
            const scheduler = profile.lockstep ? await installLockstep(page) : null;
            const record = await recorder(page, trace, server.origin, out, profile.engine, { reachability: { dist: values.dist, entries, wrappers, checkout: values.checkout }, volatileInitiators, scheduleWorkers: true, orderings: journey.orderings, causalOrders: files.filter(file => /^scene-router[.]/u.test(file)).map(file => ({ before: '/world/anywhere.json', after: '/_astro/' + file })) });
            try { await journey.run(journeyApi(page, server.origin, record)); scheduler?.check(); await record.observed(); }
            catch (error) {
              assertionFailed = true; record.assertion(error);
              await record.snapshot('journey-assertion');
              console.log(`ASSERTION ${journey.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
            await record.save();
            observedRuns.push(trace.observed ?? []); combinationRuns.push(trace.combinations ?? []);
            timings.push({ stage: `${journey.id}/${values.profile}/run-${run}`, seconds: (Date.now() - at) / 1000 });
            console.log(`RECORDED ${journey.id}/${values.profile}/run-${run} ${(Date.now() - at) / 1000}s`);
          } finally { await context.close(); }
        }
      } finally { await browser.close(); activeBrowser = undefined; }
    }
    let changed = false;
    const histogram = new Map<string, number>();
    for (let run = 2; run <= repeat; run++) {
      const differences = await compareDirectories(resolve(values.out, 'run-1'), resolve(values.out, `run-${run}`));
      for (const journey of selected) {
        const read = async (index: number) => parseTrace(JSON.parse(await readFile(resolve(values.out!, `run-${index}`, values.profile, journey.id, `${journey.id}.trace.json`), 'utf8')));
        for (const [path, count] of traceHistogram(await read(1), await read(run))) histogram.set(path, (histogram.get(path) ?? 0) + count);
      }
      for (const difference of differences) {
        console.log(JSON.stringify(difference));
        if (difference.path.includes('.screenshot.')) { const path = 'rendering.screenshot.pixels'; histogram.set(path, (histogram.get(path) ?? 0) + 1); }
      }
      if (differences.length) changed = true;
    }
    if (selected.length === 1) await writeFile(resolve(values.out, 'reachability.json'), JSON.stringify({ passed: !changed && !assertionFailed, repeat, signature: signature(selected[0]!), combinations: (combinationRuns[0] ?? []).filter(value => combinationRuns.every(row => row.includes(value))), observed: (observedRuns[0] ?? []).filter(id => observedRuns.every(row => row.includes(id))) }, null, 2) + '\n');
    console.log('HISTOGRAM ' + JSON.stringify(Object.fromEntries([...histogram].sort())));
    await writeFile(resolve(values.out, 'histogram.json'), JSON.stringify(Object.fromEntries(histogram), null, 2) + '\n');
    console.log(assertionFailed ? 'JOURNEY ASSERTION FAILED: partial traces saved' : changed ? 'NONDETERMINISTIC' : repeat >= 2 ? 'DETERMINISTIC: exact repeats match' : 'RECORDED: repeat qualification pending');
    return changed || assertionFailed ? 1 : 0;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await server.close();
    if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp;
    await rm(temporary, { recursive: true, force: true });
    await mkdir(values.out, { recursive: true });
    await writeFile(resolve(values.out, 'timings.json'), JSON.stringify(timings, null, 2) + '\n');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(error); if (process.exitCode !== 130) process.exitCode = 2; }
}
