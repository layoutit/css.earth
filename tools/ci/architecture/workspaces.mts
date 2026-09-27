/** Workspace packages and the source file behind each public entry.
 *
 * A shared package is imported through its `package.json#exports`, which mostly name compiled `dist/` files. The
 * graph counts such an import as an import of the source that tsup compiles into that file, read from the
 * package's `tsup.config.ts` entry map: `@cssearth/bake/volume/node` -> `dist/volume/node.d.ts` ->
 * `src/volume/node/index.ts`. The same mapping serves an unbuilt checkout, where the `dist/` file does not exist
 * and only the specifier is known. A target the mapping cannot place is reported, never dropped: a silent drop hid
 * every `@cssearth/bake` import once. */
import ts from 'typescript';
import { posix } from 'node:path';
import { isRecord, requireRecord, requireString } from '@cssearth/core';
import { RESOLVE_EXTENSIONS } from './cruiser-config.mts';

export interface WorkspacePackage {
  readonly name: string;
  /** Repository-relative directory, such as `packages/bake`. */
  readonly directory: string;
  /** `package.json#exports` as subpath -> target, `'.'` for the main entry; conditions already chosen. */
  readonly exports: ReadonlyMap<string, string>;
  /** tsup output name (`volume/node`) -> repository-relative source file. */
  readonly builds: ReadonlyMap<string, string>;
}

/** Condition order of the cruise (`cruiser-config.mts`): types first, as TypeScript reads them. */
const CONDITIONS = ['types', 'import', 'require', 'node', 'default'] as const;

function conditionTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return undefined;
  for (const condition of CONDITIONS) {
    const target = conditionTarget(value[condition]);
    if (target !== undefined) return target;
  }
  return undefined;
}

/** `exports` (or `types`/`main` without it) as subpath -> chosen target. */
export function exportTargets(manifest: Record<string, unknown>, label: string): Map<string, string> {
  const targets = new Map<string, string>();
  const value = manifest.exports;
  if (value === undefined) {
    const main = [manifest.types, manifest.module, manifest.main].find(item => typeof item === 'string');
    if (typeof main === 'string') targets.set('.', main);
    return targets;
  }
  if (typeof value === 'string' || (isRecord(value) && !Object.keys(value).some(key => key.startsWith('.')))) {
    const target = conditionTarget(value);
    if (target === undefined) throw new TypeError(`${label} exports has no usable condition.`);
    targets.set('.', target);
    return targets;
  }
  for (const [subpath, entry] of Object.entries(requireRecord(value, `${label} exports`))) {
    const target = conditionTarget(entry);
    if (target === undefined) throw new TypeError(`${label} exports["${subpath}"] has no usable condition.`);
    targets.set(subpath, target);
  }
  return targets;
}

const stripped = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ? stripped(node.expression) : node;

/** A string literal, or `fileURLToPath(new URL('<literal>', import.meta.url))`, as a path relative to the package. */
function entryPath(node: ts.Expression): string | undefined {
  const value = stripped(node);
  if (ts.isStringLiteralLike(value)) return posix.normalize(value.text);
  if (ts.isCallExpression(value) && ts.isIdentifier(value.expression) && value.expression.text === 'fileURLToPath' && value.arguments.length === 1) {
    const url = stripped(value.arguments[0]!);
    if (ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === 'URL' && url.arguments?.length === 2) {
      const [path, base] = url.arguments;
      if (path && ts.isStringLiteralLike(path) && base && base.getText() === 'import.meta.url') return posix.normalize(path.text);
    }
  }
  return undefined;
}

/** tsup's `entry` option read statically: output name -> source path relative to the package. An entry list
 * is named the way tsup names it, by the path below the entries' common directory without its extension. */
export function tsupEntries(text: string, label: string): Map<string, string> {
  const tree = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const variables = new Map<string, ts.Expression>();
  const found: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === 'entry') found.push(node.initializer);
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'entry') found.push(node.name);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (found.length !== 1) throw new TypeError(`${label}: expected one tsup \`entry\` option, found ${found.length}.`);
  let entry = stripped(found[0]!);
  if (ts.isIdentifier(entry)) {
    const initializer = variables.get(entry.text);
    if (!initializer) throw new TypeError(`${label}: tsup entry ${entry.text} is not a local constant.`);
    entry = stripped(initializer);
  }
  const unreadable = (node: ts.Node) => new TypeError(`${label}: cannot read the tsup entry ${node.getText()} statically; use a string or fileURLToPath(new URL('…', import.meta.url)).`);
  const entries = new Map<string, string>();
  if (ts.isArrayLiteralExpression(entry)) {
    const paths = entry.elements.map(element => {
      const path = ts.isExpression(element) ? entryPath(element) : undefined;
      if (path === undefined) throw unreadable(element);
      return path;
    });
    const directories = paths.map(path => posix.dirname(path).split('/'));
    const common: string[] = [];
    for (let index = 0; directories.every(parts => parts[index] !== undefined && parts[index] === directories[0]![index]); index++) common.push(directories[0]![index]!);
    for (const path of paths) entries.set(posix.relative(common.join('/') || '.', path).replace(/\.[cm]?[jt]sx?$/u, ''), path);
  } else if (ts.isObjectLiteralExpression(entry)) {
    for (const property of entry.properties) {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))) throw unreadable(property);
      const path = entryPath(property.initializer);
      if (path === undefined) throw unreadable(property.initializer);
      entries.set(property.name.text, path);
    }
  } else throw unreadable(entry);
  return entries;
}

