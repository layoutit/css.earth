import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createObjectSelectionRuntime } from '../renderers/css/dist/testing.js';
import { createPreparedResidency } from '../renderers/css/dist/testing.js';
import { retainedPresentationFixture, preparedSelectionFixture } from "./test/object-runtime-package.mts";
import { mountPreparedPresentation } from '../renderers/css/dist/testing.js';
import { parsePreparedObjectRuntime } from '../renderers/css/dist/index.js';
import type { ObjectSelection } from '../renderers/css/runtime/object-contract.ts';
import type { ObjectRuntimeDefinition } from '../renderers/css/runtime/object-runtime-types.ts';
import type { ObjectSelectionState } from '../renderers/css/rendering/object-selection-runtime.ts';
import type { PreparedImage } from '../renderers/css/rendering/prepared-image-store.ts';
import type { PreparedResidencyTicket } from '../renderers/css/rendering/prepared-residency.ts';
import type { PreparedPresentationContext, PreparedPresentationPlan, PreparedView } from '../renderers/css/rendering/prepared-presentation.ts';
const earthDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('earth'));
const saturnDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('saturn'));
import { requireObjectRuntimeDefinition } from "../../tools/contract/object-runtime-contract.mts";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mts";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
// The actual Earth plan provides independent lighting and atmosphere row demand.
// Only native image completion and DOM setters are controlled by these tests.
interface ImageJob { url: string; image: ControlledImage; resolve(): void; reject(error: unknown): void; done: boolean; }
class ControlledImage implements PreparedImage {
  naturalWidth = 1; naturalHeight = 1; src = ""; decoding: "async" = "async";
  private readonly definition: ObjectRuntimeDefinition;
  private readonly jobs: ImageJob[];
  constructor(definition: ObjectRuntimeDefinition, jobs: ImageJob[]) { this.definition = definition; this.jobs = jobs; }
  decode(): Promise<void> {
    this.naturalWidth = (this.definition.assets.entries.find(entry => entry.url === this.src)?.decodedBytes ?? 4) / 4;
    return new Promise<void>((resolve, reject) => this.jobs.push({ url: this.src, image: this, resolve, reject, done: false }));
  }
  removeAttribute(name: string): void { if (name === "src") this.src = ""; }
}
interface HarnessOptions {
  initialLens?: string;
  onTicket?: (ticket: PreparedResidencyTicket) => void;
  onChange?: (state: Readonly<ObjectSelectionState>) => void;
  deferTextureRefinement?: boolean;
}
function harness({ onTicket, onChange, deferTextureRefinement, initialLens }: HarnessOptions = {}) {
  const definition = earthDefinition, f = retainedPresentationFixture(definition);
  const jobs: ImageJob[] = [], commits: { selection: ObjectSelection; plan: PreparedPresentationPlan }[] = [], changes: Readonly<ObjectSelectionState>[] = [], fatal: unknown[] = [], materialErrors: unknown[] = [], created: ReturnType<typeof f.document.createElement>[] = [];
  const createElement = f.document.createElement;
  f.document.createElement = tag => { const node = createElement(tag); created.push(node); return node; };
  const timers = new Map(); let nextTimer = 0;
  const schedule = ((callback: () => void): number => { timers.set(++nextTimer, callback); return nextTimer; }) as unknown as typeof setTimeout;
  const unschedule = ((id: number): void => { timers.delete(id); }) as unknown as typeof clearTimeout;
  const resources = createPreparedResidency({ assets: definition.assets, schedule, unschedule,
    createImage: () => new ControlledImage(definition, jobs) });
  f.lifetime.onDispose(() => resources.destroy());
  const residency = { ...resources, request(plan: Parameters<typeof resources.request>[0], options?: Parameters<typeof resources.request>[1]) {
    const ticket = resources.request(plan, options); onTicket?.(ticket); return ticket;
  } };
  const presentationContext: PreparedPresentationContext & { resources: typeof resources.resources } = { ...f.context, resources: resources.resources };
  const presentation = mountPreparedPresentation(f.stage, presentationContext, definition);
  const coordinator = createObjectSelectionRuntime({ definition, presentation, residency, lifetime: f.lifetime,
    deferTextureRefinement, initialLens,
    onChange: state => { changes.push(state); onChange?.(state); }, onCommit: (selection, plan) => commits.push({ selection, plan }),
    onFatalError(error) { fatal.push(error); f.lifetime.destroy(); }, onMaterialError: error => materialErrors.push(error) });
  f.lifetime.onDispose(() => coordinator.destroy());
  let revision = 0, currentView: PreparedView | undefined;
  function view(row: number, withinRow = 0): PreparedView {
    const track = definition.materials[1], frame = 20 + row * 32 + withinRow;
    const z = frame / (track.frame.indices.length - 1) * 2 - 1;
    const direction: readonly [number, number, number] = [Math.sqrt(1 - z * z), 0, z];
    const next: PreparedView = { controlPitch: 37, controlYaw: 10, zoom: definition.camera.defaultZoom,
      levelOfDetail: { stage: 'geometry', silhouetteDiameter: 100, billboardOpacity: 0, markerOpacity: 0 },
      revision: ++revision, sceneMatrix: matrix, counterRotation: matrix, counterRotationFor: () => matrix,
      sunViewDirection: direction, reference: currentView?.reference, };
    next.reference = currentView?.reference ?? next; currentView = next; coordinator.setView(next); return next;
  }
  view(0); const initialReady = coordinator.start();
  async function resolveJobs({ exclude = [] }: { exclude?: readonly ImageJob[] } = {}) {
    for (let wave = 0; wave < 45; wave++) {
      await flush(); const queued = [...timers.values()]; timers.clear(); for (const callback of queued) callback(); await flush();
      const pending = jobs.filter(job => !job.done && !exclude.includes(job));
      if (!pending.length) return;
      pending.forEach(job => { job.done = true; job.resolve(); });
    }
    throw new Error("Real prepared resource queue did not settle.");
  }
  async function ready() { await resolveJobs(); assert.equal(await initialReady, true); }
  return { ...f, resources, coordinator, presentation, created, jobs, commits, changes, fatal, materialErrors,
    view, currentView: (): PreparedView => { assert.ok(currentView); return currentView; }, initialReady, ready, resolveJobs,
    lens: (id: string) => coordinator.dispatch({ kind: "lens", id }),
    frameCount: () => presentation.observe().presentation.framePublications,
    atmosphereTarget: () => created[definition.materials[1].target],
  };
}

