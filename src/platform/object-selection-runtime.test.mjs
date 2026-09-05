import assert from "node:assert/strict";
import test from "node:test";
import { createObjectSelectionRuntime } from "./object-selection-runtime.mjs";
import { createPreparedResidency } from "./prepared-residency.mjs";
import { retainedPresentationFixture, preparedSelectionFixture } from "./test/object-runtime-package.mjs";
import { mountPreparedPresentation } from "./prepared-presentation.mjs";
import { runtimeDefinition as earthDefinition } from "../planets/earth/runtime/definition.mjs";
import { runtimeDefinition as saturnDefinition } from "../planets/saturn/runtime/definition.mjs";
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
// The actual Earth plan provides independent lighting and atmosphere row demand.
// Only native image completion and DOM setters are controlled by these tests.
function harness({ onTicket } = {}) {
  const definition = earthDefinition, f = retainedPresentationFixture(definition);
  const jobs = [], commits = [], changes = [], fatal = [], materialErrors = [], created = [];
  const createElement = f.document.createElement;
  f.document.createElement = tag => { const node = createElement(tag); created.push(node); return node; };
  const timers = new Map(); let nextTimer = 0;
  const resources = createPreparedResidency({ assets: definition.assets,
    schedule(callback) { timers.set(++nextTimer, callback); return nextTimer; }, unschedule(id) { timers.delete(id); },
    createImage() { return { naturalWidth: 1, naturalHeight: 1, src: "",
      decode() { return new Promise((resolve, reject) => jobs.push({ url: this.src, image: this, resolve, reject, done: false })); },
      removeAttribute(name) { if (name === "src") this.src = ""; } }; } });
  f.lifetime.onDispose(() => resources.destroy());
  const residency = { ...resources, request(...args) { const ticket = resources.request(...args); onTicket?.(ticket); return ticket; } };
  const presentation = mountPreparedPresentation(f.stage, { ...f.context, resources: resources.resources }, definition);
  const coordinator = createObjectSelectionRuntime({ definition, presentation, residency, lifetime: f.lifetime,
    onChange: state => changes.push(state), onCommit: (selection, plan) => commits.push({ selection, plan }),
    onFatalError(error) { fatal.push(error); f.lifetime.destroy(); }, onMaterialError: error => materialErrors.push(error) });
  f.lifetime.onDispose(() => coordinator.destroy());
  let revision = 0, currentView;
  function view(row, withinRow = 0) {
    const track = definition.materials[1], frame = 20 + row * 32 + withinRow;
    const z = frame / (track.frame.count - 1) * 2 - 1;
    const next = { controlPitch: 37, controlYaw: 10, zoom: definition.camera.defaultZoom,
      revision: ++revision, sceneMatrix: matrix, counterRotation: matrix, counterRotationFor: () => matrix,
      sunViewDirection: [Math.sqrt(1 - z * z), 0, z], skySunViewDirection: [Math.sqrt(1 - z * z), 0, z] };
    next.reference = currentView?.reference ?? next; currentView = next; coordinator.setView(next); return next;
  }
  view(0); const initialReady = coordinator.start();
  async function resolveJobs({ exclude = [] } = {}) {
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
    view, currentView: () => currentView, initialReady, ready, resolveJobs,
    lens: id => coordinator.dispatch({ kind: "lens", id }),
    frameCount: () => presentation.observe().presentation.framePublications,
    atmosphereTarget: () => created[definition.materials[1].target],
  };
}

