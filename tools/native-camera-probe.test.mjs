import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { instrumentNativeCameraModule, instrumentPreparedMaterialModule,
  installNativeCameraProbe, observeNativeCameraWrites } from "./native-camera-probe.mjs";
test("the camera probe wraps every call through the actual exported factory", async () => {
  const source = 'function cameraFactory(value) { return {value}; } export { cameraFactory as createPolyCamera };';
  const recorded = []; globalThis.__nativeCameraProbe = {recordCamera: camera => recorded.push(camera)};
  try {
    const module = await import(`data:text/javascript,${encodeURIComponent(instrumentNativeCameraModule(source))}`);
    const one = module.createPolyCamera(1), two = module.createPolyCamera(2);
    assert.deepEqual(recorded, [one,two]); assert.equal(one.value,1); assert.equal(two.value,2);
  } finally { delete globalThis.__nativeCameraProbe; }
  assert.throws(()=>instrumentNativeCameraModule('export const camera = {};'),/one actual factory/);
});
test("a second real factory invocation fails the browser's one-camera requirement", async () => {
  const source = 'function camera(value) { return { value }; } export { camera as createPolyCamera };';
  installNativeCameraProbe();
  try {
    const module = await import(`data:text/javascript,${encodeURIComponent(instrumentNativeCameraModule(source))}`);
    module.createPolyCamera("first"); assert.equal(globalThis.__nativeCameraProbe.inspect().nativeCameraCount, 1);
    module.createPolyCamera("hidden second");
    assert.throws(() => assert.equal(globalThis.__nativeCameraProbe.inspect().nativeCameraCount, 1), assert.AssertionError);
  } finally { delete globalThis.__nativeCameraProbe; }
});
test("the material probe records actual factory calls and the concrete native targets", async () => {
  const source = 'export function createPreparedMaterialPublisher (track, element, camera) { return { track, element, camera }; }';
  installNativeCameraProbe();
  try {
    const module = await import(`data:text/javascript,${encodeURIComponent(instrumentPreparedMaterialModule(source))}`);
    const element = { native: true }, track = { id: "lighting", target: 20 };
    const value = module.createPreparedMaterialPublisher(track, element, {});
    assert.equal(value.element, element); assert.equal(globalThis.__nativeCameraProbe.materialAt(0), element);
    assert.deepEqual(globalThis.__nativeCameraProbe.inspect().materials, [{ id: "lighting", target: 20 }]);
    module.createPreparedMaterialPublisher(track, element, {});
    assert.throws(() => assert.deepEqual(globalThis.__nativeCameraProbe.inspect().materials, [{ id: "lighting", target: 20 }]), assert.AssertionError);
  } finally { delete globalThis.__nativeCameraProbe; }
});
test("material instrumentation requires a real direct factory and rejects callback or duplicate injection", () => {
  const source = 'export function createPreparedMaterialPublisher(track,element,camera) { return {}; }';
  for (const invalid of [
    'export const createPreparedMaterialPublisher = (track, element, camera) => ({});',
    `// ${source}\nexport const createPreparedMaterialPublisher = callback;`,
    source.replace('function ', 'async function '), source.replace('function ', 'function* '),
    source.replace('track,element,camera', '{ track },element,camera'),
    source + source,
  ]) assert.throws(() => instrumentPreparedMaterialModule(invalid));
  assert.throws(() => instrumentPreparedMaterialModule(instrumentPreparedMaterialModule(source)), /already contains native probe/);
});

