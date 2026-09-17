import type { ContributionGraph } from '../src/platform/exploration-contributions.mts';
import type { ExplorationCatalog } from '../src/platform/exploration-catalog.mts';

/** The missions, facilities and unresolved credits a dataset card shows beside its summary. */
export function datasetContributors(objectId: string, lensId: string, graph: ContributionGraph, catalog: ExplorationCatalog) {
  const edges = (graph.byObject[objectId] ?? []).map(index => graph.edges[index])
    .filter(edge => edge.lensIds.includes(lensId));
  const missionIds = new Set(edges.flatMap(({ attribution }) =>
    attribution.kind !== 'unresolved' && attribution.missionId ? [attribution.missionId] : []));
  const facilityIds = new Set(edges.flatMap(({ attribution }) =>
    attribution.kind === 'facility' && !attribution.missionId ? [attribution.facilityId] : []));
  // An unresolved attribution still names who is credited; only the individual
  // facility is unknown. Keeping the label lets the card say whose data this is.
  const notes = [...new Map(edges.flatMap(({ attribution }) =>
    attribution.kind === 'unresolved' ? [[attribution.label, { label: attribution.label, reason: attribution.reason }] as const] : [])).values()];
  return {
    missions: catalog.missions.filter(mission => missionIds.has(mission.id)),
    facilities: catalog.facilities.filter(vehicle => facilityIds.has(vehicle.id)),
    notes,
  };
}
