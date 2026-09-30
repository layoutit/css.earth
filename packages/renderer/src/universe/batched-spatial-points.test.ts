import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { mountBatchedSpatialPoints } from './batched-spatial-points.js';

test('a spatial point field reprojects through a fixed eight-node CSS shadow bank', () => {
  const {document}=parseHTML('<div id="host"><b></b></div>'),host=document.getElementById('host')!,before=host.firstElementChild!;
  const frame={referenceFrame:'sun-icrf',epochJdTt:2451545,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,
    metersPerUnit:1,boundsUnits:{min:[-20,-20,-20] as const,max:[20,20,20] as const}};
  const field=mountBatchedSpatialPoints({host,before,frame,points:[{positionUnits:[1,0,-10] as const}],className:'test-points',
    stylePoint:()=>({colorCss:'#ffffff',opacity:1,radiusPx:1})});
  const viewport={focalPixels:100,principalOffsetPixels:[0,0] as const,widthPixels:1000,heightPixels:800};
  const world={referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[0,0,0] as const,orientationXyzw:[0,0,0,1] as const}};
  field.publish({world,viewport});
  const first=field.nodes[0]!.style.boxShadow;
  expect(field.nodes).toHaveLength(8);expect(field.stats().visiblePoints).toBe(1);expect(first).toContain('#ffffffff');
  field.publish({world:{...world,pose:{...world.pose,positionM:[1,0,0]}},viewport});
  expect(field.nodes[0]!.style.boxShadow).not.toBe(first);expect(field.stats().visiblePoints).toBe(1);expect(host.children).toHaveLength(2);
  field.destroy();expect(host.children).toHaveLength(1);
});


test('changing the kept share repaints even when the camera has not moved', () => {
  const { document } = parseHTML('<div id="host"></div>');
  let keep = .25;
  const field = mountBatchedSpatialPoints({ host: document.getElementById('host')!,
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } },
    points: Array.from({ length: 20 }, (_, x) => ({ positionUnits: [x / 100, 0, -10] as const })),
    className: 'test-points', stylePoint: () => ({ colorCss: '#ffffff', opacity: 1, radiusPx: 1 }), keepFraction: () => keep });
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
