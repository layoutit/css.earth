import type { CalibrationDependency } from './calibration-dependencies.mts';
import type { NativeMetadata } from './native-metadata.mts';
import { inputWavelengths } from './recipe-request.mts';
/** Product facts answer a request; catalogue capabilities and successful decoding alone do not. */
import type { CapabilityRequest, ConstraintVerdict, ProductKind, RequestedResult } from './query.mts';
import { supportsMeasuredResolution, PROFILE_ASSUMPTIONS, RESOLUTION_ASSUMPTIONS, type ResolutionEvidence } from '../resolution-evidence.mts';
export interface ProductFacts {
  readonly regionCoverage?: { readonly region: import('./vo/contracts.mts').IcrsCircle; readonly answer: 'partial' | 'unknown'; readonly reason: string; readonly usablePixelCenters: number; readonly invalidPixelCenters: number };
  readonly nativeMetadata?: NativeMetadata;
  readonly calibrationDependencies?: readonly CalibrationDependency[];
  readonly verified: boolean;
  readonly target: string;
  readonly kind?: ProductKind;
  readonly result?: RequestedResult;
  readonly wavelengthIntervalsMicrometres?: readonly (readonly [number, number])[];
  readonly startIso?: string; readonly endIso?: string;
  readonly angularResolutionArcsec?: number; readonly surfaceResolutionKm?: number; readonly resolutionElements?: number;
  readonly resolutionEvidence?: readonly ResolutionEvidence[];
  /** Conditional observed-profile upper bound; exceeding a request is unknown, not a measured rejection. */
  readonly angularResolutionBound?: { readonly arcsec: number; readonly method: 'jwst-point-source-profile@1'; readonly receipt: string };
}
export interface RequestSatisfaction {
  readonly status: 'fulfilled' | 'unresolved' | 'refused';
  readonly acceptance: 'all-requested-constraints';
  readonly constraints: Readonly<Record<string, ConstraintVerdict>>;
}
export function summarizeSatisfaction(constraints: Readonly<Record<string, ConstraintVerdict>>): RequestSatisfaction {
  const answers = Object.values(constraints).map(entry => entry.answer);
  return { status: answers.includes('no') ? 'refused' : !answers.length || answers.some(answer => answer !== 'yes') ? 'unresolved' : 'fulfilled',
    acceptance: 'all-requested-constraints', constraints };
}
export function assessRequest(request: CapabilityRequest, facts: ProductFacts): RequestSatisfaction {
  const yes = (reason: string): ConstraintVerdict => ({ answer: 'yes', reason });
  const unknown = (reason: string): ConstraintVerdict => ({ answer: 'unknown', reason });
  const verdict = (ok: boolean, reason: string): ConstraintVerdict => ({ answer: ok ? 'yes' : 'no', reason });
  const constraints: Record<string, ConstraintVerdict> = {
    artifact: facts.verified ? yes('The current receipt verifies this exact product.') : unknown('No current product qualification has been established.'),
    target: verdict(request.target === facts.target, `Product target: ${facts.target}.`),
  };
  const ranges = facts.wavelengthIntervalsMicrometres;
  if (request.region) constraints.region = facts.regionCoverage && JSON.stringify(facts.regionCoverage.region) === JSON.stringify(request.region)
    ? { answer: facts.regionCoverage.answer, reason: facts.regionCoverage.reason } : unknown('Usable-pixel coverage of the requested ICRS circle has not been qualified.');
  if (request.spectralFrame) constraints.spectralFrame = unknown('The product spectral reference frame has not been qualified.');
  if (!ranges?.length) constraints.wavelength = unknown('No qualified wavelength interval is stated; a central wavelength does not establish band coverage.');
  else {
    const [from, to] = facts.result === 'body-map' ? request.wavelengthMicrometres : inputWavelengths(request); let end = from, started = false;
    for (const [a, b] of [...ranges].sort((a, b) => a[0] - b[0])) if (a <= end && b >= from) { started = true; end = Math.max(end, b); }
    constraints.wavelength = started && end >= to ? yes('This product covers the complete requested wavelength interval.')
      : { answer: ranges.some(([a, b]) => a <= to && b >= from) ? 'partial' : 'no', reason: 'This product does not cover the complete requested interval.' };
  }
  if (request.time) constraints.time = 'any' in request.time ? yes('Any observation time was accepted.')
    : !facts.startIso || !facts.endIso ? unknown('The complete observation time interval is not established.')
    : verdict(Date.parse(facts.startIso) >= Date.parse(request.time.fromIso) && Date.parse(facts.endIso) <= Date.parse(request.time.toIso), 'The entire product time interval must lie inside the requested interval.');
  if (request.kind) constraints.kind = facts.kind ? verdict(request.kind === facts.kind, `Product kind: ${facts.kind}.`) : unknown('The requested input product kind is not established.');
  if (request.result) constraints.result = facts.result ? verdict(request.result === facts.result, `Qualified result: ${facts.result}.`) : unknown('The requested result has not been produced.');
  const measuredBasis = facts.resolutionEvidence?.length && facts.resolutionEvidence.every(supportsMeasuredResolution);
  for (const [key, asked, measured, minimum] of [
    ['angularResolution', request.angularResolutionArcsec, facts.angularResolutionArcsec, false],
    ['surfaceResolution', request.surfaceResolutionKm, facts.surfaceResolutionKm, false],
    ['resolutionElements', request.resolutionElements, facts.resolutionElements, true],
  ] as const) if (asked !== undefined) constraints[key] = measured === undefined || !measuredBasis ? unknown('No supported measured or calibrated resolution evidence is established; numbers, sampling and nominal optics alone are insufficient.')
    : verdict(minimum ? measured >= asked : measured <= asked, `Achieved: ${measured}; requested ${minimum ? 'at least' : 'at most'} ${asked}.`);
  if (request.angularResolutionArcsec !== undefined && facts.angularResolutionArcsec === undefined && facts.angularResolutionBound) {
    const bound = facts.angularResolutionBound;
    const reason = `Observed point-source profile bound: ${bound.arcsec} arcsec over every cube plane (archive POINT classification; fit uncertainty and sampling margin). Receipt: ${bound.receipt}.`;
    const assumptions = PROFILE_ASSUMPTIONS.map(id => ({ id, description: RESOLUTION_ASSUMPTIONS[id], accepted: request.acceptedAssumptions?.includes(id) ?? false }));
    constraints.angularResolution = { ...(assumptions.some(item => !item.accepted)
      ? unknown(`${reason} The caller has not accepted all required assumptions.`)
      : bound.arcsec <= request.angularResolutionArcsec ? yes(reason)
        : unknown(`${reason} This upper bound does not establish whether the tighter requirement is met.`)), assumptions };
  }
  return summarizeSatisfaction(constraints);
}

/** Qualify an input without claiming that its downstream deliverable already exists. */
export function assessInput(request: CapabilityRequest, facts: ProductFacts): RequestSatisfaction {
  return assessRequest(request, request.result === 'body-map' ? { ...facts, result: undefined } : facts);
}
