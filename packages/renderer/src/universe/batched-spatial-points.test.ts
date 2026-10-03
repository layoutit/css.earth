import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { mountBatchedSpatialPoints, pointPaint } from './batched-spatial-points.js';

test('a spatial point field reprojects through one retained SVG path per paint color', () => {
  const {document}=parseHTML('<div id="host"><b></b></div>'),host=document.getElementById('host')!,before=host.firstElementChild!;
  const frame={referenceFrame:'sun-icrf',epochJdTt:2451545,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,
    metersPerUnit:1,boundsUnits:{min:[-20,-20,-20] as const,max:[20,20,20] as const}};
  const style={colorCss:'#ffb38a',opacity:.85,radiusPx:1};
  assert.equal(pointPaint(style), '#ffb38ad9@1');
  const field=mountBatchedSpatialPoints({host,before,frame,points:[{positionUnits:[1,0,-10] as const}],className:'test-points',
    stylePoint:()=>style,paintPalette:[pointPaint(style)]});
  const viewport={focalPixels:100,principalOffsetPixels:[0,0] as const,widthPixels:1000,heightPixels:800};
  const world={referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[0,0,0] as const,orientationXyzw:[0,0,0,1] as const}};
  field.publish({world,viewport});
  const path=field.root.querySelector('path')!,first=path.getAttribute('d');
  assert.equal(field.root.querySelectorAll('path').length, 1);assert.equal(path.getAttribute('stroke'), '#ffb38ad9');
  assert.equal(field.root.querySelector('i'), null);assert.equal(field.stats().visiblePoints, 1);assert.match(first ?? '', /^M/);
  field.publish({world:{...world,pose:{...world.pose,positionM:[1,0,0]}},viewport});
  assert.notEqual(path.getAttribute('d'), first);assert.equal(field.stats().visiblePoints, 1);assert.equal(host.children.length, 2);
  field.destroy();assert.equal(host.children.length, 1);
});


test('changing the kept share repaints even when the camera has not moved', () => {
  const { document } = parseHTML('<div id="host"></div>');
  let keep = .25;
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!,
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } },
    points: Array.from({ length: 20 }, (_, x) => ({ positionUnits: [x / 100, 0, -10] as const })),
    className: 'test-points', stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'], keepFraction: () => keep });
  const publication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 } };
  field.publish(publication);
  assert.ok(field.stats().visiblePoints < 20);
  assert.equal(field.stats().candidates, 20);
  keep = 1;
  field.publish(publication);
  assert.equal(field.stats().visiblePoints, 20);
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
      stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'] }); };
  const centres = (field: ReturnType<typeof mount>) => [...(field.root.querySelector('path')!.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g)]
    .map(match => [Number(match[1]) / 8 + 500, Number(match[2]) / 8 + 400]);
  const warped = mount(), exact = mount();
  warped.publish({ world: pose(0), viewport });
  const painted = centres(warped), before = warped.root.querySelector('path')!.getAttribute('d');
  warped.publish({ world: pose(2), viewport });
  // Only the warp was written: the paths keep the first paint.
  assert.equal(warped.root.querySelector('path')!.getAttribute('d'), before);
  const numbers = (warped.svg.style.transform.match(/-?[\d.e+-]+/g) ?? []).slice(1).map(Number);
  assert.equal(numbers.length, 16);
  const [a, b, , c, d, e, , g, , , , , h, i, , j] = numbers;
  const moved = painted.map(([x, y]) => { const w = c! * x! + g! * y! + j!; return [(a! * x! + d! * y! + h!) / w, (b! * x! + e! * y! + i!) / w]; });
  exact.publish({ world: pose(2), viewport });
  const repainted = centres(exact);
  // The same dots, placed by the warp and by a repaint: every in-view dot of the repaint has its warped twin.
  // Each paint rounds its centres to an eighth of a pixel (up to 0.09 px off), and the warp carries the first paint's
  // rounding with it, so the warped and the repainted dot agree to within 0.2 px.
  for (const [x, y] of repainted) assert.ok(Math.min(...moved.map(([mx, my]) => Math.hypot(mx! - x!, my! - y!))) < .2);
  // A pause brings back the exact paint.
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(warped.svg.style.transform, '');
  assert.equal(warped.root.querySelector('path')!.getAttribute('d'), exact.root.querySelector('path')!.getAttribute('d'));
  // A turn past the painted margin repaints at once.
  warped.publish({ world: pose(40), viewport });
  assert.equal(warped.svg.style.transform, '');
  warped.destroy(); exact.destroy();
});

