import { expect, test } from 'vitest';
import { activeResourceFallbacks } from './prepared-resource-fallbacks.js';
import { requireAssets } from '../validation/resources-tree.js';

const fallbacks = [{ unsupported: 'corner-shape' as const, resources: { 'surface:model': 'surface:model:alpha' } }];

test('a capability fallback replaces its resources only where the browser lacks the capability', () => {
  expect(activeResourceFallbacks(fallbacks, () => true)).toEqual({});
  expect(activeResourceFallbacks(fallbacks, () => false)).toEqual({ 'surface:model': 'surface:model:alpha' });
  expect(activeResourceFallbacks(undefined, () => false)).toEqual({});
});

test('a fallback may only name declared resources', () => {
  const assets = (resources: Record<string, string>) => ({
    pools: [{ id: 'mounted', capacity: 2, concurrency: 2, retention: 'mount', reuse: false }],
    entries: [{ key: 'surface:model', url: '/scenes/a/a.webp', pool: 'mounted' }, { key: 'surface:model:alpha', url: '/scenes/a/a-alpha.webp', pool: 'mounted' }],
    startup: ['surface:model'], fallbacks: [{ unsupported: 'corner-shape', resources }],
  });
  expect(() => requireAssets(assets({ 'surface:model': 'surface:model:alpha' }))).not.toThrow();
  expect(() => requireAssets(assets({ 'surface:model': 'surface:missing' }))).toThrow(/undeclared resource surface:missing/u);
  expect(() => requireAssets(assets({}))).toThrow(/replaces nothing/u);
});
