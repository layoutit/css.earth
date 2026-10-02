import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
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

test('every plain-dot star is a dot once: of the Milky Way\'s own bank when the galaxy holds it, else of the world\'s banks', async () => {
  const raw = await json('world-context-summary.json'), summary = parsePreparedWorldContextSummary(raw);
  const rawIndex = await json('world-index.json');
  const whole = await parseCompleteWorldContext(raw, id => json(`world-systems/${id}.json`), rawIndex);
  const listed = new Set(plainStars(parsePreparedWorldIndex(rawIndex)));
  // The galaxy's stars: the tracked table its dots are merged from (site/build/prepare/paged-star-dot-positions.mts).
  const table = gunzipSync(await readFile(new URL('../../src/objects/milky-way-volume/source/packaged-stars/positions.csv.gz', import.meta.url))).toString('utf8').trim().split('\n');
  assert.equal(table[0], 'name,xKpc,yKpc,zKpc,color');
  const galaxy = new Map(table.slice(1).map(row => { const [name, x, y, z] = row.split(','); return [name!, [Number(x), Number(y), Number(z)]] as const; }));
  const KPC_M = 3.0856775814913673e19;
  for (const [id, kpc] of galaxy) {
    const body = whole.bodies.find(body => body.id === id);
    assert.ok(body && listed.has(id), `${id} of the galaxy's table is a plain-dot star of the world`);
    assert.ok(kpc.every((value, axis) => Math.abs(value * KPC_M - body.positionM[axis]!) <= KPC_M * 0.5e-4 * 1.0001), `${id} is at its prepared place to the table's rounding`);
  }
  assert.ok(summary.dotBanks?.length);
  const points: { positionM: number[]; toleranceM: number }[] = [];
  for (const id of summary.dotBanks!) {
    const name = `${id}.bin`, bank = parseCataloguePoints(decodeCatalogueBankBinary(unpackPreparedBinary(await readFile(new URL(name, prepared)), name), name), name);
    assert.equal(bank.id, id);
    for (const point of bank.points) points.push({ toleranceM: bank.frame.metersPerUnit * 1e-4,
      positionM: point.positionUnits.map((value, axis) => value * bank.frame.metersPerUnit + bank.frame.originM[axis]!) });
  }
  const outside = whole.bodies.filter(body => listed.has(body.id) && !galaxy.has(body.id));
  assert.ok(galaxy.size > 0 && outside.length > 0, 'stars of the galaxy and stars of other galaxies');
  assert.equal(points.length, outside.length, 'the world\'s banks hold the stars the galaxy\'s table does not name, and no other');
  for (const body of outside) {
    assert.ok(points.some(point => point.positionM.every((value, axis) => Math.abs(value - body.positionM[axis]!) <= point.toleranceM)), `${body.id} has its dot`);
  }
});
