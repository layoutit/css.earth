import { sha256 } from '@cssearth/core/node';
import { isArray } from '../../src/platform/is-array.mts';
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import type { Node } from 'estree';
import { SCENE_OBJECTS } from "../../site/objects.mts";
import type { ObjectEntry } from '../../site/object-schema.mts';
import { requirePreparedPresentation, PREPARED_OBJECT_RUNTIME_SCHEMA } from "../../src/platform/prepared-presentation-contract.mts";
import { requireObjectRuntimeDefinition } from "../contract/object-runtime-contract.mts";
import { requireAuthoredWorldFrame } from '../sources/authored-world-frame.mts';
import { PREPARED_CSS_OBJECT_FORMAT } from '../../src/renderers/css/dist/index.js';
import { requireObjectControls } from '../../site/scene/scene-contract.mts';
import { hasErrorCode, isRecord, requireRecord, requireArray } from '@cssearth/core';
import { nodeName, sourceStart, sourceEnd, staticObjectProperties } from '../ci/runtime-ast.mts';
import type { RuntimeSourceReader } from '../ci/runtime-source-graph.mts';

export interface PreparedJsonExport { name: string; value: unknown; }
export function readPreparedJsonModule(source: string, expectedExport?: string): PreparedJsonExport {
  const match = source.match(/^\s*(?:\/\/[^\n]*\n\s*)*export const ([A-Z][A-Z0-9_]*)\s*=\s*([\s\S]*);\s*$/);
  if (!match || expectedExport && match[1] !== expectedExport) throw new TypeError("Prepared module must export one serialized JSON record.");
  const expression = match[2];
  return { name: match[1], value: JSON.parse(expression.startsWith("Object.freeze(") && expression.endsWith(")") ? expression.slice(14, -1) : expression) };
}
export function readPreparedJsonExports(source: string): PreparedJsonExport[] {
  try { return [readPreparedJsonModule(source)]; } catch { /* Multiple literal exports are also data. */ }
  const ast = parseAst(source), exports: PreparedJsonExport[] = [];
  for (const statement of ast.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration" || statement.declaration.kind !== "const") throw new TypeError("Prepared modules cannot contain executable statements.");
    for (const declaration of statement.declaration.declarations) {
      if (declaration.id.type !== "Identifier" || !/^[A-Z][A-Z0-9_]*$/.test(declaration.id.name) || !declaration.init) throw new TypeError("Prepared module export is not a data binding.");
      const expression = source.slice(sourceStart(declaration.init), sourceEnd(declaration.init));
      exports.push(readPreparedJsonModule(`export const ${declaration.id.name} = ${expression};`));
    }
  }
  if (!exports.length) throw new TypeError("Prepared module has no data exports.");
  return exports;
}
export function readPreparedPresentationModule(source: string): unknown {
  return readPreparedJsonModule(source, "PREPARED_PRESENTATION").value;
}
export function requirePreparedDefinitionSource(source: string): string {
  const ast = parseAst(source);
  const imports = ast.body.filter(node => node.type === "ImportDeclaration");
  if (imports.length !== 3 || imports.some(node => node.specifiers.length !== 1 ||
      node.specifiers[0].type !== "ImportSpecifier" || node.attributes?.length)) {
    throw new TypeError("Prepared definition requires its three named data bindings only.");
  }
  const bindings = new Map<string, {name: string | undefined; path: string | number | boolean | bigint | RegExp | null | undefined}>();
  for (const node of imports) for (const specifier of node.specifiers) if (specifier.type === 'ImportSpecifier') bindings.set(specifier.local.name, {name: nodeName(specifier.imported), path: node.source.value});
  const declared = ast.body.filter(node => node.type === "ExportNamedDeclaration");
  if (ast.body.length !== imports.length + 1 || declared.length !== 1) throw new TypeError("Prepared definition must contain static imports and one data export.");
  const declaration = declared[0].declaration;
  if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== "const" || declaration.declarations.length !== 1 || nodeName(declaration.declarations[0].id) !== "runtimeDefinition") throw new TypeError("Prepared runtime definition export is missing.");
  const call = declaration.declarations[0].init;
  if (call?.type !== "CallExpression" || call.optional || call.callee.type !== 'MemberExpression' || call.callee.computed || nodeName(call.callee.object) !== "Object" || nodeName(call.callee.property) !== "freeze" || call.arguments.length !== 1 || bindings.has("Object")) throw new TypeError("Prepared definition must freeze its data binding.");
  const object = call.arguments[0];
  if (object?.type !== "ObjectExpression" || object.properties.length !== 4 || object.properties[0]?.type !== "SpreadElement" ||
      bindings.get(nodeName(object.properties[0].argument) ?? '')?.name !== "PREPARED_PRESENTATION" || bindings.get(nodeName(object.properties[0].argument) ?? '')?.path !== "./preparedPresentation.mjs") throw new TypeError("Prepared definition must bind its prepared presentation data.");
  const properties = staticObjectProperties({...object, properties: object.properties.slice(1)});
  const values = new Map(properties.map(property => [nodeName(property.key), property.value]));
  const id = values.get('id');
  if (values.size !== 3 || !["schema", "id", "controls"].every(key => values.has(key)) ||
      bindings.get(nodeName(values.get("schema")) ?? '')?.name !== "PREPARED_OBJECT_RUNTIME_SCHEMA" ||
      bindings.get(nodeName(values.get("schema")) ?? '')?.path !== "../../../platform/prepared-schema.mts" ||
      bindings.get(nodeName(values.get("controls")) ?? '')?.name !== "objectControls" ||
      bindings.get(nodeName(values.get("controls")) ?? '')?.path !== "../site/control-content.mjs" ||
      id?.type !== "Literal" || typeof id.value !== "string" || imports.length !== 3) {
    throw new TypeError("Prepared definition contains unsupported execution or bindings.");
  }
  return id.value;
}

