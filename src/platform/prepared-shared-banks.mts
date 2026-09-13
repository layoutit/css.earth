import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode } from '../../tools/source-values.mts';
import { RUNTIME_SHARED_RULES, SHARED_BANK_KINDS, SHARED_PREPARED_FILES, collectSharedReferences, extractSharedValues,
  inlineSharedReferences, readSharedBankValue, sharedReferenceKey, sharedTwinName } from './prepared-shared.mts';
import type { SharedBank, SharedBankKind, SharedExtractionRule, SharedReference } from './prepared-shared.mts';

/** Bank owners: the Sun package holds solar-system point photometry and labels; the Milky Way holds the star catalogue. */
export const SHARED_BANK_DIRECTORIES: Readonly<Record<SharedBankKind, string>> = Object.freeze({
  'planet-points': 'src/objects/sun/prepared/shared/planet-points',
  'heliocentric-labels': 'src/objects/sun/prepared/shared/heliocentric-labels',
  'catalogue-stars': 'src/objects/milky-way/prepared/shared/catalogue-stars',
});
export const sha256Text = (text: string | Uint8Array): string => createHash('sha256').update(text).digest('hex');
export function sharedBankPath(root: string, reference: SharedReference): string {
  return resolve(root, SHARED_BANK_DIRECTORIES[reference.kind], `${reference.sha256}.json`);
}

export type PreparedTextReader = (path: string) => string | Promise<string>;
const readText: PreparedTextReader = path => readFile(path, 'utf8');
async function readOptional(path: string, read: PreparedTextReader): Promise<string | null> {
  try { return await read(path); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
}
async function writeUnchanged(path: string, contents: string): Promise<boolean> {
  if (await readOptional(path, readText) === contents) return false;
  await writeFile(path, contents);
  return true;
}

/** A bank's bytes must reproduce the reference before its value is trusted. */
export async function readSharedBank(root: string, reference: SharedReference, read: PreparedTextReader = readText): Promise<unknown> {
  const path = sharedBankPath(root, reference);
  const text = await readOptional(path, read);
  if (text === null) throw new TypeError(`Prepared shared bank ${sharedReferenceKey(reference)} is missing.`);
  if (sha256Text(text) !== reference.sha256) throw new TypeError(`Prepared shared bank ${sharedReferenceKey(reference)} does not reproduce its digest.`);
  return readSharedBankValue(reference, JSON.parse(text));
}

/** Inline every reference from the checked-in banks. `visited` collects the bank paths read. */
export async function inlineSharedFromBanks(root: string, value: unknown, { read = readText, visited }: { read?: PreparedTextReader; visited?: Set<string> } = {}): Promise<unknown> {
  const references = collectSharedReferences(value);
  if (!references.length) return value;
  const banks = new Map<string, unknown>();
  for (const reference of references) {
    banks.set(sharedReferenceKey(reference), await readSharedBank(root, reference, read));
    visited?.add(sharedBankPath(root, reference));
  }
  return inlineSharedReferences(value, banks);
}

export const extractPreparedShared = (value: unknown, rules: readonly SharedExtractionRule[] = RUNTIME_SHARED_RULES) => extractSharedValues(value, rules, sha256Text);

export async function writeSharedBanks(root: string, banks: Iterable<SharedBank>): Promise<number> {
  let written = 0;
  for (const bank of banks) {
    const path = sharedBankPath(root, bank.reference);
    await mkdir(resolve(path, '..'), { recursive: true });
    if (await writeUnchanged(path, bank.text)) written++;
  }
  return written;
}

/** Derive the checked-in twins and banks from a prepared directory's full files. */
export async function syncPreparedShared(root: string, preparedDirectory: string): Promise<{ twins: number; banks: number; references: Set<string> }> {
  let twins = 0, banks = 0;
  const references = new Set<string>();
  for (const [file, rules] of Object.entries(SHARED_PREPARED_FILES)) {
    const text = await readOptional(resolve(preparedDirectory, file), readText);
    if (text === null) continue;
    const shared = extractPreparedShared(JSON.parse(text), rules);
    banks += await writeSharedBanks(root, shared.banks.values());
    for (const key of shared.banks.keys()) references.add(key);
    for (const reference of collectSharedReferences(shared.value)) references.add(sharedReferenceKey(reference));
    if (await writeUnchanged(resolve(preparedDirectory, sharedTwinName(file)), `${JSON.stringify(shared.value)}\n`)) twins++;
  }
  return { twins, banks, references };
}

/** Rebuild the full prepared files from their twins; never bakes anything. */
export async function restorePreparedShared(root: string, preparedDirectory: string): Promise<{ written: number; reused: number }> {
  let written = 0, reused = 0;
  for (const file of Object.keys(SHARED_PREPARED_FILES)) {
    const text = await readOptional(resolve(preparedDirectory, sharedTwinName(file)), readText);
    if (text === null) continue;
    const value = await inlineSharedFromBanks(root, JSON.parse(text));
    if (await writeUnchanged(resolve(preparedDirectory, file), `${JSON.stringify(value)}\n`)) written++; else reused++;
  }
  return { written, reused };
}

export async function listSharedBankFiles(root: string): Promise<{ reference: SharedReference; path: string }[]> {
  const files = [];
  for (const kind of SHARED_BANK_KINDS) {
    let names: string[];
    try { names = await readdir(resolve(root, SHARED_BANK_DIRECTORIES[kind])); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    for (const name of names) {
      const match = name.match(/^([0-9a-f]{64})\.json$/u);
      if (!match) throw new TypeError(`Unexpected file in shared bank ${kind}: ${name}.`);
      files.push({ reference: { kind, sha256: match[1] }, path: resolve(root, SHARED_BANK_DIRECTORIES[kind], name) });
    }
  }
  return files;
}

/** Remove banks nothing references any more, after every object has been synced. */
export async function pruneSharedBanks(root: string, referenced: ReadonlySet<string>): Promise<number> {
  let removed = 0;
  for (const { reference, path } of await listSharedBankFiles(root)) {
    if (referenced.has(sharedReferenceKey(reference))) continue;
    await rm(path); removed++;
  }
  return removed;
}
