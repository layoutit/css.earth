import { isArray } from '../../src/platform/is-array.mts';
import { basename, dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'vite';
import { parseForESLint } from '@typescript-eslint/parser';
import type { Node, Program } from 'estree';
import { hasErrorCode, isRecord, requireRecord } from '@cssearth/core';

export type RuntimeSourceReader = (path: string) => string | Promise<string>;

/** Keep original source ranges while removing syntax that has no runtime owner. */
export function parseRuntimeSource(source: string, file: string): Program {
  if (!/\.(?:ts|mts)$/.test(file)) return parseAst(source);
  const { ast } = parseForESLint(source, { sourceType: 'module', range: true, loc: true });
  function executable(node: unknown): unknown {
    if (!isRecord(node)) return node;
    if (['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'TSInstantiationExpression'].includes(String(node.type))) return executable(node.expression);
    return node;
  }
  function runtimeEntry(node: unknown): boolean {
    return !isRecord(node) || !(node.importKind === 'type' || node.exportKind === 'type' || node.declare === true
      || isRecord(node.declaration) && node.declaration.declare === true
      || ['ImportDeclaration', 'ExportNamedDeclaration'].includes(String(node.type)) && isArray(node.specifiers) && node.specifiers.length > 0 && node.specifiers.every(specifier => isRecord(specifier) && (specifier.importKind === 'type' || specifier.exportKind === 'type'))
      || ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction'].includes(String(node.type))
      || node.type === 'ExportNamedDeclaration' && isRecord(node.declaration) && ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction'].includes(String(node.declaration.type)));
  }
  function visit(value: unknown): void {
    if (!isRecord(value)) return;
    if (isArray(value.range)) { value.start = value.range[0]; value.end = value.range[1]; }
    for (const [key, child] of Object.entries(value)) {
      if (isArray(child)) {
        const children = child.filter(runtimeEntry).map(executable);
        value[key] = children; children.forEach(visit);
      } else if (isRecord(child)) { value[key] = executable(child); visit(value[key]); }
    }
  }
  visit(ast);
  // Both parsers implement ESTree. The adapter removes TS-only runtime wrappers
  // and retains their original children/ranges instead of reparsing emitted JS.
  return ast as unknown as Program;
}

function nameOf(node: Node | null | undefined): string | undefined {
  return node?.type === 'Identifier' ? node.name : node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}
function importedName(ast: Program, source: string, symbol: string): string | undefined {
  for (const statement of ast.body) if (statement.type === 'ImportDeclaration' && statement.source.value === source) {
    for (const specifier of statement.specifiers) if (specifier.type === 'ImportSpecifier' && nameOf(specifier.imported) === symbol) return specifier.local.name;
  }
  return undefined;
}

/** Resolve published entries through their actual build configurations. */
export async function resolveRuntimeSource(imported: string, importer: string, { root, source, objectIds }: {root: string; source: RuntimeSourceReader; objectIds?: ReadonlySet<string>}): Promise<string> {
  let target: string;
  if (imported.startsWith('.')) target = resolve(dirname(importer), imported);
  else if (imported.startsWith('@cssearth/')) {
    // `@cssearth/<package>` or one declared subpath entry, `@cssearth/<package>/<entry>`.
    const [name = '', subpath, ...rest] = imported.slice('@cssearth/'.length).split('/');
    if (!/^[a-z][a-z0-9-]*$/.test(name) || rest.length || (subpath !== undefined && !/^[a-z][a-z0-9-]*$/.test(subpath))) throw new Error(`Unclosed workspace import ${imported}`);
    const directory = resolve(root, 'packages', name);
    const manifest = requireRecord(JSON.parse(await source(resolve(directory, 'package.json'))));
    const exports = isRecord(manifest.exports) ? manifest.exports[subpath === undefined ? '.' : `./${subpath}`] : null;
    if (manifest.name !== `@cssearth/${name}` || !isRecord(exports) || typeof exports.import !== 'string') throw new Error(`Workspace export is not concrete: ${imported}`);
    target = resolve(directory, exports.import);
  } else target = createRequire(importer).resolve(imported);
  if (relative(root, target).startsWith('../')) throw new Error(`Runtime import escapes the source root: ${imported}`);
  if (target.includes('/dist/') && !target.includes('/node_modules/')) {
    const directory = target.slice(0, target.lastIndexOf('/dist/'));
    const configFile = resolve(directory, 'tsup.config.ts');
    const ast = parseRuntimeSource(await source(configFile), configFile);
    const binding = importedName(ast, 'tsup', 'defineConfig');
    const exported = ast.body.find(node => node.type === 'ExportDefaultDeclaration')?.declaration;
    const config = exported?.type === 'CallExpression' && binding !== undefined && nameOf(exported.callee) === binding && exported.arguments.length === 1 ? exported.arguments[0] : exported;
    if (config?.type !== 'ObjectExpression') throw new Error(`Runtime build must declare a concrete source entry: ${configFile}`);
    const urlToPath = importedName(ast, 'node:url', 'fileURLToPath');
    function pathValue(node: Node | null | undefined): string {
      if (node?.type === 'Literal' && typeof node.value === 'string') return resolve(directory, node.value);
      const url = node?.type === 'CallExpression' ? node.arguments[0] : undefined;
      const base = url?.type === 'NewExpression' ? url.arguments[1] : undefined;
      if (node?.type === 'CallExpression' && urlToPath !== undefined && nameOf(node.callee) === urlToPath && node.arguments.length === 1 &&
        url?.type === 'NewExpression' && nameOf(url.callee) === 'URL' && url.arguments.length === 2 && url.arguments[0]?.type === 'Literal' && typeof url.arguments[0].value === 'string' &&
        base?.type === 'MemberExpression' && base.object.type === 'MetaProperty' && base.object.meta.name === 'import' && base.object.property.name === 'meta' && nameOf(base.property) === 'url') return resolve(directory, url.arguments[0].value);
      throw new Error(`Runtime build path is not statically bound: ${configFile}`);
    }
    const properties = new Map<string, Node>();
    for (const property of config.properties) {
      const name = property.type === 'Property' && !property.computed ? nameOf(property.key) : undefined;
      if (property.type !== 'Property' || name === undefined) throw new Error(`Runtime build must declare concrete properties: ${configFile}`);
      properties.set(name, property.value);
    }
    const entry = properties.get('entry'), output = properties.get('outDir');
    const entries = new Map<string, string>(), outputDirectory = output ? pathValue(output) : resolve(directory, 'dist');
    function bindEntry(name: string | undefined, node: Node | null | undefined): void {
      if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(name) || entries.has(name)) throw new Error(`Runtime build entry/output is not source-bound: ${configFile}`);
      entries.set(name, pathValue(node));
    }
    if (entry?.type === 'ArrayExpression' && entry.elements.length > 0) {
      for (const node of entry.elements) bindEntry(basename(pathValue(node)).replace(/\.m?ts$/, ''), node);
    } else if (entry?.type === 'ObjectExpression' && entry.properties.length > 0) {
      for (const property of entry.properties) {
        if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init') throw new Error(`Runtime build entry/output is not source-bound: ${configFile}`);
        bindEntry(nameOf(property.key), property.value);
      }
    } else throw new Error(`Runtime build entry/output is not source-bound: ${configFile}`);
    const matched = [...entries].find(([name]) => resolve(outputDirectory, `${name}.js`) === target);
    if (!matched) throw new Error(`Runtime export does not match its build entry: ${target}`);
    target = matched[1];
  } else if (target.endsWith('.js')) {
    const typed = target.replace(/\.js$/, '.ts');
    try { await source(typed); target = typed; } catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
  }
  if (!/\.(?:mjs|js|ts|mts|astro|css|json)$/.test(target)) throw new Error(`Unclosed runtime source ${imported}`);
  // Given the registered object ids, context folders beside them stay importable application data.
  const targetFile = relative(root, target);
  if (targetFile.startsWith('src/objects/') && (!objectIds || objectIds.has(targetFile.split('/')[2] ?? ''))) throw new Error('Shared runtime imports an object package');
  await source(target);
  return target;
}
