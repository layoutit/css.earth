import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { dirname, relative, resolve } from 'node:path';
import { parseAst } from 'vite';
import { requirePreparedControlSource, requirePreparedDefinitionSource, readPreparedJsonExports, readPreparedPresentationModule } from './check-prepared-presentation.mjs';
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from '../src/platform/prepared-schema.mjs';
import { requireObjectRuntimeDefinition } from './object-runtime-contract.mjs';
import { requireAuthoredWorldFrame } from './authored-world-frame.mjs';

export function requireDescriptorAdapterSource(text, exported) {
  const ast = parseAst(text), bindings = new Map(), functions = new Map();
  const fail = () => { throw new TypeError('Registered descriptor loader must forward its prepared transport into the actual shared factory.'); };
  for (const statement of ast.body) {
    if (statement.type === 'ImportDeclaration') for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier') bindings.set(specifier.local.name, { name: specifier.imported.name, source: statement.source.value });
    }
    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration') functions.set(statement.declaration.id.name, statement.declaration);
  }
  const loader = functions.get(exported), returned = loader?.body.body[0]?.argument;
  if (loader?.params.length !== 1 || loader.params[0].type !== 'Identifier' || loader.body.body.length !== 1 ||
    returned?.type !== 'CallExpression' || returned.arguments.length !== 3 || bindings.get(returned.callee.name)?.name !== 'createNavigableObjectMount') fail();
  if (returned.arguments[0]?.type !== 'Identifier' || returned.arguments[0].name !== loader.params[0].name ||
    returned.arguments[1].type !== 'ObjectExpression') fail();
  const adapter = returned.arguments[2];
  if (adapter?.type !== 'ArrowFunctionExpression' || adapter.params.length !== 1 || adapter.params[0]?.type !== 'Identifier' ||
    adapter.body?.type !== 'ConditionalExpression') fail();
  const descriptorInput = loader.params[0].name;
  const ownWorldFrame = node => node?.type === 'MemberExpression' && !node.computed && node.property.name === 'worldFrame' &&
    node.object?.type === 'MemberExpression' && !node.object.computed && node.object.property.name === 'properties' &&
    node.object.object?.type === 'Identifier' && node.object.object.name === descriptorInput;
  const contextual = adapter.body.consequent, plain = adapter.body.alternate;
  if (!ownWorldFrame(adapter.body.test) || contextual?.type !== 'CallExpression' || contextual.callee?.name !== 'bindContextualObject' ||
    contextual.arguments.length !== 3 || contextual.arguments[0]?.name !== adapter.params[0].name ||
    !ownWorldFrame(contextual.arguments[2]) || plain?.type !== 'CallExpression' || plain.callee?.name !== 'bindPackagedObject' ||
    plain.arguments.length !== 1 || plain.arguments[0]?.name !== adapter.params[0].name) fail();
  const contextImport = ast.body.find(statement => statement.type === 'ImportDeclaration' && statement.specifiers.length === 1 &&
    statement.specifiers[0].type === 'ImportDefaultSpecifier' && statement.source.value === '../src/planets/sun/prepared/world-context.json' &&
    statement.attributes?.length === 1 && (statement.attributes[0].key.name ?? statement.attributes[0].key.value) === 'type' &&
    statement.attributes[0].value.value === 'json');
  if (!contextImport || contextual.arguments[1]?.type !== 'Identifier' ||
    contextual.arguments[1].name !== contextImport.specifiers[0].local.name) fail();
  const plainBinding = functions.get('bindPackagedObject'), defaultMount = plainBinding?.params[1];
  if (plainBinding?.params.length !== 2 || plainBinding.params[0]?.type !== 'Identifier' ||
    defaultMount?.type !== 'AssignmentPattern' || defaultMount.left?.type !== 'Identifier' ||
    defaultMount.right?.type !== 'CallExpression' || bindings.get(defaultMount.right.callee?.name)?.name !== 'createObjectRuntime' ||
    defaultMount.right.arguments.length !== 1 || defaultMount.right.arguments[0]?.name !== plainBinding.params[0].name) fail();
  const plainMount = plainBinding.body.body[0]?.argument;
  if (plainBinding.body.body.length !== 1 || plainMount?.type !== 'ArrowFunctionExpression' || plainMount.params.length !== 2 ||
    plainMount.body?.type !== 'CallExpression' || plainMount.body.callee?.name !== defaultMount.left.name ||
    plainMount.body.arguments[0]?.name !== plainMount.params[0]?.name || plainMount.body.arguments[1]?.type !== 'ObjectExpression') fail();
  const bind = functions.get('bindContextualObject');
  if (!bind || bind.params.length !== 3 || bind.params[0]?.type !== 'Identifier' || bind.params[1]?.type !== 'Identifier' ||
    bind.params[2]?.type !== 'AssignmentPattern' || bind.params[2].left?.type !== 'Identifier' ||
    bind.params[2].right?.type !== 'MemberExpression' || bind.params[2].right.computed || bind.params[2].right.property.name !== 'frame' ||
    bind.params[2].right.object?.type !== 'Identifier' || bind.params[2].right.object.name !== bind.params[1].name ||
    bind.body.body.length !== 2) fail();
  const definition = bind.params[0], context = bind.params[1], mountStatement = bind.body.body[0], returnStatement = bind.body.body[1];
  const mount = mountStatement?.declarations?.[0], mountInit = mount?.init;
  if (mountStatement?.type !== 'VariableDeclaration' || mountStatement.kind !== 'const' || mountStatement.declarations.length !== 1 ||
    mount.id?.type !== 'Identifier' || mountInit?.type !== 'CallExpression' || mountInit.callee?.name !== 'bindPackagedObject' ||
    mountInit.arguments.length !== 2 || mountInit.arguments[0]?.name !== definition.name) fail();
  const factory = mountInit.arguments[1];
  if (factory?.type !== 'CallExpression' || factory.callee?.name !== 'createWorldContextObjectRuntime' || factory.arguments.length !== 1 ||
    factory.arguments[0]?.type !== 'ObjectExpression') fail();
  const fields = new Map(factory.arguments[0].properties.map(property => [property.key.name ?? property.key.value, property.value]));
  if (fields.get('definition')?.name !== definition.name || fields.get('context')?.name !== context.name || fields.get('frame')?.name !== bind.params[2].left.name) fail();
  if (returnStatement?.type !== 'ReturnStatement' || returnStatement.argument?.type !== 'CallExpression' ||
    returnStatement.argument.callee?.type !== 'MemberExpression' || returnStatement.argument.callee.object?.name !== 'Object' ||
    returnStatement.argument.callee.property?.name !== 'assign' || returnStatement.argument.arguments[0]?.name !== mount.id.name) fail();
  const rendererBinding = bindings.get('createWorldContextObjectRuntime');
  if (!rendererBinding || rendererBinding.name !== 'createWorldContextObjectRuntime' ||
    bindings.get('createNavigableObjectMount')?.source !== rendererBinding.source ||
    bindings.get(defaultMount.right.callee.name)?.source !== rendererBinding.source) fail();
  const renderer = rendererBinding.source;
  const transport = returned.arguments[1].properties;
  if (transport.length !== 1 || (transport[0].key.name ?? transport[0].key.value) !== 'read' || !transport[0].method || !transport[0].value.async ||
    transport[0].value.params.length !== 2 || transport[0].value.params.some(param => param.type !== 'Identifier')) fail();
  const method = transport[0].value, reference = method.params[0]?.name, signal = method.params[1].name, nodes = [];
  const walk = node => { if (!node || typeof node !== 'object') return; if (node.type) nodes.push(node); for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value); };
  walk(method.body);
  const memberIs = (node, parts) => {
    if (node?.type === 'ChainExpression') return memberIs(node.expression, parts);
    if (parts.length === 1) return node?.type === 'Identifier' && node.name === parts[0];
    return node?.type === 'MemberExpression' && !node.computed && node.property?.name === parts.at(-1) && memberIs(node.object, parts.slice(0, -1));
  };
  const declarations = method.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations);
  const address = declarations.find(node => node.init?.type === 'TemplateLiteral');
  const template = address?.init;
  if (address?.id.type !== 'Identifier' || template.expressions.length !== 2 ||
    !memberIs(template.expressions[0], [descriptorInput, 'id']) ||
    !memberIs(template.expressions[1], [descriptorInput, 'prepared', 'sha256']) ||
    template.quasis.map(part => part.value.cooked).join('|') !== '/objects/|/|.json') fail();
  const guard = method.body.body[0];
  const alternatives = node => node?.type === 'LogicalExpression' && node.operator === '||'
    ? [...alternatives(node.left), ...alternatives(node.right)] : [node];
  const predicates = alternatives(guard?.test);
  const rejects = (node, right) => node?.type === 'BinaryExpression' && node.operator === '!==' && node.left?.name === reference && right(node.right);
  const matches = (node, pattern, parts) => node?.type === 'UnaryExpression' && node.operator === '!' &&
    node.argument?.type === 'CallExpression' && node.argument.callee?.type === 'MemberExpression' && !node.argument.callee.computed &&
    node.argument.callee.property?.name === 'test' && node.argument.callee.object?.regex?.pattern === pattern &&
    node.argument.callee.object.regex.flags === 'u' && node.argument.arguments.length === 1 && memberIs(node.argument.arguments[0], parts);
  if (guard?.type !== 'IfStatement' || guard.alternate || guard.consequent?.type !== 'BlockStatement' ||
    guard.consequent.body.length !== 1 || guard.consequent.body[0].type !== 'ThrowStatement' || predicates.length !== 4 ||
    !rejects(predicates[0], node => node?.value === 'prepared/object.json') ||
    !rejects(predicates[1], node => memberIs(node, [descriptorInput, 'prepared', 'url'])) ||
    !matches(predicates[2], '^[a-z][a-z0-9-]*$', [descriptorInput, 'id']) ||
    !matches(predicates[3], '^[0-9a-f]{64}$', [descriptorInput, 'prepared', 'sha256'])) fail();
  const fetched = nodes.find(node => node.type === 'VariableDeclarator' && node.init?.type === 'AwaitExpression' && node.init.argument?.callee?.name === 'fetch');
  const fetchOptions = fetched?.init.argument.arguments[1];
  if (fetched?.init.argument.arguments.length !== 2 || fetched.init.argument.arguments[0].name !== address.id.name ||
    fetchOptions?.type !== 'ObjectExpression' || fetchOptions.properties.length !== 1 || fetchOptions.properties[0].key?.name !== 'signal' ||
    fetchOptions.properties[0].value?.name !== signal ||
    !nodes.some(node => node.type === 'ReturnStatement' && node.argument?.type === 'CallExpression' && node.argument.callee.object?.name === fetched.id.name && node.argument.callee.property?.name === 'arrayBuffer')) fail();
  return renderer;
}

