// One affected-path plan for GitHub and local checks. Unknown ownership runs every shared lane;
// known owners select the jobs containing their checks. Lint and object-scope always run.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { requireArray, requireRecord, requireString } from './source-values.mts';
import type { ChangeMode } from './classify-changes.mts';

const execFileAsync = promisify(execFile);

/** Jobs every change runs regardless of what it touched: the merge gate and the advisory repository audit. */
export const ALWAYS_JOBS = ['lint', 'audit'] as const;
export const HEAVY_JOBS = ['typecheck', 'universe', 'universePreparation', 'nebula'] as const;
export type HeavyJob = typeof HEAVY_JOBS[number];

function isHeavyJob(value: unknown): value is HeavyJob {
  return typeof value === 'string' && (HEAVY_JOBS as readonly string[]).includes(value);
}

export interface CiArea {
  readonly id: string;
  readonly patterns: readonly string[];
  readonly jobs: readonly HeavyJob[];
}

export interface CiAreasConfig {
  readonly shared: readonly string[];
  readonly areas: readonly CiArea[];
  readonly production?: readonly string[];
}

/** Parses and validates `.github/ci-areas.json`. Every job id an area declares must be one of the four heavy jobs —
 * an unknown id is a typo that would silently never enable anything, so it throws rather than being ignored. */
export function parseCiAreasConfig(raw: unknown): CiAreasConfig {
  const root = requireRecord(raw, 'ci-areas.json');
  const shared = requireArray(root.shared, 'ci-areas.json shared').map((value, index) => requireString(value, `ci-areas.json shared[${index}]`));
  const areas = requireArray(root.areas, 'ci-areas.json areas').map((value, index) => {
    const area = requireRecord(value, `ci-areas.json areas[${index}]`);
    const id = requireString(area.id, `ci-areas.json areas[${index}].id`);
    const patterns = requireArray(area.patterns, `ci-areas.json areas[${index}].patterns`)
      .map((pattern, patternIndex) => requireString(pattern, `ci-areas.json areas[${index}].patterns[${patternIndex}]`));
    const jobs = requireArray(area.jobs, `ci-areas.json areas[${index}].jobs`).map((job, jobIndex) => {
      if (!isHeavyJob(job)) throw new TypeError(`ci-areas.json areas[${index}].jobs[${jobIndex}] is not a recognized job: ${String(job)}`);
      return job;
    });
    return { id, patterns, jobs };
  });
  const production = root.production === undefined ? [] : requireArray(root.production, 'ci-areas.json production')
    .map((value, index) => requireString(value, `ci-areas.json production[${index}]`));
  return { shared, areas, production };
}

export async function loadCiAreasConfig(path = resolve(import.meta.dirname, '..', '.github', 'ci-areas.json')): Promise<CiAreasConfig> {
  return parseCiAreasConfig(JSON.parse(await readFile(path, 'utf8')));
}

/** Converts one `ci-areas.json` glob pattern to a matcher. `**` matches zero or more whole path segments
 * (including none, so `tools/**` also matches the bare directory marker `tools/` if one ever appeared); a lone `*`
 * (not part of `**`) matches any run of characters within one segment, never a `/`. Every other character is
 * matched literally. This is deliberately the same small vocabulary the repository already hand-rolls as regular
 * expressions elsewhere (for example `SHARED_CODE` in tools/check-ci.mts) rather than a new dependency. */
