/** Inbound protection for the production application and its preparation closure.
 * Unknown computed imports are rejected in the compact preparation adapter and when
 * their expression references nebula paths. General plugin loaders are not subjected
 * to blanket data-flow claims; literal/const/alias imports are resolved below.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Package names and their owning directories. The lab's volume-core and volume-bake packages are `@cssearth/bake/volume`
 * and `@cssearth/bake/volume/node` now, outside the lab, and keep their rules. */
const packages = {
  '@cssearth/bake': 'packages/bake',
  '@cssearth/nebula-lab': 'labs/nebula/packages/lab', '@cssearth/nebula-reconstruction': 'labs/nebula/packages/reconstruction',
  '@cssearth/volume-viewer': 'labs/nebula/packages/volume-viewer',
} as const;
type PackageName = keyof typeof packages;
type Policy = 'runtime' | 'preparation' | 'test';
type Import = { specifier?: string; erased: boolean; expression: string; line: number };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const within = (base: string, file: string) => { const path = relative(base, file); return path === '' || !path.startsWith('../') && path !== '..' && !path.startsWith('/'); };
const canonical = (path: string) => existsSync(path) ? realpathSync(path) : resolve(path);
const readJson = (file: string): Record<string, unknown> => { const value: unknown = JSON.parse(readFileSync(file, 'utf8')); return object(value) ? value : {}; };
const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
const sourcePattern = /\.(?:[cm]?[jt]sx?|astro)$/;
function files(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', '.astro'].includes(entry.name)) return [];
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? files(file) : sourcePattern.test(file) && isFile(file) ? [file] : [];
  });
}
function policy(path: string): Policy {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) || /^site\/test\/[^/]+-browser\.mts$/.test(path)) return 'test';
  if (path.startsWith('tools/') || path.startsWith('src/preparation/') || path.startsWith('src/renderers/css/preparation/') || path.startsWith('packages/bake/') ||
      path === 'src/platform/astronomy-package.mts' || /^[^/]+\.config\.[cm]?ts$/.test(path)) return 'preparation';
  return 'runtime';
}
function syntax(file: string): ts.SourceFile {
  let source = readFileSync(file, 'utf8');
  if (extname(file) === '.astro') source = [...source.matchAll(/(?:^---\s*\n([\s\S]*?)\n---|<script\b[^>]*>([\s\S]*?)<\/script>)/g)].map(match => match[1] ?? match[2]).join('\n');
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function analyze(tree: ts.SourceFile, root: string): { imports: Import[]; accesses: { path: string; line: number }[] } {
  const constants = new Map<string, ts.Expression>(), ambiguous = new Set<string>(), loaders = new Set(['require']), factories = new Set(['createRequire']), result: Import[] = [];
  const accesses: { path: string; line: number }[] = [], readers = new Set(['readFile', 'readFileSync', 'readdir', 'readdirSync', 'open', 'openSync', 'stat', 'statSync', 'access', 'accessSync', 'existsSync', 'createReadStream']);
  const collect = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /^(?:node:)?fs(?:\/promises)?$/.test(node.moduleSpecifier.text)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) if (readers.has(item.propertyName?.text ?? item.name.text)) readers.add(item.name.text);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /^(?:node:)?module$/.test(node.moduleSpecifier.text)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) if ((item.propertyName?.text ?? item.name.text) === 'createRequire') factories.add(item.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isVariableDeclarationList(node.parent) && node.parent.flags & ts.NodeFlags.Const) {
        if (constants.has(node.name.text)) ambiguous.add(node.name.text);
        constants.set(node.name.text, node.initializer);
      }
      if (ts.isCallExpression(node.initializer) && (factories.has(node.initializer.expression.getText(tree)) || /\.createRequire$/.test(node.initializer.expression.getText(tree)))) loaders.add(node.name.text);
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  for (let changed = true; changed;) { changed = false; for (const [name, expression] of constants) if (ts.isIdentifier(expression) && loaders.has(expression.text) && !loaders.has(name)) { loaders.add(name); changed = true; } }
  function value(node: ts.Expression, seen = new Set<string>()): string | undefined {
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return value(node.expression, seen);
    if (ts.isIdentifier(node) && !ambiguous.has(node.text) && !seen.has(node.text)) { const constant = constants.get(node.text); if (constant) return value(constant, new Set([...seen, node.text])); }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = value(node.left, seen), b = value(node.right, seen); if (a !== undefined && b !== undefined) return a + b;
    }
    if (ts.isTemplateExpression(node)) {
      let text = node.head.text;
      for (const span of node.templateSpans) { const part = value(span.expression, seen); if (part === undefined) return; text += part + span.literal.text; }
      return text;
    }
    if (node.getText(tree) === 'import.meta.dirname') return dirname(tree.fileName);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'process.cwd') return root;
    if (ts.isCallExpression(node) && /^(?:path\.)?(?:resolve|join)$/.test(node.expression.getText(tree))) {
      const parts = node.arguments.map(argument => value(argument, seen));
      if (parts.every((part): part is string => part !== undefined)) return resolve(root, ...parts);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'href') return value(node.expression, seen);
    if (ts.isNewExpression(node) && node.expression.getText(tree) === 'URL') {
      const text = node.arguments?.[0] && value(node.arguments[0], seen);
      if (text !== undefined && node.arguments?.[1]?.getText(tree) === 'import.meta.url') return resolve(dirname(tree.fileName), text);
      if (text?.startsWith('file:')) { try { return fileURLToPath(text); } catch { return; } }
    }
    return undefined;
  }
  const add = (node: ts.Node, expression: ts.Expression | undefined, erased: boolean) => result.push({
    specifier: expression && value(expression), erased, expression: expression?.getText(tree) ?? '', line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
  });
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause, named = clause?.namedBindings;
      const erased = Boolean(clause?.isTypeOnly || !clause?.name && named && ts.isNamedImports(named) && named.elements.length && named.elements.every(item => item.isTypeOnly));
      add(node, node.moduleSpecifier, erased);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      add(node, node.moduleSpecifier, node.isTypeOnly || Boolean(clause && ts.isNamedExports(clause) && clause.elements.length && clause.elements.every(item => item.isTypeOnly)));
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node, node.argument.literal, true);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node, node.moduleReference.expression, node.isTypeOnly);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && loaders.has(node.expression.text))) add(node, node.arguments[0], false);
    const reader = ts.isCallExpression(node) && (ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '');
    const path = reader && readers.has(reader) ? node.arguments[0] && value(node.arguments[0]) : ts.isNewExpression(node) ? value(node) : undefined;
    if (path !== undefined) accesses.push({ path, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 });
    ts.forEachChild(node, visit);
  };
  visit(tree); return { imports: result, accesses };
}

