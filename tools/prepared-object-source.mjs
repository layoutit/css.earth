import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { dirname, relative, resolve } from 'node:path';
import { parseAst } from 'vite';
import { requirePreparedControlSource, requirePreparedDefinitionSource, readPreparedJsonExports, readPreparedPresentationModule } from './check-prepared-presentation.mjs';
import { PREPARED_OBJECT_RUNTIME_SCHEMA } from '../src/platform/prepared-schema.mjs';
import { requireObjectRuntimeDefinition } from './object-runtime-contract.mjs';

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
  const bind = functions.get(returned.arguments[2]?.name);
  if (returned.arguments[0]?.type !== 'Identifier' || returned.arguments[0].name !== loader.params[0].name ||
    returned.arguments[1].type !== 'ObjectExpression' || !bind || bind.params.length !== 1 || bind.params[0].type !== 'Identifier' || bind.body.body.length !== 2) fail();
  const declaration = bind.body.body[0]?.declarations?.[0], factory = declaration?.init, mount = bind.body.body[1]?.argument;
  if (declaration?.id.type !== 'Identifier' || factory?.type !== 'CallExpression' || factory.arguments.length !== 1 ||
    bindings.get(factory.callee.name)?.name !== 'createObjectRuntime' || factory.arguments[0].name !== bind.params[0].name ||
    mount?.type !== 'ArrowFunctionExpression' || mount.params.length !== 2 || mount.body?.type !== 'CallExpression' || mount.body.callee.name !== declaration.id.name ||
    mount.body.arguments[0]?.name !== mount.params[0]?.name || mount.body.arguments[1]?.type !== 'ObjectExpression') fail();
  const renderer = bindings.get(factory.callee.name).source;
  if (bindings.get(returned.callee.name)?.source !== renderer) fail();
  const transport = returned.arguments[1].properties;
  if (transport.length !== 1 || (transport[0].key.name ?? transport[0].key.value) !== 'read' || !transport[0].method || !transport[0].value.async || transport[0].value.params.length !== 1) fail();
  const method = transport[0].value, reference = method.params[0]?.name, nodes = [];
  const walk = node => { if (!node || typeof node !== 'object') return; if (node.type) nodes.push(node); for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value); };
  walk(method.body);
  const glob = nodes.filter(node => node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression' && node.init.callee?.property?.name === 'glob');
  if (glob.length !== 1 || glob[0].id.type !== 'Identifier') fail();
  const call = glob[0].init, meta = call.callee.object;
  const options = new Map(call.arguments[1]?.properties?.map(property => [property.key.name ?? property.key.value, property.value.value]));
  if (meta?.type !== 'MetaProperty' || meta.meta.name !== 'import' || meta.property.name !== 'meta' || call.arguments[0]?.value !== '../src/planets/*/prepared/object.json' ||
    options.size !== 3 || options.get('query') !== '?url' || options.get('import') !== 'default' || options.get('eager') !== true) fail();
  const address = nodes.find(node => node.type === 'VariableDeclarator' && node.init?.type === 'MemberExpression' && node.init.object.name === glob[0].id.name);
  const template = address?.init.property, objectId = template?.expressions?.[0];
  if (!address?.init.computed || template?.type !== 'TemplateLiteral' || template.expressions.length !== 2 ||
    objectId?.type !== 'MemberExpression' || objectId.computed || objectId.object?.name !== loader.params[0].name || objectId.property?.name !== 'id' ||
    template.expressions[1]?.name !== reference || template.quasis[0].value.cooked !== '../src/planets/' ||
    template.quasis[1].value.cooked !== '/' || template.quasis[2].value.cooked !== '') fail();
  const fetched = nodes.find(node => node.type === 'VariableDeclarator' && node.init?.type === 'AwaitExpression' && node.init.argument?.callee?.name === 'fetch');
  if (fetched?.init.argument.arguments.length !== 1 || fetched.init.argument.arguments[0].name !== address.id.name ||
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
  if (!isDeepStrictEqual(scene.worldFrame, descriptor.properties.worldFrame)) throw new TypeError('Authored physical frame differs from the descriptor world frame.');
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
