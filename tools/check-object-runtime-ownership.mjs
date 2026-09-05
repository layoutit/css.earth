import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import { OBJECTS } from "../site/objects.mjs";
import { requireObjectRuntimeDefinition } from "../src/platform/object-runtime-contract.mjs";
import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA } from "../src/platform/prepared-presentation-contract.mjs";
import { readPreparedJsonExports, readPreparedPresentationModule, requirePreparedDefinitionSource,
  requirePreparedControlSource } from "./check-prepared-presentation.mjs";

const runtimePath = "src/platform/object-runtime.mjs";
const privateFactories = new Set(["createSceneLifetime", "createLatestSelection",
  "createPreparedImageStore", "decodePreparedImage", "releasePreparedImage",
  "createRetainedCubicSkyOrbit", "createPolyOrbitControls", "bindResponsiveOrbitPolicy",
  "mountRetainedCubicSky", "mountRetainedDirectionalSun", "bindSpeedControl",
  "createPlanetFeatureControls", "createPreparedPlayback", "createPreparedResidency",
  "createObjectSelectionRuntime", "createObjectControlBinding", "bindObjectControls"]);
const nativeOwners = new Set(["Image", "Promise", "AbortController", "Worker",
  "fetch", "setTimeout", "setInterval", "requestAnimationFrame", "queueMicrotask"]);
const privateMethods = new Set(["addEventListener", "decode", "then", "catch", "finally",
  "play", "pause", "cancel", "finish", "updatePlaybackRate"]);
const playbackWrites = new Set(["currentTime", "playbackRate", "startTime"]);
const legacyHooks = new Set(["createPresentation", "reduceSelection", "resolvePresentation"]);
const privateDom = new Set(["document", "window", "globalThis", "HTMLElement", "CSSStyleDeclaration", "MutationObserver",
  "createPolyCamera", "createPolyScene", "createElement", "createElementNS", "querySelector", "querySelectorAll",
  "append", "appendChild", "remove", "replaceChildren", "setAttribute", "setProperty", "animate"]);
const propertyName = node => node?.computed ? node.property?.value : node?.property?.name;

export function walkRuntimeAst(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walkRuntimeAst(child, visit);
    else if (value && typeof value === "object") walkRuntimeAst(value, visit);
  }
}

function preparedData(source) {
  try { readPreparedJsonExports(source); return true; } catch { return false; }
}

