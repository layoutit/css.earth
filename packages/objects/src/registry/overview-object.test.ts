import { describe, expect, it } from 'vitest';
import { defineOverview, overviewEntry, overviewHolding } from './overview-object.js';

const zoom = { enter: { distancePc: 5e6 }, returnBelow: { distancePc: 4e6 }, frame: { distance: { distancePc: 1e8 } } };
const authored = { name: 'Local Group', description: 'Our galaxy group.', order: 2, zoom, holds: [{ classifications: ['galaxy'], list: 'Galaxies' }] };
const descriptor = (overview: unknown, properties: Record<string, unknown> = {}) =>
  ({ schema: 'cssearth-object@2', id: 'local-group', type: 'galaxy-catalog', properties: { overview, ...properties } });
const entry = (changes: Record<string, unknown> = {}) => ({ kind: 'overview', id: 'local-group', name: 'Local Group', description: 'x', order: 2, zoom,
  holds: [], packages: [], route: '/local-group/', sceneHostId: 'sun', ...changes });

describe('overview entries', () => {
  it('reads the overview a package authors, hosted by the scene preparation names', () => {
    expect(overviewEntry(descriptor(authored), 'sun')).toEqual({ kind: 'overview', id: 'local-group', name: 'Local Group', description: 'Our galaxy group.',
      order: 2, zoom, holds: [{ classifications: ['galaxy'], list: 'Galaxies' }], packages: [], route: '/local-group/', sceneHostId: 'sun' });
  });

  it('places a package with a volume at its origin', () => {
    expect(overviewEntry(descriptor(authored, { volume: { originM: [1, 2, 3] } }), 'sun')?.originM).toEqual([1, 2, 3]);
  });

  it('leaves a package without one out', () => {
    expect(overviewEntry({ schema: 'cssearth-object@2', id: 'm31', type: 'x', properties: {} }, 'sun')).toBeNull();
  });

  it('refuses an incomplete overview, naming the package', () => {
    expect(() => overviewEntry(descriptor({ ...authored, description: undefined }), 'sun')).toThrow(/local-group/);
    expect(() => overviewEntry(descriptor({ ...authored, order: 0 }), 'sun')).toThrow(/order from 1/);
    expect(() => overviewEntry(descriptor({ ...authored, colour: 'red' }), 'sun')).toThrow(/names only its name/);
  });

  it('refuses a zoom ladder distance or frame outside its vocabulary, naming the field', () => {
    expect(() => defineOverview(entry({ zoom: { ...zoom, enter: { distancePc: -1 } } }))).toThrow(/local-group zoom\.enter/);
    expect(() => defineOverview(entry({ zoom: { ...zoom, returnBelow: { fade: 'galaxy', at: 'edge' } } }))).toThrow(/zoom\.returnBelow/);
    expect(() => defineOverview(entry({ zoom: { ...zoom, frame: { fit: 'everything' } } }))).toThrow(/zoom\.frame/);
    expect(defineOverview(entry({ zoom: { ...zoom, frame: { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] } } })).zoom.frame)
      .toEqual({ between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] });
  });

  it('refuses a holding that repeats a classification or has no classifications', () => {
    expect(() => defineOverview(entry({ holds: [{ classifications: ['nebula'] }, { classifications: ['nebula'] }] }))).toThrow(/repeats the classification nebula/);
    expect(() => defineOverview(entry({ holds: [{ classifications: [], list: 'Nothing' }] }))).toThrow(/holds\[0\]/);
  });

  it('refuses a prepared entry whose route is not its page', () => {
    expect(() => defineOverview(entry({ route: '/lg/' }))).toThrow(/route/);
  });

  it('finds the level that holds a classification', () => {
    const levels = [defineOverview(entry({ id: 'milky-way', route: '/milky-way/', order: 1, holds: [{ classifications: ['nebula', 'star'] }] })),
      defineOverview(entry({ holds: [{ classifications: ['galaxy'] }] }))];
    expect(overviewHolding(levels, 'nebula')?.id).toBe('milky-way');
    expect(overviewHolding(levels, 'galaxy')?.id).toBe('local-group');
    expect(overviewHolding(levels, 'galaxy-cluster')).toBeUndefined();
  });
});
