/** VO observations enter the public query directly, without a synthetic instrument ledger. */
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { assessRequest, type RequestSatisfaction, type ProductFacts } from '../request-satisfaction.mts';
import type { CapabilityRequest } from '../query.mts';
import type { TargetCatalogueEntry } from '../targets.mts';
import type { QualifiedObservation } from '../qualified-observations.mts';
import type { QualificationAction } from '../qualification-routes.mts';
import { jsonValue, parseLimits, type DiscoverySnapshot, type MetadataResponse } from './contracts.mts';
import { discover, discoverInstrumentFacets, INSTRUMENT_SAMPLE_LIMIT, normalizeSnapshot, SERVICES,
  type DiscoveredObservation, type DiscoveryRequest } from './discovery.mts';
import { nativeQualificationRoute, planAccess, type AcquisitionSpec, type MetadataLoader } from './access.mts';
import type { VoNetworkPolicy } from './network-policy.mts';

export interface VoInputs {
  readonly records: readonly { readonly observation: DiscoveredObservation; readonly snapshot: DiscoverySnapshot; readonly products: readonly AcquisitionSpec[]; readonly issues: readonly string[] }[];
  readonly services: readonly { readonly service: string; readonly state: 'sampled' | 'overflow' | 'empty-in-scope' | 'unavailable'; readonly scope: string; readonly reason: string }[];
}
export interface VoProductCandidate {
  readonly acquisitionKey: string; readonly observation: DiscoveredObservation; readonly satisfaction: RequestSatisfaction;
  readonly product?: QualifiedObservation; readonly action?: QualificationAction; readonly limitations: readonly string[];
}
export async function loadVoInputs(root: string, request: DiscoveryRequest, catalogue: readonly TargetCatalogueEntry[], selectedObservation?: string,
  discoverer: typeof discover = discover, policy: VoNetworkPolicy = {}, metadataLoader?: MetadataLoader,
  faceter: typeof discoverInstrumentFacets = discoverInstrumentFacets, selectedService?: string): Promise<VoInputs> {
  if (selectedService && !SERVICES.some(profile => profile.service === selectedService)) throw new TypeError(`The selected archive service is not registered: ${selectedService}`);
  const identities = catalogue.map(t => ({ id: t.id, names: [t.name, ...t.aliases], classification: t.archiveClass, classificationSource: t.classificationSource }));
  const target = identities.find(t => t.id === request.target);
  if (!target) return { records: [], services: [] };
  const limits = parseLimits(request.transferLimits), records: VoInputs['records'][number][] = [], services: VoInputs['services'][number][] = [];
  let metadataRequests = 0;
  const metadata = new Map<string, Promise<MetadataResponse>>();
  // Run archive clients one at a time; a faceted MAST search must not start many Python processes together.
  for (const profile of SERVICES) {
    if (selectedService && profile.service !== selectedService) continue;
    let snapshots: DiscoverySnapshot[] = [], facet: Awaited<ReturnType<typeof faceter>> | undefined;
    const discoveryFailures: string[] = [];
    try {
      if (profile.facetByInstrument && !request.instrument) {
        facet = await faceter(root, profile, request, target.names, limits);
        for (const instrument of facet.names) {
          try { snapshots.push(await discoverer(root, profile, { ...request, instrument }, target.names, limits, INSTRUMENT_SAMPLE_LIMIT)); }
          catch (error) { discoveryFailures.push(`${instrument}: ${error instanceof Error ? error.message : String(error)}`); }
        }
      } else snapshots = [await discoverer(root, profile, request, target.names, limits)];
    } catch (error) { discoveryFailures.push(error instanceof Error ? error.message : String(error)); }
    if (!snapshots.length && discoveryFailures.length) {
      services.push({ service: profile.label ?? profile.service, state: 'unavailable', scope: 'Target-name query', reason: discoveryFailures.join('; ') });
      continue;
    }
    const rows = snapshots.reduce((count, snapshot) => count + snapshot.response.rows.length, 0);
    const incomplete = !facet?.complete && facet !== undefined || discoveryFailures.length > 0 || snapshots.some(snapshot => snapshot.completeness !== 'bounded-sample');
    services.push({ service: profile.label ?? profile.service, state: incomplete ? 'overflow' : rows ? 'sampled' : 'empty-in-scope',
      scope: facet ? `Instrument-faceted target-name search; ${INSTRUMENT_SAMPLE_LIMIT} rows per instrument` : snapshots[0]?.scope ?? 'Exact target-name search',
      reason: [...facet ? [`${facet.names.length} archive instrument(s); facet evidence ${facet.evidence}`] : [],
        ...snapshots.flatMap(snapshot => snapshot.response.issues), ...facet?.issues ?? [], ...discoveryFailures,
        `${rows} sampled rows; this is not a complete archive inventory.`].join('; ') });
    let accessLimitReached = false;
    for (const snapshot of snapshots) for (const observation of snapshot.completeness === 'failed' ? [] : normalizeSnapshot(snapshot, profile, target, identities)) {
      if (selectedObservation !== undefined && observation.key !== selectedObservation) { records.push({ observation, snapshot, products: [], issues: ['Access descriptions were not refreshed because get selected a different observation.'] }); continue; }
      const plan = await planAccess(root, observation, snapshot, request, async (url, parameters) => {
        const key = JSON.stringify([url, parameters ?? {}]);
        let pending = metadata.get(key);
        if (!pending) {
          if (metadataRequests >= limits.metadataRequests) {
            accessLimitReached = true;
            throw new Error('The query-wide access-description request limit was reached.');
          }
          metadataRequests++;
          pending = metadataLoader ? metadataLoader(url, parameters) : astroquery({ operation: 'vo-links', url, parameters,
            directory: resolve(root, 'output/telescopes/vo/metadata'), byteLimit: limits.metadataBytes,
            allowedPrivateHosts: policy.allowedPrivateHosts }).then(answer => answer.vo!);
          metadata.set(key, pending);
        }
        return pending;
      }, policy).catch((error: unknown) => ({ products: [], issues: [String(error)] }));
      records.push({ observation, snapshot, ...plan });
    }
    if (accessLimitReached) {
      const previous = services.at(-1)!;
      services[services.length - 1] = { ...previous, state: 'overflow',
        reason: `${previous.reason} Access descriptions exceeded the query-wide limit of ${limits.metadataRequests}; later records remain unresolved.` };
    }
    if (selectedObservation && records.some(record => record.observation.key === selectedObservation)) break;
  }
  return { records, services };
}
export function voCandidates(request: CapabilityRequest, inputs: VoInputs | undefined, qualified: readonly QualifiedObservation[]): VoProductCandidate[] {
  return (inputs?.records ?? []).flatMap(entry => entry.products.map(spec => {
    const observation = entry.observation, product = qualified.find(p => p.program === spec.key && p.target === request.target && p.observation === observation.key);
    const [lo, hi] = observation.wavelengthsMicrometres;
    const advertised: ProductFacts = { target: observation.target.target, verified: false, kind: spec.kind, result: 'telescope-product',
      ...(lo !== null && hi !== null ? { wavelengthIntervalsMicrometres: [[lo, hi]] } : {}),
      ...(observation.startIso ? { startIso: observation.startIso } : {}), ...(observation.endIso ? { endIso: observation.endIso } : {}) };
    const satisfaction = assessRequest(request, product?.facts ?? advertised);
    const complete = request.time && request.kind && (request.angularResolutionArcsec !== undefined || request.surfaceResolutionKm !== undefined || request.resolutionElements !== undefined);
    const refused = !nativeQualificationRoute(spec) || !complete || satisfaction.status === 'refused' || observation.target.status !== 'confirmed' && observation.target.status !== 'in-field' || request.result !== 'telescope-product';
    const action: QualificationAction = { kind: 'qualify-observation', observation: observation.key, program: spec.key,
      configuration: { kind: 'archive-acquisition', key: spec.key, request }, command: 'pnpm', arguments: ['--silent','telescope:qualify','--target',request.target,
        '--telescope',observation.service,'--mode',`native-${spec.kind}`,'--observation',observation.key,'--acquisition',spec.key,'--request',JSON.stringify(request)] };
    return { acquisitionKey: spec.key, observation, satisfaction, ...(product ? { product } : {}), ...(!product && !refused ? { action } : {}),
      limitations: ['Archive coverage is advertised metadata; acquisition does not establish local recalibration or a body map.',
        ...!nativeQualificationRoute(spec) ? [`Archive ${spec.kind} has no native qualification route.`] : [],
        ...observation.target.status === 'in-field' ? [observation.target.reason] : [], ...entry.issues] };
  }));
}
