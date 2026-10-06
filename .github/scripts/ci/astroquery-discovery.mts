/** Dependency-free discovery: classification runs before workspace installation. */
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ASTROQUERY_EXCLUSIONS: Readonly<Record<string, string>> = {
  'packages/telescope-cli/src/delivery/output-handoffs.test.mts': 'Mixed PDS decoding and stellar handoffs require the PDS toolchain and restored stellar-neighbourhood stars.json/stars.bin; remains in the source-qualified CLI lane.',
  'packages/bake/src/objects/raster/healpix-map.test.mts': 'Mixed toolchain and deposited Luhman 16 B maps: requires untracked posterior NPY sources; remains in the source-qualified bake lane.',
};
export function astroqueryTestFiles(root: string): string[] {
  return globSync('packages/**/*.test.{ts,mts}', { cwd: root }).filter(path => {
    const text = readFileSync(resolve(root, path), 'utf8');
    return /import\s*(?:\{[^}]*\bastroqueryToolchain\b[^}]*\})\s*from\s*['"]@cssearth\/telescope\/node['"]/su.test(text);
  }).sort();
}
export function astroqueryLaneFiles(root: string): string[] {
  return astroqueryTestFiles(root).filter(path => !Object.hasOwn(ASTROQUERY_EXCLUSIONS, path));
}
export function astroqueryTriggerPaths(root: string): string[] {
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    visited.add(name);
    const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'packages', name, 'package.json'), 'utf8'));
    if (!manifest || typeof manifest !== 'object') throw new TypeError(`Invalid ${name} package manifest`);
    const dependencies = Reflect.get(manifest, 'dependencies');
    if (dependencies && typeof dependencies === 'object') for (const dependency of Object.keys(dependencies)) {
      if (dependency.startsWith('@cssearth/')) visit(dependency.slice('@cssearth/'.length));
    }
  };
  for (const file of astroqueryLaneFiles(root)) {
    const owner = /^packages\/([^/]+)\//u.exec(file)?.[1];
    if (!owner) throw new Error(`No workspace owner for ${file}`);
    visit(owner);
  }
  return [...new Set([...visited].map(name => `packages/${name}/**`).concat([
    'packages/telescope-cli/**', ...astroqueryTestFiles(root), '.github/workflows/universe.yml',
    '.github/scripts/ci/astroquery-*', '.github/scripts/ci/ci-affected.mts', '.github/ci-areas.json',
  ]))].sort();
}
