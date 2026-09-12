import input from './prepared-sources.json' with { type: 'json' };
import { parsePreparedSources } from '../src/platform/prepared-sources.mts';
import { sourceCitationUrl } from '../src/platform/source-catalog.mts';
import type { SourceCitation } from '../src/platform/source-catalog.mts';
import { sourceDatasetViews } from '../src/platform/source-usage.mts';
import { checkSourceCatalog } from '../tools/read-source-catalogue.mts';
// Astro/build only. No catalogue or graph is imported by the browser runtime.
export const SOURCE_CATALOGUE = parsePreparedSources(input);
await checkSourceCatalog(process.cwd(), SOURCE_CATALOGUE);
export const SOURCES = SOURCE_CATALOGUE.sources;
export const sourceHref = (id: string) => sourceCitationUrl(SOURCES[id]);
export const sourceDatasets = (id: string, objectId?: string) => sourceDatasetViews(SOURCE_CATALOGUE.usage,SOURCES[id].id,objectId);
export const sourceUses = (id: string) => (SOURCE_CATALOGUE.usage.bySource[SOURCES[id].id] ?? []).map(index => SOURCE_CATALOGUE.usage.edges[index]);
export const uniqueCitations = (citations: readonly SourceCitation[]) => [...new Map(citations.map(citation => [JSON.stringify(citation),citation])).values()];
export function objectSourceRecords(objectId: string, missionIds: readonly string[] = [], machineIds: readonly string[] = []) {
  const ids = new Set(SOURCE_CATALOGUE.usage.edges.filter(edge => edge.objectId === objectId || edge.consumerKind === 'shared-context' ||
    edge.consumerKind === 'mission' && missionIds.includes(edge.consumerId) || edge.consumerKind === 'machine' && machineIds.includes(edge.consumerId) ||
    edge.consumerKind === 'artwork' && [...missionIds,...machineIds].includes(edge.consumerId.split('/')[1])).map(edge => edge.catalogueId));
  return SOURCE_CATALOGUE.catalog.records.filter(record => ids.has(record.id));
}
