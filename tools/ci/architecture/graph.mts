/** The file-level import graph: dependency-cruiser's resolved imports, restricted to repository files
 * (tracked, or new and not ignored), plus the `.astro` imports it cannot read. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cruise } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { isRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import { astroSpecifiers, moduleSpecifiers, packageEntry, resolveSpecifier, trackedStandIn, workspacePackages, type ResolveContext } from './astro-imports.mts';
import { CRUISE_OPTIONS, CRUISE_ROOTS, EXCLUDE_PATHS, ROOT_CONFIG_FILE } from './cruiser-config.mts';
import { isTestPath } from './zones.mts';

export interface FileFacts {
  readonly test: boolean;
  /** Named in a root `package.json` script (a substring match, as in the prototype). */
  readonly script: boolean;
  /** Reads `process.argv` or checks that it is the main module. */
  readonly entryHint: boolean;
  readonly loc: number;
}
export interface ImportEdge {
  readonly from: string;
  readonly to: string;
  /** The importing file is a test, fixture or harness. */
  readonly test: boolean;
  readonly symbols: readonly string[];
  readonly typeOnly: boolean;
}
export interface ImportGraph { readonly files: ReadonlyMap<string, FileFacts>; readonly edges: readonly ImportEdge[] }

/** One module of dependency-cruiser's JSON result, validated. */
interface CruisedDependency { readonly module: string; readonly resolved: string; readonly coreModule: boolean; readonly couldNotResolve: boolean }
interface CruisedModule { readonly source: string; readonly coreModule: boolean; readonly couldNotResolve: boolean; readonly dependencies: readonly CruisedDependency[] }

const flag = (record: Record<string, unknown>, key: string): boolean => record[key] === true;

export function decodeCruiseResult(value: unknown): CruisedModule[] {
  return requireArray(requireRecord(value, 'dependency-cruiser result').modules, 'dependency-cruiser modules').map((item, index) => {
    const module = requireRecord(item, `module ${index}`);
    return {
      source: requireString(module.source, `module ${index} source`),
      coreModule: flag(module, 'coreModule'),
      couldNotResolve: flag(module, 'couldNotResolve'),
      dependencies: requireArray(module.dependencies, `module ${index} dependencies`).map((entry, position) => {
        const dependency = requireRecord(entry, `module ${index} dependency ${position}`);
        return {
          module: requireString(dependency.module, `module ${index} dependency ${position} module`),
          resolved: requireString(dependency.resolved, `module ${index} dependency ${position} resolved`),
          coreModule: flag(dependency, 'coreModule'),
          couldNotResolve: flag(dependency, 'couldNotResolve'),
        };
      }),
    };
  });
}

/** Compiled output counts as its source: a shared package's `dist/` becomes its `src/index.ts`. */
function normalise(path: string): string {
  return path.replace(/^packages\/([^/]+)\/dist\/.*$/u, 'packages/$1/src/index.ts');
}

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }).split('\0').filter(Boolean);

/** Tracked files plus new files not yet added and not ignored, as `pnpm check:pr` selects local changes.
 * Generated output is ignored, so it never becomes part of the graph. */
export function repositoryFiles(root: string): string[] {
  return [...new Set([...git(root, 'ls-files', '-z'), ...git(root, 'ls-files', '-z', '--others', '--exclude-standard')])].sort();
}

const CRUISED_SOURCE = /\.(?:[cm]?[jt]s|tsx)$/u;
const EXCLUDED = EXCLUDE_PATHS.map(pattern => new RegExp(pattern, 'u'));

export class IncompleteGraphError extends Error {}

/** Every repository source file the cruise should have read. A file missing from disk (a sparse or partial
 * checkout) or from the cruise would silently drop its imports, and the check would report "better". */
export function missingSources(expected: readonly string[], cruised: ReadonlySet<string>, exists: (path: string) => boolean): string[] {
  return expected.filter(path => CRUISED_SOURCE.test(path) && !EXCLUDED.some(pattern => pattern.test(path)) && (!exists(path) || !cruised.has(path)));
}

function readJson(root: string, path: string): unknown { return JSON.parse(readFileSync(resolve(root, path), 'utf8')); }

export function resolveContext(root: string, tracked: ReadonlySet<string>): ResolveContext {
  const manifests = new Map<string, unknown>();
  for (const path of tracked) if (/^(packages|labs\/nebula\/packages)\/[^/]+\/package\.json$/u.test(path)) manifests.set(path, readJson(root, path));
  const rootManifest = requireRecord(readJson(root, 'package.json'), 'package.json');
  return { tracked, workspaces: workspacePackages(manifests), imports: isRecord(rootManifest.imports) ? rootManifest.imports : {} };
}

