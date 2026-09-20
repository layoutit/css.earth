/** Human discovery starts from a target and preserves omitted scientific filters as omitted. */
import { flagValue } from '../../cli-arguments.mts';
import { PRODUCT_KINDS, indexedTargetObservations, loadQueryInputs, loadTargetCatalogue,
  type ProductKind, type QueryInputs, type TargetCoverage } from './query.mts';
import { resolveTarget, type TargetResolution } from './targets.mts';
import { explorationQualificationFor, type QualificationConfiguration } from './qualification-routes.mts';
import type { QualifiedObservation } from './qualified-observations.mts';
import { parseLimits, parseRegion, type TransferLimits } from './vo/contracts.mts';
import type { DiscoveryRequest } from './vo/discovery.mts';
import type { VoInputs } from './vo/bridge.mts';
import { FAMILY_IDS, type FamilyId } from './product-descriptor.mts';
import { familiesForProductKind } from './product-type.mts';

export const EXPLORATION_SCHEMA = 'cssearth-telescope-exploration@1';
export interface ExplorationRequest extends DiscoveryRequest {}
export type ExplorationReference =
  | { readonly kind: 'indexed-observation'; readonly telescope: string; readonly mode: string; readonly observation: string; readonly programme: string }
  | { readonly kind: 'vo-acquisition'; readonly acquisitionKey: string; readonly observation: string; readonly snapshot: string };
export interface ExplorationDisplay {
  readonly instrument: string;
  readonly observationTime: { readonly startIso: string | null; readonly endIso: string | null };
  readonly productKind: string | null;
  readonly wavelengthsMicrometres: readonly [number | null, number | null] | readonly (readonly [number, number])[];
  readonly advertisedKilobytes: number | null;
  readonly metadataBasis: 'advertised' | 'indexed' | 'qualified';
}
export interface ExplorationChoice {
  readonly pick: number; readonly key: string; readonly state: 'ready' | 'qualify';
  readonly target: string; readonly telescope: string; readonly mode: string; readonly observation: string; readonly program: string;
  readonly reference: ExplorationReference; readonly display: ExplorationDisplay;
  readonly configuration?: QualificationConfiguration; readonly product?: QualifiedObservation;
  readonly reason: string; readonly limitations: readonly string[];
}
export interface ExplorationIssue {
  readonly scope: 'target' | 'provider' | 'observation' | 'indexed-source';
  readonly code: 'unknown-target' | 'ambiguous-target' | 'provider-unavailable' | 'provider-overflow' | 'unsupported-observation' | 'filter-unresolved' | 'coverage';
  readonly reason: string; readonly identity?: string;
}
export interface ExplorationInputs extends QueryInputs { readonly vo?: VoInputs }
export interface ExplorationAnswer {
  readonly schema: typeof EXPLORATION_SCHEMA; readonly request: ExplorationRequest;
  readonly target: string; readonly targetResolution: TargetResolution;
  readonly choices: readonly ExplorationChoice[]; readonly unsupported: readonly ExplorationIssue[];
  readonly issues: readonly ExplorationIssue[]; readonly services: VoInputs['services']; readonly coverage: readonly TargetCoverage[];
}

