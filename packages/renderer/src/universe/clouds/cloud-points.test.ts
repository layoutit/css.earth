import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { encodeCloudPoints, encodeCloudSegments, type PreparedBank, type PreparedCloudPoints, type PreparedCloudSegments } from '@cssearth/objects';
import { packPreparedBank } from '@cssearth/objects/node';
import { createCloudPoints, mountCloudOverlay } from './cloud-points.js';
import { retainedStyle } from './cloud-overlay-layer.js';
import { readPreparedHere } from '../../prepared-data/readers.js';
import { cloudOverlayReader, type CloudOverlayData } from './cloud-overlay-reader.js';

const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-10, -10, -10] as const, max: [10, 10, 10] as const } };
const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as [number, number], widthPixels: 400, heightPixels: 300 };
/** The camera at a place, looking along -z (or +z, turned half round). */
const at = (z: number, turned = false) => ({ world: { referenceFrame: 'fixture', epochJdTt: 1,
  pose: { positionM: [0, 0, z] as [number, number, number], orientationXyzw: (turned ? [0, 1, 0, 0] : [0, 0, 0, 1]) as [number, number, number, number] } }, viewport });
/** A ball of radius 1 about the origin: the body that hides what is behind it. */
const body = { centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } as const;
/** Two billboards on the z axis, the first in front of the body (z = 2), the second behind it (z = -5). */
const cloud: PreparedCloudPoints = { id: 'outer-ejecta', frame: frame as never, count: 2, positions: Float64Array.from([0, 0, 2, 0, 0, -5]),
  diameters: Float32Array.from([1, 2]), cells: Uint16Array.from([0, 0, 32, 0]), atlas: 'outer-ejecta.webp', cellTexels: 32, occluder: [body] };
const lines: PreparedCloudSegments = { id: 'motions', frame: frame as never, count: 1, from: Float64Array.from([0, 0, 2]), to: Float64Array.from([1, 0, 2]),
  rgba: Uint8Array.from([255, 255, 255, 255]), heads: Uint8Array.from([0]), widthPixels: 1, occluder: [] };
