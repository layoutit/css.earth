import { parseAst } from "vite";

// Test transport only. Wrap the actual imported PolyCSS factory, including calls
// made outside object-runtime, so a second camera cannot hide behind one root.
export function instrumentNativeCameraModule(source) {
  const ast = parseAst(source), exports = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  const matches = exports.flatMap(node => (node.specifiers ?? []).filter(specifier => specifier.exported.name === "createPolyCamera"));
  if (matches.length !== 1) throw new TypeError("Native camera probe requires one actual factory export.");
  const specifier = matches[0], local = specifier.local.name;
  const replacement = "__observedPreparedCameraFactory as createPolyCamera";
  return source.slice(0, specifier.start) + replacement + source.slice(specifier.end) + `\nfunction __observedPreparedCameraFactory(...args) {\n  const camera = ${local}(...args);\n  globalThis.__nativeCameraProbe.recordCamera(camera);\n  return camera;\n}\n`;
}

export function installNativeCameraProbe() {
  const cameras = [];
  globalThis.__nativeCameraProbe = {
    recordCamera(camera) { cameras.push(camera); },
    inspect() { return { nativeCameraCount: cameras.length }; },
  };
}

// A native CSSStyleDeclaration has named-property setters that bypass a JS
// prototype wrapper. Use Chrome DOM breakpoints and its attribute events to
// observe the real write and its paused application stack instead.
export async function observeNativeCameraWrites(page) {
  const session = await page.context().newCDPSession(page);
  const scripts = new Map(), sources = new Map(), records = [], pauses = [], failures = [];
  session.on("Debugger.scriptParsed", event => scripts.set(event.scriptId, event.url));
  await session.send("Debugger.enable"); await session.send("DOM.enable");
  const { root } = await session.send("DOM.getDocument", { depth: -1 });
  const nodes = [];
  for (const selector of [".polycss-camera", ".polycss-scene"]) {
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) throw new Error(`Missing native camera node ${selector}`);
    nodes.push({ nodeId, selector });
    await session.send("DOMDebugger.setDOMBreakpoint", { nodeId, type: "attribute-modified" });
  }
  session.on("Debugger.paused", async event => {
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
      if (/\.style\.(?:transform|scale|perspective|cssText)\s*=/.test(excerpt)) records.push(record);
    } catch (error) { failures.push(error.message); }
    finally { await session.send("Debugger.resume"); }
  });
  return { records, pauses, failures, async close() { await session.send("Debugger.disable"); await session.detach(); } };
}
