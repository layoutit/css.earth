/** The `declared-dependencies` repository rule: a `packages/*` file imports a workspace package only when its own
 * `package.json` declares it. pnpm hoists every workspace package to the root `node_modules`, so an undeclared import
 * resolves anyway; nothing else notices until an isolated install or a build order drops it. Any dependency field
 * counts as a declaration, tests included. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { moduleSpecifiers } from './astro-imports.mts';

const WORKSPACE_MANIFEST = /^(?:packages|labs\/nebula\/packages)\/[^/]+\/package\.json$/u;
const SOURCE = /\.(?:[cm]?[jt]s|tsx)$/u;
const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

/** One workspace manifest: its directory, its name and every name it declares in any dependency field. */
export interface DeclaredPackage { readonly directory: string; readonly name: string; readonly declared: ReadonlySet<string> }

export function declaredPackage(path: string, manifest: unknown): DeclaredPackage {
  if (!isRecord(manifest) || typeof manifest.name !== 'string') throw new TypeError(`${path} has no package name.`);
  const declared = new Set(FIELDS.flatMap(field => {
    const value = manifest[field];
    if (value === undefined) return [];
    if (!isRecord(value)) throw new TypeError(`${path} ${field} is not an object.`);
    return Object.keys(value);
  }));
  return { directory: path.slice(0, -'/package.json'.length), name: manifest.name, declared };
}

/** Findings for `sources` (repository path -> text): each import of another workspace package by a `packages/*` file
 * whose manifest does not declare it, once per file and package. */
export function undeclaredImports(packages: readonly DeclaredPackage[], sources: ReadonlyMap<string, string>): string[] {
  const findings = new Set<string>();
  for (const [path, text] of sources) {
    const importer = packages.find(item => path.startsWith(`${item.directory}/`));
    if (!importer || !importer.directory.startsWith('packages/')) continue;
    for (const { specifier } of moduleSpecifiers(text, path)) {
      const imported = packages.find(item => specifier === item.name || specifier.startsWith(`${item.name}/`));
      if (!imported || imported === importer || importer.declared.has(imported.name)) continue;
      findings.add(`${path}: imports ${imported.name}, which ${importer.directory}/package.json does not declare`);
    }
  }
  return [...findings].sort();
}

/** The rule's check over the checkout at `root`, whose tracked and new files are `files`. */
export function checkDeclaredDependencies(root: string, files: readonly string[]): string[] {
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
  const packages = files.filter(path => WORKSPACE_MANIFEST.test(path) && existsSync(resolve(root, path)))
    .map(path => declaredPackage(path, JSON.parse(read(path))));
  const sources = new Map(files
    .filter(path => path.startsWith('packages/') && SOURCE.test(path) && existsSync(resolve(root, path)))
    .map(path => [path, read(path)] as const));
  return undeclaredImports(packages, sources);
}
