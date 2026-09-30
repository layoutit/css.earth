import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { mountBatchedSpatialPoints, pointPaint } from './batched-spatial-points.js';

test('a spatial point field reprojects through one retained SVG path per paint colour', () => {
  const {document}=parseHTML('<div id="host"><b></b></div>'),host=document.getElementById('host')!,before=host.firstElementChild!;
  const frame={referenceFrame:'sun-icrf',epochJdTt:2451545,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,
    metersPerUnit:1,boundsUnits:{min:[-20,-20,-20] as const,max:[20,20,20] as const}};
  const style={colorCss:'#ffb38a',opacity:.85,radiusPx:1};
  expect(pointPaint(style)).toBe('#ffb38ad9');
  let clock=0;
  const field=mountBatchedSpatialPoints({host,before,frame,points:[{positionUnits:[1,0,-10] as const}],className:'test-points',
    stylePoint:()=>style,paintPalette:[pointPaint(style)],now:()=>clock});
  const viewport={focalPixels:100,principalOffsetPixels:[0,0] as const,widthPixels:1000,heightPixels:800};
  const world={referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[0,0,0] as const,orientationXyzw:[0,0,0,1] as const}};
  field.publish({world,viewport});
  const path=field.root.querySelector('path')!,first=path.getAttribute('d');
  expect(field.root.querySelectorAll('path')).toHaveLength(1);expect(path.getAttribute('stroke')).toBe('#ffb38ad9');
  expect(field.root.querySelector('i')).toBeNull();expect(field.stats().visiblePoints).toBe(1);expect(first).toMatch(/^M/);
  clock=100;
  field.publish({world:{...world,pose:{...world.pose,positionM:[1,0,0]}},viewport});
  expect(path.getAttribute('d')).not.toBe(first);expect(field.stats().visiblePoints).toBe(1);expect(host.children).toHaveLength(2);
  field.destroy();expect(host.children).toHaveLength(1);
});


test('changing the kept share repaints even when the camera has not moved', () => {
  const { document } = parseHTML('<div id="host"></div>');
  let keep = .25;
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!,
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } },
    points: Array.from({ length: 20 }, (_, x) => ({ positionUnits: [x / 100, 0, -10] as const })),
    className: 'test-points', stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'], keepFraction: () => keep });
  const publication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 } };
  field.publish(publication);
  expect(field.stats().visiblePoints).toBeLessThan(20);
  expect(field.stats().candidates).toBe(20);
  keep = 1;
  field.publish(publication);
  expect(field.stats().visiblePoints).toBe(20);
  field.destroy();
});

