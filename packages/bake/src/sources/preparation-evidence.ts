import type { PreparationEvidence } from '@cssearth/objects/provenance';
import type { ProvenanceDocument } from '@cssearth/objects/provenance';

/** Record that a byte-verified preparation produced this document: which object and which generator ran. */
export function recordPreparationEvidence(document: ProvenanceDocument): PreparationEvidence {
  if (document.basis !== 'prepared' || document.sources.some(s => s.verification !== 'bytes-verified') ||
      document.products.some(p => p.outputs.some(o => o.verification !== 'bytes-verified'))) {
    throw new TypeError('Preparation evidence requires a byte-verified preparation.');
  }
  return { objectId: document.objectId, verifier: { ...document.generator } };
}

/** A recorded preparation applies to the document of the object it was recorded for. */
export function preparationEvidenceApplies(document: ProvenanceDocument): boolean {
  return document.lastPreparation !== undefined && document.lastPreparation.objectId === document.objectId;
}
