import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { mountBatchedSpatialPoints, pointPaint } from './batched-spatial-points.js';

test('a spatial point field reprojects through one retained SVG path per paint colour', () => {
  const {document}=parseHTML('<div id="host"><b></b></div>'),host=document.getElementById('host')!,before=host.firstElementChild!;
  const frame={referenceFrame:'sun-icrf',epochJdTt:2451545,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,
    metersPerUnit:1,boundsUnits:{min:[-20,-20,-20] as const,max:[20,20,20] as const}};
  const style={colorCss:'#ffb38a',opacity:.85,radiusPx:1};
  expect(pointPaint(style)).toBe('#ffb38ad9');
  const field=mountBatchedSpatialPoints({host,before,frame,points:[{positionUnits:[1,0,-10] as const}],className:'test-points',
    stylePoint:()=>style,paintPalette:[pointPaint(style)]});
  const viewport={focalPixels:100,principalOffsetPixels:[0,0] as const,widthPixels:1000,heightPixels:800};
  const world={referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[0,0,0] as const,orientationXyzw:[0,0,0,1] as const}};
  field.publish({world,viewport});
  const path=field.root.querySelector('path')!,first=path.getAttribute('d');
  expect(field.root.querySelectorAll('path')).toHaveLength(1);expect(path.getAttribute('stroke')).toBe('#ffb38ad9');
  expect(field.root.querySelector('i')).toBeNull();expect(field.stats().visiblePoints).toBe(1);expect(first).toMatch(/^M/);
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