test('a camera turn warps the painted dots exactly where a repaint puts them, and a pause repaints', async () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-2e6, -2e6, -2e6] as const, max: [2e6, 2e6, 2e6] as const } };
  let seed = 7;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const points = Array.from({ length: 40 }, () => ({ positionUnits: [(random() - .5) * 8e5, (random() - .5) * 6e5, -1e6] as const }));
  const viewport = { focalPixels: 900, principalOffsetPixels: [12, -7] as const, widthPixels: 1000, heightPixels: 800 };
  const pose = (degrees: number) => { const half = degrees * Math.PI / 360;
    return { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [.3 * Math.sin(half), Math.sin(half), 0, Math.cos(half)].map((value, _, all) => value / Math.hypot(...all)) as unknown as readonly [number, number, number, number] } }; };
  const mount = () => { const { document } = parseHTML('<div id="host"></div>');
    return mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
      stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'] }); };
  const centres = (field: ReturnType<typeof mount>) => [...(field.root.querySelector('path')!.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g)]
    .map(match => [Number(match[1]) / 8 + 500, Number(match[2]) / 8 + 400]);
  const warped = mount(), exact = mount();
  warped.publish({ world: pose(0), viewport });
  const painted = centres(warped), before = warped.root.querySelector('path')!.getAttribute('d');
  warped.publish({ world: pose(2), viewport });
  // Only the warp was written: the paths keep the first paint.
  expect(warped.root.querySelector('path')!.getAttribute('d')).toBe(before);
  const numbers = (warped.root.querySelector('svg')!.style.transform.match(/-?[\d.e+-]+/g) ?? []).slice(1).map(Number);
  expect(numbers).toHaveLength(16);
  const [a, b, , c, d, e, , g, , , , , h, i, , j] = numbers;
  const moved = painted.map(([x, y]) => { const w = c! * x! + g! * y! + j!; return [(a! * x! + d! * y! + h!) / w, (b! * x! + e! * y! + i!) / w]; });
  exact.publish({ world: pose(2), viewport });
  const repainted = centres(exact);
  // The same dots, placed by the warp and by a repaint: every in-view dot of the repaint has its warped twin.
  // Each paint rounds its centres to an eighth of a pixel (up to 0.09 px off), and the warp carries the first paint's
  // rounding with it, so the warped and the repainted dot agree to within 0.2 px.
  for (const [x, y] of repainted) expect(Math.min(...moved.map(([mx, my]) => Math.hypot(mx! - x!, my! - y!)))).toBeLessThan(.2);
  // A pause brings back the exact paint.
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(warped.root.querySelector('svg')!.style.transform).toBe('');
  expect(warped.root.querySelector('path')!.getAttribute('d')).toBe(exact.root.querySelector('path')!.getAttribute('d'));
  // A turn past the painted margin repaints at once.
  warped.publish({ world: pose(40), viewport });
  expect(warped.root.querySelector('svg')!.style.transform).toBe('');
  warped.destroy(); exact.destroy();
});

test('dots a zoom adds arrive during the zoom, through the pacer; dots it takes away wait for the pause', async () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-2e6, -2e6, -2e6] as const, max: [2e6, 2e6, 2e6] as const } };
  const points = Array.from({ length: 40 }, (_, i) => ({ positionUnits: [((i * 37) % 80 - 40) * 1e4, ((i * 53) % 60 - 30) * 1e4, -1e6] as const }));
  const { document } = parseHTML('<div id="host"></div>');
  // Twenty dots from far, all forty once the camera comes a little closer.
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
    stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'], drawnCount: distance => distance > .5 ? 20 : 40 });
  const viewport = { focalPixels: 900, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const dots = () => field.root.querySelector('path')!.getAttribute('d')!.match(/M/g)?.length ?? 0;
  field.publish(at(1));
  expect(dots()).toBe(20);
  // A step in of a unit: no dot moves a visible amount, but twenty more are drawn now (here without a frame clock, at once).
  field.publish(at(0));
  expect(dots(), 'the added dots arrive mid-zoom').toBe(40);
  // A step back: twenty should go, but they stay until the pause.
  field.publish(at(1));
  expect(dots(), 'removals wait').toBe(40);
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(dots(), 'the pause brings the exact paint').toBe(20);
  field.destroy();
});

