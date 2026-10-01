import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { mountCataloguePoints, parseCataloguePoints } from './catalogue-points.js';
import { catalogueCells, cataloguePointSpread } from '@cssearth/objects';
import { decodeCatalogueBankBinary } from '../prepared-data/catalogue-bank-binary.js';
import { unpackPreparedBinary } from '@cssearth/objects/node';
import { holdStartup, releaseStartup } from '../rendering/startup-gate.js';

/** What the bake adds to a published bank (catalogue-banks.ts): its spread and its cells, per level. */
const baked = (points: readonly (readonly number[])[], levels?: readonly number[]) => ({ spread: cataloguePointSpread(points), cells: catalogueCells(points, levels) });

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } };
const bank = { schema: 'cssearth-catalogue-points@1', id: 'test-stars', frame,
  appearance: { colorCss: '#ffe2a8', radiusPx: .75, opacity: .7 }, points: [[1, 0, -10], [-1, 0, -10]],
  ...baked([[1, 0, -10], [-1, 0, -10]]) };

test('the prepared catalogues the app draws are valid banks of every selected row with a distance', () => {
  // The published banks: what each recipe marks `published: true` and the app fetches. Their inputs (a survey's stars,
  // one catalogue's masers) are bake inputs in output/catalogue-points/, so they are not read here.
  for (const [object, id] of [['milky-way', 'globular-clusters'], ['milky-way', 'dots'], ['milky-way', 'old-star-dots'], ['nearby-universe', 'dots'], ['nearby-universe', 'bright-galaxy-dots'],
    ['nearby-universe', 'quasar-dots'], ['m31-layers', 'stars'], ['m31-layers', 'dots'], ['m33-layers', 'stars'], ['m33-layers', 'dots'], ['m81-layers', 'dots'], ['ngc-253-layers', 'dots']]) {
    const path = new URL(`../../../../src/objects/${object}/prepared/${id}.bin`, import.meta.url);
    const prepared = decodeCatalogueBankBinary(unpackPreparedBinary(readFileSync(path), path.pathname), path.pathname) as {
      points: number[][]; counts: { points: number; missingDistance?: number; selected?: number }; source?: string; appearance: { levels?: { points: number }[] } };
    const parsed = parseCataloguePoints(prepared);
    assert.equal(parsed.id, id);
    assert.equal(parsed.points.length, prepared.counts.points);
    assert.deepEqual(parsed.spread, cataloguePointSpread(prepared.points), `${object}/${id}: the bake's spread is the one its points trace`);
    const cells = catalogueCells(prepared.points, prepared.appearance.levels?.map(level => level.points));
    assert.deepEqual(([...parsed.cells.of]), cells.of, `${object}/${id}: the bake's cells are the ones its points and levels give`);
    // A merged or stacked bank (packages/bake/cli/merge-catalogue-points.mts, stack.mts) counts only its points; a prepared one also its rows.
    if (prepared.source !== 'merge' && prepared.source !== 'stack') assert.equal((prepared.counts.points + prepared.counts.missingDistance!), prepared.counts.selected);
  }
});

test('a stacked bank adds its inner levels\' dots as the view narrows, only once the outer level is whole', async () => {
  const { stackedPointCount } = await import('./catalogue-points.js');
  const levels = [{ points: 1000, fullDetailUnits: 10 }, { points: 400, appearUnits: [3, 1] as const }, { points: 200, appearUnits: [1, 0.1] as const }];
  const count = (distance: number, halfWidth = distance) => stackedPointCount(levels, distance, halfWidth, 1);
  assert.equal(count(20), 500);
  assert.equal(count(10), 1000, 'the outer level is whole within its full-detail distance');
  assert.equal(count(3), 1000);
  assert.equal(count(Math.sqrt(3)), 1200, 'halfway through its window in the logarithm');
  assert.equal(count(1), 1400);
  assert.equal(count(0.05), 1600);
  let previous = 0;
  for (let distance = 40; distance > 0.01; distance *= 0.97) {
    const next = count(distance);
    assert.ok(next >= previous);
    previous = next;
  }
  assert.throws(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, levels: [{ points: 1, fullDetailUnits: 1 }, { points: 1, appearUnits: [2, 1] }] } }), /test-stars: level 1 appears over a shrinking window/);
});

