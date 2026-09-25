/** Enforce the internal nebula dependency graph against actual source imports. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { isBuiltin } from 'node:module';
import { checkNebulaInboundBoundaries } from './inbound-boundaries.mts';

export const nebulaPackages = {
  lab: '@cssearth/nebula-lab',
  'volume-bake': '@cssearth/volume-bake',
  reconstruction: '@cssearth/nebula-reconstruction',
  'volume-viewer': '@cssearth/volume-viewer',
} as const;
type Owner = keyof typeof nebulaPackages;
const owners = Object.keys(nebulaPackages) as Owner[];
const allowed = (from: Owner, to: Owner) => from === to || from === 'lab';
/** The volume contracts, fields and materials were the lab's volume-core package, which every nebula package could import.
 * They are `@cssearth/bake/volume` now; its Node-only bake entry, like volume-bake before it, is for the lab alone. */
export const bakePackage = '@cssearth/bake';
export const bakeVolumeEntries = { main: `${bakePackage}/volume`, node: `${bakePackage}/volume/node` } as const;
const bakeEntryAllowed = (from: Owner, specifier: string) => specifier !== bakeVolumeEntries.node || from === 'lab' || from === 'volume-bake';
const platformDependency = /^(react(?:-dom)?(?:\/|$)|sharp$|vite$|@layoutit\/polycss$)/;
const inside = (parent: string, path: string) => {
  const offset = relative(parent, path);
  return offset === '' || !offset.startsWith('../') && offset !== '..' && !offset.startsWith('/');
};
export function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', '.cache'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:[cm]?ts|tsx|py)$/.test(path) ? [path] : [];
  });
}
function staticSpecifier(node: ts.Expression): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return staticSpecifier(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticSpecifier(node.left), right = staticSpecifier(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}
function imports(tree: ts.SourceFile): { values: string[]; computed: boolean } {
  const values: string[] = []; let computed = false;
  function module(expression: ts.Expression | undefined) {
    const value = expression && staticSpecifier(expression);
    if (value === undefined) computed = true; else values.push(value);
  }
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) module(node.moduleSpecifier);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal))
      values.push(node.argument.literal.text);
    if (ts.isExternalModuleReference(node)) module(node.expression);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        ts.isIdentifier(node.expression) && node.expression.text === 'require')) module(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(tree); return { values, computed };
}
/** Registry-backed IDs only: directory names are included only when they contain an object descriptor.
 * This is a syntactic architecture guard, not data-flow analysis: it covers explicit id/objectId/
 * subjectId/bodyId selectors, switch cases and literal-list membership. Arbitrary aliases, generated
 * code and runtime dispatch tables still require review. Schema strings and physics labels are not IDs.
 */
function celestialIds(root: string): Set<string> {
  const directory = resolve(root, 'src/objects'), ids = new Set<string>();
  if (!existsSync(directory)) return ids;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const descriptor = resolve(directory, entry.name, 'object.json');
    if (!entry.isDirectory() || !existsSync(descriptor)) continue;
    const value: unknown = JSON.parse(readFileSync(descriptor, 'utf8'));
    if (record(value) && typeof value.id === 'string') { ids.add(entry.name); ids.add(value.id); }
  }
  return ids;
}
function identitySelector(node: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(node)) return identitySelector(node.expression);
  const name = ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text :
    ts.isElementAccessExpression(node) && node.argumentExpression ? staticSpecifier(node.argumentExpression) : undefined;
  return name !== undefined && /^(?:(?:object|subject|body|celestial)[_-]?)?id$/i.test(name);
}
function celestialBranch(node: ts.Node, ids: Set<string>): string | undefined {
  const id = (value: ts.Expression): string | undefined => { const text = staticSpecifier(value); return text !== undefined && ids.has(text) ? text : undefined; };
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind)) {
    if (identitySelector(node.left)) return id(node.right);
    if (identitySelector(node.right)) return id(node.left);
  }
  if (ts.isCaseClause(node) && ts.isCaseBlock(node.parent) && ts.isSwitchStatement(node.parent.parent) && identitySelector(node.parent.parent.expression))
    return id(node.expression);
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'includes' &&
      ts.isArrayLiteralExpression(node.expression.expression) && node.arguments[0] && identitySelector(node.arguments[0]))
    return node.expression.expression.elements.map(id).find(value => value !== undefined);
  return undefined;
}
function manifest(directory: string): { name?: unknown; private?: unknown; exports?: unknown; dependencies?: unknown; devDependencies?: unknown } {
  const value: unknown = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid package manifest.');
  return value;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** No computed module loading, object/source paths or celestial-id branches: the host supplies those. */
function hostNeutral(label: string, syntax: ts.SourceFile, computed: boolean, objectIds: Set<string>, errors: string[]) {
  if (computed) errors.push(`${label}: computed module loading crosses an unchecked boundary`);
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && /(?:^|\/)(?:labs\/nebula\/(?:models|sources)|src\/(?:objects|planets))\//.test(node.text))
      errors.push(`${label}: object/source path belongs to a host adapter`);
    const objectId = celestialBranch(node, objectIds);
    if (objectId) errors.push(`${label}: hardcoded celestial-id branch ${objectId} belongs to a host adapter`);
    ts.forEachChild(node, visit);
  };
  visit(syntax);
}
/** The rules volume-core and volume-bake followed, kept on `@cssearth/bake/volume` and its node entry: the main entry
 * imports no platform dependency and never the node entry, the topic reaches no nebula package and no other topic, and
 * no volume source names an object, an object path or a computed module. */
