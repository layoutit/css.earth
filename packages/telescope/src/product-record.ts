import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
/** The one record every virtual telescope writes beside what it produces.
 *
 * The instruments stay different: an event list, a spectral cube, a calibrated image and a strip camera want different
 * operations, and each toolkit keeps its own. What they share is what a caller must be able to ask of any product:
 *
 * - **what went in**, exactly: every input by identity, byte count and available content digest;
 * - **how it was made**: the stage, its parameters, and the software with the versions and toolchain pin that ran;
 * - **what came out**, exactly: every output by path, byte count and content digest, with its units and conventions;
 * - **what was checked, and what that check means**: evidence names its kind. Agreement with the archive's own product,
 *   consistency between two of our own reductions, registration against geometry and agreement with a published value
 *   establish different things, and a receipt's existence establishes none of them: evidence is resolved by the exact
 *   product it names, and a caller asks for the kind it needs.
 *
 * A record is written by the run that made the outputs, from what that run actually used; nothing later rewrites it. A stage
 * may reuse an existing output only when the record beside it says the same inputs, parameters and software made it
 * (`sameRun`). Records hold no clock time, so the same run writes the same bytes. */

export const PRODUCT_RECORD_SCHEMA = 'cssearth-telescope-product@1';

/** What a check establishes.
 *
 * `archive-origin` is the one kind that is not a comparison. It says that the bytes a stage recorded are the observatory's own
 * final product, retrieved from the archive and recorded by name and size. It establishes origin, nothing more:
 * it is not `archive-agreement`, because nothing here was re-run and nothing was compared, and a caller asking whether a route
 * reproduces an observatory's calibration must never be answered with it.
 * `archive-retrieval-origin` establishes retrieval without claiming a final calibration level.
 * `archive-subset-origin` establishes the exact parent and server operation that returned the bytes;
 * it does not establish equivalence to the full parent or unchanged sampling. */
export const EVIDENCE_KINDS = ['archive-agreement', 'archive-origin', 'archive-retrieval-origin', 'archive-subset-origin', 'internal-consistency', 'geometric-registration', 'published-value'] as const;

export type EvidenceKind = typeof EVIDENCE_KINDS[number];

export interface ProductInput { readonly role: string; readonly identity: string; readonly bytes: number; readonly sha256?: string }

export interface ProductSoftware { readonly name: string; readonly version: string }

export interface ProductOutput { readonly path: string; readonly bytes: number; readonly sha256?: string; readonly units?: string; readonly conventions?: Readonly<Record<string, string>> }

export interface ProductEvidence { readonly kind: EvidenceKind; readonly receipt: string; readonly product: string; readonly establishes: string }

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

export function parseProductRecord(value: unknown): ProductRecord {
  const record = requireRecord(value, 'product record');
  if (record.schema !== PRODUCT_RECORD_SCHEMA) throw new TypeError(`Unsupported product record schema ${String(record.schema)}.`);
  const digest = (value: unknown, label: string): string | undefined => {
    if (value === undefined) return undefined; // Historical records can be read, but cannot be reused without a digest.
    const text = requireString(value, label);
    if (!/^[a-f0-9]{64}$/u.test(text)) throw new TypeError(`${label} must be a SHA-256 digest.`);
    return text;
  };
  const sized = <T extends { bytes: number }>(entry: T, label: string) => {
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw new TypeError(`${label} needs a byte count.`);
    return entry;
  };
  const inputs = requireArray(record.inputs, 'inputs').map((raw, index) => { const entry = requireRecord(raw, `input ${index}`), sha256 = digest(entry.sha256, 'input digest');
    return sized({ role: requireString(entry.role, 'input role'), identity: requireString(entry.identity, 'input identity'), bytes: requireFiniteNumber(entry.bytes, 'input bytes'),
      ...(sha256 ? { sha256 } : {}) }, `Input ${index}`); });
  const outputs = requireArray(record.outputs, 'outputs').map((raw, index) => { const entry = requireRecord(raw, `output ${index}`), sha256 = digest(entry.sha256, 'output digest');
    return sized({ path: requireString(entry.path, 'output path'), bytes: requireFiniteNumber(entry.bytes, 'output bytes'),
      ...(sha256 ? { sha256 } : {}),
      ...(entry.units === undefined ? {} : { units: requireString(entry.units, 'units') }),
      ...(entry.conventions === undefined ? {} : { conventions: Object.fromEntries(Object.entries(requireRecord(entry.conventions, 'conventions')).map(([key, text]) => [key, requireString(text, `convention ${key}`)])) }) }, `Output ${index}`); });
  const software = requireArray(record.software, 'software').map((raw, index) => { const entry = requireRecord(raw, `software ${index}`); return { name: requireString(entry.name, 'software name'), version: requireString(entry.version, 'software version') }; });
  const evidence = requireArray(record.evidence, 'evidence').map((raw, index) => { const entry = requireRecord(raw, `evidence ${index}`), kind = requireString(entry.kind, 'evidence kind');
    if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) throw new TypeError(`Evidence ${index} has no known kind (${kind}).`);
    const product = requireString(entry.product, 'evidence product');
    if (!outputs.some(output => output.path === product)) throw new TypeError(`Evidence ${index} names ${product}, which this record did not produce.`);
    return { kind: kind as EvidenceKind, receipt: requireString(entry.receipt, 'evidence receipt'), product, establishes: requireString(entry.establishes, 'evidence establishes') }; });
  if (!outputs.length) throw new TypeError('A product record names at least one output.');
  return { schema: PRODUCT_RECORD_SCHEMA, telescope: requireString(record.telescope, 'telescope'), stage: requireString(record.stage, 'stage'), inputs, parameters: requireRecord(record.parameters, 'parameters'), software,
    ...(record.toolchainDigest === undefined ? {} : { toolchainDigest: requireString(record.toolchainDigest, 'toolchainDigest') }), outputs, evidence };
}

/** Where a product's record sits: beside the product, under its own name. Every toolkit writes it there, so a reader holding a
 * product knows where its record is without knowing which telescope made it. */
export const productRecordPath = (product: string): string => `${product}.product.json`;

/** The evidence of one kind for one exact product. A caller that needs archive agreement asks for it by name; evidence of
 * another kind, or for another product, does not answer. */
export const evidenceFor = (record: ProductRecord, product: string, kind: EvidenceKind): readonly ProductEvidence[] =>
  record.evidence.filter(entry => entry.product === product && entry.kind === kind);