test('seen from outside, a bank draws only as many dots as its projected shape holds', async () => {
  const { screenPointCount } = await import('./catalogue-points.js');
  // A flat disc of radius 10 in the x-y plane.
  const disc = Array.from({ length: 2000 }, (_, i) => [10 * Math.sqrt((i + .5) / 2000) * Math.cos(i * 2.4), 10 * Math.sqrt((i + .5) / 2000) * Math.sin(i * 2.4), 0]);
  const spread = cataloguePointSpread(disc);
  assert.ok(Math.abs(Math.abs(spread.normal[2]) - (1)) < 10 ** -6 / 2, `${Math.abs(spread.normal[2])} is not close to ${1}`);
  assert.ok(spread.across > 9); assert.ok(Math.abs(spread.along - (0)) < 10 ** -6 / 2, `${spread.along} is not close to ${0}`);
  assert.equal(screenPointCount(spread, [0, 0, 5], 1000), Infinity, 'within its reach there is no limit');
  const faceOn = screenPointCount(spread, [0, 0, 1000], 1000), tilted = screenPointCount(spread, [0, 800, 600], 1000), far = screenPointCount(spread, [0, 0, 4000], 1000);
  assert.equal(faceOn, Math.floor(Math.PI * (1000 * spread.across / 1000) ** 2 / 64));
  assert.ok(tilted < faceOn);
  assert.equal(far, Math.floor(Math.PI * (1000 * spread.across / 4000) ** 2 / 64), 'four times farther holds a sixteenth');
  assert.equal(screenPointCount(spread, [0, 0, 1000], 1000, 256), Math.floor(faceOn * 64 / 256), 'a sparser bank holds a quarter as many');
  assert.equal(parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, outsidePixelsPerDot: 256 } }).appearance.outsidePixelsPerDot, 256);
  assert.throws(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, outsidePixelsPerDot: 0 } }), /test-stars: outsidePixelsPerDot is a positive number/);
});

test('a palette bank colours each point by its index and refuses an index outside the palette', () => {
  const coloured = { ...bank, appearance: { ...bank.appearance, palette: ['#8ec9ff', '#ffc070'] }, points: [[1, 0, -10, 0], [-1, 0, -10, 1]] };
  assert.deepEqual(parseCataloguePoints(coloured).points.map(point => point.colorCss), ['#8ec9ff', '#ffc070']);
  assert.throws(() => parseCataloguePoints({ ...coloured, points: [[1, 0, -10, 2]] }), /test-stars: point 0 names palette colour 2/);
});

test('catalogue point banks refuse malformed points and appearances, naming the bank', () => {
  assert.throws(() => parseCataloguePoints({ ...bank, points: [[1, 0]] }), /test-stars: point 0/);
  assert.throws(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, colorCss: 'gold' } }), /test-stars: catalogue point appearance/);
  assert.throws(() => parseCataloguePoints({ ...bank, points: [] }), /test-stars: a catalogue point bank holds/);
  const { spread: _spread, ...unspread } = bank;
  const { cells: _cells, ...uncelled } = bank;
  assert.throws(() => parseCataloguePoints(uncelled), /test-stars \(catalogue points\): catalogue point bank field cells must be/);
  assert.throws(() => parseCataloguePoints(unspread), /test-stars \(catalogue points\): catalogue point bank field spread must be .* got undefined/);
  assert.throws(() => parseCataloguePoints({ ...bank, spread: { normal: [1, 1, 0], across: 1, along: 0 } }), /test-stars \(catalogue points\): catalogue point bank field spread/);
  assert.throws(() => parseCataloguePoints({ ...bank, spread: { ...bank.spread, across: -1 } }), /test-stars \(catalogue points\): catalogue point bank field spread/);
});

test('a catalogue loads on its first publication and draws every point as the same small dot', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  let fetched = 0;
  const points = mountCataloguePoints({ host, url: '/cepheids.json', loadBank: async () => { fetched++; return {...bank, appearance: {...bank.appearance, opacity: 1}}; } });
  assert.equal(fetched, 0);
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  points.publish({ world, viewport });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fetched, 1);
  assert.equal(points.root.dataset.cataloguePoints, 'test-stars');
  const paths = [...points.root.querySelectorAll('path')];
  assert.equal(paths.length, 1);
  assert.equal(paths[0]!.getAttribute('stroke'), '#ffe2a8ff');
  assert.equal(paths[0]!.getAttribute('stroke-width'), '12', 'as wide as the dot, 1.5 px in eighths of a pixel');
  assert.equal(paths[0]!.getAttribute('d')!.match(/M/g)?.length, 2);
  assert.match(paths[0]!.getAttribute('d') ?? '', /^(M-?[\d.]+ -?[\d.]+h0){2}$/);
  const retainedPath = paths[0];
  points.publish({ world: {...world, pose: {...world.pose, positionM: [1,0,0]}}, viewport });
  assert.equal(points.root.querySelector('path'), retainedPath);
  assert.equal(points.root.querySelectorAll('i').length, 0);
  points.publish({ world, viewport }); assert.equal(fetched, 1);
  points.destroy(); assert.equal(host.children.length, 0);
});