// Content modules may project prepared labels into shell content. They cannot
// install behavior, call arbitrary helpers, or hide side effects in a callback.
export function requirePreparedControlSource(source: string): string[] {
  const ast = parseAst(source), bindings = new Set(["undefined"]), imports: string[] = [];
  const fail = (): never => { throw new TypeError("Object controls must only project static prepared content."); };
  function expression(node: Node | null | undefined, scope = bindings): void {
    if (!node) return fail();
    switch (node.type) {
      case "Literal": if ('regex' in node && node.regex || 'bigint' in node && node.bigint) fail(); return;
      case "Identifier": if (!scope.has(node.name)) fail(); return;
      case "MemberExpression": expression(node.object, scope); if (node.computed) expression(node.property, scope); return;
      case "ObjectExpression": for (const property of node.properties) {
        if (property.type !== "Property" || property.kind !== "init" || property.method || property.computed) return fail();
        expression(property.value, scope);
      } return;
      case "ArrayExpression": node.elements.forEach(value => expression(value, scope)); return;
      case "TemplateLiteral": node.expressions.forEach(value => expression(value, scope)); return;
      case "ConditionalExpression": for (const child of [node.test, node.consequent, node.alternate]) expression(child, scope); return;
      case "BinaryExpression": case "LogicalExpression": expression(node.left, scope); expression(node.right, scope); return;
      case "UnaryExpression": if (!["!", "-", "+"].includes(node.operator)) fail(); expression(node.argument, scope); return;
      case "CallExpression": {
        const callee = node.callee;
        if (node.optional || callee.type !== 'MemberExpression' || callee.computed || node.arguments.length !== 1) return fail();
        if (nodeName(callee.object) === "Object" && nodeName(callee.property) === "freeze" && !bindings.has("Object")) return expression(node.arguments[0], scope);
        if (nodeName(callee.property) !== "map") return fail();
        expression(callee.object, scope);
        const callback = node.arguments[0];
        if (callback.type !== "ArrowFunctionExpression" || callback.async || !callback.expression || callback.params.length !== 1 || callback.params[0].type !== "Identifier") return fail();
        expression(callback.body, new Set([...scope, callback.params[0].name])); return;
      }
      default: fail();
    }
  }
  let exports = 0;
  for (const statement of ast.body) {
    if (statement.type === "ImportDeclaration") {
      const path = statement.source.value;
      if (!statement.specifiers.length || typeof path !== 'string' || !path.startsWith(".") || !path.endsWith(".mjs") || statement.attributes?.length) return fail();
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier" || !/^PREPARED_[A-Z0-9_]+$/.test(nodeName(specifier.imported) ?? '')) return fail();
        bindings.add(specifier.local.name);
      }
      imports.push(path); continue;
    }
    const exported = statement.type === "ExportNamedDeclaration";
    const declaration = exported ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") return fail();
    for (const variable of declaration.declarations) {
      if (variable.id.type !== "Identifier" || exported && variable.id.name !== "objectControls") return fail();
      expression(variable.init); bindings.add(variable.id.name);
      if (exported) exports++;
    }
  }
  if (exports !== 1) fail();
  return imports;
}

