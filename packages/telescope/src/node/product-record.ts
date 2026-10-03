/** Product records on disk: writing a run's record beside its outputs, reading it back, and deciding from the files on disk
 * whether a stage may reuse what an earlier run made. The record and the rules it is parsed by are in the main entry. */
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { canonical } from '@cssearth/core';
import { parseProductRecord, PRODUCT_RECORD_SCHEMA, type ProductEvidence, type ProductInput, type ProductOutput, type ProductRecord, type ProductRun } from '@cssearth/objects';

/** One key for a run: the canonical text of its facts. Key order and input order do not change it, any value does. */
export function runKey(run: ProductRun): string {
  const inputs = [...run.inputs].sort((a, b) => a.role < b.role ? -1 : a.role > b.role ? 1 : a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0);
  return JSON.stringify(canonical({ telescope: run.telescope, stage: run.stage, inputs, parameters: run.parameters, software: run.software }));
}

/** The size of a file as it is on disk now. */
export async function fileSize(path: string): Promise<{ bytes: number }> { return { bytes: (await stat(path)).size }; }

/** Refuse inputs that are missing or not the recorded size, before anything reads them. `files` maps each input's identity to where it is. */
export async function assertInputs(inputs: readonly ProductInput[], files: ReadonlyMap<string, string>): Promise<void> {
  for (const input of inputs) {
    const path = files.get(input.identity);
    if (!path) throw new Error(`No file was given for the input ${input.identity} (${input.role}).`);
    const found = await fileSize(path).catch(() => null);
    if (!found) throw new Error(`The input ${input.identity} (${input.role}) is not at ${path}.`);
    if (found.bytes !== input.bytes)
      throw new Error(`${path} is not the recorded ${input.identity} (${input.role}): bytes is ${found.bytes}, the record says ${input.bytes}.`);
  }
}

/** Write the record of a run beside its outputs. Outputs are recorded as they are on disk at this moment, by the run that made them. */
export async function writeProductRecord(path: string, run: ProductRun, outputs: readonly { path: string; file: string; units?: string; conventions?: Readonly<Record<string, string>> }[], evidence: readonly ProductEvidence[] = []): Promise<ProductRecord> {
  const recorded: ProductOutput[] = [];
  for (const output of outputs) recorded.push({ path: output.path, ...(await fileSize(output.file)), ...(output.units === undefined ? {} : { units: output.units }), ...(output.conventions === undefined ? {} : { conventions: output.conventions }) });
  const record = parseProductRecord({ schema: PRODUCT_RECORD_SCHEMA, ...run, outputs: recorded, evidence });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export const readProductRecord = async (path: string): Promise<ProductRecord | null> => readFile(path, 'utf8').then(text => parseProductRecord(JSON.parse(text) as unknown), () => null);

/** True when the record beside some outputs was written by this same run AND every output it names is still on disk at the
 * recorded size. `locate` turns a recorded output path into where that file is. Anything else (no record, another run, a
 * missing or resized output) is false, and the stage runs again. */
export async function sameRun(record: ProductRecord | null, run: ProductRun, locate: (path: string) => string): Promise<boolean> {
  if (!record || runKey(record) !== runKey(run)) return false;
  for (const output of record.outputs) {
    const found = await fileSize(locate(output.path)).catch(() => null);
    if (!found || found.bytes !== output.bytes) return false;
  }
  return true;
}

/** Add what a later check established to the record of the run that made the product: the one way evidence reaches a record.
 * Only the evidence list is written, so the run facts stay the ones that run recorded. The outputs must still be the files the
 * record names, or the check was of something else. Re-running a check replaces its own entry and its receipt copy rather than
 * adding a second, so a comparison run twice leaves the same files. */
export async function addProductEvidence(path: string, entries: readonly ProductEvidence[], locate: (output: string) => string,
  locateReceipt = (receipt: string) => resolve(dirname(path), receipt)): Promise<ProductRecord> {
  const record = await readProductRecord(path);
  if (!record) throw new Error(`There is no product record at ${path}: the stage that made this product writes one, and evidence is added to it.`);
  if (!await sameRun(record, record, locate)) throw new Error(`The products ${path} records are not the files on disk now; evidence about other files is refused.`);
  const copied = await Promise.all(entries.map(async entry => {
    // A copy named by product and kind stays beside the exact product; latest/index receipts may subsequently change.
    const receipt = `${basename(entry.product)}.${entry.kind}.evidence.json`, source = locateReceipt(entry.receipt), destination = resolve(dirname(path), receipt);
    if (resolve(source) !== destination) await copyFile(source, destination);
    return { ...entry, receipt };
  }));
  const kept = record.evidence.filter(held => !copied.some(added => added.kind === held.kind && added.product === held.product));
  const updated = parseProductRecord({ ...record, evidence: [...kept, ...copied] });
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}
