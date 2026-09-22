import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('saturn');
import { readPreparedFixture } from "../../fixtures.mts";
import { mountPreparedPresentation, selectedPreparedVariant } from "../../../../src/renderers/css/dist/testing.js";
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";
const runtimeDefinition = await readPreparedFixture('saturn', 'runtime');
type Fixture = Awaited<ReturnType<typeof preparedSelectionFixture>>;
type Action = Parameters<Fixture["selection"]["dispatch"]>[0];
const pool = (f: Fixture, id: string) => required(f.residency.stats().pools.find(pool => pool.id === id));
const lens = (id: string): Action => ({ kind: "lens", id });
const toggle = (name: string, value: boolean): Action => ({ kind: "toggle", name, value });
async function select(f: Fixture, action: Action) { const result = f.selection.dispatch(action); await f.settle(); assert.equal(await result, true); }

for (const failAtElement of [1, 2, 3]) test(`Saturn partial construction preserves the prior root (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous"; f.stage.dataset.view = "previous";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /injected native/);
    assert.deepEqual(f.lifetime.destroy(), []); assert.equal(f.stage.dataset.view, "previous");
  } finally { f.restore(); }
});
for (const replacement of [false, true]) test(`Saturn cleanup respects root identity (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.view = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.view, replacement ? "replacement" : undefined);
  } finally { f.restore(); }
});