test('the native dataset is the first desired and committed selection', async t => {
  const h = harness({ initialLens: 'topography' }); t.after(h.restore);
  assert.equal(h.coordinator.state().desired.lensId, 'topography');
  await h.ready();
  assert.equal(h.commits[0].selection.lensId, 'topography');
  assert.equal(h.coordinator.state().committed?.lensId, 'topography');
  assert.ok(h.changes.every(state => state.desired.lensId === 'topography'));
});

test('initial coarse commit remains successful when its publication immediately requests refinement', async t => {
  let h!: ReturnType<typeof harness>; let requested = false;
  h = harness({ onChange(state) {
    if (!state.committed || requested) return;
    requested = true;
    h.coordinator.setView({ ...h.currentView(), levelOfDetail: { stage: 'geometry', silhouetteDiameter: 1000, billboardOpacity: 0, markerOpacity: 0 } });
  } });
  t.after(h.restore); await h.ready();
  const initialCommit = h.commits[0], finalCommit = h.commits.at(-1); assert.ok(initialCommit); assert.ok(finalCommit);
  // The first pass is the prepared 512 bank the page already shows; Earth's fixed level follows it.
  assert.equal(initialCommit.plan.textureLevel, 0);
  assert.equal(finalCommit.plan.textureLevel, 2);
  assert.deepEqual(h.fatal, []);
});
test('URL restoration admits no default-camera detail before the router releases refinement', async t => {
  const h = harness({ deferTextureRefinement: true }); t.after(h.restore); await h.ready();
  h.coordinator.setView({ ...h.currentView(), levelOfDetail: { stage: 'geometry', silhouetteDiameter: 1000, billboardOpacity: 0, markerOpacity: 0 } });
  await h.resolveJobs();
  // Until the router releases refinement the body keeps the prepared 512 bank, whatever the camera shows.
  const coarsePlan = h.coordinator.state().plan; assert.ok(coarsePlan); assert.equal(coarsePlan.textureLevel, 0);
  assert(!h.jobs.some(job => /-level-(1024|2048|4096)\.webp/.test(job.url)));
  h.coordinator.setView(h.currentView()); // saved distant view
  h.coordinator.refineTextures(); await h.resolveJobs();
  const restoredPlan = h.coordinator.state().plan; assert.ok(restoredPlan); assert.equal(restoredPlan.textureLevel, 2);
});

