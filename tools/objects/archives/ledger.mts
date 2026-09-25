/** One way to write an archive ledger: what an archive holds for the objects this repository ships, and how far this toolkit
 * has been proved on it. Each archive (`tools/objects/<archive>/archive-ledger.mts`) supplies an `ArchiveLedger`: how to
 * survey the archive, how to read its ledger back, how to render its guide page, and the few ways its command genuinely
 * differs. This module owns the rest, the same for every archive: where the two files are, how they are written, the
 * `--local` pass that retakes only the repository's own state, and how receipt problems are said and counted.
 *
 * The files are tracked provenance. `ledger.test.mts` checks that every tracked guide is its ledger rendered and every
 * ledger is serialised at its archive's indent. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const REPOSITORY = resolve(import.meta.dirname, '../../..');

/** The two files a ledger is: the JSON record and the guide page generated from it, both repository-relative. */
export interface LedgerFiles { readonly ledger: string; readonly guide: string }
export const ledgerFiles = (ledger: string, guide: string): LedgerFiles => ({ ledger: resolve(REPOSITORY, ledger), guide: resolve(REPOSITORY, guide) });

/** When a pass writes its files: every time, or only when the command is given `--write`. */
export type WritePolicy = 'always' | 'with --write';

export interface ArchiveLedger<L> {
  /** The schema the ledger's JSON states. */
  readonly schema: string;
  readonly files: LedgerFiles;
  /** JSON indentation of the tracked ledger. */
  readonly indent: 1 | 2;
  /** The guide page's exact text. */
  readonly guide: (ledger: L) => string;
  /** The full pass against the archive. `args` are the command's arguments, for archives that take their own. */
  readonly survey: (args: readonly string[]) => Promise<L>;
  /** When the full pass writes its files. */
  readonly writes: WritePolicy;
  /** The `--local` pass: the ledger on disk, read back as the external value it is, with everything the repository owns
   * taken again from the repository. Only the archive's own counts are kept. Absent for an archive with no such pass. */
  readonly local?: {
    readonly parse: (value: unknown) => L;
    readonly refresh: (previous: L) => Promise<L>;
    readonly writes: WritePolicy;
    /** How the ledger file is read, where an archive reads it its own way. */
    readonly read?: (path: string) => Promise<unknown>;
    /** Ends the process once a `--local` pass has reported. */
    readonly exit?: boolean;
  };
  /** The receipts that could not be accepted: said on stderr and counted against the run. Absent where an archive only
   * records them in its ledger. */
  readonly receiptProblems?: (ledger: L) => readonly string[];
  /** What the command prints once the ledger is made (and written, when it is). */
  readonly summary: (ledger: L, run: { readonly local: boolean; readonly write: boolean }) => readonly string[];
}

export const ledgerJson = <L,>(archive: ArchiveLedger<L>, ledger: L) => `${JSON.stringify(ledger, null, archive.indent)}\n`;

export async function writeLedger<L>(archive: ArchiveLedger<L>, ledger: L): Promise<void> {
  await mkdir(dirname(archive.files.ledger), { recursive: true });
  await writeFile(archive.files.ledger, ledgerJson(archive, ledger));
  await writeFile(archive.files.guide, archive.guide(ledger));
}

const readLedgerFile = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8')) as unknown;

/** The ledger a pass makes: the archive surveyed again, or, with `--local`, the ledger on disk with the repository's own
 * state retaken. */
export async function buildLedger<L>(archive: ArchiveLedger<L>, args: readonly string[]): Promise<{ ledger: L; local: boolean }> {
  const local = archive.local !== undefined && args.includes('--local');
  if (!local || !archive.local) return { ledger: await archive.survey(args), local: false };
  const previous = archive.local.parse(await (archive.local.read ?? readLedgerFile)(archive.files.ledger));
  return { ledger: await archive.local.refresh(previous), local: true };
}

/** Retake the repository's own state (pinned programs, receipts) into the ledger on disk and write it, after a
 * qualification run; nothing the archive said is asked again. */
export async function refreshLocalLedger<L>(archive: ArchiveLedger<L>): Promise<L> {
  if (!archive.local) throw new TypeError(`${archive.files.ledger} has no local pass.`);
  const { ledger } = await buildLedger(archive, ['--local']);
  await writeLedger(archive, ledger);
  return ledger;
}

/** An archive ledger's command: `[--write] [--local]` and whatever arguments the archive's own survey reads. */
export async function runArchiveLedger<L>(archive: ArchiveLedger<L>, args: readonly string[] = process.argv.slice(2)): Promise<L> {
  const write = args.includes('--write'), { ledger, local } = await buildLedger(archive, args);
  const policy = local ? archive.local!.writes : archive.writes;
  if (policy === 'always' || write) await writeLedger(archive, ledger);
  for (const line of archive.summary(ledger, { local, write })) console.log(line);
  if (archive.receiptProblems) reportReceiptProblems(archive.receiptProblems(ledger));
  if (local && archive.local?.exit) process.exit(process.exitCode ?? 0);
  return ledger;
}

/** True when the module at `url` is the program being run. */
export const isCommand = (url: string) => Boolean(process.argv[1]) && url === pathToFileURL(resolve(process.argv[1]!)).href;

/** What went wrong with one receipt, always said of the file it was in: a JSON parser names a position, not a file. */
export const receiptProblem = (file: string, error: unknown) => {
  const said = error instanceof Error ? error.message : String(error);
  return said.startsWith(`${file}:`) ? said : `${file}: ${said}`;
};

/** Every receipt problem, said once and counted against the run: a ledger that reports one has not proved what it lists. */
export const reportReceiptProblems = (problems: readonly string[]) => {
  for (const problem of problems) console.error(`RECEIPT ${problem}`);
  if (problems.length) process.exitCode = 1;
};

/** The guide paragraph that lists the receipts which could not be accepted. */
export const receiptProblemsParagraph = (problems: readonly string[]) => problems.length
  ? `${problems.length} receipt${problems.length === 1 ? '' : 's'} could not be accepted:\n\n${problems.map(problem => `- ${problem}`).join('\n')}`
  : 'None: every receipt beside a pinned program was accepted.';

/** The shipped object ids: the directories of src/objects, in the order the file system lists them. */
export async function shippedObjectIds(repository = REPOSITORY): Promise<string[]> {
  return (await readdir(resolve(repository, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
}

/** A record of counts read back from a ledger. */
export const countRecord = (value: unknown, label: string): Record<string, number> =>
  Object.fromEntries(Object.entries(requireRecord(value, label)).map(([key, count]) => [key, requireFiniteNumber(count, label)]));
/** A list of names read back from a ledger. */
export const nameList = (list: unknown, label: string): string[] => requireArray(list, label).map(name => requireString(name, label));
/** A number that a ledger may state as null. */
export const numberOrNull = (value: unknown, label: string): number | null => value === null ? null : requireFiniteNumber(value, label);
