import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../planets/moon/runtime/definition.mjs";
import { initialObjectSelection } from "./object-runtime-contract.mjs";
import { mountPreparedPresentation, resolvePreparedPresentation } from "./prepared-presentation.mjs";
import { retainedPresentationFixture, preparedSelectionFixture } from "./test/object-runtime-package.mjs";

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
    for (const lens of runtimeDefinition.controls.lenses.controls) {
      const selection = { ...initial, lensId: lens.id };
      const plan = resolvePreparedPresentation(runtimeDefinition, { selection });
      assert.deepEqual(plan.pressedLenses, [lens.id]);
      presentation.commitSelection({ selection, resources: f.resources });
      assert.equal(f.stage.dataset.lens, lens.id);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    presentation.publishFrame({ view: { zoom: 1.8 } });
    const scaleBinding = runtimeDefinition.viewBindings[0];
    assert.equal(nodes[scaleBinding.target].style.scale, `calc(var(--moon-shell-scale) / (var(--planet-viewport-zoom-divisor) / ${1.8 / runtimeDefinition.camera.defaultZoom}))`);
    assert.equal(presentation.observe().presentation.nodes, nodes.length);
  } finally { f.restore(); }
});
test("a missing member cannot publish a partial texture group", () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    presentation.commitSelection({ selection: initial, resources: f.resources });
    const nodes = f.stage.querySelectorAll("*");
    const before = nodes.map(node => [node.style.getPropertyValue("--moon-surface-texture"), node.style.getPropertyValue("--moon-poles-texture")]);
    const next = runtimeDefinition.controls.lenses.controls.find(lens => lens.id !== initial.lensId).id;
    assert.throws(() => presentation.commitSelection({ selection: { ...initial, lensId: next }, resources: {
      url: key => key === `poles:${next}` ? null : f.resources.url(key),
    } }), /not ready/);
    assert.equal(f.stage.dataset.lens, initial.lensId);
    assert.deepEqual(nodes.map(node => [node.style.getPropertyValue("--moon-surface-texture"), node.style.getPropertyValue("--moon-poles-texture")]), before);
  } finally { f.restore(); }
});
test("the data presentation uses common selection cancellation and repeated exclusive selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const [normal, slow, winner] = runtimeDefinition.controls.lenses.controls;
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
    const normal = f.selection.state().committed.lensId;
    const next = runtimeDefinition.controls.lenses.controls.find(lens => lens.id !== normal).id;
    const pending = f.selection.dispatch({ kind: "lens", id: next }); await f.flush();
    const job = f.jobs.find(job => !job.done); assert.ok(job);
    const failure = assert.rejects(pending, /decode|injected/);
    job.done = true; job.reject(new Error("injected texture failure")); await failure; await f.settle();
    assert.equal(f.stage.dataset.lens, normal); assert.equal(f.selection.state().committed.lensId, normal);
    const retry = f.selection.dispatch({ kind: "lens", id: next }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.stage.dataset.lens, next); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
test("unmount retires delayed prepared selection without late DOM publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const next = runtimeDefinition.controls.lenses.controls[1].id;
    const pending = f.selection.dispatch({ kind: "lens", id: next }); await f.flush();
    assert.ok(f.jobs.some(job => !job.done)); assert.deepEqual(f.lifetime.destroy(), []);
    await f.settle(); assert.equal(await pending, false);
    assert.equal(f.stage.children.length, 0); assert.equal(f.stage.dataset.lens, undefined);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