const numberFlag = (args: readonly string[], flag: string): number | undefined => {
  const value = flagValue(args, flag); return value === undefined ? undefined : Number(value);
};
export function parseExplorationArguments(args: readonly string[]): ExplorationRequest {
  const values = new Map<string, string>(), switches = new Set<string>(), positional: string[] = [];
  const valued = new Set(['--target','--wavelength','--kind','--family','--from','--to','--icrs-circle','--spectral-frame','--max-science-bytes','--max-metadata-bytes','--max-link-depth','--max-link-requests','--max-expanded-bytes','--max-package-members']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('-')) { positional.push(arg); continue; }
    if (arg === '--any-time') { if (switches.has(arg)) throw new TypeError(`Repeated option ${arg}.`); switches.add(arg); continue; }
    if (!valued.has(arg) || values.has(arg)) throw new TypeError(`Unknown or repeated explore option ${arg}.`);
    const value = args[++index]; if (!value || value.startsWith('--')) throw new TypeError(`Missing value for ${arg}.`); values.set(arg, value);
  }
  if (positional.length > 1 || positional.length && values.has('--target')) throw new TypeError('Give one exploration target, either positional or --target.');
  const target = positional[0] ?? values.get('--target'); if (!target?.trim()) throw new TypeError('Explore requires a target.');
  const wavelength = values.get('--wavelength')?.split(',').map(Number);
  if (wavelength && (wavelength.length !== 2 || !wavelength.every(Number.isFinite) || !(wavelength[0]! > 0 && wavelength[1]! >= wavelength[0]!))) throw new TypeError('--wavelength takes two positive micrometre values, shortest first.');
  const kind = values.get('--kind'); if (kind && !(PRODUCT_KINDS as readonly string[]).includes(kind)) throw new TypeError(`--kind takes one of ${PRODUCT_KINDS.join(', ')}.`);
  const family=values.get('--family');if(family&&!(FAMILY_IDS as readonly string[]).includes(family))throw new TypeError(`--family takes one of ${FAMILY_IDS.join(', ')}.`);
  const from = values.get('--from'), to = values.get('--to'), anyTime = switches.has('--any-time');
  if (Boolean(from) !== Boolean(to)) throw new TypeError('--from and --to are given together.');
  if (anyTime && from) throw new TypeError('--any-time cannot be combined with --from and --to.');
  if (from && to && (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) > Date.parse(to))) throw new TypeError('Exploration time bounds must be valid and ordered.');
  const circle = values.get('--icrs-circle')?.split(',').map(Number); if (circle && circle.length !== 3) throw new TypeError('--icrs-circle requires RA,DEC,RADIUS in degrees.');
  const spectralFrame = values.get('--spectral-frame'); if (spectralFrame && spectralFrame !== 'barycentric') throw new TypeError('--spectral-frame requires barycentric.');
  if (spectralFrame && !wavelength) throw new TypeError('--spectral-frame requires an explicit --wavelength subset.');
  const limitFlags = { scienceBytes: '--max-science-bytes', metadataBytes: '--max-metadata-bytes', nestedEdges: '--max-link-depth', metadataRequests: '--max-link-requests', expandedBytes: '--max-expanded-bytes', packageMembers: '--max-package-members' } as const;
  const rawLimits = Object.fromEntries(Object.entries(limitFlags).flatMap(([key, flag]) => values.has(flag) ? [[key, numberFlag(args, flag)]] : []));
  const transferLimits: TransferLimits | undefined = Object.keys(rawLimits).length ? parseLimits(rawLimits) : undefined;
  return { target, ...(wavelength ? { wavelengthMicrometres: [wavelength[0]!, wavelength[1]!] } : {}), ...(kind ? { kind: kind as ProductKind } : {}),...(family?{family:family as FamilyId}:{}),
    ...(anyTime ? { time: { any: true as const } } : from && to ? { time: { fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString() } } : {}),
    ...(circle ? { region: parseRegion({ frame: 'icrs', shape: 'circle', raDegrees: circle[0], decDegrees: circle[1], radiusDegrees: circle[2] }) } : {}),
    ...(spectralFrame ? { spectralFrame: spectralFrame as 'barycentric' } : {}), ...(transferLimits ? { transferLimits } : {}) };
}

