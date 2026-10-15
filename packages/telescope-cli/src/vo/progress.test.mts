import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { DiscoverySnapshot } from '@cssearth/objects';
import { loadVoInputs, type ProviderProgress } from './bridge.mts';
import { SERVICES } from './discovery.mts';
import { saveExploration } from '../session.mts';
import { explorationAnswer } from '../exploration.mts';

const catalogue = [{ id: 'star', name: 'Star', aliases: [] }];
test('VO progress reports each service before and after its work without changing answers', async () => {
  const events: ProviderProgress[] = [], request = { target: 'star', instrument: 'UVES' };
  const discoverer = async (_root: string, profile: typeof SERVICES[number]): Promise<DiscoverySnapshot> => {
    if (profile === SERVICES[2]) throw new Error('timed out');
    return { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request,
      query: 'fixture', scope: 'fixture', sampleLimit: 1, completeness: profile === SERVICES[1] ? 'overflow' : 'bounded-sample',
      response: { schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw: { path: '/fixture', bytes: 1 }, effectiveUrl: profile.service,
        fetchedAt: '2026-10-15T00:00:00Z', httpStatus: 200, queryStatus: 'OK', fields: [], resources: [], coordinateSystems: [], timeSystems: [], issues: [], bindings: [], times: [], rows: [] } };
  };
  const original = await loadVoInputs('/fixture', request, catalogue, undefined, discoverer);
  const observed = await loadVoInputs('/fixture', request, catalogue, undefined, discoverer, {}, undefined, undefined, undefined, event => events.push(event));
  assert.deepEqual(observed, original); assert.equal(events.length, SERVICES.length * 2);
  for (const [index, profile] of SERVICES.entries()) {
    assert.deepEqual(events[index * 2], { archive: profile.label ?? profile.service, state: 'searching' });
    assert.equal(events[index * 2 + 1]!.state, 'done');
  }
  assert.equal(events[5]!.reason, 'timed out'); assert.match(events[3]!.reason ?? '', /sampled rows/u);
});

test('saveExploration forwards provider events without adding them to saved JSON or changing choices', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'explore-progress-'));
  const events: ProviderProgress[] = [], answer = explorationAnswer({ target: 'star' }, { targetCatalogue: catalogue, targetAssociations: [], ledgers: [], capabilities: [], bodyMaps: [] });
  try {
    const saved = await saveExploration('/fixture', ['star'], directory, { load: async () => { throw new Error('unused'); }, qualify: async () => {},
      explore: async (_root, _request, _selected, _progress, _archive, report) => { report?.({ archive: 'ESO', state: 'done', count: 0 }); return answer; } }, undefined, event => events.push(event));
    assert.deepEqual(events, [{ archive: 'ESO', state: 'done', count: 0 }]); assert.deepEqual(saved.answer, answer);
    const raw = JSON.parse(await readFile(resolve(directory, 'explore.json'), 'utf8'));
    assert.deepEqual(raw.answer, answer); assert.equal(raw.providers, undefined); assert.deepEqual(raw.choices, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
