/** The `declared-dependencies` repository rule: a `packages/*` file imports a workspace package only when its own
 * `package.json` declares it. pnpm hoists every workspace package to the root `node_modules`, so an undeclared import
 * resolves anyway; nothing else notices until an isolated install or a build order drops it. Any dependency field
 * counts as a declaration for tests and for packages that run from source (telescope-cli has no tsup build). A package
 * tsup builds must ship what its non-test code imports, type-only imports included since `dist/*.d.ts` keeps them:
 * tsup keeps `dependencies` (and peer, optional) external but inlines a `devDependencies` package into `dist/`, or
 * leaves `dist/` importing a package its consumers never install. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import ts from 'typescript';
import { moduleSpecifiers } from './astro-imports.mts';
import { isTestPath } from './zones.mts';

const WORKSPACE_MANIFEST = /^(?:packages|labs\/nebula\/packages)\/[^/]+\/package\.json$/u;
const SOURCE = /\.(?:[cm]?[jt]s|tsx)$/u;
const SHIPPED_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

/** One workspace manifest: its directory, its name, the names it declares in any dependency field, the ones a tsup
 * build keeps external, and whether tsup builds it (a `tsup.config.ts` beside the manifest). */
export interface DeclaredPackage {
  readonly directory: string; readonly name: string; readonly declared: ReadonlySet<string>; readonly shipped: ReadonlySet<string>; readonly built: boolean;
}

export function declaredPackage(path: string, manifest: unknown, built = false): DeclaredPackage {
  if (!isRecord(manifest) || typeof manifest.name !== 'string') throw new TypeError(`${path} has no package name.`);
  const names = (fields: readonly string[]) => new Set(fields.flatMap(field => {
    const value = manifest[field];
    if (value === undefined) return [];
    if (!isRecord(value)) throw new TypeError(`${path} ${field} is not an object.`);
    return Object.keys(value);
  }));
  return { directory: path.slice(0, -'/package.json'.length), name: manifest.name,
    declared: names([...SHIPPED_FIELDS, 'devDependencies']), shipped: names(SHIPPED_FIELDS), built };
}

/** `moduleSpecifiers` (ESM, dynamic and type imports) plus CommonJS `require('…')` / `require.resolve('…')` and TypeScript `import x = require('…')`. */
export function importedSpecifiers(text: string, path: string): string[] {
  const found = moduleSpecifiers(text, path).map(item => item.specifier);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && (ts.isIdentifier(node.expression) && node.expression.text === 'require'
      || ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'require' && node.expression.name.text === 'resolve')
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) found.push(node.arguments[0].text);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteralLike(node.moduleReference.expression)) found.push(node.moduleReference.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, /x$/u.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  return found;
}

/** Findings for `sources` (repository path -> text): each import of another workspace package by a `packages/*` file
 * whose manifest does not declare it, or, outside tests of a tsup-built package, does not ship it; once per file and package. */
export function undeclaredImports(packages: readonly DeclaredPackage[], sources: ReadonlyMap<string, string>): string[] {
  const findings = new Set<string>();
  for (const [path, text] of sources) {
    const importer = packages.find(item => path.startsWith(`${item.directory}/`));
    if (!importer || !importer.directory.startsWith('packages/')) continue;
    const needsShipped = importer.built && !isTestPath(path);
    for (const specifier of importedSpecifiers(text, path)) {
      const imported = packages.find(item => specifier === item.name || specifier.startsWith(`${item.name}/`));
      if (!imported || imported === importer) continue;
      const manifest = `${importer.directory}/package.json`;
      if (!importer.declared.has(imported.name)) findings.add(`${path}: imports ${imported.name}, which ${manifest} does not declare`);
      else if (needsShipped && !importer.shipped.has(imported.name))
        findings.add(`${path}: imports ${imported.name}, which ${manifest} lists only in devDependencies although tsup builds this package`);
    }
  }
  return [...findings].sort();
}

/** The rule's check over the checkout at `root`, whose tracked and new files are `files`. */
export function checkDeclaredDependencies(root: string, files: readonly string[]): string[] {
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
  const tracked = new Set(files);
  const packages = files.filter(path => WORKSPACE_MANIFEST.test(path) && existsSync(resolve(root, path)))
    .map(path => declaredPackage(path, JSON.parse(read(path)), tracked.has(path.replace(/package\.json$/u, 'tsup.config.ts'))));
  const sources = new Map(files
    .filter(path => path.startsWith('packages/') && SOURCE.test(path) && existsSync(resolve(root, path)))
    .map(path => [path, read(path)] as const));
  return undeclaredImports(packages, sources);
}
