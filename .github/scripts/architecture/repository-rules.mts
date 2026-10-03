/** Rules the architecture check applies to the repository itself rather than to the import graph. They have no
 * baseline: the repository satisfies each of them today, so every finding fails the check, and
 * `--update-baseline` never records one. */
import ts from 'typescript';
import { checkBakeWithoutRenderer } from './bake-without-renderer.mts';
import { checkFormatSchemaOwnership } from './format-schema-ownership.mts';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { declaredPackage, importedSpecifiers } from './declared-dependencies.mts';
import { isTestPath } from './zones.mts';
import { checkDeclaredDependencies } from './declared-dependencies.mts';
import { checkNebulaBoundaries } from './nebula-packages.mts';
import { checkPackageCycles } from './package-cycles.mts';
import { checkPreparationWithoutRenderer } from './preparation-without-renderer.mts';
import { checkPreInstallImports } from './pre-install-imports.mts';

export interface RepositoryRule {
  readonly id: string;
  /** Plain-language statement of the rule, printed above its findings. */
  readonly description: string;
  /** Findings for the checkout at `root`, whose tracked and new (not ignored) files are `files`. */
  readonly check: (root: string, files: readonly string[]) => readonly string[];
}

/** Folders that no longer exist: `tools/` held preparation code until it moved to its canonical homes
 * (`packages/bake`, `packages/telescope-cli`, `site/build`, `.github/scripts`, `labs`, `evidence/`). A file under one means
 * code went back to a retired location. */
export const RETIRED_FOLDERS: readonly string[] = ['tools'];

/** One finding per file inside a retired folder. */
export function retiredFiles(files: readonly string[], folders: readonly string[] = RETIRED_FOLDERS): string[] {
  return files.flatMap(file => {
    const folder = folders.find(item => file.split('/').slice(0, -1).includes(item));
    return folder === undefined ? [] : [`${file}: ${folder}/ is retired; put the file in the folder its code moved to`];
  });
}

/** Object packages (`src/objects/<id>/`) hold data: descriptors, sources, evidence and prepared JSON. Code there could reach
 * the shell's DOM or native scene state; the shared runtime in `site/` and `packages/renderer` owns both. */
const OBJECT_CODE = /^src\/objects\/.+\.(?:[cm]?[jt]sx?|astro)$/u;

/** One finding per script or Astro module inside an object package. */
export function objectCodeFiles(files: readonly string[]): string[] {
  return files.filter(file => OBJECT_CODE.test(file) && !isTestPath(file)).map(file => `${file}: object packages hold data only; put code in packages/ or site/`);
}

/** Only established format owners may be top-level objects source folders. */
export const OBJECT_FORMAT_FOLDERS: readonly string[] = ["node", "prepared-data", "provenance", "registry", "sources", "stars", "volume"];
export function objectFormatFolders(root: string): string[] {
  const directory = resolve(root, 'packages/objects/src');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !OBJECT_FORMAT_FOLDERS.includes(entry.name))
    .map(entry => `packages/objects/src/${entry.name}/: objects holds formats only; put algorithms in their owning package`);
}

export const REPOSITORY_RULES: readonly RepositoryRule[] = [
  { id: 'bake-without-renderer', description: 'bake declares no renderer dependency and permits no renderer exception', check: checkBakeWithoutRenderer },
  { id: 'format-schema-ownership', description: 'shared raw schema literals and duplicates of objects definitions fail; schema/owner exceptions must remain current and justified', check: checkFormatSchemaOwnership },
  { id: 'preparation-without-renderer', description: 'preparation packages reach renderer only through named, file-scoped runtime consumers; stale exceptions fail', check: checkPreparationWithoutRenderer },
  { id: 'workspace-package-cycles', description: 'workspace packages have no dependency cycles, including dev and peer dependencies', check: checkPackageCycles },
  { id: 'integration-owners', description: 'integration files import public entries only and at least two owners with no transitive workspace dependency between them', check: checkIntegrationOwners },
  {
    id: 'retired-folders',
    description: 'no file lives under a tools/ folder or root tests/ folder (RETIRED_FOLDERS in repository-rules.mts)',
    check: (root, files) => [...retiredFiles(files), ...files.filter(file => file.startsWith('tests/')).map(file => `${file}: tests/ is retired; put tests beside their owner`), ...(existsSync(resolve(root, 'tests')) ? ['tests/: root tests/ directory is retired'] : [])],
  },
  {
    id: 'objects-hold-data',
    description: 'src/objects/ holds no script or Astro module; packages/objects/src/ permits only listed format folders',
    check: (root, files) => [...objectCodeFiles(files), ...objectFormatFolders(root)],
  },
  {
    id: 'nebula-boundaries',
    description: 'the nebula packages follow their public dependency graph, @cssearth/bake/volume keeps its host-neutral rules, '
      + 'and runtime and preparation code reach neither the lab nor bake sources except through the allowed public entries (nebula-packages.mts, nebula-inbound.mts)',
    check: root => checkNebulaBoundaries(root),
  },
  {
    id: 'declared-dependencies',
    description: 'a packages/* file imports another workspace package only when its package.json declares it, and outside tests of a tsup-built package only when it ships it in dependencies (declared-dependencies.mts)',
    check: checkDeclaredDependencies,
  },
  {
    id: 'pre-install-imports',
    description: 'a script a workflow job runs before its install imports only node: built-ins and files the job\'s checkout keeps, transitively (pre-install-imports.mts)',
    check: checkPreInstallImports,
  },
];

