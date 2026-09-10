import { isArray } from '../src/platform/is-array.mts';
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire, isBuiltin } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Node, Program, ObjectExpression, Property, FunctionDeclaration, Expression, CallExpression, VariableDeclarator } from "estree";
import { isRecord, requireRecord, requireArray, requireString } from "./source-values.mts";
import { nodeName, propertyKey, sourceStart, objectProperty, staticObjectProperties } from "./runtime-ast.mts";
import type { RuntimeSourceReader } from "./runtime-source-graph.mts";
import { OBJECTS } from "../site/objects.mts";
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mts";
import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA } from "../src/platform/prepared-presentation-contract.mts";
import { readPreparedJsonExports, readPreparedPresentationModule, requirePreparedDefinitionSource,
  requirePreparedControlSource } from "./check-prepared-presentation.mts";
import { parseRuntimeSource, resolveRuntimeSource } from './runtime-source-graph.mts';
import { readDescriptorDefinition, requireDescriptorAdapterSource } from './prepared-object-source.mts';

const runtimePath = "src/platform/object-runtime.mts";
const registryPath = "site/objects.mts";
const approvedSharedData = new Set(["src/planets/sun/prepared/world-context.json"]);
// These are the application's common shell entry points. Their dependencies are
// discovered from the real Astro AST, including template expressions and scripts.
const shellEntries = ["site/layouts/PlanetLayout.astro", "site/components/PlanetShell.astro"];
const astroCompiler = requireRecord(createRequire(import.meta.resolve("astro/package.json"))("@astrojs/compiler-rs"));
function parseAstro(source: string): { ast: unknown; diagnostics: { severity: unknown; text: string; labels: {start: number}[] }[] } {
  if (typeof astroCompiler.parse !== "function") throw new Error("Astro parser is unavailable.");
  const result = requireRecord(astroCompiler.parse(source));
  const diagnostics = requireArray(result.diagnostics).map(value => { const diagnostic = requireRecord(value); return { severity: diagnostic.severity, text: requireString(diagnostic.text), labels: requireArray(diagnostic.labels).map(value => { const label = requireRecord(value); if (typeof label.start !== "number") throw new Error("Invalid Astro source offset."); return {start: label.start}; }) }; });
  return { ast: result.ast, diagnostics };
}
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
const nameOf = (node: Node | null | undefined): string => nodeName(node) ?? '';
const propertyName = (node: Node | null | undefined): string => node?.type === 'MemberExpression' ? String(node.computed ? node.property.type === 'Literal' ? node.property.value : '' : nodeName(node.property) ?? '') : '';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
function astKind<K extends Node['type']>(node: Node | null | undefined, type: K): Extract<Node, {type: K}> | undefined { return node?.type === type ? node as Extract<Node, {type: K}> : undefined; }
export function walkRuntimeAst(node: unknown, visit: (node: Node) => void): void {
  if (!isRecord(node)) return;
  if (typeof node.type === 'string' && node.type.startsWith('TS')) { if (node.expression) walkRuntimeAst(node.expression, visit); return; }
  // Values come from the trusted ESTree/Astro parsers. Astro container nodes
  // remain traversable; executable children retain their original ranges.
  if (typeof node.type === 'string') visit(node as unknown as Node);
  for (const value of Object.values(node)) {
    if (isArray(value)) for (const child of value) walkRuntimeAst(child, visit);
    else if (value && typeof value === 'object') walkRuntimeAst(value, visit);
  }
}
interface Violation {file: string; line: number; reason: string;}
interface FactorySite {file: string; line: number;}
interface Inspection {imports: string[]; violations: Violation[]; factoryCalls: number; cameraFactories: FactorySite[]; dataOnly: boolean; serverImports?: string[]; ast?: unknown;}
interface InspectionOptions {shared?: boolean; shellContent?: boolean; serverOnly?: boolean; objectIds?: readonly string[]; registryImportOffsets?: ReadonlySet<number>; registryDescriptors?: ReadonlySet<string>;}

function preparedData(source: string) {
  try { readPreparedJsonExports(source); return true; } catch { return false; }
}

function staticPreparedValue(node: Node | null | undefined): boolean {
  if (node?.type === 'Literal') return !('regex' in node && node.regex) && !('bigint' in node && node.bigint !== undefined);
  if (node?.type === 'UnaryExpression') return ['+', '-'].includes(node.operator) && node.argument?.type === 'Literal' && typeof node.argument.value === 'number';
  if (node?.type === 'ArrayExpression') return node.elements.every(staticPreparedValue);
  return node?.type === 'ObjectExpression' && node.properties.every(property => property.type === 'Property' &&
    property.kind === 'init' && !property.method && !property.computed && staticPreparedValue(property.value));
}

function frozenStaticObject(node: Node | null | undefined): ObjectExpression | null {
  if (node?.type !== 'CallExpression' || node.optional || node.callee?.type !== 'MemberExpression' || node.callee.computed ||
      nameOf(node.callee.object) !== 'Object' || nameOf(node.callee.property) !== 'freeze' || node.arguments.length !== 1) return null;
  return node.arguments[0]?.type === 'ObjectExpression' && staticPreparedValue(node.arguments[0]) ? node.arguments[0] : null;
}

function identityKeys(value: ObjectExpression | null, objectIds: readonly string[]) {
  if (!value || value.properties.length !== objectIds.length) return false;
  const keys = value.properties.map(property => property.type === 'Property' ? propertyKey(property.key) : undefined);
  return new Set(keys).size === keys.length && keys.every(key => typeof key === "string" && objectIds.includes(key));
}

function approvedNavigationMarkerInventory(ast: Program | null, file: string, objectIds: readonly string[]) {
  if (!ast || file !== 'site/prepared-navigation-markers.mjs' || ast.body.length !== 1) return false;
  const statement = ast.body[0], declaration = statement?.type === 'ExportNamedDeclaration' ? statement.declaration : null;
  const variable = declaration?.type === 'VariableDeclaration' && declaration.kind === 'const' && declaration.declarations.length === 1
    ? declaration.declarations[0] : null;
  if (variable?.id?.type !== 'Identifier' || variable.id.name !== 'PREPARED_NAVIGATION_MARKERS') return false;
  return identityKeys(frozenStaticObject(variable.init), objectIds);
}

function staticShellNavigationContent(ast: Program | null, objectIds: readonly string[]) {
  if (!ast) return false;
  const declarations = ast.body.flatMap(statement => statement?.type === 'ExportNamedDeclaration' &&
    statement.declaration?.type === 'VariableDeclaration' && statement.declaration.kind === 'const' ? statement.declaration.declarations : []);
  if (!declarations.length || declarations.length !== ast.body.length) return false;
  return declarations.some(variable => identityKeys(frozenStaticObject(variable.init), objectIds)) &&
    declarations.every(variable => variable.id?.type === 'Identifier' && staticPreparedValue(frozenStaticObject(variable.init) ?? variable.init));
}

function preparedLightingProjectionRecord(node: Node, file: string) {
  // The physical camera publishes this existing typed lighting field. It is
  // a forwarded projection value, not an object-id keyed execution table.
  if (file !== 'src/renderers/css/navigation/perspective-dolly.ts' || node.type !== 'ObjectExpression' || node.properties.length !== 1) return false;
  const field = node.properties[0];
  return field.type === 'Property' && !field.computed && !field.method && field.kind === 'init' &&
    propertyKey(field.key) === 'sun' && field.value?.type === 'MemberExpression' && !field.value.computed &&
    field.value.object?.type === 'Identifier' && field.value.object.name === 'projection' && nameOf(field.value.property) === 'sun';
}

