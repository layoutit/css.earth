// Replay oracle for the object mount lifecycle: main's object runtime and the refactor run through the
// object-runtime test harness (real residency, selection and playback; controlled decodes, orbit and waits).
// Every lifecycle event, error, readiness outcome and controller answer is recorded; traces must be identical.
import { writeFileSync } from 'node:fs';
import { harness, earthDefinition } from '../../src/platform/object-runtime.oracle-harness.mts';

type Factory = NonNullable<Parameters<typeof harness>[0]>['runtimeFactory'];
const here = new URL('.', import.meta.url);
const variants: Record<string, Factory> = {
  main: (await import(new URL('runtime-main.mjs', here).href)).createObjectRuntime,
  change: (await import(new URL('runtime-change.mjs', here).href)).createObjectRuntime,
};
const settle = async () => { for (let i = 0; i < 64; i++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); };
type H = ReturnType<typeof harness>;
const message = (error: unknown) => error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error);

async function run(factory: Factory, script: (h: H, record: (label: string) => Promise<void>, trace: unknown[][]) => Promise<void>, options: Parameters<typeof harness>[0] = {}, overrides: Parameters<typeof harness>[1] = {}) {
  const trace: unknown[][] = [];
  let h: H;
  try { h = harness({ ...options, runtimeFactory: factory }, overrides); }
  catch (error) { return [['mount threw', message(error)]]; }
  let readiness = 'pending';
  h.runtime.ready.then(() => { readiness = 'resolved'; }, error => { readiness = `rejected ${message(error)}`; });
  const record = async (label: string) => {
    await settle();
    let capture: unknown;
    try { capture = h.runtime.sharedView.capture()?.camera ?? null; } catch (error) { capture = `threw ${message(error)}`; }
    trace.push([label, readiness, h.errors.map(message), [...h.events], h.runtime.navigation !== undefined, h.runtime.datasets !== undefined,
      JSON.stringify(capture), h.runtime.navigation?.detailActivated?.() ?? null]);
  };
  try { await script(h, record, trace); await record('end'); }
  catch (error) { trace.push(['script threw', message(error)]); }
  finally { try { h.restore(); } catch (error) { trace.push(['restore threw', message(error)]); } }
  await settle();
  trace.push(['after destroy', readiness, h.errors.map(message)]);
  return trace;
}

const never = () => new Promise<void>(() => {});
const scenarios: Record<string, [Parameters<typeof run>[1], Parameters<typeof harness>[0]?, Parameters<typeof harness>[1]?]> = {
  'startup reaches readiness': [async (h, record) => { await record('mounted'); await h.resolveJobs(); await record('decoded'); await h.runtime.ready; await record('ready'); }],
  'datasets, pause and resume after readiness': [async (h, record) => {
    await h.complete(); await record('ready');
    const datasets = h.runtime.datasets; await record(`datasets ${datasets?.ids.join(',') ?? 'none'}`);
    if (datasets) { const other = datasets.ids.find(id => id !== datasets.current()) ?? datasets.ids[0]; const selecting = datasets.select(other); await h.resolveJobs(); const selected = await selecting; await record(`selected ${other} ${selected}`); }
    h.runtime.pause(); await record('paused'); h.runtime.resume(); await record('resumed');
  }, { definition: earthDefinition }],
  'destroy before the document is ready': [async (h, record) => { await record('waiting'); h.runtime.destroy(); await record('destroyed'); }, {}, { waitDocument: never }],
  'destroy while decodes never settle': [async (h, record) => { await record('mounted'); h.runtime.destroy(); await record('destroyed'); await h.resolveJobs().catch(() => {}); await record('late decodes'); }],
  'destroy after activation, before the paint': [async (h, record) => { await h.resolveJobs(); await record('activated'); h.runtime.destroy(); await record('destroyed'); }, {}, { waitPaint: never }],
  'a failed decode rejects readiness': [async (h, record) => { await settle(); h.jobs[0]?.reject(new Error('decode failed')); await record('rejected'); await h.resolveJobs().catch(() => {}); await record('rest'); }],
  'a fatal orbit error before readiness rejects it': [async (h, record) => { await settle(); await h.resolveJobs(); h.orbitArguments().onError?.(new Error('camera failed early')); await record('fatal'); }, {}, { waitPaint: never }],
  'a fatal orbit error after readiness reports once': [async (h, record) => { await h.complete(); await record('ready'); h.orbitArguments().onError?.(new Error('camera failed late')); await record('fatal'); h.orbitArguments().onError?.(new Error('again')); await record('second'); }],
  'a cleanup failure after readiness is fatal': [async (h, record) => { await h.complete(); h.resourceOptions().onCleanupError?.(new Error('cleanup failed')); await record('cleanup failed'); }],
  'a warm decode failure is recoverable': [async (h, record) => { await h.complete(); h.resourceOptions().onWarmError?.(new Error('warm failed')); await record('warm failed'); }],
  'shared view restore round trip': [async (h, record, trace) => {
    await h.complete(); const saved = h.runtime.sharedView.capture(); await record('captured');
    if (saved) { try { trace.push(['restore', await h.runtime.sharedView.restore(saved)]); } catch (error) { trace.push(['restore threw', message(error)]); } }
    await record('restored');
  }],
  'destroy twice': [async (h, record) => { await h.complete(); h.runtime.destroy(); h.runtime.destroy(); await record('destroyed twice'); }],
};
if (process.argv[2]) { const [script, options, overrides] = scenarios[process.argv[2]]; for (const entry of await run(variants.change, script, options, overrides)) console.log(JSON.stringify(entry).slice(0, 220)); process.exit(0); }
let identical = 0;
const report: Record<string, unknown> = {};
for (const [name, [script, options, overrides]] of Object.entries(scenarios)) {
  const main = await run(variants.main, script, options, overrides), change = await run(variants.change, script, options, overrides);
  const index = main.findIndex((entry, i) => JSON.stringify(entry) !== JSON.stringify(change[i]));
  const same = index === -1 && main.length === change.length;
  if (same) identical++;
  const outcome = main.filter(entry => typeof entry[1] === 'string').map(entry => entry[1]).at(-1);
  report[name] = { records: main.length, identical: same, readiness: outcome, ...(same ? {} : { main: main[index] ?? null, change: change[index] ?? null }) };
  console.log(`${same ? 'same' : 'DIFF'}  ${name}  (${main.length} records; readiness ${outcome})`);
  if (!same) console.log('   main:  ', JSON.stringify(main[index]).slice(0, 400), '\n   change:', JSON.stringify(change[index]).slice(0, 400));
}
writeFileSync(new URL('oracle-report.json', here), JSON.stringify(report, null, 1));
console.log(`${identical}/${Object.keys(scenarios).length} scenarios identical`);