export function inspectObjectRuntimeModule(source, file, { shared = false, objectIds = OBJECTS.map(o => o.id) } = {}) {
  if (!shared && preparedData(source)) return { imports: [], violations: [], factoryCalls: 0, cameraFactories: [], dataOnly: true };
  const ast = parseAst(source), imports = [], violations = [], aliases = new Map();
  const ids = new Set(objectIds);
  const constants = new Map();
  const note = (node, reason) => violations.push({ file, line: source.slice(0, node.start).split("\n").length, reason });
  let factoryCalls = 0;
  const cameraFactories = [];
  walkRuntimeAst(ast, node => {
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier") constants.set(node.id.name, node.init);
  });
  function values(node, seen = new Set()) {
    if (!node) return [];
    if (node.type === "Literal") return [node.value];
    if (node.type === "Identifier" && constants.has(node.name) && !seen.has(node.name)) return values(constants.get(node.name), new Set([...seen, node.name]));
    if (node.type === "ArrayExpression") return node.elements.flatMap(value => values(value, seen));
    if (node.type === "NewExpression" && ["Set", "Map"].includes(node.callee?.name)) return node.arguments.flatMap(value => values(value, seen));
    return [];
  }
  const hasId = node => values(node).some(value => ids.has(value));
  for (const node of ast.body) if (node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" && node.source || node.type === "ExportAllDeclaration") {
    const imported = node.source.value;
    imports.push(imported);
    for (const specifier of node.specifiers ?? []) {
      const name = specifier.imported?.name;
      if (name) aliases.set(specifier.local.name, name);
      if (!shared && privateFactories.has(name)) note(node, `${name} is a shared runtime owner`);
    }
  }
  walkRuntimeAst(ast, node => {
    if (node.type === "ImportExpression") note(node, "Dynamic runtime imports hide ownership from the static closure");
    if (["CallExpression", "NewExpression"].includes(node.type) &&
        ["eval", "Function"].includes(node.callee?.name ?? propertyName(node.callee))) note(node, "Runtime code construction hides ownership");
    if (shared) {
      if (node.type === "CallExpression" &&
          (node.callee.type === "Identifier" ? aliases.get(node.callee.name) ?? node.callee.name : propertyName(node.callee)) === "createPolyCamera") {
        cameraFactories.push({ file, line: source.slice(0, node.start).split("\n").length });
      }
      if (node.type === "BinaryExpression" && [node.left, node.right].some(hasId) ||
          node.type === "SwitchCase" && hasId(node.test) ||
          node.type === "ArrayExpression" && node.elements.length > 0 && node.elements.every(hasId) ||
          node.type === "MemberExpression" && node.computed && hasId(node.property) ||
          node.type === "CallExpression" && ["includes", "has", "get"].includes(propertyName(node.callee)) && hasId(node.callee.object) ||
          node.type === "ObjectExpression" && node.properties.length > 0 && node.properties.every(value => ids.has(value.key?.name ?? value.key?.value))) {
        note(node, "Shared execution contains object-ID dispatch data");
      }
      const literal = node.type === "Literal" ? node.regex?.pattern?.replaceAll("\\/", "/") ?? node.value : node.type === "TemplateElement" ? node.value.cooked : null;
      if (typeof literal === "string" && objectIds.some(id => literal.includes(`/scenes/${id}/`))) note(node, "Shared runtime contains an object-specific asset namespace");
      if (literal === "cssearth-object-runtime@1" || node.type === "Identifier" && legacyHooks.has(node.name) ||
          typeof literal === "string" && legacyHooks.has(literal)) note(node, "Legacy object callbacks are outside the prepared runtime contract");
      return;
    }
    if (node.async || node.type === "AwaitExpression") note(node, "Object presentation cannot own asynchronous work");
    if (node.type === "Identifier" && nativeOwners.has(node.name) ||
        node.type === "MemberExpression" && nativeOwners.has(propertyName(node))) {
      note(node, "Native resource/scheduling references belong to the shared runtime");
    }
    if (["CallExpression", "NewExpression"].includes(node.type)) {
      const name = node.callee.type === "Identifier" ? aliases.get(node.callee.name) ?? node.callee.name : propertyName(node.callee);
      if (name === "createObjectRuntime") factoryCalls++;
      if (privateFactories.has(name) || nativeOwners.has(name) || privateMethods.has(name)) {
        note(node, `${name} is a shared runtime operation`);
      }
      if (privateDom.has(name)) note(node, `${name} belongs to the common retained presentation owner`);
      if (["querySelector", "querySelectorAll"].includes(name) &&
          /planet-(?:lenses|settings)|\[name=["'](?:lens|speed|motion|shadows)/.test(node.arguments[0]?.value ?? "")) {
        note(node, "Object presentation cannot query shell controls");
      }
    }
    if (node.type === "Identifier" && privateDom.has(node.name)) note(node, "Object content cannot access native scene state");
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" &&
        playbackWrites.has(propertyName(node.left))) note(node, "Native playback writes belong to the shared owner");
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" &&
        [node.left, node.left.object].some(value => ["style", "dataset", "className", "innerHTML", "textContent"].includes(propertyName(value)))) {
      note(node, "Object content cannot publish native DOM or material state");
    }
  });
  return { imports, violations, factoryCalls, cameraFactories, dataOnly: false, ast };
}