export function checkNebulaInboundBoundaries(inputRoot: string): string[] {
  const root = canonical(inputRoot), errors: string[] = [], lab = resolve(root, 'labs/nebula'), bake = resolve(root, 'packages/bake');
  const rootManifest = existsSync(resolve(root, 'package.json')) ? readJson(resolve(root, 'package.json')) : {};
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const entries = rootManifest[field];
    if (object(entries)) for (const name of ['@cssearth/bake', '@cssearth/nebula-lab', '@cssearth/nebula-reconstruction', '@cssearth/volume-viewer'])
      if (name in entries) errors.push(`package.json: ${name} must remain a devDependency, not ${field}`);
  }
  const manifests = new Map<PackageName, Record<string, unknown>>();
  for (const [name, owner] of Object.entries(packages)) {
    const file = resolve(root, owner, 'package.json');
    if (existsSync(file)) manifests.set(name as PackageName, readJson(file));
  }
  const configCache = new Map<string, ts.CompilerOptions>();
  function options(file: string): ts.CompilerOptions {
    const config = ts.findConfigFile(dirname(file), existsSync) ?? '';
    if (!configCache.has(config)) {
      const parsed = config ? ts.getParsedCommandLineOfConfigFile(config, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} }) : undefined;
      configCache.set(config, { moduleResolution: ts.ModuleResolutionKind.Bundler, ...parsed?.options });
    }
    return configCache.get(config)!;
  }
  const resolveCache = ts.createModuleResolutionCache(root, path => path);
  function destination(specifier: string, file: string): string | undefined {
    if (specifier.startsWith('file:')) { try { return canonical(fileURLToPath(specifier)); } catch { return; } }
    const direct = specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier.startsWith('/') ? resolve(root, `.${specifier}`) : undefined;
    // Check lexical relative paths even when the forbidden module does not exist.
    if (direct && within(lab, direct)) return canonical(direct);
    if (specifier.startsWith('/') && within(lab, resolve(specifier))) return canonical(specifier);
    const resolved = ts.resolveModuleName(specifier, file, options(file), ts.sys, resolveCache).resolvedModule?.resolvedFileName;
    if (resolved) return canonical(resolved);
    // TypeScript paths aliases can target missing files; enforce those declarations too.
    const opts = options(file);
    for (const [pattern, targets] of Object.entries(opts.paths ?? {})) {
      const [prefix, suffix = ''] = pattern.split('*');
      if (pattern.includes('*') ? specifier.startsWith(prefix!) && specifier.endsWith(suffix) : specifier === pattern) {
        const middle = pattern.includes('*') ? specifier.slice(prefix!.length, specifier.length - suffix.length) : '';
        for (const target of targets) {
          const mapped = resolve(opts.baseUrl ?? dirname(ts.findConfigFile(dirname(file), existsSync) ?? resolve(root, 'tsconfig.json')), target.replace('*', middle));
          if (within(lab, mapped) || within(bake, mapped)) return canonical(mapped);
        }
      }
    }
    if (direct) for (const candidate of [direct, ...['.ts', '.mts', '.tsx', '.js', '/index.ts'].map(ext => direct + ext)]) if (isFile(candidate)) return canonical(candidate);
    return direct;
  }
  const sourceFiles = [...['src', 'site', 'tools', 'packages'].flatMap(path => files(resolve(root, path))),
    ...readdirSync(root).filter(path => sourcePattern.test(path) && isFile(resolve(root, path))).map(path => resolve(root, path))];
  type Node = { label: string; imports: Import[]; accesses: { path: string; line: number }[]; unchecked: boolean; edges: { file: string; erased: boolean }[]; packages: { name: PackageName; erased: boolean; specifier: string }[] };
  const graph = new Map<string, Node>();
  for (const file of sourceFiles) {
    if (graph.has(canonical(file))) continue;
    const label = relative(root, file), analysis = analyze(syntax(file), root), node: Node = { label, ...analysis, unchecked: false, edges: [], packages: [] }; graph.set(canonical(file), node);
    for (const item of node.imports) {
      const specifier = item.specifier, location = `${label}:${item.line}`;
      if (!specifier) {
        if (label.startsWith('tools/nebula/application/') || /(?:labs\/nebula|packages\/bake|@cssearth\/(?:nebula-|volume-|bake\b))/.test(readFileSync(file, 'utf8')))
          node.unchecked = true;
        continue;
      }
      const name = Object.keys(packages).find(name => specifier === name || specifier.startsWith(`${name}/`)) as PackageName | undefined;
      if (name) {
        const exports = manifests.get(name)?.exports, key = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
        if (!object(exports) || !(key in exports)) errors.push(`${location}: non-public nebula import ${specifier}`);
        const resolved = destination(specifier, file), expected = resolve(root, packages[name]);
        if (resolved && !within(expected, resolved)) errors.push(`${location}: package alias escapes its declared owner (${specifier})`);
        const exportValue = object(exports) ? exports[key] : undefined;
        const targets = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(targets) : object(value) ? Object.values(value).flatMap(targets) : [];
        if (targets(exportValue).some(target => !target.startsWith('./') || !within(expected, resolve(expected, target)))) errors.push(`${location}: public export escapes its package (${specifier})`);
        node.packages.push({ name, erased: item.erased, specifier });
      } else {
        const target = destination(specifier, file);
        if (target && within(lab, target)) errors.push(`${location}: direct path into labs/nebula is forbidden; use an allowed public package export (${specifier})`);
        else if (target && within(bake, target) && !within(bake, canonical(file))) errors.push(`${location}: direct path into packages/bake is forbidden; use its public entries (${specifier})`);
        else if (target && within(root, target)) {
          node.edges.push({ file: target, erased: item.erased });
          if (isFile(target) && sourcePattern.test(target) && !target.includes('/node_modules/') && !graph.has(target)) sourceFiles.push(target);
        }
      }
    }
  }
  for (const [file, origin] of graph) {
    const mode = policy(origin.label), visited = new Set<string>();
    function visit(current: string, erased: boolean) {
      const key = `${current}:${erased}`; if (visited.has(key)) return; visited.add(key);
      const node = graph.get(current); if (!node) return;
      if (mode !== 'test' && node.unchecked) errors.push(`${origin.label}: unchecked computed nebula module loading via ${node.label}`);
      if (mode !== 'test') for (const access of node.accesses) {
        let target: string;
        try { target = access.path.startsWith('file:') ? fileURLToPath(access.path) : resolve(root, access.path); } catch { continue; }
        if (within(lab, canonical(target))) errors.push(`${origin.label}: filesystem access into labs/nebula via ${node.label}:${access.line}`);
      }
      for (const entry of node.packages) {
        const typeOnly = erased || entry.erased;
        // Only preparation code imports the bake, not even for a type: a type the runtime needs belongs to the renderer.
        const allowed = mode === 'test' || entry.name === '@cssearth/bake' && mode === 'preparation';
        if (!allowed) errors.push(`${origin.label}: ${mode} closure forbids ${entry.specifier}${file === current ? '' : ` via ${node.label}`}${typeOnly ? ' (type import)' : ''}`);
      }
      for (const edge of node.edges) visit(edge.file, erased || edge.erased);
    }
    visit(file, false);
  }
  return [...new Set(errors)];
}
