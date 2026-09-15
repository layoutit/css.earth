import { datasetContext, type SourceGroup } from './dataset-context.mts';
import { EXPLORATION, referenceUrl } from './exploration-catalog.mts';
import { SOURCE_CATALOGUE, SOURCES } from './sources-catalog.mts';
import { sceneSources, type SceneSource } from './scene-sources.mts';
import { CONTEXT_OBJECT_PREPARED_JSON } from './prepared-context-objects.mts';
import { CONTEXT_AVAILABILITY } from './context-availability.mts';
import { sourceArray, sourceId, sourceObject } from '../src/platform/source-catalog.mts';
import { parseDatasetLens } from './prepared-panel-content.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { Props } from './planet-shell-types';
import { bodyMoonCatalogueSource, bodyMoonPositionSource } from './prepare-body-moons.mts';

export interface SourceBank { id: string; label: string; groups: SourceGroup[]; objectId?: string; lensId?: string; scope?: string; }

/** Keep the richer dataset citation when a short object credit names the same page. */
export function uniqueSourceGroups(groups: readonly SourceGroup[]): SourceGroup[] {
  const seen = new Set<string>();
  const keep = (link: SourceGroup['links'][number]) => {
    const url = new URL(link.href); url.hash = '';
    const key = url.href.replace(/\/$/u, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  };
  return groups.map(group => ({ ...group, links: group.links.filter(keep), supporting: group.supporting.filter(keep) }))
    .filter(group => group.links.length || group.supporting.length);
}

export const sceneSourceRows = (sources: readonly SceneSource[]): SourceGroup[] => uniqueSourceGroups(sources.map(source => ({
  credit: source.credit ?? source.description,
  links: [{ id: source.role, title: `${source.label} · ${source.role}`, href: source.href }], supporting: [],
})));

const contextSources = (objectId: string, lensId: string, provenance: Props['provenance']) => {
  const context = datasetContext(objectId, lensId, provenance, EXPLORATION.graph, EXPLORATION.catalog, SOURCE_CATALOGUE.usage, SOURCES);
  const groups = [...context.sources];
  const contributors = [
    ...context.missions.map(mission => ({ ...mission, kind: 'mission' })),
    ...context.machines.map(machine => ({ ...machine, kind: 'instrument', emblemId: undefined })),
  ];
  for (const contributor of contributors) {
    const source = SOURCES[contributor.description.citations[0].catalogueId];
    groups.push({ credit: source.publisher ?? '', supporting: [], links: [{ id: `contributor:${contributor.id}`,
      title: `${contributor.name.value} · ${contributor.kind}`, href: referenceUrl(contributor.description) }] });
    const image = contributor.imageId ? EXPLORATION.images[contributor.imageId] : undefined;
    const emblem = contributor.emblemId ? EXPLORATION.emblems[contributor.emblemId] : undefined;
    for (const [kind, artwork] of [['illustration', image], ['emblem', emblem]] as const) if (artwork) groups.push({
      credit: artwork.credit, supporting: [], links: [{id: `${kind}:${contributor.id}`,
        title: `${contributor.name.value} · ${kind}`, href: artwork.sourceUrl}],
    });
  }
  return groups;
};

/** Presentation banks use prepared provenance; selecting a bank never derives source data. */
export function sourcePanelBanks({ objectId, lenses, provenance, resources = [] }: Props): SourceBank[] {
  const body = (lenses?.controls ?? []).map(lens => ({ id: `body:${lens.id}`, objectId, lensId: lens.id,
    label: lens.label, groups: uniqueSourceGroups(contextSources(objectId, lens.id, provenance)) }));
  const moonSource = bodyMoonCatalogueSource(objectId);
  const moonPositionSource = bodyMoonPositionSource(objectId);
  const banks: SourceBank[] = [...body, { id: 'object', label: 'Object references',
    groups: sceneSourceRows([...resources, ...(moonSource ? [moonSource] : []), ...(moonPositionSource ? [moonPositionSource] : [])]) }];
  for (const [path, input] of Object.entries(CONTEXT_OBJECT_PREPARED_JSON)) {
    if (!path.endsWith('/prepared/presentation.json')) continue;
    const presentation = sourceObject(input);
    if (presentation.schema !== 'cssearth-volume-presentation@1') continue;
    const id = sourceId(presentation.objectId);
    if (!CONTEXT_AVAILABILITY[id]?.available) continue;
    const preparedProvenance = validateObjectProvenance(CONTEXT_OBJECT_PREPARED_JSON[path.replace(/presentation\.json$/u, 'provenance.json')], id);
    for (const lens of sourceArray(presentation.controls, parseDatasetLens)) banks.push({
      id: `focus:${id}:${lens.id}`, objectId: id, lensId: lens.id, label: lens.label,
      groups: uniqueSourceGroups(contextSources(id, lens.id, preparedProvenance)),
    });
  }
  const shared = sceneSources();
  const scopes = [
    { id: 'sky', label: 'Surrounding sky', roles: ['sky', 'stars'] },
    { id: 'solar-system', label: 'Solar System', roles: ['sky', 'stars', 'heliopause'] },
    { id: 'milky-way', label: 'Milky Way', roles: ['sky', 'galaxy', 'stars'] },
    { id: 'local-group', label: 'Local Group', roles: ['galaxy', 'galaxies', 'membership', 'M31 image', 'M33 image', 'SMC image', 'LMC VISTA image', 'LMC registration', 'LMC density model', 'LMC stars'] },
    { id: 'nearby-universe', label: 'Nearby Universe', roles: ['galaxy field', 'clusters'] },
  ];
  for (const scope of scopes) banks.push({ id: `scope:${scope.id}`, scope: scope.id, label: scope.label,
    groups: sceneSourceRows(shared.filter(source => scope.roles.includes(source.role))) });
  return banks;
}
