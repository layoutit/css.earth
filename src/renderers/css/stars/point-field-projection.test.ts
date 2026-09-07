import { expect, test } from 'vitest';
import { createPointSample, samplePreparedPoint, projectPreparedPoint, pointPhotometry } from './point-field-projection.js';
import source from '../../../objects/stellar-neighbourhood/prepared/stars.json';
import type { PreparedCssPointField, PointFieldVector } from './types.js';
const payload = source.data as unknown as PreparedCssPointField;

test('retained point samples match the direct projection and photometry across translation and rotation', () => {
  const sample = createPointSample();
  for (const eye of [[0,0,0], [1,-2,3], [10,20,-30]] as PointFieldVector[]) {
    for (const angle of [0,.3,1.5,-2]) {
      const c = Math.cos(angle), s = Math.sin(angle), rotation = [c,0,s,0,1,0,-s,0,c] as const;
      for (const point of payload.stars.slice(0,32)) {
        const result = samplePreparedPoint(sample, point, payload, eye, rotation, 700, 21, -17);
        const direct = projectPreparedPoint(point.positionUnits, eye, rotation, 700, 21, -17);
        expect([result.x,result.y,result.depth]).toEqual([direct.x,direct.y,direct.depth]);
        expect(result.light).toEqual(pointPhotometry(payload,point.absoluteMagnitude,direct.distanceUnits,point.coverageAnchor));
      }
    }
  }
});

test('rotation and focal changes reuse distance photometry, while translation invalidates it', () => {
  const sample = createPointSample(), point = payload.stars[0], identity = [1,0,0,0,1,0,0,0,1] as const;
  samplePreparedPoint(sample,point,payload,[0,0,0],identity,700,0,0);
  const light = sample.light;
  samplePreparedPoint(sample,point,payload,[0,0,0],[0,0,1,0,1,0,-1,0,0],800,20,-30);
  expect(sample.light).toBe(light);
  samplePreparedPoint(sample,point,payload,[1,0,0],identity,700,0,0);
  expect(sample.light).not.toBe(light);
});