function filterIssues(request: ExplorationRequest, facts: { kind?: string | null;families?:readonly FamilyId[]; startIso?: string | null; endIso?: string | null; wavelengths?: readonly (readonly [number, number])[] }): string[] {
  const issues: string[] = [];
  if (request.kind && facts.kind === null || request.kind && facts.kind === undefined) issues.push('Advertised product kind is unknown; the filter is unresolved.');
  else if (request.kind && facts.kind !== request.kind) issues.push(`Advertised product kind ${facts.kind} does not match ${request.kind}.`);
  if(request.family){const families=facts.families??familiesForProductKind(facts.kind??null);if(!families.length)issues.push('Advertised product family is unknown; the filter is unresolved.');else if(!families.includes(request.family))issues.push(`Advertised product families ${families.join(', ')} do not match ${request.family}.`);}
  if (request.wavelengthMicrometres) {
    if (!facts.wavelengths?.length) issues.push('Advertised wavelength coverage is unknown; the filter is unresolved.');
    else if (!facts.wavelengths.some(([from, to]) => from <= request.wavelengthMicrometres![1] && to >= request.wavelengthMicrometres![0])) issues.push('Advertised wavelength coverage does not overlap the supplied filter.');
  }
  if (request.time && !('any' in request.time)) {
    if (!facts.startIso || !facts.endIso) issues.push('Advertised observation time is unknown; the filter is unresolved.');
    else if (Date.parse(facts.endIso) < Date.parse(request.time.fromIso) || Date.parse(facts.startIso) > Date.parse(request.time.toIso)) issues.push('Advertised observation time does not overlap the supplied filter.');
  }
  return issues;
}
const hardFilterMismatch = (issues: readonly string[]) => issues.some(issue => issue.includes('does not match') || issue.includes('does not overlap'));
const referenceKey = (reference: ExplorationReference) => JSON.stringify(reference);