export function patternToRegExp(pattern: string): RegExp {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      index += 1;
      if (pattern[index + 1] === '/') { source += '(?:.*/)?'; index += 1; }
      else source += '.*';
    } else if (char === '*') {
      source += '[^/]*';
    } else if ('.+^${}()|[]\\'.includes(char!)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`, 'u');
}

function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => patternToRegExp(pattern).test(path));
}

/** The production smoke is selected by the same map for local runs and the PR workflow. */
export function needsProductionBuild(paths: readonly string[], config: CiAreasConfig): boolean {
  return classifyAffectedPaths(paths, config).shared || paths.some(path => matchesAny(path, config.production ?? []));
}

export function affectedJobNames(result: AffectedAreas): string[] {
  // `lint` gates the merge; `audit` reports repository completeness without gating it. Both run on every change,
  // so a local plan shows the same two always-run jobs GitHub schedules (docs/ci-cd.md, "Gate on what ships").
  return [...ALWAYS_JOBS, ...HEAVY_JOBS.flatMap(job => !result.jobs.has(job) ? [] :
    job === 'typecheck' ? ['typecheck', 'typecheck-tests'] :
      job === 'universePreparation' ? ['universe-preparation'] : [job])];
}

export interface AffectedAreas {
  readonly paths: readonly string[];
  /** True when at least one changed path matched a shared pattern, or a path matched no area at all ("unsure means
   * shared"), or the diff could not be resolved. A change with no paths is also shared: an empty diff is never a
   * reason to trust a skip, matching tools/classify-changes.mts's docsOnly rule. */
  readonly shared: boolean;
  /** The non-shared area ids at least one changed path fell into (empty when `shared` is true or nothing changed). */
  readonly areaIds: readonly string[];
  /** The heavy jobs this change needs: every job the touched areas declare, or all four when `shared`. */
  readonly jobs: ReadonlySet<HeavyJob>;
}

/** Pure decision: given the changed paths and the areas config, which heavy jobs does this change need? */
export function classifyAffectedPaths(paths: readonly string[], config: CiAreasConfig): AffectedAreas {
  if (paths.length === 0) return { paths, shared: true, areaIds: [], jobs: new Set(HEAVY_JOBS) };
  if (paths.some(path => matchesAny(path, config.shared))) return { paths, shared: true, areaIds: [], jobs: new Set(HEAVY_JOBS) };
  const areaIds = new Set<string>();
  const jobs = new Set<HeavyJob>();
  for (const path of paths) {
    const area = config.areas.find(candidate => matchesAny(path, candidate.patterns));
    if (!area) return { paths, shared: true, areaIds: [], jobs: new Set(HEAVY_JOBS) };
    areaIds.add(area.id);
    for (const job of area.jobs) jobs.add(job);
  }
  return { paths, shared: false, areaIds: [...areaIds].sort((left, right) => left.localeCompare(right)), jobs };
}

async function gitChangedPaths(mode: ChangeMode, ref: string, root: string): Promise<readonly string[] | undefined> {
  const UNKNOWN_PUSH_BASE = /^0+$/u;
  if (mode === 'push' && (!ref || UNKNOWN_PUSH_BASE.test(ref))) return undefined;
  const args = mode === 'pr'
    ? ['diff', '--no-renames', '--name-only', '-z', `${ref}...HEAD`]
    : ['diff', '--no-renames', '--name-only', '-z', ref, 'HEAD'];
  const { stdout } = await execFileAsync('git', args, { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split('\0').filter(Boolean);
}

/** Include uncommitted work locally; GitHub uses the committed merge-base diff above. */
export async function localChangedPaths(ref: string, root: string): Promise<string[]> {
  const committed = await gitChangedPaths('pr', ref, root) ?? [];
  const commands = [['diff', '--no-renames', '--name-only', '-z', 'HEAD'], ['ls-files', '--others', '--exclude-standard', '-z']];
  const local = await Promise.all(commands.map(args => execFileAsync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 })));
  return [...new Set([...committed, ...local.flatMap(result => result.stdout.split('\0').filter(Boolean))])];
}

/** Same decision, computing `paths` itself from git and `config` itself from `.github/ci-areas.json`. An unresolved
 * push base (see tools/classify-changes.mts) is treated as shared, the direction that can only run more, not skip
 * something that should have run. */
export async function classifyAffectedChanges(mode: ChangeMode, ref: string,
  { root = resolve(import.meta.dirname, '..'),
    changedPaths = (m: ChangeMode, r: string) => gitChangedPaths(m, r, root),
    config = () => loadCiAreasConfig(resolve(root, '.github', 'ci-areas.json')) }:
  { root?: string; changedPaths?: (mode: ChangeMode, ref: string) => Promise<readonly string[] | undefined>; config?: () => Promise<CiAreasConfig> } = {},
): Promise<AffectedAreas> {
  const paths = await changedPaths(mode, ref);
  const areasConfig = await config();
  if (paths === undefined) return { paths: [], shared: true, areaIds: [], jobs: new Set(HEAVY_JOBS) };
  return classifyAffectedPaths(paths, areasConfig);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , mode, ref] = process.argv;
  if (mode !== 'pr' && mode !== 'push') throw new Error('Usage: ci-affected.mts <pr|push> <ref>');
  if (!ref) throw new Error('Usage: ci-affected.mts <pr|push> <ref>');
  const result = await classifyAffectedChanges(mode, ref);
  const production = needsProductionBuild(result.paths, await loadCiAreasConfig());
  console.log(`Touched ${result.paths.length} file(s).`);
  console.log(result.shared
    ? 'Classified as shared: every heavy job runs.'
    : `Areas: ${result.areaIds.join(', ') || '(none)'}; heavy jobs: ${[...result.jobs].sort().join(', ') || '(none)'}.`);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    for (const job of HEAVY_JOBS) appendFileSync(outputPath, `run_${job.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)}=${result.jobs.has(job)}\n`);
    appendFileSync(outputPath, `docs_only=${!result.shared && result.areaIds.length > 0 && result.areaIds.every(id => id === 'docs')}\n`);
    appendFileSync(outputPath, `run_production=${production}\n`);
  }
}
