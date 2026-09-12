import { SOURCES, SOURCE_CATALOGUE, sourceHref } from './sources-catalog.mts';
import input from './prepared-machines.json' with { type: 'json' };
import { parsePreparedExploration } from '../src/platform/prepared-exploration.mts';
import { contributionViews } from '../src/platform/exploration-contributions.mts';
import type { Cited } from '../src/platform/exploration-catalog.mts';

// This module is an Astro/build owner. Only each body's prepared cards become
// HTML; the catalogue, provenance and compiler never enter the scene runtime.
export const EXPLORATION = parsePreparedExploration(input,SOURCES);
// Sources already checked these files. Both catalogues must use that exact set.
if (JSON.stringify(EXPLORATION.closure) !== JSON.stringify(SOURCE_CATALOGUE.closure)) throw new Error('Prepared catalogue inputs disagree. Run pnpm prepare:sources.');
export const MACHINES = Object.freeze(Object.fromEntries(EXPLORATION.catalog.machines.map(record => [record.id, record])));
export const MISSIONS = Object.freeze(Object.fromEntries(EXPLORATION.catalog.missions.map(record => [record.id, record])));
if (EXPLORATION.sourceCatalogSha256 !== SOURCE_CATALOGUE.catalogSha256) throw new Error('Prepared catalogue identities disagree. Run pnpm prepare:sources.');
export const AGENCIES = EXPLORATION.agencies;
export const missionParticipation = (machineId: string) => EXPLORATION.catalog.missions.filter(mission => mission.participants.some(member => member.machineId === machineId));
export const missionDatasets = (id: string, objectId?: string) => contributionViews(EXPLORATION.graph, EXPLORATION.graph.byMission[id] ?? [], objectId);
export const machineDatasets = (id: string, objectId?: string) => contributionViews(EXPLORATION.graph, EXPLORATION.graph.byMachine[id] ?? [], objectId);
export const referenceUrl = (field: Cited<unknown>) => sourceHref(field.citations[0].catalogueId);
export function objectExploration(objectId: string) {
  const edges = (EXPLORATION.graph.byObject[objectId] ?? []).map(index => EXPLORATION.graph.edges[index]).filter(edge => edge.lensIds.length);
  const missionIds = new Set(edges.flatMap(edge => edge.attribution.kind === 'unresolved' || edge.attribution.missionId === undefined ? [] : [edge.attribution.missionId]));
  const notes = edges.filter(edge => edge.attribution.kind === 'unresolved' || edge.attribution.kind === 'machine' && edge.attribution.missionId === undefined);
  return { missions: EXPLORATION.catalog.missions.filter(mission => missionIds.has(mission.id)), notes };
}