test('a catalogue shown during a body\'s first view loads once that view is interactive and the browser idle', async () => {
  const { document, window } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const idle: (() => void)[] = [];
  Reflect.set(window, 'requestIdleCallback', (run: () => void) => idle.push(run));
  const fetched: string[] = [];
  const points = mountCataloguePoints({ host, url: '/dots.bin', loadBank: async url => { fetched.push(url); return bank; } });
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  holdStartup(window as unknown as Window);
  points.publish({ world, viewport });
  points.publish({ world, viewport });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(fetched, []);
  releaseStartup(window as unknown as Window);
  assert.deepEqual(fetched, [], 'released, it still waits for idle');
  idle[0]!();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(fetched, ['/dots.bin'], 'one request, once');
  assert.equal(points.root.dataset.cataloguePoints, 'test-stars');
  assert.equal(points.root.querySelectorAll('path').length, 1, 'drawn from the latest view');
  points.destroy();
});

test('a level with a near opacity draws as its own part and dims to it as the innermost level fills the view', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const points = [[0, 0, -10], [0, 1, -10], [1, 0, -10]];
  const stacked = { ...bank, points, ...baked(points, [1, 1, 1]), appearance: { ...bank.appearance, opacity: 1, levels: [
    { points: 1, fullDetailUnits: 100, nearOpacity: .5 }, { points: 1, appearUnits: [10, 1] }, { points: 1, appearUnits: [1, .01] }] } };
  const field = mountCataloguePoints({ host, url: '/dots.json', loadBank: async () => stacked });
  // The view's half-width at the origin is the camera's distance times hypot(1000, 800) / 2 / 100.
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (distance: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, distance] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  field.publish(at(1)); await new Promise(resolve => setTimeout(resolve, 0)); field.publish(at(1));
  // The levels are groups of one svg: one layer (batched-spatial-points.ts), each group dimmed alone.
  const parts = [...field.root.querySelectorAll('svg > g')] as unknown as HTMLElement[];
  assert.equal(parts.length, 3, 'one part per level');
  assert.equal(parts[0]!.style.opacity, '1', 'before the innermost level appears');
  const halfWidthPerDistance = Math.hypot(1000, 800) / 200;
  field.publish(at(Math.sqrt(.01) / halfWidthPerDistance));
  assert.ok(Math.abs(Number(parts[0]!.style.opacity) - (.75)) < 10 ** -12 / 2, 'halfway through its window in the logarithm');
  field.publish(at(.001));
  assert.deepEqual(parts.map(part => part.style.opacity), ['0.5', '1', '1']);
  field.destroy();
  for (const nearOpacity of [0, 1.5]) {
    assert.throws(() => parseCataloguePoints({ ...stacked, appearance: { ...stacked.appearance, levels: [{ ...stacked.appearance.levels[0], nearOpacity }, ...stacked.appearance.levels.slice(1)] } }), { message: `test-stars: level 0 nearOpacity must be in (0, 1], got ${nearOpacity}.` });
  }
});

