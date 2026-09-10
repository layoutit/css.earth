import input from './prepared-sources.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parsePreparedSources } from '../src/platform/prepared-sources.mts';
import { sourceCitationUrl } from '../src/platform/source-catalog.mts';
import type { SourceCitation } from '../src/platform/source-catalog.mts';
import { sourceDatasetViews } from '../src/platform/source-usage.mts';
// Astro/build only. No catalogue or graph is imported by the browser runtime.
export const SOURCE_CATALOGUE = parsePreparedSources(input);
for (const [path, expected] of Object.entries(SOURCE_CATALOGUE.closure)) {
  if (createHash('sha256').update(await readFile(resolve(process.cwd(),path))).digest('hex') !== expected) throw new Error(`Stale sources catalogue: ${path}. Run pnpm prepare:sources.`);
}
export const SOURCES = SOURCE_CATALOGUE.sources;
export const sourceHref = (id: string) => sourceCitationUrl(SOURCES[id]);
export const sourceDatasets = (id: string, objectId?: string) => sourceDatasetViews(SOURCE_CATALOGUE.usage,SOURCES[id].id,objectId);
export const sourceUses = (id: string) => (SOURCE_CATALOGUE.usage.bySource[SOURCES[id].id] ?? []).map(index => SOURCE_CATALOGUE.usage.edges[index]);
export const uniqueCitations = (citations: readonly SourceCitation[]) => [...new Map(citations.map(citation => [JSON.stringify(citation),citation])).values()];
export function objectSourceRecords(objectId: string, missionIds: readonly string[] = [], spacecraftIds: readonly string[] = []) {
  const ids = new Set(SOURCE_CATALOGUE.usage.edges.filter(edge => edge.objectId === objectId || edge.consumerKind === 'shared-context' ||
    edge.consumerKind === 'mission' && missionIds.includes(edge.consumerId) || edge.consumerKind === 'spacecraft' && spacecraftIds.includes(edge.consumerId) ||
    edge.consumerKind === 'artwork' && [...missionIds,...spacecraftIds].includes(edge.consumerId.split('/')[1])).map(edge => edge.catalogueId));
  return SOURCE_CATALOGUE.catalog.records.filter(record => ids.has(record.id));
}
