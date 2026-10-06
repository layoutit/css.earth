import { sourceEnum, sourceObject, sourceText } from '../sources/catalog.js';

export const INPUT_ROLES = ['appearance', 'geometry', 'placement', 'registration', 'calibration', 'reference', 'unknown'] as const;
export type InputRole = typeof INPUT_ROLES[number];
export interface ProductInputEvidence { readonly sourceId: string; readonly role: InputRole; readonly evidence: string; }
export function parseProductInputEvidence(raw: unknown): ProductInputEvidence {
  const value = sourceObject(raw, ['sourceId', 'role', 'evidence']);
  return { sourceId: sourceText(value.sourceId), role: sourceEnum(value.role, INPUT_ROLES), evidence: sourceText(value.evidence) };
}
