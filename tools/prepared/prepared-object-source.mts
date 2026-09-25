import { isArray, isRecord, requireRecord, requireArray, requireString } from '@cssearth/core';
import { isDeepStrictEqual } from 'node:util';
import { dirname, relative, resolve } from 'node:path';
import type { Node, FunctionDeclaration } from 'estree';
import { parseRuntimeSource } from '../ci/runtime-source-graph.mts';
import type { RuntimeSourceReader } from '../ci/runtime-source-graph.mts';
import { nodeName, propertyKey, staticObjectProperties } from '../ci/runtime-ast.mts';
import { requirePreparedControlSource, requirePreparedDefinitionSource, readPreparedJsonExports, readPreparedPresentationModule } from './check-prepared-presentation.mts';
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from '../../src/platform/prepared-schema.mts';
import { requireObjectRuntimeDefinition } from '../contract/object-runtime-contract.mts';
import { requireAuthoredWorldFrame } from '../sources/authored-world-frame.mts';
import { PREPARED_CSS_OBJECT_FORMAT } from '../../src/renderers/css/dist/index.js';

export function requireDescriptorAdapterSource(text: string, exported: string): string {
  const ast = parseRuntimeSource(text, 'site/packaged-object-runtime.mts');
  const bindings = new Map<string, { name: string; source: string }>(), functions = new Map<string, FunctionDeclaration>();
  function fail(): never { throw new TypeError('Registered descriptor loader must forward its prepared transport into the actual shared factory.'); }
  function kind<K extends Node['type']>(node: Node | null | undefined, type: K): Extract<Node, {type: K}> {
    if (node?.type !== type) fail();
    return node as Extract<Node, {type: K}>;
  }
  const named = (node: Node | null | undefined) => nodeName(node) ?? '';
  function call(node: Node | null | undefined, name: string, count: number) {
    const value = kind(node, 'CallExpression');
    if (named(value.callee) !== name || value.arguments.length !== count) fail();
    return value;
  }
  for (const statement of ast.body) {
    if (statement.type === 'ImportDeclaration') for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier' && typeof statement.source.value === 'string') bindings.set(specifier.local.name, { name: named(specifier.imported), source: statement.source.value });
    }
    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration' && statement.declaration.id) functions.set(statement.declaration.id.name, statement.declaration);
    if (statement.type === 'FunctionDeclaration' && statement.id) functions.set(statement.id.name, statement);
  }
  const loader = functions.get(exported);
  if (!loader || loader.params.length !== 2 || loader.params.some(param => param.type !== 'Identifier')) fail();
  // The authored TypeScript adapter validates unknown descriptors once before
  // binding the same immutable descriptor to transport and world navigation.
  let descriptorInput = named(loader.params[0]);
  const statements = loader.body.body;
  let returnIndex = 0;
  if (statements.length === 2) {
    const declaration = kind(statements[0], 'VariableDeclaration');
    if (declaration.kind !== 'const' || declaration.declarations.length !== 1) fail();
    const variable = declaration.declarations[0];
    const parsed = call(variable.init, 'parseObjectDescriptor', 1);
    if (variable.id.type !== 'Identifier' || named(parsed.arguments[0]) !== descriptorInput || bindings.get('parseObjectDescriptor')?.source !== '@cssearth/objects') fail();
    descriptorInput = variable.id.name;
    returnIndex = 1;
  } else if (statements.length !== 1) fail();
  const returned = kind(kind(statements[returnIndex], 'ReturnStatement').argument, 'CallExpression');
  if (returned.arguments.length !== 4 || bindings.get(named(returned.callee))?.name !== 'loadNavigableObject' || named(returned.arguments[0]) !== descriptorInput || named(returned.arguments[3]) !== named(loader.params[1])) fail();
  const transportObject = kind(returned.arguments[1], 'ObjectExpression');
  // Loading validates the required world frame and supplies it to the sole native binding.
  if (named(returned.arguments[2]) !== 'bindPackagedObject') fail();
  const bind = functions.get('bindPackagedObject');
  if (!bind || bind.params.length !== 2 || bind.params.some(param => param.type !== 'Identifier') || bind.body.body.length !== 2) fail();
  const declaration = kind(bind.body.body[0], 'VariableDeclaration');
  if (declaration.kind !== 'const' || declaration.declarations.length !== 1) fail();
  const mount = declaration.declarations[0];
  if (mount.id.type !== 'Identifier') fail();
  const factory = call(mount.init, 'createWorldContextObjectRuntime', 1);
  const fields = new Map(staticObjectProperties(kind(factory.arguments[0], 'ObjectExpression')).map(property => [propertyKey(property.key), property.value]));
  if (fields.size !== 3 || named(fields.get('definition')) !== named(bind.params[0]) || named(fields.get('frame')) !== named(bind.params[1])) fail();
  const context = bindings.get(named(fields.get('context')));
  if (context?.source !== './world-camera.mts' || context.name !== 'APPLICATION_WORLD_CAMERA') fail();
  const bound = kind(kind(bind.body.body[1], 'ReturnStatement').argument, 'ArrowFunctionExpression');
  if (bound.params.length !== 2 || bound.params.some(param => param.type !== 'Identifier')) fail();
  const mounted = call(bound.body, mount.id.name, 2);
  if (named(mounted.arguments[0]) !== named(bound.params[0]) || mounted.arguments[1].type !== 'ObjectExpression') fail();
  const options = mounted.arguments[1].properties;
  if (options[0]?.type !== 'SpreadElement' || named(options[0].argument) !== named(bound.params[1])) fail();
  const rendererBinding = bindings.get('createWorldContextObjectRuntime');
  if (!rendererBinding || rendererBinding.name !== 'createWorldContextObjectRuntime' || bindings.get('loadNavigableObject')?.source !== rendererBinding.source) fail();
  // The transport carries only the prepared read.
  const transport = transportObject.properties;
  if (transport.some(property => property.type !== 'Property' || property.computed || property.kind !== 'init' ||
      String(propertyKey(property.key)) !== 'read')) fail();
  const readProperty = transport.find(property => property.type === 'Property' && propertyKey(property.key) === 'read');
  if (!readProperty || readProperty.type !== 'Property' || !readProperty.method) fail();
  const method = kind(readProperty.value, 'FunctionExpression');
  if (!method.async || method.params.length !== 2 || method.params.some(param => param.type !== 'Identifier')) fail();
  const reference = named(method.params[0]), signal = named(method.params[1]), nodes: Node[] = [];
  const walk = (node: Node) => { nodes.push(node); for (const value of Object.values(node as unknown as Record<string, unknown>)) if (isArray(value)) value.forEach(child => { if (isRecord(child) && typeof child.type === 'string') walk(child as unknown as Node); }); else if (isRecord(value) && typeof value.type === 'string') walk(value as unknown as Node); };
  walk(method.body);
  const memberIs = (node: Node | null | undefined, parts: readonly string[]): boolean => {
    if (node?.type === 'ChainExpression') return memberIs(node.expression, parts);
    if (parts.length === 1) return node?.type === 'Identifier' && node.name === parts[0];
    return node?.type === 'MemberExpression' && !node.computed && named(node.property) === parts.at(-1) && memberIs(node.object, parts.slice(0, -1));
  };
  const declarations = method.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations);
  const address = declarations.find(node => node.init?.type === 'TemplateLiteral');
  if (!address || address.id.type !== 'Identifier') fail();
  const template = kind(address.init, 'TemplateLiteral');
  // The address is the object's complete transport, or its first-view transport when the page's own markup is adopted.
  const choice = template.expressions[1];
  const chosen = choice?.type === 'ConditionalExpression' && choice.test.type === 'CallExpression' && named(choice.test.callee) === 'adoptsServerMarkup' &&
    choice.test.arguments.length === 1 && memberIs(choice.test.arguments[0], [descriptorInput, 'id']) &&
    choice.consequent.type === 'Literal' && choice.consequent.value === 'first-view' && choice.alternate.type === 'Literal' && choice.alternate.value === 'object';
  if (template.expressions.length !== 2 || !memberIs(template.expressions[0], [descriptorInput, 'id']) || !chosen ||
      template.quasis.map(part => part.value.cooked).join('|') !== '/objects/|/|.json' || !functions.has('adoptsServerMarkup')) fail();
  const guard = kind(method.body.body[0], 'IfStatement');
  const alternatives = (node: Node): Node[] => node.type === 'LogicalExpression' && node.operator === '||' ? [...alternatives(node.left), ...alternatives(node.right)] : [node];
  const predicates = alternatives(guard.test);
  const rejects = (node: Node | undefined, right: (node: Node) => boolean) => node?.type === 'BinaryExpression' && node.operator === '!==' && named(node.left) === reference && right(node.right);
  const matches = (node: Node | undefined, pattern: string, parts: readonly string[]): boolean => {
    if (node?.type !== 'UnaryExpression' || node.operator !== '!' || node.argument.type !== 'CallExpression') return false;
    const callee = node.argument.callee;
    return callee.type === 'MemberExpression' && !callee.computed && named(callee.property) === 'test' && callee.object.type === 'Literal' && 'regex' in callee.object && callee.object.regex.pattern === pattern && callee.object.regex.flags === 'u' && node.argument.arguments.length === 1 && memberIs(node.argument.arguments[0], parts);
  };
  if (guard.alternate || guard.consequent.type !== 'BlockStatement' || guard.consequent.body.length !== 1 || guard.consequent.body[0].type !== 'ThrowStatement' || predicates.length !== 3 ||
      !rejects(predicates[0], node => node.type === 'Literal' && node.value === 'prepared/object.json') || !rejects(predicates[1], node => memberIs(node, [descriptorInput, 'prepared', 'url'])) ||
      !matches(predicates[2], '^[a-z][a-z0-9-]*$', [descriptorInput, 'id'])) fail();
  const fetched = nodes.find(node => node.type === 'VariableDeclarator' && node.init?.type === 'AwaitExpression' && node.init.argument.type === 'CallExpression' && named(node.init.argument.callee) === 'fetch');
  if (fetched?.type !== 'VariableDeclarator' || fetched.id.type !== 'Identifier') fail();
  const fetchCall = call(kind(fetched.init, 'AwaitExpression').argument, 'fetch', 2);
  const fetchOptions = staticObjectProperties(kind(fetchCall.arguments[1], 'ObjectExpression'));
  if (named(fetchCall.arguments[0]) !== address.id.name || fetchOptions.length !== 1 || propertyKey(fetchOptions[0].key) !== 'signal' || named(fetchOptions[0].value) !== signal ||
      !nodes.some(node => node.type === 'ReturnStatement' && node.argument?.type === 'CallExpression' && node.argument.callee.type === 'MemberExpression' && named(node.argument.callee.object) === named(fetched.id) && named(node.argument.callee.property) === 'arrayBuffer')) fail();
  return rendererBinding.source;
}