test('a screen budget draws an even, stable share of the visible dots and refuses a bad budget', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  // 1,000 dots spread in front of the camera, all on screen; the budget keeps about 250 of them.
  const points = Array.from({ length: 1000 }, (_, i) => [((i * 37) % 200 - 100) / 100, ((i * 91) % 160 - 80) / 100, -10]);
  const budgeted = { ...bank, points, ...baked(points), appearance: { ...bank.appearance, opacity: 1, screenBudget: 250 } };
  const field = mountCataloguePoints({ host, url: '/dots.json', loadBank: async () => budgeted });
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (x: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [x, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const drawn = () => [...field.root.querySelectorAll('path')].map(path => path.getAttribute('d')!).join('').match(/M/g)?.length ?? 0;
  field.publish(at(0)); await new Promise(resolve => setTimeout(resolve, 0));
  field.publish(at(0.001)); field.publish(at(0.002));
  // The share is detail: while the camera moves the paint is warped, and the pause repaints with the share.
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(drawn() > 200, 'the first frame counts, the pause keeps a quarter');
  assert.ok(drawn() < 300);
  const kept = drawn();
  field.publish(at(0.003));
  assert.equal(drawn(), kept, 'the same dots stay as the camera moves');
  field.destroy();
  for (const screenBudget of [0, 1.5, -3]) {
    assert.throws(() => parseCataloguePoints({ ...budgeted, appearance: { ...budgeted.appearance, screenBudget } }), { message: `test-stars: catalogue point screenBudget must be a positive whole number, got ${screenBudget}.` });
  }
});

test('zooming out draws a shrinking prefix of the catalogue', async () => {
  const { drawnPointCount } = await import('./catalogue-points.js');
  const kpc = 3.0856775814913673e19;
  assert.equal(drawnPointCount(4004, 8 * kpc), 4004);
  assert.equal(drawnPointCount(4004, 20 * kpc), 2002);
  assert.equal(drawnPointCount(4004, 200 * kpc), 300);
  assert.equal(drawnPointCount(165, 1000 * kpc), 165, 'a sparse catalogue keeps every point');
});

test('a translucent catalogue draws its dots as paths with their alpha', async () => {
  const {document} = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const points = mountCataloguePoints({host, url:'/translucent.json', loadBank:async()=>bank});
  points.publish({world:{referenceFrame:'sun-icrf',epochJdTt:2451545,
    pose:{positionM:[0,0,0],orientationXyzw:[0,0,0,1]}},
    viewport:{focalPixels:100,principalOffsetPixels:[0,0],widthPixels:1000,heightPixels:800}});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(points.root.querySelector('i'), null);
  assert.equal([...points.root.querySelectorAll('path')].some(path=>path.getAttribute('stroke')==='#ffe2a8b3'&&path.getAttribute('d')), true);
  points.destroy();
});

test('a sized palette draws one colour at two radii as two paths, and refuses a radius list that does not match', async () => {
  const sized = { ...bank, appearance: { ...bank.appearance, palette: ['#ffffff', '#ffffff'], paletteRadiusPx: [1.1, 0.5] },
    points: [[1, 0, -10, 0], [-1, 0, -10, 1]] };
  assert.deepEqual(parseCataloguePoints(sized).points.map(point => point.radiusPx), [1.1, 0.5]);
  assert.throws(() => parseCataloguePoints({ ...sized, appearance: { ...sized.appearance, paletteRadiusPx: [1] } }), /test-stars: paletteRadiusPx holds one positive radius per palette colour/);
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const points = mountCataloguePoints({ host, url: '/sized.json', loadBank: async () => sized });
  points.publish({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 1000, heightPixels: 800 } });
  await new Promise(resolve => setTimeout(resolve, 0));
  const drawn = [...points.root.querySelectorAll('path')].filter(path => path.getAttribute('d'));
  assert.deepEqual(drawn.map(path => [path.getAttribute('stroke'), path.getAttribute('stroke-width')]).sort(), [['#ffffffb3', '17.6'], ['#ffffffb3', '8']]);
  points.destroy();
});

test('a stacked bank\'s levels are one layer, which switches on in one frame', async () => {
  const { document, window } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const frames: FrameRequestCallback[] = [];
  Object.assign(window, { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback), cancelAnimationFrame() {}, performance: { now: () => 0 } });
  const points = [[0, 0, -10], [0, 1, -10], [1, 0, -10]];
  const stacked = { ...bank, points, ...baked(points, [1, 1, 1]), appearance: { ...bank.appearance, opacity: 1, levels: [
    { points: 1, fullDetailUnits: 100, nearOpacity: .5 }, { points: 1, appearUnits: [10, 1] }, { points: 1, appearUnits: [1, .01] }] } };
  const field = mountCataloguePoints({ host, url: '/dots.json', loadBank: async () => stacked });
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  field.publish({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 1] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  await new Promise(resolve => setTimeout(resolve, 0));
  const layers = [...field.root.children] as HTMLElement[];
  assert.equal(layers.length, 1, 'three levels, one layer');
  const hidden = () => layers.filter(layer => layer.style.visibility === 'hidden').length;
  assert.equal(hidden(), 1);
  frames.shift()!(0);
  assert.equal(hidden(), 0);
  field.destroy();
});

