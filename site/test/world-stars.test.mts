import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { decodeCatalogueBankBinary, parseCataloguePoints, parseCompleteWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldIndex } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';
import { OBJECTS } from '../objects.mts';
const test = sourceTest();

const prepared = new URL('../../src/objects/observable-universe/prepared/', import.meta.url);
const json = async (name: string) => JSON.parse(await readFile(new URL(name, prepared), 'utf8')) as unknown;
/** The plain-dot stars of a whole world: a star drawn as a plain dot that orbits nothing, whether or not it is bound to
 * another (packages/objects/src/prepared-data/world-holders.ts). */
const plainStars = (whole: { readonly bodies: readonly { id: string; plainDot?: boolean; classification?: string; orbit?: unknown }[] }) =>
  whole.bodies.filter(body => body.plainDot && body.classification === 'star' && !body.orbit).map(body => body.id);

test('a plain-dot star is never a body of a file read at startup; one inside no system has its row in the index, one with planets or bound to a system\'s star is in that system\'s file', async () => {
  const raw = await json('world.json'), summary = parsePreparedWorldContextSummary(raw);
  const rawIndex = await json('world-index.json'), index = parsePreparedWorldIndex(rawIndex);
  const read = (id: string) => json(`../../${id}/prepared/members.json`);
  const whole = await parseCompleteWorldContext(raw, read, rawIndex);
  const stars = plainStars(whole), alone = Object.keys(index.rows);
  assert.ok(alone.length > 0 && stars.length > alone.length, 'stars with planets and stars without are both plain dots');
  for (const id of alone) assert.ok(stars.includes(id), id);
  // The summary lists no body: every body is in the file of the object it is inside.
  assert.deepEqual(summary.bodies, []);
  // No file read at startup has a plain-dot star: its dot is its galaxy's, and its row is its own entry's.
  for (const id of index.files) {
    const file = await read(id) as { anywhere?: unknown; bodies: { id?: string[] } };
    if (file.anywhere === true) for (const body of file.bodies.id ?? []) assert.ok(!stars.includes(body), `${id} holds the plain-dot star ${body}`);
  }
  for (const id of alone) await assert.rejects(access(new URL(`../../${id}/prepared/members.json`, prepared)), `${id} has no file of its own`);
  // A star with planets is in its own system's file with them, and a companion bound to a system's star is in that file.
  const host = stars.find(id => index.files.includes(`${id}-system`))!;
  const file = await read(`${host}-system`) as { bodies: { id: string[] } };
  assert.ok(file.bodies.id.includes(host) && file.bodies.id.length > 1, host);
  const companion = whole.bodies.find(body => stars.includes(body.id) && body.boundTo)!;
  const shared = await read(`${companion.boundTo!.hostId}-system`) as { anywhere?: unknown; bodies: { id: string[] } };
  assert.ok(shared.bodies.id.includes(companion.id) && !alone.includes(companion.id), `${companion.id} is in the file of ${companion.boundTo!.hostId}'s system`);
  assert.equal(whole.bodies.length, summary.worldBodyCount);
  assert.deepEqual(whole.bodies.map(body => body.id), index.order, 'the whole world is in the index\'s order');
  for (const id of stars) { const body = whole.bodies.find(body => body.id === id)!; assert.equal(body.plainDot, true, id); assert.equal(body.classification, 'star', id); }
  // A body two files hold is refused, with the file named.
  const copy = async (id: string) => id === 'earth-system' ? { ...(await read(`${host}-system`) as object), id: 'earth-system' } : read(id);
  await assert.rejects(parseCompleteWorldContext(raw, copy, rawIndex), /holds [a-z0-9-]+, which another file holds too/u);
});

test('every plain-dot star is a dot once: of the Milky Way\'s own bank when the galaxy holds it, else of the object it is inside', async () => {
  const raw = await json('world.json'), summary = parsePreparedWorldContextSummary(raw);
  const rawIndex = await json('world-index.json');
  const whole = await parseCompleteWorldContext(raw, id => json(`../../${id}/prepared/members.json`), rawIndex);
  const listed = new Set(plainStars(whole));
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
  // The summary names the objects with a dot bank, each in its own package: the objects those stars are inside.
  assert.ok(summary.dotBanks?.length);
  assert.ok(!summary.dotBanks!.includes('observable-universe'), 'the world has no dot bank of its own: every page would ask for it');
  const points = new Map<string, { positionM: number[]; toleranceM: number }[]>();
  for (const id of summary.dotBanks!) {
    const name = 'plain-stars.bin', bank = parseCataloguePoints(decodeCatalogueBankBinary(unpackPreparedBinary(await readFile(new URL(`../../${id}/prepared/${name}`, prepared)), name), name), name);
    assert.equal(bank.id, 'plain-stars');
    assert.ok(OBJECTS.some(object => object.id === id), `${id} is an object`);
    points.set(id, bank.points.map(point => ({ toleranceM: bank.frame.metersPerUnit * 1e-4,
      positionM: point.positionUnits.map((value, axis) => value * bank.frame.metersPerUnit + bank.frame.originM[axis]!) })));
  }
  const outside = whole.bodies.filter(body => listed.has(body.id) && !galaxy.has(body.id));
  assert.ok(galaxy.size > 0 && outside.length > 0, 'stars of the galaxy and stars of other galaxies');
  assert.equal([...points.values()].flat().length, outside.length, 'the banks hold the stars the galaxy\'s table does not name, and no other');
  for (const body of outside) {
    // The object it is inside: its parent in the object tree, or its own system's parent.
    const parent = OBJECTS.find(object => object.id === body.id)?.parent;
    const holder = parent === `${body.id}-system` ? OBJECTS.find(object => object.id === parent)?.parent : parent;
    assert.ok(holder !== undefined && points.get(holder)?.some(point => point.positionM.every((value, axis) => Math.abs(value - body.positionM[axis]!) <= point.toleranceM)),
      `${body.id} has its dot in the bank of ${holder}, the object it is inside`);
  }
});
