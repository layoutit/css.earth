import assert from 'node:assert/strict';
import { test } from 'vitest';
import { hitsScreenShape, type ScreenPickTarget } from '../../navigation/screen-picking.js';
import { createWorldContextBodyInteraction } from './world-context-interactions.js';

class Target extends EventTarget {
  readonly dataset: DOMStringMap = {};
  readonly style = { pointerEvents: '', cursor: '' };
  tabIndex = -1;
  private readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

test('the world label keeps its visible bounds while its tap target reaches beyond the text', () => {
  const marker = new Target(), orbit = new Target(), host = new EventTarget();
  const interaction = createWorldContextBodyInteraction(marker as unknown as HTMLElement,
    orbit as unknown as HTMLElement, host as unknown as HTMLElement, { id: 'venus', name: 'Venus' }, false);
  const projected = { labelPosition: [100, 200] } as unknown as Parameters<typeof interaction.updateLabel>[0];
  interaction.updateLabel(projected, 3, true, { width: 40, height: 18 }, false);
  interaction.updateNavigation();
  const targets: ScreenPickTarget[] = [], rects: { left: number; right: number; top: number; bottom: number }[] = [];
  interaction.collect(3, targets, rects);
  assert.deepEqual(rects, [{ left: 100, top: 200, right: 140, bottom: 218 }]);
  assert.equal(marker.dataset.objectNavigate, 'venus');
  assert.equal(targets.length, 1);
  assert.equal(hitsScreenShape(targets[0]!.shape, 120, 188), true);
  assert.equal(hitsScreenShape(targets[0]!.shape, 120, 230), true);
  assert.equal(hitsScreenShape(targets[0]!.shape, 93, 209), true);
  assert.equal(hitsScreenShape(targets[0]!.shape, 120, 180), false);
  interaction.destroy();
});
