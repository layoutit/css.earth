/** The one record every virtual telescope writes beside what it produces.
 *
 * The instruments stay different: an event list, a spectral cube, a calibrated image and a strip camera want different
 * operations, and each toolkit keeps its own. What they share is what a caller must be able to ask of any product:
 *
 * - **what went in**, exactly: every input by identity, byte count and sha256;
 * - **how it was made**: the stage, its parameters, and the software with the versions and toolchain pin that ran;
 * - **what came out**, exactly: every output by path, byte count and sha256, with its units and conventions;
 * - **what was checked, and what that check means**: evidence names its kind. Agreement with the archive's own product,
 *   consistency between two of our own reductions, registration against geometry and agreement with a published value
 *   establish different things, and a receipt's existence establishes none of them: evidence is resolved by the exact
 *   product it names, and a caller asks for the kind it needs.
 *
 * A record is written by the run that made the outputs, from what that run actually used; nothing later rewrites it. A stage
 * may reuse an existing output only when the record beside it says the same inputs, parameters and software made it
 * (`sameRun`). Records hold no clock time, so the same run writes the same bytes. */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { sha256, sha256File } from '../../src/platform/sha256.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';

export const PRODUCT_RECORD_SCHEMA = 'cssearth-telescope-product@1';

/** What a check establishes.
 *
 * `archive-origin` is the one kind that is not a comparison. It says that the bytes a stage recorded are the observatory's own
 * final product, retrieved from the archive and pinned by size and sha256. It establishes origin and integrity, nothing more:
 * it is not `archive-agreement`, because nothing here was re-run and nothing was compared, and a caller asking whether a route
 * reproduces an observatory's calibration must never be answered with it.
 * `archive-retrieval-origin` establishes retrieval without claiming a final calibration level.
 * `archive-subset-origin` establishes the exact parent and server operation that returned the bytes;
 * it does not establish equivalence to the full parent or unchanged sampling. */
export const EVIDENCE_KINDS = ['archive-agreement', 'archive-origin', 'archive-retrieval-origin', 'archive-subset-origin', 'internal-consistency', 'geometric-registration', 'published-value'] as const;
export type EvidenceKind = typeof EVIDENCE_KINDS[number];

export interface ProductInput { readonly role: string; readonly identity: string; readonly bytes: number; readonly sha256: string }
export interface ProductSoftware { readonly name: string; readonly version: string }
export interface ProductOutput { readonly path: string; readonly bytes: number; readonly sha256: string; readonly units?: string; readonly conventions?: Readonly<Record<string, string>> }
export interface ProductEvidence { readonly kind: EvidenceKind; readonly receipt: string; readonly receiptPin?: { readonly bytes: number; readonly sha256: string }; readonly product: string; readonly establishes: string }
/** What identifies a run: the same run makes the same outputs. */
export interface ProductRun {
  readonly telescope: string; readonly stage: string;
  readonly inputs: readonly ProductInput[];
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly software: readonly ProductSoftware[];
  /** Digest of the toolchain pin the software was installed from, where the toolkit has one. */
  readonly toolchainDigest?: string;
}
export interface ProductRecord extends ProductRun { readonly schema: typeof PRODUCT_RECORD_SCHEMA; readonly outputs: readonly ProductOutput[]; readonly evidence: readonly ProductEvidence[] }

const HEX64 = /^[0-9a-f]{64}$/u;
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonical(entry)]))
  : value;

/** One digest for a run: key order and input order do not change it, any value does. */
export function runDigest(run: ProductRun): string {
  const inputs = [...run.inputs].sort((a, b) => a.role < b.role ? -1 : a.role > b.role ? 1 : a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0);
  return sha256(JSON.stringify(canonical({ telescope: run.telescope, stage: run.stage, inputs, parameters: run.parameters, software: run.software, toolchainDigest: run.toolchainDigest ?? null })));
}

