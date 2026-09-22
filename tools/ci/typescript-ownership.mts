import { isArray } from '../../src/platform/is-array.mts';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@typescript-eslint/parser';

type Category = 'authored' | 'generated' | 'vendor' | 'configuration' | 'facade';
type BoundaryRole = 'test' | 'evidence';
type Exception = {
  category: Exclude<Category, 'authored'>;
  reason: string;
  source?: string;
  anchor?: string;
  exports?: Record<string, string[]>;
};
type Manifest = {
  schemaVersion: 1;
  baselineCommit: string;
  legacyAuthored: string[];
  exceptions: Record<string, Exception>;
};
type Inventory = {
  baselineCommit: string;
  counts: Record<Category, number>;
  categories: Record<Category, string[]>;
  violations: string[];
};

const javascript = /\.(?:c|m)?jsx?$/u;
const code = /\.(?:[cm]?[jt]sx?|astro)$/u;
const categories: Category[] = ['authored', 'generated', 'vendor', 'configuration', 'facade'];
const manifestPath = 'tools/ci/typescript-ownership.json';
const astroCompiler: unknown = createRequire(import.meta.resolve('astro/package.json'))('@astrojs/compiler-rs');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value);
}

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function validPath(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !value.includes('\\')
    && !value.startsWith('/') && posix.normalize(value) === value
    && value !== '..' && !value.startsWith('../');
}

function loadManifest(root: string): Manifest {
  const value: unknown = JSON.parse(readFileSync(resolve(root, manifestPath), 'utf8'));
  requireCondition(isRecord(value) && value.schemaVersion === 1, 'Invalid ownership manifest schema.');
  requireCondition(typeof value.baselineCommit === 'string' && /^[a-f0-9]{40}$/u.test(value.baselineCommit),
    'The ownership baseline must be a full source commit.');
  requireCondition(isArray(value.legacyAuthored) && value.legacyAuthored.every(validPath),
    'legacyAuthored must contain repository-relative file paths.');
  requireCondition(isRecord(value.exceptions), 'exceptions must be an exact path map.');
  const paths = [...value.legacyAuthored, ...Object.keys(value.exceptions)];
  requireCondition(paths.every(path => validPath(path) && javascript.test(path)), 'Every manifest entry must name a JavaScript file.');
  requireCondition(new Set(paths).size === paths.length, 'Duplicate ownership entry.');
  requireCondition(JSON.stringify(value.legacyAuthored) === JSON.stringify([...value.legacyAuthored].sort()),
    'Keep the authored backlog sorted.');
  for (const [path, exception] of Object.entries(value.exceptions)) {
    requireCondition(isRecord(exception) && typeof exception.category === 'string'
      && exception.category !== 'authored' && categories.includes(exception.category as Category), `${path}: invalid exception category.`);
    requireCondition(typeof exception.reason === 'string' && exception.reason.trim().length > 0, `${path}: explain why JavaScript remains.`);
    if (exception.source !== undefined) requireCondition(validPath(exception.source), `${path}: invalid provenance path.`);
    if (exception.anchor !== undefined) requireCondition(typeof exception.anchor === 'string' && exception.anchor.length > 0, `${path}: invalid source anchor.`);
    if (['generated', 'vendor'].includes(exception.category)) {
      requireCondition(exception.source && exception.anchor, `${path}: generated/vendor exceptions require provenance and a source anchor.`);
    }
    if (exception.category === 'facade') {
      requireCondition(isRecord(exception.exports) && Object.keys(exception.exports).length > 0, `${path}: facade exports must be explicit.`);
      for (const names of Object.values(exception.exports)) {
        requireCondition(isArray(names) && names.length > 0 && names.every(name => typeof name === 'string'), `${path}: invalid facade export names.`);
      }
    }
  }
  return value as Manifest;
}

