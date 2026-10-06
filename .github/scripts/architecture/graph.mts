/** The file-level import graph: dependency-cruiser's resolved imports, restricted to repository files
 * (tracked, or new and not ignored), plus the `.astro` imports it cannot read. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { cruise } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { astroSpecifiers, moduleSpecifiers } from './astro-imports.mts';
import { CRUISE_OPTIONS, CRUISE_ROOTS, EXCLUDE_PATHS, ROOT_CONFIG_FILE } from './cruiser-config.mts';
import { createResolver } from './resolver.mts';
import { builtSource, workspaceOf, workspacePackages, workspaceSource, type ManifestSource, type WorkspacePackage } from './workspaces.mts';
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
export interface ImportGraph { readonly files: ReadonlyMap<string, FileFacts>; readonly edges: readonly ImportEdge[]; readonly resolution?: { readonly tsconfigPath: string; readonly baseUrl: string | undefined; readonly modules: readonly CruisedModule[] } }

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

/** A generated module (untracked) is counted as its tracked declaration, so the graph is the same whether or
 * not the checkout has run its preparation steps: `site/prepared/prepared-shell-titles.mjs` becomes `….d.mts`. */
export function trackedStandIn(path: string, tracked: ReadonlySet<string>): string | undefined {
  if (tracked.has(path)) return path;
  const match = /^(.*)\.([cm]?)[jt]s$/u.exec(path);
  if (!match) return undefined;
  const declaration = `${match[1]}.d.${match[2]}ts`;
  return tracked.has(declaration) ? declaration : undefined;
}

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }).split('\0').filter(Boolean);

/** Tracked files plus new files not yet added and not ignored, as `pnpm check:pr` selects local changes.
 * Generated output is ignored, so it never becomes part of the graph. */
export function repositoryFiles(root: string): string[] {
  return [...new Set([...git(root, 'ls-files', '-z'), ...git(root, 'ls-files', '-z', '--others', '--exclude-standard')])].sort();
}

export const CRUISED_SOURCE = /\.(?:[cm]?[jt]s|tsx)$/u;
export const EXCLUDED = EXCLUDE_PATHS.map(pattern => new RegExp(pattern, 'u'));

export class IncompleteGraphError extends Error {}
/** A workspace import the graph cannot place: it would otherwise vanish, and the check would under-report. */
export class UnresolvedImportError extends IncompleteGraphError {}

/** Every repository source file the cruise should have read. A file missing from disk (a sparse or partial
 * checkout) or from the cruise would silently drop its imports, and the check would report "better". */
export function missingSources(expected: readonly string[], cruised: ReadonlySet<string>, exists: (path: string) => boolean): string[] {
  return expected.filter(path => CRUISED_SOURCE.test(path) && !EXCLUDED.some(pattern => pattern.test(path)) && (!exists(path) || !cruised.has(path)));
}

function readJson(root: string, path: string): unknown { return JSON.parse(readFileSync(resolve(root, path), 'utf8')); }

const MANIFEST = /^(packages|labs\/nebula\/packages)\/[^/]+\/package\.json$/u;

/** Workspace packages with their exports and tsup entries, from the repository's manifests. */
export function readWorkspaces(root: string, tracked: ReadonlySet<string>): WorkspacePackage[] {
  const sources = new Map<string, ManifestSource>();
  for (const path of [...tracked].filter(item => MANIFEST.test(item)).sort()) {
    const tsup = path.replace(/package\.json$/u, 'tsup.config.ts');
    sources.set(path, { manifest: readJson(root, path), ...tracked.has(tsup) ? { tsup: readFileSync(resolve(root, tsup), 'utf8') } : {} });
  }
  return workspacePackages(sources);
}

/** Why one import could not become an edge although it names a workspace package. */
export interface Unresolved { readonly from: string; readonly specifier: string; readonly reason: string }

/** Where one resolved (or unresolved) import points, as a repository file. Compiled `dist/` output counts as
 * the source tsup builds it from; an unbuilt workspace package resolves through its exports the same way.
 * A workspace import that cannot be placed is recorded in `unresolved`, never dropped. */
