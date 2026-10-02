import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { overviewHolding, overviewLevel } from './overview-object.js';

const zoom = { enter: { distancePc: 5e6 }, returnBelow: { distancePc: 4e6 }, frame: { distance: { distancePc: 1e8 } } };
const authored = { order: 2, zoom, holds: [{ classifications: ['galaxy'], list: 'Galaxies' }] };
const descriptor = (overview: unknown, properties: Record<string, unknown> = {}) =>
  ({ schema: 'cssearth-object@2', id: 'local-group', type: 'layered-body', properties: { overview, ...properties } });
const level = (changes: Record<string, unknown> = {}) => overviewLevel(descriptor({ ...authored, ...changes }))!;

describe('overview entries', () => {
  it('reads the level a package authors', () => {
    assert.deepEqual(overviewLevel(descriptor(authored)), { order: 2, zoom, holds: [{ classifications: ['galaxy'], list: 'Galaxies' }], packages: [] });
  });

  it('leaves a package without one out', () => {
    assert.equal(overviewLevel({ schema: 'cssearth-object@2', id: 'm31', type: 'x', properties: {} }), null);
  });

  it('refuses an incomplete overview, naming the package', () => {
    assert.throws(() => overviewLevel(descriptor({ ...authored, zoom: undefined })), /local-group/);
    assert.throws(() => overviewLevel(descriptor({ ...authored, order: 0 })), /order \(from 1\)/);
    assert.throws(() => overviewLevel(descriptor({ ...authored, colour: 'red' })), /local-group; it names its order/);
  });

  it('leaves its name and description to its catalogue entry', () => {
    assert.throws(() => overviewLevel(descriptor({ ...authored, name: 'Local Group' }, { catalog: {} })), /local-group; it names its order/);
  });

  it('refuses a zoom ladder distance or frame outside its vocabulary, naming the field', () => {
    assert.throws(() => level({ zoom: { ...zoom, enter: { distancePc: -1 } } }), /local-group zoom\.enter/);
    assert.throws(() => level({ zoom: { ...zoom, returnBelow: { fade: 'galaxy', at: 'edge' } } }), /zoom\.returnBelow/);
    assert.throws(() => level({ zoom: { ...zoom, frame: { fit: 'everything' } } }), /zoom\.frame/);
    assert.deepEqual(level({ zoom: { ...zoom, frame: { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] } } }).zoom.frame, { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] });
  });

  it('refuses a holding that repeats a classification or has no classifications', () => {
    assert.throws(() => level({ holds: [{ classifications: ['nebula'] }, { classifications: ['nebula'] }] }), /repeats the classification nebula/);
    assert.throws(() => level({ holds: [{ classifications: [], list: 'Nothing' }] }), /holds\[0\]/);
  });

  it('finds the level that holds a classification', () => {
    const levels = [{ id: 'milky-way', ...level({ order: 1, holds: [{ classifications: ['nebula', 'star'] }] }) }, { id: 'local-group', ...level({ holds: [{ classifications: ['galaxy'] }] }) }];
    assert.equal(overviewHolding(levels, 'nebula')?.id, 'milky-way');
    assert.equal(overviewHolding(levels, 'galaxy')?.id, 'local-group');
    assert.equal(overviewHolding(levels, 'galaxy-cluster'), undefined);
  });
});