test('prepared cells skip out-of-view boxes without changing a single drawn dot or the paint decisions', async () => {
  const { catalogueCells } = await import('@cssearth/objects');
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-200, -200, -200] as const, max: [200, 200, 200] as const } };
  let seed = 11;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  // Clumps and a thin shell, so cells are uneven and many lie beside, behind and around the camera.
  const rows = Array.from({ length: 3000 }, (_, index) => {
    if (index % 3 === 0) { const u = random() * 2 - 1, a = random() * 2 * Math.PI, r = 150 + random() * 5, s = Math.sqrt(1 - u * u);
      return [r * s * Math.cos(a), r * s * Math.sin(a), r * u, index % 2]; }
    const clump = [[40, 0, -60], [-90, 30, 20], [5, -5, 5]][index % 3]!;
    return [clump[0]! + (random() - .5) * 30, clump[1]! + (random() - .5) * 30, clump[2]! + (random() - .5) * 30, index % 2];
  });
  const cells = catalogueCells(rows, undefined, 32);
  const points = rows.map(row => ({ positionUnits: [row[0], row[1], row[2]] as unknown as readonly [number, number, number], colour: row[3] }));
  const styles = [{ colorCss: '#ffffff', opacity: .5, radiusPx: 1 }, { colorCss: '#ff8800', opacity: 1, radiusPx: 2.5 }];
  // A clock 100 ms on every trial: every publication may repaint, so both fields decide by their paint alone.
  let keep = 1, drawn = rows.length, clock = 0;
  const mount = (withCells: boolean) => { const { document } = parseHTML('<div id="host"></div>');
    return mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
      ...(withCells ? { cells: { boxes: Float64Array.from(cells.boxes.flat()), of: Int32Array.from(cells.of) } } : {}),
      stylePoint: point => styles[point.colour]!, paintPalette: styles.map(pointPaint), drawnCount: () => drawn, keepFraction: () => keep, now: () => clock }); };
  const dots = (field: ReturnType<typeof mount>) => [...field.root.querySelectorAll('path')]
    .map(path => [...(path.getAttribute('d') ?? '').matchAll(/M-?\d+ -?\d+h0/g)].map(match => match[0]).sort().join(''));
  const plain = mount(false), celled = mount(true);
  let last: { focalPixels: number; principalOffsetPixels: readonly [number, number]; widthPixels: number; heightPixels: number } =
    { focalPixels: 800, principalOffsetPixels: [0, 0], widthPixels: 1000, heightPixels: 800 };
  let checked = 0, skippedSome = false, skippedCells = 0;
  let orientation = [0, 0, 0, 1] as readonly number[], position = [0, 0, 0] as readonly number[];
  for (let trial = 0; trial < 300; trial++) {
    if (trial % 3 === 2) {
      // A small move of the last camera: whether each field keeps its paint rides on its nearest point, which must agree.
      position = position.map(value => value + (random() - .5) * 1e-3);
    } else {
      const axis = [random() - .5, random() - .5, random() - .5], length = Math.hypot(...axis), angle = random() * Math.PI;
      orientation = [...axis.map(value => value / length * Math.sin(angle / 2)), Math.cos(angle / 2)];
      position = [0, 1, 2].map(() => (random() - .5) * (trial % 2 ? 60 : 400));
    }
    const viewport = trial % 3 === 2 ? last : { focalPixels: 200 + random() * 1500, principalOffsetPixels: [(random() - .5) * 80, (random() - .5) * 80] as const, widthPixels: 640 + Math.round(random() * 800), heightPixels: 480 + Math.round(random() * 400) };
    last = viewport;
    if (trial % 3 !== 2) { keep = trial % 5 === 0 ? .4 : 1; drawn = trial % 7 === 0 ? Math.round(random() * rows.length) : rows.length; }
    const publication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: {
      positionM: position as unknown as readonly [number, number, number], orientationXyzw: orientation as unknown as readonly [number, number, number, number] } }, viewport };
    clock += 100; plain.publish(publication); celled.publish(publication);
    expect(dots(celled), `trial ${trial}`).toEqual(dots(plain));
    expect(celled.stats().visiblePoints).toBe(plain.stats().visiblePoints);
    expect(celled.stats().candidates).toBe(plain.stats().candidates);
    if (plain.stats().visiblePoints < rows.length / 2) skippedSome = true;
    skippedCells += celled.stats().skippedCells;
    expect(plain.stats().skippedCells).toBe(0);
    checked++;
  }
  expect(checked).toBe(300);
  expect(skippedSome, 'some views leave most points out').toBe(true);
  expect(skippedCells / 300, 'the cells skip most of what a view leaves out').toBeGreaterThan(cells.boxes.length / 4);
  plain.destroy(); celled.destroy();
});

