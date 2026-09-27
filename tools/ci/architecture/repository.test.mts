/** The import graph of this repository itself: every workspace import becomes an edge, and `.astro` files
 * resolve exactly as dependency-cruiser resolves the same specifiers. Needs the checkout the check needs. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { astroSpecifiers, moduleSpecifiers } from './astro-imports.mts';
import { CRUISE_ROOTS, ROOT_CONFIG_FILE } from './cruiser-config.mts';
import { ASTRO_SOURCE, buildImportGraph, CRUISED_SOURCE, cruiseRepository, EXCLUDED, readWorkspaces, repositoryFiles } from './graph.mts';
import { createResolver } from './resolver.mts';
import { workspaceOf } from './workspaces.mts';

const root = realpathSync(resolve(import.meta.dirname, '../../..'));
const files = repositoryFiles(root);
const sources = files.filter(path => (CRUISE_ROOTS.some(top => path.startsWith(`${top}/`)) || ROOT_CONFIG_FILE.test(path))
  && (CRUISED_SOURCE.test(path) || ASTRO_SOURCE(path)) && !EXCLUDED.some(pattern => pattern.test(path)) && existsSync(resolve(root, path)));

test('every @cssearth/* import in the repository is an edge into its package', async () => {
  const graph = await buildImportGraph(root, { details: false });
  const workspaces = readWorkspaces(root, new Set(files));
  const edges = new Map<string, string[]>();
  for (const edge of graph.edges) (edges.get(edge.from) ?? edges.set(edge.from, []).get(edge.from)!).push(edge.to);
  const missing: string[] = [];
  let checked = 0;
  for (const path of sources) {
    const text = readFileSync(resolve(root, path), 'utf8');
    const specifiers = path.endsWith('.astro') ? astroSpecifiers(text, path) : moduleSpecifiers(text, path);
    for (const { specifier } of specifiers) {
      if (!specifier.startsWith('@cssearth/')) continue;
      checked++;
      const workspace = workspaceOf(specifier, workspaces);
      if (!workspace || !(edges.get(path) ?? []).some(to => to.startsWith(`${workspace.directory}/`))) missing.push(`${path}: ${specifier}`);
    }
  }
  assert.ok(checked > 1000, `expected the repository's workspace imports, found ${checked}`);
  assert.deepEqual(missing, [], `${missing.length} of ${checked} @cssearth imports have no edge`);
});

test('the .astro resolver agrees with the cruise on the site\'s own imports', async () => {
  const { modules, tsconfigPath, baseUrl } = await cruiseRepository(root, ['site']);
  const resolveImport = createResolver(root, tsconfigPath, baseUrl);
  const differences: string[] = [];
  let compared = 0;
  for (const module of modules) {
    if (module.coreModule || module.couldNotResolve || !module.source.startsWith('site/')) continue;
    for (const dependency of module.dependencies) {
      if (dependency.coreModule) continue;
      compared++;
      const ours = resolveImport(module.source, dependency.module), theirs = dependency.couldNotResolve ? undefined : dependency.resolved;
      if (ours !== theirs) differences.push(`${module.source}: ${dependency.module} -> ${String(ours)}, cruise ${String(theirs)}`);
    }
  }
  assert.ok(compared > 500, `expected the site's imports, found ${compared}`);
  assert.deepEqual(differences, []);
});