test('dots a zoom adds arrive during the zoom, through the pacer; dots it takes away wait for the pause', async () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-2e6, -2e6, -2e6] as const, max: [2e6, 2e6, 2e6] as const } };
  const points = Array.from({ length: 40 }, (_, i) => ({ positionUnits: [((i * 37) % 80 - 40) * 1e4, ((i * 53) % 60 - 30) * 1e4, -1e6] as const }));
  const { document } = parseHTML('<div id="host"></div>');
  // Twenty dots from far, all forty once the camera comes a little closer.
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
    stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'], drawnCount: distance => distance > .5 ? 20 : 40 });
  const viewport = { focalPixels: 900, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });
  const dots = () => field.root.querySelector('path')!.getAttribute('d')!.match(/M/g)?.length ?? 0;
  field.publish(at(1));
  assert.equal(dots(), 20);
  // A step in of a unit: no dot moves a visible amount, but twenty more are drawn now (here without a frame clock, at once).
  field.publish(at(0));
  assert.equal(dots(), 40, 'the added dots arrive mid-zoom');
  // A step back: twenty should go, but they stay until the pause.
  field.publish(at(1));
  assert.equal(dots(), 40, 'removals wait');
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(dots(), 20, 'the pause brings the exact paint');
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
  const points = rows.map(row => ({ positionUnits: [row[0], row[1], row[2]] as unknown as readonly [number, number, number], color: row[3] }));
  const styles = [{ colorCss: '#ffffff', opacity: .5, radiusPx: 1 }, { colorCss: '#ff8800', opacity: 1, radiusPx: 2.5 }];
  let keep = 1, drawn = rows.length;
  const mount = (withCells: boolean) => { const { document } = parseHTML('<div id="host"></div>');
    return mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
      ...(withCells ? { cells: { boxes: Float64Array.from(cells.boxes.flat()), of: Int32Array.from(cells.of) } } : {}),
      stylePoint: point => styles[point.color]!, paintPalette: styles.map(pointPaint), drawnCount: () => drawn, keepFraction: () => keep }); };
  const dots = (field: ReturnType<typeof mount>) => [...field.root.querySelectorAll('path')]
    .map(path => [...(path.getAttribute('d') ?? '').matchAll(/M-?\d+ -?\d+h\.1/g)].map(match => match[0]).sort().join(''));
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
    plain.publish(publication); celled.publish(publication);
    assert.deepEqual(dots(celled), dots(plain), `trial ${trial}`);
    assert.equal(celled.stats().visiblePoints, plain.stats().visiblePoints);
    assert.equal(celled.stats().candidates, plain.stats().candidates);
    if (plain.stats().visiblePoints < rows.length / 2) skippedSome = true;
    skippedCells += celled.stats().skippedCells;
    assert.equal(plain.stats().skippedCells, 0);
    checked++;
  }
  assert.equal(checked, 300);
  assert.equal(skippedSome, true, 'some views leave most points out');
  assert.ok((skippedCells / 300) > cells.boxes.length / 4, 'the cells skip most of what a view leaves out');
  plain.destroy(); celled.destroy();
});

