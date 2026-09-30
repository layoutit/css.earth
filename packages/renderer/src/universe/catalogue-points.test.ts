import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { mountCataloguePoints, parseCataloguePoints } from './catalogue-points.js';
import { cataloguePointSpread } from '@cssearth/objects';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } };
const bank = { schema: 'cssearth-catalogue-points@1', id: 'test-stars', frame,
  appearance: { colorCss: '#ffe2a8', radiusPx: .75, opacity: .7 }, points: [[1, 0, -10], [-1, 0, -10]],
  spread: cataloguePointSpread([[1, 0, -10], [-1, 0, -10]]) };

test('the prepared catalogues the app draws are valid banks of every selected row with a distance', () => {
  // The published banks: what each recipe marks `published: true` and the app fetches. Their inputs (a survey's stars,
  // one catalogue's masers) are bake inputs in output/catalogue-points/, so they are not read here.
  for (const [object, id] of [['milky-way', 'globular-clusters'], ['milky-way', 'dots'], ['nearby-universe', 'dots'], ['nearby-universe', 'bright-galaxy-dots'],
    ['nearby-universe', 'quasar-dots'], ['m31', 'stars'], ['m31', 'dots'], ['m33', 'stars'], ['m33', 'dots'], ['m81', 'dots'], ['ngc-253', 'dots']]) {
    const prepared = JSON.parse(readFileSync(new URL(`../../../../src/objects/${object}/prepared/${id}.json`, import.meta.url), 'utf8'));
    const parsed = parseCataloguePoints(prepared);
    expect(parsed.id).toBe(id);
    expect(parsed.points).toHaveLength(prepared.counts.points);
    expect(parsed.spread, `${object}/${id}: the bake's spread is the one its points trace`).toEqual(cataloguePointSpread(prepared.points));
    // A merged or stacked bank (packages/bake/cli/merge-catalogue-points.mts, stack.mts) counts only its points; a prepared one also its rows.
    if (prepared.source !== 'merge' && prepared.source !== 'stack') expect(prepared.counts.points + prepared.counts.missingDistance).toBe(prepared.counts.selected);
  }
});

test('a stacked bank adds its inner levels\' dots as the view narrows, only once the outer level is whole', async () => {
  const { stackedPointCount } = await import('./catalogue-points.js');
  const levels = [{ points: 1000, fullDetailUnits: 10 }, { points: 400, appearUnits: [3, 1] as const }, { points: 200, appearUnits: [1, 0.1] as const }];
  const count = (distance: number, halfWidth = distance) => stackedPointCount(levels, distance, halfWidth, 1);
  expect(count(20)).toBe(500);
  expect(count(10), 'the outer level is whole within its full-detail distance').toBe(1000);
  expect(count(3)).toBe(1000);
  expect(count(Math.sqrt(3)), 'halfway through its window in the logarithm').toBe(1200);
  expect(count(1)).toBe(1400);
  expect(count(0.05)).toBe(1600);
  let previous = 0;
  for (let distance = 40; distance > 0.01; distance *= 0.97) {
    const next = count(distance);
    expect(next).toBeGreaterThanOrEqual(previous);
    previous = next;
  }
  expect(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, levels: [{ points: 1, fullDetailUnits: 1 }, { points: 1, appearUnits: [2, 1] }] } }))
    .toThrow(/test-stars: level 1 appears over a shrinking window/);
});

test('seen from outside, a bank draws only as many dots as its projected shape holds', async () => {
  const { screenPointCount } = await import('./catalogue-points.js');
  // A flat disc of radius 10 in the x-y plane.
  const disc = Array.from({ length: 2000 }, (_, i) => [10 * Math.sqrt((i + .5) / 2000) * Math.cos(i * 2.4), 10 * Math.sqrt((i + .5) / 2000) * Math.sin(i * 2.4), 0]);
  const spread = cataloguePointSpread(disc);
  expect(Math.abs(spread.normal[2])).toBeCloseTo(1, 6);
  expect(spread.across).toBeGreaterThan(9); expect(spread.along).toBeCloseTo(0, 6);
  expect(screenPointCount(spread, [0, 0, 5], 1000), 'within its reach there is no limit').toBe(Infinity);
  const faceOn = screenPointCount(spread, [0, 0, 1000], 1000), tilted = screenPointCount(spread, [0, 800, 600], 1000), far = screenPointCount(spread, [0, 0, 4000], 1000);
  expect(faceOn).toBe(Math.floor(Math.PI * (1000 * spread.across / 1000) ** 2 / 64));
  expect(tilted).toBeLessThan(faceOn);
  expect(far, 'four times farther holds a sixteenth').toBe(Math.floor(Math.PI * (1000 * spread.across / 4000) ** 2 / 64));
});

