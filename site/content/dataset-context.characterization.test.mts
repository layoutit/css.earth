import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datasetSourceDetail, datasetContributors } from './dataset-context.mts';
import { lineageSource, FACILITY_CATALOG_SCHEMA } from '@cssearth/objects/provenance';
import type { ExplorationCatalog, ContributionGraph, CaptureAttribution } from '@cssearth/objects/provenance';
const cited = <T,>(value: T) => ({ value, citations: [] });
const catalog: ExplorationCatalog = { schema: FACILITY_CATALOG_SCHEMA,
  facilities: ['vst', 'other'].map(id => ({ id, name: cited(id === 'vst' ? 'VST' : 'Other telescope'), aliases: [], description: cited('Facility'), kind: cited('observatory' as const), setting: cited('ground' as const) })),
  missions: ['short', 'full'].map(id => ({ id, name: cited('Mission ' + id), ...(id === 'short' ? { shortName: cited('Short') } : {}), description: cited('Mission'), agencyIds: cited([]), participants: [] })),
};
const attributions: CaptureAttribution[] = [
  { kind: 'facility', facilityId: 'vst', evidence: 'e' }, { kind: 'facility', facilityId: 'other', evidence: 'e' },
  { kind: 'facility', facilityId: 'missing', evidence: 'e' }, { kind: 'mission', missionId: 'short', evidence: 'e' },
  { kind: 'mission', missionId: 'full', evidence: 'e' }, { kind: 'mission', missionId: 'missing', evidence: 'e' },
  { kind: 'unresolved', label: 'Credit', reason: 'Unknown instrument', evidence: 'e' },
];
const source = (id: string, capture?: unknown, datasetId = 'normal') => lineageSource({ id, path: 'source/image.tif', credit: 'Credit', datasetId, dependencies: [], ...(capture === undefined ? {} : { capture }) });
test('dataset details prefer instruments, otherwise deduplicate credits in source order', () => {
  const capture = { attributions, observation: { id: 'image', target: 'Earth', observedAt: null, instrument: 'Camera', bands: null, evidence: 'e' } };
  assert.equal(datasetSourceDetail('normal', [source('a', capture), source('b', { attributions }), source('c', capture), source('d'), source('e', capture, 'other')], catalog), 'Camera / VLT / Other telescope / Short / Mission full / Credit');
  assert.equal(datasetSourceDetail('missing', [source('a')], catalog), undefined);
  assert.equal(datasetSourceDetail('normal', [source('a')], catalog), undefined);
});
test('contributors filter direct sources and keep the last unresolved reason for a repeated label', () => {
  const attrs: CaptureAttribution[] = [...attributions, { kind: 'facility', facilityId: 'other', missionId: 'short', evidence: 'e' }, { kind: 'unresolved', label: 'Credit', reason: 'Later reason', evidence: 'e' }];
  const graph: ContributionGraph = { datasets: [], byObject: { earth: attrs.map((_, i) => i) }, byMission: {}, byFacility: {},
    edges: attrs.map((attribution, i) => ({ objectId: 'earth', productId: 'image', sourceId: String(i), datasetIds: ['normal'], attribution })) };
  const result = datasetContributors('earth', 'normal', graph, catalog);
  assert.deepEqual(result.missions.map(x => x.id), ['short', 'full']);
  assert.deepEqual(result.facilities.map(x => x.id), ['vst', 'other']);
  assert.deepEqual(result.notes, [{ label: 'Credit', reason: 'Later reason' }]);
  assert.deepEqual(datasetContributors('earth', 'normal', graph, catalog, ['7']).facilities, []);
  assert.deepEqual(datasetContributors('earth', 'normal', graph, catalog, []).missions, []);
  assert.deepEqual(datasetContributors('missing', 'normal', graph, catalog), { missions: [], facilities: [], notes: [] });
  assert.deepEqual(datasetContributors('earth', 'other', graph, catalog).notes, []);
});
