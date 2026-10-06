import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { parsePreparedWorldContextSummary } from '@cssearth/objects';
import { worldContextFixture } from '../../directory/fixtures/world-context-characterization.mts';
const fixture = worldContextFixture();
after(() => fixture.remove());
const context = parsePreparedWorldContextSummary(fixture.read('summary'));
mock.module(new URL('../../directory/world-context-plan.mts', import.meta.url).href, { namedExports: { APPLICATION_WORLD_CONTEXT: context } });
mock.module(new URL('./system-framing.mts', import.meta.url).href, { namedExports: { SYSTEM_FRAMING_RADII: new Map(), systemOverviewDistance: () => 1 } });
const { zoomDistanceM, zoomFrameDistanceM, zoomScopeAtCamera } = await import('./zoom-scope.mts');
test('fade starts and fit framing retain their distinct numeric and null results', () => {
  assert.equal(zoomDistanceM({ fade: 'galaxy', at: 'start' }, context), context.volume.fadeStartDistanceM);
  assert.equal(zoomFrameDistanceM({ zoom: { enter: { distancePc: 1 }, returnBelow: { distancePc: .8 }, frame: { fit: 'drawn-galaxies' } } }, context), null);
});
test('past system fade but before an authored threshold the nearest outer scope is still selected', () => {
  const world = { referenceFrame: 'world', epochJdTt: 1, pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 1e17] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  assert.equal(zoomScopeAtCamera(world, undefined, context, undefined, [{ id: 'outer', zoom: { enter: { distancePc: 1e5 }, returnBelow: { distancePc: 8e4 } } }]), 'outer');
});
test('distance and framing branches retain parsecs, fade endpoints and geometric means', () => {
  const parsecM = 3.085677581491367e16;
  assert.equal(zoomDistanceM({ distancePc: 2 }, context), 2 * parsecM);
  assert.equal(zoomDistanceM({ fade: 'galaxy', at: 'end' }, context), 1e21);
  assert.equal(zoomDistanceM({ fade: 'galaxy', at: 'middle' }, context), Math.sqrt(1e20 * 1e21));
  assert.equal(zoomDistanceM({ fade: 'system', at: 'start' }, context), 1e14);
  assert.equal(zoomFrameDistanceM({ zoom: { enter: { distancePc: 1 }, returnBelow: { distancePc: .8 }, frame: { distance: { distancePc: 2 } } } }, context), 2 * parsecM);
  assert.equal(zoomFrameDistanceM({ zoom: { enter: { distancePc: 1 }, returnBelow: { distancePc: .8 }, frame: { between: [{ distancePc: 1 }, { distancePc: 9 }] } } }, context), Math.sqrt(parsecM * (9 * parsecM)));
});
test('a body scope enters and returns at its exact authored boundaries', () => {
  const parsecM = 3.085677581491367e16;
  const chain = [{ id: 'outer', body: true as const, zoom: { enter: { distancePc: 2 }, returnBelow: { distancePc: 1 } } }];
  const at = (distancePc: number, previous?: string) => zoomScopeAtCamera({ referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0, 0, distancePc * parsecM], orientationXyzw: [0, 0, 0, 1] } }, previous, context, undefined, chain);
  assert.equal(at(1.99), 'solar-system');
  assert.equal(at(2), 'outer');
  assert.equal(at(.99, 'outer'), 'solar-system');
  assert.equal(at(1, 'outer'), 'outer');
});
test('farther scopes include their exact enter and return boundaries', () => {
  const parsecM = 3.085677581491367e16;
  const chain = [
    { id: 'near', zoom: { enter: { distancePc: 2 }, returnBelow: { distancePc: 1 } } },
    { id: 'far', zoom: { enter: { distancePc: 3 }, returnBelow: { distancePc: 2.5 } } },
  ];
  const at = (distancePc: number, previous?: string) => zoomScopeAtCamera({ referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0, 0, distancePc * parsecM], orientationXyzw: [0, 0, 0, 1] } }, previous, context, undefined, chain);
  assert.equal(at(2.99), 'near');
  assert.equal(at(3), 'far');
  assert.equal(at(2.49, 'far'), 'near');
  assert.equal(at(2.5, 'far'), 'far');
});
