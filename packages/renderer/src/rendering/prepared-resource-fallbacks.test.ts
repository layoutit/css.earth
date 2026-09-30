import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { activeResourceFallbacks } from './prepared-resource-fallbacks.js';
import { requireAssets } from '../validation/resources-tree.js';

const fallbacks = [{ unsupported: 'corner-shape' as const, resources: { 'surface:model': 'surface:model:alpha' } }];

test('a capability fallback replaces its resources only where the browser lacks the capability', () => {
  assert.deepEqual(activeResourceFallbacks(fallbacks, () => true), {});
  assert.deepEqual(activeResourceFallbacks(fallbacks, () => false), { 'surface:model': 'surface:model:alpha' });
  assert.deepEqual(activeResourceFallbacks(undefined, () => false), {});
});

test('a fallback may only name declared resources', () => {
  const assets = (resources: Record<string, string>) => ({
    pools: [{ id: 'mounted', capacity: 2, concurrency: 2, retention: 'mount', reuse: false }],
    entries: [{ key: 'surface:model', url: '/scenes/a/a.webp', pool: 'mounted' }, { key: 'surface:model:alpha', url: '/scenes/a/a-alpha.webp', pool: 'mounted' }],
    startup: ['surface:model'], fallbacks: [{ unsupported: 'corner-shape', resources }],
  });
  assert.doesNotThrow(() => requireAssets(assets({ 'surface:model': 'surface:model:alpha' })));
  assert.throws(() => requireAssets(assets({ 'surface:model': 'surface:missing' })), /undeclared resource surface:missing/u);
  assert.throws(() => requireAssets(assets({})), /replaces nothing/u);
});