/** Interpret the already-validated data expression language; never execute source. */
async function readControls(file, source, closure) {
  const text = await source(file);
  requirePreparedControlSource(text);
  const ast = parseAst(text), scope = new Map([['undefined', undefined]]);
  function value(node, bindings = scope) {
    switch (node.type) {
      case 'Literal': return node.value;
      case 'Identifier': return bindings.get(node.name);
      case 'ObjectExpression': return Object.fromEntries(node.properties.map(property => [property.key.name ?? property.key.value, value(property.value, bindings)]));
      case 'ArrayExpression': return node.elements.map(item => value(item, bindings));
      case 'MemberExpression': return value(node.object, bindings)[node.computed ? value(node.property, bindings) : node.property.name];
      case 'TemplateLiteral': return node.quasis.map((part, index) => part.value.cooked + (index < node.expressions.length ? value(node.expressions[index], bindings) : '')).join('');
      case 'ConditionalExpression': return value(value(node.test, bindings) ? node.consequent : node.alternate, bindings);
      case 'UnaryExpression': { const input = value(node.argument, bindings); return node.operator === '!' ? !input : node.operator === '-' ? -input : +input; }
      case 'LogicalExpression': { const left = value(node.left, bindings); return node.operator === '&&' ? left && value(node.right, bindings) : node.operator === '??' ? left ?? value(node.right, bindings) : left || value(node.right, bindings); }
      case 'BinaryExpression': {
        const a = value(node.left, bindings), b = value(node.right, bindings);
        switch (node.operator) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b;
          case '===': return a === b; case '!==': return a !== b; case '<': return a < b; case '>': return a > b;
          case '<=': return a <= b; case '>=': return a >= b;
          default: throw new Error(`Unsupported prepared content operator ${node.operator}`);
        }
      }
      case 'CallExpression': {
        if (node.callee.object.name === 'Object') return value(node.arguments[0], bindings);
        const callback = node.arguments[0];
        return value(node.callee.object, bindings).map(item => value(callback.body, new Map([...bindings, [callback.params[0].name, item]])));
      }
      default: throw new Error(`Unsupported prepared content node ${node.type}`);
    }
  }
  for (const statement of ast.body) {
    if (statement.type === 'ImportDeclaration') {
      const imported = resolve(dirname(file), statement.source.value);
      closure.add(imported);
      const records = new Map(readPreparedJsonExports(await source(imported)).map(record => [record.name, record.value]));
      for (const binding of statement.specifiers) {
        if (!records.has(binding.imported.name)) throw new Error(`Missing prepared content export ${binding.imported.name}`);
        scope.set(binding.local.name, records.get(binding.imported.name));
      }
    } else for (const declaration of (statement.declaration ?? statement).declarations) scope.set(declaration.id.name, value(declaration.init));
  }
  return scope.get('objectControls');
}

