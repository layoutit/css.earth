import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import { OBJECTS } from "../site/objects.mjs";
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";
import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA } from "../src/platform/prepared-presentation-contract.mjs";
import { readPreparedJsonExports, readPreparedPresentationModule, requirePreparedDefinitionSource,
  requirePreparedControlSource } from "./check-prepared-presentation.mjs";
import { parseRuntimeSource, resolveRuntimeSource } from './runtime-source-graph.mjs';
import { readDescriptorDefinition, requireDescriptorAdapterSource } from './prepared-object-source.mjs';

const runtimePath = "src/platform/object-runtime.mjs";
const registryPath = "site/objects.mjs";
// These are the application's common shell entry points. Their dependencies are
// discovered from the real Astro AST, including template expressions and scripts.
const shellEntries = ["site/layouts/PlanetLayout.astro", "site/components/PlanetShell.astro"];
const { parse: parseAstro } = createRequire(import.meta.resolve("astro/package.json"))("@astrojs/compiler-rs");
const privateFactories = new Set(["createSceneLifetime",
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
  if (node.type?.startsWith('TS')) {
    if (node.expression) walkRuntimeAst(node.expression, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walkRuntimeAst(child, visit);
    else if (value && typeof value === "object") walkRuntimeAst(value, visit);
  }
}

function preparedData(source) {
  try { readPreparedJsonExports(source); return true; } catch { return false; }
}

export function inspectObjectRuntimeModule(source, file, { shared = false, shellContent = false,
  objectIds = OBJECTS.map(o => o.id), registryImportOffsets = new Set(), registryDescriptors = new Set() } = {}) {
  if ((!shared || shellContent) && preparedData(source)) return { imports: [], violations: [], factoryCalls: 0, cameraFactories: [], dataOnly: true };
  let ast;
  try {
    if (file.endsWith(".astro")) {
      const parsed = parseAstro(source);
      const error = parsed.diagnostics.find(diagnostic => diagnostic.severity === "error");
      if (error) throw Object.assign(new SyntaxError(error.text), { pos: error.labels[0]?.start ?? 0 });
      ast = parsed.ast;
    } else ast = parseRuntimeSource(source, file);
  }
  catch (error) {
    return { imports: [], violations: [{ file, line: source.slice(0, error.pos ?? 0).split("\n").length,
      reason: `Invalid runtime source: ${error.message}` }], factoryCalls: 0, cameraFactories: [], dataOnly: false };
  }
  const imports = [], violations = [], aliases = new Map();
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
  walkRuntimeAst(ast, node => { if (node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" && node.source || node.type === "ExportAllDeclaration") {
    if (node.importKind === 'type' || node.exportKind === 'type') return;
    const imported = node.source.value;
    if (!registryDescriptors.has(imported)) imports.push(imported);
    for (const specifier of node.specifiers ?? []) {
      const name = specifier.imported?.name;
      if (name) aliases.set(specifier.local.name, name);
      if (!shared && privateFactories.has(name)) note(node, `${name} is a shared runtime owner`);
    }
  } });
  walkRuntimeAst(ast, node => {
    if (node.type === "ImportExpression" && !registryImportOffsets.has(node.start)) note(node, "Dynamic runtime imports hide ownership from the static closure");
    if (["CallExpression", "NewExpression"].includes(node.type) &&
        ["eval", "Function"].includes(node.callee?.name ?? propertyName(node.callee))) note(node, "Runtime code construction hides ownership");
    if (shared) {
      if (node.type === 'CallExpression' && (aliases.get(node.callee?.name) ?? node.callee?.name) === 'createObjectRuntime') factoryCalls++;
      const operation = node.callee?.name ?? propertyName(node.callee);
      if (['CallExpression', 'NewExpression'].includes(node.type) && (
        ['OffscreenCanvas', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'getContext'].includes(operation) ||
        ['createElement', 'createElementNS'].includes(operation) && node.arguments.some(argument => values(argument).some(value => ['canvas', 'svg'].includes(value))))) {
        note(node, 'Forbidden runtime canvas, WebGL, or SVG scene rendering');
      }
      const forbiddenProperty = name => /^(?:clip-?path|mask(?:-.*|[A-Z].*)?|filter|mix-?blend-?mode|background-?blend-?mode)$/i.test(name ?? '');
      const forbiddenValue = value => typeof value === 'string' && /(?:linear|radial|conic)-gradient\s*\(|\b(?:clip-path|mask(?:-\w+)?|filter|mix-blend-mode|background-blend-mode)\s*:/i.test(value);
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' &&
        (forbiddenProperty(propertyName(node.left)) || values(node.right).some(forbiddenValue)) ||
        node.type === 'CallExpression' && ['setProperty', 'setAttribute'].includes(operation) &&
          (values(node.arguments[0]).some(forbiddenProperty) || node.arguments.slice(1).some(argument => values(argument).some(forbiddenValue)))) {
        note(node, 'Forbidden runtime CSS masks, filters, gradients, or blending');
      }
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

function registryLoaders(source, root) {
  const ast = parseAst(source), imports = new Map(), entries = new Map(), importOffsets = new Set(), descriptors = new Map(), descriptorImports = new Set();
  const fail = message => { throw new TypeError(`Actual OBJECTS registry: ${message}.`); };
  for (const node of ast.body) if (node.type === "ImportDeclaration") for (const specifier of node.specifiers) {
    if (specifier.type === "ImportSpecifier" && node.source.value === "./object-schema.mjs") imports.set(specifier.local.name, specifier.imported.name);
    if (specifier.type === 'ImportDefaultSpecifier' && node.specifiers.length === 1 && node.attributes?.length === 1 &&
      (node.attributes[0].key.name ?? node.attributes[0].key.value) === 'type' && node.attributes[0].value.value === 'json') descriptors.set(specifier.local.name, node.source.value);
  }
  const definitions = ast.body.filter(node => node.type === "ExportNamedDeclaration").flatMap(node => node.declaration?.declarations ?? [])
    .filter(node => node.id.name === "OBJECTS");
  const call = definitions[0]?.init, array = call?.arguments?.[0];
  if (definitions.length !== 1 || call?.type !== "CallExpression" || imports.get(call.callee?.name) !== "defineObjects" ||
      call.arguments.length !== 1 || array?.type !== "ArrayExpression" || !array.elements.length) fail("requires one concrete registry array");
  const helpers = new Map(ast.body.filter(node => node.type === "FunctionDeclaration").map(node => [node.id.name, node]));
  for (const entry of array.elements) {
    if (entry?.type !== "CallExpression" || ![7, 8].includes(entry.arguments.length) ||
        entry.arguments.slice(0, 6).some(value => value.type !== "Literal") || typeof entry.arguments[0].value !== "string") fail("entries must bind prepared metadata and one loader");
    const helper = helpers.get(entry.callee?.name), params = helper?.params ?? [], returned = helper?.body.body[0]?.argument;
    if (!helper || helper.async || helper.generator || params.length !== 8 || params.slice(0, 7).some(param => param.type !== "Identifier") ||
        params[7].type !== 'AssignmentPattern' || params[7].left.type !== 'Identifier' || params[7].right.type !== 'Literal' || params[7].right.value !== null || helper.body.body.length !== 1 ||
        helper.body.body[0].type !== "ReturnStatement" || returned?.type !== "CallExpression" ||
        imports.get(returned.callee?.name) !== "defineObject" || returned.arguments.length !== 1 || returned.arguments[0].type !== "ObjectExpression") fail("entry helper must forward its declared loader directly");
    const properties = returned.arguments[0].properties;
    const preparedValue = value => value.type === "Literal" || value.type === "Identifier" && params.some(param => (param.type === 'AssignmentPattern' ? param.left.name : param.name) === value.name) ||
      value.type === "TemplateLiteral" && value.expressions.every(preparedValue);
    if (properties.some(property => property.type !== "Property" || property.computed || property.kind !== "init" || property.method || !preparedValue(property.value)) ||
        properties.find(property => property.key.name === "id")?.value.name !== params[0].name ||
        properties.find(property => property.key.name === "loadScene")?.value.name !== params[6].name ||
        properties.find(property => property.key.name === 'worldFrame')?.value.name !== params[7].left.name) fail("entry helper cannot replace the object id, loader or world frame");
    const id = entry.arguments[0].value, loader = entry.arguments[6], statements = loader.body?.body;
    if (!["ArrowFunctionExpression", "FunctionExpression"].includes(loader.type) || !loader.async || loader.generator || loader.params.length ||
        statements?.length !== 2 || statements[0].type !== "VariableDeclaration" || statements[0].kind !== "const" ||
        statements[0].declarations.length !== 1 || statements[1].type !== "ReturnStatement") fail(`${id} loader must import and return one client binding`);
    const declaration = statements[0].declarations[0], imported = declaration.init?.argument, binding = declaration.id?.properties?.[0];
    if (declaration.id?.type !== "ObjectPattern" || declaration.id.properties.length !== 1 || binding.type !== "Property" || binding.computed ||
        binding.key.type !== "Identifier" || binding.value.type !== "Identifier" || declaration.init?.type !== "AwaitExpression" ||
        imported?.type !== "ImportExpression" || imported.source?.type !== "Literal" || typeof imported.source.value !== "string" ||
        imported.options) fail(`${id} loader must return its actual imported export`);
    const returnedBinding = statements[1].argument;
    const client = relative(root, resolve(root, dirname(registryPath), imported.source.value));
    if (entries.has(id)) fail(`duplicate loader for ${id}`);
    if (returnedBinding?.type === 'CallExpression' && returnedBinding.callee.name === binding.value.name && returnedBinding.arguments.length === 1 &&
      binding.key.name === 'loadPackagedObject' && descriptors.has(returnedBinding.arguments[0]?.name)) {
      const descriptorImport = descriptors.get(returnedBinding.arguments[0].name);
      const descriptor = relative(root, resolve(root, dirname(registryPath), descriptorImport));
      if (descriptor !== `src/planets/${id}/object.json`) fail(`${id} loader must bind its own actual JSON descriptor`);
      const frame = entry.arguments[7];
      if (frame?.type !== 'MemberExpression' || frame.computed || frame.property.name !== 'worldFrame' ||
          frame.object.type !== 'MemberExpression' || frame.object.computed || frame.object.property.name !== 'properties' ||
          frame.object.object.name !== returnedBinding.arguments[0].name) fail(`${id} world frame must come from its own actual JSON descriptor`);
      entries.set(id, { kind: 'descriptor', client, descriptor, exported: binding.key.name });
      descriptorImports.add(descriptorImport);
    } else {
      if (entry.arguments.length !== 7) fail(`${id} legacy loader cannot declare an unbound world frame`);
      if (returnedBinding?.type !== 'Identifier' || returnedBinding.name !== binding.value.name) fail(`${id} loader must return its actual imported export`);
      if (client !== `src/planets/${id}/runtime/client.mjs`) fail(`${id} loader must name its actual runtime client, received ${client}`);
      entries.set(id, { kind: 'legacy', client, exported: binding.key.name });
    }
    importOffsets.add(imported.start);
  }
  return { entries, importOffsets, descriptorImports };
}

function thinClient(source, file, root, expectedExport) {
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
  if (exports[0].declaration?.kind !== "const" || declarations?.length !== 1 || declarations[0].id?.name !== expectedExport) return false;
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
  let registry = { entries: new Map(), importOffsets: new Set(), descriptorImports: new Set() };
  const sharedEdges = new Map(), sharedFactoryCalls = new Map();
  const cache = new Map();
  const verify = verifyDefinition ?? (async (object, plan) => {
    const { objectControls } = await import(pathToFileURL(resolve(root, `src/planets/${object.id}/site/control-content.mjs`)));
    requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA,
      id: object.id, controls: objectControls }, { objectId: object.id, controls: objectControls });
  });
  const sources = new Map();
  async function source(path) { if (!sources.has(path)) sources.set(path, await readText(path)); return sources.get(path); }
  async function inspect(path, shared, shellContent = false) {
    const key = `${shared}:${shellContent}:${path}`;
    if (!cache.has(key)) {
      cache.set(key, inspectObjectRuntimeModule(await source(path), relative(root, path), { shared, shellContent, objectIds: OBJECTS.map(o => o.id),
        registryImportOffsets: path === resolve(root, registryPath) ? registry.importOffsets : new Set(),
        registryDescriptors: path === resolve(root, registryPath) ? registry.descriptorImports : new Set() }));
    }
    return cache.get(key);
  }
  async function sharedVisit(path, shellContent = false) {
    if (sharedClosure.has(path)) return;
    sharedClosure.add(path);
    const file = relative(root, path);
    if (file.startsWith("../") || file.startsWith("src/planets/")) {
      sharedViolations.push({ file, line: 1, reason: "Shared runtime imports an object package" });
      return;
    }
    // Stylesheets are source-bound shell content, not JavaScript ownership.
    if (file.endsWith(".css")) { await source(path); return; }
    const facts = await inspect(path, true, shellContent);
    sharedEdges.set(path, new Set());
    sharedFactoryCalls.set(path, facts.factoryCalls);
    sharedViolations.push(...facts.violations);
    cameraFactorySites.push(...facts.cameraFactories);
    for (const imported of facts.imports) {
      if (imported === '@layoutit/polycss') continue;
      try {
        const target = await resolveRuntimeSource(imported, path, { root, source });
        if (!target) throw new Error(`Unclosed shared runtime import ${imported}`);
        sharedEdges.get(path).add(target);
        await sharedVisit(target, shellContent);
      } catch (error) { sharedViolations.push({ file, line: 1, reason: error.message }); }
    }
  }
  function reachable(path, reached = new Set()) {
    if (reached.has(path)) return reached;
    reached.add(path);
    for (const target of sharedEdges.get(path) ?? []) reachable(target, reached);
    return reached;
  }
  try { registry = registryLoaders(await source(resolve(root, registryPath)), root); }
  catch (error) { sharedViolations.push({ file: registryPath, line: 1, reason: error.message }); }
  await sharedVisit(resolve(root, registryPath));
  const assemblyRoots = new Set(objects.map(object => registry.entries.get(object.id))
    .filter(Boolean).map(loader => loader.kind === 'descriptor' ? loader.client : runtimePath));
  if (!assemblyRoots.size) assemblyRoots.add(runtimePath);
  for (const file of assemblyRoots) await sharedVisit(resolve(root, file));
  // Runtime imports are visited first, so a runtime dependency cannot acquire
  // shell-content status by also being imported by a shell component.
  for (const file of shellEntries) await sharedVisit(resolve(root, file), true);
  const assemblyFiles = new Set();
  for (const assembly of assemblyRoots) {
    const closure = reachable(resolve(root, assembly));
    for (const file of closure) assemblyFiles.add(file);
    const count = cameraFactorySites.filter(site => closure.has(resolve(root, site.file))).length;
    if (count !== 1) sharedViolations.push({ file: assembly, line: 1,
      reason: `Expected one shared native camera factory site; found ${count} in registered assembly` });
  }
  if (cameraFactorySites.some(site => !assemblyFiles.has(resolve(root, site.file)))) sharedViolations.push({ file: registryPath, line: 1,
    reason: `Unexpected native camera factory site; found ${cameraFactorySites.length} including an owner outside every registered assembly` });
  for (const object of objects) {
    const loader = registry.entries.get(object.id);
    if (!loader) {
      entries.push({ id: object.id, migrated: false, schema: null, factoryCalls: 0, closure: [], owners: [], orphanExecutors: [],
        violations: [{ file: registryPath, line: 1, reason: "Actual registered runtime loader is missing or invalid" }] });
      continue;
    }
    const { client } = loader;
    if (loader.kind === 'descriptor') {
      const violations = [], owners = [], orphanExecutors = [];
      const assemblyClosure = reachable(resolve(root, client));
      const factoryCalls = [...assemblyClosure].reduce((count, file) => count + (sharedFactoryCalls.get(file) ?? 0), 0);
      let prepared = null;
      try {
        requireDescriptorAdapterSource(await source(resolve(root, client)), loader.exported);
        prepared = await readDescriptorDefinition({ objectId: object.id, descriptorFile: loader.descriptor, root, source });
        await verify(object, prepared.plan);
        const directory = resolve(root, `src/planets/${object.id}/runtime`);
        for (const file of await listRuntimeFiles(directory)) {
          const path = resolve(directory, file);
          if (prepared.closure.has(path) || file === 'definition.mjs') continue;
          if (file === 'client.mjs') {
            const oldSource = await source(path), ast = parseAst(oldSource);
            const exportName = ast.body.find(node => node.type === 'ExportNamedDeclaration')?.declaration?.declarations?.[0]?.id?.name;
            if (thinClient(oldSource, relative(root, path), root, exportName)) continue;
          }
          if (!preparedData(await source(path))) {
            orphanExecutors.push(relative(root, path));
            violations.push({ file: relative(root, path), line: 1, reason: 'Unreferenced private runtime executor must be removed' });
          }
        }
      } catch (error) { violations.push({ file: loader.descriptor, line: 1, reason: error.message }); }
      if (factoryCalls !== 1) violations.push({ file: client, line: 1, reason: `Expected one actual shared factory call; found ${factoryCalls}` });
      entries.push({ id: object.id, migrated: violations.length === 0, entry: { file: loader.descriptor, exported: loader.exported, registry: registryPath, adapter: client },
        schema: prepared ? PREPARED_OBJECT_RUNTIME_SCHEMA : null, factoryCalls,
        presentation: prepared ? { file: relative(root, prepared.payloadPath), format: 'json', property: 'data' } : null,
        closure: [...(prepared?.closure ?? [])].map(path => relative(root, path)).sort(), owners, orphanExecutors, violations });
      continue;
    }
    const runtimeDirectory = dirname(resolve(root, client));
    const thin = thinClient(await source(resolve(root, client)), client, root, loader.exported);
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
      if (![client, client.replace(/client\.mjs$/, "definition.mjs"), `src/planets/${object.id}/site/control-content.mjs`].includes(file) && !facts.dataOnly) {
        violations.push({ file, line: 1, reason: "Every non-shared reachable module must be serialized data; private executors are forbidden" });
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
    entries.push({ id: object.id, migrated: thin && violations.length === 0, entry: { file: client, exported: loader.exported, registry: registryPath },
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