// A file's test/evidence role controls only which imports production owners may
// take. It never changes JavaScript ownership: test fixtures and capture
// scripts still need an exact legacyAuthored entry until they migrate.
function boundaryRoleFor(path: string): BoundaryRole | undefined {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path) || path.startsWith('site/test/')
    || /^src\/(?:[^/]+\/)*test\//u.test(path)
    || path.startsWith('tests/') || /(?:^|\/)(?:__fixtures__|fixtures)(?:\/|$)/u.test(path)) return 'test';
  // This exact namespace combines observation signals; it is authored processing,
  // not an external evidence harness. Keep checking its descendants for real
  // capture/evidence boundaries, and leave similarly named owners unchanged.
  const rolePath = path
    .replace(/^labs\/nebula\/src\/reconstruction\/evidence-fusion\//u, 'labs/nebula/src/reconstruction/')
    .replace(/^labs\/nebula\/packages\/reconstruction\/src\/evidence\//u, 'labs/nebula/packages/reconstruction/src/')
    .replace(/^labs\/nebula\/packages\/lab\/src\/(features|server\/workflows)\/evidence-fusion\//u, 'labs/nebula/packages/lab/src/$1/')
    .replace(/^labs\/nebula\/packages\/lab\/src\/server\/routes\/evidence-fusion\.ts$/u, 'labs/nebula/packages/lab/src/server/routes/fusion.ts');
  // Audits and external-oracle comparisons produce evidence; they may use test harnesses.
  if (path.startsWith('tools/audits/') || path.startsWith('tools/oracles/') || /(?:^|\/)(?:capture|captures|evidence)(?:[./_-]|$)/u.test(rolePath)) return 'evidence';
  return undefined;
}

function categoryFor(path: string, manifest: Manifest): Category {
  return manifest.exceptions[path]?.category ?? 'authored';
}

function sourceFiles(root: string): string[] {
  return [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(path => code.test(path) && existsSync(resolve(root, path))))].sort();
}

function literalValue(node: unknown): string | undefined {
  return isRecord(node) && node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

function literalImports(node: unknown, imports: string[] = []): string[] {
  if (!isRecord(node)) return imports;
  if (['ImportDeclaration', 'ImportExpression', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(String(node.type))) {
    const value = literalValue(node.source);
    if (value !== undefined) imports.push(value);
  }
  if (node.type === 'CallExpression' && isRecord(node.callee) && node.callee.type === 'Identifier'
    && node.callee.name === 'require' && isArray(node.arguments)) {
    const value = literalValue(node.arguments[0]);
    if (value !== undefined) imports.push(value);
  }
  if (node.type === 'JSXOpeningElement' && isRecord(node.name) && node.name.name === 'script' && isArray(node.attributes)) {
    for (const attribute of node.attributes) {
      if (!isRecord(attribute) || !isRecord(attribute.name) || attribute.name.name !== 'src') continue;
      const value = literalValue(attribute.value) ?? (isRecord(attribute.value) ? literalValue(attribute.value.expression) : undefined);
      if (value !== undefined) imports.push(value);
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (['comments', 'tokens', 'loc', 'range', 'parent'].includes(key)) continue;
    if (isArray(value)) value.forEach(child => literalImports(child, imports));
    else if (isRecord(value)) literalImports(value, imports);
  }
  return imports;
}

function parseAstroSource(source: string): unknown {
  requireCondition(isRecord(astroCompiler) && typeof astroCompiler.parse === 'function', 'Astro compiler parser is unavailable.');
  const parsed: unknown = (astroCompiler.parse as (source: string) => unknown)(source);
  requireCondition(isRecord(parsed) && isArray(parsed.diagnostics) && isRecord(parsed.ast), 'Invalid Astro parser result.');
  const error = parsed.diagnostics.find((diagnostic: unknown) => isRecord(diagnostic) && diagnostic.severity === 'error');
  if (isRecord(error)) throw new SyntaxError(String(error.text));
  return parsed.ast;
}

function resolveLocalImports(root: string, from: string, specifier: string, files: Set<string>): string[] {
  const pathname = specifier.split(/[?#]/u)[0]!;
  let targets: string[];
  if (pathname.startsWith('/@fs/')) {
    const target = posix.relative(root, resolve('/', pathname.slice('/@fs/'.length)));
    targets = validPath(target) ? [target] : [];
  } else if (pathname.startsWith('/') && !pathname.startsWith('//')) {
    const target = posix.normalize(pathname).slice(1);
    // Astro's configured root is this repository and publicDir is ./public.
    // Check both local URL owners, including public scripts loaded by src.
    targets = [target, posix.join('public', target)];
  } else if (pathname.startsWith('.')) {
    targets = [posix.normalize(posix.join(posix.dirname(from), pathname))];
  } else return [];
  return [...new Set(targets.map(target => {
    const candidates = [target, target.replace(/\.js$/u, '.ts'), target.replace(/\.mjs$/u, '.mts'),
      ...['.ts', '.mts', '.js', '.mjs', '/index.ts', '/index.mts', '/index.js', '/index.mjs'].map(suffix => target + suffix)];
    return candidates.find(candidate => files.has(candidate));
  }).filter((target): target is string => target !== undefined))];
}

function facadeExports(ast: ReturnType<typeof parse>): Record<string, string[]> | undefined {
  const exports: Record<string, string[]> = {};
  for (const statement of ast.body) {
    if (statement.type === 'ExportAllDeclaration' && !statement.exported && typeof statement.source.value === 'string') {
      (exports[statement.source.value] ??= []).push('*');
    } else if (statement.type === 'ExportNamedDeclaration' && statement.source && !statement.declaration
      && typeof statement.source.value === 'string' && statement.exportKind === 'value') {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ExportSpecifier' || specifier.local.type !== 'Identifier'
          || specifier.exported.type !== 'Identifier' || specifier.local.name !== specifier.exported.name) return undefined;
        (exports[statement.source.value] ??= []).push(specifier.local.name);
      }
    } else return undefined;
  }
  return exports;
}

function normalizedExports(value: Record<string, string[]>): string {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([specifier, names]) => [specifier, [...names].sort()]));
}

export function auditOwnership(root: string): Inventory {
  const manifest = loadManifest(root);
  const files = sourceFiles(root);
  const fileSet = new Set(files);
  const jsFiles = files.filter(path => javascript.test(path));
  const classified: Record<Category, string[]> = {
    authored: [], generated: [], vendor: [], configuration: [], facade: [],
  };
  const violations: string[] = [];
  for (const path of jsFiles) classified[categoryFor(path, manifest)].push(path);
  const actualAuthored = new Set(classified.authored);
  const legacy = new Set(manifest.legacyAuthored);
  for (const path of classified.authored) {
    if (!legacy.has(path)) violations.push(`New authored JavaScript: ${path}. Use TypeScript or justify an exact exception.`);
  }
  for (const path of manifest.legacyAuthored) {
    if (!actualAuthored.has(path)) violations.push(`Stale authored backlog entry: ${path}. Remove it after migration or deletion.`);
  }
  for (const [path, exception] of Object.entries(manifest.exceptions)) {
    if (!fileSet.has(path)) {
      violations.push(`Stale JavaScript exception: ${path}. Remove it after migration or deletion.`);
      continue;
    }
    if (exception.source && !existsSync(resolve(root, exception.source))) violations.push(`${path}: missing provenance source ${exception.source}.`);
    if (exception.anchor && !readFileSync(resolve(root, path), 'utf8').includes(exception.anchor)) {
      violations.push(`${path}: source anchor no longer matches the justified exception.`);
    }
  }
  for (const path of files) {
    const category = categoryFor(path, manifest);
    const boundaryRole = boundaryRoleFor(path);
    // Parse every JS/TS/Astro owner, including tests and prepared data. Test and
    // evidence modules may consume their own harnesses, while runtime owners
    // remain forbidden from importing either role. Parsing executes nothing.
    try {
      const source = readFileSync(resolve(root, path), 'utf8');
      const moduleAst = path.endsWith('.astro') ? undefined : parse(source, { sourceType: 'module', filePath: path, jsx: /x$/u.test(path) });
      const ast = moduleAst ?? parseAstroSource(source);
      if (category === 'facade') {
        const actual = moduleAst && facadeExports(moduleAst);
        const expected = manifest.exceptions[path]!.exports!;
        if (!actual || normalizedExports(actual) !== normalizedExports(expected)) {
          violations.push(`${path}: compatibility facade must only re-export its exact declared typed owners.`);
        }
      }
      if (boundaryRole) continue;
      for (const specifier of literalImports(ast)) {
        for (const target of resolveLocalImports(root, path, specifier, fileSet)) {
          const targetRole = boundaryRoleFor(target);
          if (targetRole) {
            violations.push(`${path}: source imports ${targetRole} module ${target}; move shared behavior into an authored owner.`);
          }
        }
      }
    } catch (error) {
      violations.push(`${path}: cannot parse ownership boundary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    baselineCommit: manifest.baselineCommit,
    counts: Object.fromEntries(categories.map(category => [category, classified[category].length])) as Record<Category, number>,
    categories: classified,
    violations: [...new Set(violations)].sort(),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root = rootIndex === -1 ? resolve(dirname(fileURLToPath(import.meta.url)), '../..') : resolve(args[rootIndex + 1] ?? '.');
  try {
    const inventory = auditOwnership(root);
    if (args.includes('--json')) console.log(JSON.stringify(inventory, null, 2));
    else {
      console.log(`JavaScript ownership: ${Object.entries(inventory.counts).map(([category, count]) => `${count} ${category}`).join(', ')}.`);
      if (inventory.violations.length) console.error(inventory.violations.join('\n'));
      else console.log('Ownership guard passed; the authored JavaScript backlog has no additions or stale entries.');
    }
    process.exitCode = inventory.violations.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
