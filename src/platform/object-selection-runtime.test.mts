import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';
import assert from "node:assert/strict";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { createObjectSelectionRuntime } from '@cssearth/renderer/testing';
import { cameraMotionSignalFor } from '@cssearth/renderer/navigation';
import { createPreparedResidency } from '@cssearth/renderer/testing';
import { retainedPresentationFixture, preparedSelectionFixture } from "./fixtures/object-runtime-package.mts";
import { mountPreparedPresentation, initialObjectSelection } from '@cssearth/renderer/testing';
import { parsePreparedObjectRuntime } from '@cssearth/renderer';
import type { ObjectSelection } from '@cssearth/renderer/runtime/object-contract.ts';
import type { ObjectRuntimeDefinition } from '@cssearth/renderer/runtime/object-runtime-types.ts';
import type { ObjectSelectionState } from '@cssearth/renderer/rendering/object-selection-runtime.ts';
import type { PreparedImage } from '@cssearth/renderer/rendering/prepared-image-store.ts';
import type { PreparedResidencyTicket } from '@cssearth/renderer/rendering/prepared-residency.ts';
import type { PreparedPresentationContext, PreparedPresentationPlan, PreparedView } from '@cssearth/renderer/rendering/prepared-presentation.ts';
const earthDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('earth'));
const saturnDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('saturn'));
import { requireObjectRuntimeDefinition } from "@cssearth/bake/contract";
import { viewSunDirectionToPreparedLightDirection } from "@cssearth/renderer/platform/directional-sun-coordinate";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
test("Earth has one atmospheric material and no Atmosphere setting or disc-only asset demand", () => {
  assert.deepEqual(earthDefinition.controls.settings?.controls.map(control => control.name), ["speed", "shadows"]);
  assert.deepEqual(earthDefinition.materials.map(track => track.id), ["atmosphere"]);
  assert.ok(earthDefinition.variants.every(variant => !Object.hasOwn(variant.when, "atmosphere")));
  assert.ok(earthDefinition.assets.entries.every(entry => !entry.url.includes("earth-lighting-")));
  assert.ok(!earthDefinition.assets.startup.includes("shadowless:lighting"));
});
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
  definition?: ObjectRuntimeDefinition;
  initialDataset?: string;
  onTicket?: (ticket: PreparedResidencyTicket) => void;
  onChange?: (state: Readonly<ObjectSelectionState>) => void;
  initialDiameter?: number;
  motion?: ReturnType<typeof cameraMotionSignalFor>;
}
function harness({ definition = earthDefinition, onTicket, onChange, initialDiameter = 100, initialDataset, motion }: HarnessOptions = {}) {
  const f = retainedPresentationFixture(definition);
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
    initialDataset, motion,
    onChange: state => { changes.push(state); onChange?.(state); }, onCommit: (selection, plan) => commits.push({ selection, plan }),
    onFatalError(error) { fatal.push(error); f.lifetime.destroy(); }, onMaterialError: error => materialErrors.push(error) });
  f.lifetime.onDispose(() => coordinator.destroy());
  let revision = 0, currentView: PreparedView | undefined;
  function view(row: number, withinRow = 0, silhouetteDiameter = 100): PreparedView {
    const track = definition.materials[0] ?? earthDefinition.materials[0], frame = 20 + row * 32 + withinRow;
    const z = frame / (track.frame.indices.length - 1) * 2 - 1;
    const direction: readonly [number, number, number] = [Math.sqrt(1 - z * z), 0, z];
    const next: PreparedView = { ...f.view, controlPitch: 37, controlYaw: 10, zoom: definition.camera.defaultZoom,
      levelOfDetail: { stage: 'geometry', silhouetteDiameter, billboardOpacity: 0, markerOpacity: 0 },
      revision: ++revision, sceneMatrix: matrix, counterRotation: matrix, counterRotationFor: () => matrix,
      sunViewDirection: direction, reference: currentView?.reference, };
    next.reference = currentView?.reference ?? next; currentView = next; coordinator.setView(next); return next;
  }
  view(0, 0, initialDiameter); const initialReady = coordinator.start();
  async function resolveJobs({ exclude = [] }: { exclude?: readonly ImageJob[] } = {}) {
    // Every wave settles at least one decode, so a queue that drains at all drains within one wave per prepared entry.
    for (let wave = 0; wave < definition.assets.entries.length + 45; wave++) {
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
    dataset: (id: string) => coordinator.dispatch({ kind: "dataset", id }),
    frameCount: () => presentation.observe().presentation.framePublications,
    atmosphereTarget: () => created[definition.materials[0].target],
  };
}