test("camera movement cancels the old resource pass while startup waits for its current atmosphere row", async t => {
  const h = harness(); t.after(h.restore); await flush();
  const obsolete = h.jobs.find(job => job.url.includes("atmosphere")); assert.ok(obsolete);
  let settled = false; h.initialReady.then(() => { settled = true; });
  h.view(1); await flush(); assert.equal(settled, false);
  await h.resolveJobs({ exclude: [obsolete] }); assert.equal(await h.initialReady, true);
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].plan.materials.atmosphere.frame, 52);
  obsolete.reject(new Error("late")); await flush(); assert.deepEqual(h.fatal, []);
});
test("A/B/A lens races retain the real active page group and only the latest action commits", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const first = h.lens("topography"); await flush(); const obsolete = h.jobs.at(-1);
  const next = h.lens("normal"); await h.resolveJobs({ exclude: [obsolete] });
  assert.deepEqual(await Promise.all([first, next]), [false, true]);
  assert.equal(h.coordinator.state().committed.lensId, "normal");
  assert.equal(h.commits.some(value => value.selection.lensId === "topography"), false);
  obsolete.reject(new Error("late")); await flush(); assert.deepEqual(h.fatal, []);
});
test("view changes during pending lens decoding publish current registration and commit current material demand", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const before = h.atmosphereTarget().style.backgroundImage, frames = h.frameCount();
  const request = h.lens("topography"); await flush(); h.view(2);
  assert.ok(h.frameCount() > frames); assert.equal(h.coordinator.state().committed.lensId, "normal");
  assert.equal(h.atmosphereTarget().style.backgroundImage, before);
  await h.resolveJobs(); assert.equal(await request, true);
  assert.equal(h.commits.at(-1).selection.lensId, "topography"); assert.equal(h.commits.at(-1).plan.materials.atmosphere.frame, 84);
});
test("same resource demand is coalesced across lens and speed actions", async t => {
  const h = harness(); t.after(h.restore); await h.ready();
  const lens = h.lens("topography"); await flush(); const count = h.jobs.length;
  const speed = h.coordinator.dispatch({ kind: "cycle", name: "speed", value: 3 }); await flush();
  assert.equal(h.jobs.length, count); await h.resolveJobs(); assert.deepEqual(await Promise.all([lens, speed]), [false, true]);
  assert.equal(h.coordinator.state().committed.speed, 3); assert.equal(h.coordinator.state().committed.lensId, "topography");
});
test("decode failure preserves the actual committed plan and pages, and a retry clears the error", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const committed = h.coordinator.state().plan;
  const failed = h.lens("topography"), rejected = assert.rejects(failed, /decode/); await flush();
  const job = h.jobs.findLast(job => !job.done); job.done = true; job.reject(new Error("network")); await rejected;
  assert.equal(h.coordinator.state().desired.lensId, "normal"); assert.equal(h.coordinator.state().plan, committed);
  assert.ok(committed.required.every(key => h.resources.resources.has(key))); assert.equal(h.coordinator.state().pending, false);
  const retry = h.lens("topography"); await h.resolveJobs(); assert.equal(await retry, true);
  assert.equal(h.coordinator.state().error, null); assert.notEqual(h.coordinator.state().plan, committed); assert.deepEqual(h.fatal, []);
});
test("Saturn's actual cutaway is exclusive and repeated selection stays selected", async t => {
  const h = await preparedSelectionFixture(saturnDefinition); t.after(h.restore);
  const a = h.selection.dispatch({ kind: "lens", id: "methane" }); await h.flush();
  const b = h.selection.dispatch({ kind: "lens", id: "cross-section" });
  const c = h.selection.dispatch({ kind: "toggle", name: "rings", value: false });
  await h.settle(); assert.deepEqual(await Promise.all([a, b, c]), [false, false, true]);
  assert.equal(h.selection.state().committed.lensId, "cross-section"); assert.equal(h.selection.state().committed.rings, false);
  assert.equal(Object.hasOwn(h.selection.state().committed, "interior"), false);
  const again = h.selection.dispatch({ kind: "lens", id: "cross-section" }); await h.settle(); assert.equal(await again, true);
  assert.deepEqual(h.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["cross-section"]);
  const exterior = h.selection.dispatch({ kind: "lens", id: "methane" }); await h.settle(); assert.equal(await exterior, true);
  assert.equal(h.selection.state().committed.lensId, "methane");
});
test("frame row misses keep the real material while shared residency loads a replacement", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const image = h.atmosphereTarget().style.backgroundImage;
  h.view(1); assert.equal(h.atmosphereTarget().style.backgroundImage, image); await flush();
  assert.equal(h.coordinator.state().pending, false); assert.equal(h.coordinator.state().loadingMaterial, true);
  await h.resolveJobs(); assert.notEqual(h.atmosphereTarget().style.backgroundImage, image);
  assert.equal(h.coordinator.state().loadingMaterial, false); assert.equal(h.coordinator.state().plan.materials.atmosphere.frame, 52);
});
test("a native selection write failure retires the session with no successful control tail", async t => {
  const h = harness(); t.after(h.restore); await h.ready(); const before = h.changes.length;
  const binding = earthDefinition.variants.find(variant => variant.when.lensId === "topography").writes.find(write => write.kind === "texture" && write.resource !== null);
  assert.ok(binding); const target = binding.target === -1 ? h.stage : h.created[binding.target];
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
  const job = h.jobs.at(-1), count = h.coordinator.stats().framePublications; h.lifetime.destroy(); assert.equal(await request, false);
  job.reject(new Error("late")); h.view(2); await flush();
  assert.equal(h.coordinator.stats().framePublications, count); assert.equal(h.commits.length, 1); assert.deepEqual(h.fatal, []);
});
test("camera movement in the prepared-ticket promise handoff retries the original action", async t => {
  let h, armed = false, fired = false;
  h = harness({ onTicket(ticket) { ticket.ready.then(ready => {
    if (ready && armed && !fired) { fired = true; queueMicrotask(() => h.view(2)); }
  }).catch(() => {}); } }); t.after(h.restore); await h.ready(); armed = true;
  const request = h.lens("topography"); await h.resolveJobs(); assert.equal(await request, true);
  assert.equal(fired, true); assert.equal(h.commits.at(-1).plan.materials.atmosphere.frame, 84);
  assert.equal(h.commits.length, 2); assert.deepEqual(h.fatal, []); assert.ok(h.coordinator.stats().passes >= 3);
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
  h.view(0, 1); assert.equal(h.coordinator.state().plan.materials.atmosphere.frame, 21);
  assert.equal(h.jobs.length, jobs); assert.equal(h.commits.length, commits); const successful = h.coordinator.state().plan;
  const binding = earthDefinition.viewBindings.find(binding => binding.kind === "counter-rotation"); assert.ok(binding);
  Object.defineProperty(h.created[binding.target].style, "transform", { configurable: true, get() { throw new Error("native frame failed"); } });
  assert.throws(() => h.view(0, 2), /native frame failed/); assert.equal(h.coordinator.state().plan, successful);
  assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
});
