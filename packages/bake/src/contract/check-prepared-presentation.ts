import { type ObjectEntry, OBJECT_RUNTIME_SCHEMA, PREPARED_CSS_OBJECT_FORMAT } from '@cssearth/objects';

import { isArray, hasErrorCode, isRecord, requireRecord, requireArray } from '@cssearth/core';
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "vite";
import type { Node } from 'estree';

import { requirePreparedPresentation} from "../presentation/index.ts";

import { requireObjectRuntimeDefinition } from "./object-runtime-contract.ts";
import { requireAuthoredWorldFrame } from '../sources/index.ts';

import { requireObjectControls } from '@cssearth/renderer/runtime/shell-contract.ts';
import { nodeName, staticObjectProperties } from '../runtime-source/index.ts';
import type { RuntimeSourceReader } from '../runtime-source/index.ts';
import { readPreparedObjects } from "@cssearth/objects/node";

/** The scene objects, read from the registry of this checkout (found through this package's own name) on first use rather than
 * when the entry is imported. */
let sceneObjects: readonly ObjectEntry[] | undefined;
export const preparedPresentationSceneObjects = () => sceneObjects ??=
  readPreparedObjects(resolve(dirname(createRequire(import.meta.url).resolve("@cssearth/bake/package.json")), "../..")).sceneObjects;