/** Each rule's findings, in rule order. */
export function repositoryFindings(root: string, files: readonly string[], rules: readonly RepositoryRule[] = REPOSITORY_RULES): Map<string, readonly string[]> {
  return new Map(rules.map(rule => [rule.id, rule.check(root, files)]));
}

/** A finding of any repository rule fails the check, whatever the baseline says. */
export function isBroken(findings: ReadonlyMap<string, readonly string[]>): boolean {
  return [...findings.values()].some(items => items.length > 0);
}

/** Count static import owners and require an independent pair. All declared workspace dependencies count;
 * nested lab packages belong to the labs owner, including their dependencies. Only source files are checked;
 * instruction and fixture data files such as `AGENTS.md` import nothing. Literal new URL paths are checked too;
 * computed paths and import(variable) cannot be resolved statically. */
export function checkIntegrationOwners(root: string, files: readonly string[]): string[] {
  const packages = files.filter(file => /^(?:packages\/[^/]+|labs\/[^/]+(?:\/packages\/[^/]+)?)\/package\.json$/u.test(file))
    .map(file => declaredPackage(file, JSON.parse(readFileSync(resolve(root, file), 'utf8'))));
  const owner = (path: string): string | undefined => {
    const parts = path.split('/');
    if (parts[0] === 'packages') return packages.find(pkg => path.startsWith(`${pkg.directory}/`))?.directory;
    if (['site', 'src', 'labs'].includes(parts[0] ?? '')) return parts[0];
    return path.startsWith('.github/scripts/') ? '.github/scripts' : undefined;
  };
  const reaches = (from: string, to: string, seen = new Set<string>()): boolean => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    const dependencies = packages.filter(item => owner(`${item.directory}/index.ts`) === from).flatMap(item => [...item.declared]);
    return dependencies.some(name => {
      const dependency = packages.find(item => item.name === name);
      return dependency !== undefined && reaches(owner(`${dependency.directory}/index.ts`) ?? dependency.directory, to, seen);
    });
  };
  return files.filter(file => file.startsWith('integration/') && /\.[cm]?[jt]sx?$/u.test(file)).flatMap(file => {
    if (!existsSync(resolve(root, file))) return [`${file}: integration file is missing`];
    const findings: string[] = [];
    const text = readFileSync(resolve(root, file), 'utf8');
    const specifiers = importedSpecifiers(text, file);
    const visit = (node: ts.Node): void => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
        && node.arguments?.[0] && ts.isStringLiteralLike(node.arguments[0])) specifiers.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
    const owners = new Set(specifiers.flatMap(specifier => {
      const pkg = packages.find(item => specifier === item.name || specifier.startsWith(`${item.name}/`));
      const path = specifier.startsWith('.') ? posix.normalize(posix.join(dirname(file), specifier)) : specifier.replace(/^\//u, '');
      if (pkg) {
        const manifest: unknown = JSON.parse(readFileSync(resolve(root, `${pkg.directory}/package.json`), 'utf8'));
        const exports = manifest && typeof manifest === 'object' && 'exports' in manifest ? manifest.exports : undefined;
        const entry = specifier === pkg.name ? '.' : `.${specifier.slice(pkg.name.length)}`;
        const entries = exports && typeof exports === 'object' ? Object.keys(exports) : ['.'];
        const published = entries.some(key => key === entry || key.includes('*') && entry.startsWith(key.split('*')[0]!) && entry.endsWith(key.split('*')[1]!));
        if (!published || /\.[cm]?[jt]sx?$/u.test(entry)) findings.push(`${file}: integration imports public package entries only; private source import ${specifier}`);
      } else if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (owner(path)) findings.push(`${file}: integration imports public package entries only; relative owner import ${specifier}`);
      }
      const imported = pkg ? owner(`${pkg.directory}/index.ts`) : owner(path);
      return imported ? [imported] : [];
    }));
    const list = [...owners];
    const independent = list.some((left, i) => list.slice(i + 1).some(right => !reaches(left, right) && !reaches(right, left)));
    return independent ? findings : [...findings, `${file}: integration must import at least two independent owners; found ${list.join(', ') || 'none'}`];
  });
}
