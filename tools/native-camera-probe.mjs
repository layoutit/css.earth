import { parseAst } from "vite";

// Test transport only. Wrap the actual imported PolyCSS factory, including calls
// made outside object-runtime, so a second camera cannot hide behind one root.
export function instrumentNativeCameraModule(source) {
  const ast = parseAst(source), exports = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  const matches = exports.filter(node => !node.source).flatMap(node => (node.specifiers ?? []).filter(specifier => specifier.exported.name === "createPolyCamera"));
  if (matches.length !== 1) throw new TypeError("Native camera probe requires one actual factory export.");
  const specifier = matches[0], local = specifier.local.name;
  const fresh = base => { while (source.includes(base)) base += "_"; return base; };
  const wrapper = fresh("__observedPreparedCameraFactory"), args = fresh("__observedCameraArguments"), value = fresh("__observedCameraValue");
  const replacement = `${wrapper} as createPolyCamera`;
  return source.slice(0, specifier.start) + replacement + source.slice(specifier.end) + `\nfunction ${wrapper}(...${args}) {\n  const ${value} = ${local}(...${args});\n  globalThis.__nativeCameraProbe.recordCamera(${value});\n  return ${value};\n}\n`;
}

export function installNativeCameraProbe() {
  const cameras = [], materials = [];
  globalThis.__nativeCameraProbe = {
    recordCamera(camera) { cameras.push(camera); },
    recordMaterial(element, track) { materials.push({ element, id: track.id, target: track.target }); },
    materialAt(index) { return materials[index].element; },
    inspect() { return { nativeCameraCount: cameras.length, materials: materials.map(({ id, target }) => ({ id, target })) }; },
  };
}

export function instrumentPreparedMaterialModule(source) {
  const ast = parseAst(source);
  const factories = ast.body.filter(node => node.type === "ExportNamedDeclaration" &&
    node.declaration?.type === "FunctionDeclaration" && node.declaration.id?.name === "createPreparedMaterialPublisher");
  const declaration = factories[0]?.declaration;
  if (factories.length !== 1 || declaration.async || declaration.generator ||
      declaration.params.length !== 3 || declaration.params.some((node, index) => node.type !== "Identifier" || node.name !== ["track", "element", "camera"][index])) {
    throw new TypeError("Material probe requires one actual publisher factory.");
  }
  function alreadyInstrumented(node) {
    if (!node || typeof node !== "object") return false;
    if (node.type === "MemberExpression" && (node.computed ? node.property?.value : node.property?.name) === "__nativeCameraProbe") return true;
    return Object.values(node).some(value => Array.isArray(value) ? value.some(alreadyInstrumented) : alreadyInstrumented(value));
  }
  if (alreadyInstrumented(ast)) throw new TypeError("Material publisher already contains native probe injection.");
  const insertion = declaration.body.start + 1;
  return source.slice(0, insertion) + "\n  globalThis.__nativeCameraProbe.recordMaterial(element, track);" + source.slice(insertion);
}