/** Deploys address every asset under its own directory: the atlas is not beside the bank. */
const resolveResource = (path: string) => `https://assets.example/atlas-dir/${path}`;
const page = () => {
  const { document, window } = parseHTML('<html><head><base href="https://example.org/"></head><body><div id="host"></div></body></html>');
  return { document, window, host: document.getElementById('host')! };
};
/** Every style property written on `root` and the elements under it, from now on. */
function recordWrites(root: HTMLElement) {
  const writes: string[] = [];
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const style = element.style;
    Object.defineProperty(element, 'style', { configurable: true, value: new Proxy(style, { set(target, key, value) { writes.push(String(key)); (target as unknown as Record<string | symbol, unknown>)[key] = value; return true; } }) });
  }
  return writes;
}
const order = (root: HTMLElement) => [...root.children].map(board => (board as HTMLElement).dataset.index);
/** Settles promises and the platform's streams without the timers a test has mocked. */
async function until(check: () => boolean) {
  for (let turn = 0; turn < 2000 && !check(); turn++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(check(), 'the awaited state never came');
}

test('a value written once is not written again: a still camera writes no style', () => {
  const writes: string[] = [], element = { style: new Proxy({} as Record<string, string>, { set(target, key, value) { writes.push(String(key)); target[String(key)] = value; return true; } }) };
  const style = retainedStyle(element as unknown as HTMLElement);
  style.transform('scale(2)'); style.opacity('1'); style.transform('scale(2)'); style.opacity('1');
  assert.deepEqual(writes, ['transform', 'opacity']);
  style.opacity('0.5');
  assert.deepEqual(writes, ['transform', 'opacity', 'opacity']);
});

test('billboards are built off the page, placed by transform and opacity only, dimmed behind the body, and ordered far to near when told the camera rests', () => {
  const { host } = page();
  const layer = createCloudPoints({ host, cloud, resolveResource });
  assert.equal(layer.root.parentNode, null, 'built off the page: its owner attaches it');
  assert.equal(host.children.length, 0);
  [...layer.root.children].forEach((board, index) => { (board as HTMLElement).dataset.index = String(index); });
  assert.match((layer.root.children[1] as HTMLElement).style.background, /url\("https:\/\/assets\.example\/atlas-dir\/outer-ejecta\.webp"\) -32px -0px/u,
    'each billboard shows its atlas cell, found where the atlas is published');
  const writes = recordWrites(layer.root);
  layer.place(at(10));
  assert.deepEqual([...new Set(writes)].sort(), ['opacity', 'transform'], 'a publication writes transforms and opacities only');
  const [front, behind] = [...layer.root.children].map(board => Number((board as HTMLElement).style.opacity));
  assert.deepEqual([front, behind], [1, .15], 'a billboard behind the middle of the body keeps the occluded floor');
  writes.length = 0;
  layer.place(at(10));
  assert.deepEqual(writes, [], 'the same publication again writes nothing');
  layer.place(at(9));
  assert.deepEqual(order(layer.root), ['0', '1'], 'placing never reorders');
  layer.atRest!();
  assert.deepEqual(order(layer.root), ['1', '0'], 'at rest: far (behind the body) before near');
  layer.place(at(-20, true));
  assert.deepEqual([...layer.root.children].map(board => Number((board as HTMLElement).style.opacity)), [1, .15], 'from the other side, the other is hidden');
  layer.atRest!();
  assert.deepEqual(order(layer.root), ['0', '1']);
});

const frameOrder = (root: HTMLElement) => [...root.children].map(board => {
  const node = board as HTMLElement; return `${node.dataset.cloudCluster}:${node.dataset.cloudFrame}`;
});
const orbitAt = (degree: number) => {
  const a = degree * Math.PI / 180;
  return { ...at(10), world: { ...at(10).world, pose: { positionM: [10 * Math.sin(a), 0, 10 * Math.cos(a)] as const,
    orientationXyzw: [0, Math.sin(a / 2), 0, Math.cos(a / 2)] as const } } };
};
test('grouped compositing requests one static paint group and 2D boards with unchanged geometry, alpha and order', () => {
  const { host } = page(), ordinary = createCloudPoints({ host, cloud, resolveResource });
  const grouped = createCloudPoints({ host, cloud: { ...cloud, compositing: 'grouped' }, resolveResource });
  assert.equal(grouped.root.style.willChange, 'transform'); assert.equal(grouped.root.style.transform, 'translateZ(0)');
  assert.equal(grouped.root.style.contain, 'paint'); assert.equal(grouped.root.style.overflow, 'hidden');
  assert.ok(!ordinary.root.style.willChange && !ordinary.root.style.transform && !ordinary.root.style.contain);
  const groupedNodes = [...grouped.root.children] as HTMLElement[], ordinaryNodes = [...ordinary.root.children] as HTMLElement[];
  groupedNodes.forEach((node, i) => { assert.ok(!node.style.willChange); assert.equal(ordinaryNodes[i]!.style.willChange, 'transform,opacity');
    assert.equal(node.style.width, ordinaryNodes[i]!.style.width); assert.equal(node.style.background, ordinaryNodes[i]!.style.background); });
  const writes = recordWrites(grouped.root), initial = [...grouped.root.children];
  for (const degree of [0, 45, 90, 180, 270]) {
    ordinary.place(orbitAt(degree)); grouped.place(orbitAt(degree));
    groupedNodes.forEach((node, i) => { assert.match(node.style.transform, /^translate\(/u); assert.match(ordinaryNodes[i]!.style.transform, /^translate3d\(/u);
      assert.equal(node.style.transform, ordinaryNodes[i]!.style.transform.replace('translate3d(', 'translate(').replace(',0) scale', ') scale'));
      assert.equal(node.style.opacity, ordinaryNodes[i]!.style.opacity); });
    assert.ok(initial.every((node, i) => grouped.root.children[i] === node));
  }
  assert.deepEqual([...new Set(writes)].sort(), ['opacity', 'transform']);
  writes.length = 0; grouped.place(orbitAt(270)); assert.deepEqual(writes, []);
  ordinary.atRest!(); grouped.atRest!(); assert.deepEqual(frameOrder(grouped.root), frameOrder(ordinary.root));
  assert.equal(grouped.root.style.transform, 'translateZ(0)', 'the paint-group transform remains static');
});

/** A page whose fetch answers each address with a bank, or fails while `failing` says so. */
function fetching(banks: Record<string, PreparedBank>, delayTurns = 0) {
  const { window, host } = page(), asked: string[] = [];
  const state = { failing: false };
  (window as unknown as { fetch: typeof fetch }).fetch = (async (url: string) => {
    asked.push(url);
    for (let turn = 0; turn < delayTurns; turn++) await new Promise(resolve => setImmediate(resolve));
    return state.failing ? new Response('', { status: 503 }) : new Response(new Uint8Array(packPreparedBank(banks[url]!, url)));
  }) as typeof fetch;
  return { host, asked, state };
}
function mocked(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const reader = t.mock.method(cloudOverlayReader, 'read');
  return async ({ fails = false } = {}) => {
    const reading = reader.mock.calls.at(-1)?.result;
    assert.ok(reading, 'a bank read has started');
    if (fails) await assert.rejects(reading);
    else await reading;
    // The bank is fetched, decoded and validated. Drain its delivery callbacks before inspecting the overlay.
    await new Promise(resolve => setImmediate(resolve));
  };
}

test('an overlay is attached only while it shows, and a hidden one is never mounted', async t => {
  mocked(t);
  const { host, asked } = fetching({ '/prepared/bank-dir/points.bin': encodeCloudPoints(cloud) });
  const overlay = mountCloudOverlay({ host, url: '/prepared/bank-dir/points.bin', resolveResource });
  overlay.publish(at(10), 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([asked.length, host.children.length], [0, 0], 'never shown, it is neither read nor mounted');
  overlay.publish(at(10), 1);
  await until(() => host.children.length === 1);
  const root = host.firstElementChild as HTMLElement;
  assert.match((root.firstElementChild as HTMLElement).style.background, /https:\/\/assets\.example\/atlas-dir\/outer-ejecta\.webp/u, 'its atlas is found where it is published, not beside the bank');
  assert.equal((root.firstElementChild as HTMLElement).style.transform.startsWith('translate3d('), true, 'the publication made while it was read is drawn once it arrives');
  const writes = recordWrites(root);
  overlay.publish(at(10), 0);
  assert.deepEqual([host.children.length, root.parentNode], [0, null], 'at no opacity it leaves the page');
  overlay.publish(at(10), 1);
  assert.equal(host.children.length, 1, 'and comes back when it shows');
  assert.equal(writes.includes('display'), false, 'membership, never display, hides it');
  overlay.destroy();
  assert.equal(host.children.length, 0);
});

test('while the camera coasts an overlay is neither attached nor detached, and it never reorders; the coast\'s end applies both', async t => {
  const settleRead = mocked(t);
  // Loading outlasts the old 201-turn wait, so ending the coast must wait for the actual read.
  const { host } = fetching({ '/points.bin': encodeCloudPoints(cloud) }, 1000);
  const overlay = mountCloudOverlay({ host, url: '/points.bin', resolveResource });
  overlay.setCoasting(true);
  overlay.publish(at(10), 1);
  await settleRead();
  assert.equal(host.children.length, 0, 'read mid-coast, it waits off the page');
  overlay.setCoasting(false);
  assert.equal(host.children.length, 1, 'the coast ends: it is attached');
  const root = host.firstElementChild as HTMLElement;
  [...root.children].forEach((board, index) => { (board as HTMLElement).dataset.index = String(index); });
  overlay.publish(at(10), 1);
  t.mock.timers.tick(349);
  assert.deepEqual(order(root), ['0', '1'], 'not before the camera has rested');
  overlay.publish(at(9), 1);
  t.mock.timers.tick(349);
  assert.deepEqual(order(root), ['0', '1'], 'each publication starts the rest over');
  overlay.setCoasting(true);
  t.mock.timers.tick(1);
  assert.deepEqual(order(root), ['0', '1'], 'never while the camera coasts');
  overlay.setCoasting(false);
  t.mock.timers.tick(350);
  assert.deepEqual(order(root), ['1', '0'], 'rested after the coast: far before near');
  overlay.setCoasting(true);
  overlay.publish(at(10), 0);
  assert.deepEqual([host.children.length, root.style.opacity], [1, '0'], 'hidden mid-coast it stays on the page, at opacity 0');
  overlay.setCoasting(false);
  assert.equal(host.children.length, 0, 'the coast ends: it leaves');
  overlay.destroy();
});

test('an overlay retired with the camera still is taken away at once; retired mid-coast it is cleared, deaf, and taken away when the coast ends', async t => {
  mocked(t);
  const { host } = fetching({ '/points.bin': encodeCloudPoints(cloud) });
  const still = mountCloudOverlay({ host, url: '/points.bin', resolveResource });
  still.publish(at(10), 1);
  await until(() => host.children.length === 1);
  still.retire();
  assert.equal(host.children.length, 0, 'not coasting: removed at once');
  const coasting = mountCloudOverlay({ host, url: '/points.bin', resolveResource });
  coasting.publish(at(10), 1);
  await until(() => host.children.length === 1);
  const root = host.firstElementChild as HTMLElement;
  coasting.setCoasting(true);
  coasting.retire();
  assert.deepEqual([root.parentNode === host, root.style.opacity], [true, '0'], 'mid-coast it stays on the page, cleared');
  coasting.publish(at(9), 1);
  assert.equal(root.style.opacity, '0', 'and later publications do not show it again');
  coasting.setCoasting(false);
  assert.equal(host.children.length, 0, 'the coast ends: it is taken away');
  coasting.publish(at(9), 1);
  assert.equal(host.children.length, 0, 'and never comes back');
});

test('an overlay taken away before its bank arrives never mounts', async t => {
  const settleRead = mocked(t);
  const { host } = fetching({ '/points.bin': encodeCloudPoints(cloud) }, 1000);
  const overlay = mountCloudOverlay({ host, url: '/points.bin', resolveResource });
  overlay.publish(at(10), 1);
  overlay.destroy();
  await settleRead();
  assert.equal(host.children.length, 0);
});

test('cloud frame and epoch mismatches fail before any publication writes', () => {
  const { host } = page(), layer = createCloudPoints({ host, cloud, resolveResource }), writes = recordWrites(layer.root);
  const publication = at(10);
  for (const world of [{ ...publication.world, referenceFrame: 'other' }, { ...publication.world, epochJdTt: 2 }])
    assert.throws(() => layer.place({ ...publication, world }), /different reference frames/u);
  assert.deepEqual(writes, []);
});

test('construction errors use the same bounded retry path as failed reads', async t => {
  const settle = mocked(t), warned = t.mock.method(console, 'warn', () => {});
  const { host, asked } = fetching({ '/points.bin': encodeCloudPoints(cloud) });
  const overlay = mountCloudOverlay({ host, url: '/points.bin', resolveResource() { throw new Error('unavailable atlas'); } });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) t.mock.timers.tick(2000 * 2 ** (attempt - 1));
    overlay.publish(at(10), 1); await settle();
    assert.deepEqual([asked.length, warned.mock.callCount(), host.children.length], [attempt + 1, attempt + 1, 0]);
    for (let frame = 0; frame < 20; frame++) overlay.publish(at(10), 1);
    assert.equal(asked.length, attempt + 1, 'failed construction does not re-fetch every frame');
  }
  t.mock.timers.tick(60_000); overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 4); overlay.destroy();
});

test('an overlay in the wrong frame is rejected before attachment and uses retry backoff', async t => {
  const settle = mocked(t), warned = t.mock.method(console, 'warn', () => {});
  const { host, asked } = fetching({ '/points.bin': encodeCloudPoints({ ...cloud, frame: { ...cloud.frame, epochJdTt: 2 } }) });
  const overlay = mountCloudOverlay({ host, url: '/points.bin', resolveResource });
  overlay.publish(at(10), 1); await settle();
  assert.deepEqual([asked.length, warned.mock.callCount(), host.children.length], [1, 1, 0]);
  assert.match(String(warned.mock.calls[0]!.arguments[1]), /different reference frames/u);
  overlay.publish(at(10), 1); await settle(); assert.equal(asked.length, 1); overlay.destroy();
});

test('a failed read is tried again on a later publication, waiting twice as long each time, at most four times', async t => {
  const settleRead = mocked(t);
  const warned = t.mock.method(console, 'warn', () => {});
  const { host, asked, state } = fetching({ '/points.bin': encodeCloudPoints(cloud) }, 1000);
  state.failing = true;
  const overlay = mountCloudOverlay({ host, url: '/points.bin', resolveResource });
  const settle = () => settleRead({ fails: true });
  overlay.publish(at(10), 1); await settle();
  assert.deepEqual([asked.length, warned.mock.callCount()], [1, 1], 'the failure is told, not thrown');
  overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 1, 'not again at once');
  t.mock.timers.tick(1999); overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 1);
  t.mock.timers.tick(1); overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 2, 'again after two seconds');
  t.mock.timers.tick(3999); overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 2, 'then it waits twice as long');
  t.mock.timers.tick(1); overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 3);
  t.mock.timers.tick(8000); overlay.publish(at(10), 1); await settle();
  assert.equal(asked.length, 4);
  t.mock.timers.tick(60_000); overlay.publish(at(10), 1); await settle();
  assert.deepEqual([asked.length, host.children.length], [4, 0], 'four attempts, then it stops asking');
  overlay.destroy();
  // A read that fails once and then succeeds draws.
  const second = fetching({ '/points.bin': encodeCloudPoints(cloud) });
  second.state.failing = true;
  const recovered = mountCloudOverlay({ host: second.host, url: '/points.bin', resolveResource });
  recovered.publish(at(10), 1); await settle();
  second.state.failing = false;
  t.mock.timers.tick(2000); recovered.publish(at(10), 1);
  await until(() => second.host.children.length === 1);
  recovered.destroy();
});

