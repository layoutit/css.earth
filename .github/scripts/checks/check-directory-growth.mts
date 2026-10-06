#!/usr/bin/env node
/** Keep a directory's module count from growing, so decomposition sticks.
 *
 * A size limit alone makes flatness worse: splitting a 3,900-line module into seven siblings
 * satisfies `max-lines` and leaves the parent harder to read. This counts authored modules per
 * directory and fails when one grows, which is what makes "a module that outgrows the limit
 * becomes a folder" the cheaper move.
 *
 * Ratcheted, not absolute: today's counts are the baseline, so existing debt is visible without
 * blocking work, and the tree cannot get flatter while it is being fixed.
 *
 *   node .github/scripts/checks/check-directory-growth.mts           fail if any directory exceeds its baseline
 *   node .github/scripts/checks/check-directory-growth.mts --write   record the current counts as the baseline
 */
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

/** A directory may hold this many authored modules before it is counted at all. */
export const FREE_ALLOWANCE = 20;
export const BASELINE_PATH = '.github/scripts/checks/directory-growth-baseline.json';
const ROOTS = ['src', 'site', 'packages', 'labs', '.github/scripts'];
const CODE = /\.(?:ts|mts|tsx|astro)$/u;

/** Generated output, and data sets whose size is the point. Counting these would forbid a
 * registry of 586 bodies or 3,841 source records, which the object contract requires. */
const EXEMPT = [
  /(?:^|\/)node_modules(?:\/|$)/u, /(?:^|\/)dist(?:\/|$)/u, /(?:^|\/)\.cache(?:\/|$)/u,
  /(?:^|\/)prepared(?:\/|$)/u, /(?:^|\/)generated(?:\/|$)/u,
  /^src\/objects(?:\/|$)/u, /^src\/sources(?:\/|$)/u,
  /(?:^|\/)(?:fixtures|programs|diffs|evidence|models|sources)(?:\/|$)/u,
];
export const isExempt = (directory: string) => EXEMPT.some(pattern => pattern.test(directory));

/** Tracked files only. Counting the working tree would let generated output into the baseline —
 * `src/platform/solar-geometry.mts` alone is 26,968 generated lines — and would make the count
 * depend on whether the reader had run `pnpm prebuild`. */
