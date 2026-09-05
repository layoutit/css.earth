import { bodyLayerFixture } from "./test/body-layer-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createObjectSelectionRuntime } from "./object-selection-runtime.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";
import { createPreparedResidency } from "./prepared-residency.mjs";
import { initialObjectSelection, reduceObjectSelection } from "./object-runtime-contract.mjs";
import { objectControls as moonControls } from "../planets/moon/site/control-content.mjs";
import { objectControls as saturnControls } from "../planets/saturn/site/control-content.mjs";
import { PREPARED_SATURN_LENSES } from "../planets/saturn/runtime/preparedLenses.mjs";

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function harness({ controls = moonControls, reducer = reduceObjectSelection, initial, resolve, commit, frame } = {}) {
  const lifetime = createSceneLifetime(), jobs = [], commits = [], frames = [], changes = [], fatal = [], materialErrors = [];
  const lenses = controls.lenses.controls.map(lens => lens.id);
  const assets = { entries: lenses.flatMap(lens => [0, 1, 2].map(row => ({ key: `${lens}/${row}`,
    url: `/scenes/moon/test-${lens}-${row}.webp`, pool: "material" }))),
    pools: [{ id: "material", capacity: 3, concurrency: 2, retention: "selection", reuse: true }], startup: [] };
  let coordinator;
  const resources = createPreparedResidency({ assets, createImage() { return { naturalWidth: 1, naturalHeight: 1,
    decode() { const url = this.src; return new Promise((resolve, reject) => jobs.push({ url, resolve, reject })); } }; } });
  lifetime.onDispose(() => resources.destroy());
  const definition = { controls, assets, initialSelection: initial ?? initialObjectSelection(controls), reduceSelection: reducer,
    resolvePresentation: resolve ?? (({ selection, view }) => ({ required: [`${selection.lensId}/${view.row}`], prewarm: [] })) };
  const layers = bodyLayerFixture();
  const presentation = { sceneElement: layers.sceneElement, bodyLayers: layers.bodyLayers,
    commitSelection(args) { commit?.(args); commits.push({ selection: args.selection, row: args.view.row, plan: args.plan }); },
    publishFrame(args) {
      frame?.(args);
      const key = resources.resources.has(`${args.selection.lensId}/${args.view.row}`) ? `${args.selection.lensId}/${args.view.row}`
        : resources.resources.readyKeys().find(key => key.startsWith(args.selection.lensId + "/"));
      if (key) resources.resources.url(key);
      frames.push({ selection: args.selection, row: args.view.row, material: key });
    },
  };
  coordinator = createObjectSelectionRuntime({ definition, presentation, residency: resources, lifetime,
    onChange: state => changes.push(state), onFatalError(error) { fatal.push(error); lifetime.destroy(); },
    onMaterialError: error => materialErrors.push(error) });
  lifetime.onDispose(() => coordinator.destroy());
  let revision = 0;
  const view = row => coordinator.setView({ row, revision: ++revision });
  view(0);
  const initialReady = coordinator.start();
  async function resolveJobs() {
    for (let wave = 0; wave < 15; wave++) {
      await flush();
      const pending = jobs.filter(job => !job.done);
      if (!pending.length) return;
      pending.forEach(job => { job.done = true; job.resolve(); });
    }
    throw new Error("Resource queue did not settle.");
  }
  async function ready() { await resolveJobs(); assert.equal(await initialReady, true); }
  return { coordinator, resources, lifetime, jobs, commits, frames, changes, fatal, materialErrors, view, initialReady, ready, resolveJobs,
    lens: id => coordinator.dispatch({ kind: "lens", id }),
    resolveLatest() { const job = jobs.at(-1); job.done = true; job.resolve(); },
  };
}