test('the native dataset is the first desired and committed selection', async t => {
  const h = harness({ initialDataset: 'topography' }); t.after(h.restore);
  assert.equal(h.coordinator.state().desired.datasetId, 'topography');
  await h.ready();
  assert.equal(h.commits[0].selection.datasetId, 'topography');
  assert.equal(h.coordinator.state().committed?.datasetId, 'topography');
  assert.ok(h.changes.every(state => state.desired.datasetId === 'topography'));
});

test('initial commit remains successful when its publication immediately requests a closer view', async t => {
  let h!: ReturnType<typeof harness>; let requested = false;
  h = harness({ onChange(state) {
    if (!state.committed || requested) return;
    requested = true;
    h.coordinator.setView({ ...h.currentView(), levelOfDetail: { stage: 'geometry', silhouetteDiameter: 1000, billboardOpacity: 0, markerOpacity: 0 } });
  } });
  t.after(h.restore); await h.ready();
  const initialCommit = h.commits[0], finalCommit = h.commits.at(-1); assert.ok(initialCommit); assert.ok(finalCommit);
  // The initial 100 px view needs the small bank; the new 1000 px view needs the 4096 level.
  assert.equal(initialCommit.plan.textureLevel, 0);
  assert.equal(finalCommit.plan.textureLevel, 3);
  assert.deepEqual(h.fatal, []);
});
test('a close startup decodes its destination level without a coarse pass or input gate', async t => {
  const h = harness({ initialDiameter: 1000 }); t.after(h.restore); await h.ready();
  assert.equal(h.commits[0].plan.textureLevel, 3);
  assert(h.commits.every(commit => commit.plan.textureLevel === 3));
  assert(!h.jobs.some(job => /-level-512\.webp/.test(job.url)), 'startup never requests the forced coarse bank');
  h.view(0, 0, 100); await h.resolveJobs();
  assert.equal(h.coordinator.state().plan?.textureLevel, 0, 'a distant view still selects its sufficient small level');
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
test("A/B/A dataset races retain the real active page group and only the latest action commits", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const first = h.dataset("topography"); await flush(); const obsolete = h.jobs.at(-1); assert.ok(obsolete);
  const next = h.dataset("normal"); await h.resolveJobs({ exclude: [obsolete] });
  assert.deepEqual(await Promise.all([first, next]), [false, true]);
  const normal = h.coordinator.state().committed; assert.ok(normal); assert.equal(normal.datasetId, "normal");
  assert.equal(h.commits.some(value => value.selection.datasetId === "topography"), false);
  obsolete.reject(new Error("late")); await flush(); assert.deepEqual(h.fatal, []);
});
test("view changes during pending dataset decoding publish current registration and commit current material demand", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const before = h.atmosphereTarget().style.backgroundImage, frames = h.frameCount();
  const request = h.dataset("topography"); await flush(); h.view(2);
  const committedNormal = h.coordinator.state().committed; assert.ok(committedNormal); assert.ok(h.frameCount() > frames); assert.equal(committedNormal.datasetId, "normal");
  assert.equal(h.atmosphereTarget().style.backgroundImage, before);
  await h.resolveJobs(); assert.equal(await request, true);
  const topographyCommit = h.commits.at(-1); assert.ok(topographyCommit); assert.equal(topographyCommit.selection.datasetId, "topography"); assert.equal(topographyCommit.plan.materials.atmosphere.frame, 127);
});
test("same resource demand is coalesced across dataset and speed actions", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const dataset = h.dataset("topography"); await flush(); const count = h.jobs.length;
  const speed = h.coordinator.dispatch({ kind: "cycle", name: "speed", value: 3 }); await flush();
  assert.equal(h.jobs.length, count); await h.resolveJobs(); assert.deepEqual(await Promise.all([dataset, speed]), [false, true]);
  const topography = h.coordinator.state().committed; assert.ok(topography); assert.equal(topography.speed, 3); assert.equal(topography.datasetId, "topography");
});
test("decode failure preserves the actual committed plan and pages, and a retry clears the error", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const committed = h.coordinator.state().plan;
  const failed = h.dataset("topography"), rejected = assert.rejects(failed, /decode/); await flush();
  const job = h.jobs.findLast(job => !job.done); assert.ok(job); job.done = true; job.reject(new Error("network")); await rejected;
  assert.equal(h.coordinator.state().desired.datasetId, "normal"); assert.equal(h.coordinator.state().plan, committed);
  assert.ok(committed); assert.ok(committed.required.every(key => h.resources.resources.has(key))); assert.equal(h.coordinator.state().pending, false);
  const retry = h.dataset("topography"); await h.resolveJobs(); assert.equal(await retry, true);
  assert.equal(h.coordinator.state().error, null); assert.notEqual(h.coordinator.state().plan, committed); assert.deepEqual(h.fatal, []);
});
test("Saturn's actual cutaway is exclusive and repeated selection stays selected", async t => {
  const h = await preparedSelectionFixture(saturnDefinition); t.after(h.restore);
  const a = h.selection.dispatch({ kind: "dataset", id: "methane" }); await h.flush();
  const b = h.selection.dispatch({ kind: "dataset", id: "cross-section" });
  const c = h.selection.dispatch({ kind: "toggle", name: "rings", value: false });
  await h.settle(); assert.deepEqual(await Promise.all([a, b, c]), [false, false, true]);
  const cutaway = h.selection.state().committed; assert.ok(cutaway); assert.equal(cutaway.datasetId, "cross-section"); assert.equal(cutaway.rings, false);
  assert.equal(Object.hasOwn(cutaway, "interior"), false);
  const again = h.selection.dispatch({ kind: "dataset", id: "cross-section" }); await h.settle(); assert.equal(await again, true);
  assert.deepEqual(h.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["cross-section"]);
  const exterior = h.selection.dispatch({ kind: "dataset", id: "methane" }); await h.settle(); assert.equal(await exterior, true);
  const methane = h.selection.state().committed; assert.ok(methane); assert.equal(methane.datasetId, "methane");
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
  const topographyVariant = earthDefinition.variants.find(variant => variant.when.datasetId === "topography"); assert.ok(topographyVariant);
  const binding = topographyVariant.writes.find(write => write.kind === "texture" && write.resource !== null);
  assert.ok(binding);
  const textureBinding = earthDefinition.tree.textureBindings?.find(candidate => candidate.target === binding.target && candidate.name === binding.name);
  const target = textureBinding ? h.created[textureBinding.leaves[0]] : binding.target === -1 ? h.stage : h.created[binding.target];
  const property = textureBinding ? "backgroundImage" : binding.name;
  assert.ok(target);
  // Inject at the actual native setter, including prepared leaf-local texture publication.
  if (property.startsWith("--")) {
    const set = target.style.setProperty.bind(target.style);
    target.style.setProperty = (name, value) => { if (name === property) throw new Error("native selection write failed"); return set(name, value); };
  } else Object.defineProperty(target.style, property, { set() { throw new Error("native selection write failed"); } });
  const request = h.dataset("topography"), rejected = assert.rejects(request, /native selection write failed/);
  await h.resolveJobs(); await rejected; assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
  assert.ok(h.changes.slice(before).every(change => change.pending)); assert.equal(h.resources.stats().images.entries.length, 0);
});
test("destroy cancels pending actions promptly and late decoder callbacks remain inert", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const request = h.dataset("topography"); await flush();
  const job = h.jobs.at(-1), count = h.coordinator.stats().framePublications; assert.ok(job); h.lifetime.destroy(); assert.equal(await request, false);
  job.reject(new Error("late")); h.view(2); await flush();
  assert.equal(h.coordinator.stats().framePublications, count); assert.equal(h.commits.length, 1); assert.deepEqual(h.fatal, []);
});
test("camera movement in the prepared-ticket promise handoff retries the original action", async t => {
  let h!: ReturnType<typeof harness>; let armed = false, fired = false;
  h = harness({ onTicket(ticket) { ticket.ready.then(ready => {
    if (ready && armed && !fired) { fired = true; queueMicrotask(() => h.view(2)); }
  }).catch(() => {}); } }); t.after(h.restore); await h.ready(); armed = true;
  const request = h.dataset("topography"); await h.resolveJobs(); assert.equal(await request, true);
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
  const request = h.coordinator.dispatch({ kind: 'dataset', id: 'topography' }, { signal: signal.signal });
  await flush(); const late = h.jobs.findLast(job => !job.done); assert.ok(late);
  signal.abort(); assert.equal(await request, false);
  assert.equal(h.coordinator.state().pending, false);
  const normalAfterAbort = h.coordinator.state().committed; assert.ok(normalAfterAbort); assert.equal(normalAfterAbort.datasetId, 'normal');
  assert.equal(h.coordinator.state().desired.datasetId, 'normal');
  assert.equal(h.coordinator.state().plan, committed);
  late.reject(new Error('late cancelled decoder')); await flush();
  assert.equal(h.commits.length, 1); assert.deepEqual(h.fatal, []);
  const retry = h.dataset('topography'); await h.resolveJobs(); assert.equal(await retry, true);
});

