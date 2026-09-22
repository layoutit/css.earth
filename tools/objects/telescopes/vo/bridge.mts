/** VO observations enter the public query directly, without a synthetic instrument ledger. */
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { assessRequest, type RequestSatisfaction, type ProductFacts } from '../request-satisfaction.mts';
import type { CapabilityRequest } from '../query.mts';
import type { TargetCatalogueEntry } from '../targets.mts';
import type { QualifiedObservation } from '../qualified-observations.mts';
import type { QualificationAction } from '../qualification-routes.mts';
import { jsonValue, parseLimits, type DiscoverySnapshot } from './contracts.mts';
import { discover, normalizeSnapshot, SERVICES, type DiscoveredObservation, type DiscoveryRequest } from './discovery.mts';
import { planAccess, type AcquisitionSpec } from './access.mts';

export interface VoInputs {
  readonly records: readonly { readonly observation: DiscoveredObservation; readonly snapshot: DiscoverySnapshot; readonly products: readonly AcquisitionSpec[]; readonly issues: readonly string[] }[];
  readonly services: readonly { readonly service: string; readonly state: 'sampled' | 'overflow' | 'empty-in-scope' | 'unavailable'; readonly scope: string; readonly reason: string }[];
}
export interface VoProductCandidate {
  readonly acquisitionKey: string; readonly observation: DiscoveredObservation; readonly satisfaction: RequestSatisfaction;
  readonly product?: QualifiedObservation; readonly action?: QualificationAction; readonly limitations: readonly string[];
}
export async function loadVoInputs(root: string, request: DiscoveryRequest, catalogue: readonly TargetCatalogueEntry[], selectedObservation?: string, discoverer: typeof discover = discover): Promise<VoInputs> {
  const identities = catalogue.map(t => ({ id: t.id, names: [t.name, ...t.aliases], classification: t.archiveClass, classificationSource: t.classificationSource }));
  const target = identities.find(t => t.id === request.target);
  if (!target) return { records: [], services: [] };
  const limits = parseLimits(request.transferLimits), records: VoInputs['records'][number][] = [], services: VoInputs['services'][number][] = [];
  let metadataRequests = 0;
  const results = await Promise.allSettled(SERVICES.map(profile => discoverer(root, profile, request, target.names, limits)));
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!, profile = SERVICES[i]!;
    if (result.status === 'rejected') { services.push({ service: profile.service, state: 'unavailable', scope: 'Target-name query', reason: String(result.reason) }); continue; }
    const snapshot = result.value;
    services.push({ service: profile.service, state: snapshot.completeness === 'failed' ? 'unavailable' : snapshot.completeness === 'overflow' ? 'overflow' : snapshot.response.rows.length ? 'sampled' : 'empty-in-scope',
      scope: snapshot.scope, reason: snapshot.response.issues.join('; ') || `${snapshot.response.rows.length} rows; this bounded name search is not an archive inventory.` });
    if (snapshot.completeness === 'failed') continue;
    for (const observation of normalizeSnapshot(snapshot, profile, target, identities)) {
      if (selectedObservation !== undefined && observation.key !== selectedObservation) { records.push({ observation, snapshot, products: [], issues: ['Access descriptions were not refreshed because get selected a different observation.'] }); continue; }
      const plan = await planAccess(root, observation, snapshot, request, async (url, parameters) => {
        if (++metadataRequests > limits.metadataRequests) throw new Error('The query-wide access-description request limit was reached.');
        return (await astroquery({ operation: 'vo-links', url, parameters, directory: resolve(root, 'output/telescopes/vo/metadata'), byteLimit: limits.metadataBytes })).vo!;
      }).catch((error: unknown) => ({ products: [], issues: [String(error)] }));
      records.push({ observation, snapshot, ...plan });
    }
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
    const refused = !complete || satisfaction.status === 'refused' || observation.target.status !== 'confirmed' && observation.target.status !== 'in-field' || request.result !== 'telescope-product';
    const action: QualificationAction = { kind: 'qualify-observation', observation: observation.key, program: spec.key,
      configuration: { kind: 'archive-acquisition', key: spec.key, request }, command: 'pnpm', arguments: ['--silent','telescope:qualify','--target',request.target,
        '--telescope',observation.service,'--mode',`native-${spec.kind}`,'--observation',observation.key,'--acquisition',spec.key,'--request',JSON.stringify(request)] };
    return { acquisitionKey: spec.key, observation, satisfaction, ...(product ? { product } : {}), ...(!product && !refused ? { action } : {}),
      limitations: ['Archive coverage is advertised metadata; acquisition does not establish local recalibration or a body map.',
        ...observation.target.status === 'in-field' ? [observation.target.reason] : [], ...entry.issues] };
  }));
}