test("camera movement cancels only the resource pass; startup waits for a real current-view commit", async () => {
  const h = harness(); await flush();
  const abandoned = h.jobs[0];
  let settled = false; h.initialReady.then(() => { settled = true; });
  h.view(1); await flush();
  assert.equal(settled, false); assert.equal(h.jobs.length, 2);
  h.resolveLatest(); assert.equal(await h.initialReady, true);
  assert.equal(h.commits[0].row, 1); assert.equal(h.commits.length, 1);
  abandoned.reject(new Error("late")); await flush();
  assert.deepEqual(h.fatal, []); assert.equal(h.commits.length, 1); h.lifetime.destroy();
});
test("A/B/A races preserve the active material and only the latest action commits", async () => {
  const h = harness(); await h.ready();
  const first = h.lens("topography"); await flush(); const abandoned = h.jobs.at(-1);
  const next = h.lens("surface"); await flush();
  assert.equal(await first, false); assert.equal(await next, true);
  assert.equal(h.coordinator.state().committed.lensId, "surface");
  assert.equal(h.commits.some(value => value.selection.lensId === "topography"), false);
  abandoned.reject(new Error("late")); await flush(); assert.deepEqual(h.fatal, []); h.lifetime.destroy();
});
test("view changes during a pending lens load commit the new lens at the current row and keep registration current", async () => {
  const h = harness(); await h.ready();
  const request = h.lens("topography"); await flush(); const old = h.jobs.at(-1);
  h.view(2); await flush();
  assert.equal(h.frames.at(-1).row, 2); assert.equal(h.frames.at(-1).selection.lensId, "surface");
  assert.equal(h.frames.at(-1).material, "surface/0");
  h.resolveLatest(); assert.equal(await request, true);
  assert.equal(h.commits.at(-1).row, 2); assert.equal(h.commits.at(-1).selection.lensId, "topography");
  old.resolve(); await flush(); assert.equal(h.commits.at(-1).row, 2); h.lifetime.destroy();
});
test("same pending resource demand is coalesced across coupled control actions", async () => {
  const h = harness(); await h.ready();
  const lens = h.lens("topography"); await flush(); const count = h.jobs.length;
  const speed = h.coordinator.dispatch({ kind: "cycle", name: "speed", value: 3 }); await flush();
  assert.equal(h.jobs.length, count);
  h.resolveLatest(); assert.deepEqual(await Promise.all([lens, speed]), [false, true]);
  assert.equal(h.coordinator.state().committed.speed, 3);
  assert.equal(h.coordinator.state().committed.lensId, "topography"); h.lifetime.destroy();
});
test("recoverable decode failure restores desired state, preserves the committed group and permits retry", async () => {
  const h = harness(); await h.ready();
  const failed = h.lens("topography"); await flush();
  h.jobs.at(-1).done = true; h.jobs.at(-1).reject(new Error("network"));
  await assert.rejects(failed, /decode/); assert.equal(h.coordinator.state().desired.lensId, "surface");
  assert.equal(h.resources.resources.has("surface/0"), true); assert.equal(h.coordinator.state().pending, false);
  const retry = h.lens("topography"); await h.resolveJobs(); assert.equal(await retry, true);
  assert.equal(h.coordinator.state().error, null); assert.deepEqual(h.fatal, []); h.lifetime.destroy();
});
test("Saturn's independent interior and material controls use one pure reducer and atomic selection", async () => {
  const initial = { ...initialObjectSelection(saturnControls), interior: false };
  const h = harness({ controls: saturnControls, initial, reducer(selection, action) {
    if (action.kind === "lens" && PREPARED_SATURN_LENSES.controls.find(lens => lens.id === action.id).view === "interior") {
      return { ...selection, interior: !selection.interior };
    }
    return reduceObjectSelection(selection, action);
  } });
  await h.ready();
  const a = h.lens("methane"); await flush();
  const b = h.lens(PREPARED_SATURN_LENSES.controls.find(lens => lens.view === "interior").id);
  const c = h.coordinator.dispatch({ kind: "toggle", name: "rings", value: false });
  await h.resolveJobs(); assert.deepEqual(await Promise.all([a, b, c]), [false, false, true]);
  const state = h.coordinator.state().committed;
  assert.equal(state.lensId, "methane"); assert.equal(state.interior, true); assert.equal(state.rings, false);
  assert.equal(h.commits.length, 2); h.lifetime.destroy();
});
test("frame row misses publish registration synchronously while the shared coordinator loads material", async () => {
  const h = harness(); await h.ready();
  h.view(1);
  assert.equal(h.frames.at(-1).row, 1); assert.equal(h.frames.at(-1).material, "surface/0");
  await flush(); assert.equal(h.coordinator.state().pending, false); assert.equal(h.coordinator.state().loadingMaterial, true);
  await h.resolveJobs(); await flush();
  assert.equal(h.frames.at(-1).material, "surface/1"); assert.equal(h.coordinator.state().loadingMaterial, false);
  h.lifetime.destroy();
});
test("a synchronous publication failure retires the whole session without a successful control tail", async () => {
  const h = harness({ commit({ selection }) { if (selection.lensId === "topography") throw new Error("partial DOM write"); } });
  await h.ready(); const before = h.changes.length;
  const request = h.lens("topography"); await h.resolveJobs();
  await assert.rejects(request, /partial DOM/);
  assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
  assert.ok(h.changes.slice(before).every(change => change.pending));
  assert.equal(h.resources.stats().images.entries.length, 0);
});
test("destroy cancels pending actions promptly and all late callbacks stay inert", async () => {
  const h = harness(); await h.ready();
  const request = h.lens("topography"); await flush(); const job = h.jobs.at(-1);
  h.lifetime.destroy(); assert.equal(await request, false);
  const count = h.frames.length; job.reject(new Error("late")); h.view(2); await flush();
  assert.equal(h.frames.length, count); assert.equal(h.commits.length, 1); assert.deepEqual(h.fatal, []);
});