async function readAuthoredRuntime({ root, objectId, descriptor, readText }: {root: string; objectId: string; descriptor: Record<string, unknown>; readText: RuntimeSourceReader}) {
  const recipe = requireRecord(requireRecord(descriptor.properties).recipe, 'Authored recipe');
  const reference = requireRecord(descriptor.prepared, 'Prepared reference');
  if (!recipe || typeof recipe !== 'object' || recipe.schema !== 'cssearth-authored-object@1' || !isArray(recipe.sources) ||
      !reference || reference.format !== PREPARED_CSS_OBJECT_FORMAT || (typeof reference.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(reference.sha256)) || typeof reference.url !== 'string') {
    throw new TypeError('Authored descriptor identity or source references are invalid.');
  }
  const directory = resolve(root, `src/objects/${objectId}`);
  const manifest = requireRecord(JSON.parse(await readText(resolve(directory, 'source/manifest.json'))), 'Source manifest');
  const records = ['inputs', 'documents', 'generatedIntermediates'].flatMap(key => requireArray(manifest[key] ?? [], key).map(value => requireRecord(value, key)));
  for (const value of requireArray(recipe.sources)) {
    const source = requireRecord(value, 'Authored source');
    if (!source || typeof source.path !== 'string') throw new TypeError('Authored source reference is invalid.');
    const path = resolve(directory, source.path);
    if (relative(directory, path).startsWith('../')) throw new TypeError('Authored source escapes its object package.');
    const record = records.find(entry => `source/${String(entry.path)}` === source.path);
    if (!record) throw new TypeError(`Authored source is not declared in the manifest: ${source.path}.`);
  }
  const preparedDirectory = resolve(directory, 'prepared');
  const payloadPath = resolve(directory, reference.url);
  if (reference.url !== 'prepared/object.json' || payloadPath !== resolve(preparedDirectory, 'object.json')) {
    throw new TypeError('Prepared JSON transport must remain inside its owning object prepared directory.');
  }
  const payloadBytes = await readText(payloadPath);
  if (sha256(payloadBytes) !== reference.sha256) throw new TypeError('Prepared JSON transport SHA-256 does not match its descriptor.');
  const payload = requireRecord(JSON.parse(payloadBytes), 'Prepared JSON payload');
  const runtimePath = resolve(preparedDirectory, 'runtime.json');
  const runtime = requireObjectRuntimeDefinition(JSON.parse(await readText(runtimePath)), { objectId });
  const scene: unknown = JSON.parse(await readText(resolve(preparedDirectory, 'scene.json')));
  if (payload.id !== objectId || !isDeepStrictEqual(payload.data, runtime)) throw new TypeError('Prepared JSON bytes differ from the checked authored runtime.');
  await requireAuthoredWorldFrame({ descriptor, scene, runtime, directory, readText });
  requireObjectRuntimeDefinition(runtime, { objectId });
  return { runtime, payloadPath, runtimePath };
}

