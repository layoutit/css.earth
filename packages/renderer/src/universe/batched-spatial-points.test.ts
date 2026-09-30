import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { mountBatchedSpatialPoints, pointPaint } from './batched-spatial-points.js';

test('a spatial point field reprojects through one retained SVG path per paint colour', () => {
  const {document}=parseHTML('<div id="host"><b></b></div>'),host=document.getElementById('host')!,before=host.firstElementChild!;
  const frame={referenceFrame:'sun-icrf',epochJdTt:2451545,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,
    metersPerUnit:1,boundsUnits:{min:[-20,-20,-20] as const,max:[20,20,20] as const}};
  const style={colorCss:'#ffb38a',opacity:.85,radiusPx:1};
  assert.equal(pointPaint(style), '#ffb38ad9');
  const field=mountBatchedSpatialPoints({host,before,frame,points:[{positionUnits:[1,0,-10] as const}],className:'test-points',
    stylePoint:()=>style,paintPalette:[pointPaint(style)]});
  const viewport={focalPixels:100,principalOffsetPixels:[0,0] as const,widthPixels:1000,heightPixels:800};
  const world={referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[0,0,0] as const,orientationXyzw:[0,0,0,1] as const}};
  field.publish({world,viewport});
  const path=field.root.querySelector('path')!,first=path.getAttribute('d');
  assert.equal(field.root.querySelectorAll('path').length, 1);assert.equal(path.getAttribute('fill'), '#ffb38ad9');
  assert.equal(field.root.querySelector('i'), null);assert.equal(field.stats().visiblePoints, 1);assert.match(first, /^M/);
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
    className: 'test-points', stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'], keepFraction: () => keep });
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
      stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), paintPalette: ['#ffffffff'] }); };
  const centres = (field: ReturnType<typeof mount>) => [...(field.root.querySelector('path')!.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+)/g)]
    .map(match => [Number(match[1]) + Number(match[3]) + 500, Number(match[2]) + 400]);
  const warped = mount(), exact = mount();
  warped.publish({ world: pose(0), viewport });
  const painted = centres(warped), before = warped.root.querySelector('path')!.getAttribute('d');
  warped.publish({ world: pose(2), viewport });
  // Only the warp was written: the paths keep the first paint.
  assert.equal(warped.root.querySelector('path')!.getAttribute('d'), before);
  const numbers = (warped.root.querySelector('svg')!.style.transform.match(/-?[\d.e+-]+/g) ?? []).slice(1).map(Number);
  assert.equal(numbers.length, 16);
  const [a, b, , c, d, e, , g, , , , , h, i, , j] = numbers;
  const moved = painted.map(([x, y]) => { const w = c! * x! + g! * y! + j!; return [(a! * x! + d! * y! + h!) / w, (b! * x! + e! * y! + i!) / w]; });
  exact.publish({ world: pose(2), viewport });
  const repainted = centres(exact);
  // The same dots, placed by the warp and by a repaint: every in-view dot of the repaint has its warped twin.
  for (const [x, y] of repainted) assert.ok(Math.min(...moved.map(([mx, my]) => Math.hypot(mx! - x!, my! - y!))) < 2e-3);
  // A pause brings back the exact paint.
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(warped.root.querySelector('svg')!.style.transform, '');
  assert.equal(warped.root.querySelector('path')!.getAttribute('d'), exact.root.querySelector('path')!.getAttribute('d'));
  // A turn past the painted margin repaints at once.
  warped.publish({ world: pose(40), viewport });
  assert.equal(warped.root.querySelector('svg')!.style.transform, '');
  warped.destroy(); exact.destroy();
});
