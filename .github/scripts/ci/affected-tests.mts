/** Which tests a change can break: the workspace packages it touched and every package that depends on one, and the
 * site when it, or a package it imports, changed. A push to main, or a change to shared configuration, tests everything.
 *
 *   node .github/scripts/ci/affected-tests.mts <base ref>    append test_packages and test_site to $GITHUB_OUTPUT
 *   node .github/scripts/ci/affected-tests.mts               (no base: a push) test everything */
import { execFileSync } from 'node:child_process';
import { appendFileSync, globSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Workspace { readonly directory: string; readonly name: string; readonly dependencies: readonly string[]; }
export interface AffectedTests { readonly packages: 'all' | readonly string[]; readonly site: boolean; readonly files: readonly string[]; }

/** The root scripts are the only lane map. Use their quoted Node test globs for collection and affected routing. */
export function testLaneFiles(root: string): Readonly<Record<'packages' | 'site', readonly string[]>> {
  const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !('scripts' in manifest) || !manifest.scripts || typeof manifest.scripts !== 'object')
    throw new TypeError('package.json has no scripts');
  const scripts = manifest.scripts;
  const collect = (lane: 'packages' | 'site'): string[] => {
    const script = Reflect.get(scripts, `test:${lane}`);
    if (typeof script !== 'string') throw new TypeError(`package.json has no test:${lane}`);
    const patterns = [...script.matchAll(/"([^"\n]+)"/gu)].map(match => match[1]!);
    if (patterns.length === 0) throw new TypeError(`test:${lane} has no test globs`);
    return [...new Set(patterns.flatMap(pattern => globSync(pattern, { cwd: root })))].sort();
  };
  return { packages: collect('packages'), site: collect('site') };
}

/** Discover cross-owner coverage from the collected tests rather than maintaining a second path list.
 * Looking for package-name strings conservatively includes static and dynamic imports in each collected test. */
export function testOwners(root: string): ReadonlyMap<string, readonly string[]> {
  return new Map(testLaneFiles(root).packages.map(file => {
    const text = readFileSync(resolve(root, file), 'utf8');
    return [file, [...new Set([...text.matchAll(/['"`]@cssearth\/([^/'"`]+)(?:[/'"`])/gu)].map(match => match[1]!))]];
  }));
}

const SHARED = [/^package\.json$/u, /^pnpm-lock\.yaml$/u, /^pnpm-workspace\.yaml$/u, /^tsconfig[^/]*\.json$/u, /^\.github\/workflows\//u];
/** The offline preparation and archive tools. Many changes touch a package they import, so a
 * tool joins only when it, or another tool it imports, changed; a push to main tests them whatever changed. */
const TOOLS = new Set(['bake', 'telescope-cli']);
// This producer contract was explicitly routed for objects changes before discovery.
const TOOL_FOREIGN_TESTS = new Map([['packages/bake/src/presentation/depth-partition-contract.test.ts', ['objects']]]);
const SITE = [/^site\//u, /^src\//u, /^integration\//u, /^\.github\//u, /^labs\/performance\//u];

/** Sources outside `packages/` whose schema literals a package test pins (see `packages/bake/src/sources/python-schema-identifiers.test.ts`
 * and `shell-grid-schema.test.ts`): a change confined to one of them still selects the package that owns the pin. */
const PINNED_SOURCE_OWNERS: Readonly<Record<string, string>> = Object.freeze({
  '.github/scripts/checks/check-body-references.mts': 'bake',
  'src/objects/heliosphere/source/ibex/extract.py': 'bake',
});

export function affectedTests(paths: readonly string[] | null, packages: readonly Workspace[], siteDependencies: readonly string[], owners: ReadonlyMap<string, readonly string[]> = testOwners(resolve(import.meta.dirname, '../../..'))): AffectedTests {
  if (paths === null || paths.some(path => SHARED.some(pattern => pattern.test(path)))) return { packages: 'all', site: true, files: [] };
  const changed = new Set(paths.flatMap(path => /^packages\/([^/]+)\//u.exec(path)?.[1] ?? PINNED_SOURCE_OWNERS[path] ?? []));
  // Everything that imports a changed package can break with it: walk the dependents until nothing new joins.
  const byName = new Map(packages.map(workspace => [workspace.name, workspace.directory]));
  const joins = (workspace: Workspace) => workspace.dependencies.some(name => {
    const directory = byName.get(name) ?? '';
    return changed.has(directory) && (!TOOLS.has(workspace.directory) || TOOLS.has(directory));
  });
  for (let grew = true; grew;) {
    grew = false;
    for (const workspace of packages) if (!changed.has(workspace.directory) && joins(workspace)) { changed.add(workspace.directory); grew = true; }
  }
  const site = paths.some(path => SITE.some(pattern => pattern.test(path))) || siteDependencies.some(name => changed.has(byName.get(name) ?? ''));
  // A foreign test whose own package already runs is in that package's glob.
  const files = [...owners].filter(([test, imports]) => !changed.has(/^packages\/([^/]+)\//u.exec(test)?.[1] ?? '')
    && (!TOOLS.has(/^packages\/([^/]+)\//u.exec(test)?.[1] ?? '')
      ? imports.some(owner => changed.has(owner)) || paths.includes(test)
      : TOOL_FOREIGN_TESTS.get(test)?.some(owner => changed.has(owner)) === true)).map(([test]) => test).sort();
  return { packages: [...changed].sort(), site, files };
}

function workspaceDependencies(manifest: Record<string, unknown>): string[] {
  return ['dependencies', 'devDependencies', 'peerDependencies'].flatMap(field => Object.keys((manifest[field] ?? {}) as Record<string, unknown>))
    .filter(name => name.startsWith('@cssearth/'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '../../..'), base = process.argv[2];
  const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as Record<string, unknown>;
  const packages = readdirSync(resolve(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const manifest = read(`packages/${entry.name}/package.json`);
    return { directory: entry.name, name: String(manifest.name), dependencies: workspaceDependencies(manifest) };
  });
  const paths = base ? execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }).split('\n').filter(Boolean) : null;
  const result = affectedTests(paths, packages, workspaceDependencies(read('package.json')));
  const testPackages = result.packages === 'all' ? 'all' : result.packages.join(' ');
  const testFiles = result.files.join(' ');
  console.log(`Packages to test: ${testPackages || '(none)'}; extra files: ${testFiles || '(none)'}; site: ${result.site}.`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `test_packages=${testPackages}\ntest_files=${testFiles}\ntest_site=${result.site}\n`);
}
