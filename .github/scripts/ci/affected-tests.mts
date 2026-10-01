/** Which tests a change can break: the workspace packages it touched and every package that depends on one, and the
 * site when it, or a package it imports, changed. A push to main, or a change to shared configuration, tests everything.
 *
 *   node .github/scripts/ci/affected-tests.mts <base ref>    append test_packages and test_site to $GITHUB_OUTPUT
 *   node .github/scripts/ci/affected-tests.mts               (no base: a push) test everything */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Workspace { readonly directory: string; readonly name: string; readonly dependencies: readonly string[]; }
export interface AffectedTests { readonly packages: 'all' | readonly string[]; readonly site: boolean; readonly files: readonly string[]; }

/** Tests that live in an offline tool but exercise another package: they ran on every change to that package until the
 * renderer's tests that import the bake moved into the bake, which the dependent walk below does not follow (a tool joins
 * only when a tool changed). Each runs whenever its owner, or a package the owner depends on, changed. `affected-tests.test.mts`
 * proves every entry exists and imports its owner. */
export const FOREIGN_TESTS: Readonly<Record<string, readonly string[]>> = {
  renderer: [
    'packages/bake/src/contract/feature-fixture.test.mts',
    'packages/bake/src/contract/object-runtime.test.mts',
    'packages/bake/src/contract/object-selection-runtime.test.mts',
    'packages/bake/src/contract/prepared-material.test.mts',
    'packages/bake/src/contract/renderer-navigable-object-mount.test.ts',
    'packages/bake/src/objects/layers/paged-ellipsoid/renderer-surface-target.test.ts',
    'packages/bake/src/presentation/renderer-depth-partitions.test.ts',
    'packages/bake/src/sky/renderer-parallax.test.ts',
    'packages/bake/src/stars/renderer-point-field-bank.test.ts',
    'packages/bake/src/stars/renderer-validation.test.ts',
    'packages/bake/src/volume-leaves/renderer-prepared-leaf-frustum.test.ts',
    'packages/bake/src/volume-leaves/renderer-prepared-volume-runtime.test.ts',
  ],
};

const SHARED = [/^package\.json$/u, /^pnpm-lock\.yaml$/u, /^pnpm-workspace\.yaml$/u, /^tsconfig[^/]*\.json$/u, /^\.github\/workflows\//u];
/** The offline preparation and archive tools. Nearly every change touches a package they import (the renderer), so a
 * tool joins only when it, or another tool it imports, changed; a push to main tests them whatever changed. */
const TOOLS = new Set(['bake', 'telescope-cli']);
const SITE = [/^site\//u, /^src\//u, /^integration\//u, /^\.github\//u, /^labs\/performance\//u];

export function affectedTests(paths: readonly string[] | null, packages: readonly Workspace[], siteDependencies: readonly string[]): AffectedTests {
  if (paths === null || paths.some(path => SHARED.some(pattern => pattern.test(path)))) return { packages: 'all', site: true, files: [] };
  const changed = new Set(paths.flatMap(path => /^packages\/([^/]+)\//u.exec(path)?.[1] ?? []));
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
  const files = Object.entries(FOREIGN_TESTS).filter(([owner]) => changed.has(owner))
    .flatMap(([, tests]) => tests).filter(test => !changed.has(/^packages\/([^/]+)\//u.exec(test)?.[1] ?? '')).sort();
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
  const paths = base ? execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean) : null;
  const result = affectedTests(paths, packages, workspaceDependencies(read('package.json')));
  const testPackages = result.packages === 'all' ? 'all' : result.packages.join(' ');
  const testFiles = result.files.join(' ');
  console.log(`Packages to test: ${testPackages || '(none)'}; extra files: ${testFiles || '(none)'}; site: ${result.site}.`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `test_packages=${testPackages}\ntest_files=${testFiles}\ntest_site=${result.site}\n`);
}
