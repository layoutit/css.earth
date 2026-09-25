/** Product records on disk: writing a run's record beside its outputs, reading it back, and deciding from the bytes on disk
 * whether a stage may reuse what an earlier run made. The record and the rules it is parsed by are in the main entry. */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { canonical } from '@cssearth/core';
import { sha256, sha256File } from '@cssearth/core/node';
import { parseProductRecord, PRODUCT_RECORD_SCHEMA, type ProductEvidence, type ProductInput, type ProductOutput, type ProductRecord, type ProductRun } from '../product-record.js';

/** One digest for a run: key order and input order do not change it, any value does. */
export function runDigest(run: ProductRun): string {
  const inputs = [...run.inputs].sort((a, b) => a.role < b.role ? -1 : a.role > b.role ? 1 : a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0);
  return sha256(JSON.stringify(canonical({ telescope: run.telescope, stage: run.stage, inputs, parameters: run.parameters, software: run.software, toolchainDigest: run.toolchainDigest ?? null })));
}

/** The size of a file as it is on disk now. */
export async function fileSize(path: string): Promise<{ bytes: number }> { return { bytes: (await stat(path)).size }; }

/** Refuse inputs that are not the recorded ones, before anything reads them. `files` maps each input's identity to where it is. */
export async function assertInputPins(inputs: readonly ProductInput[], files: ReadonlyMap<string, string>): Promise<void> {
  for (const input of inputs) {
    const path = files.get(input.identity);
    if (!path) throw new Error(`No file was given for the input ${input.identity} (${input.role}).`);
    const found = await (input.sha256 ? sha256File(path) : fileSize(path)).catch(() => null);
    if (!found) throw new Error(`The input ${input.identity} is not at ${path}.`);
    if (found.bytes !== input.bytes || input.sha256 && 'sha256' in found && found.sha256 !== input.sha256)
      throw new Error(`${path} is not the recorded ${input.identity}: byte count or SHA-256 changed.`);
  }
}

/** Write the record of a run beside its outputs. Outputs are recorded as they are on disk at this moment, by the run that made them. */
export async function writeProductRecord(path: string, run: ProductRun, outputs: readonly { path: string; file: string; units?: string; conventions?: Readonly<Record<string, string>> }[], evidence: readonly ProductEvidence[] = []): Promise<ProductRecord> {
  const pinned: ProductOutput[] = [];
  for (const output of outputs) pinned.push({ path: output.path, ...(await sha256File(output.file)), ...(output.units === undefined ? {} : { units: output.units }), ...(output.conventions === undefined ? {} : { conventions: output.conventions }) });
  const record = parseProductRecord({ schema: PRODUCT_RECORD_SCHEMA, ...run, outputs: pinned, evidence });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export const readProductRecord = async (path: string): Promise<ProductRecord | null> => readFile(path, 'utf8').then(text => parseProductRecord(JSON.parse(text) as unknown), () => null);

/** True when the record beside some outputs was written by this same run AND the outputs on disk are still the ones it made.
 * `locate` turns a recorded output path into where that file is. Anything else (no record, another run, a changed or missing
 * output) is false, and the stage runs again. */
export async function sameRun(record: ProductRecord | null, run: ProductRun, locate: (path: string) => string): Promise<boolean> {
  if (!record || runDigest(record) !== runDigest(run)) return false;
  for (const output of record.outputs) {
    if (!output.sha256) return false;
    const found = await sha256File(locate(output.path)).catch(() => null);
    if (!found || found.bytes !== output.bytes || found.sha256 !== output.sha256) return false;
  }
  return true;
}

/** Add what a later check established to the record of the run that made the product: the one way evidence reaches a record.
 * Only the evidence list is written, so the run facts stay the ones that run recorded. The outputs must still be the files the
 * record names, or the check was of something else. Re-running a check replaces its own entry rather than adding a second, so a
 * comparison run twice leaves the same bytes. */
export async function addProductEvidence(path: string, entries: readonly ProductEvidence[], locate: (output: string) => string,
  locateReceipt = (receipt: string) => resolve(dirname(path), receipt)): Promise<ProductRecord> {
  const record = await readProductRecord(path);
  if (!record) throw new Error(`There is no product record at ${path}: the stage that made this product writes one, and evidence is added to it.`);
  if (!await sameRun(record, record, locate)) throw new Error(`The products ${path} records are not the files on disk now; evidence about other files is refused.`);
  const pinned = await Promise.all(entries.map(async entry => {
    const bytes = await readFile(locateReceipt(entry.receipt)), digest = sha256(bytes);
    const receipt = `${basename(entry.product)}.${digest}.evidence.json`, destination = resolve(dirname(path), receipt);
    // An immutable snapshot stays beside the exact product; latest/index receipts may subsequently change.
    await writeFile(destination, bytes, { flag: 'wx' }).catch(async (error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || sha256(await readFile(destination)) !== digest) throw error;
    });
    return { ...entry, receipt };
  }));
  const kept = record.evidence.filter(held => !pinned.some(added => added.kind === held.kind && added.product === held.product));
  const updated = parseProductRecord({ ...record, evidence: [...kept, ...pinned] });
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}
