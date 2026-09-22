import { createHash } from 'node:crypto';
import { preparationMaterial } from '../../src/platform/preparation-evidence.mts';
import type { PreparationEvidence } from '../../src/platform/preparation-evidence.mts';
import type { ProvenanceDocument } from '../../src/platform/object-provenance.mts';

export const preparationMaterialDigest = (document: ProvenanceDocument) =>
  createHash('sha256').update(JSON.stringify(preparationMaterial(document))).digest('hex');

export function recordPreparationEvidence(document: ProvenanceDocument): PreparationEvidence {
  if (document.basis !== 'prepared' || document.sources.some(s => s.verification !== 'bytes-verified') ||
      document.products.some(p => p.outputs.some(o => o.verification !== 'bytes-verified'))) {
    throw new TypeError('Preparation evidence requires a byte-verified preparation.');
  }
  return { objectId: document.objectId, materialSha256: preparationMaterialDigest(document), verifier: { ...document.generator } };
}

export function preparationEvidenceApplies(document: ProvenanceDocument): boolean {
  return document.lastPreparation !== undefined && document.lastPreparation.objectId === document.objectId &&
    document.lastPreparation.materialSha256 === preparationMaterialDigest(document);
}
