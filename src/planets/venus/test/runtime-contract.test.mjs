import assert from "node:assert/strict";
import test from "node:test";
import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { objectRuntimePackageTests, preparedSelectionFixture, retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";

objectRuntimePackageTests(runtimeDefinition);

test("Venus publishes every declared toggle through the shared controls and selection owner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const name of ["atmosphere", "stars", "shadows"]) {
      const input = f.inputs.get(name);
      input.checked = !input.checked; input.listeners.get("change")(); await f.settle();
      assert.equal(f.selection.state().committed[name], input.checked);
      if (name !== "shadows") assert.equal(f.stage.classList.contains(`venus-hide-${name}`), !input.checked);
      else assert.equal(f.presentation.observe().materials.lighting.rotationEnabled, input.checked);
    }
    assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    assert.deepEqual(f.errors, []); f.lifetime.destroy(); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

for (const name of ["atmosphere", "stars", "shadows"]) {
  for (const retirement of ["throw", "dispose", "dispose-and-throw"]) {
    test(`Venus ${name} ${retirement} cannot publish successful state or retain late callbacks`, async () => {
      const f = await preparedSelectionFixture(runtimeDefinition);
      try {
        const previous = f.selection.state().committed;
        const callbacks = [...f.inputs.values()].flatMap(input => [...input.listeners.values()]);
        const fail = () => {
          if (retirement !== "throw") f.lifetime.destroy();
          if (retirement !== "dispose") throw new Error("native material publication failed");
        };
        if (name === "shadows") {
          const material = f.stage.querySelectorAll("*").find(node => node.className === "venus-fixed-material");
          Object.defineProperty(material.style, "backgroundPosition", { configurable: true, set: fail });
        } else {
          const toggle = f.stage.classList.toggle.bind(f.stage.classList);
          f.stage.classList.toggle = (key, value) => { toggle(key, value); if (key === `venus-hide-${name}`) fail(); };
        }
        const request = f.selection.dispatch({ kind: "toggle", name, value: !previous[name] });
        const result = request.catch(error => error); await f.settle(); await result;
        assert.equal(f.lifetime.disposed, true);
        assert.deepEqual(f.selection.state().committed, previous);
        assert.equal(f.errors.length, retirement === "throw" ? 1 : 0);
        assert.equal(f.listenerCount(), 0); assert.equal(f.stage.children.length, 0);
        for (const callback of callbacks) callback(); await f.flush();
        assert.deepEqual(f.selection.state().committed, previous);
        assert.equal(f.errors.length, retirement === "throw" ? 1 : 0);
      } finally { f.restore(); }
    });
  }
}

test("Venus latest lens wins; decode failure retains the committed material and retries", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const original = f.selection.state().committed;
    const first = f.selection.dispatch({ kind: "lens", id: "radar" }); await f.flush();
    const abandoned = [...f.jobs];
    const second = f.selection.dispatch({ kind: "lens", id: "elevation" }); await f.flush();
    for (const job of f.jobs.filter(job => !abandoned.includes(job))) { job.done = true; job.resolve(); }
    assert.equal(await second, true); assert.equal(await first, false);
    for (const job of abandoned) job.reject(new Error("late")); await f.flush();
    assert.equal(f.selection.state().committed.lensId, "elevation");
    const failed = f.selection.dispatch({ kind: "lens", id: "radar" }); const rejection = assert.rejects(failed, /decode/);
    await f.flush(); f.jobs.at(-1).done = true; f.jobs.at(-1).reject(new Error("decode failure")); await rejection;
    assert.equal(f.selection.state().committed.lensId, "elevation");
    const retry = f.selection.dispatch({ kind: "lens", id: "radar" }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.selection.state().committed.lensId, "radar"); assert.deepEqual(f.errors, []);
    const pending = f.selection.dispatch({ kind: "lens", id: original.lensId }); f.lifetime.destroy(); assert.equal(await pending, false);
  } finally { f.restore(); }
});

for (const replacement of [false, true]) test(`Venus presentation retirement preserves ownership (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition); f.stage.dataset.lens = "selected";
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
    assert.equal(f.stage.children.length, replacement ? 1 : 0);
    f.stage.dataset.lens = "newer"; f.lifetime.destroy(); assert.equal(f.stage.dataset.lens, "newer");
  } finally { f.restore(); }
});