test('a travelling camera repaints every frame; once paused, a turn warps and settles to the exact paint', async () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20] as const, max: [20, 20, 20] as const } };
  const points = Array.from({ length: 30 }, (_, index) => ({ positionUnits: [(index % 6) - 2.5, Math.floor(index / 6) - 2, -10] as const }));
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number, degrees = 0) => { const half = degrees * Math.PI / 360;
    return { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] as const } }, viewport }; };
  let settled = 0;
  const mount = () => { const { document } = parseHTML('<div id="host"></div>');
    return mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
      stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'], onSettle: () => settled++ }); };
  const exactAt = (z: number, degrees = 0) => { const fresh = mount(); fresh.publish(at(z, degrees)); const d = fresh.root.querySelector('path')!.getAttribute('d'); fresh.destroy(); return d; };
  const field = mount(), path = field.root.querySelector('path')!, svg = field.svg;
  field.publish(at(0));
  // Each frame of a zoom at the dots' own scale is the exact paint of its camera: none keeps the frame before.
  for (const z of [-1, -2, -3, -4]) {
    field.publish(at(z));
    assert.equal(path.getAttribute('d'), exactAt(z), `the frame at ${z} is painted from its own camera`);
    assert.equal(svg.style.transform, '');
  }
  // The pause paints the margin back. Every dot here is in the view, so the paint is the same and the owner is not told.
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(path.getAttribute('d'), exactAt(-4));
  assert.equal(settled, 0);
  // A turn alone moves the last paint as one warp, and the exact paint follows the pause.
  const before = path.getAttribute('d');
  field.publish(at(-4, 2));
  assert.equal(path.getAttribute('d'), before, 'a small turn keeps the paint');
  assert.match(svg.style.transform, /^matrix3d/, 'and warps it');
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(path.getAttribute('d'), exactAt(-4, 2), 'a pause repaints exactly');
  assert.equal(svg.style.transform, '');
  assert.equal(settled, 1, 'and tells its owner once, so a screen budget settles on the stopped view');
  // A travelling camera that also turns repaints: a turn's projective warp cannot follow dots that move with the travel.
  field.publish(at(-5, 8));
  assert.equal(path.getAttribute('d'), exactAt(-5, 8), 'a turn while travelling repaints');
  assert.equal(svg.style.transform, '');
  const exact = mount();
  field.destroy(); exact.destroy();
});

test('a travelling camera paints the view alone; the pause paints the margin back for a turn to warp', async () => {
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20] as const, max: [20, 20, 20] as const } };
  // Five dots in the view and one in the margin past each side: about 550 px from the centre of a view 500 px to its edge.
  const points = [-15, -4, -2, 0, 2, 4, 15].map(x => ({ positionUnits: [x, 0, -10] as const }));
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number, degrees = 0) => { const half = degrees * Math.PI / 360;
    return { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] as const } }, viewport }; };
  let settled = 0;
  const mount = () => { const { document } = parseHTML('<div id="host"></div>');
    return mountBatchedSpatialPoints({ host: document.getElementById('host')!, frame, points, className: 'test-points',
      stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'], onSettle: () => settled++ }); };
  const exactAt = (z: number, degrees = 0) => { const fresh = mount(); fresh.publish(at(z, degrees)); const d = fresh.root.querySelector('path')!.getAttribute('d'); fresh.destroy(); return d; };
  const dots = (field: ReturnType<typeof mount>) => field.root.querySelector('path')!.getAttribute('d')!.match(/M/g)?.length ?? 0;
  const field = mount(), path = field.root.querySelector('path')!, svg = field.svg;
  field.publish(at(0));
  assert.equal(dots(field), 7, 'a first paint has its margin');
  for (const z of [.5, 1]) {
    field.publish(at(z));
    assert.equal(dots(field), 5, 'a travelling paint leaves the margin out');
    assert.equal(field.stats().visiblePoints, 5, 'and counts the same view');
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(path.getAttribute('d'), exactAt(1), 'the pause paints the margin back');
  assert.equal(settled, 0, 'the view did not change, so the owner is not told');
  const rested = path.getAttribute('d');
  field.publish(at(1, 2));
  assert.equal(path.getAttribute('d'), rested, 'a turn then keeps the paint');
  assert.match(svg.style.transform, /^matrix3d/, 'and warps the margin in');
  // A turn that comes before the pause finds no margin to warp in: it repaints at once, with one.
  const hurried = mount();
  hurried.publish(at(0)); hurried.publish(at(1));
  assert.equal(dots(hurried), 5);
  hurried.publish(at(1, 2));
  assert.equal(hurried.root.querySelector('path')!.getAttribute('d'), exactAt(1, 2));
  assert.equal(hurried.svg.style.transform, '');
  field.destroy(); hurried.destroy();
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
    stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'] });
  const path = field.root.querySelector('path')!, svg = field.svg;
  field.publish(turned(0));
  const first = path.getAttribute('d');
  field.publish(turned(2));
  assert.equal(path.getAttribute('d'), first, 'a small turn keeps the paint');
  assert.match(svg.style.transform, /^matrix3d/);
  field.publish(turned(12));
  assert.notEqual(path.getAttribute('d'), first, 'a turn that would stretch the edge dots past a tenth repaints');
  assert.equal(svg.style.transform, '');
  field.destroy();
});

test('a dot seen through an occluding disc is painted by a fainter path of its color, most at the disc\'s centre', () => {
  const { document } = parseHTML('<div id="host"></div>');
  // The camera at the origin looks down -z at a disc of radius 2 at z = -5. Sight lines to the four points cross its plane
  // at the centre, at 0.95 of the radius, outside the disc, and not at all (the last point is in front of it).
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!,
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } },
    points: [[0, 0, -10], [3.8, 0, -10], [10, 0, -10], [0, 0, -3]].map(positionUnits => ({ positionUnits: positionUnits as unknown as readonly [number, number, number] })),
    className: 'test-points', stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'],
    occluder: { centreUnits: [0, 0, -5], normal: [0, 0, 1], radiusUnits: 2 } });
  field.publish({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 4000, heightPixels: 800 } });
  const dots = Object.fromEntries([...field.root.querySelectorAll('path')].map(path => [path.getAttribute('stroke'), (path.getAttribute('d') ?? '').split('M').length - 1]));
  assert.deepEqual(dots, { '#ffffffff': 2, '#ffffff40': 1, '#ffffff66': 0, '#ffffff8c': 0, '#ffffffb3': 0, '#ffffffd9': 1 });
  assert.equal(field.stats().visiblePoints, 4);
  field.destroy();
});

