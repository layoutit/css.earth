import type { ProvenanceDocument, ProvenanceProduct } from './object-provenance.mts';
import { sourceArray, sourceEnum, sourceObject, sourceText } from './source-catalog.mts';

export const INPUT_ROLES = ['appearance', 'geometry', 'placement', 'registration', 'calibration', 'reference', 'unknown'] as const;
export type InputRole = typeof INPUT_ROLES[number];
export interface ProductInputEvidence { readonly sourceId: string; readonly role: InputRole; readonly evidence: string; }
export function parseProductInputEvidence(raw: unknown): ProductInputEvidence {
  const value = sourceObject(raw, ['sourceId', 'role', 'evidence']);
  return { sourceId: sourceText(value.sourceId), role: sourceEnum(value.role, INPUT_ROLES), evidence: sourceText(value.evidence) };
}

/** A parent's role is retained; an acquisition dependency's role is unknown unless declared. */
export function productInputRoles(document: ProvenanceDocument, productId: string,
  accept: (product: ProvenanceProduct) => boolean = () => true): ReadonlyMap<string, readonly InputRole[]> {
  const roles = new Map<string, Set<InputRole>>(), products = new Map(document.products.map(p => [p.id, p]));
  const sources = new Map(document.sources.map(s => [s.id, s])), visited = new Set<string>();
  const add = (sourceId: string, role: InputRole) => {
    const values = roles.get(sourceId) ?? new Set<InputRole>(); values.add(role); roles.set(sourceId, values);
  };
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const product = products.get(id);
    if (!product) throw new TypeError(`Unknown provenance product: ${id}.`);
    if (!accept(product)) return;
    for (const sourceId of product.inputs) {
      const evidence = product.inputEvidence?.filter(e => e.sourceId === sourceId) ?? [];
      if (!evidence.length) add(sourceId, 'unknown');
      else evidence.forEach(e => add(sourceId, e.role));
    }
    product.parents.forEach(visit);
  };
  visit(productId);
  const expanded = new Set<string>();
  const dependencies = (id: string) => {
    if (expanded.has(id)) return;
    expanded.add(id);
    const source = sources.get(id);
    if (!source) throw new TypeError(`Unknown provenance source: ${id}.`);
    for (const dependency of source.dependencies) {
      if (!roles.has(dependency)) add(dependency, 'unknown');
      dependencies(dependency);
    }
  };
  [...roles.keys()].forEach(dependencies);
  return new Map([...roles].map(([id, values]) => [id, [...values].sort()]));
}

export function validateInputEvidence(product: ProvenanceProduct): void {
  const records = sourceArray(product.inputEvidence ?? [], parseProductInputEvidence), seen = new Set<string>();
  for (const record of records) {
    const key = `${record.sourceId}/${record.role}`;
    if (!product.inputs.includes(record.sourceId) || seen.has(key)) throw new TypeError('Input evidence must identify a unique consumed input and role.');
    seen.add(key);
  }
}