test('a palette bank colours each point by its index and refuses an index outside the palette', () => {
  const coloured = { ...bank, appearance: { ...bank.appearance, palette: ['#8ec9ff', '#ffc070'] }, points: [[1, 0, -10, 0], [-1, 0, -10, 1]] };
  expect(parseCataloguePoints(coloured).points.map(point => point.colorCss)).toEqual(['#8ec9ff', '#ffc070']);
  expect(() => parseCataloguePoints({ ...coloured, points: [[1, 0, -10, 2]] })).toThrow(/test-stars: point 0 names palette colour 2/);
});

test('catalogue point banks refuse malformed points and appearances, naming the bank', () => {
  expect(() => parseCataloguePoints({ ...bank, points: [[1, 0]] })).toThrow(/test-stars: point 0/);
  expect(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, colorCss: 'gold' } })).toThrow(/test-stars: catalogue point appearance/);
  expect(() => parseCataloguePoints({ ...bank, points: [] })).toThrow(/test-stars: a catalogue point bank holds/);
  const { spread: _spread, ...unspread } = bank;
  expect(() => parseCataloguePoints(unspread)).toThrow(/test-stars \(catalogue points\): catalogue point bank field spread must be .* got undefined/);
  expect(() => parseCataloguePoints({ ...bank, spread: { normal: [1, 1, 0], across: 1, along: 0 } })).toThrow(/test-stars \(catalogue points\): catalogue point bank field spread/);
  expect(() => parseCataloguePoints({ ...bank, spread: { ...bank.spread, across: -1 } })).toThrow(/test-stars \(catalogue points\): catalogue point bank field spread/);
});

test('a catalogue loads on its first publication and draws every point as the same small dot', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  let fetched = 0;
  const points = mountCataloguePoints({ host, url: '/cepheids.json', fetchJson: async () => { fetched++; return {...bank, appearance: {...bank.appearance, opacity: 1}}; } });
  expect(fetched).toBe(0);
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  points.publish({ world, viewport });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetched).toBe(1);
  expect(points.root.dataset.cataloguePoints).toBe('test-stars');
  const paths = [...points.root.querySelectorAll('path')];
  expect(paths).toHaveLength(1);
  expect(paths[0]!.getAttribute('fill')).toBe('#ffe2a8ff');
  expect(paths[0]!.getAttribute('d')!.match(/M/g)).toHaveLength(2);
  expect(paths[0]!.getAttribute('d')).toContain('a0.750 0.750');
  const retainedPath = paths[0];
  points.publish({ world: {...world, pose: {...world.pose, positionM: [1,0,0]}}, viewport });
  expect(points.root.querySelector('path')).toBe(retainedPath);
  expect(points.root.querySelectorAll('i')).toHaveLength(0);
  points.publish({ world, viewport }); expect(fetched).toBe(1);
  points.destroy(); expect(host.children).toHaveLength(0);
});

test('a level with a near opacity draws as its own part and dims to it as the innermost level fills the view', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const points = [[0, 0, -10], [0, 1, -10], [1, 0, -10]];
  const stacked = { ...bank, points, spread: cataloguePointSpread(points), appearance: { ...bank.appearance, opacity: 1, levels: [
    { points: 1, fullDetailUnits: 100, nearOpacity: .5 }, { points: 1, appearUnits: [10, 1] }, { points: 1, appearUnits: [1, .01] }] } };
  const field = mountCataloguePoints({ host, url: '/dots.json', fetchJson: async () => stacked });
  // The view's half-width at the origin is the camera's distance times hypot(1000, 800) / 2 / 100.
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (distance: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, distance] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  field.publish(at(1)); await new Promise(resolve => setTimeout(resolve, 0)); field.publish(at(1));
  const parts = [...field.root.children] as HTMLElement[];
  expect(parts, 'one part per level').toHaveLength(3);
  expect(parts[0]!.style.opacity, 'before the innermost level appears').toBe('1');
  const halfWidthPerDistance = Math.hypot(1000, 800) / 200;
  field.publish(at(Math.sqrt(.01) / halfWidthPerDistance));
  expect(Number(parts[0]!.style.opacity), 'halfway through its window in the logarithm').toBeCloseTo(.75, 12);
  field.publish(at(.001));
  expect(parts.map(part => part.style.opacity)).toEqual(['0.5', '1', '1']);
  field.destroy();
  for (const nearOpacity of [0, 1.5]) {
    expect(() => parseCataloguePoints({ ...stacked, appearance: { ...stacked.appearance, levels: [{ ...stacked.appearance.levels[0], nearOpacity }, ...stacked.appearance.levels.slice(1)] } }))
      .toThrow(`test-stars: level 0 nearOpacity must be in (0, 1], got ${nearOpacity}.`);
  }
});

