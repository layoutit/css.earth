/** Rules the architecture check applies to the repository itself rather than to the import graph. They have no
 * baseline: the repository satisfies each of them today, so every finding fails the check, and
 * `--update-baseline` never records one. */
import { checkDeclaredDependencies } from './declared-dependencies.mts';
import { checkNebulaBoundaries } from './nebula-packages.mts';
import { checkPreInstallImports } from './pre-install-imports.mts';

export interface RepositoryRule {
  readonly id: string;
  /** Plain-language statement of the rule, printed above its findings. */
  readonly description: string;
  /** Findings for the checkout at `root`, whose tracked and new (not ignored) files are `files`. */
  readonly check: (root: string, files: readonly string[]) => readonly string[];
}

/** Folders that no longer exist: `tools/` held preparation code until it moved to its canonical homes
 * (`packages/bake`, `packages/telescope-cli`, `site/build`, `.github/scripts`, `labs`, `tests`, `evidence/`). A file under one means
 * code went back to a retired location. */
export const RETIRED_FOLDERS: readonly string[] = ['tools'];

/** One finding per file inside a retired folder. */
export function retiredFiles(files: readonly string[], folders: readonly string[] = RETIRED_FOLDERS): string[] {
  return files.flatMap(file => {
    const folder = folders.find(item => file.split('/').slice(0, -1).includes(item));
    return folder === undefined ? [] : [`${file}: ${folder}/ is retired; put the file in the folder its code moved to`];
  });
}

export const REPOSITORY_RULES: readonly RepositoryRule[] = [
  {
    id: 'retired-folders',
    description: 'no file lives under a tools/ folder (RETIRED_FOLDERS in repository-rules.mts)',
    check: (_root, files) => retiredFiles(files),
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
