import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPLICATION_WORLD_CONTEXT as context } from '../world-context-plan.mts';
import { billboardBodyRadiusPixels, preparedBodyBillboards } from '@cssearth/renderer/navigation/prepared-body-billboards.ts';

const bodies = [context.focus, ...context.bodies];
test('world bodies use their arrival image, including its physical radius within the square', () => {
  const sprites = preparedBodyBillboards(bodies, new Set(), () => 2.4);
  for (const id of ['earth', 'saturn', 'lutetia', 'bennu']) {
    // The world summary keeps each body's billboard, not its arrival view (the object's own entry carries that).
    const body = bodies.find(body => body.id === id); assert.ok(body && !('arrival' in (body.discovery ?? {})));
    const asset = body.billboard; assert.ok(asset);
    const sprite = sprites[id]; assert.ok(sprite);
    assert.equal(sprite.url, asset.url);
    assert.ok(!sprite.url.startsWith('/navigation/'));
    assert.equal(sprite.count, 1);
    assert.equal(billboardBodyRadiusPixels(asset, body.radiusM) * sprite.imageScale, asset.size / 2);
  }
  assert.ok(sprites.saturn.imageScale > sprites.earth.imageScale, 'ring extent does not enlarge Saturn itself');
});
test('excluded and unprepared bodies have no alternate photographic fallback', () => {
  assert.deepEqual(preparedBodyBillboards([{ id: 'missing', radiusM: 1 }], new Set(), () => 2.4), {});
  assert.equal(preparedBodyBillboards(bodies, new Set(['earth']), () => 2.4).earth, undefined);
});
