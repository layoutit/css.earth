import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireSceneObject } from '../objects.mts';
import { WORLD_OBJECTS } from '../world-objects.mts';
import { resolveNavigation } from '../navigation/navigation-request.mts';

test('a body without a hosted system opens detail on the first click', () => {
  for (const id of ['venus', 'mercury']) {
    let centerCalls = 0;
    const navigation = {
      centerTarget() { centerCalls++; return null; },
      systemTarget() { assert.fail(`${id} has no satellite system`); },
      overviewTarget() { assert.fail('object selection does not open an overview'); },
    } as unknown as Parameters<typeof resolveNavigation>[1]['navigation'];
    const { destination, centeredObjectId } = resolveNavigation({ kind: 'object' }, {
      object: requireSceneObject(id), objects: WORLD_OBJECTS, navigation,
      current: { objectId: 'sun', href: 'https://css.earth/sun/', subject: { objectId: 'sun', view: 'body' },
        centeredObjectId: null, hasPresented: true, reuseScene: false, mount: null, pending: null },
    });
    assert.equal(destination.camera.kind, 'frame');
    if (destination.camera.kind === 'frame') assert.equal(destination.camera.framing, 'detail');
    assert.equal(destination.subject.view, 'body');
    assert.equal(centeredObjectId, null);
    assert.equal(centerCalls, 0);
  }
});

test('a star hosting planets flies to frame its system on the first click and opens itself on the next', () => {
  const framed = { pose: 'system' } as unknown as ReturnType<Parameters<typeof resolveNavigation>[1]['navigation']['systemTarget']>;
  const navigation = {
    centerTarget() { assert.fail('a system host is framed, not only turned toward'); },
    systemTarget() { return framed; },
    overviewTarget() { assert.fail('object selection does not open an overview'); },
  } as unknown as Parameters<typeof resolveNavigation>[1]['navigation'];
  const select = (centeredObjectId: string | null) => resolveNavigation({ kind: 'object' }, {
    object: requireSceneObject('eps-eridani'), objects: WORLD_OBJECTS, navigation,
    current: { objectId: 'milky-way', href: 'https://css.earth/milky-way/', subject: { objectId: 'milky-way', view: 'body' },
      centeredObjectId, hasPresented: true, reuseScene: false, mount: null, pending: null },
  });
  const first = select(null);
  assert.deepEqual(first.destination.camera, { kind: 'frame', framing: 'center', world: framed, focusPositionM: null });
  assert.equal(first.centeredObjectId, 'eps-eridani');
  const second = select('eps-eridani');
  assert.equal(second.destination.camera.kind === 'frame' && second.destination.camera.framing, 'detail');
});

test('a galaxy picked from another galaxy\'s page is a destination like any body: it adds a history entry', () => {
  const navigation = {
    centerTarget() { return null; },
    systemTarget() { assert.fail('a galaxy hosts no system'); },
    overviewTarget() { assert.fail('object selection does not open an overview'); },
  } as unknown as Parameters<typeof resolveNavigation>[1]['navigation'];
  // M 33, then LMC from search, then Back must return to M 33 (it left the site on 2026-10-01).
  const { destination } = resolveNavigation({ kind: 'object' }, {
    object: requireSceneObject('lmc'), objects: WORLD_OBJECTS, navigation,
    current: { objectId: 'm33', href: 'https://css.earth/m33/', subject: { objectId: 'm33', view: 'body' },
      centeredObjectId: null, hasPresented: true, reuseScene: false, mount: null, pending: null },
  });
  assert.equal(new URL(destination.url).pathname, '/lmc/');
  assert.deepEqual(destination.history, { history: 'push' });
  assert.deepEqual(destination.subject, { objectId: 'lmc', view: 'body' });
});
