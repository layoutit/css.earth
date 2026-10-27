import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { requireRecord } from '@cssearth/core';
import { parsePreparedWorldCameraFrame, parsePreparedWorldContextSummary, parsePreparedWorldSystem } from '@cssearth/objects';

test('the delivered Pleiades world row agrees with the selected detail frame', async () => {
  const descriptor = requireRecord(JSON.parse(await readFile(new URL('../../../../src/objects/m45/object.json', import.meta.url), 'utf8')));
  const frame = parsePreparedWorldCameraFrame(requireRecord(descriptor.properties).worldFrame); assert.ok(frame);
  const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8')));
  const members = parsePreparedWorldSystem(JSON.parse(await readFile(new URL('../../../../src/objects/milky-way/prepared/members.json', import.meta.url), 'utf8')), summary, 'milky-way');
  const body = members.bodies.find(row => row.id === descriptor.id); assert.ok(body);
  assert.equal(body.radiusM, frame.bodyRadiusM, 'a stale context radius prevents the real route from mounting');
  assert.deepEqual(body.positionM, frame.originM);
});
