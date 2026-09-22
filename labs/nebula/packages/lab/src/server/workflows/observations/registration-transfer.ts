/** Transfer a qualified native grid without inventing stellar matches in nonstellar bands. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { composeAffine, type Affine, type verifyRegistration } from '@cssearth/nebula-reconstruction/registration/stellar';
import type { ObservationSource } from '../../../features/observations/recipe.js';

type DirectEvidence = ReturnType<typeof verifyRegistration>['evidence'];
export type RegistrationEvidence = Omit<DirectEvidence, 'status'> & {
  status: 'verified' | 'publisher' | 'transferred'; referenceId: string;
  bridgeMatchedStars?: number; transferEvidenceSha256?: string;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid registration transfer evidence.');
  return value as Record<string, unknown>;
};
export function validateTransferEvidence(value: unknown, source: ObservationSource, reference: ObservationSource): void {
  const row = record(value), transfer = source.registrationTransfer;
  if (!transfer || row.schema !== 'cssearth-observation-grid-transfer@1') throw new TypeError('Unsupported registration transfer evidence.');
  for (const [key, image] of [['source', source], ['reference', reference]] as const) {
    const pin = record(row[key]);
    if (pin.id !== image.id || pin.width !== image.width || pin.height !== image.height || pin.url !== image.url)
      throw new Error(`Registration transfer ${key} pin differs.`);
  }
  if (transfer.referenceId !== reference.id || JSON.stringify(row.pixelToReference) !== JSON.stringify(transfer.pixelToReference) ||
      !Array.isArray(row.evidenceUrls) || !row.evidenceUrls.length || row.evidenceUrls.some(url => typeof url !== 'string' || !url.startsWith('https://')) ||
      typeof row.interpretation !== 'string' || !row.interpretation.trim()) throw new Error('Registration transfer grid/evidence differs.');
}
export async function verifyTransferPins(source: ObservationSource, reference: ObservationSource): Promise<void> {
  const transfer = source.registrationTransfer;
  if (!transfer) throw new Error('Registration transfer is not configured.');
  const bytes = await readFile(transfer.evidence.path);
  validateTransferEvidence(JSON.parse(bytes.toString()), source, reference);
}
export async function transferRegistration(source: ObservationSource, reference: ObservationSource,
  referenceMatrix: Affine, referenceEvidence: RegistrationEvidence): Promise<{ matrix: Affine; evidence: RegistrationEvidence }> {
  const transfer = source.registrationTransfer;
  if (!transfer || referenceEvidence.status !== 'verified' || referenceEvidence.matchedStars < 45 || referenceEvidence.matches.length < 45)
    throw new Error('Registration transfer requires a directly star-verified bridge.');
  await verifyTransferPins(source, reference);
  return { matrix: composeAffine(referenceMatrix, transfer.pixelToReference), evidence: {
    ...referenceEvidence, status: 'transferred', referenceId: reference.id, matchedStars: 0, matches: [],
    bridgeMatchedStars: referenceEvidence.matchedStars,
    interpretation: 'Publisher-documented shared native grid transferred through a directly star-verified bridge. Residuals and coverage describe bridge stars; this band has no independently measured stellar residuals. Band-to-band publisher calibration remains a limitation.'
  } };
}