test("camera movement during startup keeps the pinned atmosphere rows and still settles", async t => {
  const h = harness(); t.after(h.restore); await flush();
  const atmosphere = h.jobs.filter(job => job.url.includes("atmosphere")); assert.ok(atmosphere.length);
  let settled = false; h.initialReady.then(() => { settled = true; });
  h.view(1); await flush(); assert.equal(settled, false);
  // Earth's flood lighting pins the atmosphere to its full-phase frame, so moving the camera asks for
  // no new row: startup keeps waiting on exactly the rows it already planned, and none is obsolete.
  assert.deepEqual(h.jobs.filter(job => job.url.includes("atmosphere")), atmosphere);
  await h.resolveJobs(); assert.equal(await h.initialReady, true);
  const startupCommit = h.commits[0]; assert.ok(startupCommit); assert.equal(h.commits.length, 1); assert.equal(startupCommit.plan.materials.atmosphere.frame, 127);
  atmosphere[0]!.reject(new Error("late")); await flush(); assert.deepEqual(h.fatal, []);
});
test("A/B/A lens races retain the real active page group and only the latest action commits", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const first = h.lens("topography"); await flush(); const obsolete = h.jobs.at(-1); assert.ok(obsolete);
  const next = h.lens("normal"); await h.resolveJobs({ exclude: [obsolete] });
  assert.deepEqual(await Promise.all([first, next]), [false, true]);
  const normal = h.coordinator.state().committed; assert.ok(normal); assert.equal(normal.lensId, "normal");
  assert.equal(h.commits.some(value => value.selection.lensId === "topography"), false);
  obsolete.reject(new Error("late")); await flush(); assert.deepEqual(h.fatal, []);
});
test("view changes during pending lens decoding publish current registration and commit current material demand", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const before = h.atmosphereTarget().style.backgroundImage, frames = h.frameCount();
  const request = h.lens("topography"); await flush(); h.view(2);
  const committedNormal = h.coordinator.state().committed; assert.ok(committedNormal); assert.ok(h.frameCount() > frames); assert.equal(committedNormal.lensId, "normal");
  assert.equal(h.atmosphereTarget().style.backgroundImage, before);
  await h.resolveJobs(); assert.equal(await request, true);
  const topographyCommit = h.commits.at(-1); assert.ok(topographyCommit); assert.equal(topographyCommit.selection.lensId, "topography"); assert.equal(topographyCommit.plan.materials.atmosphere.frame, 127);
});
test("same resource demand is coalesced across lens and speed actions", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const lens = h.lens("topography"); await flush(); const count = h.jobs.length;
  const speed = h.coordinator.dispatch({ kind: "cycle", name: "speed", value: 3 }); await flush();
  assert.equal(h.jobs.length, count); await h.resolveJobs(); assert.deepEqual(await Promise.all([lens, speed]), [false, true]);
  const topography = h.coordinator.state().committed; assert.ok(topography); assert.equal(topography.speed, 3); assert.equal(topography.lensId, "topography");
});
test("decode failure preserves the actual committed plan and pages, and a retry clears the error", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const committed = h.coordinator.state().plan;
  const failed = h.lens("topography"), rejected = assert.rejects(failed, /decode/); await flush();
  const job = h.jobs.findLast(job => !job.done); assert.ok(job); job.done = true; job.reject(new Error("network")); await rejected;
  assert.equal(h.coordinator.state().desired.lensId, "normal"); assert.equal(h.coordinator.state().plan, committed);
  assert.ok(committed); assert.ok(committed.required.every(key => h.resources.resources.has(key))); assert.equal(h.coordinator.state().pending, false);
  const retry = h.lens("topography"); await h.resolveJobs(); assert.equal(await retry, true);
  assert.equal(h.coordinator.state().error, null); assert.notEqual(h.coordinator.state().plan, committed); assert.deepEqual(h.fatal, []);
});
test("Saturn's actual cutaway is exclusive and repeated selection stays selected", async t => {
  const h = await preparedSelectionFixture(saturnDefinition); t.after(h.restore);
  const a = h.selection.dispatch({ kind: "lens", id: "methane" }); await h.flush();
  const b = h.selection.dispatch({ kind: "lens", id: "cross-section" });
  const c = h.selection.dispatch({ kind: "toggle", name: "rings", value: false });
  await h.settle(); assert.deepEqual(await Promise.all([a, b, c]), [false, false, true]);
  const cutaway = h.selection.state().committed; assert.ok(cutaway); assert.equal(cutaway.lensId, "cross-section"); assert.equal(cutaway.rings, false);
  assert.equal(Object.hasOwn(cutaway, "interior"), false);
  const again = h.selection.dispatch({ kind: "lens", id: "cross-section" }); await h.settle(); assert.equal(await again, true);
  assert.deepEqual(h.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["cross-section"]);
  const exterior = h.selection.dispatch({ kind: "lens", id: "methane" }); await h.settle(); assert.equal(await exterior, true);
  const methane = h.selection.state().committed; assert.ok(methane); assert.equal(methane.lensId, "methane");
});
// Earth's flood lighting pins the atmosphere to its full-phase frame, so a camera move asks for no
// new row and there is no row miss to recover from. The row-miss path itself is exercised by a
// directional body in prepared-illumination-consumers.test.mts; this asserts the pinned contract.
test("the flood-lit atmosphere holds its real material when the camera moves", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  // Settle Earth's fixed 2048 level first, as the object runtime does right after readiness.
  h.coordinator.setView(h.currentView()); await h.resolveJobs();
  const image = h.atmosphereTarget().style.backgroundImage;
  const jobs = h.jobs.length;
  h.view(1); assert.equal(h.atmosphereTarget().style.backgroundImage, image); await flush();
  assert.equal(h.coordinator.state().pending, false); assert.equal(h.coordinator.state().loadingMaterial, false);
  assert.equal(h.jobs.length, jobs); assert.equal(h.atmosphereTarget().style.backgroundImage, image);
  const rowPlan = h.coordinator.state().plan; assert.ok(rowPlan); assert.equal(rowPlan.materials.atmosphere.frame, 127);
});
test("a native selection write failure retires the session with no successful control tail", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const before = h.changes.length;
  const topographyVariant = earthDefinition.variants.find(variant => variant.when.lensId === "topography"); assert.ok(topographyVariant);
  const binding = topographyVariant.writes.find(write => write.kind === "texture" && write.resource !== null);
  assert.ok(binding); const target = binding.target === -1 ? h.stage : h.created[binding.target]; assert.ok(target);
  if (binding.name.startsWith("--")) {
    const set = target.style.setProperty.bind(target.style);
    target.style.setProperty = (name, value) => { if (name === binding.name) throw new Error("native selection write failed"); return set(name, value); };
  } else Object.defineProperty(target.style, binding.name, { set() { throw new Error("native selection write failed"); } });
  const request = h.lens("topography"), rejected = assert.rejects(request, /native selection write failed/);
  await h.resolveJobs(); await rejected; assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
  assert.ok(h.changes.slice(before).every(change => change.pending)); assert.equal(h.resources.stats().images.entries.length, 0);
});
test("destroy cancels pending actions promptly and late decoder callbacks remain inert", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const request = h.lens("topography"); await flush();
  const job = h.jobs.at(-1), count = h.coordinator.stats().framePublications; assert.ok(job); h.lifetime.destroy(); assert.equal(await request, false);
  job.reject(new Error("late")); h.view(2); await flush();
  assert.equal(h.coordinator.stats().framePublications, count); assert.equal(h.commits.length, 1); assert.deepEqual(h.fatal, []);
});
test("camera movement in the prepared-ticket promise handoff retries the original action", async t => {
  let h!: ReturnType<typeof harness>; let armed = false, fired = false;
  h = harness({ onTicket(ticket) { ticket.ready.then(ready => {
    if (ready && armed && !fired) { fired = true; queueMicrotask(() => h.view(2)); }
  }).catch(() => {}); } }); t.after(h.restore); await h.ready(); armed = true;
  const request = h.lens("topography"); await h.resolveJobs(); assert.equal(await request, true);
  const retryCommit = h.commits.at(-1); assert.ok(retryCommit); assert.equal(fired, true); assert.equal(retryCommit.plan.materials.atmosphere.frame, 127);
  assert.equal(h.commits.length, 2); assert.deepEqual(h.fatal, []); assert.ok(h.coordinator.stats().passes >= 2);
});
test("package reducers and resolvers are rejected before hidden work can start", () => {
  for (const name of ["reduceSelection", "resolvePresentation"]) {
    let ran = false;
    assert.throws(() => requireObjectRuntimeDefinition({ ...earthDefinition, [name]() { ran = true; return Promise.resolve(); } }), /acyclic JSON|unsupported/);
    assert.equal(ran, false);
  }
});
test("same-row facts advance only after a successful shared native frame publication", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const jobs = h.jobs.length, commits = h.commits.length;
  h.view(0, 1); const sameRowPlan = h.coordinator.state().plan; assert.ok(sameRowPlan); assert.equal(sameRowPlan.materials.atmosphere.frame, 127);
  assert.equal(h.jobs.length, jobs); assert.equal(h.commits.length, commits); const successful = h.coordinator.state().plan;
  const binding = earthDefinition.viewBindings.find(binding => binding.kind === "counter-rotation"); assert.ok(binding);
  Object.defineProperty(h.created[binding.target].style, "transform", { configurable: true, get() { throw new Error("native frame failed"); } });
  assert.throws(() => h.view(0, 2), /native frame failed/); assert.equal(h.coordinator.state().plan, successful);
  assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
});