function authoredRecipe(descriptor) {
  const recipe = descriptor.properties?.recipe;
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe) || recipe.schema !== 'cssearth-authored-object@1' || !Array.isArray(recipe.sources)) return null;
  const sources = recipe.sources;
  if (!sources.length || sources.some(reference => !reference || typeof reference !== 'object' ||
      !/^[a-z][a-z0-9.-]*$/.test(reference.id) || typeof reference.path !== 'string' ||
      !/^[a-f0-9]{64}$/.test(reference.sha256))) {
    throw new TypeError('Authored recipe sources are invalid.');
  }
  if (new Set(sources.map(reference => reference.id)).size !== sources.length) throw new TypeError('Authored recipe sources are duplicated.');
  return recipe;
}

async function readAuthoredDefinition({ objectId, descriptor, root, source, closure }) {
  const recipe = authoredRecipe(descriptor);
  if (!recipe) return null;
  const directory = resolve(root, `src/planets/${objectId}`);
  for (const reference of recipe.sources) {
    const path = resolve(directory, reference.path);
    if (relative(directory, path).startsWith('../')) throw new TypeError(`Authored source escapes its object package: ${reference.path}.`);
    const bytes = await source(path);
    if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new TypeError(`Authored source digest drifted: ${reference.path}.`);
    closure.add(path);
  }
  const preparation = resolve(directory, 'prepared');
  const runtimePath = resolve(preparation, 'runtime.json');
  const scenePath = resolve(preparation, 'scene.json');
  const runtime = JSON.parse(await source(runtimePath));
  const scene = JSON.parse(await source(scenePath));
  closure.add(runtimePath); closure.add(scenePath);
  if (runtime.id !== objectId || runtime.schema !== PREPARED_OBJECT_RUNTIME_SCHEMA) throw new TypeError('Authored runtime identity is invalid.');
  await requireAuthoredWorldFrame({ descriptor, scene, runtime, directory, readText: source, closure });
  requireObjectRuntimeDefinition(runtime, { objectId });
  return runtime;
}

