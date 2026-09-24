// Replay oracle for the selection runtime: main's and the refactor's receive identical scripted demand through the
// object-selection test harness (Earth's real plan, real residency and presentation; controlled decodes and timers).
// Records every state change, commit (with its intent), fatal and material error, decode request and stats snapshot.
// The new `committedBy` field is checked separately: it must equal the intent of the latest commit.
import { writeFileSync } from 'node:fs';
import { harness, earthDefinition, useSelectionRuntime } from '../../src/platform/object-selection.oracle-harness.mts';

const here = new URL('.', import.meta.url);
type Factory = Parameters<typeof useSelectionRuntime>[0];
const variants: Record<string, Factory> = {
  main: (await import(new URL('selection-main.mjs', here).href)).createObjectSelectionRuntime,
  change: (await import(new URL('selection-change.mjs', here).href)).createObjectSelectionRuntime,
};
type H = ReturnType<typeof harness>;
const lenses = earthDefinition.controls.lenses!.controls.map(control => control.id);
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const settle = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

async function run(factory: Factory, script: (h: H, record: (label: string) => void, trace: unknown[][]) => Promise<void>, options: Parameters<typeof harness>[0] = {}) {
  useSelectionRuntime(factory);
  const trace: unknown[][] = [], problems: string[] = [];
  const h = harness(options);
  const summary = (state: Readonly<Record<string, unknown>>) => {
    const { plan, committedBy: _new, ...rest } = state as Record<string, unknown> & { plan: { required?: readonly string[] } | null };
    return JSON.stringify({ ...rest, required: plan?.required?.length ?? null });
  };
  const record = (label: string) => {
    const stats = h.coordinator.stats() as Record<string, unknown>;
    trace.push([label, summary(stats), h.changes.length, h.commits.length, h.fatal.map(message), h.materialErrors.map(message), h.jobs.length, h.jobs.filter(job => !job.done).length]);
    // The refactor's own contract: the committed selection names the request that produced it.
    if ('committedBy' in stats && stats.committed) {
      const last = (h.commits.at(-1) as { intent?: unknown } | undefined)?.intent;
      if (JSON.stringify(stats.committedBy) !== JSON.stringify(last)) problems.push(`${label}: committedBy ${JSON.stringify(stats.committedBy)} ≠ last commit ${JSON.stringify(last)}`);
    }
  };
  const settleAll = async (label: string) => { await h.resolveJobs().catch(error => trace.push(['resolve threw', message(error)])); await settle(); record(label); };
  try { await script(h, record, trace); await settle(); record('end'); }
  catch (error) { trace.push(['script threw', message(error)]); }
  trace.push(['changes', h.changes.map(state => summary(state as never))]);
  trace.push(['commits', h.commits.map(commit => [commit.selection.lensId, commit.selection.speed ?? null, (commit as { intent?: unknown }).intent])]);
  try { h.lifetime.destroy(); } catch (error) { trace.push(['destroy threw', message(error)]); }
  void settleAll;
  return { trace, problems };
}
const done = (h: H) => h.resolveJobs().catch(() => {});
/** A near globe: its projected size asks for a finer texture level, which the runtime loads as a frame request. */
const near = (h: H) => h.coordinator.setView({ ...h.currentView(), levelOfDetail: { stage: 'geometry', silhouetteDiameter: 1000, billboardOpacity: 0, markerOpacity: 0 } });
const scenarios: Record<string, [Parameters<typeof run>[1], Parameters<typeof harness>[0]?]> = {
  'startup commits the native dataset': [async (h, record) => { record('started'); await h.ready(); record('ready'); }],
  'A/B/A lens race': [async (h, record) => {
    await h.ready(); const b = h.lens(lenses[1]!); record('B requested'); const a = h.lens(lenses[0]!); record('A requested');
    await done(h); trace(await Promise.all([a, b])); record('settled');
    function trace(results: boolean[]) { record(`results ${results.join(',')}`); }
  }],
  'three quick lenses, only the last commits': [async (h, record) => {
    await h.ready(); const results = [h.lens(lenses[1]!), h.lens(lenses[2] ?? lenses[0]!), h.lens(lenses[1]!)]; record('three requested');
    await done(h); record(`results ${(await Promise.all(results)).join(',')}`);
  }],
  'view changes while a lens decodes': [async (h, record) => {
    await h.ready(); const pending = h.lens(lenses[1]!); record('requested'); h.view(2); record('view moved'); h.view(2, 1); record('within row');
    await done(h); record(`result ${await pending}`);
  }],
  'a nearer globe asks for finer material (frame request)': [async (h, record) => { await h.ready(); near(h); record('near'); await done(h); record('refined'); h.view(1); record('moved'); await done(h); record('settled'); }],
  'a lens supersedes a frame request': [async (h, record) => { await h.ready(); near(h); record('frame requested'); const lens = h.lens(lenses[1]!); record('lens requested'); await done(h); record(`lens ${await lens}`); }],
  'a frame request supersedes nothing while a lens decodes': [async (h, record) => { await h.ready(); const lens = h.lens(lenses[1]!); record('lens requested'); near(h); record('nearer'); await done(h); record(`lens ${await lens}`); }],
  'decode failure then retry': [async (h, record) => {
    await h.ready(); const failing = h.lens(lenses[1]!); await settle(); await settle();
    for (const job of h.jobs.filter(job => !job.done)) { job.done = true; job.reject(new Error(`decode failed ${job.url}`)); }
    record(`failed ${await failing.catch(error => `threw ${message(error)}`)}`);
    const retry = h.lens(lenses[1]!); await done(h); record(`retry ${await retry}`);
  }],
  'an aborted dataset signal before decoding': [async (h, record) => {
    await h.ready(); const controller = new AbortController(); const pending = h.coordinator.dispatch({ kind: 'lens', id: lenses[1]! }, { signal: controller.signal });
    record('requested'); controller.abort(); record(`aborted ${await pending}`); await done(h); record('settled');
  }],
  'an already aborted signal cannot replace a newer selection': [async (h, record) => {
    await h.ready(); const newer = h.lens(lenses[1]!); const controller = new AbortController(); controller.abort();
    const stale = h.coordinator.dispatch({ kind: 'lens', id: lenses[0]! }, { signal: controller.signal }); record(`stale ${await stale}`); await done(h); record(`newer ${await newer}`);
  }],
  'a dispatch that must not frame the camera': [async (h, record) => { await h.ready(); const pending = h.coordinator.dispatch({ kind: 'lens', id: lenses[1]! }, { frameCamera: false }); await done(h); record(`result ${await pending}`); }],
  'destroy with a pending lens': [async (h, record) => { await h.ready(); const pending = h.lens(lenses[1]!); record('requested'); h.coordinator.destroy(); record('destroyed'); await done(h); record(`result ${await pending}`); }],
  'destroy during startup': [async (h, record) => { record('started'); h.coordinator.destroy(); await done(h); record(`initial ${await h.initialReady}`); }],
  'deferred refinement waits for refineTextures': [async (h, record) => { await h.ready(); near(h); await done(h); record('near, still coarse'); h.coordinator.refineTextures(); record('released'); await done(h); record('refined'); }, { deferTextureRefinement: true }],
  'a view change during a supersede keeps demand': [async (h, record) => {
    await h.ready(); const first = h.lens(lenses[1]!); await settle(); h.view(1); const second = h.lens(lenses[0]!); h.view(2); record('moved');
    await done(h); record(`results ${(await Promise.all([first, second])).join(',')}`);
  }],
};
if (process.argv[2]) { const [script, options] = scenarios[process.argv[2]]; for (const entry of (await run(variants.change, script, options)).trace) console.log(JSON.stringify(entry).slice(0, 260)); process.exit(0); }
let identical = 0, contractProblems = 0;
const report: Record<string, unknown> = {};
for (const [name, [script, options]] of Object.entries(scenarios)) {
  const main = await run(variants.main, script, options), change = await run(variants.change, script, options);
  const thrown = main.trace.find(entry => entry[0] === 'script threw');
  if (thrown) console.log(`   SCRIPT THREW in ${name}: ${thrown[1]}`);
  const index = main.trace.findIndex((entry, i) => JSON.stringify(entry) !== JSON.stringify(change.trace[i]));
  const same = index === -1 && main.trace.length === change.trace.length;
  if (same) identical++;
  contractProblems += change.problems.length;
  const commits = (main.trace.find(entry => entry[0] === 'commits')?.[1] as unknown[] | undefined)?.length ?? 0;
  const changes = (main.trace.find(entry => entry[0] === 'changes')?.[1] as unknown[] | undefined)?.length ?? 0;
  report[name] = { records: main.trace.length, commits, stateChanges: changes, identical: same, committedByProblems: change.problems,
    ...(same ? {} : { main: main.trace[index] ?? null, change: change.trace[index] ?? null }) };
  console.log(`${same ? 'same' : 'DIFF'}  ${name}  (${commits} commits, ${changes} state changes${change.problems.length ? `, ${change.problems.length} committedBy problems` : ''})`);
  if (!same) console.log('   main:  ', JSON.stringify(main.trace[index]).slice(0, 300), '\n   change:', JSON.stringify(change.trace[index]).slice(0, 300));
  for (const problem of change.problems) console.log('   ', problem);
}
writeFileSync(new URL('oracle-report.json', here), JSON.stringify(report, null, 1));
console.log(`${identical}/${Object.keys(scenarios).length} scenarios identical; committedBy problems: ${contractProblems}`);
