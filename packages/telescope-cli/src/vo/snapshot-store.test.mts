import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import test, { mock } from 'node:test';
import { promisify } from 'node:util';
import { canonical, parsePin, type DiscoverySnapshot } from '@cssearth/objects';
import { USER_ROOT } from '@cssearth/telescope-core/node';
import { normalizeSnapshot, SERVICES } from './discovery.mts';

let beforeLink: ((path: string) => Promise<void>) | undefined;
let visible: ((path: string, text: string) => void) | undefined;
mock.module('node:fs/promises', { namedExports: { ...fs, link: async (temporary: string, path: string) => {
  await beforeLink?.(path);
  const text = await fs.readFile(temporary, 'utf8');
  await fs.link(temporary, path);
  // Inspect the destination at the instant it becomes visible, before publish returns.
  assert.equal(await fs.readFile(path, 'utf8'), text);
  visible?.(path, text);
} } });
const { snapshotPublisher } = await import('./snapshot-store.mts');
const { planAccess } = await import('./access.mts');
const directory = resolve(USER_ROOT, 'output/telescopes/vo/metadata');
const snapshot: DiscoverySnapshot = {
  schema: 'cssearth-vo-discovery@1', service: 'https://example.org/tap', table: 'ivoa.ObsCore', model: 'obscore-1.1',
  request: { target: 'fixture-star' }, query: 'fixture query', scope: 'fixture', sampleLimit: 1, completeness: 'bounded-sample',
  response: { schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw: { path: '/archive/fixture-star.xml', bytes: 10 },
    effectiveUrl: 'https://example.org/tap', fetchedAt: '2026-10-13T00:00:00Z', httpStatus: 200, queryStatus: 'OK',
    fields: [], resources: [], coordinateSystems: [], timeSystems: [], issues: [], bindings: [], times: [], rows: [] },
};

test('plans without retained products never create the snapshot directory', async () => {
  const profile = SERVICES[0]!, request = { target: 'fixture-star', kind: 'image' as const };
  const value = { ...snapshot, service: profile.service, table: profile.table, model: profile.model, request,
    response: { ...snapshot.response, rows: [{ obs_publisher_did: 'ivo://fixture/star', obs_id: 'fixture-image',
      target_name: 'Fixture Star', dataproduct_type: 'image', access_url: '/science.fits', access_format: 'image/fits' }], times: [{}] } };
  const target = { id: request.target, names: ['Fixture Star'] };
  const observation = normalizeSnapshot(value, profile, target, [target])[0]!;
  assert.equal(observation.target.status, 'confirmed');
  for (const refused of [
    { ...observation, target: { ...observation.target, status: 'unmatched' as const } },
    { ...observation, access: { ...observation.access, mime: 'text/html' } },
  ]) {
    const plan = await planAccess(USER_ROOT, refused, value, request);
    assert.equal(plan.products.length, 0);
    await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
  }
});

test('publisher is lazy and memoizes one complete file, even for concurrent callers', async context => {
  const publish = snapshotPublisher(snapshot);
  await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T12:34:56Z') });
  const first = publish(), second = publish();
  assert.equal(first, second);
  const pin = await first;
  assert.deepEqual(await second, pin);
  assert.deepEqual(await publish(), pin);
  assert.equal(await fs.readFile(pin.path, 'utf8'), canonical(snapshot));
  assert.equal((await fs.stat(pin.path)).size, pin.bytes);
  assert.deepEqual(await fs.readdir(directory), [basename(pin.path)]);
  assert.match(basename(pin.path), /^fixture-star-20261013T123456Z-[a-f0-9]{12}\.snapshot\.json$/u);
});

test('identical snapshots published sequentially have distinct immutable pins', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T12:34:56Z') });
  const first = await snapshotPublisher(snapshot)(), before = await fs.stat(first.path);
  const second = await snapshotPublisher(snapshot)();
  assert.notEqual(first.path, second.path);
  for (const pin of [first, second]) {
    assert.equal(await fs.readFile(pin.path, 'utf8'), canonical(snapshot));
    assert.equal((await fs.stat(pin.path)).size, pin.bytes);
  }
  assert.equal((await fs.stat(first.path)).mtimeMs, before.mtimeMs);
});