export async function readDescriptorDefinition({ objectId, descriptorFile, root, source }) {
  const descriptorPath = resolve(root, descriptorFile), descriptor = JSON.parse(await source(descriptorPath));
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.id !== objectId || descriptor.type !== 'layered-body' ||
    !descriptor.properties || Array.isArray(descriptor.properties) || typeof descriptor.properties !== 'object' ||
    Object.keys(descriptor).some(key => !['schema', 'id', 'type', 'properties', 'prepared'].includes(key))) throw new TypeError('Registered JSON descriptor identity or shape is invalid.');
  const reference = descriptor.prepared;
  if (reference?.format !== 'cssearth-css-object@4' || !/^[a-f0-9]{64}$/.test(reference.sha256 ?? '') ||
    typeof reference.url !== 'string' || Object.keys(reference).some(key => !['format', 'url', 'sha256'].includes(key))) throw new TypeError('JSON descriptor requires its pinned prepared CSS artifact.');
  const descriptorDirectory = dirname(descriptorPath);
  const payloadPath = resolve(descriptorDirectory, reference.url);
  if (reference.url !== 'prepared/object.json' || payloadPath !== resolve(descriptorDirectory, 'prepared/object.json')) {
    throw new TypeError('Prepared JSON transport must remain inside its owning object prepared directory.');
  }
  const bytes = await source(payloadPath);
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) throw new TypeError('Prepared JSON transport SHA-256 does not match its descriptor.');
  const payload = JSON.parse(bytes);
  if (payload.schema !== 'cssearth-prepared-object@1' || payload.id !== objectId || payload.type !== descriptor.type || payload.format !== reference.format ||
    Object.keys(payload).some(key => !['schema', 'id', 'type', 'format', 'data'].includes(key))) throw new TypeError('Prepared JSON identity or format does not match its descriptor.');
  const closure = new Set([descriptorPath, payloadPath]);
  const authored = await readAuthoredDefinition({ objectId, descriptor, root, source, closure });
  if (authored) {
    if (!isDeepStrictEqual(payload.data, authored)) throw new TypeError('Prepared JSON bytes differ from the checked authored runtime.');
    return { plan: authored, definition: authored, closure, payloadPath };
  }
  const directory = resolve(root, `src/planets/${objectId}`);
  const definitionPath = resolve(directory, 'runtime/definition.mjs'), presentationPath = resolve(directory, 'runtime/preparedPresentation.mjs'), controlPath = resolve(directory, 'site/control-content.mjs');
  if (requirePreparedDefinitionSource(await source(definitionPath)) !== objectId) throw new TypeError('Prepared source definition names another object.');
  const plan = readPreparedPresentationModule(await source(presentationPath));
  closure.add(definitionPath); closure.add(presentationPath); closure.add(controlPath);
  const controls = await readControls(controlPath, source, closure);
  const expected = JSON.parse(JSON.stringify({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: objectId, controls }));
  if (!isDeepStrictEqual(payload.data, expected)) throw new TypeError('Prepared JSON bytes differ from the checked presentation and control definitions.');
  requireObjectRuntimeDefinition(payload.data, { objectId });
  return { plan, definition: payload.data, closure, payloadPath };
}