test('a screen budget draws an even, stable share of the visible dots and refuses a bad budget', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  // 1,000 dots spread in front of the camera, all on screen; the budget keeps about 250 of them.
  const points = Array.from({ length: 1000 }, (_, i) => [((i * 37) % 200 - 100) / 100, ((i * 91) % 160 - 80) / 100, -10]);
  const budgeted = { ...bank, points, spread: cataloguePointSpread(points), appearance: { ...bank.appearance, opacity: 1, screenBudget: 250 } };
  const field = mountCataloguePoints({ host, url: '/dots.json', fetchJson: async () => budgeted });
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (x: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [x, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const drawn = () => [...field.root.querySelectorAll('path')].map(path => path.getAttribute('d')!).join('').match(/M/g)?.length ?? 0;
  field.publish(at(0)); await new Promise(resolve => setTimeout(resolve, 0));
  field.publish(at(0.001)); field.publish(at(0.002));
  // The share is detail: while the camera moves the paint is warped, and the pause repaints with the share.
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(drawn(), 'the first frame counts, the pause keeps a quarter').toBeGreaterThan(200);
  expect(drawn()).toBeLessThan(300);
  const kept = drawn();
  field.publish(at(0.003));
  expect(drawn(), 'the same dots stay as the camera moves').toBe(kept);
  field.destroy();
  for (const screenBudget of [0, 1.5, -3]) {
    expect(() => parseCataloguePoints({ ...budgeted, appearance: { ...budgeted.appearance, screenBudget } }))
      .toThrow(`test-stars: catalogue point screenBudget must be a positive whole number, got ${screenBudget}.`);
  }
});

test('zooming out draws a shrinking prefix of the catalogue', async () => {
  const { drawnPointCount } = await import('./catalogue-points.js');
  const kpc = 3.0856775814913673e19;
  expect(drawnPointCount(4004, 8 * kpc)).toBe(4004);
  expect(drawnPointCount(4004, 20 * kpc)).toBe(2002);
  expect(drawnPointCount(4004, 200 * kpc)).toBe(300);
  expect(drawnPointCount(165, 1000 * kpc), 'a sparse catalogue keeps every point').toBe(165);
});

test('a translucent catalogue draws its dots as paths with their alpha', async () => {
  const {document} = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const points = mountCataloguePoints({host, url:'/translucent.json', fetchJson:async()=>bank});
  points.publish({world:{referenceFrame:'sun-icrf',epochJdTt:2451545,
    pose:{positionM:[0,0,0],orientationXyzw:[0,0,0,1]}},
    viewport:{focalPixels:100,principalOffsetPixels:[0,0],widthPixels:1000,heightPixels:800}});
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(points.root.querySelector('i')).toBeNull();
  expect([...points.root.querySelectorAll('path')].some(path=>path.getAttribute('fill')==='#ffe2a8b3'&&path.getAttribute('d'))).toBe(true);
  points.destroy();
});

test('dot layers switching on show one a frame, so their first paints never share a frame', async () => {
  const { document, window } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const frames: FrameRequestCallback[] = [];
  Object.assign(window, { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback), cancelAnimationFrame() {}, performance: { now: () => 0 } });
  const points = [[0, 0, -10], [0, 1, -10], [1, 0, -10]];
  const stacked = { ...bank, points, spread: cataloguePointSpread(points), appearance: { ...bank.appearance, opacity: 1, levels: [
    { points: 1, fullDetailUnits: 100, nearOpacity: .5 }, { points: 1, appearUnits: [10, 1] }, { points: 1, appearUnits: [1, .01] }] } };
  const field = mountCataloguePoints({ host, url: '/dots.json', fetchJson: async () => stacked });
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  field.publish({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 1] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  await new Promise(resolve => setTimeout(resolve, 0));
  const layers = [...field.root.children] as HTMLElement[];
  expect(layers).toHaveLength(3);
  const hidden = () => layers.filter(layer => layer.style.visibility === 'hidden').length;
  expect(hidden()).toBe(3);
  frames.shift()!(0);
  expect(hidden()).toBe(2);
  frames.shift()!(16);
  expect(hidden()).toBe(1);
  frames.shift()!(32);
  expect(hidden()).toBe(0);
  field.destroy();
});

test('an inner level with its own screen budget moves the bank\'s to it as the level appears', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  // 1,000 dots in the outer level and one in the inner level, all on screen; 250 at most from far, 750 once inside.
  const points = Array.from({ length: 1001 }, (_, i) => [((i * 37) % 200 - 100) / 100, ((i * 91) % 160 - 80) / 100, -10]);
  const levels = [{ points: 1000, fullDetailUnits: 100 }, { points: 1, appearUnits: [0.64, 0.064], screenBudget: 750 }];
  const budgeted = { ...bank, points, spread: cataloguePointSpread(points), appearance: { ...bank.appearance, opacity: 1, screenBudget: 250, levels } };
  const field = mountCataloguePoints({ host, url: '/dots.json', fetchJson: async () => budgeted });
  // The view's half-width at the origin is 0.64 times the camera's distance.
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const drawn = () => [...field.root.querySelectorAll('path')].map(path => path.getAttribute('d')!).join('').match(/M/g)?.length ?? 0;
  const settle = async (z: number) => { field.publish(at(z)); field.publish(at(z * 1.0001)); await new Promise(resolve => setTimeout(resolve, 200)); return drawn(); };
  field.publish(at(5)); await new Promise(resolve => setTimeout(resolve, 0));
  const far = await settle(5), inside = await settle(0.05);
  expect(far, 'the bank\'s budget before the level appears').toBeGreaterThan(200);
  expect(far).toBeLessThan(300);
  expect(inside, 'the level\'s once it is whole').toBeGreaterThan(650);
  expect(inside).toBeLessThan(850);
  field.destroy();
  expect(() => parseCataloguePoints({ ...budgeted, appearance: { ...budgeted.appearance, screenBudget: undefined } }))
    .toThrow('test-stars: a level\'s screenBudget moves the bank\'s, so the bank needs a screenBudget too.');
  expect(() => parseCataloguePoints({ ...budgeted, appearance: { ...budgeted.appearance, levels: [{ ...levels[0], screenBudget: 10 }, levels[1]] } }))
    .toThrow('test-stars: level 0 screenBudget must be a positive whole number on an inner level, got 10.');
});