// A native CSSStyleDeclaration has named-property setters that bypass a JS
// prototype wrapper. Use Chrome DOM breakpoints and its attribute events to
// observe the real write and its paused application stack instead.
export async function observeNativeCameraWrites(page, { materials = false } = {}) {
  const session = await page.context().newCDPSession(page);
  const scripts = new Map(), sources = new Map(), records = [], pauses = [], failures = [];
  session.on("Debugger.scriptParsed", event => scripts.set(event.scriptId, event.url));
  const nodes = [];
  const pending = new Set();
  // Install before the first breakpoint: Motion is already running in the
  // ownership scenario and can publish while the remaining targets are bound.
  const onPaused = event => {
    const work = (async () => {
      try {
        const target = nodes.find(node => node.nodeId === event.data?.nodeId)?.selector;
        const top = event.callFrames[0];
        if (!target || !top || event.reason !== "DOM") throw new Error("Unexpected native camera breakpoint");
        if (!sources.has(top.location.scriptId)) sources.set(top.location.scriptId,
          (await session.send("Debugger.getScriptSource", { scriptId: top.location.scriptId })).scriptSource.split("\n"));
        const source = sources.get(top.location.scriptId)[top.location.lineNumber];
        const excerpt = source.slice(Math.max(0, top.location.columnNumber - 100), top.location.columnNumber + 220);
        const record = { target, source: excerpt, stack: event.callFrames.map(frame => ({ name: frame.functionName,
          url: scripts.get(frame.location.scriptId) ?? frame.url,
          line: frame.location.lineNumber + 1, column: frame.location.columnNumber + 1 })) };
        pauses.push(record);
        // The native breakpoint identifies the mutation. Source spelling is
        // diagnostic only: aliases, setProperty, setAttribute and built-ins
        // must not evade the shared-writer ownership assertion.
        records.push(record);
        if (top.functionName === "writeAttribute" &&
            /\/src\/platform\/prepared-presentation\.mjs(?:[?#]|$)/.test(record.stack[0].url)) {
          if (typeof top.callFrameId !== "string") throw new Error("Native attribute receipt is missing its paused call frame");
          const receipt = await session.send("Debugger.evaluateOnCallFrame", {
            callFrameId: top.callFrameId, expression: "({name,value})", returnByValue: true, throwOnSideEffect: true,
          });
          const arguments_ = receipt.result?.value;
          if (receipt.exceptionDetails || typeof arguments_?.name !== "string" || typeof arguments_?.value !== "string") {
            throw new Error("Native attribute receipt requires side-effect-free string arguments");
          }
          record.attributeName = arguments_.name;
          record.attributeValue = arguments_.value;
        }
      } catch (error) { failures.push(error.message); }
      finally { await session.send("Debugger.resume"); }
    })();
    pending.add(work); work.catch(error => failures.push(error.message)).finally(() => pending.delete(work));
  };
  session.on("Debugger.paused", onPaused);
  async function settlePausedWork() {
    while (pending.size) await Promise.allSettled([...pending]);
  }
  let closing = null;
  async function drain() {
    if (closing) return closing;
    await settlePausedWork();
    // A task barrier completes after the resumed application stack and its
    // microtasks unwind. It does not execute an application action through a
    // debugger evaluation; callers must still queue clicks as native input.
    const barrier = await session.send("Runtime.evaluate", {
      expression: "new Promise(resolve => setTimeout(() => resolve(true), 0))",
      awaitPromise: true, returnByValue: true,
    });
    if (barrier.exceptionDetails || barrier.result?.value !== true) throw new Error("Native observation task barrier failed");
    await settlePausedWork();
  }
  function close() {
    return closing ??= (async () => {
      try {
        for (const node of nodes.filter(node => node.bound)) {
          try { await session.send("DOMDebugger.removeDOMBreakpoint", { nodeId: node.nodeId, type: "attribute-modified" }); }
          catch (error) { failures.push(error.message); }
        }
        await settlePausedWork();
        try { await session.send("Debugger.disable"); } catch (error) { failures.push(error.message); }
      } finally { session.off("Debugger.paused", onPaused); await session.detach(); }
    })();
  }
  try {
  await session.send("Debugger.enable"); await session.send("DOM.enable");
  const { root } = await session.send("DOM.getDocument", { depth: -1 });
  for (const selector of [".polycss-camera", ".polycss-scene"]) {
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) throw new Error(`Missing native camera node ${selector}`);
    nodes.push({ nodeId, selector });
  }
  if(materials) {
    const count=await page.evaluate(()=>globalThis.__nativeCameraProbe.inspect().materials.length);
    for(let index=0;index<count;index++) {
      const {result}=await session.send("Runtime.evaluate",{expression:`globalThis.__nativeCameraProbe.materialAt(${index})`});
      const {nodeId}=await session.send("DOM.requestNode",{objectId:result.objectId});
      if(!nodeId)throw new Error("Missing actual prepared material target");
      nodes.push({nodeId,selector:`material:${index}`});
      await session.send("Runtime.releaseObject",{objectId:result.objectId});
    }
  }
  // Resolve every native target before any breakpoint can pause application
  // code. Runtime.evaluate during a pause can otherwise re-enter that code.
  for (const node of nodes) {
    await session.send("DOMDebugger.setDOMBreakpoint", { nodeId: node.nodeId, type: "attribute-modified" });
    node.bound = true;
  }
  } catch (error) { await close(); throw error; }
  return { records, pauses, failures, drain, close };
}