test("Saturn commits one coherent latest exclusive lens with ring and shadow settings", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const root = f.stage.children[0], nodes = root.querySelectorAll("*");
    const requests = [];
    for (const action of [lens("methane"), lens("cross-section"), toggle("rings", false), toggle("shadows", true)]) {
      requests.push(f.selection.dispatch(action)); await f.flush();
    }
    assert.equal(f.stage.dataset.lens, undefined); assert.equal(f.stage.dataset.view, undefined);
    await f.settle(); assert.deepEqual(await Promise.all(requests), [false, false, false, true]);
    const selection = required(f.selection.state().committed);
    assert.equal(required(selection.lensId), "cross-section"); assert.equal(Object.hasOwn(selection, "interior"), false);
    assert.equal(required(selection.rings), false); assert.equal(required(selection.shadows), true);
    assert.equal(f.stage.dataset.lens, undefined); assert.equal(f.stage.dataset.view, "interior");
    assert.ok(f.stage.classList.contains("saturn-hide-rings")); assert.ok(!f.stage.classList.contains("saturn-hide-shadows"));
    assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["cross-section"]);
    const variant = selectedPreparedVariant(runtimeDefinition, selection);
    assert.equal(required(variant.materials.find(track => track.track === "exterior")).bank, "normal-ringless");
    assert.ok(required(f.selection.state().plan).required.some(key=>/^exterior:normal-ringless:row:\d+$/.test(key)));
    assert.ok(required(f.selection.state().plan).required.some(key=>/^interior-material:normal-ringless:row:\d+$/.test(key)));
    assert.deepEqual(root.querySelectorAll("*"), nodes); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn repeated cross-section selection stays selected while replacing a pending request", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const a = f.selection.dispatch(lens("cross-section")); await f.flush();
    const b = f.selection.dispatch(lens("cross-section")); await f.settle();
    assert.deepEqual(await Promise.all([a, b]), [false, true]);
    assert.equal(required(f.selection.state().committed).lensId, "cross-section"); assert.equal(Object.hasOwn(required(f.selection.state().committed), "interior"), false);
    assert.ok(pool(f, "interior").resident > 0); assert.equal(pool(f, "interior-material").resident, 2, "Both prepared neighboring atmosphere rows remain resident");
    assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["cross-section"]); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn cross-section uses the common single-lens reducer with no remembered exterior state", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const id of ["cross-section", "thermal", "cross-section", "cross-section", "ultraviolet", "methane", "normal"]) {
      await select(f, lens(id));
      const committed = required(f.selection.state().committed);
      assert.deepEqual(Object.keys(committed).sort(), ["lensId", "rings", "shadows", "speed"]);
      assert.equal(required(committed.lensId), id);
      assert.equal(f.stage.dataset.view, id === "cross-section" ? "interior" : undefined);
      assert.equal(f.stage.dataset.lens, ["normal", "cross-section"].includes(id) ? undefined : id);
      assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), [id]);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    assert.equal(pool(f, "interior").resident, 0);
    assert.equal(pool(f, "interior-material").resident, 0);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn failed cross-section preparation retains the previous exterior lens and permits retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await select(f, lens("thermal"));
    const before = required(f.selection.state().committed);
    const pending = f.selection.dispatch(lens("cross-section"));
    const rejected = assert.rejects(pending, /did not decode/);
    await f.flush();
    const job = f.jobs.find(job => !job.done && job.url.includes("interior"));
    assert.ok(job); job.done = true; job.reject(new Error("cutaway decode failed"));
    await rejected;
    assert.deepEqual(f.selection.state().committed, before);
    assert.deepEqual(f.selection.state().desired, before);
    assert.equal(f.stage.dataset.lens, "thermal"); assert.equal(f.stage.dataset.view, undefined);
    assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["thermal"]);
    await select(f, lens("cross-section"));
    assert.equal(required(f.selection.state().committed).lensId, "cross-section");
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn lens A/B/A retires obsolete groups and late decode rejection cannot replace the winner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const a = f.selection.dispatch(lens("methane")); await f.flush();
    const b = f.selection.dispatch(lens("thermal")); await f.flush();
    const abandoned = f.jobs.filter(job => !job.done && job.url.includes("thermal"));
    const winner = f.selection.dispatch(lens("methane")); await f.flush();
    assert.ok(pool(f, "lenses").nativeSlots <= 8); assert.ok(pool(f, "exterior-material").nativeSlots <= 2);
    for (const job of abandoned) { job.done = true; job.reject(new Error("late abandoned decode")); }
    await f.settle(); assert.deepEqual(await Promise.all([a, b, winner]), [false, false, true]);
    assert.equal(f.stage.dataset.lens, "methane"); assert.equal(pool(f, "lenses").resident, 4);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn partial group failure retains committed presentation, resets desire and allows retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const before = required(f.selection.state().committed);
    const pending = f.selection.dispatch(lens("methane")); const failed = assert.rejects(pending, /decode/); await f.flush();
    const jobs = f.jobs.filter(job => !job.done); assert.ok(jobs.length > 1);
    jobs[0].done = true; jobs[0].resolve(); jobs[1].done = true; jobs[1].reject(new Error("partial decode failed")); await failed;
    assert.deepEqual(f.selection.state().committed, before); assert.deepEqual(f.selection.state().desired, before);
    await select(f, toggle("rings", false)); assert.equal(required(f.selection.state().committed).lensId, "normal");
    await select(f, lens("methane")); assert.equal(f.stage.dataset.lens, "methane"); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn delayed compound preparation uses the current camera frame at publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch(lens("cross-section")); await f.flush();
    const view = { ...f.view, controlPitch: 72, controlYaw: 31, sunViewDirection: [0, 0, -1], revision: 2 };
    f.selection.setView(view); await f.settle(); assert.equal(await pending, true);
    const frame = f.presentation.observe().materials.exterior.frame;
    assert.notEqual(frame, runtimeDefinition.materials[0].defaultFrame);
    await select(f, lens("normal"));
    assert.equal(f.presentation.observe().materials.exterior.frame, frame);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn disposal settles never-ending groups and prevents late publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch(lens("cross-section")); await f.flush(); f.lifetime.destroy();
    assert.equal(await pending, false); const count = f.jobs.length; f.stage.dataset.view = "replacement";
    for (const job of f.jobs.filter(job => !job.done)) { job.done = true; job.reject(new Error("late")); }
    await f.flush(); assert.equal(f.jobs.length, count); assert.equal(f.stage.dataset.view, "replacement");
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn native material publication failure cannot promote partially applied selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const before = required(f.selection.state().committed);
    const leaf = required(f.stage.querySelectorAll("*").find(node => node.classList.contains("saturn-interior-material")));
    Object.defineProperty(leaf.style, "backgroundImage", { configurable: true, set() { throw new Error("native publication failed"); } });
    const pending = f.selection.dispatch(lens("cross-section")).catch(error => error); await f.settle(); await pending;
    assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1);
    assert.deepEqual(f.selection.state().committed, before); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Saturn native cleanup failure cannot retain sibling resource or control owners", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await select(f, lens("methane"));
    const entry = required(runtimeDefinition.assets.entries.find(entry => entry.key === pool(f, "lenses").keys[0]));
    required(f.jobs.find(job => job.url === entry.url && job.image.src)).image.removeAttribute = () => { throw new Error("native release failed"); };
    assert.equal(f.lifetime.destroy().length, 1); assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});