test("camera movement in the completed-prepare promise handoff retries without failing the user's action", async () => {
  let h, armed = false, lookups = 0;
  h = harness({ resolve({ selection, view }) {
    if (armed && selection.lensId === "topography" && ++lookups === 2) {
      queueMicrotask(() => h.view(2));
    }
    return { required: [`${selection.lensId}/${view.row}`], prewarm: [] };
  } });
  await h.ready(); armed = true;
  const request = h.lens("topography"); await h.resolveJobs();
  assert.equal(await request, true);
  assert.equal(h.commits.at(-1).row, 2); assert.equal(h.commits.length, 2);
  assert.deepEqual(h.fatal, []); assert.ok(h.coordinator.stats().passes >= 3);
  h.lifetime.destroy();
});
test("a reducer that hides asynchronous work is a fatal contract violation", async () => {
  const h = harness({ reducer() { return Promise.reject(new Error("late reducer")); } });
  await h.ready(); assert.throws(() => h.lens("topography"), /thenable/);
  await flush(); assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
});


test("resolvers receive the actual last committed plan during a replacement and its failure", async () => {
  const observed = [];
  const h = harness({ resolve({ selection, view, previousPlan }) {
    observed.push(previousPlan);
    return { required: [`${selection.lensId}/${view.row}`], lensId: selection.lensId, row: view.row };
  } });
  await h.ready();
  assert.equal(observed[0], null);
  const first = h.coordinator.state().plan;
  const failed = h.lens("topography"); const rejection = assert.rejects(failed, /decode/);
  await flush(); assert.equal(observed.at(-1), first);
  h.jobs.at(-1).done = true; h.jobs.at(-1).reject(new Error("decode failure")); await rejection;
  assert.equal(h.coordinator.state().plan, first);
  const retry = h.lens("topography"); await h.resolveJobs(); assert.equal(await retry, true);
  assert.equal(h.coordinator.state().plan.lensId, "topography");
  assert.ok(Object.isFrozen(first)); h.lifetime.destroy();
});

test("view facts within one resource set advance only after successful frame publication", async () => {
  const history = [], published = []; let fail = false;
  const h = harness({ resolve({ selection, view, previousPlan }) {
    history.push(previousPlan?.pose ?? null);
    return { required: [`${selection.lensId}/0`], pose: view.row };
  }, frame({ plan }) {
    if (fail) throw new Error("native frame failed");
    published.push(plan.pose);
  } });
  await h.ready(); const requests = h.jobs.length;
  h.view(1);
  assert.equal(published.at(-1), 1); assert.equal(h.coordinator.state().plan.pose, 1);
  assert.equal(h.jobs.length, requests); assert.equal(h.commits.length, 1);
  fail = true; assert.throws(() => h.view(2), /native frame failed/);
  assert.equal(history.at(-1), 1); assert.equal(h.coordinator.state().plan.pose, 1);
  assert.equal(h.fatal.length, 1); assert.equal(h.lifetime.disposed, true);
});