export function explorationAnswer(request: ExplorationRequest, inputs: ExplorationInputs): ExplorationAnswer {
  const targetResolution = resolveTarget(request.target, inputs.targetCatalogue);
  if (targetResolution.status !== 'resolved') {
    const code = targetResolution.status === 'ambiguous' ? 'ambiguous-target' : 'unknown-target';
    return { schema: EXPLORATION_SCHEMA, request, target: request.target, targetResolution, choices: [], unsupported: [], services: [], coverage: [],
      issues: [{ scope: 'target', code, reason: targetResolution.status === 'ambiguous'
        ? `Target is ambiguous: ${targetResolution.candidates.map(candidate => candidate.id).join(', ')}.`
        : `Target is unknown.${targetResolution.suggestions.length ? ` Suggestions: ${targetResolution.suggestions.map(suggestion => suggestion.id).join(', ')}.` : ''}` }] };
  }
  const target = targetResolution.canonical.id, canonicalRequest = { ...request, target }, choices: Omit<ExplorationChoice, 'pick'>[] = [], unsupported: ExplorationIssue[] = [];
  const indexed = indexedTargetObservations(inputs, target);
  for (const row of indexed.observations) {
    const filters = filterIssues(canonicalRequest, { kind: row.kind, startIso: row.startIso, endIso: row.endIso, wavelengths: row.wavelengthIntervalsMicrometres });
    const identity = `${row.telescope} / ${row.mode} / ${row.observation}`;
    if (hardFilterMismatch(filters)) { unsupported.push({ scope: 'indexed-source', code: 'unsupported-observation', identity, reason: filters.join(' ') }); continue; }
    const ready = [...row.qualifiedProducts].sort((a, b) => a.product.localeCompare(b.product))[0];
    const availability = ready ? undefined : explorationQualificationFor(row.telescope, row.mode, target, row.routeObservation, canonicalRequest);
    if (!ready && !availability?.available) { unsupported.push({ scope: 'indexed-source', code: 'unsupported-observation', identity, reason: [availability?.reason, ...filters].filter(Boolean).join(' ') }); continue; }
    const program = ready?.program ?? row.sourceProductId ?? row.programme ?? `${target}-${row.observation}`;
    const reference: ExplorationReference = { kind: 'indexed-observation', telescope: row.telescope, mode: row.mode, observation: row.observation, programme: program };
    choices.push({ key: referenceKey(reference), state: ready ? 'ready' : 'qualify', target, telescope: row.telescope, mode: row.mode, observation: row.observation, program, reference,
      display: { instrument: row.instrument ?? `${row.telescope} / ${row.mode}`, observationTime: { startIso: row.startIso, endIso: row.endIso }, productKind: row.kind ?? null,
        wavelengthsMicrometres: row.wavelengthIntervalsMicrometres ?? [], advertisedKilobytes: null, metadataBasis: ready ? 'qualified' : 'indexed' },
      ...(ready ? { product: ready } : availability?.configuration ? { configuration: availability.configuration } : {}),
      reason: ready ? 'Existing qualified artifact; pins will be revalidated before use.' : availability!.reason,
      limitations: [...row.qualification?.limitations ?? [], ...filters] });
  }
  for (const entry of inputs.vo?.records ?? []) {
    const observation = entry.observation, ranges = observation.wavelengthsMicrometres[0] === null || observation.wavelengthsMicrometres[1] === null ? [] : [observation.wavelengthsMicrometres as readonly [number, number]];
    const filters = filterIssues(canonicalRequest, { kind: observation.kind,families:observation.productType?.families, startIso: observation.startIso, endIso: observation.endIso, wavelengths: ranges });
    const identity = `${observation.service} / ${observation.key}`;
    if (observation.target.status !== 'confirmed' || hardFilterMismatch(filters) || !entry.products.length) {
      unsupported.push({ scope: 'observation', code: 'unsupported-observation', identity, reason: [observation.target.status === 'confirmed' ? '' : observation.target.reason, ...filters, ...observation.issues, ...entry.issues].filter(Boolean).join(' ') || 'No supported exact access operation.' });
      continue;
    }
    for (const spec of entry.products) {
      const ready = (inputs.qualifiedProducts ?? []).find(product => product.target === target && product.program === spec.key && product.observation === observation.key);
      const reference: ExplorationReference = { kind: 'vo-acquisition', acquisitionKey: spec.key, observation: observation.key, snapshot: observation.snapshot };
      choices.push({ key: referenceKey(reference), state: ready ? 'ready' : 'qualify', target, telescope: observation.service, mode: ready?.mode ?? `native-${spec.kind}`, observation: observation.key, program: spec.key, reference,
        display: { instrument: observation.service, observationTime: { startIso: observation.startIso, endIso: observation.endIso }, productKind: observation.kind,
          wavelengthsMicrometres: observation.wavelengthsMicrometres, advertisedKilobytes: observation.access.estimatedKilobytes, metadataBasis: ready ? 'qualified' : 'advertised' },
        ...(ready ? { product: ready } : { configuration: { kind: 'archive-acquisition', key: spec.key, request: canonicalRequest } as const }),
        reason: ready ? 'Existing qualified artifact; pins will be revalidated before use.' : 'Exact archive access operation is available; selecting it retrieves and qualifies this identity.',
        limitations: ['Archive metadata is advertised, not verified product science.', ...filters, ...observation.issues, ...entry.issues] });
    }
  }
  choices.sort((a, b) => (a.state === 'ready' ? 0 : 1) - (b.state === 'ready' ? 0 : 1) || a.key.localeCompare(b.key));
  const services = inputs.vo?.services ?? [], issues: ExplorationIssue[] = [];
  for (const service of services) {
    if (service.state === 'unavailable') issues.push({ scope: 'provider', code: 'provider-unavailable', identity: service.service, reason: `${service.scope}. ${service.reason}` });
    else if (service.state === 'overflow') issues.push({ scope: 'provider', code: 'provider-overflow', identity: service.service, reason: `${service.scope}. ${service.reason}` });
  }
  for (const item of indexed.coverage) if (item.state !== 'observed') issues.push({ scope: 'indexed-source', code: 'coverage', identity: item.telescope, reason: item.reason });
  return { schema: EXPLORATION_SCHEMA, request: canonicalRequest, target, targetResolution, choices: choices.map((choice, index) => ({ ...choice, pick: index + 1 })), unsupported, issues, services, coverage: indexed.coverage };
}

export async function loadExplorationInputs(root: string, request: ExplorationRequest, selectedObservation?: string): Promise<ExplorationInputs> {
  const targetCatalogue = await loadTargetCatalogue(root), resolution = resolveTarget(request.target, targetCatalogue);
  if (resolution.status !== 'resolved') return { ledgers: [], capabilities: [], targetCatalogue, targetAssociations: [], bodyMaps: [], qualifiedProducts: [] };
  return loadQueryInputs(root, { ...request, target: resolution.canonical.id }, selectedObservation);
}

export async function exploreTarget(root: string, request: ExplorationRequest, selectedObservation?: string): Promise<ExplorationAnswer> {
  return explorationAnswer(request, await loadExplorationInputs(root, request, selectedObservation));
}