function thinClient(source, file, root) {
  const ast = parseAst(source), bindings = new Map();
  const imports = ast.body.filter(node => node.type === "ImportDeclaration");
  if (imports.length !== 2 || imports.some(node => node.specifiers.length !== 1 || node.specifiers[0].type !== "ImportSpecifier" || node.attributes?.length)) return false;
  for (const node of ast.body) if (node.type === "ImportDeclaration") {
    for (const specifier of node.specifiers) if (specifier.imported?.name) {
      bindings.set(specifier.local.name, { name: specifier.imported.name,
        path: relative(root, resolve(dirname(resolve(root, file)), node.source.value)) });
    }
  }
  const exports = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  if (exports.length !== 1 || ast.body.some(node => !["ImportDeclaration", "ExportNamedDeclaration"].includes(node.type))) return false;
  const declarations = exports[0].declaration?.declarations;
  if (exports[0].declaration?.kind !== "const" || declarations?.length !== 1) return false;
  const call = declarations[0].init;
  const factory = bindings.get(call?.callee?.name);
  const definition = bindings.get(call?.arguments?.[0]?.name);
  return call?.type === "CallExpression" && call.arguments.length === 1 &&
    factory?.name === "createObjectRuntime" && factory.path === runtimePath &&
    definition?.name === "runtimeDefinition" && definition.path === file.replace(/client\.mjs$/, "definition.mjs");
}