test('an already aborted dataset signal cannot replace a newer selection', async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const aborted = new AbortController(); aborted.abort();
  const next = h.dataset('topography');
  assert.equal(await h.coordinator.dispatch({ kind: 'dataset', id: 'normal' }, { signal: aborted.signal }), false);
  await h.resolveJobs(); assert.equal(await next, true);
  const topographyAfterAbort = h.coordinator.state().committed; assert.ok(topographyAfterAbort); assert.equal(topographyAfterAbort.datasetId, 'topography');
});

test("blur while moving: a texture level waits for the camera to stop, then commits for where it stopped", async t => {
  const motion = cameraMotionSignalFor(new EventTarget());
  const h = harness({ motion }); t.after(h.restore); await h.ready();
  const level = () => h.commits.at(-1)!.plan.textureLevel;
  const before = h.commits.length, startLevel = level();
  motion.begin("drag");
  // Close in: the silhouette grows past the texture levels while the camera still moves.
  h.view(0, 0, 900); await h.resolveJobs();
  assert.equal(h.commits.length, before, "no texture level commits mid-motion");
  motion.end("drag");
  await h.resolveJobs();
  assert.ok(h.commits.length > before, "the held level commits once the camera stops");
  assert.notEqual(level(), startLevel);
});

test('departure holds a decoded texture request and resumes only the latest view on cancellation', async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const before = h.commits.length, frames = h.frameCount();
  h.view(0, 0, 900); await flush(); // Demand exists before navigation starts.
  const release = h.coordinator.holdPresentation();
  const heldFrames = h.frameCount();
  await h.resolveJobs();
  assert.equal(h.commits.length, before, 'decode completion cannot repaint the departing surface');
  h.view(0, 0, 1800);
  assert.equal(h.frameCount(), heldFrames, 'held views do not publish material styles');
  assert.ok(heldFrames >= frames);
  release(); await h.resolveJobs();
  assert.ok(h.commits.length > before);
  assert.equal(h.coordinator.state().viewRevision, h.currentView().revision);
  assert.equal(h.coordinator.stats().presentationHolds, 0);
  release(); assert.equal(h.coordinator.stats().presentationHolds, 0);
});

