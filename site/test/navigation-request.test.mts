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
      current: { objectId: 'sun', href: 'https://css.earth/sun/', subject: { kind: 'object', objectId: 'sun' },
        centeredObjectId: null, hasPresented: true, reuseScene: false, mount: null, pending: null },
    });
    assert.equal(destination.camera.kind, 'frame');
    if (destination.camera.kind === 'frame') assert.equal(destination.camera.framing, 'detail');
    assert.equal(destination.subject.kind, 'object');
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
    current: { objectId: 'milky-way', href: 'https://css.earth/milky-way/', subject: { kind: 'object', objectId: 'milky-way' },
      centeredObjectId, hasPresented: true, reuseScene: false, mount: null, pending: null },
  });
  const first = select(null);
  assert.deepEqual(first.destination.camera, { kind: 'frame', framing: 'center', world: framed, focusPositionM: null });
  assert.equal(first.centeredObjectId, 'eps-eridani');
  const second = select('eps-eridani');
  assert.equal(second.destination.camera.kind === 'frame' && second.destination.camera.framing, 'detail');
});
