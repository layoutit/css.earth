/** Rules the architecture check applies to the repository itself rather than to the import graph. They have no
 * baseline: the repository satisfies each of them today, so every finding fails the check, and
 * `--update-baseline` never records one. */
import { checkDeclaredDependencies } from './declared-dependencies.mts';
import { checkNebulaBoundaries } from './nebula-packages.mts';

export interface RepositoryRule {
  readonly id: string;
  /** Plain-language statement of the rule, printed above its findings. */
  readonly description: string;
  /** Findings for the checkout at `root`, whose tracked and new (not ignored) files are `files`. */
  readonly check: (root: string, files: readonly string[]) => readonly string[];
}

/** Folders whose code has moved to its canonical home (`packages/*`, `.github/scripts`, `evidence/`). A file under one
 * means code went back to a retired location. Each move that empties a folder appends it here. */
export const RETIRED_FOLDERS: readonly string[] = [
  'tools/audits',
  'tools/ci/architecture',
  'tools/evidence',
  'tools/experiments',
  'tools/fits',
  'tools/galaxy-field',
  'tools/kernel-banks',
  'tools/objects/archives',
  'tools/objects/astronomy-packages',
  'tools/objects/astroquery',
  'tools/objects/celestia-comets',
  'tools/objects/chandra',
  'tools/objects/comet-67p',
  'tools/objects/cutaway',
  'tools/objects/gemini',
  'tools/objects/geographic-pages',
  'tools/objects/ihw',
  'tools/objects/interferometry/fixtures',
  'tools/objects/interferometry/rotir',
  'tools/objects/interferometry/seasons',
  'tools/objects/jwst/imaging',
  'tools/objects/jwst/klip',
  'tools/objects/jwst/programs',
  'tools/objects/keck',
  'tools/objects/paged-ellipsoid/geographic',
  'tools/objects/pds',
  'tools/objects/spitzer',
  'tools/objects/static-surface',
  'tools/objects/telescopes',
  'tools/objects/terrestrial-layers/fixtures',
  'tools/performance',
  'tools/photometry',
  'tools/references',
  'tools/spice',
];

/** One finding per file inside a retired folder. */
export function retiredFiles(files: readonly string[], folders: readonly string[] = RETIRED_FOLDERS): string[] {
  return files.flatMap(file => {
    const folder = folders.find(item => file.startsWith(`${item}/`));
    return folder === undefined ? [] : [`${file}: ${folder}/ is retired; put the file in the folder its code moved to`];
  });
}

export const REPOSITORY_RULES: readonly RepositoryRule[] = [
  {
    id: 'retired-folders',
    description: 'no file lives under a retired tools/ folder (RETIRED_FOLDERS in repository-rules.mts)',
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
];

/** Each rule's findings, in rule order. */
export function repositoryFindings(root: string, files: readonly string[], rules: readonly RepositoryRule[] = REPOSITORY_RULES): Map<string, readonly string[]> {
  return new Map(rules.map(rule => [rule.id, rule.check(root, files)]));
}

/** A finding of any repository rule fails the check, whatever the baseline says. */
export function isBroken(findings: ReadonlyMap<string, readonly string[]>): boolean {
  return [...findings.values()].some(items => items.length > 0);
}