export async function trackedFiles(root = process.cwd()): Promise<string[]> {
  const { stdout } = await promisify(execFile)('git', ['ls-files', '-z', '--', ...ROOTS], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  return stdout.split('\0').filter(Boolean);
}

/** Authored modules directly in each directory. Tests are counted separately from implementations
 * so that adding a test never reads as structural decay. */
export async function countModules(root = process.cwd(), list: (root: string) => Promise<string[]> = trackedFiles) {
  const counts = new Map<string, { implementations: number; tests: number }>();
  for (const file of await list(root)) {
    const path = file.replaceAll('\\', '/');
    const directory = dirname(path);
    if (directory === './' || isExempt(directory)) continue;
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (!CODE.test(name) || name.endsWith('.d.ts') || name.endsWith('.d.mts')) continue;
    const count = counts.get(directory) ?? { implementations: 0, tests: 0 };
    if (/\.test\.[cm]?tsx?$/u.test(name) || /-browser\.mts$/u.test(name)) count.tests++; else count.implementations++;
    counts.set(directory, count);
  }
  return counts;
}

export interface DirectoryBaseline { implementations: number; tests: number; reason?: string }
export interface Baseline { readonly schema: 'cssearth-directory-growth@1'; readonly allowance: number;
  readonly directories: Readonly<Record<string, DirectoryBaseline>> }

export function buildBaseline(counts: ReadonlyMap<string, { implementations: number; tests: number }>,
  previous?: Baseline): Baseline {
  const directories: Record<string, DirectoryBaseline> = {};
  for (const [directory, count] of [...counts].sort(([left], [right]) => left.localeCompare(right))) {
    if (count.implementations <= FREE_ALLOWANCE && count.tests <= FREE_ALLOWANCE) continue;
    const reason = previous?.directories[directory]?.reason;
    if (!reason?.trim()) throw new TypeError(`${directory}: add a written reason before recording an above-allowance baseline.`);
    directories[directory] = { ...count, reason };
  }
  return { schema: 'cssearth-directory-growth@1', allowance: FREE_ALLOWANCE, directories };
}

export interface Growth { directory: string; kind: 'implementations' | 'tests'; was: number; now: number }

/** A directory fails only when it grows past whichever is larger: its recorded baseline, or the
 * free allowance. A directory absent from the baseline may grow to the allowance and no further.
 *
 * Only implementations gate. A flat test directory is a real smell, but refusing a new test is worse
 * than the smell it prevents, so test growth is reported and never fails. Decomposing a test directory is its own change, not a toll on the next person to add a case. */
export function growth(counts: ReadonlyMap<string, { implementations: number; tests: number }>, baseline: Baseline,
  kinds: readonly ('implementations' | 'tests')[] = ['implementations']): Growth[] {
  const failures: Growth[] = [];
  for (const [directory, count] of counts) {
    const recorded = baseline.directories[directory];
    for (const kind of kinds) {
      const ceiling = Math.max(recorded?.[kind] ?? 0, baseline.allowance);
      if (count[kind] > ceiling) failures.push({ directory, kind, was: ceiling, now: count[kind] });
    }
  }
  return failures.sort((left, right) => right.now - left.now);
}

export async function readBaseline(root = process.cwd()): Promise<Baseline> {
  const raw: unknown = JSON.parse(await readFile(resolve(root, BASELINE_PATH), 'utf8'));
  return validateBaseline(raw);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Validate the file at its input boundary; an undocumented ceiling cannot waive the check. */
export function validateBaseline(raw: unknown): Baseline {
  if (!isRecord(raw) || raw.schema !== 'cssearth-directory-growth@1'
    || raw.allowance !== FREE_ALLOWANCE || !isRecord(raw.directories)) {
    throw new TypeError(`${BASELINE_PATH} is not a cssearth-directory-growth@1 baseline.`);
  }
  const directories: Record<string, DirectoryBaseline> = {};
  for (const [directory, entry] of Object.entries(raw.directories)) {
    if (!isRecord(entry) || !isCount(entry.implementations) || !isCount(entry.tests)) {
      throw new TypeError(`${directory}: baseline counts must be non-negative integers.`);
    }
    if (entry.reason !== undefined && (typeof entry.reason !== 'string' || !entry.reason.trim())) {
      throw new TypeError(`${directory}: baseline reason must be a non-empty string.`);
    }
    if ((entry.implementations > FREE_ALLOWANCE || entry.tests > FREE_ALLOWANCE)
      && typeof entry.reason !== 'string') {
      throw new TypeError(`${directory}: an above-allowance baseline requires a written reason.`);
    }
    directories[directory] = { implementations: entry.implementations, tests: entry.tests,
      ...(typeof entry.reason === 'string' ? { reason: entry.reason } : {}) };
  }
  return { schema: 'cssearth-directory-growth@1', allowance: FREE_ALLOWANCE, directories };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const counts = await countModules();
  if (process.argv.includes('--write')) {
    const baseline = buildBaseline(counts, await readBaseline());
    await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`Recorded ${Object.keys(baseline.directories).length} directories over ${FREE_ALLOWANCE} modules.`);
  } else {
    const baseline = await readBaseline();
    const failures = growth(counts, baseline);
    for (const failure of failures) {
      console.error(`${failure.directory}: ${failure.now} ${failure.kind} (limit ${failure.was}). Move the new module into a folder with an index instead of adding a sibling.`);
    }
    for (const report of growth(counts, baseline, ['tests'])) {
      console.warn(`note ${report.directory}: ${report.now} tests (was ${report.was}). Not a failure; a flat test directory is worth splitting on its own.`);
    }
    if (failures.length) process.exitCode = 1; else console.log('No directory grew past its baseline.');
  }
}