export function inspectObjectRuntimeModule(source: string, file: string, { shared = false, shellContent = false, serverOnly = false,
  objectIds = OBJECTS.map(o => o.id), registryImportOffsets = new Set(), registryDescriptors = new Set() }: InspectionOptions = {}): Inspection {
  if ((!shared || shellContent) && preparedData(source)) return { imports: [], violations: [], factoryCalls: 0, cameraFactories: [], dataOnly: true };
  let ast: unknown;
  try {
    if (shellContent && file.endsWith('.json')) {
      JSON.parse(source);
      return { imports: [], violations: [], factoryCalls: 0, cameraFactories: [], dataOnly: true };
    }
    if (file.endsWith(".astro")) {
      const parsed = parseAstro(source);
      const error = parsed.diagnostics.find(diagnostic => diagnostic.severity === "error");
      if (error) throw Object.assign(new SyntaxError(error.text), { pos: error.labels[0]?.start ?? 0 });
      ast = parsed.ast;
    } else ast = parseRuntimeSource(source, file);
  }
  catch (error) {
    return { imports: [], violations: [{ file, line: source.slice(0, isRecord(error) && typeof error.pos === "number" ? error.pos : 0).split("\n").length,
      reason: `Invalid runtime source: ${errorMessage(error)}` }], factoryCalls: 0, cameraFactories: [], dataOnly: false };
  }
  const imports: string[] = [], violations: Violation[] = [], aliases = new Map<string, string>();
  const astroRoot = isRecord(ast) && ast.type === "AstroRoot";
  const program = isRecord(ast) && ast.type === "Program" ? ast as unknown as Program : null;
  // Follow frontmatter dependencies as server code, including transitive
  // helpers. Client script imports retain a separate, stricter browser visit.
  const frontmatterImports = new Set<Node>();
  if (shellContent && astroRoot && isRecord(ast) && isRecord(ast.frontmatter)) walkRuntimeAst(ast.frontmatter.program, node => { if (node.type === 'ImportDeclaration') frontmatterImports.add(node); });
  const serverImports = new Set<string>(), clientImports = new Set<string>();
  const ids = new Set(objectIds);
  const markerInventory = approvedNavigationMarkerInventory(program, file, objectIds);
  const staticShellContent = shellContent && staticShellNavigationContent(program, objectIds);
  const constants = new Map<string, Node | null | undefined>();
  const note = (node: Node, reason: string) => violations.push({ file, line: source.slice(0, sourceStart(node)).split("\n").length, reason });
  let factoryCalls = 0;
  const cameraFactories: FactorySite[] = [];
  walkRuntimeAst(ast, node => {
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier") constants.set(node.id.name, node.init);
  });
  function values(node: Node | null | undefined, seen = new Set<string>()): unknown[] {
    if (!node) return [];
    if (node.type === "Literal") return [node.value];
    if (node.type === "Identifier" && constants.has(node.name) && !seen.has(node.name)) return values(constants.get(node.name), new Set([...seen, node.name]));
    if (node.type === "ArrayExpression") return node.elements.flatMap(value => values(value, seen));
    if (node.type === "NewExpression" && ["Set", "Map"].includes(nameOf(node.callee))) return node.arguments.flatMap(value => values(value, seen));
    return [];
  }
  const hasId = (node: Node | null | undefined) => values(node).some(value => typeof value === "string" && ids.has(value));
  walkRuntimeAst(ast, node => { if (node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" && node.source || node.type === "ExportAllDeclaration") {
    if (isRecord(node) && (node.importKind === 'type' || node.exportKind === 'type')) return;
    const imported = requireString(node.source?.value);
    const onServer = astroRoot ? frontmatterImports.has(node) : serverOnly;
    (onServer ? serverImports : clientImports).add(imported);
    if (!registryDescriptors.has(imported) && !(onServer && isBuiltin(imported))) imports.push(imported);
    for (const specifier of node.type === "ImportDeclaration" ? node.specifiers : []) {
      const name = specifier.type === "ImportSpecifier" ? nameOf(specifier.imported) : "";
      if (name) aliases.set(specifier.local.name, name);
      if (!shared && privateFactories.has(name)) note(node, `${name} is a shared runtime owner`);
    }
  } });
  walkRuntimeAst(ast, node => {
    if (node.type === "ImportExpression" && !registryImportOffsets.has(sourceStart(node))) note(node, "Dynamic runtime imports hide ownership from the static closure");
    if ((node.type === "CallExpression" || node.type === "NewExpression") &&
        ["eval", "Function"].includes(nameOf(node.callee) || propertyName(node.callee))) note(node, "Runtime code construction hides ownership");
    if (shared) {
      if (node.type === 'CallExpression' && (aliases.get(nameOf(node.callee)) ?? nameOf(node.callee)) === 'createObjectRuntime') factoryCalls++;
      const operation = node.type === "CallExpression" || node.type === "NewExpression" ? nameOf(node.callee) || propertyName(node.callee) : "";
      if ((node.type === 'CallExpression' || node.type === 'NewExpression') && (
        ['OffscreenCanvas', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'getContext'].includes(operation) ||
        ['createElement', 'createElementNS'].includes(operation) && node.arguments.some(argument => values(argument).some(value => typeof value === 'string' && ['canvas', 'svg'].includes(value))))) {
        note(node, 'Forbidden runtime canvas, WebGL, or SVG scene rendering');
      }
      const forbiddenProperty = (name: unknown) => /^(?:clip-?path|mask(?:-.*|[A-Z].*)?|filter|mix-?blend-?mode|background-?blend-?mode)$/i.test(typeof name === 'string' ? name : '');
      const forbiddenValue = (value: unknown) => typeof value === 'string' && /(?:linear|radial|conic)-gradient\s*\(|\b(?:clip-path|mask(?:-\w+)?|filter|mix-blend-mode|background-blend-mode)\s*:/i.test(value);
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' &&
        (forbiddenProperty(propertyName(node.left)) || values(node.right).some(forbiddenValue)) ||
        node.type === 'CallExpression' && ['setProperty', 'setAttribute'].includes(operation) &&
          (values(node.arguments[0]).some(forbiddenProperty) || node.arguments.slice(1).some(argument => values(argument).some(forbiddenValue)))) {
        note(node, 'Forbidden runtime CSS masks, filters, gradients, or blending');
      }
      if (node.type === "CallExpression" &&
          (node.callee.type === "Identifier" ? aliases.get(node.callee.name) ?? node.callee.name : propertyName(node.callee)) === "createPolyCamera") {
        cameraFactories.push({ file, line: source.slice(0, sourceStart(node)).split("\n").length });
      }
      if (node.type === "BinaryExpression" && [node.left, node.right].some(hasId) ||
          node.type === "SwitchCase" && hasId(node.test) ||
          node.type === "ArrayExpression" && node.elements.length > 0 && node.elements.every(hasId) ||
          node.type === "MemberExpression" && node.computed && hasId(node.property) ||
          node.type === "CallExpression" && ["includes", "has", "get"].includes(propertyName(node.callee)) && node.callee.type === "MemberExpression" && hasId(node.callee.object) ||
          !markerInventory && !staticShellContent && !preparedLightingProjectionRecord(node, file) && node.type === "ObjectExpression" && node.properties.length > 0 &&
            node.properties.every(value => value.type === "Property" && ids.has(String(propertyKey(value.key))))) {
        note(node, "Shared execution contains object-ID dispatch data");
      }
      const literal = node.type === "Literal" ? ("regex" in node ? node.regex.pattern.replaceAll("\\/", "/") : node.value) : node.type === "TemplateElement" ? node.value.cooked : null;
      if (typeof literal === "string" && objectIds.some(id => literal.includes(`/scenes/${id}/`))) note(node, "Shared runtime contains an object-specific asset namespace");
      if (literal === "cssearth-object-runtime@1" || node.type === "Identifier" && legacyHooks.has(node.name) ||
          typeof literal === "string" && legacyHooks.has(literal)) note(node, "Legacy object callbacks are outside the prepared runtime contract");
      return;
    }
    if (("async" in node && node.async) || node.type === "AwaitExpression") note(node, "Object presentation cannot own asynchronous work");
    if (node.type === "Identifier" && nativeOwners.has(node.name) ||
        node.type === "MemberExpression" && nativeOwners.has(propertyName(node))) {
      note(node, "Native resource/scheduling references belong to the shared runtime");
    }
    if ((node.type === "CallExpression" || node.type === "NewExpression")) {
      const name = node.callee.type === "Identifier" ? aliases.get(node.callee.name) ?? node.callee.name : propertyName(node.callee);
      if (name === "createObjectRuntime") factoryCalls++;
      if (privateFactories.has(name) || nativeOwners.has(name) || privateMethods.has(name)) {
        note(node, `${name} is a shared runtime operation`);
      }
      if (privateDom.has(name)) note(node, `${name} belongs to the common retained presentation owner`);
      if (["querySelector", "querySelectorAll"].includes(name) &&
          /planet-(?:lenses|settings)|\[name=["'](?:lens|speed|motion|shadows)/.test(String(astKind(node.arguments[0], "Literal")?.value ?? ""))) {
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
  return { imports, serverImports: [...serverImports].filter(path => !clientImports.has(path)), violations, factoryCalls, cameraFactories, dataOnly: false, ast };
}

type RegistryEntry = {kind: 'descriptor'; client: string; descriptor: string; exported: string} | {kind: 'contextual' | 'legacy'; client: string; exported: string; context: string | null};
function registryLoaders(source: string, root: string) {
  const ast = parseRuntimeSource(source, registryPath), imports = new Map<string, string>(), entries = new Map<string, RegistryEntry>(), importOffsets = new Set<number>(), descriptors = new Map<string, string>(), descriptorImports = new Set<string>();
  const preparedJsonImports = new Map<string, string>();
  function fail(message: string): never { throw new TypeError(`Actual OBJECTS registry: ${message}.`); }
  for (const node of ast.body) if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportSpecifier' && node.source.value === './object-schema.mts') imports.set(specifier.local.name, nameOf(specifier.imported));
    if (specifier.type === 'ImportDefaultSpecifier' && typeof node.source.value === 'string' && node.specifiers.length === 1 && node.attributes?.length === 1 && propertyKey(node.attributes[0].key) === 'type' && node.attributes[0].value.value === 'json') {
      preparedJsonImports.set(specifier.local.name, node.source.value);
      if (node.source.value.endsWith('/object.json')) descriptors.set(specifier.local.name, node.source.value);
    }
  }
  const definitions = ast.body.flatMap(node => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration' ? node.declaration.declarations : []).filter(node => nameOf(node.id) === 'OBJECTS');
  const call = definitions[0]?.init, array = call?.type === 'CallExpression' ? call.arguments[0] : undefined;
  if (definitions.length !== 1 || call?.type !== 'CallExpression' || imports.get(nameOf(call.callee)) !== 'defineObjects' || call.arguments.length !== 1 || array?.type !== 'ArrayExpression' || !array.elements.length) fail('requires one concrete registry array');
  const helpers = new Map(ast.body.filter(node => node.type === 'FunctionDeclaration').map(node => [nameOf(node.id), node]));
  for (const entry of array.elements) {
    if (entry?.type !== 'CallExpression' || entry.arguments.length < 7 || entry.arguments.slice(8).some(value => value.type !== 'Literal') || entry.arguments.slice(0, 6).some(value => value.type !== 'Literal')) fail('entries must bind prepared metadata and one loader');
    const first = entry.arguments[0];
    if (first.type !== 'Literal' || typeof first.value !== 'string') fail('entries must bind prepared metadata and one loader');
    const helper = helpers.get(nameOf(entry.callee)), params = helper?.params ?? [], returned = astKind(helper?.body.body[0], 'ReturnStatement')?.argument;
    if (!helper || helper.async || helper.generator || params.length < 8 || entry.arguments.length > params.length ||
        params.slice(8).some(param => param.type !== 'AssignmentPattern' || param.left.type !== 'Identifier' || param.right.type !== 'Literal') || params.slice(0, 7).some(param => param.type !== 'Identifier') ||
        params[7].type !== 'AssignmentPattern' || params[7].left.type !== 'Identifier' || params[7].right.type !== 'Literal' || params[7].right.value !== null || helper.body.body.length !== 1 ||
        returned?.type !== 'CallExpression' || imports.get(nameOf(returned.callee)) !== 'defineObject' || returned.arguments.length !== 1 || returned.arguments[0].type !== 'ObjectExpression') fail('entry helper must forward its declared loader directly');
    const properties = returned.arguments[0].properties;
    const preparedValue = (value: Node): boolean => value.type === 'Literal' || value.type === 'Identifier' && params.some(param => nameOf(param.type === 'AssignmentPattern' ? param.left : param) === value.name) || value.type === 'TemplateLiteral' && value.expressions.every(preparedValue);
    const field = (name: string) => properties.find((property): property is Property => property.type === 'Property' && nameOf(property.key) === name)?.value;
    if (properties.some(property => property.type !== 'Property' || property.computed || property.kind !== 'init' || property.method || !preparedValue(property.value)) || nameOf(field('id')) !== nameOf(params[0]) || nameOf(field('loadScene')) !== nameOf(params[6]) || nameOf(field('worldFrame')) !== params[7].left.name) fail('entry helper cannot replace the object id, loader or world frame');
    const id = first.value;
    let loader = entry.arguments[6];
    let boundDescriptor: {parameter: string; argument: Node} | null = null;
    // A shared loader factory may bind one descriptor, but its body must still
    // expose the exact import and returned binding checked below.
    if (loader.type === 'CallExpression') {
      const factory = helpers.get(nameOf(loader.callee));
      const factoryReturn = astKind(factory?.body.body[0], 'ReturnStatement')?.argument;
      if (!factory || factory.async || factory.generator || factory.params.length !== 1 ||
          factory.params[0].type !== 'Identifier' || factory.body.body.length !== 1 || !factoryReturn ||
          loader.arguments.length !== 1 || loader.arguments[0].type !== 'Identifier')
        fail(`${id} loader factory must only bind one descriptor and return its loader`);
      boundDescriptor = {parameter: factory.params[0].name, argument: loader.arguments[0]};
      loader = factoryReturn;
    }
    if ((loader.type !== 'ArrowFunctionExpression' && loader.type !== 'FunctionExpression') || !loader.async || loader.generator || loader.params.length || loader.body.type !== 'BlockStatement') fail(`${id} loader must import and return one client binding`);
    const statements = loader.body.body;
    if (statements.length !== 2 || statements[0].type !== 'VariableDeclaration' || statements[0].kind !== 'const' || statements[0].declarations.length !== 1 || statements[1].type !== 'ReturnStatement') fail(`${id} loader must import and return one client binding`);
    const declaration = statements[0].declarations[0], imported = declaration.init?.type === 'AwaitExpression' ? declaration.init.argument : null;
    if (declaration.id.type !== 'ObjectPattern' || declaration.id.properties.length !== 1 || imported?.type !== 'ImportExpression' || imported.source.type !== 'Literal' || typeof imported.source.value !== 'string' || imported.options) fail(`${id} loader must return its actual imported export`);
    const binding = declaration.id.properties[0];
    if (binding.type !== 'Property' || binding.computed || binding.key.type !== 'Identifier' || binding.value.type !== 'Identifier') fail(`${id} loader must return its actual imported export`);
    const returnedBinding = statements[1].argument, client = relative(root, resolve(root, dirname(registryPath), imported.source.value));
    if (entries.has(id)) fail(`duplicate loader for ${id}`);
    const suppliedDescriptor = returnedBinding?.type === 'CallExpression' ? returnedBinding.arguments[0] : undefined;
    const actualDescriptor = boundDescriptor
      ? nameOf(suppliedDescriptor) === boundDescriptor.parameter ? boundDescriptor.argument : undefined
      : suppliedDescriptor;
    if (boundDescriptor && (!actualDescriptor || returnedBinding?.type !== 'CallExpression' ||
        returnedBinding.arguments.length !== 1 || binding.key.name !== 'loadPackagedObject'))
      fail(`${id} loader factory must forward its bound descriptor unchanged`);
    if (returnedBinding?.type === 'CallExpression' && nameOf(returnedBinding.callee) === binding.value.name && returnedBinding.arguments.length === 1 && binding.key.name === 'loadPackagedObject' && descriptors.has(nameOf(actualDescriptor))) {
      const descriptorImport = descriptors.get(nameOf(actualDescriptor))!;
      const descriptor = relative(root, resolve(root, dirname(registryPath), descriptorImport));
      if (descriptor !== `src/planets/${id}/object.json`) fail(`${id} loader must bind its own actual JSON descriptor`);
      const frame = entry.arguments[7];
      if (frame?.type !== 'MemberExpression' || frame.computed || nameOf(frame.property) !== 'worldFrame' || frame.object.type !== 'MemberExpression' || frame.object.computed || nameOf(frame.object.property) !== 'properties' || nameOf(frame.object.object) !== nameOf(actualDescriptor)) fail(`${id} world frame must come from its own actual JSON descriptor`);
      entries.set(id, {kind: 'descriptor', client, descriptor, exported: binding.key.name}); descriptorImports.add(descriptorImport);
    } else {
      const frame = entry.arguments[7], frameObject = frame?.type === 'MemberExpression' && !frame.computed && nameOf(frame.property) === 'frame' && frame.object.type === 'Identifier' ? frame.object.name : null;
      const contextPath = frameObject ? preparedJsonImports.get(frameObject) : null;
      const resolvedContext = contextPath ? relative(root, resolve(root, dirname(registryPath), contextPath)) : null;
      const contextual = entry.arguments.length === 8 && resolvedContext === `src/planets/${id}/prepared/world-context.json`;
      if (!contextual && entry.arguments.length !== 7) fail(`${id} legacy loader cannot declare an unbound world frame`);
      if (returnedBinding?.type !== 'Identifier' || returnedBinding.name !== binding.value.name) fail(`${id} loader must return its actual imported export`);
      if (client !== `src/planets/${id}/runtime/client.mjs`) fail(`${id} loader must name its actual runtime client, received ${client}`);
      entries.set(id, {kind: contextual ? 'contextual' : 'legacy', client, exported: binding.key.name, context: contextual ? resolvedContext : null});
      if (contextual && contextPath) descriptorImports.add(contextPath);
    }
    importOffsets.add(sourceStart(imported));
  }
  return {entries, importOffsets, descriptorImports};
}

function contextualClient(source: string, file: string, root: string, expectedExport: string) {
  const ast = parseRuntimeSource(source, "source.mts"), bindings = new Map<string, {name: string; path: string}>(), imports = ast.body.filter(node => node.type === 'ImportDeclaration');
  if (imports.length !== 3 || ast.body.some(node => !['ImportDeclaration', 'ExportNamedDeclaration'].includes(node.type))) return null;
  let context = null;
  for (const node of imports) {
    if (node.specifiers.length !== 1) return null;
    const specifier = node.specifiers[0];
    if (specifier.type === 'ImportSpecifier') bindings.set(specifier.local.name, { name: nameOf(specifier.imported), path: relative(root, resolve(dirname(resolve(root, file)), requireString(node.source.value))) });
    else if (specifier.type === 'ImportDefaultSpecifier' && node.source.value === '../prepared/world-context.json' &&
      node.attributes?.length === 1 && propertyKey(node.attributes[0].key) === 'type' && node.attributes[0].value.value === 'json') {
      context = { local: specifier.local.name, path: relative(root, resolve(dirname(resolve(root, file)), node.source.value)) };
    } else return null;
  }
  const exported = ast.body.filter(node => node.type === 'ExportNamedDeclaration');
  const variables = astKind(exported[0]?.declaration, 'VariableDeclaration');
  const declaration = variables?.declarations[0], call = astKind(declaration?.init, 'CallExpression');
  const factory = bindings.get(nameOf(call?.callee)), definition = bindings.get(nameOf(call?.arguments[0]));
  if (exported.length !== 1 || variables?.kind !== 'const' || variables.declarations.length !== 1 ||
    nameOf(declaration?.id) !== expectedExport || !context || !call || call.arguments.length !== 2 ||
    nameOf(call.arguments[1]) !== context.local || factory?.name !== 'bindContextualObject' ||
    factory.path !== 'site/packaged-object-runtime.mts' || definition?.name !== 'runtimeDefinition' ||
    definition.path !== file.replace(/client\.mjs$/, 'definition.mjs')) return null;
  return context;
}
function memberPath(node: Node | null | undefined): string[] | null {
  if (node?.type !== 'MemberExpression' || node.computed) return null;
  const parent = memberPath(node.object);
  if (parent === null) return node.object?.type === 'Identifier' ? [node.object.name, nameOf(node.property)] : null;
  return [...parent, nameOf(node.property)];
}
function property(object: Node | null | undefined, name: string) { return objectProperty(object, name); }
function requireContextualBindingSource(source: string) {
  const ast = parseRuntimeSource(source, 'source.mts');
  const bindings = new Map<string, {name: string; source: string}>(), defaults = new Map<string, string>();
  function fail(): never { throw new TypeError('Contextual binding must use the shared world-context factories and pinned object inventories.'); }
  function kind<K extends Node['type']>(node: Node | null | undefined, type: K): Extract<Node, {type: K}> {
    const value = astKind(node, type);
    if (!value) fail();
    return value;
  }
  for (const node of ast.body) if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportSpecifier') bindings.set(specifier.local.name, {name: nameOf(specifier.imported), source: requireString(node.source.value)});
    if (specifier.type === 'ImportDefaultSpecifier') defaults.set(specifier.local.name, requireString(node.source.value));
  }
  const binding = ast.body.flatMap(node => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration' && nameOf(node.declaration.id) === 'bindContextualObject' ? [node.declaration] : [])[0];
  const context = [...defaults].find(([, path]) => path === '../src/planets/sun/prepared/world-context.json')?.[0];
  if (!binding || !context || binding.params.length !== 3 || binding.body.body.length !== 2) fail();
  const definition = kind(binding.params[0], 'Identifier'), contextParam = kind(binding.params[1], 'Identifier');
  const frameParam = kind(binding.params[2], 'AssignmentPattern'), frameId = kind(frameParam.left, 'Identifier');
  const frameDefault = kind(frameParam.right, 'MemberExpression');
  if (frameDefault.computed || nameOf(frameDefault.property) !== 'frame') fail();
  // Typed adapters validate unknown context before forwarding its physical frame.
  const parser = astKind(frameDefault.object, 'CallExpression');
  if (parser) {
    const imported = bindings.get(nameOf(parser.callee));
    if (imported?.name !== 'parsePreparedWorldContext' || imported.source !== '../src/renderers/css/dist/index.js' ||
        parser.arguments.length !== 1 || nameOf(parser.arguments[0]) !== contextParam.name) fail();
  } else if (nameOf(frameDefault.object) !== contextParam.name) fail();
  const mountStatement = kind(binding.body.body[0], 'VariableDeclaration');
  if (mountStatement.kind !== 'const' || mountStatement.declarations.length !== 1) fail();
  const mount = mountStatement.declarations[0], mountId = kind(mount.id, 'Identifier');
  const mountInit = kind(mount.init, 'CallExpression');
  if (nameOf(mountInit.callee) !== 'bindPackagedObject' || mountInit.arguments.length !== 2 || nameOf(mountInit.arguments[0]) !== definition.name) fail();
  const factory = kind(mountInit.arguments[1], 'CallExpression'), fields = kind(factory.arguments[0], 'ObjectExpression');
  if (nameOf(factory.callee) !== 'createWorldContextObjectRuntime' || factory.arguments.length !== 1 ||
      nameOf(property(fields, 'definition')?.value) !== definition.name || nameOf(property(fields, 'context')?.value) !== contextParam.name ||
      nameOf(property(fields, 'frame')?.value) !== frameId.name) fail();
  const returned = kind(kind(binding.body.body[1], 'ReturnStatement').argument, 'CallExpression');
  const assign = kind(returned.callee, 'MemberExpression');
  if (nameOf(assign.object) !== 'Object' || nameOf(assign.property) !== 'assign' || nameOf(returned.arguments[0]) !== mountId.name) fail();
  const renderer = bindings.get('createWorldContextObjectRuntime');
  if (!renderer || bindings.get('createNavigableObjectMount')?.source !== renderer.source ||
      bindings.get('createPreparedObjectNavigation')?.source !== renderer.source) fail();
  const navigation = kind(property(returned.arguments[1], 'navigation')?.value, 'CallExpression');
  const load = kind(navigation.arguments[0], 'ArrowFunctionExpression');
  if (nameOf(navigation.callee) !== 'createPreparedObjectNavigation' || navigation.arguments.length !== 2 ||
      nameOf(navigation.arguments[1]) !== frameId.name || !load.async || load.params.length !== 0 || nameOf(load.body) !== definition.name) fail();
}

function requireApplicationWorldContextSource(source: string) {
  const ast = parseRuntimeSource(source, "source.mts"), imports = new Map<string, {name: string; source: string}>(), defaults = new Map<string, string>();
  function fail(): never { throw new TypeError('Application world context must use the shared prepared-universe inventory and pinned context.'); }
  for (const statement of ast.body) if (statement.type === 'ImportDeclaration') {
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier') imports.set(specifier.local.name, { name: nameOf(specifier.imported), source: requireString(statement.source.value) });
      if (specifier.type === 'ImportDefaultSpecifier') defaults.set(specifier.local.name, requireString(statement.source.value));
    }
  }
  const context = [...defaults].find(([, path]) => path === '../src/planets/sun/prepared/world-context.json')?.[0];
  const renderer = '../src/renderers/css/dist/universe.js';
  const required = ['createPreparedUniverse', 'prepareObjectResources', 'loadPreparedCssVolume', 'loadPreparedCssPointField', 'loadPreparedCssSurfaceShell'];
  if (!context || !required.every(name => [...imports].some(([local, binding]) => binding.name === name && binding.source === renderer)) ||
    ![...imports].some(([local, binding]) => binding.name === 'PREPARED_NAVIGATION_MARKERS' && binding.source === './prepared-navigation-markers.mjs')) fail();
  const nodes: Node[] = []; walkRuntimeAst(ast, node => nodes.push(node));
  const calls = (name: string) => nodes.filter((node): node is CallExpression => node.type === 'CallExpression' && (imports.get(nameOf(node.callee))?.name ?? nameOf(node.callee)) === name);
  const globs = nodes.filter((node): node is CallExpression => node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && nameOf(node.callee.property) === 'glob' && node.callee.object.type === 'MetaProperty');
  const patterns = globs.map(node => astKind(node.arguments[0], 'Literal')?.value);
  if (!patterns.includes('../src/objects/*/object.json') || !patterns.includes('../src/objects/*/prepared/**/*.{json,png,webp}') ||
    calls('loadPreparedCssVolume').length !== 1 || calls('loadPreparedCssPointField').length !== 1 || calls('createPreparedUniverse').length !== 1 ||
    calls('loadPreparedCssSurfaceShell').length !== 1 || calls('prepareObjectResources').length !== 1) fail();
  const resourceCalls = nodes.filter((node): node is CallExpression => node.type === 'CallExpression' && nameOf(node.callee) === 'resourceSet');
  if (!resourceCalls.some(node => memberPath(node.arguments[0])?.join('.') === 'applicationContext.volume.objectId') &&
    !resourceCalls.some(node => memberPath(node.arguments[0])?.join('.') === `${context}.volume.objectId`)) fail();
  if (!resourceCalls.some(node => memberPath(node.arguments[0])?.join('.') === 'applicationContext.stars.objectId') &&
    !resourceCalls.some(node => memberPath(node.arguments[0])?.join('.') === `${context}.stars.objectId`)) fail();
  const sets = nodes.flatMap(node => {
    if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier' || node.init?.type !== 'CallExpression' || nameOf(node.init.callee) !== 'resourceSet') return [];
    return [{id: node.id, init: node.init}];
  });
  const volumeSet = sets.find(node => memberPath(node.init.arguments[0])?.join('.') === `${context}.volume.objectId`);
  const starSet = sets.find(node => memberPath(node.init.arguments[0])?.join('.') === `${context}.stars.objectId`);
  const setFactory = nodes.flatMap(node => node.type === 'VariableDeclarator' && nameOf(node.id) === 'resourceSet' &&
    node.init?.type === 'ArrowFunctionExpression' && node.init.params.length === 1 && node.init.params[0].type === 'Identifier' ? [node.init] : [])[0];
  if (!volumeSet || !starSet || !setFactory || setFactory.body.type !== 'BlockStatement') fail();
  const resourceReturn = setFactory.body.body.find(node => node.type === 'ReturnStatement')?.argument;
  const descriptor = property(resourceReturn, 'descriptor'), resolveResource = property(resourceReturn, 'resolve'), transport = property(resourceReturn, 'transport');
  if (resourceReturn?.type !== 'ObjectExpression' || descriptor?.value?.type !== 'MemberExpression' || nameOf(descriptor.value.object) !== 'descriptors' ||
    resolveResource?.value?.type !== 'Identifier' || transport?.value?.type !== 'ObjectExpression' ||
    property(transport.value, 'read')?.value?.type !== 'FunctionExpression') fail();
  const volumeCall = calls('loadPreparedCssVolume')[0], starCall = calls('loadPreparedCssPointField')[0];
  if (volumeCall.arguments.length !== 2 || starCall.arguments.length !== 2 ||
    memberPath(volumeCall.arguments[0])?.join('.') !== `${volumeSet.id.name}.descriptor` ||
    memberPath(volumeCall.arguments[1])?.join('.') !== `${volumeSet.id.name}.transport` ||
    memberPath(starCall.arguments[0])?.join('.') !== `${starSet.id.name}.descriptor` ||
    memberPath(starCall.arguments[1])?.join('.') !== `${starSet.id.name}.transport`) fail();
  const universe = calls('createPreparedUniverse')[0];
  if (universe.arguments.length !== 1 || universe.arguments[0]?.type !== 'ObjectExpression' ||
    !['context', 'volume', 'stars', 'sprites', 'shells', 'resolveResource', 'resolveStarResource'].every(name => property(universe.arguments[0], name))) fail();
}

function requireContextFrame(value: unknown, objectId: string) {
  function fail(message: string): never { throw new TypeError(`Prepared context frame is invalid: ${message}.`); }
  const vector = (value: unknown): value is number[] => isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const sameVector = (a: readonly number[], b: readonly number[]) => a.every((value, index) => value === b[index]);
  const identity = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
  if (!isRecord(value)) fail('context is not an object');
  const context = value, frame = context.frame, focus = context.focus, camera = context.camera, stars = context.stars;
  if (context.schema !== 'cssearth-world-context@1' || !isRecord(frame) || !isRecord(focus) || !isRecord(camera) || !isRecord(stars) || focus.id !== objectId ||
      !vector(frame.originM) || !vector(focus.positionM) || !sameVector(frame.originM, focus.positionM) ||
      !positive(frame.bodyRadiusM) || focus.radiusM !== frame.bodyRadiusM || !positive(frame.metersPerUnit) ||
      !positive(camera.minimumDistanceM) || !positive(camera.maximumDistanceM) || camera.maximumDistanceM <= camera.minimumDistanceM) fail('focus, physical frame, or camera range disagree');
  if (!isRecord(context.volume) || !identity(context.volume.objectId)) fail('volume identity is not pinned');
  if (!identity(stars.objectId) || !positive(stars.fadeStartDistanceM) || !positive(stars.fullDistanceM) ||
      stars.fullDistanceM <= stars.fadeStartDistanceM || !positive(context.volume.fadeStartDistanceM) || context.volume.fadeStartDistanceM <= stars.fullDistanceM) fail('star field identity or handoff range is not pinned');
  if (!isArray(context.bodies) || !context.bodies.length) fail('body inventory is missing');
  interface ContextPoint {id: string; positionM: number[]; orbit?: {centerBodyId: string};}
  const points = new Map<string, ContextPoint>([[objectId, {id: objectId, positionM: focus.positionM}]]);
  const bodies = context.bodies.map((body: unknown) => {
    if (!isRecord(body) || !identity(body.id) || points.has(body.id) || !vector(body.positionM) || !positive(body.radiusM)) fail('body inventory identity or physical point is invalid');
    const orbit = body.orbit === undefined ? undefined : body.orbit;
    if (orbit !== undefined && (!isRecord(orbit) || !identity(orbit.centerBodyId))) fail('body orbit parent or prepared vertices are invalid');
    const point = {id: body.id, positionM: body.positionM, ...(isRecord(orbit) ? {orbit: {centerBodyId: requireString(orbit.centerBodyId)}} : {})};
    points.set(body.id, point);
    return {...point, orbit};
  });
  if (context.orbitCenters !== undefined) {
    if (!isRecord(context.orbitCenters)) fail('orbit centre inventory is invalid');
    for (const [id, center] of Object.entries(context.orbitCenters)) {
      if (!identity(id) || points.has(id) || !isRecord(center) || Object.keys(center).some(key => !['positionM', 'centerBodyId'].includes(key)) ||
          !vector(center.positionM) || !identity(center.centerBodyId)) fail('orbit centre identity or position is invalid');
      points.set(id, {id, positionM: center.positionM, orbit: {centerBodyId: center.centerBodyId}});
    }
  }
  for (const body of bodies) {
    if (body.orbit === undefined) continue;
    const orbit = requireRecord(body.orbit), parent = points.get(requireString(orbit.centerBodyId));
    const open = orbit.closed === false;
    const bodyVertexIndex = open ? orbit.bodyVertexIndex : 0;
    if (open) {
      if (!positive(orbit.displayExtentAu) || orbit.trailModel !== 'finite-open-trajectory-constant-weight' ||
          !isArray(orbit.trail) || orbit.trail.some(weight => weight !== 1)) fail('open body orbit metadata is invalid');
    } else if (['closed', 'bodyVertexIndex', 'displayExtentAu', 'trailModel'].some(key => orbit[key] !== undefined)) {
      fail('open body orbit metadata requires closed: false');
    }
    if (!parent || parent.id === body.id || !vector(orbit.centerPositionM) || !orbit.centerPositionM.every((value, axis) => value === parent.positionM[axis]) ||
        !isArray(orbit.verticesM) || orbit.verticesM.length < 8 || !orbit.verticesM.every(vector) ||
        typeof bodyVertexIndex !== 'number' || !Number.isSafeInteger(bodyVertexIndex) || bodyVertexIndex < 0 || bodyVertexIndex >= orbit.verticesM.length ||
        !orbit.verticesM[bodyVertexIndex].every((value, axis) => value === body.positionM[axis]) || !isArray(orbit.trail) || orbit.trail.length !== orbit.verticesM.length - (open ? 1 : 0) ||
        orbit.trail.some(weight => typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1)) fail('body orbit parent or prepared vertices are invalid');
  }
  // Include coordinate-only origins, even unused ones, in the hierarchy check.
  for (const [start, point] of points) {
    const ancestors = new Set([start]);
    for (let id = point.orbit?.centerBodyId; id !== undefined && id !== focus.id;) {
      const parent = points.get(id);
      if (ancestors.has(id) || !parent) fail('body orbit parent hierarchy is invalid');
      ancestors.add(id);
      id = parent.orbit?.centerBodyId;
    }
  }
  return {frame, stars: {...stars, objectId: stars.objectId}};
}

async function requireContextPointField(root: string, context: ReturnType<typeof requireContextFrame>, source: RuntimeSourceReader) {
  function fail(message: string): never { throw new TypeError(`Prepared context point field is invalid: ${message}.`); }
  const id = context.stars.objectId, directory = resolve(root, `src/objects/${id}`), descriptorPath = resolve(directory, 'object.json');
  async function readRecord(path: string, message: string) {
    try { const bytes = await source(path); return {bytes, value: requireRecord(JSON.parse(bytes))}; }
    catch { fail(message); }
  }
  const {value: descriptor} = await readRecord(descriptorPath, 'descriptor cannot be read');
  const properties = descriptor.properties, prepared = descriptor.prepared;
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== id || descriptor.type !== 'point-field' || !isRecord(properties) ||
      Object.keys(properties).length !== 2 || !isRecord(properties.frame) || properties.frame.referenceFrame !== context.frame.referenceFrame ||
      properties.frame.epochJdTt !== context.frame.epochJdTt || !isRecord(prepared) || prepared.format !== 'cssearth-css-point-field@1' ||
      typeof prepared.url !== 'string' || !prepared.url.startsWith('prepared/') || prepared.url.split('/').includes('..') ||
      typeof prepared.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(prepared.sha256)) fail('descriptor identity, frame, or pin drifted');
  const payloadPath = resolve(directory, prepared.url);
  if (relative(directory, payloadPath).startsWith('../')) fail('prepared payload escapes its object package');
  const {bytes, value: payload} = await readRecord(payloadPath, 'prepared payload cannot be read');
  const data = payload.data;
  if (createHash('sha256').update(bytes).digest('hex') !== prepared.sha256 || payload.schema !== 'cssearth-prepared-object@1' || payload.id !== id ||
      payload.type !== 'point-field' || payload.format !== prepared.format || !isRecord(data) || data.schema !== 'cssearth-css-point-field@1' || data.id !== id ||
      JSON.stringify(data.frame) !== JSON.stringify(properties.frame) || !isRecord(data.frame) || data.frame.referenceFrame !== context.frame.referenceFrame ||
      data.frame.epochJdTt !== context.frame.epochJdTt || JSON.stringify(data.frame.originM) !== JSON.stringify(context.frame.originM)) fail('prepared payload identity or physical frame drifted');
}


function thinClient(source: string, file: string, root: string, expectedExport: string) {
  const ast = parseRuntimeSource(source, "source.mts"), bindings = new Map<string, {name: string; path: string}>();
  const imports = ast.body.filter(node => node.type === "ImportDeclaration");
  if (imports.length !== 2 || imports.some(node => node.specifiers.length !== 1 || node.specifiers[0].type !== "ImportSpecifier" || node.attributes?.length)) return false;
  for (const node of ast.body) if (node.type === "ImportDeclaration") {
    for (const specifier of node.specifiers) if (specifier.type === "ImportSpecifier" && nameOf(specifier.imported)) {
      bindings.set(specifier.local.name, { name: nameOf(specifier.imported),
        path: relative(root, resolve(dirname(resolve(root, file)), requireString(node.source.value))) });
    }
  }
  const exports = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  if (exports.length !== 1 || ast.body.some(node => !["ImportDeclaration", "ExportNamedDeclaration"].includes(node.type))) return false;
  const variables = astKind(exports[0].declaration, 'VariableDeclaration');
  if (variables?.kind !== 'const' || variables.declarations.length !== 1 || nameOf(variables.declarations[0].id) !== expectedExport) return false;
  const call = astKind(variables.declarations[0].init, 'CallExpression');
  const factory = bindings.get(nameOf(call?.callee));
  const definition = bindings.get(nameOf(call?.arguments[0]));
  return call?.arguments.length === 1 && factory?.name === 'createObjectRuntime' && factory.path === runtimePath &&
    definition?.name === 'runtimeDefinition' && definition.path === file.replace(/client\.mjs$/, 'definition.mjs');
}

interface AuditObject { readonly id: string; }
interface AuditOptions {
  root?: string;
  objects?: readonly AuditObject[];
  readText?: RuntimeSourceReader;
  verifyDefinition?: (object: AuditObject, definition: unknown) => void | Promise<void>;
  strict?: boolean;
  listRuntimeFiles?: (directory: string) => Promise<string[]>;
}

export async function auditObjectRuntimeOwnership({ root = process.cwd(), objects = OBJECTS,
  readText = path => readFile(path, "utf8"), verifyDefinition, strict = true,
  listRuntimeFiles = async directory => (await readdir(directory, { recursive: true })).filter(file => /\.(?:m?[jt]s|c[jt]s|[jt]sx)$/.test(file)) }: AuditOptions = {}) {
  const entries = [], sharedClosure = new Set<string>(), sharedViolations: Violation[] = [], cameraFactorySites: FactorySite[] = [];
  let registry: ReturnType<typeof registryLoaders> = { entries: new Map(), importOffsets: new Set(), descriptorImports: new Set() };
  const sharedEdges = new Map<string, Set<string>>(), sharedFactoryCalls = new Map<string, number>(), sharedVisits = new Map<string, boolean>();
  const cache = new Map<string, Inspection>();
  const verify = verifyDefinition ?? (async (object: AuditObject, input: unknown) => {
    const definition = requireRecord(input);
    if (definition?.schema === PREPARED_OBJECT_RUNTIME_SCHEMA) {
      requireObjectRuntimeDefinition(definition, { objectId: object.id });
      return;
    }
    const { objectControls } = await import(pathToFileURL(resolve(root, `src/planets/${object.id}/site/control-content.mjs`)).href);
    requireObjectRuntimeDefinition({ ...definition, schema: PREPARED_OBJECT_RUNTIME_SCHEMA,
      id: object.id, controls: objectControls }, { objectId: object.id, controls: objectControls });
  });
  const sources = new Map<string, string>(), sourceHashes = new Map<string, string>();
  async function source(path: string): Promise<string> {
    if (!sources.has(path)) {
      const text = await readText(path);
      sources.set(path, text);
      sourceHashes.set(path, createHash('sha256').update(text).digest('hex'));
    }
    return sources.get(path)!;
  }
  function releaseObjectSources(id: string) {
    const prefix = resolve(root, 'src/planets', id) + '/';
    for (const path of sources.keys()) if (path.startsWith(prefix) && !sharedClosure.has(path)) sources.delete(path);
  }
  async function inspect(path: string, shared: boolean, shellContent = false, serverOnly = false): Promise<Inspection> {
    const key = `${shared}:${shellContent}:${serverOnly}:${path}`;
    if (!cache.has(key)) {
      cache.set(key, inspectObjectRuntimeModule(await source(path), relative(root, path), { shared, shellContent, serverOnly, objectIds: OBJECTS.map(o => o.id),
        registryImportOffsets: path === resolve(root, registryPath) ? registry.importOffsets : new Set(),
        registryDescriptors: path === resolve(root, registryPath) ? registry.descriptorImports : new Set() }));
    }
    return cache.get(key)!;
  }
  async function sharedVisit(path: string, shellContent = false, serverOnly = false): Promise<void> {
    // A server visit must never suppress a later client import of the same file.
    if (sharedVisits.get(path) === false || sharedVisits.get(path) === true && serverOnly) return;
    sharedVisits.set(path, serverOnly);
    sharedClosure.add(path);
    const file = relative(root, path);
    if (approvedSharedData.has(file)) {
      let context: unknown;
      try { context = JSON.parse(await source(path)); }
      catch { throw new TypeError(`Prepared context frame is invalid: ${file} cannot be read.`); }
      requireContextFrame(context, 'sun');
      return;
    }
    if (file.startsWith("../") || file.startsWith("src/planets/")) {
      sharedViolations.push({ file, line: 1, reason: "Shared runtime imports an object package" });
      return;
    }
    // Stylesheets are source-bound shell content, not JavaScript ownership.
    if (file.endsWith(".css")) { await source(path); return; }
    const facts = await inspect(path, true, shellContent, serverOnly);
    if (!sharedEdges.has(path)) sharedEdges.set(path, new Set());
    sharedFactoryCalls.set(path, facts.factoryCalls);
    sharedViolations.push(...facts.violations);
    for (const site of facts.cameraFactories) if (!cameraFactorySites.some(existing => existing.file === site.file && existing.line === site.line)) cameraFactorySites.push(site);
    for (const imported of facts.imports) {
      if (imported === '@layoutit/polycss') continue;
      const importedPath = imported.startsWith('.') ? resolve(dirname(path), imported) : null;
      if (importedPath && approvedSharedData.has(relative(root, importedPath))) {
        sharedEdges.get(path)!.add(importedPath);
        await sharedVisit(importedPath);
        continue;
      }
      try {
        const target = await resolveRuntimeSource(imported, path, { root, source });
        if (!target) throw new Error(`Unclosed shared runtime import ${imported}`);
        sharedEdges.get(path)!.add(target);
        await sharedVisit(target, shellContent, facts.serverImports?.includes(imported) ?? false);
      } catch (error) { sharedViolations.push({ file, line: 1, reason: errorMessage(error) }); }
    }
  }
  function reachable(path: string, reached = new Set<string>()): Set<string> {
    if (reached.has(path)) return reached;
    reached.add(path);
    for (const target of sharedEdges.get(path) ?? []) reachable(target, reached);
    return reached;
  }
  try { registry = registryLoaders(await source(resolve(root, registryPath)), root); }
  catch (error) { sharedViolations.push({ file: registryPath, line: 1, reason: errorMessage(error) }); }
  await sharedVisit(resolve(root, registryPath));
  const assemblyRoots = new Set<string>();
  for (const object of objects) {
    const loader = registry.entries.get(object.id);
    if (!loader) continue;
    if (loader.kind === 'descriptor') assemblyRoots.add(loader.client);
    else if (contextualClient(await source(resolve(root, loader.client)), loader.client, root, loader.exported)) assemblyRoots.add('site/packaged-object-runtime.mts');
    else assemblyRoots.add(runtimePath);
  }
  if (!assemblyRoots.size) assemblyRoots.add(runtimePath);
  for (const file of assemblyRoots) await sharedVisit(resolve(root, file));
  // Runtime imports are visited first, so a runtime dependency cannot acquire
  // shell-content status by also being imported by a shell component.
  for (const file of shellEntries) await sharedVisit(resolve(root, file), true);
  // Prepared context now belongs to the application, including when the Sun
  // enters through its JSON descriptor instead of a private runtime client.
  const applicationContextPath = resolve(root, 'site/application-world-context.mts');
  if (sharedClosure.has(applicationContextPath)) {
    try {
      requireApplicationWorldContextSource(await source(applicationContextPath));
      const context = requireContextFrame(JSON.parse(await source(resolve(root, 'src/planets/sun/prepared/world-context.json'))), 'sun');
      await requireContextPointField(root, context, source);
    } catch (error) { sharedViolations.push({ file: 'site/application-world-context.mts', line: 1, reason: errorMessage(error) }); }
  }
  const contextualBindingPath = resolve(root, 'site/packaged-object-runtime.mts');
  if (sharedClosure.has(contextualBindingPath)) {
    try { requireContextualBindingSource(await source(contextualBindingPath)); }
    catch (error) { sharedViolations.push({ file: 'site/packaged-object-runtime.mts', line: 1, reason: errorMessage(error) }); }
  }
  const assemblyFiles = new Set<string>();
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
      const violations: Violation[] = [], owners: string[] = [], orphanExecutors: string[] = [];
      const assemblyClosure = reachable(resolve(root, client));
      const factoryCalls = sharedFactoryCalls.get(resolve(root, client)) ?? 0;
      // The conditional adapter has one ordinary factory and one contextual
      // delegation to that same renderer. Both are source-bound below; another
      // factory anywhere in the assembled closure remains a violation.
      const assemblyFactoryCalls = [...assemblyClosure].reduce((count, file) => count + (sharedFactoryCalls.get(file) ?? 0), 0);
      let prepared = null;
      try {
        requireDescriptorAdapterSource(await source(resolve(root, client)), loader.exported);
        prepared = await readDescriptorDefinition({ objectId: object.id, descriptorFile: loader.descriptor, root, source });
        await verify(object, prepared.definition);
      } catch (error) { violations.push({ file: loader.descriptor, line: 1, reason: errorMessage(error) }); }
      if (factoryCalls !== 1) violations.push({ file: client, line: 1, reason: `Expected one actual shared factory call; found ${factoryCalls}` });
      if (assemblyFactoryCalls !== 2) violations.push({ file: client, line: 1,
        reason: `Expected one actual shared factory call per ordinary/contextual branch; found ${assemblyFactoryCalls} source sites` });
      entries.push({ id: object.id, migrated: violations.length === 0, entry: { file: loader.descriptor, exported: loader.exported, registry: registryPath, adapter: client },
        schema: prepared ? PREPARED_OBJECT_RUNTIME_SCHEMA : null, factoryCalls,
        presentation: prepared ? { file: relative(root, prepared.payloadPath), format: 'json', property: 'data' } : null,
        closure: [...(prepared?.closure ?? [])].map(path => relative(root, path)).sort(), owners, orphanExecutors, violations });
      // Keep source receipts, not every body's multi-megabyte transport text.
      releaseObjectSources(object.id);
      continue;
    }
    const runtimeDirectory = dirname(resolve(root, client));
    const clientSource = await source(resolve(root, client));
    const contextual = contextualClient(clientSource, client, root, loader.exported);
    const thin = contextual ? true : thinClient(clientSource, client, root, loader.exported);
    const visited = new Set<string>(), violations: Violation[] = [], owners: string[] = [];
    if (contextual) try {
      await sharedVisit(resolve(root, 'site/packaged-object-runtime.mts'));
      requireContextualBindingSource(await source(resolve(root, 'site/packaged-object-runtime.mts')));
      const context = requireContextFrame(JSON.parse(await source(resolve(root, contextual.path))), object.id);
      await requireContextPointField(root, context, source);
      visited.add(resolve(root, contextual.path));
    } catch (error) { violations.push({ file: client, line: 1, reason: errorMessage(error) }); }
    let plan = null;
    try {
      const id = requirePreparedDefinitionSource(await source(resolve(runtimeDirectory, "definition.mjs")));
      if (id !== object.id) throw new TypeError("Prepared definition names another object.");
      plan = requireRecord(readPreparedPresentationModule(await source(resolve(runtimeDirectory, "preparedPresentation.mjs"))));
      if (plan.schema !== PREPARED_PRESENTATION_SCHEMA) throw new TypeError("Prepared presentation schema is incompatible.");
    } catch (error) { violations.push({ file: `${relative(root, runtimeDirectory)}/definition.mjs`, line: 1, reason: errorMessage(error) }); }
    let factoryCalls = contextual ? 1 : 0;
    async function visit(path: string): Promise<void> {
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
        catch (error) { violations.push({ file, line: 1, reason: errorMessage(error) }); }
      }
      if (facts.violations.length) owners.push(file);
      factoryCalls += facts.factoryCalls;
      for (const imported of facts.imports) {
        if (contextual && path === resolve(root, client) && imported === '../prepared/world-context.json') continue;
        if (imported.startsWith(".") && /\.(?:m?[jt]s|c[jt]s|[jt]sx)$/.test(imported)) await visit(resolve(dirname(path), imported));
        else violations.push({ file, line: 1, reason: `Unclosed object runtime import ${imported}` });
      }
    }
    await visit(resolve(root, client));
    const orphanExecutors: string[] = [];
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
      catch (error) { violations.push({ file: client, line: 1, reason: errorMessage(error) }); }
    }
    entries.push({ id: object.id, migrated: thin && violations.length === 0, entry: { file: client, exported: loader.exported, registry: registryPath },
      schema: plan ? PREPARED_OBJECT_RUNTIME_SCHEMA : null,
      factoryCalls, closure: [...visited].map(path => relative(root, path)).sort(), owners, orphanExecutors, violations });
    releaseObjectSources(object.id);
  }
  const report = { schema: "cssearth-runtime-ownership@1", complete: entries.every(e => e.migrated) && !sharedViolations.length,
    entries, sharedClosure: [...sharedClosure].map(path => relative(root, path)).sort(), sharedViolations, cameraFactorySites,
    sourceHashes: Object.fromEntries([...sourceHashes].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => [relative(root, path), sha256])),
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