export interface ManifestSource {
  readonly manifest: unknown;
  /** The package's `tsup.config.ts`, when it has one. */
  readonly tsup?: string;
}

/** Workspace packages from their manifests, keyed by the `package.json` path. */
export function workspacePackages(sources: ReadonlyMap<string, ManifestSource>): WorkspacePackage[] {
  return [...sources].flatMap(([path, { manifest: value, tsup }]) => {
    const manifest = requireRecord(value, path);
    if (manifest.name === undefined) return [];
    const directory = posix.dirname(path);
    const builds = new Map([...tsup === undefined ? [] : tsupEntries(tsup, `${directory}/tsup.config.ts`)]
      .map(([name, source]) => [name, posix.join(directory, source)]));
    return [{ name: requireString(manifest.name, `${path} name`), directory, exports: exportTargets(manifest, path), builds }];
  });
}

export function workspaceOf(specifier: string, workspaces: readonly WorkspacePackage[]): WorkspacePackage | undefined {
  return workspaces.find(item => specifier === item.name || specifier.startsWith(`${item.name}/`));
}

/** TypeScript's rule: a `.js`, `.mjs` or `.cjs` path may name the `.ts`, `.mts` or `.cts` source. */
const SOURCE_FOR_OUTPUT: Readonly<Record<string, readonly string[]>> = { '.js': ['.ts', '.tsx', '.d.ts'], '.mjs': ['.mts', '.d.mts'], '.cjs': ['.cts', '.d.cts'] };

function candidates(base: string): string[] {
  const output = /\.[cm]?js$/u.exec(base)?.[0];
  const sources = output === undefined ? [] : (SOURCE_FOR_OUTPUT[output] ?? []).map(extension => base.slice(0, -output.length) + extension);
  return [base, ...sources, ...RESOLVE_EXTENSIONS.map(extension => base + extension), ...RESOLVE_EXTENSIONS.map(extension => `${base}/index${extension}`)];
}

const OUTPUT_EXTENSION = /(?:\.d)?\.[cm]?[jt]s$/u;

/** A path inside a workspace package's `dist/`: the source tsup compiles into it, or an error naming why not.
 * Returns undefined for any path outside a `dist/`. */
export function builtSource(path: string, workspaces: readonly WorkspacePackage[]): { readonly source: string } | { readonly error: string } | undefined {
  const workspace = workspaces.find(item => path.startsWith(`${item.directory}/dist/`));
  if (!workspace) return undefined;
  const output = path.slice(workspace.directory.length + '/dist/'.length).replace(OUTPUT_EXTENSION, '');
  const source = workspace.builds.get(output);
  return source === undefined
    ? { error: `${path} is not the output of a tsup entry in ${workspace.directory}/tsup.config.ts` }
    : { source };
}

/** The source file behind a workspace specifier such as `@cssearth/bake/volume/node`, through the package's
 * exports and tsup entries, whether or not the package is built. */
export function workspaceSource(specifier: string, workspace: WorkspacePackage, workspaces: readonly WorkspacePackage[], tracked: ReadonlySet<string>): { readonly source: string } | { readonly error: string } {
  const subpath = specifier === workspace.name ? '.' : `.${specifier.slice(workspace.name.length)}`;
  let target = workspace.exports.get(subpath);
  if (target === undefined) {
    // The longest matching `./prefix/*` pattern, as Node picks it.
    const patterns = [...workspace.exports].filter(([key]) => {
      const [prefix = '', suffix = ''] = key.split('*');
      return key.includes('*') && subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length;
    }).sort(([left], [right]) => right.indexOf('*') - left.indexOf('*'));
    const [key, value] = patterns[0] ?? [];
    if (key !== undefined && value !== undefined) {
      const [prefix = '', suffix = ''] = key.split('*');
      target = value.replaceAll('*', subpath.slice(prefix.length, subpath.length - suffix.length));
    }
  }
  if (target === undefined) return { error: `${specifier} is not exported by ${workspace.directory}/package.json` };
  const path = posix.join(workspace.directory, target);
  const built = builtSource(path, workspaces);
  if (built) return built;
  const source = candidates(path).find(candidate => tracked.has(candidate));
  return source === undefined ? { error: `${specifier} exports ${path}, which is not a repository file` } : { source };
}