export interface PreparedJsonExport { name: string; value: unknown; }
export function readPreparedJsonModule(source: string, expectedExport?: string): PreparedJsonExport {
  const match = source.match(/^\s*(?:\/\/[^\n]*\n\s*)*export const ([A-Z][A-Z0-9_]*)\s*=\s*([\s\S]*);\s*$/);
  if (!match || expectedExport && match[1] !== expectedExport) throw new TypeError("Prepared module must export one serialized JSON record.");
  const expression = match[2];
  return { name: match[1], value: JSON.parse(expression.startsWith("Object.freeze(") && expression.endsWith(")") ? expression.slice(14, -1) : expression) };
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
      bindings.get(nodeName(values.get("schema")) ?? '')?.name !== "OBJECT_RUNTIME_SCHEMA" ||
      bindings.get(nodeName(values.get("schema")) ?? '')?.path !== "../../../../packages/bake/src/presentation/prepared-schema.ts" ||
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
  if (!recipe || typeof recipe !== 'object' || recipe.schema !== 'cssearth-authored-object@2' || !isArray(recipe.sources) ||
      !reference || reference.format !== PREPARED_CSS_OBJECT_FORMAT || typeof reference.url !== 'string') {
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
  // The transport is the runtime in its envelope, built when served (prepared-transport.ts): the runtime is what is checked.
  if (reference.url !== 'prepared/object.json') throw new TypeError('Prepared JSON transport must remain inside its owning object prepared directory.');
  const runtimePath = resolve(preparedDirectory, 'runtime.json'), payloadPath = runtimePath;
  const runtime = requireObjectRuntimeDefinition(JSON.parse(await readText(runtimePath)), { objectId });
  const scene: unknown = JSON.parse(await readText(resolve(preparedDirectory, 'scene.json')));
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
// Leaf box records are per-leaf data (1.35 M across the catalogue); the report counts them.
const reportedBindings = (bindings: readonly object[]) => bindings.map(binding =>
  "boxes" in binding && Array.isArray(binding.boxes) ? { ...binding, boxes: binding.boxes.length } : binding);
export async function auditPreparedPresentations({ root = process.cwd(), objects = preparedPresentationSceneObjects(), strict = true,
  readText = path => readFile(path, "utf8"), readControls = async path => (await import(pathToFileURL(path).href)).objectControls } : PreparedPresentationAuditOptions = {}) {
  const entries = [];
  for (const object of objects) {
    try {
      const prefix = resolve(root, `src/objects/${object.id}`);
      const descriptorPath = `${prefix}/object.json`;
      let descriptor = null;
      try { descriptor = requireRecord(JSON.parse(await readText(descriptorPath)), 'Object descriptor'); }
      catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
      if (descriptor && isRecord(descriptor.properties) && isRecord(descriptor.properties.recipe) && descriptor.properties.recipe.schema === 'cssearth-authored-object@2') {
        const prepared = await readAuthoredRuntime({ root, objectId: object.id, descriptor, readText });
        const definition = prepared.runtime;
        requireObjectRuntimeDefinition(definition, { objectId: object.id });
        entries.push({ id: object.id, complete: true, evidence: 'validated-authored-json', observedOwners: null,
          source: { runtime: relative(root, prepared.payloadPath), authoredRuntime: relative(root, prepared.runtimePath) },
          nodes: definition.tree.nodes.length, roots: definition.tree.nodes.filter(node => node.parent === -1).length,
          variants: definition.variants.length,
          controls: { datasets: definition.controls.datasets?.controls.map(dataset => dataset.id) ?? [],
            settings: definition.controls.settings?.controls.map(({ name, kind }) => ({ name, kind })) ?? [] },
          materialTracks: definition.materials.map(track => ({ id: track.id, frame: track.frame,
            phaseFrames: track.frame.indices.length, rotation: track.rotation?.kind ?? null, banks: track.banks.length })),
          resources: definition.assets.entries.length, pools: definition.assets.pools,
          cameraNodes: definition.tree.nodes.filter(node => /(?:^|\s)polycss-camera(?:\s|$)/.test(node.className ?? "")).length,
          sceneNodes: definition.tree.nodes.filter(node => /(?:^|\s)polycss-scene(?:\s|$)/.test(node.className ?? "")).length,
          camera: definition.camera,
          viewBindings: reportedBindings(definition.viewBindings), animations: definition.animations.map(({ id, mode, target }) => ({ id, mode, target })),
          destinations: definition.destinations ? { defaultDataset: definition.destinations.defaultDataset, catalog: definition.destinations.catalog } : null,
          features: definition.features ? { target: definition.features.target, datasetIds: definition.features.datasetIds, catalog: definition.features.catalog } : null });
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
      requireObjectRuntimeDefinition({ ...plan, schema: OBJECT_RUNTIME_SCHEMA, id, controls: objectControls });

      entries.push({ id, complete: true, evidence: "validated-source-data", observedOwners: null,
        source: { definition: relative(root, `${prefix}/runtime/definition.mjs`), presentation: relative(root, `${prefix}/runtime/preparedPresentation.mjs`),
          controls: relative(root, `${prefix}/site/control-content.mjs`) },
        nodes: plan.tree.nodes.length, roots: plan.tree.nodes.filter(node => node.parent === -1).length,
        variants: plan.variants.length,
        controls: { datasets: objectControls.datasets?.controls.map(dataset => dataset.id) ?? [],
          settings: objectControls.settings?.controls.map(({ name, kind }) => ({ name, kind })) ?? [] },
        materialTracks: plan.materials.map(track => ({ id: track.id, frame: track.frame,
          phaseFrames: track.frame.indices.length, rotation: track.rotation?.kind ?? null, banks: track.banks.length })),
        resources: plan.assets.entries.length, pools: plan.assets.pools,
        cameraNodes: plan.tree.nodes.filter(node => /(?:^|\s)polycss-camera(?:\s|$)/.test(node.className ?? "")).length,
        sceneNodes: plan.tree.nodes.filter(node => /(?:^|\s)polycss-scene(?:\s|$)/.test(node.className ?? "")).length,
        camera: plan.camera,
        viewBindings: reportedBindings(plan.viewBindings), animations: plan.animations.map(({ id, mode, target }) => ({ id, mode, target })),
        destinations: plan.destinations ? { defaultDataset: plan.destinations.defaultDataset, catalog: plan.destinations.catalog } : null });
    } catch (error) { entries.push({ id: object.id, complete: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  const report = { schema: "cssearth-prepared-presentation-audit@1", complete: entries.every(entry => entry.complete), entries };
  if (strict && !report.complete) throw new TypeError(entries.filter(entry => !entry.complete).map(entry => `${entry.id}: ${entry.error}`).join("\n"));
  return report;
}
