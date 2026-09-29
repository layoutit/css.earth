import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { mountCataloguePoints, parseCataloguePoints } from './catalogue-points.js';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } };
const bank = { schema: 'cssearth-catalogue-points@1', id: 'test-stars', frame,
  appearance: { colorCss: '#ffe2a8', radiusPx: .75, opacity: .7 }, points: [[1, 0, -10], [-1, 0, -10]] };

test('the prepared catalogues the app draws are valid banks of every selected row with a distance', () => {
  for (const [object, id] of [['milky-way', 'cepheids'], ['milky-way', 'globular-clusters'], ['milky-way', 'hou-han-gmc'], ['milky-way', 'hou-han-hii'],
    ['milky-way', 'hou-han-masers'], ['milky-way', 'masers'], ['milky-way', 'open-clusters'], ['milky-way', 'dots'], ['nearby-universe', 'dots'], ['m31', 'dots']]) {
    const prepared = JSON.parse(readFileSync(new URL(`../../../../src/objects/${object}/prepared/${id}.json`, import.meta.url), 'utf8'));
    const parsed = parseCataloguePoints(prepared);
    expect(parsed.id).toBe(id);
    expect(parsed.points).toHaveLength(prepared.counts.points);
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

test('a palette bank colours each point by its index and refuses an index outside the palette', () => {
  const coloured = { ...bank, appearance: { ...bank.appearance, palette: ['#8ec9ff', '#ffc070'] }, points: [[1, 0, -10, 0], [-1, 0, -10, 1]] };
  expect(parseCataloguePoints(coloured).points.map(point => point.colorCss)).toEqual(['#8ec9ff', '#ffc070']);
  expect(() => parseCataloguePoints({ ...coloured, points: [[1, 0, -10, 2]] })).toThrow(/test-stars: point 0 names palette colour 2/);
});

test('catalogue point banks refuse malformed points and appearances, naming the bank', () => {
  expect(() => parseCataloguePoints({ ...bank, points: [[1, 0]] })).toThrow(/test-stars: point 0/);
  expect(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, colorCss: 'gold' } })).toThrow(/test-stars: catalogue point appearance/);
  expect(() => parseCataloguePoints({ ...bank, points: [] })).toThrow(/test-stars: a catalogue point bank holds/);
});

test('a catalogue loads on its first publication and draws every point as the same small dot', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  let fetched = 0;
  const points = mountCataloguePoints({ host, url: '/cepheids.json', fetchJson: async () => { fetched++; return bank; } });
  expect(fetched).toBe(0);
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  points.publish({ world, viewport });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetched).toBe(1);
  expect(points.root.dataset.cataloguePoints).toBe('test-stars');
  const shadows = [...points.root.querySelectorAll('i')].map(node => node.style.boxShadow).filter(shadow => shadow && shadow !== 'none');
  expect(shadows).toHaveLength(2);
  for (const shadow of shadows) expect(shadow).toContain('0.250px #ffe2a8b3');
  points.publish({ world, viewport }); expect(fetched).toBe(1);
  points.destroy(); expect(host.children).toHaveLength(0);
});

test('zooming out draws a shrinking prefix of the catalogue', async () => {
  const { drawnPointCount } = await import('./catalogue-points.js');
  const kpc = 3.0856775814913673e19;
  expect(drawnPointCount(4004, 8 * kpc)).toBe(4004);
  expect(drawnPointCount(4004, 20 * kpc)).toBe(2002);
  expect(drawnPointCount(4004, 200 * kpc)).toBe(300);
  expect(drawnPointCount(165, 1000 * kpc), 'a sparse catalogue keeps every point').toBe(165);
});