export async function auditObjectRuntimeOwnership({ root = process.cwd(), objects = OBJECTS,
  readText = path => readFile(path, "utf8"), verifyDefinition, strict = true,
  listRuntimeFiles = async directory => (await readdir(directory, { recursive: true })).filter(file => file.endsWith(".mjs")) } = {}) {
  const entries = [], sharedClosure = new Set(), sharedViolations = [], cameraFactorySites = [];
  const cache = new Map();
  const verify = verifyDefinition ?? (async (object, plan) => {
    const { objectControls } = await import(pathToFileURL(resolve(root, `src/planets/${object.id}/site/control-content.mjs`)));
    requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA,
      id: object.id, controls: objectControls }, { objectId: object.id, controls: objectControls });
  });
  const sources = new Map();
  async function source(path) { if (!sources.has(path)) sources.set(path, await readText(path)); return sources.get(path); }
  async function inspect(path, shared) {
    const key = `${shared}:${path}`;
    if (!cache.has(key)) {
      cache.set(key, inspectObjectRuntimeModule(await source(path), relative(root, path), { shared, objectIds: OBJECTS.map(o => o.id) }));
    }
    return cache.get(key);
  }
  async function sharedVisit(path) {
    if (sharedClosure.has(path)) return;
    sharedClosure.add(path);
    const file = relative(root, path);
    if (file.startsWith("../") || file.startsWith("src/planets/")) {
      sharedViolations.push({ file, line: 1, reason: "Shared runtime imports an object package" });
      return;
    }
    const facts = await inspect(path, true);
    sharedViolations.push(...facts.violations);
    cameraFactorySites.push(...facts.cameraFactories);
    for (const imported of facts.imports) {
      if (imported.startsWith(".") && imported.endsWith(".mjs")) await sharedVisit(resolve(dirname(path), imported));
      else if (imported !== "@layoutit/polycss") sharedViolations.push({ file, line: 1, reason: `Unclosed shared runtime import ${imported}` });
    }
  }
  await sharedVisit(resolve(root, runtimePath));
  if (cameraFactorySites.length !== 1) sharedViolations.push({ file: runtimePath, line: 1,
    reason: `Expected one shared native camera factory site; found ${cameraFactorySites.length}` });
  for (const object of objects) {
    const client = `src/planets/${object.id}/runtime/client.mjs`;
    const runtimeDirectory = resolve(root, `src/planets/${object.id}/runtime`);
    const thin = thinClient(await source(resolve(root, client)), client, root);
    const visited = new Set(), violations = [], owners = [];
    let plan = null;
    try {
      const id = requirePreparedDefinitionSource(await source(resolve(runtimeDirectory, "definition.mjs")));
      if (id !== object.id) throw new TypeError("Prepared definition names another object.");
      plan = readPreparedPresentationModule(await source(resolve(runtimeDirectory, "preparedPresentation.mjs")));
      if (plan.schema !== PREPARED_PRESENTATION_SCHEMA) throw new TypeError("Prepared presentation schema is incompatible.");
    } catch (error) { violations.push({ file: `${relative(root, runtimeDirectory)}/definition.mjs`, line: 1, reason: error.message }); }
    let factoryCalls = 0;
    async function visit(path) {
      if (visited.has(path)) return;
      visited.add(path);
      const file = relative(root, path), isObject = file.startsWith("src/planets/");
      if (!isObject && sharedClosure.has(path)) return;
      if (isObject && !file.startsWith(`src/planets/${object.id}/`)) {
        violations.push({ file, line: 1, reason: "Object runtime imports another object package" });
        return;
      }
      const facts = await inspect(path, false);
      violations.push(...facts.violations);
      if (path.startsWith(`${runtimeDirectory}/`) && !["client.mjs", "definition.mjs"].includes(relative(runtimeDirectory, path)) && !facts.dataOnly) {
        violations.push({ file, line: 1, reason: "Object runtime modules must be serialized data; private executors are forbidden" });
      }
      if (file === `src/planets/${object.id}/site/control-content.mjs`) {
        try { requirePreparedControlSource(await source(path)); }
        catch (error) { violations.push({ file, line: 1, reason: error.message }); }
      }
      if (facts.violations.length) owners.push(file);
      factoryCalls += facts.factoryCalls;
      for (const imported of facts.imports) {
        if (imported.startsWith(".") && imported.endsWith(".mjs")) await visit(resolve(dirname(path), imported));
        else violations.push({ file, line: 1, reason: `Unclosed object runtime import ${imported}` });
      }
    }
    await visit(resolve(root, client));
    const orphanExecutors = [];
    for (const file of await listRuntimeFiles(runtimeDirectory)) {
      const path = resolve(runtimeDirectory, file);
      if (visited.has(path) || ["client.mjs", "definition.mjs"].includes(file)) continue;
      if (!preparedData(await source(path))) {
        orphanExecutors.push(relative(root, path));
        violations.push({ file: relative(root, path), line: 1, reason: "Unreferenced private runtime executor must be removed" });
      }
    }
    if (!thin) violations.unshift({ file: client, line: 1, reason: "Client must contain imports and one bound shared factory export only" });
    if (factoryCalls !== 1) violations.push({ file: client, line: 1, reason: `Expected one actual shared factory call; found ${factoryCalls}` });
    if (!visited.has(resolve(root, `src/planets/${object.id}/site/control-content.mjs`))) {
      violations.push({ file: client, line: 1, reason: "Definition must import the actual control-content export" });
    }
    if (thin && !violations.length) {
      try { await verify(object, plan); }
      catch (error) { violations.push({ file: client, line: 1, reason: error.message }); }
    }
    entries.push({ id: object.id, migrated: thin && violations.length === 0,
      schema: plan ? PREPARED_OBJECT_RUNTIME_SCHEMA : null,
      factoryCalls, closure: [...visited].map(path => relative(root, path)).sort(), owners, orphanExecutors, violations });
  }
  const report = { schema: "cssearth-runtime-ownership@1", complete: entries.every(e => e.migrated) && !sharedViolations.length,
    entries, sharedClosure: [...sharedClosure].map(path => relative(root, path)).sort(), sharedViolations, cameraFactorySites,
    sourceHashes: Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) =>
      [relative(root, path), createHash("sha256").update(content).digest("hex")])),
    nativeOwnership: { status: "UNPROVEN", reason: "Static closure does not observe native cameras, writes, scheduling, or resource lifetime." } };
  if (strict && !report.complete) {
    const failures = [...entries.flatMap(entry => entry.violations), ...sharedViolations];
    throw new Error(failures.map(v => `${v.file}:${v.line}: ${v.reason}`).join("\n"));
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2), index = args.indexOf("--object");
  const id = index < 0 ? null : args[index + 1];
  if (id && !OBJECTS.some(object => object.id === id)) throw new Error(`Unknown registered object: ${id}`);
  if (!args.includes("--inventory") && !args.includes("--all") && !id) throw new Error("Use --inventory, --object ID, or --all.");
  const report = await auditObjectRuntimeOwnership({ objects: id ? OBJECTS.filter(object => object.id === id) : OBJECTS,
    strict: !args.includes("--inventory") });
  console.log(JSON.stringify(report, null, 2));
}
