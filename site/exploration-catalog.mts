import { SOURCES, SOURCE_CATALOGUE, sourceHref } from './sources-catalog.mts';
import input from './prepared-spacecraft.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parsePreparedExploration } from '../src/platform/prepared-exploration.mts';
import { contributionViews } from '../src/platform/exploration-contributions.mts';
import type { Cited } from '../src/platform/exploration-catalog.mts';

// This module is an Astro/build owner. Only each body's prepared cards become
// HTML; the catalogue, provenance and compiler never enter the scene runtime.
export const EXPLORATION = parsePreparedExploration(input,SOURCES);
for (const [path, expected] of Object.entries(EXPLORATION.closure)) {
  const bytes = await readFile(resolve(process.cwd(), path));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Stale exploration catalogue: ${path}. Run pnpm prepare:provenance.`);
}
export const SPACECRAFT = Object.freeze(Object.fromEntries(EXPLORATION.catalog.spacecraft.map(record => [record.id, record])));
export const MISSIONS = Object.freeze(Object.fromEntries(EXPLORATION.catalog.missions.map(record => [record.id, record])));
if (EXPLORATION.sourceCatalogSha256 !== SOURCE_CATALOGUE.catalogSha256) throw new Error('Prepared catalogue identities disagree. Run pnpm prepare:sources.');
export const AGENCIES = EXPLORATION.agencies;
export const missionParticipation = (spacecraftId: string) => EXPLORATION.catalog.missions.filter(mission => mission.participants.some(member => member.spacecraftId === spacecraftId));
export const missionDatasets = (id: string, objectId?: string) => contributionViews(EXPLORATION.graph, EXPLORATION.graph.byMission[id] ?? [], objectId);
export const spacecraftDatasets = (id: string, objectId?: string) => contributionViews(EXPLORATION.graph, EXPLORATION.graph.bySpacecraft[id] ?? [], objectId);
export const referenceUrl = (field: Cited<unknown>) => sourceHref(field.citations[0].catalogueId);
export function objectExploration(objectId: string) {
  const edges = (EXPLORATION.graph.byObject[objectId] ?? []).map(index => EXPLORATION.graph.edges[index]).filter(edge => edge.lensIds.length);
  const missionIds = new Set(edges.flatMap(edge => edge.attribution.kind === 'unresolved' || edge.attribution.missionId === undefined ? [] : [edge.attribution.missionId]));
  const notes = edges.filter(edge => edge.attribution.kind === 'unresolved' || edge.attribution.kind === 'spacecraft' && edge.attribution.missionId === undefined);
  return { missions: EXPLORATION.catalog.missions.filter(mission => missionIds.has(mission.id)), notes };
}
