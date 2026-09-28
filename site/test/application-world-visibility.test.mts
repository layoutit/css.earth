import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneLifetime } from '@cssearth/engine';
import { createApplicationWorldVisibility } from '../application-world-visibility.mts';
import { allSatelliteSystems } from '../satellite-systems.mts';

function fixture() {
  const lifetime = createSceneLifetime();
  type Layer = Parameters<typeof createApplicationWorldVisibility>[0];
  const publications: Parameters<Layer['setBodyVisibility']>[0][] = [];
  const visibility = createApplicationWorldVisibility({ setBodyVisibility(value) { publications.push(value); } }, lifetime);
  return { visibility, publications, latest: () => publications.at(-1)! };
}

test('every satellite family is visible when its host or any member is selected', () => {
  const { visibility, latest } = fixture();
  for (const family of allSatelliteSystems()) {
    for (const selected of [family.hostId, ...family.memberIds]) {
      visibility.selectObject(selected);
      for (const id of [family.hostId, ...family.memberIds]) {
        assert.ok(!latest().bodyHidden?.includes(id), `${selected}: body ${id}`);
        assert.ok(!latest().labelHidden?.includes(id), `${selected}: label ${id}`);
      }
    }
  }
});

test('leaving Ida restores discovery filters without enabling unrelated illustrations', () => {
  const { visibility, publications, latest } = fixture();
  const initial = latest();
  assert.ok(initial.bodyHidden?.includes('dactyl'));
  visibility.selectObject('ida');
  assert.ok(!latest().bodyHidden?.includes('dactyl'));
  assert.ok(latest().bodyHidden?.includes('selam'));
  const count = publications.length;
  visibility.selectObject('dactyl');
  assert.equal(publications.length, count, 'same family does not republish visibility');
  visibility.selectObject('gaspra');
  assert.deepEqual(latest(), initial);
});

test('placed stellar systems still reveal their illustrated planets', () => {
  const { visibility, latest } = fixture();
  visibility.selectObject('trappist-1');
  for (const id of ['trappist-1b', 'trappist-1e', 'trappist-1h']) {
    assert.ok(!latest().bodyHidden?.includes(id), id);
    assert.ok(!latest().labelHidden?.includes(id), id);
  }
});
