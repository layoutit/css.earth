import type { ContributionGraph } from '../src/platform/exploration-contributions.mts';
import type { ExplorationCatalog } from '../src/platform/exploration-catalog.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
import type { SourceUsage } from '../src/platform/source-usage.mts';
import { sourceCitationUrl, type SourceResolver } from '../src/platform/source-catalog.mts';
import { objectSources } from './object-sources.mts';

interface SourceGroup {
  credit: string;
  /** The dataset's own inputs, ahead of the labels and format notes they need. */
  links: { id: string; title: string; href: string }[];
  supporting: { id: string; title: string; href: string }[];
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
  // An unresolved attribution still names who is credited; only the individual
  // machine is unknown. Keeping the label lets the card say whose data this is.
  const notes = [...new Map(edges.flatMap(({ attribution }) =>
    attribution.kind === 'unresolved' ? [[attribution.label, { label: attribution.label, reason: attribution.reason }] as const] : [])).values()];
  const local = new Map(provenance?.sources.map(source => [source.id, source]));
  const groups = new Map<string, SourceGroup>();
  const seen = new Set<string>();
  const pending: { credit: string; link: SourceGroup['links'][number]; lensId?: string }[] = [];
  const add = (credit: string, link: SourceGroup['links'][number], sourceLensId?: string) => {
    if (seen.has(link.id)) return;
    seen.add(link.id);
    pending.push({ credit, link, lensId: sourceLensId });
  };
  for (const use of (usage.byObject[objectId] ?? []).map(index => usage.edges[index])) {
    if (use.consumerKind !== 'object-product' || !use.lensIds.includes(lensId)) continue;
    const source = sources[use.catalogueId];
    const origin = use.localSourceId ? local.get(use.localSourceId) : undefined;
    add(origin?.displayCredit ?? source.publisher ?? use.credit ?? '',
      { id: source.id, title: source.title, href: sourceCitationUrl(source) }, origin?.lensId);
  }
  // Keep external records whose canonical identity has not yet been catalogued.
  for (const group of objectSources(provenance, lensId)) for (const link of group.links) {
    if (local.get(link.id)?.sourceBinding?.kind === 'catalogued') continue;
    add(group.description, { id: link.id, title: link.label, href: link.href });
  }
  // A source that declares this lens is the dataset itself; everything else
  // reaching the same product is a label, format note or bibliography for it.
  // Where nothing declares a lens there is nothing to demote, so all of it shows.
  const declared = pending.some(entry => entry.lensId === lensId);
  for (const entry of pending) {
    const group = groups.get(entry.credit) ?? { credit: entry.credit, links: [], supporting: [] };
    (!declared || entry.lensId === lensId ? group.links : group.supporting).push(entry.link);
    groups.set(entry.credit, group);
  }
  return {
    missions: catalog.missions.filter(mission => missionIds.has(mission.id)),
    machines: catalog.machines.filter(vehicle => machineIds.has(vehicle.id)),
    notes,
    sources: [...groups.values()],
  };
}
