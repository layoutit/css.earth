import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createSceneLifetime } from '@cssearth/engine';
import { parsePreparedWorldContextSummary, type PreparedWorldContext } from '@cssearth/objects';
import { worldLayerVisibility } from '@cssearth/renderer/universe/world-layers.ts';

const root = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8')));
// The fake source holds the current plan and publishes actual plan updates through the production subscription.
const bodies: PreparedWorldContext['bodies'][number][] = [];
const current = { ...root, bodies };
const listeners = new Set<(plan: PreparedWorldContext) => void>();
mock.module(new URL('../../directory/world-context-plan.mts', import.meta.url).href, { namedExports: {
  APPLICATION_WORLD_CONTEXT: current, loadWorldHolder: async () => {},
  onWorldSystems(listener: (plan: PreparedWorldContext) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
} });
const { createApplicationWorldVisibility } = await import('./application-world-visibility.mts');
const body = (id: string, classification: 'planet' | 'star') => ({ ...root.focus, id, name: id, systemName: id, classification });

test('layer policy starts from systems read after module evaluation and includes systems published after mounting', () => {
  bodies.push(body('before-mount', 'planet'));
  const lifetime = createSceneLifetime();
  type Layer = Parameters<typeof createApplicationWorldVisibility>[0];
  const publications: Parameters<Layer['setBodyVisibility']>[0][] = [];
  const visibility = createApplicationWorldVisibility({ setBodyVisibility: value => publications.push(value) }, lifetime);
  visibility.selectObject(root.focus.id);
  visibility.setLayers(worldLayerVisibility(['planets', 'stars', 'orbits']));
  assert.ok(publications.at(-1)!.bodyHidden?.includes('before-mount'), 'a system added before the mount is classified');
  assert.ok(publications.at(-1)!.orbitHidden?.includes('before-mount'), 'and its orbit follows the switch');
  assert.equal(visibility.layerOf('before-mount'), 'planets');
  const extended = { ...current, bodies: [...bodies, body('after-mount', 'star')] };
  for (const listener of listeners) listener(extended);
  assert.ok(publications.at(-1)!.bodyHidden?.includes('after-mount'), 'a later system takes the current layer switches');
  assert.ok(publications.at(-1)!.orbitHidden?.includes('after-mount'));
  assert.equal(visibility.layerOf('after-mount'), 'stars', 'bank classification reads the extended policy too');
  lifetime.destroy();
  const count = publications.length;
  for (const listener of listeners) listener({ ...extended, bodies: [...extended.bodies, body('disposed', 'star')] });
  assert.equal(publications.length, count, 'disposed visibility no longer subscribes');
});