test('superseded departures retain their hold and disposal never publishes held textures', async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const first = h.coordinator.holdPresentation(), second = h.coordinator.holdPresentation();
  const before = h.commits.length, frames = h.frameCount(), requests = h.coordinator.stats().requests;
  h.view(0, 0, 900); first(); await h.resolveJobs();
  assert.equal(h.commits.length, before);
  assert.equal(h.frameCount(), frames);
  assert.equal(h.coordinator.stats().requests, requests, 'no departing view demand starts');
  h.lifetime.destroy(); second(); await flush();
  assert.equal(h.commits.length, before);
});


test('same-turn navigation supersession does not briefly publish the old surface', async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const release = h.coordinator.holdPresentation(), frames = h.frameCount();
  h.view(0, 0, 900);
  release();
  const successor = h.coordinator.holdPresentation();
  await h.resolveJobs();
  assert.equal(h.frameCount(), frames);
  h.lifetime.destroy(); successor();
});


test('held departure moves and hides every Ryugu depth partition without publishing materials', async t => {
  const definition = parsePreparedObjectRuntime(await loadObjectTestDefinition('ryugu'));
  const h = harness({ definition }); t.after(h.restore); await h.ready();
  assert.ok(definition.depthPartitions?.groups.length, 'exercise the partitioned mesh');
  const scene = h.created[definition.tree.scene];
  const groups = definition.depthPartitions.groups.map(group => h.created[group.scene]);
  const release = h.coordinator.holdPresentation();
  const frames = h.frameCount(), commits = h.commits.length, requests = h.coordinator.stats().requests;
  scene.style.transform = 'translate3d(0px,0px,-10000px)';
  h.view(0);
  for (const group of groups) assert.equal(group.style.transform, scene.style.transform);
  scene.hidden = true;
  h.coordinator.setView({ ...h.currentView(), levelOfDetail: { stage: 'marker', silhouetteDiameter: 1, billboardOpacity: 0, markerOpacity: 1 } });
  for (const group of groups) assert.equal(group.hidden, true, 'no full-size source remains behind the destination');
  assert.equal(h.frameCount(), frames);
  assert.equal(h.commits.length, commits);
  assert.equal(h.coordinator.stats().requests, requests);
  h.lifetime.destroy(); release();
});

