import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import { OBJECTS } from "../site/objects.mjs";
import { requireObjectRuntimeDefinition } from "../src/platform/object-runtime-contract.mjs";

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
  const data = source.match(/^\s*(?:\/\/[^\n]*\n)*export const \w+ = Object\.freeze\(([\s\S]*)\);\s*$/);
  if (!data) return false;
  try { JSON.parse(data[1]); return true; } catch { return false; }
}

export function inspectObjectRuntimeModule(source, file, { shared = false, objectIds = OBJECTS.map(o => o.id) } = {}) {
  if (preparedData(source)) return { imports: [], violations: [], factoryCalls: 0, dataOnly: true };
  const ast = parseAst(source), imports = [], violations = [], aliases = new Map();
  const ids = new Set(objectIds);
  const note = (node, reason) => violations.push({ file, line: source.slice(0, node.start).split("\n").length, reason });
  let factoryCalls = 0;
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
    if (shared) {
      if (node.type === "BinaryExpression" && [node.left, node.right].some(value => ids.has(value?.value)) ||
          node.type === "SwitchCase" && ids.has(node.test?.value) ||
          node.type === "ArrayExpression" && node.elements.length > 0 && node.elements.every(value => ids.has(value?.value)) ||
          node.type === "MemberExpression" && node.computed && ids.has(node.property?.value) ||
          node.type === "ObjectExpression" && node.properties.length > 0 && node.properties.every(value => ids.has(value.key?.name ?? value.key?.value))) {
        note(node, "Shared execution contains object-ID dispatch data");
      }
      return;
    }
    if (node.async || node.type === "AwaitExpression") note(node, "Object presentation cannot own asynchronous work");
    if (node.type === "ImportExpression") note(node, "Dynamic runtime imports hide ownership from the static closure");
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
      if (["querySelector", "querySelectorAll"].includes(name) &&
          /planet-(?:lenses|settings)|\[name=["'](?:lens|speed|motion|shadows)/.test(node.arguments[0]?.value ?? "")) {
        note(node, "Object presentation cannot query shell controls");
      }
    }
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" &&
        playbackWrites.has(propertyName(node.left))) note(node, "Native playback writes belong to the shared owner");
  });
  return { imports, violations, factoryCalls, dataOnly: false, ast };
}

function thinClient(source, file, root) {
  const ast = parseAst(source), bindings = new Map();
  for (const node of ast.body) if (node.type === "ImportDeclaration") {
    for (const specifier of node.specifiers) if (specifier.imported?.name) {
      bindings.set(specifier.local.name, { name: specifier.imported.name,
        path: relative(root, resolve(dirname(resolve(root, file)), node.source.value)) });
    }
  }
  const exports = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  if (exports.length !== 1 || ast.body.some(node => !["ImportDeclaration", "ExportNamedDeclaration"].includes(node.type))) return false;
  const declarations = exports[0].declaration?.declarations;
  if (declarations?.length !== 1) return false;
  const call = declarations[0].init;
  const factory = bindings.get(call?.callee?.name);
  const definition = bindings.get(call?.arguments?.[0]?.name);
  return call?.type === "CallExpression" && call.arguments.length === 1 &&
    factory?.name === "createObjectRuntime" && factory.path === runtimePath &&
    definition?.name === "runtimeDefinition" && definition.path === file.replace(/client\.mjs$/, "definition.mjs");
}

export async function auditObjectRuntimeOwnership({ root = process.cwd(), objects = OBJECTS,
  readText = path => readFile(path, "utf8"), verifyDefinition, strict = true } = {}) {
  const entries = [], sharedClosure = new Set(), sharedViolations = [];
  const cache = new Map();
  const verify = verifyDefinition ?? (async object => {
    const { runtimeDefinition } = await import(pathToFileURL(resolve(root, `src/planets/${object.id}/runtime/definition.mjs`)));
    const { objectControls } = await import(pathToFileURL(resolve(root, `src/planets/${object.id}/site/control-content.mjs`)));
    requireObjectRuntimeDefinition(runtimeDefinition, { objectId: object.id, controls: objectControls });
  });
  async function inspect(path, shared) {
    const key = `${shared}:${path}`;
    if (!cache.has(key)) {
      const source = await readText(path);
      cache.set(key, inspectObjectRuntimeModule(source, relative(root, path), { shared, objectIds: OBJECTS.map(o => o.id) }));
    }
    return cache.get(key);
  }
  async function sharedVisit(path) {
    if (sharedClosure.has(path)) return;
    sharedClosure.add(path);
    const file = relative(root, path);
    if (file.startsWith("src/planets/")) {
      sharedViolations.push({ file, line: 1, reason: "Shared runtime imports an object package" });
      return;
    }
    const facts = await inspect(path, true);
    sharedViolations.push(...facts.violations);
    for (const imported of facts.imports) if (imported.startsWith(".") && imported.endsWith(".mjs")) {
      await sharedVisit(resolve(dirname(path), imported));
    }
  }
  await sharedVisit(resolve(root, runtimePath));
  for (const object of objects) {
    const client = `src/planets/${object.id}/runtime/client.mjs`;
    const thin = thinClient(await readText(resolve(root, client)), client, root);
    const visited = new Set(), violations = [], owners = [];
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
      if (facts.violations.length) owners.push(file);
      factoryCalls += facts.factoryCalls;
      for (const imported of facts.imports) if (imported.startsWith(".") && imported.endsWith(".mjs")) {
        await visit(resolve(dirname(path), imported));
      }
    }
    await visit(resolve(root, client));
    if (!thin) violations.unshift({ file: client, line: 1, reason: "Client must contain imports and one bound shared factory export only" });
    if (factoryCalls !== 1) violations.push({ file: client, line: 1, reason: `Expected one actual shared factory call; found ${factoryCalls}` });
    if (!visited.has(resolve(root, `src/planets/${object.id}/site/control-content.mjs`))) {
      violations.push({ file: client, line: 1, reason: "Definition must import the actual control-content export" });
    }
    if (thin && !violations.length) {
      try { await verify(object); }
      catch (error) { violations.push({ file: client, line: 1, reason: error.message }); }
    }
    entries.push({ id: object.id, migrated: thin && violations.length === 0,
      factoryCalls, closure: [...visited].map(path => relative(root, path)).sort(), owners, violations });
  }
  const report = { schema: "cssearth-runtime-ownership@1", complete: entries.every(e => e.migrated) && !sharedViolations.length,
    entries, sharedClosure: [...sharedClosure].map(path => relative(root, path)).sort(), sharedViolations };
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
