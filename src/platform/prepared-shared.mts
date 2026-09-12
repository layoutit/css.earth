import { isArray } from './is-array.mts';

// A prepared value that repeats byte-for-byte across hundreds of bodies (the
// planet point photometry tables, the retained star catalogue, the heliocentric
// label set) is stored once in a content-addressed shared bank. Checked-in
// prepared files and the browser transport carry a reference in its place; the
// decoder inlines the bank before validation, so runtime still only decodes
// prepared state and never derives it.
export const PREPARED_SHARED_BANK_SCHEMA = 'cssearth-shared-bank@1';
export const SHARED_BANK_KINDS = Object.freeze(['planet-points', 'catalogue-stars', 'heliocentric-labels'] as const);
export type SharedBankKind = (typeof SHARED_BANK_KINDS)[number];
export interface SharedReference { readonly kind: SharedBankKind; readonly sha256: string; }
export const SHARED_REFERENCE_KEY = '$shared';
const SHA256 = /^[0-9a-f]{64}$/u;

export function isSharedBankKind(value: unknown): value is SharedBankKind {
  return typeof value === 'string' && (SHARED_BANK_KINDS as readonly string[]).includes(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !isArray(value);
}

/** `{ "$shared": { "kind", "sha256" } }` and nothing else. Anything close but different is an error, never data. */
export function sharedReference(value: unknown): SharedReference | null {
  if (!isRecord(value) || !(SHARED_REFERENCE_KEY in value)) return null;
  const reference = value[SHARED_REFERENCE_KEY];
  if (Object.keys(value).length !== 1 || !isRecord(reference) || Object.keys(reference).length !== 2 ||
      !isSharedBankKind(reference.kind) || typeof reference.sha256 !== 'string' || !SHA256.test(reference.sha256)) {
    throw new TypeError('Prepared shared reference is malformed.');
  }
  return { kind: reference.kind, sha256: reference.sha256 };
}
export function sharedReferenceKey({ kind, sha256 }: SharedReference): string { return `${kind}/${sha256}`; }
export function sharedReferenceValue(reference: SharedReference): Record<string, unknown> {
  return { [SHARED_REFERENCE_KEY]: { kind: reference.kind, sha256: reference.sha256 } };
}

/** Every distinct reference in a prepared value, in document order. */
export function collectSharedReferences(value: unknown): SharedReference[] {
  const seen = new Map<string, SharedReference>();
  const visit = (node: unknown): void => {
    if (isArray(node)) { for (const item of node) visit(item); return; }
    if (!isRecord(node)) return;
    const reference = sharedReference(node);
    if (reference) { seen.set(sharedReferenceKey(reference), reference); return; }
    for (const item of Object.values(node)) visit(item);
  };
  visit(value);
  return [...seen.values()];
}

/** Replace every reference with its bank value. Unreferenced structure keeps its identity and key order. */
export function inlineSharedReferences(value: unknown, banks: ReadonlyMap<string, unknown>): unknown {
  const visit = (node: unknown): unknown => {
    if (isArray(node)) {
      let out: unknown[] | null = null;
      node.forEach((item, index) => { const next = visit(item); if (next !== item) { out ??= [...node]; out[index] = next; } });
      return out ?? node;
    }
    if (!isRecord(node)) return node;
    const reference = sharedReference(node);
    if (reference) {
      const key = sharedReferenceKey(reference);
      if (!banks.has(key)) throw new TypeError(`Prepared shared bank ${key} is unavailable.`);
      return banks.get(key);
    }
    let out: Record<string, unknown> | null = null;
    for (const [name, item] of Object.entries(node)) { const next = visit(item); if (next !== item) { out ??= { ...node }; out[name] = next; } }
    return out ?? node;
  };
  return visit(value);
}

/** A shared bank file: the value plus the identity the decoder checks before using it. */
export function readSharedBankValue(reference: SharedReference, input: unknown): unknown {
  if (!isRecord(input) || input.schema !== PREPARED_SHARED_BANK_SCHEMA || input.kind !== reference.kind || !('value' in input) ||
      Object.keys(input).some(key => !['schema', 'kind', 'label', 'value'].includes(key)) ||
      (input.label !== undefined && typeof input.label !== 'string')) {
    throw new TypeError(`Prepared shared bank ${sharedReferenceKey(reference)} is not a ${reference.kind} bank.`);
  }
  return input.value;
}

/** Where shared values sit inside prepared files. `*` matches every array index. */
export interface SharedExtractionRule { readonly kind: SharedBankKind; readonly path: readonly string[]; }
export const RUNTIME_SHARED_RULES: readonly SharedExtractionRule[] = Object.freeze([
  { kind: 'planet-points', path: ['heliocentricView', 'plan', 'system', 'bodies', '*', 'pointPresentation', 'samples'] },
  { kind: 'catalogue-stars', path: ['sky', 'catalogueStars', 'retained'] },
  { kind: 'heliocentric-labels', path: ['heliocentricView', 'labels'] },
]);
/** The scene keeps the heliocentric plan one level up and carries no label set. */
export const SCENE_SHARED_RULES: readonly SharedExtractionRule[] = Object.freeze([
  { kind: 'planet-points', path: ['heliocentricView', 'system', 'bodies', '*', 'pointPresentation', 'samples'] },
  { kind: 'catalogue-stars', path: ['sky', 'catalogueStars', 'retained'] },
]);
export const SKY_SHARED_RULES: readonly SharedExtractionRule[] = Object.freeze([
  { kind: 'catalogue-stars', path: ['catalogueStars', 'retained'] },
]);
/** Prepared files with shared values, and the checked-in twin that carries references instead. */
export const SHARED_PREPARED_FILES: Readonly<Record<string, readonly SharedExtractionRule[]>> = Object.freeze({
  'runtime.json': RUNTIME_SHARED_RULES, 'scene.json': SCENE_SHARED_RULES, 'sky.json': SKY_SHARED_RULES,
});
export function sharedTwinName(file: string): string {
  if (!file.endsWith('.json')) throw new TypeError(`Prepared file ${file} has no shared twin.`);
  return `${file.slice(0, -'.json'.length)}.refs.json`;
}

export interface SharedBank { readonly reference: SharedReference; readonly label?: string; readonly text: string; }
/** Replace each rule target with a reference; the caller stores the banks. Already-referenced targets stay as they are. */
export function extractSharedValues(value: unknown, rules: readonly SharedExtractionRule[], digest: (text: string) => string): { value: unknown; banks: Map<string, SharedBank> } {
  const banks = new Map<string, SharedBank>();
  const bank = (kind: SharedBankKind, target: unknown, label: string | undefined) => {
    const text = sharedBankText(kind, target, label), sha256 = digest(text), reference = { kind, sha256 };
    const key = sharedReferenceKey(reference);
    if (!banks.has(key)) banks.set(key, { reference, ...(label ? { label } : {}), text });
    return sharedReferenceValue(reference);
  };
  const visit = (node: unknown, rule: SharedExtractionRule, index: number, label: string | undefined): unknown => {
    if (index === rule.path.length) return sharedReference(node) ? node : bank(rule.kind, node, label);
    const step = rule.path[index];
    if (step === '*') {
      if (!isArray(node)) return node;
      let out: unknown[] | null = null;
      node.forEach((item, i) => { const next = visit(item, rule, index + 1, isRecord(item) && typeof item.id === 'string' ? item.id : label); if (next !== item) { out ??= [...node]; out[i] = next; } });
      return out ?? node;
    }
    if (!isRecord(node) || !(step in node)) return node;
    const next = visit(node[step], rule, index + 1, label);
    return next === node[step] ? node : { ...node, [step]: next };
  };
  let result = value;
  for (const rule of rules) result = visit(result, rule, 0, undefined);
  return { value: result, banks };
}
export function sharedBankText(kind: SharedBankKind, value: unknown, label?: string): string {
  return `${JSON.stringify({ schema: PREPARED_SHARED_BANK_SCHEMA, kind, ...(label ? { label } : {}), value })}\n`;
}