test('detached first publication selects leaf boxes before connection, without a live repaint queue', async t => {
  const definition = parsePreparedObjectRuntime(await loadObjectTestDefinition('neptune'));
  const f = retainedPresentationFixture(definition); t.after(f.restore);
  const created: ReturnType<typeof f.document.createElement>[] = [];
  const create = f.document.createElement;
  f.document.createElement = tag => { const element = create(tag); created.push(element); return element; };
  const frames: FrameRequestCallback[] = [];
  const previousFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => frames.push(callback) });
  t.after(() => { if (previousFrame) Object.defineProperty(globalThis, 'requestAnimationFrame', previousFrame); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame'); });
  const presentation = mountPreparedPresentation(f.stage, f.context, definition, undefined, undefined, false, true);
  assert.equal(f.stage.children.length, 0);
  const binding = definition.viewBindings.find(binding => binding.kind === 'silhouette-step-property' && binding.groups);
  assert.ok(binding?.kind === 'silhouette-step-property' && binding.groups);
  const leaves = Object.values(binding.groups).flat();
  assert.ok(leaves.length && binding.placements, 'Use the actual prepared leaf groups');
  const radius = binding.placements.body.radius;
  const projection = (distance: number): PreparedView['projection'] => ({ focalPixels: 1000, principalOffsetPixels: [0, 0],
    eyeFromScene: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -distance, 1] });
  const publication = { selection: initialObjectSelection(definition.controls), resources: f.resources,
    view: { ...f.view, projection: projection(radius * 100), motionAtRest: true, levelOfDetail: { ...f.view.levelOfDetail, silhouetteDiameter: 20 } } };
  presentation.publishFrame(publication);
  // Leaf boxes ship as records and write final lengths (prepared-leaf-box-direct.ts): the step a leaf shows is its width
  // over its full box, over its density.
  const record = binding.boxes?.find(box => box.node === leaves[0]);
  assert.ok(record?.box && record.density, 'Neptune leaf boxes ship as records');
  const leaf = created[leaves[0]], first = leaf.style.width;
  const step = parseFloat(first) / record.box[0] / record.density;
  assert.ok(step <= 32.001 && step >= 15.999, `The first small-system view must not inherit close-up backing sizes (step ${step})`);
  assert.equal(frames.length, 0, 'Detached preparation must finish before connection');
  presentation.connect();
  assert.ok(f.stage.children.length > 0);
  presentation.publishFrame({ ...publication, view: { ...publication.view, projection: projection(radius * 3),
    levelOfDetail: { ...publication.view.levelOfDetail, silhouetteDiameter: 1000 } } });
  assert.equal(leaf.style.width, first, 'Mounted boxes stay frozen until motion settles');
});
