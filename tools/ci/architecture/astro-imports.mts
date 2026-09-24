/** Imports that dependency-cruiser cannot see: `.astro` frontmatter and client scripts.
 *
 * dependency-cruiser has no `.astro` transpiler, so without this the graph misses every import made
 * only by an Astro component (item K listed 11 such files). The scanner reads the frontmatter and each
 * bundled `<script>` with the TypeScript parser, then resolves each specifier with the same extension
 * order, workspace packages and `package.json#imports` the cruise uses. Only specifiers that name a
 * tracked repository file become edges; npm packages and `astro:*` virtual modules are external. */
import ts from 'typescript';
import { posix } from 'node:path';
import { isRecord, requireRecord, requireString } from '@cssearth/core';
import { RESOLVE_EXTENSIONS } from './cruiser-config.mts';
import { distSource } from './renderer-entries.mts';

export interface AstroSpecifier { readonly specifier: string; readonly typeOnly: boolean; readonly symbols: readonly string[] }

/** The frontmatter block and every bundled script (not `is:inline`, not a non-module `type`). */
export function astroScriptBlocks(source: string): string[] {
  const blocks: string[] = [];
  const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
  if (frontmatter?.[1] !== undefined) blocks.push(frontmatter[1]);
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
    const attributes = match[1] ?? '', body = match[2] ?? '';
    if (/\bis:inline\b/u.test(attributes)) continue;
    const type = /\btype\s*=\s*["']([^"']*)["']/u.exec(attributes)?.[1];
    if (type !== undefined && type !== 'module') continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/u.exec(attributes)?.[1];
    blocks.push(src === undefined ? body : `import ${JSON.stringify(src)};`);
  }
  return blocks;
}

/** Static and dynamic import specifiers in one TypeScript block, with the names each one pulls in. */
export function moduleSpecifiers(text: string, fileName = 'module.ts'): AstroSpecifier[] {
  const tree = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, /x$/u.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: AstroSpecifier[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const bindings = clause?.namedBindings ?? (ts.isExportDeclaration(node) ? node.exportClause : undefined);
      const symbols: string[] = [];
      if (clause?.name) symbols.push('default');
      if (bindings && (ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings))) symbols.push('*');
      else if (bindings) for (const element of bindings.elements) symbols.push((element.propertyName ?? element.name).text);
      if (ts.isExportDeclaration(node) && !node.exportClause) symbols.push('*');
      const elementsTypeOnly = bindings !== undefined && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
        && bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly) && !clause?.name;
      const typeOnly = Boolean(clause?.isTypeOnly) || (ts.isExportDeclaration(node) && node.isTypeOnly) || elementsTypeOnly;
      found.push({ specifier: node.moduleSpecifier.text, typeOnly, symbols });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      found.push({ specifier: node.arguments[0].text, typeOnly: false, symbols: ['(dynamic)'] });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

export function astroSpecifiers(source: string, fileName: string): AstroSpecifier[] {
  return astroScriptBlocks(source).flatMap(block => moduleSpecifiers(block, `${fileName}.ts`));
}

export interface WorkspacePackage { readonly name: string; readonly directory: string; readonly exports: unknown }
export interface ResolveContext {
  /** Repository files (tracked, or new and not ignored); only these can be edge targets. */
  readonly tracked: ReadonlySet<string>;
  readonly workspaces: readonly WorkspacePackage[];
  /** The root `package.json#imports` map. */
  readonly imports: Readonly<Record<string, unknown>>;
  /** Compiled renderer entries to their sources (`renderer-entries.mts`). */
  readonly distEntries: ReadonlyMap<string, string>;
}

/** The `types` target of an export or import condition, as the cruise's condition order picks it. */
function conditionTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return undefined;
  for (const condition of ['types', 'import', 'require', 'node', 'default']) {
    const target = conditionTarget(value[condition]);
    if (target !== undefined) return target;
  }
  return undefined;
}

/** TypeScript's own rule: a `.js`, `.mjs` or `.cjs` specifier may name the `.ts`, `.mts` or `.cts` source, or the
 * tracked declaration that stands in for a generated module. */
const SOURCE_FOR_OUTPUT: Readonly<Record<string, readonly string[]>> = { '.js': ['.ts', '.tsx', '.d.ts'], '.mjs': ['.mts', '.d.mts'], '.cjs': ['.cts', '.d.cts'] };

/** A generated module (untracked) is counted as its tracked declaration, so the graph is the same whether or
 * not the checkout has run its preparation steps: `site/prepared-shell-titles.mjs` becomes `….d.mts`. */
export function trackedStandIn(path: string, tracked: ReadonlySet<string>): string | undefined {
  if (tracked.has(path)) return path;
  const match = /^(.*)\.([cm]?)[jt]s$/u.exec(path);
  if (!match) return undefined;
  const declaration = `${match[1]}.d.${match[2]}ts`;
  return tracked.has(declaration) ? declaration : undefined;
}

function candidates(base: string): string[] {
  const output = /\.[cm]?js$/u.exec(base)?.[0];
  const sources = output === undefined ? [] : (SOURCE_FOR_OUTPUT[output] ?? []).map(extension => base.slice(0, -output.length) + extension);
  return [base, ...sources, ...RESOLVE_EXTENSIONS.map(extension => base + extension), ...RESOLVE_EXTENSIONS.map(extension => `${base}/index${extension}`)];
}

/** A compiled `dist/` target of a shared package counts as its source entry, whether or not it is built. */
export function packageEntry(directory: string): string { return `${directory}/src/index.ts`; }

export function resolveSpecifier(from: string, raw: string, context: ResolveContext): string | undefined {
  const specifier = raw.replace(/[?#].*$/u, '');
  const pick = (base: string) => distSource(base, context.distEntries) ?? candidates(posix.normalize(base)).find(path => context.tracked.has(path));
  if (specifier.startsWith('.')) return pick(posix.join(posix.dirname(from), specifier));
  if (specifier.startsWith('/')) return pick(specifier.slice(1));
  if (raw.startsWith('#')) {
    for (const [pattern, value] of Object.entries(context.imports)) {
      const [prefix = '', suffix = ''] = pattern.split('*');
      const matches = pattern.includes('*') ? raw.startsWith(prefix) && raw.endsWith(suffix) : raw === pattern;
      const target = conditionTarget(value);
      if (!matches || target === undefined) continue;
      const middle = pattern.includes('*') ? raw.slice(prefix.length, raw.length - suffix.length) : '';
      return pick(target.replace('*', middle));
    }
    return undefined;
  }
  const workspace = context.workspaces.find(item => specifier === item.name || specifier.startsWith(`${item.name}/`));
  if (!workspace) return undefined;
  const key = specifier === workspace.name ? '.' : `.${specifier.slice(workspace.name.length)}`;
  const target = isRecord(workspace.exports) ? conditionTarget(workspace.exports[key]) : undefined;
  if (target === undefined || /(^|\/)dist\//u.test(target)) {
    const entry = packageEntry(workspace.directory);
    return context.tracked.has(entry) ? entry : undefined;
  }
  return pick(posix.join(workspace.directory, target));
}

/** Workspace packages from their manifests, given the tracked `package.json` paths under the workspace globs. */
export function workspacePackages(manifests: ReadonlyMap<string, unknown>): WorkspacePackage[] {
  return [...manifests].flatMap(([path, value]) => {
    const manifest = requireRecord(value, path);
    if (manifest.name === undefined) return [];
    return [{ name: requireString(manifest.name, `${path} name`), directory: posix.dirname(path), exports: manifest.exports }];
  });
}
