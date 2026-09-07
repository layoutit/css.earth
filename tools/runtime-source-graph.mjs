import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'vite';
import { parseForESLint } from '@typescript-eslint/parser';

export function parseRuntimeSource(source, file) {
  if (!file.endsWith('.ts')) return parseAst(source);
  const { ast } = parseForESLint(source, { sourceType: 'module', range: true, loc: true });
  const executable = node => ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression'].includes(node?.type) ? executable(node.expression) : node;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.range) { node.start = node.range[0]; node.end = node.range[1]; }
    for (const [key, value] of Object.entries(node)) if (Array.isArray(value)) {
      node[key] = value.map(executable); node[key].forEach(visit);
    } else if (value && typeof value === 'object') { node[key] = executable(value); visit(node[key]); }
  };
  visit(ast);
  return ast;
}

/** Resolve published entries through their actual build configurations. */
export async function resolveRuntimeSource(imported, importer, { root, source }) {
  let target;
  if (imported.startsWith('.')) target = resolve(dirname(importer), imported);
  else if (imported.startsWith('@cssearth/')) {
    const name = imported.slice('@cssearth/'.length);
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Unclosed workspace import ${imported}`);
    const directory = resolve(root, 'packages', name);
    const manifest = JSON.parse(await source(resolve(directory, 'package.json')));
    if (manifest.name !== imported || typeof manifest.exports?.['.']?.import !== 'string') throw new Error(`Workspace export is not concrete: ${imported}`);
    target = resolve(directory, manifest.exports['.'].import);
  } else target = createRequire(importer).resolve(imported);
  if (relative(root, target).startsWith('../')) throw new Error(`Runtime import escapes the source root: ${imported}`);
  if (target.includes('/dist/') && !target.includes('/node_modules/')) {
    const directory = target.slice(0, target.lastIndexOf('/dist/'));
    const configFile = resolve(directory, 'tsup.config.ts');
    const ast = parseRuntimeSource(await source(configFile), configFile);
    const binding = ast.body.find(node => node.type === 'ImportDeclaration' && node.source.value === 'tsup')?.specifiers
      .find(node => node.imported?.name === 'defineConfig')?.local.name;
    const exported = ast.body.find(node => node.type === 'ExportDefaultDeclaration')?.declaration;
    const config = exported?.type === 'CallExpression' && exported.callee.name === binding && exported.arguments.length === 1 ? exported.arguments[0] : exported;
    if (config?.type !== 'ObjectExpression') throw new Error(`Runtime build must declare a concrete source entry: ${configFile}`);
    const urlToPath = ast.body.find(node => node.type === 'ImportDeclaration' && node.source.value === 'node:url')?.specifiers
      .find(node => node.imported?.name === 'fileURLToPath')?.local.name;
    function pathValue(node) {
      if (node?.type === 'Literal' && typeof node.value === 'string') return resolve(directory, node.value);
      const url = node?.arguments?.[0], base = url?.arguments?.[1];
      if (node?.type === 'CallExpression' && node.callee.name === urlToPath && node.arguments.length === 1 &&
        url?.type === 'NewExpression' && url.callee.name === 'URL' && url.arguments.length === 2 && url.arguments[0].type === 'Literal' &&
        base?.type === 'MemberExpression' && base.object?.type === 'MetaProperty' && base.object.meta.name === 'import' && base.object.property.name === 'meta' && base.property.name === 'url') return resolve(directory, url.arguments[0].value);
      throw new Error(`Runtime build path is not statically bound: ${configFile}`);
    }
    const properties = new Map(config.properties.map(property => [property.key?.name ?? property.key?.value, property.value]));
    const entry = properties.get('entry'), output = properties.get('outDir');
    const entries = new Map(), outputDirectory = output ? pathValue(output) : resolve(directory, 'dist');
    function bindEntry(name, node) {
      if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name) || entries.has(name)) {
        throw new Error(`Runtime build entry/output is not source-bound: ${configFile}`);
      }
      entries.set(name, pathValue(node));
    }
    if (entry?.type === 'ArrayExpression' && entry.elements.length > 0) {
      for (const node of entry.elements) bindEntry(pathValue(node).split('/').at(-1).replace(/\.ts$/, ''), node);
    } else if (entry?.type === 'ObjectExpression' && entry.properties.length > 0) {
      for (const property of entry.properties) {
        if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init') {
          throw new Error(`Runtime build entry/output is not source-bound: ${configFile}`);
        }
        bindEntry(property.key.name ?? property.key.value, property.value);
      }
    } else throw new Error(`Runtime build entry/output is not source-bound: ${configFile}`);
    const matched = [...entries].find(([name]) => resolve(outputDirectory, `${name}.js`) === target);
    if (!matched) throw new Error(`Runtime export does not match its build entry: ${target}`);
    target = matched[1];
  } else if (target.endsWith('.js')) {
    // TypeScript's emitted .js specifiers bind to the neighbouring .ts source.
    const typed = target.replace(/\.js$/, '.ts');
    try { await source(typed); target = typed; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!/\.(?:mjs|js|ts|astro|css|json)$/.test(target)) throw new Error(`Unclosed runtime source ${imported}`);
  if (relative(root, target).startsWith('src/planets/')) throw new Error('Shared runtime imports an object package');
  await source(target);
  return target;
}
