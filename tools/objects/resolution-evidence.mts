/** Resolution numbers only answer a request when their basis supports that claim. */
import { requireRecord, requireString } from '../sources/source-values.mts';

export const RESOLUTION_KINDS = ['measured', 'calibrated', 'modeled', 'nominal', 'sampling', 'conditional-bound', 'unknown'] as const;
export interface ResolutionEvidence {
  readonly kind: typeof RESOLUTION_KINDS[number];
  readonly receipt?: { readonly file: string };
}
export function parseResolutionEvidence(raw: unknown): ResolutionEvidence {
  const value = requireRecord(raw, 'resolution evidence'), kind = requireString(value.kind);
  if (!(RESOLUTION_KINDS as readonly string[]).includes(kind)) throw new TypeError(`Unknown resolution evidence kind: ${kind}.`);
  const receipt = value.receipt === undefined ? undefined : requireRecord(value.receipt);
  return { kind: kind as ResolutionEvidence['kind'], ...(receipt ? { receipt: { file: requireString(receipt.file) } } : {}) };
}
export const supportsMeasuredResolution = (evidence: ResolutionEvidence | undefined): boolean =>
  evidence !== undefined && (evidence.kind === 'measured' || evidence.kind === 'calibrated') && evidence.receipt !== undefined;

export const RESOLUTION_ASSUMPTIONS = {
  'jwst.archive-point-source': 'Accept the archive POINT classification as applicable to this observation.',
  'jwst.profile-margin-bound': 'Accept the Gaussian profile and heuristic uncertainty/pixel margins as a resolution bound; this is not a calibrated confidence limit.',
} as const;
export type ResolutionAssumption = keyof typeof RESOLUTION_ASSUMPTIONS;
export const PROFILE_ASSUMPTIONS = Object.keys(RESOLUTION_ASSUMPTIONS) as ResolutionAssumption[];
export function parseAcceptedAssumptions(values: readonly string[]): ResolutionAssumption[] {
  return [...new Set(values.map(value => {
    if (!Object.hasOwn(RESOLUTION_ASSUMPTIONS, value)) throw new TypeError(`Unknown resolution assumption: ${value}.`);
    return value as ResolutionAssumption;
  }))];
}