function cdpFixture() {
  const session = new EventEmitter(), calls = [];
  session.detach = async () => { calls.push(["detach"]); };
  let queried = 10;
  const event = (nodeId, scriptId = "camera") => ({ reason: "DOM", data: { nodeId },
    callFrames: [{ callFrameId: "frame-1", functionName: "publish", url: "", location: { scriptId, lineNumber: 0, columnNumber: 0 } }] });
  session.send = async (method, args = {}) => {
    calls.push([method, args]);
    if (method === "Debugger.enable") session.emit("Debugger.scriptParsed", { scriptId: "camera", url: "http://localhost/src/platform/prepared-camera-runtime.mjs" });
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelector") return { nodeId: queried++ };
    if (method === "DOMDebugger.setDOMBreakpoint") {
      assert.ok(session.listenerCount("Debugger.paused") > 0, "Motion cannot pause before the handler is installed");
      if (args.nodeId === 10) session.emit("Debugger.paused", event(10));
    }
    if (method === "Debugger.getScriptSource") return { scriptSource: "cameraElement.style.scale = value;" };
    if (method === "Runtime.evaluate") return args.awaitPromise ? { result: { value: true } }
      : { result: { objectId: `material-${args.expression.match(/\d+/)[0]}` } };
    if (method === "DOM.requestNode") return { nodeId: 20 + Number(args.objectId.slice(-1)) };
    return {};
  };
  const page = { context: () => ({ newCDPSession: async () => session }), evaluate: async () => 2 };
  return { page, session, calls, event };
}
test("native observation handles a pause during setup and binds every concrete material node", async () => {
  const f = cdpFixture(), result = await observeNativeCameraWrites(f.page, { materials: true });
  f.session.emit("Debugger.paused", f.event(21));
  await result.close();
  assert.deepEqual(result.failures, []);
  assert.ok(result.records.some(record => record.target === ".polycss-camera"));
  assert.ok(result.records.some(record => record.target === "material:1"));
  assert.deepEqual(f.calls.filter(([name]) => name === "DOMDebugger.setDOMBreakpoint").map(([, args]) => args.nodeId), [10, 11, 20, 21]);
  const firstBreakpoint = f.calls.findIndex(([name]) => name === "DOMDebugger.setDOMBreakpoint");
  assert.ok(f.calls.flatMap(([name], index) => name === "Runtime.evaluate" ? [index] : []).every(index => index < firstBreakpoint),
    "Native targets must be discovered before debugger pauses can re-enter evaluation");
  assert.equal(f.calls.filter(([name]) => name === "DOMDebugger.removeDOMBreakpoint").length, 4);
  assert.equal(f.session.listenerCount("Debugger.paused"), 0);
  await result.close();
  assert.equal(f.calls.filter(([name]) => name === "detach").length, 1);
});
test("unrecognized native pauses are recorded as failures and resumed", async () => {
  const f = cdpFixture(), result = await observeNativeCameraWrites(f.page);
  f.session.emit("Debugger.paused", f.event(99)); await result.close();
  assert.match(result.failures[0], /Unexpected native camera breakpoint/);
  assert.equal(f.calls.filter(([name]) => name === "Debugger.resume").length, 2);
});
test("drain waits for paused source work, resume and an application task boundary", async () => {
  const f = cdpFixture(), send = f.session.send;
  let release;
  const source = new Promise(resolve => { release = resolve; });
  f.session.send = async (method, args) => {
    if (method === "Debugger.getScriptSource") await source;
    return send(method, args);
  };
  const result = await observeNativeCameraWrites(f.page);
  const drained = result.drain();
  await Promise.resolve();
  assert.equal(f.calls.some(([name, args]) => name === "Runtime.evaluate" && args.awaitPromise), false);
  release();
  await drained;
  const resume = f.calls.findIndex(([name]) => name === "Debugger.resume");
  const barrier = f.calls.findIndex(([name, args]) => name === "Runtime.evaluate" && args.awaitPromise);
  assert.ok(resume >= 0 && barrier > resume);
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.failures, []);
  await result.close();
});
test("a failed browser task barrier cannot silently qualify drained native work", async () => {
  const f = cdpFixture(), send = f.session.send;
  f.session.send = async (method, args) => method === "Runtime.evaluate" && args.awaitPromise
    ? { exceptionDetails: { text: "Deliberate task failure" } } : send(method, args);
  const result = await observeNativeCameraWrites(f.page);
  await assert.rejects(result.drain(), /task barrier failed/);
  await result.close();
});
test("every native camera attribute pause is retained regardless of setter spelling or foreign owner", async () => {
  const f = cdpFixture(), send = f.session.send;
  const sources = [
    "const style = cameraElement.style; style.transform = value;",
    'cameraElement.style.setProperty("transform", value);',
    'cameraElement.setAttribute("style", value);',
    "Object.assign(cameraElement.style, { transform: value });",
    'cameraElement.setAttribute("data-unexpected", value);',
  ];
  f.session.send = async (method, args) => method === "Debugger.getScriptSource" && args.scriptId.startsWith("foreign-")
    ? { scriptSource: sources[Number(args.scriptId.slice(8))] } : send(method, args);
  const result = await observeNativeCameraWrites(f.page);
  await result.drain();
  for (const [index] of sources.entries()) {
    const event = f.event(index % 2 ? 11 : 10, `foreign-${index}`);
    event.callFrames[0].url = "http://localhost/private-camera-publisher.mjs";
    f.session.emit("Debugger.paused", event);
    await result.drain();
  }
  await result.close();
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.records.slice(1).map(record => record.source), sources);
  assert.deepEqual(result.records, result.pauses);
  for (const record of result.records.slice(1)) {
    assert.throws(() => assert.ok(record.stack[0].url.includes("/src/platform/prepared-camera-runtime.mjs")), assert.AssertionError);
  }
});
test("a shared attribute writer captures exact paused string arguments without application calls", async () => {
  const f = cdpFixture(), send = f.session.send, evaluations = [];
  f.session.send = async (method, args) => {
    if (method === "Debugger.evaluateOnCallFrame") {
      evaluations.push(args);
      return { result: { value: { name: "data-polycss-camera-zoom", value: "1.25" } } };
    }
    return send(method, args);
  };
  const result = await observeNativeCameraWrites(f.page);
  await result.drain();
  const event = f.event(10, "attribute");
  event.callFrames[0].functionName = "writeAttribute";
  event.callFrames[0].url = "http://localhost/src/platform/prepared-presentation.mjs?t=1";
  f.session.emit("Debugger.paused", event);
  await result.drain();
  await result.close();
  assert.deepEqual(evaluations, [{ callFrameId: "frame-1", expression: "({name,value})", returnByValue: true, throwOnSideEffect: true }]);
  assert.equal(result.records.at(-1).attributeName, "data-polycss-camera-zoom");
  assert.equal(result.records.at(-1).attributeValue, "1.25");
  assert.deepEqual(result.failures, []);
});
test("missing, nonstring or side-effectful paused attribute arguments remain failures with their native pause retained", async () => {
  for (const receipt of [{ exceptionDetails: { text: "Side effect rejected" } }, { result: { value: { value: "1" } } },
    { result: { value: { name: "data-zoom", value: 1 } } }, new Error("Paused argument evaluation failed")]) {
    const f = cdpFixture(), send = f.session.send;
    f.session.send = async (method, args) => {
      if (method === "Debugger.evaluateOnCallFrame") { if (receipt instanceof Error) throw receipt; return receipt; }
      return send(method, args);
    };
    const result = await observeNativeCameraWrites(f.page);
    await result.drain();
    const event = f.event(10, "attribute");
    event.callFrames[0].functionName = "writeAttribute";
    event.callFrames[0].url = "http://localhost/src/platform/prepared-presentation.mjs";
    f.session.emit("Debugger.paused", event);
    await result.drain();
    await result.close();
    assert.equal(result.records.length, 2);
    assert.equal(result.records.at(-1).attributeName, undefined);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /attribute receipt|argument evaluation failed/);
    assert.equal(f.calls.filter(([name]) => name === "Debugger.resume").length, 2);
  }
});