test('an inner level with its own screen budget moves the bank\'s to it as the level appears', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  // 1,000 dots in the outer level and one in the inner level, all on screen; 250 at most from far, 750 once inside.
  const points = Array.from({ length: 1001 }, (_, i) => [((i * 37) % 200 - 100) / 100, ((i * 91) % 160 - 80) / 100, -10]);
  const levels = [{ points: 1000, fullDetailUnits: 100 }, { points: 1, appearUnits: [0.64, 0.064], screenBudget: 750 }];
  const budgeted = { ...bank, points, ...baked(points, levels.map(level => level.points)), appearance: { ...bank.appearance, opacity: 1, screenBudget: 250, levels } };
  const field = mountCataloguePoints({ host, url: '/dots.json', loadBank: async () => budgeted });
  // The view's half-width at the origin is 0.64 times the camera's distance.
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const drawn = () => [...field.root.querySelectorAll('path')].map(path => path.getAttribute('d')!).join('').match(/M/g)?.length ?? 0;
  const settle = async (z: number) => { field.publish(at(z)); field.publish(at(z * 1.0001)); await new Promise(resolve => setTimeout(resolve, 200)); return drawn(); };
  field.publish(at(5)); await new Promise(resolve => setTimeout(resolve, 0));
  const far = await settle(5), inside = await settle(0.05);
  assert.ok(far > 200, 'the bank\'s budget before the level appears');
  assert.ok(far < 300);
  assert.ok(inside > 650, 'the level\'s once it is whole');
  assert.ok(inside < 850);
  field.destroy();
  assert.throws(() => parseCataloguePoints({ ...budgeted, appearance: { ...budgeted.appearance, screenBudget: undefined } }), /test-stars: a level's screenBudget moves the bank's, so the bank needs a screenBudget too\./);
  assert.throws(() => parseCataloguePoints({ ...budgeted, appearance: { ...budgeted.appearance, levels: [{ ...levels[0], screenBudget: 10 }, levels[1]] } }), /test-stars: level 0 screenBudget must be a positive whole number on an inner level, got 10\./);
});

test('an arriving level spends what the budget leaves, never thinning the levels already on screen', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  // 200 outer dots and 1,000 inner ones, all on screen; a budget of 500 keeps every outer dot and 300 inner ones.
  const points = Array.from({ length: 1200 }, (_, i) => [((i * 37) % 200 - 100) / 100, ((i * 91) % 160 - 80) / 100, -10]);
  const levels = [{ points: 200, fullDetailUnits: 100 }, { points: 1000, appearUnits: [0.64, 0.064] }];
  const budgeted = { ...bank, points, ...baked(points, levels.map(level => level.points)), appearance: { ...bank.appearance, opacity: 1, screenBudget: 500, levels } };
  const field = mountCataloguePoints({ host, url: '/dots.json', loadBank: async () => budgeted });
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const drawn = (part: Element) => [...part.querySelectorAll('path')].map(path => path.getAttribute('d')!).join('').match(/M/g)?.length ?? 0;
  field.publish(at(0.05)); await new Promise(resolve => setTimeout(resolve, 0));
  field.publish(at(0.05)); field.publish(at(0.050005)); await new Promise(resolve => setTimeout(resolve, 200));
  const [outer, inner] = [...field.root.querySelectorAll('svg > g')];
  assert.equal(drawn(outer!), 200, 'every outer dot');
  assert.ok(drawn(inner!) > 240);
  assert.ok(drawn(inner!) < 360);
  field.destroy();
});

test('a bank with fadeOutUnits fades out as the view narrows at its origin, and draws nothing below it', async () => {
  const { document } = parseHTML('<div id="host"></div>');
  const host = document.getElementById('host')! as unknown as HTMLElement;
  const faded = { ...bank, appearance: { ...bank.appearance, fadeOutUnits: [9, 3] } };
  const points = mountCataloguePoints({ host, url: 'test.json', loadBank: async () => faded });
  // A 600 x 800 view with a 500-pixel focal length: the half-width at the origin is the camera's distance from it.
  const at = (distance: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, distance] as const, orientationXyzw: [0, 0, 0, 1] as const } },
    viewport: { focalPixels: 500, principalOffsetPixels: [0, 0] as const, widthPixels: 600, heightPixels: 800 } });
  points.publish(at(20));
  await new Promise(resolve => setTimeout(resolve, 0));
  points.publish(at(20));
  assert.equal(points.root.style.opacity, '1', 'wider than the window, whole');
  points.publish(at(Math.sqrt(27)));
  assert.ok(Math.abs(Number(points.root.style.opacity) - 0.5) < 1e-9, `halfway through the window in the logarithm, got ${points.root.style.opacity}`);
  points.publish(at(2));
  assert.equal(points.root.style.display, 'none', 'narrower than the window, not drawn');
  assert.throws(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, fadeOutUnits: [3, 9] } }), /test-stars: fadeOutUnits/);
  points.destroy();
});