test('concurrent publishers with identical and different answers expose distinct complete files', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T12:34:56Z') });
  const snapshots = Array.from({ length: 24 }, (_, i) => i % 2 ? snapshot : { ...snapshot, query: `answer ${i}` });
  const published = new Map<string, string>();
  visible = (path, text) => { published.set(path, text); };
  const before = await fs.readdir(directory);
  try {
    const pins = await Promise.all(snapshots.map(value => snapshotPublisher(value)()));
    assert.equal(new Set(pins.map(pin => pin.path)).size, snapshots.length);
    assert.equal(published.size, snapshots.length);
    assert.equal((await fs.readdir(directory)).length, before.length + snapshots.length);
    for (const [index, pin] of pins.entries()) {
      const text = canonical(snapshots[index]!);
      assert.equal(published.get(pin.path), text);
      assert.equal(await fs.readFile(pin.path, 'utf8'), text);
      assert.equal((await fs.stat(pin.path)).size, pin.bytes);
      assert.equal(pin.bytes, Buffer.byteLength(text));
    }
    assert.ok((await fs.readdir(directory)).every(name => name.endsWith('.snapshot.json')));
  } finally { visible = undefined; }
});

test('exclusive publication retries an occupied name without modifying its bytes', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T12:34:56Z') });
  let occupied: string | undefined;
  const original = 'previously published evidence';
  beforeLink = async path => {
    if (occupied !== undefined) return;
    occupied = path;
    await fs.writeFile(path, original, { flag: 'wx' });
  };
  try {
    const pin = await snapshotPublisher(snapshot)();
    assert.ok(occupied);
    assert.notEqual(pin.path, occupied);
    assert.equal(await fs.readFile(occupied, 'utf8'), original);
    assert.equal(await fs.readFile(pin.path, 'utf8'), canonical(snapshot));
    assert.equal((await fs.stat(pin.path)).size, pin.bytes);
    assert.ok((await fs.readdir(directory)).every(name => name.endsWith('.snapshot.json')));
  } finally { beforeLink = undefined; }
});

test('response bases are filesystem-safe, bounded, and use a short random suffix', async () => {
  for (const [raw, stem] of [
    ['/archive/a target?<>:*\\.XML', 'a-target'], ['/archive/???.xml', 'response'],
    [`/archive/${'long-response-'.repeat(30)}.xml`, 'long-response-'.repeat(30).slice(0, 120)],
  ]) {
    const value = { ...snapshot, response: { ...snapshot.response, raw: { ...snapshot.response.raw, path: raw! } } };
    const pin = await snapshotPublisher(value)(), name = basename(pin.path);
    assert.ok(name.startsWith(`${stem}-`));
    assert.match(name, /^[a-z0-9_-]+-\d{8}T\d{6}Z-[a-f0-9]{12}\.snapshot\.json$/iu);
    assert.doesNotMatch(name, /[a-f0-9]{32,}/iu);
    assert.ok(Buffer.byteLength(name) <= 255);
    assert.equal(resolve(pin.path, '..'), directory);
    assert.equal(await fs.readFile(pin.path, 'utf8'), canonical(value));
    assert.equal((await fs.stat(pin.path)).size, pin.bytes);
  }
});

test('separate processes publish identical and different answers without sharing files', async () => {
  const execute = promisify(execFile), fixture = resolve(USER_ROOT, 'snapshot-input.json');
  await fs.writeFile(fixture, canonical(snapshot));
  const publish = async (query: string) => {
    const { stdout } = await execute(process.execPath,
      [resolve(import.meta.dirname, 'snapshot-store.test-support.mts'), fixture, query], { timeout: 15000 });
    return parsePin(JSON.parse(stdout));
  };
  const first = await publish(snapshot.query), second = await publish(snapshot.query);
  const queries = [snapshot.query, snapshot.query, 'different answer', 'different answer'];
  const concurrent = await Promise.all(queries.map(query => publish(query)));
  const pins = [first, second, ...concurrent], expected = [snapshot.query, snapshot.query, ...queries];
  assert.equal(new Set(pins.map(pin => pin.path)).size, pins.length);
  for (const [index, pin] of pins.entries()) {
    const text = canonical({ ...snapshot, query: expected[index]! });
    assert.equal(await fs.readFile(pin.path, 'utf8'), text);
    assert.equal((await fs.stat(pin.path)).size, pin.bytes);
    assert.equal(pin.bytes, Buffer.byteLength(text));
  }
});
