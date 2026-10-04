import type { ProductRecord, ProductEvidence, EvidenceKind } from '@cssearth/objects';

/** Where a product's record sits: beside the product, under its own name. Every toolkit writes it there, so a reader holding a
 * product knows where its record is without knowing which telescope made it. */
export const productRecordPath = (product: string): string => `${product}.product.json`;

/** The evidence of one kind for one exact product. A caller that needs archive agreement asks for it by name; evidence of
 * another kind, or for another product, does not answer. */
export const evidenceFor = (record: ProductRecord, product: string, kind: EvidenceKind): readonly ProductEvidence[] =>
  record.evidence.filter(entry => entry.product === product && entry.kind === kind);
