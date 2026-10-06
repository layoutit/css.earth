import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { OBJECTS, requireObject } from '../directory/objects.mts';
import { seedObjectDirectory } from '../directory/object-directory.mts';
mock.method(globalThis, 'fetch', async () => Response.json({ ancestors: [] }));
const { insideBody, insideViewDescriptor, leaveDistanceM, pastCentreGalaxy, setZoomCentre, worldSubject, worldSubjectFrame, zoomChain, zoomStepOf } = await import('./inside-view.mts');
seedObjectDirectory(OBJECTS);

test('inside views follow the chosen centre while planetary moon systems stay outside the star zoom chain', async () => {
  setZoomCentre('trappist-1');
  try {
    assert.deepEqual(zoomStepOf({ objectId: 'trappist-1-system' }), { scope: 'trappist-1-system', centreId: 'trappist-1' });
    assert.equal(zoomStepOf({ objectId: 'jupiter-system' }), null);
    assert.equal(zoomStepOf({ objectId: 'earth' }), null);
    assert.deepEqual(zoomStepOf({ objectId: 'milky-way' }), { scope: 'milky-way', centreId: 'trappist-1' });
    assert.equal(worldSubject('milky-way'), 'trappist-1'); assert.equal(worldSubject('earth'), 'earth');
    const fallback = { custom: true };
    assert.equal(worldSubjectFrame('milky-way', fallback), requireObject('trappist-1').worldFrame);
    assert.equal(worldSubjectFrame('earth', fallback), fallback);
    const descriptor = { id: 'milky-way', properties: { other: 1, worldFrame: { radius: 9, originM: [0, 0, 0] } } };
    assert.deepEqual(await insideViewDescriptor(descriptor), { id: 'milky-way', properties: { other: 1, worldFrame: { radius: 9, originM: requireObject('trappist-1').worldFrame.originM } } });
    assert.deepEqual(descriptor.properties.worldFrame.originM, [0, 0, 0], 'the original descriptor is retained');
    assert.equal(pastCentreGalaxy('trappist-1-system'), false);
    assert.equal(pastCentreGalaxy('milky-way'), false);
    assert.equal(pastCentreGalaxy('local-group'), true);
    assert.equal(pastCentreGalaxy('unknown'), true, 'the first galaxy ends the walk even for an unknown scope');
    assert.deepEqual(zoomChain().map(step => step.id), ['milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  } finally { setZoomCentre('sun'); }
});

test('non-inside and structurally incomplete descriptors preserve identity', async () => {
  for (const descriptor of [null, {}, { id: 3 }, { id: 'earth', properties: { worldFrame: {} } }, { id: 'milky-way' }, { id: 'milky-way', properties: {} }]) {
    assert.equal(await insideViewDescriptor(descriptor), descriptor);
  }
  assert.equal(insideBody('unknown'), null); assert.equal(insideBody('earth'), null);
  assert.equal(insideBody('milky-way'), null);
  assert.equal(insideBody('m33')?.id, 'm31');
  assert.equal(pastCentreGalaxy('unknown', 'observable-universe'), false);
  assert.deepEqual(zoomChain('observable-universe'), []);
  assert.equal(leaveDistanceM([3, 4, 0], { originM: [0, 0, 0], radiusM: 2 }), 7);
});
