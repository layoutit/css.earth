/** Manifest dependency cycles are separate from file imports: dev and peer dependencies also constrain
 * workspace build/install ordering. Record every directed elementary cycle, rotated to its smallest
 * name. Every cycle fails the architecture check without a baseline. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { byText } from '../zones.mts';

export interface PackageCycle { readonly nodes: readonly string[] }
const MANIFEST = /^packages\/[^/]+\/package\.json$/u;

export function packageCycles(root: string, files: readonly string[]): PackageCycle[] {
  const packages = files.filter(path => MANIFEST.test(path)).map(path => {
    const manifest = requireRecord(JSON.parse(readFileSync(resolve(root, path), 'utf8')), path);
    const name = requireString(manifest.name, `${path} name`);
    const dependencies = ['dependencies', 'devDependencies', 'peerDependencies'].flatMap(field =>
      manifest[field] === undefined ? [] : Object.keys(requireRecord(manifest[field], `${path} ${field}`)));
    return { name, dependencies };
  }).filter(pkg => pkg.name.startsWith('@cssearth/'));
  const names = packages.map(pkg => pkg.name).sort(byText), known = new Set(names);
  if (known.size !== names.length) throw new TypeError('Workspace package names must be unique.');
  const next = new Map(packages.map(pkg => [pkg.name, [...new Set(pkg.dependencies.filter(name => known.has(name)))].sort(byText)]));
  const cycles: PackageCycle[] = [];
  // Start only at the smallest member of each cycle: no duplicate rotations. Direction is preserved.
  for (const start of names) {
    const path = [start], visited = new Set(path);
    const visit = (from: string): void => {
      for (const to of next.get(from) ?? []) {
        if (to === start) cycles.push({ nodes: [...path] });
        else if (byText(to, start) > 0 && !visited.has(to)) {
          path.push(to); visited.add(to); visit(to); visited.delete(to); path.pop();
        }
      }
    };
    visit(start);
  }
  return cycles.sort((a, b) => byText(JSON.stringify(a.nodes), JSON.stringify(b.nodes)));
}

export const packageCycleText = (cycle: PackageCycle): string => [...cycle.nodes, cycle.nodes[0]].join(' -> ');

/** Findings retain the directed cycle message; none can be baselined. */
export function checkPackageCycles(root: string, files: readonly string[]): string[] {
  return packageCycles(root, files).map(cycle => `workspace package cycle: ${packageCycleText(cycle)}`);
}
