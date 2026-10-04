/** Node-only workspace discovery shared by bootstrap builds and CI. No built imports. */
import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export interface Workspace { name: string; directory: string; dependencies: string[]; manifest: Record<string, unknown> }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected a manifest object');
  return Object.fromEntries(Object.entries(value));
}
export function readWorkspaceGraph(root: string): Workspace[] {
  const yaml = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
  const section = yaml.split(/^packages:\s*$/m)[1]?.split(/^\S/m)[0];
  if (!section) throw new TypeError('Missing workspace packages');
  const patterns = [...section.matchAll(/^\s+-\s+['"]?([^'"\s]+)['"]?\s*$/gm)].map(match => match[1]! + '/package.json');
  if (!patterns.length) throw new TypeError('Missing workspace patterns');
  return [...globSync(patterns, { cwd: root })].sort().map(path => {
    const manifest = record(JSON.parse(readFileSync(resolve(root, path), 'utf8')));
    if (typeof manifest.name !== 'string') throw new TypeError(path + ': missing name');
    const dependencies = ['dependencies', 'devDependencies'].flatMap(key => Object.entries(record(manifest[key] ?? {}))
      .filter(([name, version]) => name.startsWith('@cssearth/') && version === 'workspace:*').map(([name]) => name));
    return { name: manifest.name, directory: path.replace(/\/package.json$/, ''), dependencies: [...new Set(dependencies)], manifest };
  });
}
export function workspaceOrder(packages: readonly Workspace[], names = packages.map(pkg => pkg.name)): Workspace[] {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  if (byName.size !== packages.length) throw new TypeError('Duplicate workspace name');
  const visiting = new Set<string>(), visited = new Set<string>(), ordered: Workspace[] = [];
  function visit(name: string) {
    if (visiting.has(name)) throw new TypeError('Workspace cycle at ' + name);
    if (visited.has(name)) return;
    const pkg = byName.get(name);
    if (!pkg) throw new TypeError('Missing workspace ' + name);
    visiting.add(name);
    for (const dependency of pkg.dependencies.slice().sort()) visit(dependency);
    visiting.delete(name); visited.add(name); ordered.push(pkg);
  }
  for (const name of names.slice().sort()) visit(name);
  return ordered;
}
/** Source-exporting packages must be bundled; built packages stay external, including transitive dependencies. */
export function workspaceExternals(packages: readonly Workspace[], owner: string): string[] {
  function built(value: unknown): boolean {
    return typeof value === 'string' ? value.includes('/dist/') && /\.[cm]?js$/.test(value)
      : !!value && typeof value === 'object' && Object.values(value).some(built);
  }
  return workspaceOrder(packages, [owner]).filter(pkg => pkg.name !== owner && built(pkg.manifest.exports ?? pkg.manifest.module)).map(pkg => pkg.name);
}
export function hasBuild(pkg: Workspace): boolean { return typeof record(pkg.manifest.scripts ?? {}).build === 'string'; }
export function buildOutput(pkg: Workspace): string {
  function target(value: unknown): string | undefined {
    if (typeof value === 'string' && value.startsWith('./dist/') && /\.[cm]?js$/u.test(value)) return value;
    if (value && typeof value === 'object') for (const child of [...['import', 'default', 'module', 'node'].map(key => Reflect.get(value, key)), ...Object.entries(value).filter(([key]) => key !== 'types').map(([, child]) => child)]) { const found = target(child); if (found) return found; }
    return undefined;
  }
  const output = target(pkg.manifest.module) ?? target(pkg.manifest.exports) ?? target(pkg.manifest.main);
  if (!output) throw new TypeError(pkg.name + ': build has no dist output');
  return pkg.directory + '/' + output.slice(2);
}
/** Decide per export: a package can expose built JavaScript and source-only adapters together. */
export function externalWorkspaceSpecifier(packages: readonly Workspace[], externals: readonly string[], specifier: string): boolean {
  const pkg = packages.find(pkg => specifier === pkg.name || specifier.startsWith(pkg.name + '/'));
  if (!pkg || !externals.includes(pkg.name)) return false;
  const key = specifier === pkg.name ? '.' : '.' + specifier.slice(pkg.name.length);
  const exports = pkg.manifest.exports;
  let entry: unknown = exports;
  if (exports && typeof exports === 'object' && Object.keys(exports).some(key => key.startsWith('.'))) {
    entry = Reflect.get(exports, key);
    if (entry === undefined) {
      const pattern = Object.keys(exports).filter(pattern => pattern.includes('*') && key.startsWith(pattern.split('*')[0]!) && key.endsWith(pattern.split('*')[1]!))
        .sort((a, b) => b.indexOf('*') - a.indexOf('*'))[0];
      if (pattern) entry = Reflect.get(exports, pattern);
    }
  }
  function runtimeTarget(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return undefined;
    for (const condition of ['node', 'import', 'default']) {
      const target = runtimeTarget(Reflect.get(value, condition)); if (target) return target;
    }
    return undefined;
  }
  const target = runtimeTarget(entry) ?? (exports === undefined && typeof pkg.manifest.module === 'string' ? pkg.manifest.module : undefined);
  return target !== undefined && /\.[cm]?js$/.test(target);
}

/** The checkout root from this module's own location, not the caller's working directory: the first parent holding
 * `pnpm-workspace.yaml`, as a real path so a symlinked checkout resolves to one root. Bootstrap builds run before any package
 * is built, so this cannot import `@cssearth/core`'s `projectRoot` (A159). */
export function findWorkspaceRoot(from: string = import.meta.dirname): string {
  for (let directory = realpathSync(from); ; directory = dirname(directory)) {
    if (existsSync(resolve(directory, 'pnpm-workspace.yaml'))) return directory;
    if (dirname(directory) === directory) throw new TypeError(`No pnpm-workspace.yaml above ${from}`);
  }
}
