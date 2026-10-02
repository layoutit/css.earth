import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { decodeCatalogueBankBinary, parseCataloguePoints, parseCompleteWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldIndex } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';
const test = sourceTest();

const prepared = new URL('../../src/objects/sun/prepared/', import.meta.url);
const json = async (name: string) => JSON.parse(await readFile(new URL(name, prepared), 'utf8')) as unknown;
/** The plain-dot stars: each is its own holder (the build's index). */
const plainStars = (index: ReturnType<typeof parsePreparedWorldIndex>) => Object.keys(index.holders).filter(id => index.holders[id] === id);

test('a plain-dot star is its own holder, never a body of the summary; one nothing orbits holds no file and its row is in the index', async () => {
  const raw = await json('world-context-summary.json'), summary = parsePreparedWorldContextSummary(raw);
  const rawIndex = await json('world-index.json'), index = parsePreparedWorldIndex(rawIndex);
  const stars = plainStars(index), alone = Object.keys(index.rows);
  assert.ok(alone.length > 0 && stars.length > alone.length, 'stars with planets and stars without are both their own holders');
  for (const id of alone) assert.ok(stars.includes(id), id);
  // No star drawn as a plain dot is a body of the summary but one another body is bound to.
  const bound = new Set(summary.bodies.flatMap(body => body.boundTo ? [body.boundTo.hostId] : []));
  assert.deepEqual(summary.bodies.filter(body => body.plainDot && body.classification === 'star' && !body.orbit && !body.boundTo && !bound.has(body.id)).map(body => body.id), []);
  for (const id of alone) await assert.rejects(access(new URL(`world-systems/${id}.json`, prepared)), `${id} has no holder file`);
  // A star with planets is in its own holder's file with them.
  const host = stars.find(id => !alone.includes(id))!;
  const file = await json(`world-systems/${host}.json`) as { bodies: { id: string[] } };
  assert.ok(file.bodies.id.includes(host) && file.bodies.id.length > 1, host);
  const whole = await parseCompleteWorldContext(raw, id => json(`world-systems/${id}.json`), rawIndex);
  assert.equal(whole.bodies.length, summary.worldBodyCount);
  assert.deepEqual(whole.bodies.map(body => body.id), index.order, 'the whole world is in the index\'s order');
  for (const id of stars) { const body = whole.bodies.find(body => body.id === id)!; assert.equal(body.plainDot, true, id); assert.equal(body.classification, 'star', id); }
  // An index that gives a body to another holder than the file that has it is refused, with both named.
  const moved = { ...index, holders: { ...index.holders, [`${host}`]: alone[0]! } };
  await assert.rejects(parseCompleteWorldContext(raw, id => json(`world-systems/${id}.json`), moved), new RegExp(`holds ${host}; the world index gives it to ${alone[0]!}`, 'u'));
});

test('the dot banks the summary names hold every plain-dot star once, at its prepared place to the bank\'s rounding', async () => {
  const raw = await json('world-context-summary.json'), summary = parsePreparedWorldContextSummary(raw);
  const rawIndex = await json('world-index.json');
  const whole = await parseCompleteWorldContext(raw, id => json(`world-systems/${id}.json`), rawIndex);
  const listed = new Set(plainStars(parsePreparedWorldIndex(rawIndex)));
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