function checkBakeVolume(root: string, directory: string, value: ReturnType<typeof manifest>, objectIds: Set<string>, errors: string[]) {
  if (value.name !== bakePackage || value.private !== true) errors.push('bake: expected named private workspace package');
  if (!record(value.exports) || !(`.${bakeVolumeEntries.main.slice(bakePackage.length)}` in value.exports) ||
      !(`.${bakeVolumeEntries.node.slice(bakePackage.length)}` in value.exports)) errors.push('bake: missing volume entries');
  const deps = { ...(record(value.dependencies) ? value.dependencies : {}), ...(record(value.devDependencies) ? value.devDependencies : {}) };
  const volume = resolve(directory, 'src/volume'), node = resolve(volume, 'node');
  for (const file of sourceFiles(volume)) {
    const source = readFileSync(file, 'utf8'), label = relative(root, file);
    const lineCount = source.split('\n').length - Number(source.endsWith('\n'));
    if (lineCount > 600) errors.push(`${label}: ${lineCount} lines exceeds 600`);
    if (extname(file) === '.py') continue;
    const test = /\.(test|spec)\.[cm]?tsx?$/.test(file), main = !inside(node, file);
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true), loading = imports(syntax);
    for (const specifier of loading.values) {
      if (specifier === bakePackage || specifier.startsWith(`${bakePackage}/`)) errors.push(`${label}: bake topic imports a bake entry ${specifier}`);
      const target = owners.find(key => specifier === nebulaPackages[key] || specifier.startsWith(`${nebulaPackages[key]}/`));
      if (target) errors.push(`${label}: forbidden import ${target}`);
      if (!specifier.startsWith('.') && !specifier.startsWith('/') && !isBuiltin(specifier)) {
        const dependency = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
        if (dependency !== bakePackage && !(dependency in deps)) errors.push(`${label}: undeclared external dependency ${dependency}`);
      }
      if ((specifier.startsWith('/') || specifier.startsWith('file:')) && !test) errors.push(`${label}: absolute module import leaves package: ${specifier}`);
      if (specifier.startsWith('.')) {
        const destination = resolve(dirname(file), specifier);
        if (!inside(volume, destination) && !test) errors.push(`${label}: relative import leaves package: ${specifier}`);
        if (main && inside(node, destination)) errors.push(`${label}: core imports the node entry ${specifier}`);
      }
      if (main && !test && (isBuiltin(specifier) || platformDependency.test(specifier))) errors.push(`${label}: core imports platform dependency ${specifier}`);
    }
    if (!test) hostNeutral(label, syntax, loading.computed, objectIds, errors);
  }
}

