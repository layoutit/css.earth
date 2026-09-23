import { sha256 } from '../../src/platform/sha256.mts';
import { isArray } from '../../src/platform/is-array.mts';
import { readFile } from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Node, Program, ObjectExpression, Property, FunctionDeclaration, Expression, CallExpression, VariableDeclarator } from "estree";
import { isRecord, requireRecord, requireArray, requireString } from "../sources/source-values.mts";
import { nodeName, propertyKey, sourceStart, sourceEnd, objectProperty, staticObjectProperties } from "./runtime-ast.mts";
import type { RuntimeSourceReader } from "./runtime-source-graph.mts";
import { SCENE_OBJECTS as OBJECTS } from "../../site/objects.mts";
import { parseNavigationDistance } from '../../site/navigation/navigation-distance.mts';
import { definePreparedFocus } from '../../site/prepared-focus-object.mts';
import { parseObjectDiscovery } from '../../site/object-discovery.mts';
import { requireObjectRuntimeDefinition } from "../contract/object-runtime-contract.mts";
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../../src/platform/prepared-presentation-contract.mts";
import { readPreparedJsonExports } from "../prepared/check-prepared-presentation.mts";
import { parseRuntimeSource, resolveRuntimeSource } from './runtime-source-graph.mts';
import { readDescriptorDefinition, requireAuthoredSourcePins, requireDescriptorAdapterSource } from '../prepared/prepared-object-source.mts';
import { requireAuthoredWorldFrameReceipt } from '../sources/authored-world-frame.mts';
import { readContextObjects } from '../prepare/prepare-catalog.mts';

const registryPath = "site/objects.mts";
const approvedSharedData = new Set(["src/objects/sun/prepared/world-context.json", "src/objects/sun/prepared/world-context-summary.json"]);
// Registered objects own packages; context folders beside them (galaxies, nebulae, the heliosphere) are application data.
const objectPackageIds: ReadonlySet<string> = new Set(OBJECTS.map(object => object.id));
const objectPackage = (file: string) => file.startsWith('src/objects/') && objectPackageIds.has(file.split('/')[2] ?? '');
// These are the application's common shell entry points. Their dependencies are
// discovered from the real Astro AST, including template expressions and scripts.
const shellEntries = ["site/layouts/ObjectLayout.astro", "site/components/ObjectShell.astro"];
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
  "createObjectFeatureControls", "createPreparedPlayback", "createPreparedResidency",
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

// The application fetches one pinned JSON plan: over the network in a real
// browser, or, on the Node-only `file:` branch, through one JSON-attributed
// dynamic import. That import's URL comes from a Node-only path helper module,
// imported by a literal dynamic import inside that same branch. The helper is
// followed and scanned like any other dependency, as Node-side code (its `node:`
// builtins are allowed; code construction and computed imports are not). The
// JSON import names the same project file as `source`, and its attributes mean it
// can only load data, never an executor, so it is the one computed import this
// plan may contain.
const worldContextNodeHelper = '../tools/prepared/prepared-world-context-node-source.mts';
function worldContextPlanImport(ast: Program | null, file: string): {data: number; helper: number} | null {
  if (!ast || file !== 'site/world-context-plan.mts') return null;
  const nodes: Node[] = []; walkRuntimeAst(ast, node => nodes.push(node));
  const source = nodes.find((node): node is VariableDeclarator => node.type === 'VariableDeclarator' && nameOf(node.id) === 'source');
  const url = astKind(source?.init, 'NewExpression');
  const base = astKind(url?.arguments[1], 'MemberExpression');
  const parser = ast.body.find(node => node.type === 'ImportDeclaration' && node.source.value === '../src/renderers/css/dist/index.js');
  const imports = nodes.filter((node): node is Extract<Node, {type: 'ImportExpression'}> => node.type === 'ImportExpression');
  const helper = imports.find(node => node.source.type === 'Literal' && node.source.value === worldContextNodeHelper);
  const data = imports.find(node => node !== helper);
  const options = (node: Node | undefined) => node?.type === 'ImportExpression' && 'options' in node ? node.options as Node | null : null;
  const json = property(property(options(data), 'with')?.value, 'type')?.value;
  const locate = astKind(data?.source, 'CallExpression');
  const locateBase = astKind(locate?.arguments[0], 'MemberExpression');
  const locatePath = astKind(locate?.arguments[1], 'Literal');
  // The helper's only binding is destructured straight from its awaited literal import.
  const binding = nodes.find((node): node is VariableDeclarator => node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern' &&
    astKind(node.init, 'AwaitExpression')?.argument === helper);
  const pattern = astKind(binding?.id, 'ObjectPattern');
  const output = nodes.find((node): node is VariableDeclarator => node.type === 'VariableDeclarator' && nameOf(node.id) === 'APPLICATION_WORLD_CONTEXT');
  const validation = astKind(output?.init, 'CallExpression');
  const read = astKind(astKind(validation?.arguments[0], 'AwaitExpression')?.argument, 'CallExpression');
  const sourcePath = url?.arguments[0]?.type === 'Literal' ? url.arguments[0].value : undefined;
  // Both imports sit in the one `source.protocol === 'file:'` branch a browser never takes.
  const nodeBranch = nodes.find((node): node is Extract<Node, {type: 'IfStatement'}> => node.type === 'IfStatement' &&
    node.test.type === 'BinaryExpression' && node.test.operator === '===' && memberPath(node.test.left)?.join('.') === 'source.protocol' &&
    node.test.right.type === 'Literal' && node.test.right.value === 'file:');
  const inNodeBranch = (node: Node | undefined) => !!node && !!nodeBranch && sourceStart(node) >= sourceStart(nodeBranch.consequent) && sourceEnd(node) <= sourceEnd(nodeBranch.consequent);
  if (!url || nameOf(url.callee) !== 'URL' || url.arguments.length !== 2 ||
      sourcePath !== '../src/objects/sun/prepared/world-context-summary.json' ||
      base?.object.type !== 'MetaProperty' || base.object.meta.name !== 'import' || base.object.property.name !== 'meta' || nameOf(base.property) !== 'url' ||
      parser?.type !== 'ImportDeclaration' || !parser.specifiers.some(specifier => specifier.type === 'ImportSpecifier' && nameOf(specifier.imported) === 'parsePreparedWorldContextSummary' && specifier.local.name === 'parsePreparedWorldContextSummary') ||
      imports.length !== 2 || !helper || options(helper) || !data || !inNodeBranch(helper) || !inNodeBranch(data) ||
      json?.type !== 'Literal' || json.value !== 'json' ||
      pattern?.properties.length !== 1 || pattern.properties[0]?.type !== 'Property' ||
      propertyKey(pattern.properties[0].key) !== 'nodeProjectFileUrl' || nameOf(pattern.properties[0].value) !== 'nodeProjectFileUrl' ||
      nameOf(locate?.callee) !== 'nodeProjectFileUrl' || locate?.arguments.length !== 2 ||
      locateBase?.object.type !== 'MetaProperty' || locateBase.object.meta.name !== 'import' || locateBase.object.property.name !== 'meta' || nameOf(locateBase.property) !== 'url' ||
      // Project-relative spelling of the same file `source` names from `site/`.
      locatePath?.value !== sourcePath.slice('../'.length) ||
      nameOf(validation?.callee) !== 'parsePreparedWorldContextSummary' || validation?.arguments.length !== 1 ||
      nameOf(read?.callee) !== 'readPreparedWorldContext' || read?.arguments.length !== 0) return null;
  // No assignment may redirect the statically bound source or the helper binding.
  if (nodes.some(node => node.type === 'AssignmentExpression' && (['source', 'nodeProjectFileUrl'].includes(nameOf(node.left)) || memberPath(node.left)?.[0] === 'source'))) return null;
  return { data: sourceStart(data), helper: sourceStart(helper) };
}

