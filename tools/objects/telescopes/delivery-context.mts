/** One validated source context follows a telescope product through every derived artifact. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { parseAcceptedAssumptions } from '../resolution-evidence.mts';
import { inputWavelengths } from './recipe-request.mts';
import { PRODUCT_KINDS, REQUESTED_RESULTS, type CapabilityRequest, type ConstraintVerdict } from './query.mts';
import type { RequestSatisfaction } from './request-satisfaction.mts';
import { jsonValue, parseLimits, parseRegion, type Json } from './vo/contracts.mts';

export interface ExplorationReference {
  readonly schema: 'cssearth-telescope-exploration@1';
  readonly [key: string]: Json;
}
export interface ScientificDeliveryContext {
  readonly kind: 'scientific-request';
  readonly request: CapabilityRequest;
  readonly assessment: RequestSatisfaction;
}
export interface ExplorationDeliveryContext {
  readonly kind: 'exploration';
  readonly target: string;
  readonly discovery: ExplorationReference;
  readonly assessment: { readonly status: 'not-requested' };
}
export type DeliveryContext = ScientificDeliveryContext | ExplorationDeliveryContext;

const allowed = (record: Record<string, unknown>, fields: readonly string[], label: string) => {
  for (const key of Object.keys(record)) if (!fields.includes(key)) throw new TypeError(`Unsupported ${label} field ${key}.`);
};
const positive = (value: unknown, label: string) => {
  const number = requireFiniteNumber(value, label);
  if (number <= 0) throw new RangeError(`${label} must be positive.`);
  return number;
};
const interval = (value: unknown, label: string, allowEqual = true): readonly [number, number] => {
  const values = requireArray(value, label).map(entry => requireFiniteNumber(entry, label));
  if (values.length !== 2 || values[0]! <= 0 || (allowEqual ? values[1]! < values[0]! : values[1]! <= values[0]!))
    throw new RangeError(`${label} must contain two positive increasing values.`);
  return [values[0]!, values[1]!];
};

export function parseCapabilityRequest(value: unknown): CapabilityRequest {
  const request = requireRecord(value, 'scientific request');
  const fields = ['target','wavelengthMicrometres','continuumMicrometres','acceptedAssumptions','time','angularResolutionArcsec','surfaceResolutionKm','resolutionElements','rangeKm','bodyRadiusKm','kind','result','region','spectralFrame','transferLimits'] as const;
  allowed(request, fields, 'scientific request');
  const target = requireString(request.target, 'scientific request target');
  if (!target) throw new TypeError('Scientific request target must be nonempty.');
  const wavelengthMicrometres = interval(request.wavelengthMicrometres, 'scientific request wavelengths');
  let time: CapabilityRequest['time'];
  if (request.time !== undefined) {
    const raw = requireRecord(request.time, 'scientific request time');
    if (Object.hasOwn(raw, 'any')) {
      allowed(raw, ['any'], 'scientific request time');
      if (raw.any !== true) throw new TypeError('Any-time acceptance must be true.');
      time = { any: true };
    } else {
      allowed(raw, ['fromIso','toIso'], 'scientific request time');
      const fromIso = requireString(raw.fromIso), toIso = requireString(raw.toIso);
      if (!Number.isFinite(Date.parse(fromIso)) || !Number.isFinite(Date.parse(toIso)) || Date.parse(fromIso) > Date.parse(toIso)) throw new RangeError('Scientific request needs a valid ordered time interval.');
      time = { fromIso, toIso };
    }
  }
  const kind = request.kind === undefined ? undefined : requireString(request.kind);
  if (kind !== undefined && !(PRODUCT_KINDS as readonly string[]).includes(kind)) throw new TypeError(`Unknown product kind ${kind}.`);
  const result = request.result === undefined ? undefined : requireString(request.result);
  if (result !== undefined && !(REQUESTED_RESULTS as readonly string[]).includes(result)) throw new TypeError(`Unknown requested result ${result}.`);
  const continuum = request.continuumMicrometres === undefined ? undefined : requireArray(request.continuumMicrometres, 'continuum windows').map(entry => interval(entry, 'continuum window', false));
  if (continuum !== undefined && continuum.length !== 2) throw new TypeError('Band depth requires two continuum windows.');
  const acceptedAssumptions = request.acceptedAssumptions === undefined ? undefined : parseAcceptedAssumptions(requireArray(request.acceptedAssumptions).map(entry => requireString(entry)));
  const parsed: CapabilityRequest = { target, wavelengthMicrometres,
    ...(continuum ? { continuumMicrometres: [continuum[0]!, continuum[1]!] } : {}),
    ...(acceptedAssumptions ? { acceptedAssumptions } : {}), ...(time ? { time } : {}),
    ...(request.angularResolutionArcsec === undefined ? {} : { angularResolutionArcsec: positive(request.angularResolutionArcsec, 'angularResolutionArcsec') }),
    ...(request.surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm: positive(request.surfaceResolutionKm, 'surfaceResolutionKm') }),
    ...(request.resolutionElements === undefined ? {} : { resolutionElements: positive(request.resolutionElements, 'resolutionElements') }),
    ...(request.rangeKm === undefined ? {} : { rangeKm: positive(request.rangeKm, 'rangeKm') }),
    ...(request.bodyRadiusKm === undefined ? {} : { bodyRadiusKm: positive(request.bodyRadiusKm, 'bodyRadiusKm') }),
    ...(kind === undefined ? {} : { kind: kind as CapabilityRequest['kind'] }), ...(result === undefined ? {} : { result: result as CapabilityRequest['result'] }),
    ...(request.region === undefined ? {} : { region: parseRegion(request.region) }),
    ...(request.spectralFrame === undefined ? {} : { spectralFrame: requireString(request.spectralFrame) as CapabilityRequest['spectralFrame'] }),
    ...(request.transferLimits === undefined ? {} : { transferLimits: parseLimits(request.transferLimits) }) };
  if (parsed.spectralFrame !== undefined && parsed.spectralFrame !== 'barycentric') throw new TypeError('Only an explicit barycentric spectral frame is supported.');
  inputWavelengths(parsed);
  return parsed;
}

function parseVerdict(value: unknown, label: string): ConstraintVerdict {
  const verdict = requireRecord(value, label), answer = requireString(verdict.answer), reason = requireString(verdict.reason);
  allowed(verdict, ['answer','reason','assumptions'], label);
  if (!['yes','no','partial','unknown'].includes(answer)) throw new TypeError(`${label} has an unknown answer.`);
  const assumptions = verdict.assumptions === undefined ? undefined : requireArray(verdict.assumptions).map((value, index) => {
    const assumption = requireRecord(value, `${label} assumption ${index}`);
    allowed(assumption, ['id','description','accepted'], `${label} assumption`);
    if (typeof assumption.accepted !== 'boolean') throw new TypeError(`${label} assumption acceptance must be boolean.`);
    return { id: requireString(assumption.id), description: requireString(assumption.description), accepted: assumption.accepted };
  });
  return { answer: answer as ConstraintVerdict['answer'], reason, ...(assumptions ? { assumptions: assumptions as ConstraintVerdict['assumptions'] } : {}) };
}

export function parseRequestSatisfaction(value: unknown): RequestSatisfaction {
  const assessment = requireRecord(value, 'scientific assessment');
  allowed(assessment, ['status','acceptance','constraints'], 'scientific assessment');
  const status = requireString(assessment.status);
  if (!['fulfilled','unresolved','refused'].includes(status) || assessment.acceptance !== 'all-requested-constraints') throw new TypeError('Invalid scientific request assessment.');
  const constraints = Object.fromEntries(Object.entries(requireRecord(assessment.constraints, 'scientific constraints')).map(([key, verdict]) => [key, parseVerdict(verdict, `constraint ${key}`)]));
  return { status: status as RequestSatisfaction['status'], acceptance: 'all-requested-constraints', constraints };
}

function parseExplorationReference(value: unknown): ExplorationReference {
  const reference = requireRecord(jsonValue(value), 'exploration discovery reference');
  if (reference.schema !== 'cssearth-telescope-exploration@1') throw new TypeError('Exploration context needs a versioned discovery reference.');
  return reference as ExplorationReference;
}

export function parseDeliveryContext(value: unknown): DeliveryContext {
  const context = requireRecord(value, 'delivery context'), kind = requireString(context.kind, 'delivery context kind');
  if (kind === 'scientific-request') {
    allowed(context, ['kind','request','assessment'], 'scientific context');
    return { kind, request: parseCapabilityRequest(context.request), assessment: parseRequestSatisfaction(context.assessment) };
  }
  if (kind === 'exploration') {
    allowed(context, ['kind','target','discovery','assessment'], 'exploration context');
    const target = requireString(context.target, 'exploration target'), assessment = requireRecord(context.assessment, 'exploration assessment');
    allowed(assessment, ['status'], 'exploration assessment');
    if (!target || assessment.status !== 'not-requested') throw new TypeError('Invalid exploration target or assessment.');
    return { kind, target, discovery: parseExplorationReference(context.discovery), assessment: { status: 'not-requested' } };
  }
  throw new TypeError(`Unsupported delivery context kind ${kind}.`);
}

/** Existing delivery@1 and derived product fields normalize here; new writers use context directly. */
export function deliveryContext(recordValue: unknown): DeliveryContext {
  const record = requireRecord(recordValue, 'telescope delivery');
  if (record.schema === 'cssearth-telescope-delivery@3' || record.schema === 'cssearth-telescope-delivery@2') return parseDeliveryContext(record.context);
  if (record.schema === 'cssearth-telescope-delivery@1') return parseDeliveryContext({ kind: 'scientific-request', request: record.request, assessment: record.satisfaction });
  throw new TypeError(`Unsupported telescope delivery schema ${String(record.schema)}.`);
}

export function sourceContext(parametersValue: unknown): DeliveryContext {
  const parameters = requireRecord(parametersValue, 'product parameters');
  if (parameters.sourceContext !== undefined) {
    if (parameters.sourceRequest !== undefined || parameters.sourceSatisfaction !== undefined) throw new TypeError('Product parameters contain conflicting source context fields.');
    return parseDeliveryContext(parameters.sourceContext);
  }
  if (parameters.sourceRequest === undefined || parameters.sourceSatisfaction === undefined) throw new TypeError('Product parameters have no source context.');
  return parseDeliveryContext({ kind: 'scientific-request', request: parameters.sourceRequest, assessment: parameters.sourceSatisfaction });
}

export const contextTarget = (context: DeliveryContext): string => context.kind === 'scientific-request' ? context.request.target : context.target;
