import { INPUT_ROLES, productInputRoles } from './product-input-evidence.mts';
import type { InputRole } from './product-input-evidence.mts';
import { sourceEnum } from './source-catalog.mts';
import { validateObjectProvenance } from './object-provenance.mts';
import type { ProvenanceDocument } from './object-provenance.mts';
import { explorationArray, explorationId, explorationRecord, explorationText, parseCapture, parseCaptureObservation, validateCapture } from './exploration-catalog.mts';
import type { CaptureAttribution, CaptureObservation, ExplorationCatalog } from './exploration-catalog.mts';
import { objectDataset, parseDatasetDestination, type DatasetHost } from './dataset-destination.mts';
export interface ContributionEdge {
  readonly objectId: string; readonly productId: string; readonly sourceId: string;
  readonly roles?: readonly InputRole[]; readonly observation?: CaptureObservation;
  readonly lensIds: readonly string[]; readonly attribution: CaptureAttribution;
}
/** One selectable presentation (object + lens), which can combine several published sources and products. */
export interface DatasetView { readonly objectId: string; readonly objectName: string; readonly lensId: string; readonly label: string; readonly href: string; readonly host?: DatasetHost; }
export interface ContributionGraph {
  readonly edges: readonly ContributionEdge[]; readonly datasets: readonly DatasetView[];
  readonly byObject: Readonly<Record<string, readonly number[]>>;
  readonly byMission: Readonly<Record<string, readonly number[]>>;
  readonly byFacility: Readonly<Record<string, readonly number[]>>;
}
export interface ContributionObject { readonly id: string; readonly name: string; readonly route: string; readonly controls: readonly { readonly id: string; readonly label: string }[]; readonly provenance: ProvenanceDocument;
  /** Set for a volume attached to a body: its lenses are reached through these datasets of the body. */
  readonly hostedBy?: { readonly objectId: string; readonly name: string; readonly route: string; readonly datasets: Readonly<Record<string, { readonly lensId: string; readonly label: string }>> }; }
