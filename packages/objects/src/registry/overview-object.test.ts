import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { defineOverview, overviewEntry, overviewHolding } from './overview-object.js';

const zoom = { enter: { distancePc: 5e6 }, returnBelow: { distancePc: 4e6 }, frame: { distance: { distancePc: 1e8 } } };
const authored = { name: 'Local Group', description: 'Our galaxy group.', order: 2, zoom, holds: [{ classifications: ['galaxy'], list: 'Galaxies' }] };
const descriptor = (overview: unknown, properties: Record<string, unknown> = {}) =>
  ({ schema: 'cssearth-object@2', id: 'local-group', type: 'galaxy-catalog', properties: { overview, ...properties } });
const entry = (changes: Record<string, unknown> = {}) => ({ kind: 'overview', id: 'local-group', name: 'Local Group', description: 'x', order: 2, zoom,
  holds: [], packages: [], route: '/local-group/', sceneHostId: 'sun', ...changes });

describe('overview entries', () => {
  it('reads the overview a package authors, hosted by the scene preparation names', () => {
    assert.deepEqual(overviewEntry(descriptor(authored), 'sun'), { kind: 'overview', id: 'local-group', name: 'Local Group', description: 'Our galaxy group.',
      order: 2, zoom, holds: [{ classifications: ['galaxy'], list: 'Galaxies' }], packages: [], route: '/local-group/', sceneHostId: 'sun' });
  });

  it('places a package with a volume at its origin', () => {
    assert.deepEqual(overviewEntry(descriptor(authored, { volume: { originM: [1, 2, 3] } }), 'sun')?.originM, [1, 2, 3]);
  });

  it('leaves a package without one out', () => {
    assert.equal(overviewEntry({ schema: 'cssearth-object@2', id: 'm31', type: 'x', properties: {} }, 'sun'), null);
  });

  it('refuses an incomplete overview, naming the package', () => {
    assert.throws(() => overviewEntry(descriptor({ ...authored, description: undefined }), 'sun'), /local-group/);
    assert.throws(() => overviewEntry(descriptor({ ...authored, order: 0 }), 'sun'), /order from 1/);
    assert.throws(() => overviewEntry(descriptor({ ...authored, colour: 'red' }), 'sun'), /names only its name/);
  });

  it('refuses a zoom ladder distance or frame outside its vocabulary, naming the field', () => {
    assert.throws(() => defineOverview(entry({ zoom: { ...zoom, enter: { distancePc: -1 } } })), /local-group zoom\.enter/);
    assert.throws(() => defineOverview(entry({ zoom: { ...zoom, returnBelow: { fade: 'galaxy', at: 'edge' } } })), /zoom\.returnBelow/);
    assert.throws(() => defineOverview(entry({ zoom: { ...zoom, frame: { fit: 'everything' } } })), /zoom\.frame/);
    assert.deepEqual(defineOverview(entry({ zoom: { ...zoom, frame: { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] } } })).zoom.frame, { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] });
  });

  it('refuses a holding that repeats a classification or has no classifications', () => {
    assert.throws(() => defineOverview(entry({ holds: [{ classifications: ['nebula'] }, { classifications: ['nebula'] }] })), /repeats the classification nebula/);
    assert.throws(() => defineOverview(entry({ holds: [{ classifications: [], list: 'Nothing' }] })), /holds\[0\]/);
  });

  it('refuses a prepared entry whose route is not its page', () => {
    assert.throws(() => defineOverview(entry({ route: '/lg/' })), /route/);
  });

  it('finds the level that holds a classification', () => {
    const levels = [defineOverview(entry({ id: 'milky-way', route: '/milky-way/', order: 1, holds: [{ classifications: ['nebula', 'star'] }] })),
      defineOverview(entry({ holds: [{ classifications: ['galaxy'] }] }))];
    assert.equal(overviewHolding(levels, 'nebula')?.id, 'milky-way');
    assert.equal(overviewHolding(levels, 'galaxy')?.id, 'local-group');
    assert.equal(overviewHolding(levels, 'galaxy-cluster'), undefined);
  });
});
