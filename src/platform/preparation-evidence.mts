import type { ProvenanceDocument } from './object-provenance.mts';
import { sourceDigest, sourceObject, sourcePath, sourceText } from './source-catalog.mts';

/** The last byte-verified preparation, independent of later metadata recovery. */
export interface PreparationEvidence {
  readonly objectId: string;
  readonly materialSha256: string;
  readonly verifier: { readonly path: string };
  readonly record?: { readonly revision: string; readonly path: string };
}

/** Only consumed material and recipe bindings determine whether old byte evidence applies. */
export function preparationMaterial(document: ProvenanceDocument) {
  const order = <T extends { readonly id: string }>(values: readonly T[]) => [...values].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { objectId: document.objectId,
    sources: order(document.sources).map(s => ({ id: s.id, path: s.path, sha256: s.sha256, bytes: s.bytes, dependencies: [...s.dependencies].sort() })),
    recipes: order(document.recipes).map(r => ({ id: r.id, path: r.path, sha256: r.sha256 })),
    products: order(document.products).map(p => ({ id: p.id, recipe: p.recipe, selector: p.selector,
      recipeDependencies: [...p.recipeDependencies].sort(), inputs: [...p.inputs].sort(), parents: [...p.parents].sort(),
      outputs: [...p.outputs].sort((a, b) => a.url.localeCompare(b.url, 'en')).map(o => ({ url: o.url, sha256: o.sha256, bytes: o.bytes })) })) };
}

export function parsePreparationEvidence(raw: unknown): PreparationEvidence {
  const value = sourceObject(raw, ['objectId', 'materialSha256', 'verifier', 'record']);
  const verifier = sourceObject(value.verifier, ['path']);
  const parsed: PreparationEvidence = { objectId: sourceText(value.objectId), materialSha256: sourceDigest(value.materialSha256),
    verifier: { path: sourcePath(verifier.path) } };
  if (value.record === undefined) return parsed;
  const record = sourceObject(value.record, ['revision', 'path']);
  const revision = sourceText(record.revision);
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new TypeError('Historical preparation needs an exact revision.');
  return { ...parsed, record: { revision, path: sourcePath(record.path) } };
}
