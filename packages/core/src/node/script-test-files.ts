/** Collect test files from quoted glob arguments in caller-supplied package scripts. File reading stays with the caller. */
import { globSync } from 'node:fs';

export function scriptTestFiles(root: string, manifest: unknown, names: readonly string[]): ReadonlyMap<string, readonly string[]> {
  if (!manifest || typeof manifest !== 'object' || !('scripts' in manifest) || !manifest.scripts || typeof manifest.scripts !== 'object')
    throw new TypeError('package.json has no scripts');
  const scripts = manifest.scripts;
  return new Map(names.map(name => {
    const script = Reflect.get(scripts, name);
    if (typeof script !== 'string') throw new TypeError(`package.json has no ${name}`);
    const patterns = [...script.matchAll(/"([^"\n]+)"/gu)].map(match => match[1]!);
    if (patterns.length === 0) throw new TypeError(`${name} has no test globs`);
    return [name, [...new Set(patterns.flatMap(pattern => globSync(pattern, { cwd: root })))].sort()];
  }));
}

/** Project callers supply the manifest and lane names; both CI and preparation share this routing. */
export function testLaneFiles(root: string, manifest: unknown, names: readonly [string, string]): Readonly<Record<'packages' | 'site', readonly string[]>> {
  const files = scriptTestFiles(root, manifest, names);
  return { packages: files.get(names[0])!, site: files.get(names[1])! };
}