test('fields mounted next to each other paint into one layer; another element between them starts a new one', () => {
  const { document } = parseHTML('<div id="host"><b></b></div>'), host = document.getElementById('host')!, end = host.firstElementChild!;
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20] as const, max: [20, 20, 20] as const } };
  const mount = (className: string) => mountBatchedSpatialPoints({ host, before: end, frame, points: [{ positionUnits: [0, 0, -10] as const }], className,
    stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff@1'] });
  const first = mount('first'), second = mount('second');
  assert.equal(first.svg, second.svg, 'one svg, so one compositing layer and one raster');
  assert.deepEqual([...first.svg.children].map(group => group.getAttribute('class')), ['first', 'second'], 'in mount order');
  assert.equal(host.children.length, 2, 'the layer and the marker');
  // Something else mounted before the marker sits above those dots; dots mounted after it must paint above it.
  host.insertBefore(document.createElement('i'), end);
  const third = mount('third');
  assert.notEqual(third.svg, first.svg);
  assert.deepEqual([...host.children].map(child => child.tagName), ['DIV', 'I', 'DIV', 'B']);
  first.destroy();
  assert.equal(host.children.length, 4, 'a layer stays while a field paints into it');
  second.destroy(); third.destroy();
  assert.deepEqual([...host.children].map(child => child.tagName), ['I', 'B'], 'and goes with its last field');
});