test('an aborted dataset request settles before decoding and retains the committed scene', async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const signal = new AbortController(), committed = h.coordinator.state().plan;
  const request = h.coordinator.dispatch({ kind: 'lens', id: 'topography' }, { signal: signal.signal });
  await flush(); const late = h.jobs.findLast(job => !job.done); assert.ok(late);
  signal.abort(); assert.equal(await request, false);
  assert.equal(h.coordinator.state().pending, false);
  const normalAfterAbort = h.coordinator.state().committed; assert.ok(normalAfterAbort); assert.equal(normalAfterAbort.lensId, 'normal');
  assert.equal(h.coordinator.state().desired.lensId, 'normal');
  assert.equal(h.coordinator.state().plan, committed);
  late.reject(new Error('late cancelled decoder')); await flush();
  assert.equal(h.commits.length, 1); assert.deepEqual(h.fatal, []);
  const retry = h.lens('topography'); await h.resolveJobs(); assert.equal(await retry, true);
});

test('an already aborted dataset signal cannot replace a newer selection', async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const aborted = new AbortController(); aborted.abort();
  const next = h.lens('topography');
  assert.equal(await h.coordinator.dispatch({ kind: 'lens', id: 'normal' }, { signal: aborted.signal }), false);
  await h.resolveJobs(); assert.equal(await next, true);
  const topographyAfterAbort = h.coordinator.state().committed; assert.ok(topographyAfterAbort); assert.equal(topographyAfterAbort.lensId, 'topography');
});