export function parseProductRecord(value: unknown): ProductRecord {
  const record = requireRecord(value, 'product record');
  if (record.schema !== PRODUCT_RECORD_SCHEMA) throw new TypeError(`Unsupported product record schema ${String(record.schema)}.`);
  const pinned = <T extends { bytes: number; sha256: string }>(entry: T, label: string) => {
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !HEX64.test(entry.sha256)) throw new TypeError(`${label} needs a byte count and a sha256.`);
    return entry;
  };
  const inputs = requireArray(record.inputs, 'inputs').map((raw, index) => { const entry = requireRecord(raw, `input ${index}`);
    return pinned({ role: requireString(entry.role, 'input role'), identity: requireString(entry.identity, 'input identity'), bytes: requireFiniteNumber(entry.bytes, 'input bytes'), sha256: requireString(entry.sha256, 'input sha256') }, `Input ${index}`); });
  const outputs = requireArray(record.outputs, 'outputs').map((raw, index) => { const entry = requireRecord(raw, `output ${index}`);
    return pinned({ path: requireString(entry.path, 'output path'), bytes: requireFiniteNumber(entry.bytes, 'output bytes'), sha256: requireString(entry.sha256, 'output sha256'),
      ...(entry.units === undefined ? {} : { units: requireString(entry.units, 'units') }),
      ...(entry.conventions === undefined ? {} : { conventions: Object.fromEntries(Object.entries(requireRecord(entry.conventions, 'conventions')).map(([key, text]) => [key, requireString(text, `convention ${key}`)])) }) }, `Output ${index}`); });
  const software = requireArray(record.software, 'software').map((raw, index) => { const entry = requireRecord(raw, `software ${index}`); return { name: requireString(entry.name, 'software name'), version: requireString(entry.version, 'software version') }; });
  const evidence = requireArray(record.evidence, 'evidence').map((raw, index) => { const entry = requireRecord(raw, `evidence ${index}`), kind = requireString(entry.kind, 'evidence kind');
    if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) throw new TypeError(`Evidence ${index} has no known kind (${kind}).`);
    const product = requireString(entry.product, 'evidence product');
    if (!outputs.some(output => output.path === product)) throw new TypeError(`Evidence ${index} names ${product}, which this record did not produce.`);
    const pin = entry.receiptPin === undefined ? undefined : requireRecord(entry.receiptPin, 'receipt pin');
    return { kind: kind as EvidenceKind, receipt: requireString(entry.receipt, 'evidence receipt'),
      ...(pin ? { receiptPin: pinned({ bytes: requireFiniteNumber(pin.bytes, 'receipt bytes'), sha256: requireString(pin.sha256, 'receipt digest') }, 'Receipt') } : {}),
      product, establishes: requireString(entry.establishes, 'evidence establishes') }; });
  if (!outputs.length) throw new TypeError('A product record names at least one output.');
  return { schema: PRODUCT_RECORD_SCHEMA, telescope: requireString(record.telescope, 'telescope'), stage: requireString(record.stage, 'stage'), inputs, parameters: requireRecord(record.parameters, 'parameters'), software,
    ...(record.toolchainDigest === undefined ? {} : { toolchainDigest: requireString(record.toolchainDigest, 'toolchainDigest') }), outputs, evidence };
}

/** The identity of a file as it is on disk now. */
export async function pinFile(path: string): Promise<{ bytes: number; sha256: string }> { return sha256File(path); }

/** Refuse inputs that are not the pinned ones, before anything reads them. `files` maps each pin's identity to where it is. */
export async function assertInputPins(pins: readonly ProductInput[], files: ReadonlyMap<string, string>): Promise<void> {
  for (const pin of pins) {
    const path = files.get(pin.identity);
    if (!path) throw new Error(`No file was given for the pinned input ${pin.identity} (${pin.role}).`);
    const found = await pinFile(path).catch(() => null);
    if (!found) throw new Error(`The pinned input ${pin.identity} is not at ${path}.`);
    if (found.bytes !== pin.bytes || found.sha256 !== pin.sha256) throw new Error(`${path} is not the pinned ${pin.identity}: ${found.bytes} bytes, sha256 ${found.sha256}; the pin says ${pin.bytes} bytes, ${pin.sha256}.`);
  }
}

/** Write the record of a run beside its outputs. Outputs are pinned as they are on disk at this moment, by the run that made them. */
export async function writeProductRecord(path: string, run: ProductRun, outputs: readonly { path: string; file: string; units?: string; conventions?: Readonly<Record<string, string>> }[], evidence: readonly ProductEvidence[] = []): Promise<ProductRecord> {
  const pinned: ProductOutput[] = [];
  for (const output of outputs) pinned.push({ path: output.path, ...(await pinFile(output.file)), ...(output.units === undefined ? {} : { units: output.units }), ...(output.conventions === undefined ? {} : { conventions: output.conventions }) });
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
    const found = await pinFile(locate(output.path)).catch(() => null);
    if (!found || found.bytes !== output.bytes || found.sha256 !== output.sha256) return false;
  }
  for (const entry of record.evidence) if (entry.receiptPin) {
    const found = await pinFile(locate(entry.receipt)).catch(() => null);
    if (!found || found.bytes !== entry.receiptPin.bytes || found.sha256 !== entry.receiptPin.sha256) return false;
  }
  return true;
}

/** Where a product's record sits: beside the product, under its own name. Every toolkit writes it there, so a reader holding a
 * product knows where its record is without knowing which telescope made it. */
export const productRecordPath = (product: string): string => `${product}.product.json`;

/** Add what a later check established to the record of the run that made the product: the one way evidence reaches a record.
 * Only the evidence list is written, so the run facts stay the ones that run recorded. The outputs must still be the files the
 * record pins, or the check was of something else. Re-running a check replaces its own entry rather than adding a second, so a
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
    return { ...entry, receipt, receiptPin: { bytes: bytes.length, sha256: digest } };
  }));
  const kept = record.evidence.filter(held => !pinned.some(added => added.kind === held.kind && added.product === held.product && (!held.receiptPin || added.receipt === held.receipt)));
  const updated = parseProductRecord({ ...record, evidence: [...kept, ...pinned] });
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}

/** The evidence of one kind for one exact product. A caller that needs archive agreement asks for it by name; evidence of
 * another kind, or for another product, does not answer. */
export const evidenceFor = (record: ProductRecord, product: string, kind: EvidenceKind): readonly ProductEvidence[] =>
  record.evidence.filter(entry => entry.product === product && entry.kind === kind);