export function inspectObjectRuntimeModule(source: string, file: string, { shared = false, shellContent = false, serverOnly = false,
  objectIds = OBJECTS.map(o => o.id), registryImportOffsets = new Set(), registryDescriptors = new Set() }: InspectionOptions = {}): Inspection {
  if ((!shared || shellContent) && preparedData(source)) return { imports: [], violations: [], factoryCalls: 0, cameraFactories: [], dataOnly: true };
  let ast: unknown;
  try {
    if (file.endsWith('.json')) {
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
  const contextImport = worldContextPlanImport(program, file);
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
      node.type === "ExportNamedDeclaration" && node.source || node.type === "ExportAllDeclaration" ||
      // A dynamic import with a literal specifier is followed like a static one; only a computed specifier hides its owner.
      node.type === "ImportExpression" && node.source.type === "Literal" && !registryImportOffsets.has(sourceStart(node))) {
    if (isRecord(node) && (node.importKind === 'type' || node.exportKind === 'type')) return;
    const imported = requireString(node.type === "ImportExpression" ? (node.source.type === "Literal" ? node.source.value : undefined) : node.source?.value);
    if (/^@wwtelescope\/engine(?:-|$)/u.test(imported)) note(node, 'WWT WebGL engine is forbidden in the CSS runtime');
    // The world-context plan's validated helper import runs only on its Node `file:` branch.
    const onServer = node.type === "ImportExpression" ? sourceStart(node) === contextImport?.helper :
      (astroRoot ? frontmatterImports.has(node) : serverOnly);
    (onServer ? serverImports : clientImports).add(imported);
    if (!registryDescriptors.has(imported) && !(onServer && isBuiltin(imported))) imports.push(imported);
    for (const specifier of node.type === "ImportDeclaration" ? node.specifiers : []) {
      const name = specifier.type === "ImportSpecifier" ? nameOf(specifier.imported) : "";
      if (name) aliases.set(specifier.local.name, name);
      if (!shared && privateFactories.has(name)) note(node, `${name} is a shared runtime owner`);
    }
  } });
  walkRuntimeAst(ast, node => {
    if (node.type === "ImportExpression" && node.source.type !== "Literal" && !registryImportOffsets.has(sourceStart(node)) && sourceStart(node) !== contextImport?.data) note(node, "Computed dynamic imports hide ownership from the static closure");
    if ((node.type === "CallExpression" || node.type === "NewExpression") &&
        ["eval", "Function"].includes(nameOf(node.callee) || propertyName(node.callee))) note(node, "Runtime code construction hides ownership");
    if (shared) {
      if (node.type === 'CallExpression' && (aliases.get(nameOf(node.callee)) ?? nameOf(node.callee)) === 'createObjectRuntime') factoryCalls++;
      const operation = node.type === "CallExpression" || node.type === "NewExpression" ? nameOf(node.callee) || propertyName(node.callee) : "";
      if ((node.type === 'CallExpression' || node.type === 'NewExpression') && (
        ['OffscreenCanvas', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'getContext'].includes(operation) ||
        ['createElement', 'createElementNS'].includes(operation) && node.arguments.some(argument => values(argument).some(value => value === 'canvas')))) {
        note(node, 'Forbidden runtime canvas or WebGL scene rendering');
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

type RegistryEntry = {kind: 'descriptor'; client: string; descriptor: string; exported: string};
async function registryLoaders(source: string, root: string, readSource: (path: string) => Promise<string>) {
  const ast = parseRuntimeSource(source, registryPath), imports = new Map<string, string>();
  function fail(message: string): never { throw new TypeError(`Actual OBJECTS registry: ${message}.`); }
  for (const node of ast.body) if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportSpecifier' && node.source.value === './object-schema.mts') imports.set(specifier.local.name, nameOf(specifier.imported));

  }
  const definitions = ast.body.flatMap(node => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration' ? node.declaration.declarations : []).filter(node => nameOf(node.id) === 'OBJECTS');
  const call = definitions[0]?.init, array = call?.type === 'CallExpression' ? call.arguments[0] : undefined;
  if (definitions.length === 1 && call?.type === 'CallExpression' && imports.get(nameOf(call.callee)) === 'defineObjects' && call.arguments.length === 1 && array?.type === 'ArrayExpression' && array.elements.length === 2 &&
      array.elements.every(entry => entry?.type === 'SpreadElement' && entry.argument.type === 'CallExpression')) {
    const scene = array.elements[0], focus = array.elements[1];
    if (scene?.type !== 'SpreadElement' || scene.argument.type !== 'CallExpression' || focus?.type !== 'SpreadElement' || focus.argument.type !== 'CallExpression') fail('requires scene and focus capability projections');
    const mapping = focus.argument;
    const focusImport = ast.body.find(node => node.type === 'ImportDeclaration' && node.source.value === './prepared-focus-objects.json');
    const validatorImport = ast.body.find(node => node.type === 'ImportDeclaration' && node.source.value === './prepared-focus-object.mts');
    if (focusImport?.type !== 'ImportDeclaration' || focusImport.specifiers.length !== 1 || focusImport.specifiers[0].type !== 'ImportDefaultSpecifier' ||
        validatorImport?.type !== 'ImportDeclaration' || !validatorImport.specifiers.some(specifier => specifier.type === 'ImportSpecifier' && nameOf(specifier.imported) === 'definePreparedFocus' && nameOf(mapping.arguments[0]) === specifier.local.name) ||
        mapping.callee.type !== 'MemberExpression' || mapping.callee.computed || nameOf(mapping.callee.object) !== focusImport.specifiers[0].local.name || nameOf(mapping.callee.property) !== 'map' || mapping.arguments.length !== 1) fail('focus destinations must use the prepared inventory and validator');
    return catalogRegistryLoaders(ast, scene.argument, root, readSource);
  }
  if (definitions.length === 1 && call?.type === 'CallExpression' && imports.get(nameOf(call.callee)) === 'defineObjects' && call.arguments.length === 1 && array?.type === 'CallExpression') {
    return catalogRegistryLoaders(ast, array, root, readSource);
  }
  if (definitions.length !== 1 || call?.type !== 'CallExpression' || imports.get(nameOf(call.callee)) !== 'defineObjects' || call.arguments.length !== 1 || array?.type !== 'ArrayExpression' || !array.elements.length) fail('requires one concrete registry array');
  fail('scene loaders must use the prepared descriptor catalogue');
}

async function catalogRegistryLoaders(ast: Program, mapping: CallExpression, root: string, readSource: (path: string) => Promise<string>) {
  function fail(message: string): never { throw new TypeError(`Actual OBJECTS registry: ${message}.`); }
  function kind<K extends Node['type']>(node: Node | null | undefined, type: K): Extract<Node, {type: K}> {
    const value = astKind(node, type);
    if (!value) fail('catalogue loader must forward its bound descriptor unchanged');
    return value;
  }
  const namedImport = (program: Program, owner: string, exported: string) => program.body.flatMap(node =>
    node.type === 'ImportDeclaration' && node.source.value === owner ? node.specifiers.flatMap(specifier =>
      specifier.type === 'ImportSpecifier' && nameOf(specifier.imported) === exported ? [specifier.local.name] : []) : []);
  const descriptorFile = 'site/prepared-object-catalog.mts';
  const inventoryNames = namedImport(ast, './prepared-object-catalog.mts', 'OBJECT_DESCRIPTORS');
  const entryNames = namedImport(ast, './object-catalog.mts', 'catalogEntry');
  const map = kind(mapping.callee, 'MemberExpression');
  if (inventoryNames.length !== 1 || entryNames.length !== 1 || map.computed || map.optional || mapping.type !== 'CallExpression' || mapping.optional ||
      nameOf(map.object) !== inventoryNames[0] || nameOf(map.property) !== 'map' || mapping.arguments.length !== 1) fail('requires the prepared descriptor inventory');
  const mapper = kind(mapping.arguments[0], 'ArrowFunctionExpression');
  const statements = kind(mapper.body, 'BlockStatement').body;
  if (mapper.async || mapper.params.length !== 1 || statements.length !== 2) fail('catalogue loader factory must only bind one descriptor');
  const parameter = kind(mapper.params[0], 'Identifier').name;
  const variable = kind(statements[0], 'VariableDeclaration');
  if (variable.kind !== 'const' || variable.declarations.length !== 1) fail('catalogue loader factory must only bind one descriptor');
  const declaration = variable.declarations[0], pattern = kind(declaration.id, 'ObjectPattern');
  const binding = kind(declaration.init, 'CallExpression');
  if (pattern.properties.length !== 3 || !['order', 'context'].every((name, index) => {
    const field = pattern.properties[index];
    return field.type === 'Property' && !field.computed && field.kind === 'init' && nameOf(field.key) === name && field.value.type === 'Identifier';
  }) || binding.optional || nameOf(binding.callee) !== entryNames[0] || ![2, 3, 4].includes(binding.arguments.length) || nameOf(binding.arguments[0]) !== parameter) fail('catalogue loader must forward its bound descriptor unchanged');
  const rest = kind(pattern.properties[2], 'RestElement');
  if (nameOf(kind(statements[1], 'ReturnStatement').argument) !== kind(rest.argument, 'Identifier').name) fail('catalogue mapper must return the declared object');
  const loader = kind(binding.arguments[1], 'ArrowFunctionExpression');
  const loaderStatements = kind(loader.body, 'BlockStatement').body;
  if (!loader.async || loader.params.length !== 1 || loader.params[0].type !== 'Identifier' || loaderStatements.length !== 2) fail('catalogue loader factory must import and return one binding');
  const importedVariable = kind(loaderStatements[0], 'VariableDeclaration');
  if (importedVariable.kind !== 'const' || importedVariable.declarations.length !== 1) fail('catalogue loader must import one binding');
  const importedDeclaration = importedVariable.declarations[0], importedPattern = kind(importedDeclaration.id, 'ObjectPattern');
  const imported = kind(kind(importedDeclaration.init, 'AwaitExpression').argument, 'ImportExpression');
  if (importedPattern.properties.length !== 1 || imported.source.type !== 'Literal' || imported.source.value !== './packaged-object-runtime.mts' || imported.options) fail('catalogue loader must use the shared package transport');
  const field = kind(importedPattern.properties[0], 'Property');
  const returned = kind(kind(loaderStatements[1], 'ReturnStatement').argument, 'CallExpression');
  if (field.computed || field.kind !== 'init' || nameOf(field.key) !== 'loadPackagedObject' || returned.optional ||
      nameOf(returned.callee) !== kind(field.value, 'Identifier').name || returned.arguments.length !== 2 || nameOf(returned.arguments[0]) !== parameter || nameOf(returned.arguments[1]) !== nameOf(loader.params[0])) fail('catalogue loader must forward its bound descriptor and abort signal unchanged');

  const entryAst = parseRuntimeSource(await readSource(resolve(root, 'site/object-catalog.mts')), 'site/object-catalog.mts');
  const entry = entryAst.body.flatMap(node => node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration' && nameOf(node.declaration.id) === 'catalogEntry' ? [node.declaration] : []);
  const definitions = namedImport(entryAst, './object-schema.mts', 'defineObject');
  if (entry.length !== 1 || definitions.length !== 1 || ![2, 3, 4].includes(entry[0].params.length)) fail('catalogue helper must bind its own actual JSON descriptor');
  const input = kind(entry[0].params[0], 'Identifier').name, loadScene = kind(entry[0].params[1], 'Identifier').name;
  const distance = entry[0].params[2] === undefined ? undefined : kind(entry[0].params[2], 'Identifier').name;
  const discovery = entry[0].params[3] === undefined ? undefined : kind(entry[0].params[3], 'Identifier').name;
  const objectCalls: CallExpression[] = [];
  walkRuntimeAst(entry[0], node => {
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
      if ([input, loadScene].includes(nameOf(target)) || memberPath(target)?.[0] === input) fail('catalogue helper cannot replace the object id, loader or world frame');
    }
    if (node.type === 'CallExpression' && nameOf(node.callee) === definitions[0]) objectCalls.push(node);
  });
  if (objectCalls.length !== 1 || objectCalls[0].arguments.length !== 1) fail('catalogue helper must declare one object');
  const fields = kind(objectCalls[0].arguments[0], 'ObjectExpression');
  const properties = staticObjectProperties(fields);
  if (new Set(properties.map(field => propertyKey(field.key))).size !== properties.length ||
      memberPath(property(fields, 'id')?.value)?.join('.') !== `${input}.id` ||
      memberPath(property(fields, 'worldFrame')?.value)?.join('.') !== `${input}.properties.worldFrame` ||
      nameOf(property(fields, 'loadScene')?.value) !== loadScene ||
      distance !== undefined && nameOf(property(fields, 'distance')?.value) !== distance ||
      discovery !== undefined && nameOf(property(fields, 'discovery')?.value) !== discovery) fail('catalogue helper cannot replace the object id, loader or world frame');
  const result = kind(kind(entry[0].body.body.at(-1), 'ReturnStatement').argument, 'ObjectExpression');
  if (result.properties.length !== 4 || result.properties[0].type !== 'SpreadElement' || result.properties[0].argument !== objectCalls[0] ||
      result.properties[1].type !== 'Property' || result.properties[1].computed || propertyKey(result.properties[1].key) !== 'aliases' ||
      result.properties[2].type !== 'Property' || result.properties[2].computed || propertyKey(result.properties[2].key) !== 'order' ||
      result.properties[3].type !== 'SpreadElement' || result.properties[3].argument.type !== 'ConditionalExpression') fail('catalogue helper must return the declared object unchanged');
  const conditional = result.properties[3].argument;
  if (nameOf(conditional.test) !== 'context' || conditional.consequent.type !== 'ObjectExpression' || conditional.consequent.properties.length !== 1 ||
      nameOf(property(conditional.consequent, 'context')?.value) !== 'context' || conditional.alternate.type !== 'ObjectExpression' || conditional.alternate.properties.length) fail('catalogue helper cannot overwrite its declared object');

  const inventory = parseRuntimeSource(await readSource(resolve(root, descriptorFile)), descriptorFile);
  const imports = new Map<string, string>(), descriptorImports = new Set<string>();
  const declarations: VariableDeclarator[] = [];
  for (const statement of inventory.body) {
    if (statement.type === 'ImportDeclaration') {
      const specifier = statement.specifiers[0];
      if (statement.specifiers.length !== 1 || specifier?.type !== 'ImportDefaultSpecifier' || typeof statement.source.value !== 'string' ||
          !/^\.\.\/src\/objects\/[a-z][a-z0-9-]*\/object\.json$/u.test(statement.source.value) ||
          statement.attributes?.length !== 1 || propertyKey(statement.attributes[0].key) !== 'type' || statement.attributes[0].value.value !== 'json' ||
          imports.has(specifier.local.name) || descriptorImports.has(statement.source.value)) fail('prepared catalogue must contain unique JSON descriptor imports');
      imports.set(specifier.local.name, statement.source.value); descriptorImports.add(statement.source.value);
    } else if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration' && statement.declaration.kind === 'const') declarations.push(...statement.declaration.declarations);
    else fail('prepared catalogue must contain only JSON imports and its descriptor array');
  }
  if (declarations.length !== 1 || nameOf(declarations[0].id) !== 'OBJECT_DESCRIPTORS') fail('prepared catalogue must export one descriptor array');
  const array = kind(declarations[0].init, 'ArrayExpression');
  if (!array.elements.length || array.elements.length !== imports.size || new Set(array.elements.map(nameOf)).size !== imports.size) fail('prepared catalogue must include each descriptor once');
  const entries = new Map<string, RegistryEntry>();
  for (const element of array.elements) {
    const path = imports.get(nameOf(element));
    if (!path) fail('prepared catalogue entries must name their JSON imports');
    const descriptor = relative(root, resolve(root, dirname(descriptorFile), path));
    const value: unknown = JSON.parse(await readSource(resolve(root, descriptor)));
    if (!isRecord(value) || typeof value.id !== 'string' || descriptor !== `src/objects/${value.id}/object.json` || entries.has(value.id)) fail('descriptor identity must match its own actual JSON descriptor');
    entries.set(value.id, {kind: 'descriptor', client: 'site/packaged-object-runtime.mts', descriptor, exported: 'loadPackagedObject'});
  }
  return {entries, importOffsets: new Set([sourceStart(imported)]), descriptorImports, descriptorFile};
}
function memberPath(node: Node | null | undefined): string[] | null {
  if (node?.type !== 'MemberExpression' || node.computed) return null;
  const parent = memberPath(node.object);
  if (parent === null) return node.object?.type === 'Identifier' ? [node.object.name, nameOf(node.property)] : null;
  return [...parent, nameOf(node.property)];
}
function property(object: Node | null | undefined, name: string) { return objectProperty(object, name); }
function runtimeFactorySource(source: string) {
  const ast = parseRuntimeSource(source, 'source.mts'), imports = new Map<string, {name: string; source: string}>();
  for (const statement of ast.body) if (statement.type === 'ImportDeclaration') {
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier') imports.set(specifier.local.name, { name: nameOf(specifier.imported), source: requireString(statement.source.value) });
    }
  }
  const nodes: Node[] = []; walkRuntimeAst(ast, node => nodes.push(node));
  const calls = (name: string) => nodes.filter((node): node is CallExpression => node.type === 'CallExpression' && (imports.get(nameOf(node.callee))?.name ?? nameOf(node.callee)) === name);
  const importsFactory = (name: string, source: string) => [...imports.values()].some(binding => binding.name === name && binding.source === source);
  return { imports, nodes, calls, importsFactory };
}

function requireApplicationWorldContextSource(mountSource: string, resourceSource: string) {
  const mount = runtimeFactorySource(mountSource);
  const { imports, nodes, calls, importsFactory } = runtimeFactorySource(resourceSource);
  function fail(): never { throw new TypeError('Application world context must use the shared prepared-universe inventory and pinned context.'); }
  const context = [...imports].find(([, binding]) => binding.name === 'APPLICATION_WORLD_CONTEXT' && binding.source === './world-context-plan.mts')?.[0];
  const renderer = '../src/renderers/css/dist/universe.js';
  // The mount leases resources; its imported loader owns the pinned prepared inventory.
  if (!mount.importsFactory('loadApplicationUniverse', './application-world-resources.mts') ||
    !mount.importsFactory('prepareObjectResources', renderer) || mount.calls('loadApplicationUniverse').length !== 1 ||
    mount.calls('prepareObjectResources').length !== 1 || calls('prepareObjectResources').length !== 0) fail();
  const required = ['createPreparedUniverse', 'loadPreparedCssVolume', 'loadPreparedPointAppearance', 'loadPreparedCssSurfaceShell'];
  if (!context || !required.every(name => importsFactory(name, renderer) && calls(name).length === 1 && mount.calls(name).length === 0) ||
    !importsFactory('PREPARED_NAVIGATION_MARKERS', './prepared-navigation-markers.mjs')) fail();
  // Bodies share src/objects, so descriptors and asset URLs come from the generated module that globs each context object by name.
  const initializers = nodes.flatMap(node => node.type === 'VariableDeclarator' && node.init?.type === 'Identifier' ? [node.init.name] : []);
  const generated = (name: string) => initializers.some(local => imports.get(local)?.name === name && imports.get(local)?.source === './prepared-context-objects.mts');
  if (!generated('CONTEXT_OBJECT_DESCRIPTORS') || !generated('CONTEXT_OBJECT_ASSET_URLS')) fail();
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
  const volumeCall = calls('loadPreparedCssVolume')[0], starCall = calls('loadPreparedPointAppearance')[0];
  if (volumeCall.arguments.length !== 2 || starCall.arguments.length !== 2 ||
    memberPath(volumeCall.arguments[0])?.join('.') !== `${volumeSet.id.name}.descriptor` ||
    memberPath(volumeCall.arguments[1])?.join('.') !== `${volumeSet.id.name}.transport` ||
    memberPath(starCall.arguments[0])?.join('.') !== `${starSet.id.name}.descriptor` ||
    memberPath(starCall.arguments[1])?.join('.') !== `${starSet.id.name}.transport`) fail();
  const universe = calls('createPreparedUniverse')[0];
  if (universe.arguments.length !== 1 || universe.arguments[0]?.type !== 'ObjectExpression' ||
    !['context', 'volume', 'pointAppearance', 'sprites', 'resolveResource', 'resolvePointResource'].every(name => property(universe.arguments[0], name))) fail();
}

/** The generated module names each context object; each must reach its descriptor and prepared assets, binary banks included. */
function requireContextObjectModuleSource(source: string, contexts: readonly { id: string; type: string }[]) {
  function fail(): never { throw new TypeError('Application world context must use the shared prepared-universe inventory and pinned context.'); }
  const globs = new Map<string, unknown[]>();
  const records = new Map<string, ObjectExpression>();
  for (const statement of parseRuntimeSource(source, "source.mts").body) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.declaration?.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declaration.declarations) {
      const call = astKind(declaration.init, 'CallExpression'), callee = astKind(call?.callee, 'MemberExpression');
      if (callee && nameOf(callee.property) === 'glob' && callee.object.type === 'MetaProperty')
        globs.set(nameOf(declaration.id), astKind(call?.arguments[0], 'ArrayExpression')?.elements.map(element => astKind(element, 'Literal')?.value) ?? []);
      const value = astKind(declaration.init, 'ObjectExpression');
      if (value) records.set(nameOf(declaration.id), value);
    }
  }
  const descriptors = globs.get('CONTEXT_OBJECT_DESCRIPTORS'), preparedJson = globs.get('CONTEXT_OBJECT_PREPARED_JSON');
  const localAssets = globs.get('CONTEXT_OBJECT_ASSET_URLS'), remoteAssets = records.get('CONTEXT_OBJECT_ASSET_URLS');
  if (!descriptors || !preparedJson || !contexts.length || !localAssets && !remoteAssets || localAssets && remoteAssets) fail();
  const exact = (actual: readonly unknown[], expected: readonly string[]) => actual.length === expected.length &&
    new Set(actual).size === actual.length && expected.every(value => actual.includes(value));
  if (!exact(descriptors, contexts.map(({ id }) => `../src/objects/${id}/object.json`)) ||
      !exact(preparedJson, contexts.map(({ id }) => `../src/objects/${id}/prepared/*.json`))) fail();
  if (localAssets) {
    const expected = [...contexts.map(({ id }) => `../src/objects/${id}/prepared/**/*.{json,png,webp,bin}`),
      ...contexts.filter(({ type }) => type === 'point-field').map(({ id }) => `!../src/objects/${id}/prepared/*.bin`)];
    if (!exact(localAssets, expected)) fail();
  } else {
    const ids = new Set(contexts.map(({ id }) => id)), origins = new Set<string>();
    const properties = staticObjectProperties(remoteAssets!);
    if (!properties.length || properties.length !== remoteAssets!.properties.length) fail();
    for (const property of properties) {
      const key = propertyKey(property.key), value = astKind(property.value, 'Literal')?.value;
      if (typeof key !== 'string' || typeof value !== 'string') fail();
      const match = key.match(/^\.\.\/src\/objects\/([a-z][a-z0-9-]*)\/prepared\/(.+)$/u);
      if (!match || !ids.has(match[1]!)) fail();
      let url: URL;
      try { url = new URL(value); } catch { fail(); }
      const remote = url.pathname.match(/^\/runtime-assets\/([a-f0-9]{64})\/(.+)$/u);
      if (url.protocol !== 'https:' || !remote || remote[2] !== match[2]) fail();
      origins.add(url.origin);
    }
    if (origins.size !== 1) fail();
  }
}

function requireContextFrame(value: unknown, objectId: string) {
  function fail(message: string): never { throw new TypeError(`Prepared context frame is invalid: ${message}.`); }
  const vector = (value: unknown): value is number[] => isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const sameVector = (a: readonly number[], b: readonly number[]) => a.every((value, index) => value === b[index]);
  const identity = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
  if (!isRecord(value)) fail('context is not an object');
  const context = value, frame = context.frame, focus = context.focus, camera = context.camera, stars = context.stars;
  // The summary is the main thread's copy: the same bodies and frame, orbits without paths.
  const summary = context.schema === 'cssearth-world-context-summary@1';
  if ((!summary && context.schema !== 'cssearth-world-context@1') || !isRecord(frame) || !isRecord(focus) || !isRecord(camera) || !isRecord(stars) || focus.id !== objectId ||
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
    // A body drawn from its astronomy record may have no measured radius: 0, only when it is unpackaged.
    const sized = isRecord(body) && (positive(body.radiusM) || body.unpackaged === true && body.radiusM === 0);
    if (!isRecord(body) || !identity(body.id) || points.has(body.id) || !vector(body.positionM) || !sized) fail(`body inventory identity or physical point is invalid: ${isRecord(body) ? String(body.id) : 'not a record'}`);
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
    if (summary) {
      if (!parent || parent.id === body.id || !vector(orbit.centerPositionM) || !orbit.centerPositionM.every((value, axis) => value === parent.positionM[axis]) ||
          typeof orbit.vertexCount !== 'number' || !Number.isSafeInteger(orbit.vertexCount) || orbit.vertexCount < 8 || typeof orbit.fullTrail !== 'boolean' ||
          ['verticesM', 'trail', 'activeChords', 'extentChords', 'bodyVertexIndex', 'trailModel'].some(key => orbit[key] !== undefined) ||
          (open ? !positive(orbit.displayExtentAu) : orbit.closed !== undefined || orbit.displayExtentAu !== undefined)) fail('body orbit summary is invalid');
      continue;
    }
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
      properties.frame.epochJdTt !== context.frame.epochJdTt || !isRecord(prepared) || prepared.format !== 'cssearth-css-point-field-bank@1' ||
      typeof prepared.url !== 'string' || !prepared.url.startsWith('prepared/') || prepared.url.split('/').includes('..')) fail('descriptor identity or frame drifted');
  const payloadPath = resolve(directory, prepared.url);
  if (relative(directory, payloadPath).startsWith('../')) fail('prepared payload escapes its object package');
  const {bytes, value: payload} = await readRecord(payloadPath, 'prepared payload cannot be read');
  const data = payload.data;
  if (payload.schema !== 'cssearth-prepared-object@1' || payload.id !== id ||
      payload.type !== 'point-field' || payload.format !== prepared.format || !isRecord(data) || data.schema !== 'cssearth-css-point-field-bank@1' || data.id !== id ||
      JSON.stringify(data.frame) !== JSON.stringify(properties.frame) || !isRecord(data.frame) || data.frame.referenceFrame !== context.frame.referenceFrame ||
      data.frame.epochJdTt !== context.frame.epochJdTt || JSON.stringify(data.frame.originM) !== JSON.stringify(context.frame.originM)) fail('prepared payload identity or physical frame drifted');
}

interface AuditObject { readonly id: string; }
interface AuditOptions {
  root?: string;
  objects?: readonly AuditObject[];
  readText?: RuntimeSourceReader;
  verifyDefinition?: (object: AuditObject, definition: unknown) => void | Promise<void>;
  strict?: boolean;
}

export async function auditObjectRuntimeOwnership({ root = process.cwd(), objects = OBJECTS,
  readText = path => readFile(path, "utf8"), verifyDefinition, strict = true }: AuditOptions = {}) {
  const entries = [], sharedClosure = new Set<string>(), sharedViolations: Violation[] = [], cameraFactorySites: FactorySite[] = [];
  let registry: Awaited<ReturnType<typeof registryLoaders>> = { entries: new Map(), importOffsets: new Set(), descriptorImports: new Set(), descriptorFile: registryPath };
  const sharedEdges = new Map<string, Set<string>>(), sharedFactoryCalls = new Map<string, number>(), sharedVisits = new Map<string, boolean>();
  const cache = new Map<string, Inspection>();
  const verify = verifyDefinition ?? (async (object: AuditObject, input: unknown) => {
    requireObjectRuntimeDefinition(input, { objectId: object.id });
  });
  const sources = new Map<string, string>(), sourceHashes = new Map<string, string>();
  async function source(path: string): Promise<string> {
    if (!sources.has(path)) {
      const text = await readText(path);
      sources.set(path, text);
      sourceHashes.set(path, sha256(text));
    }
    return sources.get(path)!;
  }
  function releaseObjectSources(id: string) {
    const prefix = resolve(root, 'src/objects', id) + '/';
    for (const path of sources.keys()) if (path.startsWith(prefix) && !sharedClosure.has(path)) sources.delete(path);
  }
  async function inspect(path: string, shared: boolean, shellContent = false, serverOnly = false): Promise<Inspection> {
    const key = `${shared}:${shellContent}:${serverOnly}:${path}`;
    if (!cache.has(key)) {
      cache.set(key, inspectObjectRuntimeModule(await source(path), relative(root, path), { shared, shellContent, serverOnly, objectIds: OBJECTS.map(o => o.id),
        registryImportOffsets: path === resolve(root, registryPath) ? registry.importOffsets : new Set(),
        registryDescriptors: path === resolve(root, registry.descriptorFile) ? registry.descriptorImports : new Set() }));
    }
    return cache.get(key)!;
  }
  async function sharedVisit(path: string, shellContent = false, serverOnly = false): Promise<void> {
    // A server visit must never suppress a later client import of the same file.
    if (sharedVisits.get(path) === false || sharedVisits.get(path) === true && serverOnly) return;
    sharedVisits.set(path, serverOnly);
    sharedClosure.add(path);
    const file = relative(root, path);
    if (file === 'site/prepared-object-distances.json' || file === 'site/prepared-focus-objects.json' || file === 'site/prepared-object-discovery.json') {
      const value: unknown = JSON.parse(await source(path));
      if (file.endsWith('distances.json')) Object.values(requireRecord(value)).forEach(parseNavigationDistance);
      else if (file.endsWith('discovery.json')) Object.values(requireRecord(value)).forEach(parseObjectDiscovery);
      else requireArray(value).forEach(definePreparedFocus);
      return;
    }
    if (approvedSharedData.has(file)) {
      const read = async (file: string): Promise<unknown> => {
        try { return JSON.parse(await source(path)); }
        catch { throw new TypeError(`Prepared context frame is invalid: ${file} cannot be read.`); }
      };
      requireContextFrame(await read(file), 'sun');
      return;
    }
    if (file.startsWith("../") || objectPackage(file)) {
      sharedViolations.push({ file, line: 1, reason: "Shared runtime imports an object package" });
      return;
    }
    // Stylesheets are source-bound shell content, not JavaScript ownership.
    if (file.endsWith(".css")) { await source(path); return; }
    const facts = await inspect(path, true, shellContent, serverOnly);
    if (!sharedEdges.has(path)) sharedEdges.set(path, new Set());
    if (file === 'site/world-context-plan.mts') {
      if (worldContextPlanImport(parseRuntimeSource(await source(path), file), file) === null) {
        sharedViolations.push({ file, line: 1, reason: 'Application world context plan must validate its pinned JSON source.' });
      } else {
        // The main thread reads the summary; the planner worker reads the full file.
        for (const file of ['world-context-summary.json', 'world-context.json']) {
          const contextPath = resolve(root, 'src/objects/sun/prepared', file);
          sharedEdges.get(path)!.add(contextPath);
          await sharedVisit(contextPath);
        }
      }
    }
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
      // A Vite asset reference (?url, ?raw, ?inline) delivers bytes, not runtime source, so it closes nothing.
      if (/\?(?:url|raw|inline)$/.test(imported)) continue;
      try {
        const target = await resolveRuntimeSource(imported, path, { root, source, objectIds: objectPackageIds });
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
  try { registry = await registryLoaders(await source(resolve(root, registryPath)), root, source); }
  catch (error) { sharedViolations.push({ file: registryPath, line: 1, reason: errorMessage(error) }); }
  await sharedVisit(resolve(root, registryPath));
  const assemblyRoots = new Set<string>();
  for (const object of objects) {
    const loader = registry.entries.get(object.id);
    if (!loader) continue;
    assemblyRoots.add(loader.client);
  }
  for (const file of assemblyRoots) await sharedVisit(resolve(root, file));
  // Runtime imports are visited first, so a runtime dependency cannot acquire
  // shell-content status by also being imported by a shell component.
  for (const file of shellEntries) await sharedVisit(resolve(root, file), true);
  // Prepared context now belongs to the application, including when the Sun
  // enters through its JSON descriptor instead of a private runtime client.
  const applicationContextPath = resolve(root, 'site/application-world-context.mts');
  if (sharedClosure.has(applicationContextPath)) {
    try {
      requireApplicationWorldContextSource(await source(applicationContextPath), await source(resolve(root, 'site/application-world-resources.mts')));
      requireContextObjectModuleSource(await source(resolve(root, 'site/prepared-context-objects.mts')), await readContextObjects(resolve(root, 'src/objects')));
      const context = requireContextFrame(JSON.parse(await source(resolve(root, 'src/objects/sun/prepared/world-context.json'))), 'sun');
      await requireContextPointField(root, context, source);
    } catch (error) { sharedViolations.push({ file: 'site/application-world-context.mts', line: 1, reason: errorMessage(error) }); }
  }
  const contextualBindingPath = resolve(root, 'site/packaged-object-runtime.mts');
  if (sharedClosure.has(contextualBindingPath)) {
    try { requireDescriptorAdapterSource(await source(contextualBindingPath), 'loadPackagedObject'); }
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
    {
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

/**
 * `--receipts`: every registered object's physical frame receipt (`prepared/world-navigation.json` against its
 * descriptor frame) and its recipe sources against the manifest.
 * The source half reads tracked files only, so it runs in any checkout. The receipt itself is baked and restored
 * from R2, so an object whose `prepared/world-navigation.json` is absent is counted as unproven rather than failed;
 * a receipt that IS present and disagrees with its descriptor still fails. Every failure is reported together.
 */
export async function auditPhysicalFrameReceipts({ root = process.cwd(), objects = OBJECTS,
  readText = (path: string) => readFile(path, "utf8") }:
  { root?: string; objects?: readonly AuditObject[]; readText?: RuntimeSourceReader } = {}): Promise<{ receipts: number; unrestored: number; failures: string[] }> {
  const failures: string[] = [];
  let receipts = 0, unrestored = 0;
  for (const object of objects) {
    const directory = resolve(root, "src/objects", object.id);
    const receiptPath = resolve(directory, "prepared/world-navigation.json");
    try {
      const descriptor = requireRecord(JSON.parse(await readText(resolve(directory, "object.json"))), `${object.id} descriptor`);
      if (await requireAuthoredSourcePins({ objectId: object.id, descriptor, root, source: readText, closure: new Set() })) {
        try {
          await requireAuthoredWorldFrameReceipt({ descriptor, directory, readText });
          receipts++;
        } catch (error) {
          // Only an absent receipt is unproven. Anything else, including a receipt that contradicts its
          // descriptor, is a failure.
          if (!isMissingFile(error, receiptPath)) throw error;
          unrestored++;
        }
      }
    } catch (error) { failures.push(`${object.id}: ${errorMessage(error)}`); }
  }
  return { receipts, unrestored, failures };
}

/** True when `error` is this exact file being absent: the receipt is restored from R2, not tracked. */
function isMissingFile(error: unknown, path: string): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT" &&
    "path" in error && typeof error.path === "string" && resolve(error.path) === path;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href && process.argv.includes("--receipts")) {
  if (process.argv.length !== 3) throw new Error("--receipts checks every registered object and takes no other option.");
  const { receipts, unrestored, failures } = await auditPhysicalFrameReceipts();
  for (const failure of failures) console.error(failure);
  if (failures.length) process.exitCode = 1;
  else console.log(`${OBJECTS.length} registered objects: recipe sources are current; ${receipts} physical frame receipt(s) checked, ` +
    `${unrestored} not restored here (node tools/assets/setup.mts --location=prepared).`);
} else if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  // One or more `--object <id>` pairs scope the audit to those objects; each occurrence is collected, not just
  // the first, so a PR-scoped run (tools/ci/scope-runtime-ownership-check.mts) can name every object it touched.
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === "--object") { const id = args[i + 1]; if (id) { ids.push(id); i++; } }
  for (const id of ids) if (!OBJECTS.some(object => object.id === id)) throw new Error(`Unknown registered object: ${id}`);
  if (!args.includes("--inventory") && !args.includes("--all") && !ids.length) throw new Error("Use --inventory, --object ID, --all, or --receipts.");
  const report = await auditObjectRuntimeOwnership({ objects: ids.length ? OBJECTS.filter(object => ids.includes(object.id)) : OBJECTS,
    strict: !args.includes("--inventory") });
  console.log(JSON.stringify(report, null, 2));
}
