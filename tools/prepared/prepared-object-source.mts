import { sha256 } from '../../src/platform/sha256.mts';
import { isArray } from '../../src/platform/is-array.mts';
import { isDeepStrictEqual } from 'node:util';
import { dirname, relative, resolve } from 'node:path';
import type { Node, FunctionDeclaration } from 'estree';
import { parseRuntimeSource } from '../ci/runtime-source-graph.mts';
import type { RuntimeSourceReader } from '../ci/runtime-source-graph.mts';
import { nodeName, propertyKey, staticObjectProperties } from '../ci/runtime-ast.mts';
import { isRecord, requireRecord, requireArray, requireString } from '../sources/source-values.mts';
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
  }
  const loader = functions.get(exported);
  if (!loader || loader.params.length !== 1 || loader.params[0].type !== 'Identifier') fail();
  // The authored TypeScript adapter validates unknown descriptors once before
  // binding the same immutable descriptor to transport and world navigation.
  let descriptorInput = loader.params[0].name;
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
  if (returned.arguments.length !== 3 || bindings.get(named(returned.callee))?.name !== 'createNavigableObjectMount' || named(returned.arguments[0]) !== descriptorInput) fail();
  const transportObject = kind(returned.arguments[1], 'ObjectExpression');
  const adapter = kind(returned.arguments[2], 'ArrowFunctionExpression');
  if (adapter.params.length !== 1 || adapter.params[0].type !== 'Identifier') fail();
  const branch = kind(adapter.body, 'ConditionalExpression');
  const ownWorldFrame = (node: Node | null | undefined): boolean => node?.type === 'MemberExpression' && !node.computed && named(node.property) === 'worldFrame' &&
    node.object.type === 'MemberExpression' && !node.object.computed && named(node.object.property) === 'properties' && named(node.object.object) === descriptorInput;
  const contextual = call(branch.consequent, 'bindContextualObject', 3), plain = call(branch.alternate, 'bindPackagedObject', 1);
  const frameArgument = contextual.arguments[2];
  const parsedFrame = frameArgument.type === 'LogicalExpression' && frameArgument.operator === '??' && named(frameArgument.right) === 'undefined'
    ? frameArgument.left : null;
  const validatedFrame = parsedFrame?.type === 'CallExpression' && named(parsedFrame.callee) === 'parsePreparedWorldCameraFrame' && parsedFrame.arguments.length === 1 && ownWorldFrame(parsedFrame.arguments[0]);
  if (!ownWorldFrame(branch.test) || named(contextual.arguments[0]) !== adapter.params[0].name ||
      !(ownWorldFrame(frameArgument) || validatedFrame) || named(plain.arguments[0]) !== adapter.params[0].name) fail();
  if (validatedFrame && bindings.get('parsePreparedWorldCameraFrame')?.source !== '../src/renderers/css/dist/navigation.js') fail();
  // The adapter must forward the application's own prepared world context. The
  // shell fetches and validates it in world-context-plan.mts so only the parsed
  // plan stays resident; a bundled JSON module kept a second copy on the heap.
  const contextName = named(contextual.arguments[1]);
  const contextBinding = bindings.get(contextName);
  const contextJsonImport = ast.body.some(statement => statement.type === 'ImportDeclaration' && statement.specifiers.length === 1 &&
    statement.specifiers[0].type === 'ImportDefaultSpecifier' && statement.specifiers[0].local.name === contextName &&
    statement.source.value === '../src/objects/sun/prepared/world-context.json' &&
    statement.attributes?.length === 1 && propertyKey(statement.attributes[0].key) === 'type' && statement.attributes[0].value.value === 'json');
  if (!contextJsonImport && !(contextBinding?.source === './world-context-plan.mts' && contextBinding.name === 'APPLICATION_WORLD_CONTEXT')) fail();
  const plainBinding = functions.get('bindPackagedObject');
  if (!plainBinding || plainBinding.params.length !== 2 || plainBinding.params[0].type !== 'Identifier') fail();
  const defaultMount = kind(plainBinding.params[1], 'AssignmentPattern');
  const mountIdentifier = kind(defaultMount.left, 'Identifier'), defaultFactory = kind(defaultMount.right, 'CallExpression');
  if (bindings.get(named(defaultFactory.callee))?.name !== 'createObjectRuntime' || defaultFactory.arguments.length !== 1 || named(defaultFactory.arguments[0]) !== plainBinding.params[0].name || plainBinding.body.body.length !== 1) fail();
  const plainMount = kind(kind(plainBinding.body.body[0], 'ReturnStatement').argument, 'ArrowFunctionExpression');
  const plainCall = call(plainMount.body, mountIdentifier.name, 2);
  if (plainMount.params.length !== 2 || plainMount.params.some(param => param.type !== 'Identifier') || named(plainCall.arguments[0]) !== named(plainMount.params[0]) || plainCall.arguments[1].type !== 'ObjectExpression') fail();
  const bind = functions.get('bindContextualObject');
  // The context parameter may carry the application context as its default, so
  // a caller that omits it still mounts against the same validated plan.
  const contextParam = bind?.params[1];
  const contextParamName = contextParam?.type === 'Identifier' ? contextParam.name
    : contextParam?.type === 'AssignmentPattern' && contextParam.left.type === 'Identifier'
      && bindings.get(named(contextParam.right))?.name === 'APPLICATION_WORLD_CONTEXT' ? contextParam.left.name : null;
  if (!bind || bind.params.length !== 3 || bind.params[0].type !== 'Identifier' || contextParamName === null || bind.body.body.length !== 2) fail();
  const frameParameter = kind(bind.params[2], 'AssignmentPattern'), frameDefault = kind(frameParameter.right, 'MemberExpression');
  if (frameParameter.left.type !== 'Identifier' || frameDefault.computed || named(frameDefault.property) !== 'frame') fail();
  const contextParameter = contextParamName;
  const contextParser = frameDefault.object.type === 'CallExpression' ? frameDefault.object : null;
  if (contextParser) {
    if (named(contextParser.callee) !== 'parsePreparedWorldContext' || contextParser.arguments.length !== 1 || named(contextParser.arguments[0]) !== contextParameter || bindings.get('parsePreparedWorldContext')?.source !== '../src/renderers/css/dist/index.js') fail();
  } else if (named(frameDefault.object) !== contextParameter) fail();
  const mountStatement = kind(bind.body.body[0], 'VariableDeclaration');
  if (mountStatement.kind !== 'const' || mountStatement.declarations.length !== 1) fail();
  const mount = mountStatement.declarations[0], mountId = kind(mount.id, 'Identifier'), mountInit = call(mount.init, 'bindPackagedObject', 2);
  if (named(mountInit.arguments[0]) !== bind.params[0].name) fail();
  const factory = call(mountInit.arguments[1], 'createWorldContextObjectRuntime', 1);
  const fields = new Map(staticObjectProperties(kind(factory.arguments[0], 'ObjectExpression')).map(property => [propertyKey(property.key), property.value]));
  if (named(fields.get('definition')) !== bind.params[0].name || named(fields.get('context')) !== contextParameter || named(fields.get('frame')) !== frameParameter.left.name) fail();
  const assignment = kind(kind(bind.body.body[1], 'ReturnStatement').argument, 'CallExpression'), assignMember = kind(assignment.callee, 'MemberExpression');
  if (named(assignMember.object) !== 'Object' || named(assignMember.property) !== 'assign' || named(assignment.arguments[0]) !== mountId.name) fail();
  const rendererBinding = bindings.get('createWorldContextObjectRuntime');
  if (!rendererBinding || rendererBinding.name !== 'createWorldContextObjectRuntime' || bindings.get('createNavigableObjectMount')?.source !== rendererBinding.source || bindings.get(named(defaultFactory.callee))?.source !== rendererBinding.source) fail();
  // The transport carries only the pinned prepared read.
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
  if (template.expressions.length !== 2 || !memberIs(template.expressions[0], [descriptorInput, 'id']) || !memberIs(template.expressions[1], [descriptorInput, 'prepared', 'sha256']) || template.quasis.map(part => part.value.cooked).join('|') !== '/objects/|/|.json') fail();
  const guard = kind(method.body.body[0], 'IfStatement');
  const alternatives = (node: Node): Node[] => node.type === 'LogicalExpression' && node.operator === '||' ? [...alternatives(node.left), ...alternatives(node.right)] : [node];
  const predicates = alternatives(guard.test);
  const rejects = (node: Node | undefined, right: (node: Node) => boolean) => node?.type === 'BinaryExpression' && node.operator === '!==' && named(node.left) === reference && right(node.right);
  const matches = (node: Node | undefined, pattern: string, parts: readonly string[]): boolean => {
    if (node?.type !== 'UnaryExpression' || node.operator !== '!' || node.argument.type !== 'CallExpression') return false;
    const callee = node.argument.callee;
    return callee.type === 'MemberExpression' && !callee.computed && named(callee.property) === 'test' && callee.object.type === 'Literal' && 'regex' in callee.object && callee.object.regex.pattern === pattern && callee.object.regex.flags === 'u' && node.argument.arguments.length === 1 && memberIs(node.argument.arguments[0], parts);
  };
  if (guard.alternate || guard.consequent.type !== 'BlockStatement' || guard.consequent.body.length !== 1 || guard.consequent.body[0].type !== 'ThrowStatement' || predicates.length !== 4 ||
      !rejects(predicates[0], node => node.type === 'Literal' && node.value === 'prepared/object.json') || !rejects(predicates[1], node => memberIs(node, [descriptorInput, 'prepared', 'url'])) ||
      !matches(predicates[2], '^[a-z][a-z0-9-]*$', [descriptorInput, 'id']) || !matches(predicates[3], '^[0-9a-f]{64}$', [descriptorInput, 'prepared', 'sha256'])) fail();
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
  if (sha256(bytes) !== reference.sha256) throw new TypeError('Prepared JSON transport SHA-256 does not match its descriptor.');
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