export const datasetKey = (objectId: string, lensId: string) => `${objectId}/${lensId}`;
export function contributionIndexes(edges: readonly ContributionEdge[]) {
  const byObject: Record<string, number[]> = Object.create(null), byMission: Record<string, number[]> = Object.create(null), byFacility: Record<string, number[]> = Object.create(null);
  const add = (index: Record<string, number[]>, id: string, value: number) => { (index[id] ??= []).push(value); };
  edges.forEach((edge, index) => {
    add(byObject, edge.objectId, index);
    const a = edge.attribution;
    if (a.kind !== 'unresolved' && a.missionId !== undefined) add(byMission, a.missionId, index);
    if (a.kind === 'facility') add(byFacility, a.facilityId, index);
  });
  const freeze = (index: Record<string, number[]>) => Object.freeze(Object.fromEntries(Object.entries(index).map(([id, edges]) => [id, Object.freeze(edges)])));
  return { byObject: freeze(byObject), byMission: freeze(byMission), byFacility: freeze(byFacility) };
}
/** The only compiler of capture-to-dataset links; runtime never walks source lineage. */
export function compileContributions(objects: readonly ContributionObject[], catalog: ExplorationCatalog): ContributionGraph {
  const edges: ContributionEdge[] = [], datasets: DatasetView[] = [];
  const objectIds = new Set<string>();
  for (const object of objects) {
    if (objectIds.has(object.id)) throw new TypeError('Duplicate contribution object.');
    objectIds.add(object.id);
    const document = validateObjectProvenance(object.provenance, object.id);
    for (const product of document.products) if (product.observationAttribution === undefined) throw new TypeError(`Undeclared observation attribution: ${object.id}/${product.id}.`);
    const sources = new Map(document.sources.map(source => [source.id, source]));
    const lensIds = new Set(object.controls.map(control => control.id));
    if (lensIds.size !== object.controls.length) throw new TypeError('Duplicate prepared dataset ID.');
    const linked = new Set<string>();
    for (const source of document.sources) if (source.capture) validateCapture(source.capture, catalog);
    for (const product of document.products) {
      for (const lensId of product.lensIds ?? []) if (!lensIds.has(lensId)) throw new TypeError(`Unknown prepared dataset: ${object.id}/${lensId}.`);
      if (product.observationAttribution === 'none') continue;
      for (const [sourceId, roles] of productInputRoles(document, product.id, product => product.observationAttribution === 'source-lineage')) {
        for (const attribution of sources.get(sourceId)?.capture?.attributions ?? []) {
          edges.push(Object.freeze({ objectId: object.id, productId: product.id, sourceId, roles, ...(sources.get(sourceId)?.capture?.observation ? { observation: sources.get(sourceId)!.capture!.observation } : {}), lensIds: Object.freeze([...(product.lensIds ?? [])]), attribution }));
          for (const id of product.lensIds ?? []) linked.add(id);
        }
      }
    }
    for (const lens of object.controls) if (linked.has(lens.id)) {
      const dataset = objectDataset(object, lens);
      if (!datasets.some(known => known.objectId === dataset.objectId && known.lensId === dataset.lensId)) datasets.push(Object.freeze(dataset));
    }
  }
  return Object.freeze({ edges: Object.freeze(edges), datasets: Object.freeze(datasets), ...contributionIndexes(edges) });
}
export function parseContributionGraph(input: unknown, catalog: ExplorationCatalog): ContributionGraph {
  const graph = explorationRecord(input, ['edges', 'datasets', 'byObject', 'byMission', 'byFacility']);
  const datasets = explorationArray(graph.datasets, raw => {
    const view = explorationRecord(raw, ['objectId', 'objectName', 'lensId', 'label', 'href', 'host']);
    const host = view.host === undefined ? undefined : (record => Object.freeze({ objectId: explorationId(record.objectId), lensId: explorationId(record.lensId) }))(explorationRecord(view.host, ['objectId', 'lensId']));
    const objectId = explorationId(view.objectId), lensId = explorationId(view.lensId), href = parseDatasetDestination(view.href, objectId, lensId, host);
    return Object.freeze({ objectId, lensId, href, objectName: explorationText(view.objectName), label: explorationText(view.label), ...(host === undefined ? {} : { host }) });
  });
  const keys = new Set(datasets.map(view => datasetKey(view.objectId, view.lensId)));
  if (keys.size !== datasets.length) throw new TypeError('Duplicate dataset destination.');
  const edges = explorationArray(graph.edges, raw => {
    const edge = explorationRecord(raw, ['objectId', 'productId', 'sourceId', 'lensIds', 'attribution', 'roles', 'observation']);
    const objectId = explorationId(edge.objectId), lensIds = explorationArray(edge.lensIds, explorationId);
    if (new Set(lensIds).size !== lensIds.length || lensIds.some(id => !keys.has(datasetKey(objectId, id)))) throw new TypeError('Invalid edge dataset.');
    const capture = parseCapture({ attributions: [edge.attribution] }); validateCapture(capture, catalog);
    if (edge.roles !== undefined) {
      const roles = explorationArray(edge.roles, value => sourceEnum(value, INPUT_ROLES));
      if (!roles.length || new Set(roles).size !== roles.length) throw new TypeError('Invalid contribution input roles.');
    }
    return Object.freeze({ objectId, productId: explorationText(edge.productId), sourceId: explorationText(edge.sourceId), lensIds,
      ...(edge.roles === undefined ? {} : { roles: explorationArray(edge.roles, value => sourceEnum(value, INPUT_ROLES)) }),
      ...(edge.observation === undefined ? {} : { observation: parseCaptureObservation(edge.observation) }), attribution: capture.attributions[0] });
  });
  if (new Set(edges.map(edge => JSON.stringify(edge))).size !== edges.length) throw new TypeError('Duplicate contribution edge.');
  const indexes = contributionIndexes(edges);
  for (const key of ['byObject', 'byMission', 'byFacility'] as const) {
    if (JSON.stringify(graph[key]) !== JSON.stringify(indexes[key])) throw new TypeError(`Inconsistent contribution index: ${key}.`);
  }
  const used = new Set(edges.flatMap(edge => edge.lensIds.map(id => datasetKey(edge.objectId, id))));
  if (used.size !== datasets.length) throw new TypeError('Dataset destination has no contribution.');
  return Object.freeze({ edges, datasets, ...indexes });
}

export function contributionViews(graph: ContributionGraph, edgeIds: readonly number[], objectId?: string): readonly DatasetView[] {
  const keys = new Set(edgeIds.flatMap(index => {
    const edge = graph.edges[index];
    return objectId && edge.objectId !== objectId ? [] : edge.lensIds.map(id => datasetKey(edge.objectId, id));
  }));
  return graph.datasets.filter(view => keys.has(datasetKey(view.objectId, view.lensId)));
}