export function checkNebulaBoundaries(root: string, requireAll = true): string[] {
  const base = resolve(root, 'labs/nebula/packages'), errors: string[] = [], objectIds = celestialIds(root);
  const manifests = new Map<Owner, ReturnType<typeof manifest>>();
  for (const owner of owners) {
    const directory = resolve(base, owner);
    if (!existsSync(resolve(directory, 'package.json'))) {
      if (requireAll) errors.push(`Missing package: ${owner}`);
      continue;
    }
    const value = manifest(directory); manifests.set(owner, value);
    if (value.name !== nebulaPackages[owner] || value.private !== true) errors.push(`${owner}: expected named private workspace package`);
    const deps = { ...(record(value.dependencies) ? value.dependencies : {}), ...(record(value.devDependencies) ? value.devDependencies : {}) };
    for (const target of owners) if (nebulaPackages[target] in deps) {
      if (!allowed(owner, target)) errors.push(`${owner}: forbidden dependency ${target}`);
      if (deps[nebulaPackages[target]] !== 'workspace:*') errors.push(`${owner}: ${target} must use workspace:*`);
    }
    if (bakePackage in deps && deps[bakePackage] !== 'workspace:*') errors.push(`${owner}: bake must use workspace:*`);
  }
  const bakeDirectory = resolve(root, 'packages/bake'), bake = existsSync(resolve(bakeDirectory, 'package.json')) ? manifest(bakeDirectory) : undefined;
  if (!bake && requireAll) errors.push('Missing package: bake');
  for (const [owner, value] of manifests) {
    const directory = resolve(base, owner);
    const deps = { ...(record(value.dependencies) ? value.dependencies : {}), ...(record(value.devDependencies) ? value.devDependencies : {}) };
    for (const file of sourceFiles(directory)) {
      const source = readFileSync(file, 'utf8'), label = relative(root, file);
      const lineCount = source.split('\n').length - Number(source.endsWith('\n'));
      if (lineCount > 600) errors.push(`${label}: ${lineCount} lines exceeds 600`);
      if (extname(file) === '.py') continue;
      const test = /\.(test|spec)\.[cm]?tsx?$/.test(file);
      const hostAdapter = owner === 'lab' && inside(resolve(directory, 'src/adapters'), file);
      const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true), loading = imports(syntax);
      for (const specifier of loading.values) {
        const target = owners.find(key => specifier === nebulaPackages[key] || specifier.startsWith(`${nebulaPackages[key]}/`));
        if (target) {
          if (!allowed(owner, target)) errors.push(`${label}: forbidden import ${target}`);
          if (target !== owner && deps[nebulaPackages[target]] !== 'workspace:*') errors.push(`${label}: undeclared workspace import ${target}`);
          const targetManifest = manifests.get(target);
          const key = specifier === nebulaPackages[target] ? '.' : `.${specifier.slice(nebulaPackages[target].length)}`;
          if (!targetManifest || !record(targetManifest.exports) || !(key in targetManifest.exports)) errors.push(`${label}: non-public import ${specifier}`);
        }
        if (specifier === bakePackage || specifier.startsWith(`${bakePackage}/`)) {
          if (!bakeEntryAllowed(owner, specifier)) errors.push(`${label}: forbidden import ${specifier}`);
          if (deps[bakePackage] !== 'workspace:*') errors.push(`${label}: undeclared workspace import ${bakePackage}`);
          const key = specifier === bakePackage ? '.' : `.${specifier.slice(bakePackage.length)}`;
          if (!bake || !record(bake.exports) || !(key in bake.exports)) errors.push(`${label}: non-public import ${specifier}`);
        }
        if (!specifier.startsWith('.') && !specifier.startsWith('/') && !isBuiltin(specifier)) {
          const dependency = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
          if (dependency !== value.name && !(dependency in deps)) errors.push(`${label}: undeclared external dependency ${dependency}`);
        }
        if ((specifier.startsWith('/') || specifier.startsWith('file:')) && !test && !hostAdapter)
          errors.push(`${label}: absolute module import leaves package: ${specifier}`);
        if (specifier.startsWith('.')) {
          const destination = resolve(dirname(file), specifier);
          if (!inside(directory, destination) && !test && !hostAdapter) errors.push(`${label}: relative import leaves package: ${specifier}`);
        }
      }
      if (owner !== 'lab' && !test) hostNeutral(label, syntax, loading.computed, objectIds, errors);
    }
  }
  if (bake) checkBakeVolume(root, bakeDirectory, bake, objectIds, errors);
  return [...errors, ...checkNebulaInboundBoundaries(root)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const errors = checkNebulaBoundaries(root);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`NEBULA_BOUNDARIES_OK: all ${owners.length} private packages and ${bakeVolumeEntries.main} follow their public dependency graph`);
}
