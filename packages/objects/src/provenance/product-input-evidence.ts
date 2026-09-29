import type { LineageProduct, ObjectLineage } from './object-lineage.js';
import { sourceEnum, sourceObject, sourceText } from '../sources/catalog.js';

export const INPUT_ROLES = ['appearance', 'geometry', 'placement', 'registration', 'calibration', 'reference', 'unknown'] as const;
export type InputRole = typeof INPUT_ROLES[number];
export interface ProductInputEvidence { readonly sourceId: string; readonly role: InputRole; readonly evidence: string; }
export function parseProductInputEvidence(raw: unknown): ProductInputEvidence {
  const value = sourceObject(raw, ['sourceId', 'role', 'evidence']);
  return { sourceId: sourceText(value.sourceId), role: sourceEnum(value.role, INPUT_ROLES), evidence: sourceText(value.evidence) };
}

/** A parent's role is retained; an acquisition dependency's role is unknown unless declared. */
export function productInputRoles(document: ObjectLineage, productId: string,
  accept: (product: LineageProduct) => boolean = () => true): ReadonlyMap<string, readonly InputRole[]> {
  const roles = new Map<string, Set<InputRole>>(), products = new Map(document.products.map(p => [p.id, p]));
  const sources = new Map(document.sources.map(s => [s.id, s])), visited = new Set<string>();
  const add = (sourceId: string, role: InputRole) => {
    const values = roles.get(sourceId) ?? new Set<InputRole>(); values.add(role); roles.set(sourceId, values);
  };
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const product = products.get(id);
    if (!product) throw new TypeError(`Unknown lineage product: ${id}.`);
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
    if (!source) throw new TypeError(`Unknown lineage source: ${id}.`);
    for (const dependency of source.dependencies) {
      if (!roles.has(dependency)) add(dependency, 'unknown');
      dependencies(dependency);
    }
  };
  [...roles.keys()].forEach(dependencies);
  return new Map([...roles].map(([id, values]) => [id, [...values].sort()]));
}