test('a travelling camera repaints at most every 25 ms, warps the frames between and settles to the exact paint', async () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20] as const, max: [20, 20, 20] as const } };
  const points = Array.from({ length: 30 }, (_, index) => ({ positionUnits: [(index % 6) - 2.5, Math.floor(index / 6) - 2, -10] as const }));
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  let clock = 0, settled = 0;
  const mount = () => { const { document } = parseHTML('<div id="host"></div>');
    return mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
      stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'], now: () => clock, onSettle: () => settled++ }); };
  const exact0 = () => { const fresh = mount(); fresh.publish(at(-3)); const d = fresh.root.querySelector('path')!.getAttribute('d'); fresh.destroy(); return d; };
  const field = mount(), path = field.root.querySelector('path')!, svg = field.root.querySelector('svg')!;
  field.publish(at(0));
  const first = path.getAttribute('d');
  clock = 16; field.publish(at(-1));
  expect(path.getAttribute('d'), 'a frame 16 ms after a repaint keeps it').toBe(first);
  expect(svg.style.transform, 'and warps it').toMatch(/^matrix3d/);
  clock = 33; field.publish(at(-2));
  expect(path.getAttribute('d'), 'a frame 33 ms after it repaints').not.toBe(first);
  expect(svg.style.transform).toBe('');
  clock = 49; field.publish(at(-3));
  expect(path.getAttribute('d'), 'another paced frame').not.toBe(exact0());
  // The camera stops: a publication that barely moves may not keep a paint left behind by a paced frame.
  clock = 60; field.publish(at(-3));
  expect(path.getAttribute('d'), 'a stop right after a paced frame repaints exactly').toBe(exact0());
  clock = 80; field.publish(at(-4));
  await new Promise(resolve => setTimeout(resolve, 200));
  const exact = mount(); exact.publish(at(-4));
  expect(path.getAttribute('d'), 'a pause repaints exactly').toBe(exact.root.querySelector('path')!.getAttribute('d'));
  expect(settled, 'and tells its owner once, so a screen budget settles on the stopped view').toBe(1);
  // A travelling camera that also turns repaints on every frame: a turn's projective warp would stretch the painted dots.
  const turning = (z: number, degrees: number) => { const half = degrees * Math.PI / 360;
    return { ...at(z), world: { ...at(z).world, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] as const } } }; };
  clock = 1000; field.publish(turning(-4, 0));
  const before = path.getAttribute('d');
  clock = 1010; field.publish(turning(-5, 6));
  expect(path.getAttribute('d'), 'a turn while travelling repaints within 25 ms').not.toBe(before);
  expect(svg.style.transform).toBe('');
  expect(svg.style.transform).toBe('');
  field.destroy(); exact.destroy();
});

test('a turn warps the paint only while no dot grows or shrinks by more than a tenth; a larger turn repaints', () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-2e6, -2e6, -2e6] as const, max: [2e6, 2e6, 2e6] as const } };
  const points = Array.from({ length: 40 }, (_, index) => ({ positionUnits: [((index % 8) - 3.5) * 1e5, (Math.floor(index / 8) - 2) * 1e5, -1e6] as const }));
  const viewport = { focalPixels: 500, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const turned = (degrees: number) => { const half = degrees * Math.PI / 360;
    return { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] as const } }, viewport }; };
  const { document } = parseHTML('<div id="host"></div>');
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
    stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'], now: () => 0 });
  const path = field.root.querySelector('path')!, svg = field.root.querySelector('svg')!;
  field.publish(turned(0));
  const first = path.getAttribute('d');
  field.publish(turned(2));
  expect(path.getAttribute('d'), 'a small turn keeps the paint').toBe(first);
  expect(svg.style.transform).toMatch(/^matrix3d/);
  field.publish(turned(12));
  expect(path.getAttribute('d'), 'a turn that would stretch the edge dots past a tenth repaints').not.toBe(first);
  expect(svg.style.transform).toBe('');
  field.destroy();
});
