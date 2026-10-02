import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { decodeCatalogueBankBinary, parseCataloguePoints, parseCompleteWorldContext, parsePreparedWorldContextSummary, starsWithoutSystem } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';
import { listedBodies, ownsItsWorldRow } from '../startup-world.mts';
const test = sourceTest();

const prepared = new URL('../../src/objects/sun/prepared/', import.meta.url);
const json = async (name: string) => JSON.parse(await readFile(new URL(name, prepared), 'utf8')) as unknown;

test('a plain-dot star is listed, never a body of the summary; one nothing orbits holds no file and its row is in the stars table', async () => {
  const raw = await json('world-context-summary.json'), summary = parsePreparedWorldContextSummary(raw);
  const stars = await json('world-stars.json') as Record<string, unknown>;
  const listed = (summary.deferred ?? []).filter(body => body.host === body.id), alone = starsWithoutSystem(summary.deferred);
  assert.ok(alone.length > 0 && listed.length > alone.length, 'stars with planets and stars without are both listed');
  assert.deepEqual(Object.keys(stars).sort(), [...alone].sort());
  for (const body of listed) { assert.equal(body.plainDot, true, body.id); assert.equal(body.classification, 'star', body.id); }
  // No star drawn as a plain dot is a body of the summary but one another body is bound to.
  const bound = new Set(summary.bodies.flatMap(body => body.boundTo ? [body.boundTo.hostId] : []));
  assert.deepEqual(summary.bodies.filter(body => body.plainDot && body.classification === 'star' && !body.orbit && !body.boundTo && !bound.has(body.id)).map(body => body.id), []);
  for (const id of alone) await assert.rejects(access(new URL(`world-systems/${id}.json`, prepared)), `${id} has no system file`);
  // A star with planets is in its own system's file with them.
  const host = listed.find(body => !alone.includes(body.id))!;
  const file = await json(`world-systems/${host.id}.json`) as { bodies: { id: string[] } };
  assert.ok(file.bodies.id.includes(host.id) && file.bodies.id.length > 1, host.id);
  const whole = await parseCompleteWorldContext(raw, id => json(`world-systems/${id}.json`), stars);
  assert.equal(whole.bodies.length, summary.worldBodyCount);
  // A reader that forgets the table is told which star it lacks.
  await assert.rejects(parseCompleteWorldContext(raw, id => json(`world-systems/${id}.json`)), /world-stars\.json holds none for it/u);
  // The page's early read works on the file as written, one column per field.
  const rows = listedBodies(raw);
  assert.equal(rows?.length, summary.deferred?.length);
  assert.equal(ownsItsWorldRow(rows, alone[0]!), true);
  assert.equal(ownsItsWorldRow(rows, host.id), false, 'a star with planets reads its system file');
});

test('the dot banks the summary names hold every listed star once, at its prepared place to the bank\'s rounding', async () => {
  const summary = parsePreparedWorldContextSummary(await json('world-context-summary.json'));
  const stars = await json('world-stars.json') as Record<string, unknown>;
  const whole = await parseCompleteWorldContext(await json('world-context-summary.json'), id => json(`world-systems/${id}.json`), stars);
  const listed = new Set((summary.deferred ?? []).filter(body => body.host === body.id).map(body => body.id));
  assert.ok(summary.dotBanks?.length);
  const points: { positionM: number[]; toleranceM: number }[] = [];
  for (const id of summary.dotBanks!) {
    const name = `${id}.bin`, bank = parseCataloguePoints(decodeCatalogueBankBinary(unpackPreparedBinary(await readFile(new URL(name, prepared)), name), name), name);
    assert.equal(bank.id, id);
    for (const point of bank.points) points.push({ toleranceM: bank.frame.metersPerUnit * 1e-4,
      positionM: point.positionUnits.map((value, axis) => value * bank.frame.metersPerUnit + bank.frame.originM[axis]!) });
  }
  assert.equal(points.length, listed.size);
  for (const body of whole.bodies.filter(body => listed.has(body.id))) {
    assert.ok(points.some(point => point.positionM.every((value, axis) => Math.abs(value - body.positionM[axis]!) <= point.toleranceM)), `${body.id} has its dot`);
  }
});