export function importTarget(from: string, specifier: string, resolved: string | undefined, workspaces: readonly WorkspacePackage[],
  tracked: ReadonlySet<string>, unresolved: Unresolved[]): string | undefined {
  if (resolved !== undefined && !resolved.split('/').includes('node_modules')) {
    const built = builtSource(resolved, workspaces);
    if (built === undefined) return trackedStandIn(resolved, tracked) ?? resolved;
    if ('source' in built) return built.source;
    unresolved.push({ from, specifier, reason: built.error });
    return undefined;
  }
  const workspace = workspaceOf(specifier.replace(/[?#].*$/u, ''), workspaces);
  if (workspace) {
    const found = workspaceSource(specifier.replace(/[?#].*$/u, ''), workspace, workspaces, tracked);
    if ('source' in found) return found.source;
    unresolved.push({ from, specifier, reason: found.error });
  } else if (specifier.startsWith('@cssearth/')) unresolved.push({ from, specifier, reason: 'no workspace package has this name' });
  return undefined;
}

/** Edge targets inside a workspace package that did not become graph files. A generated file the repository
 * ignores (`packages/astronomy/src/data/generated/*`) is not part of the graph, like any other ignored output;
 * anything else there means the graph lost an import. */
export function lostPackageTargets(edges: readonly ImportEdge[], files: ReadonlyMap<string, FileFacts>, workspaces: readonly WorkspacePackage[],
  isIgnored: (path: string) => boolean): Unresolved[] {
  return edges.filter(edge => !files.has(edge.to) && workspaces.some(item => edge.to.startsWith(`${item.directory}/`)) && !isIgnored(edge.to))
    .map(edge => ({ from: edge.from, specifier: edge.to, reason: `${edge.to} is not a file of the import graph` }));
}

/** Paths git ignores, among those given (`git check-ignore`, which exits 1 when none is). */
function ignoredPaths(root: string, paths: readonly string[]): Set<string> {
  if (!paths.length) return new Set();
  const run = spawnSync('git', ['check-ignore', '-z', '--stdin'], { cwd: root, input: paths.join('\0'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0 && run.status !== 1) throw new Error(`git check-ignore failed: ${run.stderr}`);
  return new Set(run.stdout.split('\0').filter(Boolean));
}

export interface BuildOptions {
  /** Read every file for line counts, entry hints and imported symbol names (`arch:map`). */
  readonly details: boolean;
}

/** The cruise of `roots` with the repository's tsconfig, validated. `root` must be a real path. */
export async function cruiseRepository(root: string, roots: readonly string[]) {
  const tsconfigPath = resolve(root, 'tsconfig.json'), tsconfig = extractTSConfig(tsconfigPath);
  // dependency-cruiser gives a tsconfig without `baseUrl` the working directory as its base, so cruise from the root.
  const previous = process.cwd();
  process.chdir(root);
  let result: Awaited<ReturnType<typeof cruise>>;
  try {
    result = await cruise([...roots], { ...CRUISE_OPTIONS, tsConfig: { fileName: tsconfigPath }, baseDir: root }, {}, { tsConfig: tsconfig });
  } finally { process.chdir(previous); }
  if (typeof result.output === 'string') throw new TypeError('dependency-cruiser returned text; expected its result object.');
  return { modules: decodeCruiseResult(result.output), tsconfigPath, baseUrl: tsconfig.options.baseUrl };
}

export const ASTRO_SOURCE = (path: string) => path.endsWith('.astro') && CRUISE_ROOTS.some(top => path.startsWith(`${top}/`));

export async function buildImportGraph(checkout: string, options: BuildOptions): Promise<ImportGraph> {
  // The cruise reports symlinked packages by their real path, so the root must be real too.
  const root = realpathSync(checkout);
  const trackedList = repositoryFiles(root), tracked = new Set(trackedList);
  const workspaces = readWorkspaces(root, tracked);
  const roots = [...CRUISE_ROOTS.filter(path => trackedList.some(file => file.startsWith(`${path}/`))),
    ...trackedList.filter(path => ROOT_CONFIG_FILE.test(path))];
  const { modules, tsconfigPath, baseUrl } = await cruiseRepository(root, roots);
  const inRoots = trackedList.filter(path => roots.some(top => path === top || path.startsWith(`${top}/`)));
  const missing = [
    ...missingSources(inRoots, new Set(modules.map(module => module.source)), path => existsSync(resolve(root, path))),
    // Astro components are read directly rather than cruised: a sparse checkout may leave them out too.
    ...inRoots.filter(path => ASTRO_SOURCE(path) && !existsSync(resolve(root, path))),
  ];
  if (missing.length) {
    throw new IncompleteGraphError(`The import graph is incomplete: ${missing.length} source files are missing from disk or were not read, for example `
      + `${missing.slice(0, 5).join(', ')}. Run the check in a full checkout.`);
  }

  const files = new Map<string, FileFacts>(), edges: ImportEdge[] = [], unresolved: Unresolved[] = [];
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
      const to = importTarget(module.source, dependency.module, dependency.couldNotResolve ? undefined : dependency.resolved, workspaces, tracked, unresolved);
      if (to === undefined) continue;
      const hits = parsed.filter(item => item.specifier === dependency.module);
      edges.push({ from: module.source, to, test: isTestPath(module.source),
        symbols: [...new Set(hits.flatMap(hit => hit.symbols))], typeOnly: hits.length > 0 && hits.every(hit => hit.typeOnly) });
    }
  }

  const resolveImport = createResolver(root, tsconfigPath, baseUrl);
  for (const path of trackedList) {
    if (!ASTRO_SOURCE(path)) continue;
    files.set(path, facts(path));
    for (const found of astroSpecifiers(readFileSync(resolve(root, path), 'utf8'), path)) {
      const to = importTarget(path, found.specifier, resolveImport(path, found.specifier), workspaces, tracked, unresolved);
      if (to !== undefined) edges.push({ from: path, to, test: isTestPath(path), symbols: found.symbols, typeOnly: found.typeOnly });
    }
  }

  // A stylesheet or data file only an Astro component imports was never cruised; it is still a repository file.
  for (const edge of edges) if (!files.has(edge.to) && tracked.has(edge.to) && existsSync(resolve(root, edge.to))) files.set(edge.to, facts(edge.to));
  const candidates = edges.filter(edge => !files.has(edge.to) && workspaces.some(item => edge.to.startsWith(`${item.directory}/`))).map(edge => edge.to);
  const ignored = ignoredPaths(root, [...new Set(candidates)]);
  unresolved.push(...lostPackageTargets(edges, files, workspaces, path => ignored.has(path)));
  if (unresolved.length) {
    throw new UnresolvedImportError(`${unresolved.length} imports of workspace packages did not become edges, for example:\n`
      + unresolved.slice(0, 5).map(item => `  ${item.from}: ${item.specifier} (${item.reason})`).join('\n')
      + '\nFix the package exports or its tsup entries, or teach .github/scripts/architecture/workspaces.mts the new form.');
  }
  return { files, edges: edges.filter(edge => files.has(edge.to)), resolution: { tsconfigPath, baseUrl, modules } };
}