test('an arriving level spends what the budget leaves, never thinning the levels already on screen', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  // 200 outer dots and 1,000 inner ones, all on screen; a budget of 500 keeps every outer dot and 300 inner ones.
  const points = Array.from({ length: 1200 }, (_, i) => [((i * 37) % 200 - 100) / 100, ((i * 91) % 160 - 80) / 100, -10]);
  const levels = [{ points: 200, fullDetailUnits: 100 }, { points: 1000, appearUnits: [0.64, 0.064] }];
  const budgeted = { ...bank, points, spread: cataloguePointSpread(points), appearance: { ...bank.appearance, opacity: 1, screenBudget: 500, levels } };
  const field = mountCataloguePoints({ host, url: '/dots.json', fetchJson: async () => budgeted });
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const drawn = (part: Element) => [...part.querySelectorAll('path')].map(path => path.getAttribute('d')!).join('').match(/M/g)?.length ?? 0;
  field.publish(at(0.05)); await new Promise(resolve => setTimeout(resolve, 0));
  field.publish(at(0.05)); field.publish(at(0.050005)); await new Promise(resolve => setTimeout(resolve, 200));
  const [outer, inner] = [...field.root.children];
  expect(drawn(outer!), 'every outer dot').toBe(200);
  expect(drawn(inner!)).toBeGreaterThan(240);
  expect(drawn(inner!)).toBeLessThan(360);
  field.destroy();
});
