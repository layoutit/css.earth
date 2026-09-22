import { parsePreparedObjectRuntime } from "../renderers/css/dist/index.js";
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";
const runtimeDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon'));
const lenses = runtimeDefinition.controls.lenses;
assert.ok(lenses);
import { initialObjectSelection } from '../renderers/css/dist/testing.js';
import { mountPreparedPresentation, resolvePreparedPresentation } from '../renderers/css/dist/testing.js';
import { retainedPresentationFixture, preparedSelectionFixture } from "./test/object-runtime-package.mts";

const initial = initialObjectSelection(runtimeDefinition.controls);
test("the shared builder mounts exactly the prepared parent order and publishes all Moon lenses", () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    const nodes = f.stage.querySelectorAll("*");
    assert.equal(nodes.length, runtimeDefinition.tree.nodes.length);
    for (const [index, record] of runtimeDefinition.tree.nodes.entries()) {
      assert.equal(nodes[index].tagName.toLowerCase(), record.tag);
      assert.equal(nodes[index].parentNode, record.parent === -1 ? f.stage : nodes[record.parent]);
    }
    for (const lens of lenses.controls) {
      const selection = { ...initial, lensId: lens.id };
      const plan = resolvePreparedPresentation(runtimeDefinition, { selection, view: null });
      assert.deepEqual(plan.pressedLenses, [lens.id]);
      presentation.commitSelection({ selection, resources: f.resources });
      assert.equal(f.stage.dataset.lens, lens.id);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    presentation.publishFrame({ selection: initial, resources: f.resources, view: { ...f.view, zoom: 1.8, body: { visible: true,
      silhouette: { centre: [10, 20], radial: [1, 0], radialSemiAxis: 300, tangentialSemiAxis: 280 } } } });
    const scaleBinding = runtimeDefinition.viewBindings[0];
    assert.equal(scaleBinding.kind, 'silhouette-fit');
    assert.ok(scaleBinding.kind === 'silhouette-fit');
    assert.equal(nodes[scaleBinding.target].style.scale, '1');
    assert.equal(nodes[scaleBinding.target].style.transformOrigin, '50% 50%');
    assert.match(nodes[scaleBinding.target].style.transform, /^translate\(10px, 20px\)/u);
    assert.equal(presentation.observe().presentation.nodes, nodes.length);
  } finally { f.restore(); }
});
const venusDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('venus'));
test("the body publishes the prepared seam outset step for the camera's silhouette", () => {
  const f = retainedPresentationFixture(venusDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, venusDefinition);
    const nodes = f.stage.querySelectorAll("*");
    const binding = venusDefinition.viewBindings.find(candidate => candidate.kind === "silhouette-step-property");
    if (binding?.kind !== "silhouette-step-property") throw new Error("Venus publishes no seam outset.");
    const selection = initialObjectSelection(venusDefinition.controls);
    const value = () => nodes[binding.target].style.getPropertyValue(binding.property);
    const frame = (silhouetteDiameter: number | null) => presentation.publishFrame({ selection, resources: f.resources,
      view: { ...f.view, levelOfDetail: { stage: "geometry", silhouetteDiameter, billboardOpacity: 0, markerOpacity: 0 } } });
    const prepared = value();
    assert.ok(binding.levels.some(level => level.value === prepared), "the retained body starts on a prepared step");
    frame(null);
    assert.equal(value(), prepared, "an unavailable projection keeps the published step");
    const index = binding.levels.findIndex(level => level.minimumDiameter >= 1000), step = binding.levels[index];
    frame(step.minimumDiameter);
    assert.equal(value(), step.value);
    const outsetPixels = Number(step.value) * step.minimumDiameter;
    assert.ok(outsetPixels > 0.35 && outsetPixels < 0.6, `the step holds ${outsetPixels} px at its threshold`);
    // Below its threshold a step holds until the hysteresis margin is spent.
    frame(step.minimumDiameter * (1 - binding.hysteresis / 2));
    assert.equal(value(), step.value);
    frame(step.minimumDiameter * (1 - binding.hysteresis * 2));
    assert.equal(value(), binding.levels[index - 1].value);
  } finally { f.restore(); }
});
test("a missing member cannot publish a partial texture group", () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    presentation.commitSelection({ selection: initial, resources: f.resources });
    const nodes = f.stage.querySelectorAll("*");
    const before = nodes.map(node => [node.style.getPropertyValue("--moon-surface-texture"), node.style.getPropertyValue("--moon-poles-texture")]);
    const nextLens = lenses.controls.find(lens => lens.id !== initial.lensId);
    assert.ok(nextLens);
    const next = nextLens.id;
    assert.throws(() => presentation.commitSelection({ selection: { ...initial, lensId: next }, resources: {
      ...f.resources,
      url: key => key === `poles:${next}` ? null : f.resources.url(key),
    } }), /not ready/);
    assert.equal(f.stage.dataset.lens, initial.lensId);
    assert.deepEqual(nodes.map(node => [node.style.getPropertyValue("--moon-surface-texture"), node.style.getPropertyValue("--moon-poles-texture")]), before);
  } finally { f.restore(); }
});
test("the data presentation uses common selection cancellation and repeated exclusive selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const [normal, slow, winner] = lenses.controls;
    const pending = f.selection.dispatch({ kind: "lens", id: slow.id }); await f.flush();
    assert.equal(f.stage.dataset.lens, normal.id);
    const winning = f.selection.dispatch({ kind: "lens", id: winner.id });
    await f.settle(); assert.equal(await pending, false); assert.equal(await winning, true);
    assert.equal(f.stage.dataset.lens, winner.id);
    assert.equal(f.buttons.filter(button => button["aria-pressed"] === "true").length, 1);
    assert.deepEqual(f.errors, []);
    const stable = f.stage.querySelectorAll("*");
    const repeated = f.selection.dispatch({ kind: "lens", id: winner.id }); await f.settle(); assert.equal(await repeated, true);
    assert.deepEqual(f.stage.querySelectorAll("*"), stable);
  } finally { f.restore(); }
});
test("failed texture replacement keeps the committed lens and can retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const committed = f.selection.state().committed;
    assert.ok(committed);
    const normal = committed.lensId;
    const nextLens = lenses.controls.find(lens => lens.id !== normal);
    assert.ok(nextLens);
    const next = nextLens.id;
    const pending = f.selection.dispatch({ kind: "lens", id: next }); await f.flush();
    const job = f.jobs.find(job => !job.done); assert.ok(job);
    const failure = assert.rejects(pending, /decode|injected/);
    job.done = true; job.reject(new Error("injected texture failure")); await failure; await f.settle();
    assert.equal(f.stage.dataset.lens, normal); assert.equal(f.selection.state().committed?.lensId, normal);
    const retry = f.selection.dispatch({ kind: "lens", id: next }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.stage.dataset.lens, next); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
test("unmount retires delayed prepared selection without late DOM publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const next = lenses.controls[1].id;
    const pending = f.selection.dispatch({ kind: "lens", id: next }); await f.flush();
    assert.ok(f.jobs.some(job => !job.done)); assert.deepEqual(f.lifetime.destroy(), []);
    await f.settle(); assert.equal(await pending, false);
    assert.equal(f.stage.children.length, 0); assert.equal(f.stage.dataset.lens, undefined);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