export interface BuildOptions {
  /** Read every file for line counts, entry hints and imported symbol names (`arch:map`). */
  readonly details: boolean;
}

export async function buildImportGraph(root: string, options: BuildOptions): Promise<ImportGraph> {
  const trackedList = repositoryFiles(root), tracked = new Set(trackedList);
  const context = resolveContext(root, tracked);
  const roots = [...CRUISE_ROOTS.filter(path => trackedList.some(file => file.startsWith(`${path}/`))),
    ...trackedList.filter(path => ROOT_CONFIG_FILE.test(path))];
  const result = await cruise(roots, { ...CRUISE_OPTIONS, baseDir: root }, {}, { tsConfig: extractTSConfig(resolve(root, 'tsconfig.json')) });
  if (typeof result.output === 'string') throw new TypeError('dependency-cruiser returned text; expected its result object.');
  const modules = decodeCruiseResult(result.output);
  const missing = missingSources(trackedList.filter(path => roots.some(top => path === top || path.startsWith(`${top}/`))),
    new Set(modules.map(module => module.source)), path => existsSync(resolve(root, path)));
  if (missing.length) {
    throw new IncompleteGraphError(`The import graph is incomplete: ${missing.length} source files are missing from disk or were not read, for example `
      + `${missing.slice(0, 5).join(', ')}. Run the check in a full checkout.`);
  }

  const files = new Map<string, FileFacts>(), edges: ImportEdge[] = [];
  const scripts = JSON.stringify(requireRecord(readJson(root, 'package.json'), 'package.json').scripts ?? {});
  const facts = (path: string): FileFacts => {
    const test = isTestPath(path);
    if (!options.details) return { test, script: false, entryHint: false, loc: 0 };
    const text = readFileSync(resolve(root, path), 'utf8');
    return {
      test,
      script: scripts.includes(path) || scripts.includes(path.replace(/\.mts$/u, '')),
      entryHint: /process\.argv|import\.meta\.(main|url\s*===)|isMainModule|isDirectRun/u.test(text),
      loc: text.split('\n').length,
    };
  };
  const symbolsOf = (path: string, text: () => string) => {
    if (!options.details || /\.(json|css|astro)$/u.test(path)) return [];
    try { return moduleSpecifiers(text(), path); } catch { return []; }
  };

  for (const module of modules) {
    if (module.coreModule || module.couldNotResolve || !tracked.has(module.source)) continue;
    files.set(module.source, facts(module.source));
    const parsed = symbolsOf(module.source, () => readFileSync(resolve(root, module.source), 'utf8'));
    for (const dependency of module.dependencies) {
      if (dependency.coreModule) continue;
      let to: string | undefined;
      if (!dependency.couldNotResolve && !dependency.resolved.includes('node_modules')) {
        const resolved = normalise(dependency.resolved);
        to = trackedStandIn(resolved, tracked) ?? resolved;
      }
      // An unbuilt shared package cannot resolve its `dist/` types; count it as its source entry, as a built one is.
      else if (dependency.couldNotResolve && dependency.module.startsWith('@')) {
        const workspace = context.workspaces.find(item => dependency.module === item.name || dependency.module.startsWith(`${item.name}/`));
        if (workspace?.directory.startsWith('packages/')) to = packageEntry(workspace.directory);
      }
      if (to === undefined) continue;
      const hits = parsed.filter(item => item.specifier === dependency.module);
      edges.push({ from: module.source, to, test: isTestPath(module.source),
        symbols: [...new Set(hits.flatMap(hit => hit.symbols))], typeOnly: hits.length > 0 && hits.every(hit => hit.typeOnly) });
    }
  }

  for (const path of trackedList) {
    if (!path.endsWith('.astro') || !CRUISE_ROOTS.some(top => path.startsWith(`${top}/`))) continue;
    files.set(path, facts(path));
    for (const found of astroSpecifiers(readFileSync(resolve(root, path), 'utf8'), path)) {
      const to = resolveSpecifier(path, found.specifier, context);
      if (to !== undefined) edges.push({ from: path, to, test: isTestPath(path), symbols: found.symbols, typeOnly: found.typeOnly });
    }
  }
  return { files, edges: edges.filter(edge => files.has(edge.to)) };
}
