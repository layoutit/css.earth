import type { ContributionGraph } from '@cssearth/objects/provenance';
import type { ExplorationCatalog } from '@cssearth/objects/provenance';
import type { LineageSource } from '@cssearth/objects/provenance';

const datasetFacilityLabels: Readonly<Record<string, string>> = Object.freeze({ vst: 'VLT' });

/** The directly captured instrument/facility that belongs in a dataset row. */
export function datasetSourceDetail(datasetId: string, sources: readonly LineageSource[], catalog: ExplorationCatalog) {
  const labels = sources.filter(source => source.datasetId === datasetId).flatMap(source => {
    if (source.capture?.observation?.instrument) return [source.capture.observation.instrument];
    return (source.capture?.attributions ?? []).flatMap(attribution => {
      if (attribution.kind === 'facility') {
        const facility = catalog.facilities.find(record => record.id === attribution.facilityId);
        return facility ? [datasetFacilityLabels[facility.id] ?? facility.name.value] : [];
      }
      if (attribution.kind === 'mission') {
        const mission = catalog.missions.find(record => record.id === attribution.missionId);
        return mission ? [mission.shortName?.value ?? mission.name.value] : [];
      }
      return [attribution.label];
    });
  });
  return [...new Set(labels)].join(' / ') || undefined;
}

/** The missions, facilities and unresolved credits a dataset card shows beside its summary. */
export function datasetContributors(objectId: string, datasetId: string, graph: ContributionGraph, catalog: ExplorationCatalog,
  directSourceIds?: readonly string[]) {
  const direct = directSourceIds && new Set(directSourceIds);
  const edges = (graph.byObject[objectId] ?? []).map(index => graph.edges[index])
    .filter(edge => edge.datasetIds.includes(datasetId) && (!direct || direct.has(edge.sourceId)));
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
