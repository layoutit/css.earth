import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { sourceTest } from '../../tests/objects/source-test.mts';
import { INSTALL_RESIDENCY_PROBE, READ_RESIDENCY_PROBE, STOP_RESIDENCY_PROBE } from './ipad-residency.mts';
const test = sourceTest();

test('residency distinguishes orbit hosts from strokes and snapshots release values without retaining owners', () => {
  const target = new EventTarget();
  const resources = { images: { allocations: 3, releases: 0, entries: [{ key: 'surface' }] } };
  Reflect.set(target, '__earth', { runtime: { resources: () => resources, lifetime: () => ({ disposed: false }), presentation: () => ({ roots: 2 }) } });
  Reflect.set(target, Symbol.for('cssearth.navigation-fragments'), { inspect: () => ({ activeDocuments: 0 }) });
  const stage = { dataset: { objectId: 'earth' }, querySelectorAll: () => Array(5) };
  const line = (points: string | null) => ({ hasAttribute: () => points !== null, getAttribute: () => points });
  const svg = { querySelectorAll: (selector: string) => selector === 'polyline' ? [line('1,2 3,4'), line(null)]
    : [{ style: { display: '' }, querySelector: () => null }, { style: { display: 'none' }, querySelector: () => null }] };
  const document = { body: { classList: { contains: () => true } }, visibilityState: 'visible',
    querySelector: (selector: string) => selector === '.object-stage' ? stage : selector === '.context-orbit-strokes' ? svg : null,
    querySelectorAll: (selector: string) => Array(selector === 'div.context-orbit' ? 2 : selector === '*' ? 20 : 1) };
  const context = { window: target, document, location: { href: 'http://example.test/earth/' },
    performance: { now: () => 50, timeOrigin: 1000 }, CustomEvent, Event };
  const initial = JSON.parse(JSON.stringify(runInNewContext(INSTALL_RESIDENCY_PROBE, context)));
  assert.equal(initial.atEpochMs, 1050);
  assert.deepEqual(initial.orbits, { svgs: 1, groups: 2, hosts: 2, shownGroups: 1, retainedPolylines: 2, populatedPolylines: 1,
    pointCharacters: 7, paint: [], omittedPaintGroups: 0 });
  assert.equal(initial.scene.resources.images.allocations, 3);
  const detail = { objectId: 'earth', before: { allocations: 3 }, after: { releases: 3 } };
  target.dispatchEvent(new CustomEvent('cssearthscenereleased', { detail }));
  detail.after.releases = 99;
  const stopped = JSON.parse(JSON.stringify(runInNewContext(STOP_RESIDENCY_PROBE, context)));
  assert.equal(stopped.released[0].after.releases, 3, 'The trace keeps a value snapshot, not a live object');
  assert.equal(runInNewContext(READ_RESIDENCY_PROBE, context), null);
  target.dispatchEvent(new CustomEvent('cssearthscenereleased', { detail }));
  assert.equal(stopped.released.length, 1);
});