export interface PreparedPresentationAuditOptions {
  root?: string;
  objects?: readonly Pick<ObjectEntry, 'id'>[];
  strict?: boolean;
  readText?: RuntimeSourceReader;
  readControls?: (path: string) => Promise<unknown>;
}
export async function auditPreparedPresentations({ root = process.cwd(), objects = SCENE_OBJECTS, strict = true,
  readText = path => readFile(path, "utf8"), readControls = async path => (await import(pathToFileURL(path).href)).objectControls } : PreparedPresentationAuditOptions = {}) {
  const entries = [];
  for (const object of objects) {
    try {
      const prefix = resolve(root, `src/objects/${object.id}`);
      const descriptorPath = `${prefix}/object.json`;
      let descriptor = null;
      try { descriptor = requireRecord(JSON.parse(await readText(descriptorPath)), 'Object descriptor'); }
      catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
      if (descriptor && isRecord(descriptor.properties) && isRecord(descriptor.properties.recipe) && descriptor.properties.recipe.schema === 'cssearth-authored-object@1') {
        const prepared = await readAuthoredRuntime({ root, objectId: object.id, descriptor, readText });
        const definition = prepared.runtime;
        requireObjectRuntimeDefinition(definition, { objectId: object.id });
        entries.push({ id: object.id, complete: true, evidence: 'validated-authored-json', observedOwners: null,
          source: { runtimeSha256: sha256(await readText(prepared.payloadPath)), authoredRuntimeSha256: sha256(await readText(prepared.runtimePath)) },
          nodes: definition.tree.nodes.length, roots: definition.tree.nodes.filter(node => node.parent === -1).length,
          variants: definition.variants.length,
          controls: { lenses: definition.controls.lenses?.controls.map(lens => lens.id) ?? [],
            settings: definition.controls.settings?.controls.map(({ name, kind }) => ({ name, kind })) ?? [] },
          materialTracks: definition.materials.map(track => ({ id: track.id, frame: track.frame,
            phaseFrames: track.frame.indices.length, rotation: track.rotation?.kind ?? null, banks: track.banks.length })),
          resources: definition.assets.entries.length, pools: definition.assets.pools,
          cameraNodes: definition.tree.nodes.filter(node => /(?:^|\s)polycss-camera(?:\s|$)/.test(node.className ?? "")).length,
          sceneNodes: definition.tree.nodes.filter(node => /(?:^|\s)polycss-scene(?:\s|$)/.test(node.className ?? "")).length,
          camera: definition.camera,
          viewBindings: definition.viewBindings, animations: definition.animations.map(({ id, mode, target }) => ({ id, mode, target })),
          destinations: definition.destinations ? { defaultLens: definition.destinations.defaultLens, catalog: definition.destinations.catalog } : null,
          features: definition.features ? { target: definition.features.target, lensIds: definition.features.lensIds, catalog: definition.features.catalog } : null });
        continue;
      }
      const definitionSource = await readText(`${prefix}/runtime/definition.mjs`);
      const id = requirePreparedDefinitionSource(definitionSource);
      if (id !== object.id) throw new TypeError("Prepared definition names another object.");
      const presentationSource = await readText(`${prefix}/runtime/preparedPresentation.mjs`);
      const planInput = readPreparedPresentationModule(presentationSource);
      const controlSource = await readText(`${prefix}/site/control-content.mjs`);
      requirePreparedControlSource(controlSource);
      const objectControls = requireObjectControls(await readControls(`${prefix}/site/control-content.mjs`));
      const plan = requirePreparedPresentation(planInput, { controls: objectControls });
      requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id, controls: objectControls });

      entries.push({ id, complete: true, evidence: "validated-source-data", observedOwners: null,
        source: { definitionSha256: sha256(definitionSource), presentationSha256: sha256(presentationSource), controlsSha256: sha256(controlSource) },
        nodes: plan.tree.nodes.length, roots: plan.tree.nodes.filter(node => node.parent === -1).length,
        variants: plan.variants.length,
        controls: { lenses: objectControls.lenses?.controls.map(lens => lens.id) ?? [],
          settings: objectControls.settings?.controls.map(({ name, kind }) => ({ name, kind })) ?? [] },
        materialTracks: plan.materials.map(track => ({ id: track.id, frame: track.frame,
          phaseFrames: track.frame.indices.length, rotation: track.rotation?.kind ?? null, banks: track.banks.length })),
        resources: plan.assets.entries.length, pools: plan.assets.pools,
        cameraNodes: plan.tree.nodes.filter(node => /(?:^|\s)polycss-camera(?:\s|$)/.test(node.className ?? "")).length,
        sceneNodes: plan.tree.nodes.filter(node => /(?:^|\s)polycss-scene(?:\s|$)/.test(node.className ?? "")).length,
        camera: plan.camera,
        viewBindings: plan.viewBindings, animations: plan.animations.map(({ id, mode, target }) => ({ id, mode, target })),
        destinations: plan.destinations ? { defaultLens: plan.destinations.defaultLens, catalog: plan.destinations.catalog } : null });
    } catch (error) { entries.push({ id: object.id, complete: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  const report = { schema: "cssearth-prepared-presentation-audit@1", complete: entries.every(entry => entry.complete), entries };
  if (strict && !report.complete) throw new TypeError(entries.filter(entry => !entry.complete).map(entry => `${entry.id}: ${entry.error}`).join("\n"));
  return report;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2), index = args.indexOf("--object"), id = index < 0 ? null : args[index + 1];
  if (id && !SCENE_OBJECTS.some(object => object.id === id)) throw new Error(`Unknown registered object: ${id}`);
  if (!id && !args.includes("--all") && !args.includes("--inventory")) throw new Error("Use --object ID, --all, or --inventory.");
  const report = await auditPreparedPresentations({ objects: id ? SCENE_OBJECTS.filter(object => object.id === id) : SCENE_OBJECTS, strict: !args.includes("--inventory") });
  console.log(JSON.stringify(report, null, 2));
}
