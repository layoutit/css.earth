import { describe, expect, it } from 'vitest';
import { defineOverview, overviewEntry } from './overview-object.js';

const descriptor = (overview: unknown) => ({ schema: 'cssearth-object@1', id: 'local-group', type: 'galaxy-catalog', properties: { overview } });

describe('overview entries', () => {
  it('reads the overview a package authors, hosted by the scene preparation names', () => {
    expect(overviewEntry(descriptor({ name: 'Local Group', description: 'Our galaxy group.', order: 2 }), 'sun')).toEqual({
      kind: 'overview', id: 'local-group', name: 'Local Group', description: 'Our galaxy group.', order: 2, route: '/local-group/', sceneHostId: 'sun',
    });
  });

  it('leaves a package without one out', () => {
    expect(overviewEntry({ schema: 'cssearth-object@1', id: 'm31', type: 'x', properties: {} }, 'sun')).toBeNull();
  });

  it('refuses an incomplete overview, naming the package', () => {
    expect(() => overviewEntry(descriptor({ name: 'Local Group', order: 2 }), 'sun')).toThrow(/local-group/);
    expect(() => overviewEntry(descriptor({ name: 'Local Group', description: 'x', order: 0 }), 'sun')).toThrow(/order from 1/);
    expect(() => overviewEntry(descriptor({ name: 'Local Group', description: 'x', order: 2, colour: 'red' }), 'sun')).toThrow(/only its name/);
  });

  it('refuses a prepared entry whose route is not its page', () => {
    expect(() => defineOverview({ kind: 'overview', id: 'local-group', name: 'Local Group', description: 'x', order: 2, route: '/lg/', sceneHostId: 'sun' }))
      .toThrow(/route/);
  });
});