test('a layer\'s fields turn by one warp, and all repaint when one of them must', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const base = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, metersPerUnit: 1,
    boundsUnits: { min: [-2e6, -2e6, -2e6] as const, max: [2e6, 2e6, 2e6] as const } };
  // The far field's frame is turned a quarter about z: the warp is the camera's turn, whatever a field's own axes are.
  const farFrame = { ...base, localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2] as const }, nearFrame = { ...base, localToReferenceXyzw: [0, 0, 0, 1] as const };
  const grid = (step: number, depth: number) => Array.from({ length: 12 }, (_, index) => ({ positionUnits: [((index % 4) - 1.5) * step, (Math.floor(index / 4) - 1) * step, depth] as const }));
  const farPoints = grid(2e5, -1e6), nearPoints = grid(1, -10);
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const at = (z: number, degrees = 0) => { const half = degrees * Math.PI / 360;
    return { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, z] as const, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] as const } }, viewport }; };
  const settled = { far: 0, near: 0 };
  const mountIn = (into: HTMLElement, kind: 'far' | 'near') => mountBatchedSpatialPoints({ host: into, frame: kind === 'far' ? farFrame : nearFrame,
    points: kind === 'far' ? farPoints : nearPoints, className: kind, stylePoint: () => ({ colorCss: kind === 'far' ? '#ffffff' : '#ff0000', opacity: 1, radiusPx: 1 }),
    paintPalette: [kind === 'far' ? '#ffffffff@1' : '#ff0000ff@1'], onSettle: () => { if (into === host) settled[kind]++; } });
  const far = mountIn(host, 'far'), near = mountIn(host, 'near'), svg = far.svg;
  assert.equal(near.svg, svg);
  const d = (field: typeof far) => field.root.querySelector('path')!.getAttribute('d');
  // Each field alone in a layer of its own, painted once from a camera: the exact paint.
  const exact = (kind: 'far' | 'near', z: number, degrees = 0) => { const fresh = mountIn(parseHTML('<div id="host"></div>').document.getElementById('host')!, kind);
    fresh.publish(at(z, degrees)); const text = d(fresh); fresh.destroy(); return text; };
  const publish = (z: number, degrees = 0) => { far.publish(at(z, degrees)); near.publish(at(z, degrees)); };
  publish(0);
  const first = { far: d(far), near: d(near) };
  // A turn alone: one transform moves both paints.
  publish(0, 2);
  assert.match(svg.style.transform, /^matrix3d/);
  assert.deepEqual({ far: d(far), near: d(near) }, first, 'neither field repaints');
  // The pause repaints both exactly and tells both owners once, whichever field's timer comes first.
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(svg.style.transform, '');
  assert.deepEqual({ far: d(far), near: d(near) }, { far: exact('far', 0, 2), near: exact('near', 0, 2) });
  assert.deepEqual(settled, { far: 1, near: 1 });
  // Travel with a turn: the near field's dots move, so it repaints; the far field's would only turn, but the layer has
  // one transform, so it repaints from the same camera, on the frame's first publication or its own.
  far.publish(at(-1, 4));
  near.publish(at(-1, 4));
  assert.equal(svg.style.transform, '');
  assert.deepEqual({ far: d(far), near: d(near) }, { far: exact('far', -1, 4), near: exact('near', -1, 4) });
  near.publish(at(-2, 6));
  assert.equal(d(far), exact('far', -2, 6), 'the near field\'s repaint brings the far field along');
  far.publish(at(-2, 6));
  assert.equal(svg.style.transform, '');
  // Travel alone leaves the far field's paint as it is: no dot of it moves, and no warp is needed.
  const kept = d(far);
  publish(-3, 6);
  assert.equal(d(far), kept);
  assert.equal(d(near), exact('near', -3, 6));
  // A hidden field is not repainted for the others, and repaints on its next publication.
  far.hide();
  near.publish(at(-4, 9));
  assert.equal(d(far), kept, 'hidden, it keeps its old paint');
  far.publish(at(-4, 9));
  assert.equal(d(far), exact('far', -4, 9));
  assert.equal(svg.style.transform, '');
  far.destroy(); near.destroy();
});

test('a field left unresolved at mount resolves its points in slices and draws a part only once it is whole', () => {
  const { document } = parseHTML('<div id="host"></div>');
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20] as const, max: [20, 20, 20] as const } };
  const style = { colorCss: '#ffb38a', opacity: 1, radiusPx: 1 };
  const row = (count: number, y: number) => Array.from({ length: count }, (_, index) => ({ positionUnits: [index - count / 2, y, -100] as const }));
  const part = (points: ReturnType<typeof row>) => ({ points, stylePoint: () => style, paintPalette: [pointPaint(style)], paintGroup: 0 });
  const options = { host: document.getElementById('host')!, frame, className: 'test-points', parts: [part(row(10, 0)), part(row(6, 1))] };
  const field = mountBatchedSpatialPoints({ ...options, deferFill: true });
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
  const publication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport };
  const drawn = () => { field.publish(publication); return field.stats().visiblePoints; };
  assert.equal(drawn(), 0, 'nothing is resolved at mount');
  assert.equal(field.fill(7), 7);
  assert.equal(drawn(), 0, 'a part with points still to resolve draws none of them');
  assert.equal(field.fill(7), 7, 'the rest of the first part and the start of the second');
  assert.equal(drawn(), 10, 'the first part is whole');
  assert.equal(field.fill(7), 2);
  assert.equal(drawn(), 16);
  assert.equal(field.fill(7), 0, 'nothing left');
  // The same field resolved at mount paints the same paths.
  const whole = mountBatchedSpatialPoints({ ...options, host: parseHTML('<div id="host"></div>').document.getElementById('host')! });
  whole.publish(publication);
  assert.deepEqual([...field.root.querySelectorAll('path')].map(path => path.getAttribute('d')), [...whole.root.querySelectorAll('path')].map(path => path.getAttribute('d')));
  field.destroy(); whole.destroy();
});