test('the overlay reader reads billboards or lines by the bank\'s schema, hands each buffer over once, and refuses any other bank', async () => {
  const banks: Record<string, PreparedBank> = { '/points.bin': encodeCloudPoints(cloud), '/lines.bin': encodeCloudSegments(lines),
    '/other.bin': { schema: 'cssearth-catalogue-dots@1', fields: {}, columns: {} } };
  const fetcher = (async (url: string) => new Response(new Uint8Array(packPreparedBank(banks[url]!, url)))) as unknown as typeof fetch;
  const points = await readPreparedHere('cloud-overlay', '/points.bin', fetcher), segments = await readPreparedHere('cloud-overlay', '/lines.bin', fetcher);
  assert.equal((points.value as CloudOverlayData).kind, 'points');
  assert.equal((segments.value as CloudOverlayData).kind, 'segments');
  assert.deepEqual([...(points.value as Extract<CloudOverlayData, { kind: 'points' }>).points.positions], [...cloud.positions]);
  assert.deepEqual([points.transfer.length, segments.transfer.length], [1, 1], 'the columns are views of one buffer, handed over once');
  await assert.rejects(readPreparedHere('cloud-overlay', '/other.bin', fetcher), /\/other\.bin: an overlay is cssearth-cloud-points@1 or cssearth-cloud-segments@1, not cssearth-catalogue-dots@1/u);
});

test('the overlay reader refuses an occluder whose axes do not span space: it has no inside to dim behind', async () => {
  for (const axesUnits of [[[1, 0, 0], [0, 1, 0], [0, 0, 0]], [[1, 0, 0], [0, 1, 0], [1, 1, 0]]] as [number, number, number][][]) {
    const flat = encodeCloudSegments({ ...lines, occluder: [{ centreUnits: [0, 0, 0], axesUnits }] });
    const fetcher = (async (url: string) => new Response(new Uint8Array(packPreparedBank(flat, url)))) as unknown as typeof fetch;
    await assert.rejects(readPreparedHere('cloud-overlay', '/flat.bin', fetcher), /\/flat\.bin: every occluder's axes span space/u, JSON.stringify(axesUnits));
  }
});
