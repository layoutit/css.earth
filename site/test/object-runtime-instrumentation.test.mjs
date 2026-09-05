import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { installObjectRuntimeProbe, instrumentObjectRuntime } from "./object-runtime-instrumentation.mjs";
import { installNativeCameraProbe, instrumentPreparedMaterialModule } from "../../tools/native-camera-probe.mjs";

test("material instrumentation observes the actual native target and rejects absent or duplicate factories",async()=>{
  const source=await readFile(new URL("../../src/platform/prepared-material.mjs",import.meta.url),"utf8");
  const patched=instrumentPreparedMaterialModule(source);
  assert.match(patched,/recordMaterial\(element, track\)/);
  assert.throws(()=>instrumentPreparedMaterialModule(source+source),/one actual publisher/);
  assert.throws(()=>instrumentPreparedMaterialModule("export const owner = true;"),/one actual publisher/);
  installNativeCameraProbe();
  const element={},track={id:"lighting",target:18};
  globalThis.__nativeCameraProbe.recordMaterial(element,track);
  assert.equal(globalThis.__nativeCameraProbe.materialAt(0),element);
  assert.deepEqual(globalThis.__nativeCameraProbe.inspect(),{nativeCameraCount:0,materials:[{id:"lighting",target:18}]});
  delete globalThis.__nativeCameraProbe;
});

test("probe forwards actual owned operations, getters, promise identity and native failures", async () => {
  installObjectRuntimeProbe();
  let disposed = false, calls = 0;
  const promise = Promise.resolve(14);
  const actual = Object.freeze({ get disposed() { return disposed; }, work() { calls++; return promise; },
    destroy() { disposed = true; }, broken() { throw new Error("actual owner failure"); }, stats: () => ({ disposed, calls }) });
  const observed = globalThis.__objectRuntimeProbe.own("session", actual, "moon");
  assert.equal(observed.work(), promise); assert.equal(calls, 1);
  assert.equal(observed.disposed, false); observed.destroy(); assert.equal(observed.disposed, true);
  assert.throws(() => observed.broken(), /actual owner failure/);
  assert.deepEqual(globalThis.__objectRuntimeProbe.inspect()[0], { kind: "session", id: "moon", calls: { work: 1, destroy: 1, broken: 1 },
    failures: [{ operation: "broken", message: "actual owner failure" }], state: { disposed: true, calls: 1 } });
  delete globalThis.__objectRuntimeProbe;
});
test("instrumentation binds the real runtime composition and refuses missing or duplicate anchors", async () => {
  const source = await readFile(new URL("../../src/platform/object-runtime.mjs", import.meta.url), "utf8");
  const patched = instrumentObjectRuntime(source);
  assert.ok(patched.includes("constructor(...args), definition.id"));
  assert.throws(() => instrumentObjectRuntime("export function marker() {}"), /actual shared runtime/);
  assert.throws(() => instrumentObjectRuntime(source + source), /actual shared runtime/);
});
