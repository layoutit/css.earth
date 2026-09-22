import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import {parsePreparedObjectRuntime} from "../../../../src/renderers/css/dist/index.js";
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import runtimeDefinition from "../../../../src/objects/venus/prepared/runtime.json" with {type: "json"};
import { objectRuntimePackageTests, preparedSelectionFixture, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";

for (const name of ["atmosphere", "shadows"]) {
  for (const retirement of ["throw", "dispose", "dispose-and-throw"]) {
    test(`Venus ${name} ${retirement} cannot publish successful state or retain late callbacks`, async () => {
      const f = await preparedSelectionFixture(runtimeDefinition);
      try {
        const previous = required(f.selection.state().committed);
        const callbacks = [...f.inputs.values()].flatMap(input => [...input.listeners.values()]);
        const fail = () => {
          if (retirement !== "throw") f.lifetime.destroy();
          if (retirement !== "dispose") throw new Error("native material publication failed");
        };
        if (name === "shadows") {
          const material = required(f.stage.querySelectorAll("*").find(node => node.className === "venus-fixed-material"));
          Object.defineProperty(material.style, "backgroundPosition", { configurable: true, set: fail });
        } else {
          const classList = f.stage.classList, toggle = classList.toggle.bind(classList);
          Object.defineProperty(f.stage,"classList",{value:{...classList,toggle:(key:string,value?:boolean)=>{const result=toggle(key,value);if(key===`venus-hide-${name}`)fail();return result;}}});
        }
        const request = f.selection.dispatch({ kind: "toggle", name, value: !required(previous[name]) });
        const result = request.catch(error => error); await f.settle(); await result;
        assert.equal(f.lifetime.disposed, true);
        assert.deepEqual(f.selection.state().committed, previous);
        assert.equal(f.errors.length, retirement === "throw" ? 1 : 0);
        assert.equal(f.listenerCount(), 0); assert.equal(f.stage.children.length, 0);
        for (const callback of callbacks) invokeListener(callback); await f.flush();
        assert.deepEqual(f.selection.state().committed, previous);
        assert.equal(f.errors.length, retirement === "throw" ? 1 : 0);
      } finally { f.restore(); }
    });
  }
}

test("Venus latest lens wins; decode failure retains the committed material and retries", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const original = required(f.selection.state().committed);
    const first = f.selection.dispatch({ kind: "lens", id: "radar" }); await f.flush();
    const abandoned = [...f.jobs];
    const second = f.selection.dispatch({ kind: "lens", id: "elevation" }); await f.flush();
    for (const job of f.jobs.filter(job => !abandoned.includes(job))) { job.done = true; job.resolve(); }
    assert.equal(await second, true); assert.equal(await first, false);
    for (const job of abandoned) job.reject(new Error("late")); await f.flush();
    assert.equal(required(f.selection.state().committed).lensId, "elevation");
    const failed = f.selection.dispatch({ kind: "lens", id: "radar" }); const rejection = assert.rejects(failed, /decode/);
    await f.flush(); required(f.jobs.at(-1)).done = true; required(f.jobs.at(-1)).reject(new Error("decode failure")); await rejection;
    assert.equal(required(f.selection.state().committed).lensId, "elevation");
    const retry = f.selection.dispatch({ kind: "lens", id: "radar" }); await f.settle(); assert.equal(await retry, true);
    assert.equal(required(f.selection.state().committed).lensId, "radar"); assert.deepEqual(f.errors, []);
    const pending = f.selection.dispatch({ kind: "lens", id: required(original.lensId) }); f.lifetime.destroy(); assert.equal(await pending, false);
  } finally { f.restore(); }
});

for (const replacement of [false, true]) test(`Venus presentation retirement preserves ownership (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, parsePreparedObjectRuntime(runtimeDefinition)); f.stage.dataset.lens = "selected";
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
    assert.equal(f.stage.children.length, replacement ? 1 : 0);
    f.stage.dataset.lens = "newer"; f.lifetime.destroy(); assert.equal(f.stage.dataset.lens, "newer");
  } finally { f.restore(); }
});

function invokeListener(listener: EventListenerOrEventListenerObject): void {
  const event = new Event("change");
  if(typeof listener === "function") listener(event);
  else listener.handleEvent(event);
}
