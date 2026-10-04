import { testLaneFiles } from '../../../packages/core/src/node/script-test-files.ts';
export { testLaneFiles } from '../../../packages/core/src/node/script-test-files.ts';
/** Which tests a change can break: the workspace packages it touched and every package that depends on one, and the
 * site when it, or a package it imports, changed. A push to main, or a change to shared configuration, tests everything.
 *
 *   node .github/scripts/ci/affected-tests.mts <base ref>    append test_packages and test_site to $GITHUB_OUTPUT
 *   node .github/scripts/ci/affected-tests.mts               (no base: a push) test everything */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Workspace { readonly directory: string; readonly name: string; readonly dependencies: readonly string[]; }
export interface AffectedTests { readonly packages: 'all' | readonly string[]; readonly site: boolean; readonly files: readonly string[]; }

/** Discover cross-owner coverage from the collected tests rather than maintaining a second path list.
 * Looking for package-name strings conservatively includes static and dynamic imports in each collected test. */
export function testOwners(root: string): ReadonlyMap<string, readonly string[]> {
  return new Map(testLaneFiles(root, JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as unknown, ['test:packages', 'test:site']).packages.map(file => {
    const text = readFileSync(resolve(root, file), 'utf8');
    return [file, [...new Set([...text.matchAll(/['"`]@cssearth\/([^/'"`]+)(?:[/'"`])/gu)].map(match => match[1]!))]];
  }));
}

const SHARED = [/^package\.json$/u, /^pnpm-lock\.yaml$/u, /^pnpm-workspace\.yaml$/u, /^tsconfig[^/]*\.json$/u, /^\.github\/workflows\//u];
/** The offline preparation and archive tools. Many changes touch a package they import, so a
 * tool joins only when it, or another tool it imports, changed; a push to main tests them whatever changed. */
const TOOLS = new Set(['bake', 'telescope-cli']);
/** A tool test that pins another package's frozen fixture reads it through a `<package>/test/` path; editing that fixture
 * selects the pinning test, so the producer check runs on the pull request, not only after the merge. */
export function readsChangedFixture(text: string, paths: readonly string[]): boolean {
  return paths.some(path => {
    const match = /^packages\/([^/]+)\/test\/(?:.+\/)?([^/]+)$/u.exec(path);
    return match !== null && text.includes(`${match[1]}/test/`) && text.includes(match[2]!);
  });
}
const SITE = [/^site\//u, /^src\//u, /^integration\//u, /^\.github\//u, /^labs\/performance\//u];

/** Derive source pins from repository-path literals read by tests, including module-relative URLs. */
export function pinnedSourceOwners(root: string, owners: ReadonlyMap<string, readonly string[]>): ReadonlyMap<string, readonly string[]> {
  const pins = new Map<string, string[]>();
  for (const test of owners.keys()) {
    if (!test.startsWith('packages/')) continue;
    const owner = test.split('/')[1]!;
    const text = readFileSync(resolve(root, test), 'utf8');
    const literals = [...text.matchAll(/['"]([^'"\n]+)['"]/gu)].map(match => match[1]!);
    const directories = literals.filter(value => value.endsWith('/')).flatMap(value => [resolve(root, value), resolve(root, dirname(test), value)]);
    for (const value of literals.filter(value => /\.(?:py|[cm]?ts)$/u.test(value))) {
      for (const candidate of [resolve(root, value), resolve(root, dirname(test), value), ...directories.map(directory => resolve(directory, value))]) {
        const path = relative(root, candidate);
        if (!path.startsWith('../') && existsSync(candidate)) pins.set(path, [...new Set([...(pins.get(path) ?? []), owner])]);
      }
    }
  }
  return pins;
}
export const TOOL_OBJECT_TEST_LIMIT = 150;
let repositoryPins: ReadonlyMap<string, readonly string[]> | undefined;
function defaultPins(): ReadonlyMap<string, readonly string[]> {
  const root = resolve(import.meta.dirname, '../../..');
  return repositoryPins ??= pinnedSourceOwners(root, testOwners(root));
}

export function affectedTests(paths: readonly string[] | null, packages: readonly Workspace[], siteDependencies: readonly string[], owners: ReadonlyMap<string, readonly string[]> = testOwners(resolve(import.meta.dirname, '../../..')), pins: ReadonlyMap<string, readonly string[]> = defaultPins()): AffectedTests {
  if (paths === null || paths.some(path => SHARED.some(pattern => pattern.test(path)))) return { packages: 'all', site: true, files: [] };
  const changed = new Set(paths.flatMap(path => /^packages\/([^/]+)\//u.exec(path)?.[1] ?? pins.get(path) ?? []));
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
  const fixtureReaders = new Map<string, string>(paths.some(path => /^packages\/[^/]+\/test\//u.test(path))
    ? [...owners.keys()].filter(test => TOOLS.has(/^packages\/([^/]+)\//u.exec(test)?.[1] ?? '')).map(test => [test, readFileSync(resolve(import.meta.dirname, '../../..', test), 'utf8')] as const)
    : []);
  const toolObjectCount = [...owners].filter(([file, imports]) => TOOLS.has(file.split('/')[1] ?? '') && imports.includes('objects')).length;
  const files = [...owners].filter(([test, imports]) => !changed.has(/^packages\/([^/]+)\//u.exec(test)?.[1] ?? '')
    && (!TOOLS.has(/^packages\/([^/]+)\//u.exec(test)?.[1] ?? '')
      ? imports.some(owner => changed.has(owner)) || paths.includes(test)
      : (changed.has('objects') && toolObjectCount <= TOOL_OBJECT_TEST_LIMIT && imports.includes('objects'))
        || (fixtureReaders.has(test) && readsChangedFixture(fixtureReaders.get(test)!, paths)))).map(([test]) => test).sort();
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