/** Interpret the already-validated data expression language; never execute source. */
async function readControls(file: string, source: RuntimeSourceReader, closure: Set<string>): Promise<unknown> {
  const text = await source(file);
  requirePreparedControlSource(text);
  const ast = parseRuntimeSource(text, file), scope = new Map<string, unknown>([['undefined', undefined]]);
  const primitive = (input: unknown): string | number | boolean | null | undefined => {
    if (input === null || input === undefined || typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') return input;
    return String(input);
  };
  function value(node: Node | null | undefined, bindings = scope): unknown {
    if (!node) throw new Error('Missing prepared content expression');
    switch (node.type) {
      case 'Literal': return node.value;
      case 'Identifier': return bindings.get(node.name);
      case 'ObjectExpression': return Object.fromEntries(staticObjectProperties(node).map(property => [propertyKey(property.key), value(property.value, bindings)]));
      case 'ArrayExpression': return node.elements.map(item => value(item, bindings));
      case 'MemberExpression': {
        const input = value(node.object, bindings), key = node.computed ? value(node.property, bindings) : nodeName(node.property);
        if (input === null || input === undefined) throw new TypeError('Prepared content cannot read a missing value');
        return Reflect.get(Object(input), String(key));
      }
      case 'TemplateLiteral': return node.quasis.map((part, index) => part.value.cooked + (index < node.expressions.length ? String(value(node.expressions[index], bindings)) : '')).join('');
      case 'ConditionalExpression': return value(value(node.test, bindings) ? node.consequent : node.alternate, bindings);
      case 'UnaryExpression': { const input = value(node.argument, bindings); return node.operator === '!' ? !input : node.operator === '-' ? -Number(input) : Number(input); }
      case 'LogicalExpression': { const left = value(node.left, bindings); return node.operator === '&&' ? left && value(node.right, bindings) : node.operator === '??' ? left ?? value(node.right, bindings) : left || value(node.right, bindings); }
      case 'BinaryExpression': {
        const a = value(node.left, bindings), b = value(node.right, bindings), left = primitive(a), right = primitive(b);
        switch (node.operator) {
          case '+': return typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : Number(left) + Number(right);
          case '-': return Number(a) - Number(b); case '*': return Number(a) * Number(b); case '/': return Number(a) / Number(b);
          case '===': return a === b; case '!==': return a !== b;
          case '<': return typeof left === 'string' && typeof right === 'string' ? left < right : Number(left) < Number(right);
          case '>': return typeof left === 'string' && typeof right === 'string' ? left > right : Number(left) > Number(right);
          case '<=': return typeof left === 'string' && typeof right === 'string' ? left <= right : Number(left) <= Number(right);
          case '>=': return typeof left === 'string' && typeof right === 'string' ? left >= right : Number(left) >= Number(right);
          default: throw new Error(`Unsupported prepared content operator ${node.operator}`);
        }
      }
      case 'CallExpression': {
        if (node.callee.type !== 'MemberExpression') throw new Error('Unsupported prepared content call');
        if (nodeName(node.callee.object) === 'Object') return value(node.arguments[0], bindings);
        const callback = node.arguments[0];
        if (callback.type !== 'ArrowFunctionExpression' || callback.params[0]?.type !== 'Identifier') throw new Error('Unsupported prepared content callback');
        const parameter = callback.params[0].name;
        return requireArray(value(node.callee.object, bindings)).map(item => value(callback.body, new Map([...bindings, [parameter, item]])));
      }
      default: throw new Error(`Unsupported prepared content node ${node.type}`);
    }
  }
  for (const statement of ast.body) {
    if (statement.type === 'ImportDeclaration') {
      const imported = resolve(dirname(file), requireString(statement.source.value));
      closure.add(imported);
      const records = new Map(readPreparedJsonExports(await source(imported)).map(record => [record.name, record.value]));
      for (const binding of statement.specifiers) {
        if (binding.type !== 'ImportSpecifier') throw new Error('Unsupported prepared content binding');
        const name = nodeName(binding.imported) ?? '';
        if (!records.has(name)) throw new Error(`Missing prepared content export ${name}`);
        scope.set(binding.local.name, records.get(name));
      }
    } else {
      const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
      if (declaration?.type !== 'VariableDeclaration') throw new Error('Unsupported prepared content declaration');
      for (const variable of declaration.declarations) scope.set(nodeName(variable.id) ?? '', value(variable.init));
    }
  }
  return scope.get('objectControls');
}

function authoredRecipe(descriptor: Record<string, unknown>) {
  const recipe = isRecord(descriptor.properties) ? descriptor.properties.recipe : undefined;
  if (!isRecord(recipe) || recipe.schema !== 'cssearth-authored-object@1' || !isArray(recipe.sources)) return null;
  const sources = recipe.sources.map(value => requireRecord(value));
  if (!sources.length || sources.some(reference => !reference || typeof reference !== 'object' ||
      !/^[a-z][a-z0-9.-]*$/.test(requireString(reference.id)) || typeof reference.path !== 'string')) {
    throw new TypeError('Authored recipe sources are invalid.');
  }
  if (new Set(sources.map(reference => reference.id)).size !== sources.length) throw new TypeError('Authored recipe sources are duplicated.');
  return { ...recipe, sources: sources.map(reference => ({ id: requireString(reference.id), path: requireString(reference.path) })) };
}

/**
 * Every authored recipe source must be pinned by the object's manifest and still match that pin. Returns the recipe,
 * or null for a descriptor without an authored recipe. Reads tracked files only.
 */
export async function requireAuthoredSourcePins({ objectId, descriptor, root, source, closure }: {objectId: string; descriptor: Record<string, unknown>; root: string; source: RuntimeSourceReader; closure: Set<string>}) {
  const recipe = authoredRecipe(descriptor);
  if (!recipe) return null;
  const directory = resolve(root, `src/objects/${objectId}`), manifestPath = resolve(directory, 'source/manifest.json');
  const manifest = requireRecord(JSON.parse(await source(manifestPath)));
  closure.add(manifestPath);
  const records = ['inputs', 'documents', 'generatedIntermediates'].flatMap(key => (isArray(manifest[key]) ? manifest[key] : []).map(value => requireRecord(value)));
  for (const reference of recipe.sources) {
    const path = resolve(directory, reference.path);
    if (relative(directory, path).startsWith('../')) throw new TypeError(`Authored source escapes its object package: ${reference.path}.`);
    const record = records.find(entry => `source/${String(entry.path)}` === reference.path);
    if (!record) throw new TypeError(`Authored source is not declared in the manifest: ${reference.path}.`);
    const bytes = await source(path);
    closure.add(path);
  }
  return recipe;
}

async function readAuthoredDefinition({ objectId, descriptor, root, source, closure }: {objectId: string; descriptor: Record<string, unknown>; root: string; source: RuntimeSourceReader; closure: Set<string>}) {
  if (!await requireAuthoredSourcePins({ objectId, descriptor, root, source, closure })) return null;
  const directory = resolve(root, `src/objects/${objectId}`);
  const preparation = resolve(directory, 'prepared');
  const runtimePath = resolve(preparation, 'runtime.json');
  const scenePath = resolve(preparation, 'scene.json');
  const runtime = requireRecord(JSON.parse(await source(runtimePath)));
  const scene: unknown = JSON.parse(await source(scenePath));
  closure.add(runtimePath); closure.add(scenePath); closure.add(resolve(preparation, 'sky.json'));
  if (runtime.id !== objectId || runtime.schema !== PREPARED_OBJECT_RUNTIME_SCHEMA) throw new TypeError('Authored runtime identity is invalid.');
  await requireAuthoredWorldFrame({ descriptor, scene, runtime, directory, readText: source, closure });
  return requireObjectRuntimeDefinition(runtime, { objectId });
}

export async function readDescriptorDefinition({ objectId, descriptorFile, root, source }: {objectId: string; descriptorFile: string; root: string; source: RuntimeSourceReader}) {
  const descriptorPath = resolve(root, descriptorFile), descriptor = requireRecord(JSON.parse(await source(descriptorPath)));
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== objectId || descriptor.type !== 'layered-body' ||
    !descriptor.properties || isArray(descriptor.properties) || typeof descriptor.properties !== 'object' ||
    Object.keys(descriptor).some(key => !['schema', 'id', 'type', 'properties', 'prepared'].includes(key))) throw new TypeError('Registered JSON descriptor identity or shape is invalid.');
  const reference = requireRecord(descriptor.prepared);
  if (reference?.format !== PREPARED_CSS_OBJECT_FORMAT ||
    typeof reference.url !== 'string' || Object.keys(reference).some(key => !['format', 'url'].includes(key))) throw new TypeError('JSON descriptor requires its prepared CSS artifact.');
  const descriptorDirectory = dirname(descriptorPath);
  const payloadPath = resolve(descriptorDirectory, reference.url);
  if (reference.url !== 'prepared/object.json' || payloadPath !== resolve(descriptorDirectory, 'prepared/object.json')) {
    throw new TypeError('Prepared JSON transport must remain inside its owning object prepared directory.');
  }
  const bytes = await source(payloadPath);
  const payload = requireRecord(JSON.parse(bytes));
  if (payload.schema !== 'cssearth-prepared-object@1' || payload.id !== objectId || payload.type !== descriptor.type || payload.format !== reference.format ||
    Object.keys(payload).some(key => !['schema', 'id', 'type', 'format', 'data'].includes(key))) throw new TypeError('Prepared JSON identity or format does not match its descriptor.');
  const closure = new Set([descriptorPath, payloadPath]);
  const authored = await readAuthoredDefinition({ objectId, descriptor, root, source, closure });
  if (authored) {
    if (!isDeepStrictEqual(payload.data, authored)) throw new TypeError('Prepared JSON bytes differ from the checked authored runtime.');
    return { plan: authored, definition: authored, closure, payloadPath };
  }
  const directory = resolve(root, `src/objects/${objectId}`);
  const definitionPath = resolve(directory, 'runtime/definition.mjs'), presentationPath = resolve(directory, 'runtime/preparedPresentation.mjs'), controlPath = resolve(directory, 'site/control-content.mjs');
  if (requirePreparedDefinitionSource(await source(definitionPath)) !== objectId) throw new TypeError('Prepared source definition names another object.');
  const plan = requireRecord(readPreparedPresentationModule(await source(presentationPath)));
  closure.add(definitionPath); closure.add(presentationPath); closure.add(controlPath);
  const controls = await readControls(controlPath, source, closure);
  const expected: unknown = JSON.parse(JSON.stringify({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: objectId, controls }));
  if (!isDeepStrictEqual(payload.data, expected)) throw new TypeError('Prepared JSON bytes differ from the checked presentation and control definitions.');
  const definition = requireObjectRuntimeDefinition(payload.data, { objectId });
  return { plan, definition, closure, payloadPath };
}
