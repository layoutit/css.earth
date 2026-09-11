import type { ContributionGraph } from '../src/platform/exploration-contributions.mts';
import type { ExplorationCatalog } from '../src/platform/exploration-catalog.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
import type { SourceUsage } from '../src/platform/source-usage.mts';
import { sourceCitationUrl, type SourceResolver } from '../src/platform/source-catalog.mts';
import { objectSources } from './object-sources.mts';

interface SourceGroup {
  credit: string;
  links: { id: string; title: string; href: string }[];
}

/** Build-time presentation of the prepared dataset's actual contribution edges. */
export function datasetContext(objectId: string, lensId: string, provenance: ProvenanceDocument | undefined,
  graph: ContributionGraph, catalog: ExplorationCatalog, usage: SourceUsage, sources: SourceResolver) {
  const edges = (graph.byObject[objectId] ?? []).map(index => graph.edges[index])
    .filter(edge => edge.lensIds.includes(lensId));
  const missionIds = new Set(edges.flatMap(({ attribution }) =>
    attribution.kind !== 'unresolved' && attribution.missionId ? [attribution.missionId] : []));
  const machineIds = new Set(edges.flatMap(({ attribution }) =>
    attribution.kind === 'machine' && !attribution.missionId ? [attribution.machineId] : []));
  const notes = [...new Set(edges.flatMap(({ attribution }) =>
    attribution.kind === 'unresolved' ? [attribution.reason] : []))];
  const local = new Map(provenance?.sources.map(source => [source.id, source]));
  const groups = new Map<string, SourceGroup>();
  const seen = new Set<string>();
  const add = (credit: string, link: SourceGroup['links'][number]) => {
    if (seen.has(link.id)) return;
    seen.add(link.id);
    const group = groups.get(credit) ?? { credit, links: [] };
    group.links.push(link);
    groups.set(credit, group);
  };
  for (const use of (usage.byObject[objectId] ?? []).map(index => usage.edges[index])) {
    if (use.consumerKind !== 'object-product' || !use.lensIds.includes(lensId)) continue;
    const source = sources[use.catalogueId];
    const origin = use.localSourceId ? local.get(use.localSourceId) : undefined;
    add(origin?.displayCredit ?? source.publisher ?? use.credit ?? '',
      { id: source.id, title: source.title, href: sourceCitationUrl(source) });
  }
  // Keep external records whose canonical identity has not yet been catalogued.
  for (const group of objectSources(provenance, lensId)) for (const link of group.links) {
    if (local.get(link.id)?.sourceBinding?.kind === 'catalogued') continue;
    add(group.description, { id: link.id, title: link.label, href: link.href });
  }
  return {
    missions: catalog.missions.filter(mission => missionIds.has(mission.id)),
    machines: catalog.machines.filter(vehicle => machineIds.has(vehicle.id)),
    notes,
    sources: [...groups.values()],
  };
}
