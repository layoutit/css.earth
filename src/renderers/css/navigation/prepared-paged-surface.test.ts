import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { intersectPreparedSurface } from './prepared-surface-hit.js';
import { preparePagedSurfaceHit } from '../../../../tools/objects/geographic-pages/prepare-surface-hit.mjs';
import { prepareLocationPoint } from '../../../../tools/objects/geographic-pages/prepare-location.mjs';
import { prepareCityPageGeometry, createCityCoverageSampler } from '../../../../tools/objects/geographic-pages/page-geometry.mjs';

const scene = JSON.parse(readFileSync(new URL('../../../planets/earth/prepared/scene.json', import.meta.url), 'utf8'));
const plan = preparePagedSurfaceHit(scene, 0);

test('the bounded root mesh reaches cities and the accepted polar apron', () => {
  expect(plan.triangles).toHaveLength(900);
  expect(plan.discs).toHaveLength(2);
  expect(JSON.stringify(plan).length).toBeLessThan(200000);
  for (const [longitude, latitude] of [[-58.3816, -34.6037], [15.6469, 78.2233], [178.4415, -18.1416],
    [-171.7514, -13.8333], [0, 90], [0, -90]]) {
    const point = prepareLocationPoint(scene, longitude, latitude);
    const origin = point.map((v: number) => v * 2) as [number, number, number];
    const direction = point.map((v: number) => -v) as [number, number, number];
    const hit = intersectPreparedSurface(origin, direction, plan);
    expect(hit, `${longitude}, ${latitude}`).not.toBeNull();
    // Existing fine pages stand .001 local units above the accepted base.
    expect(Math.abs(Math.hypot(...hit!.point) - Math.hypot(...point)), `${longitude}, ${latitude}`).toBeLessThan(.002);
  }
});

test('the outermost retained page boundary is periodic across the dateline', () => {
    const hits = [-180, 180].map(lon => {
      const point = prepareLocationPoint(scene, lon, 0);
      const hit = intersectPreparedSurface(point.map((n: number) => n * 2), point.map((n: number) => -n), plan);
      expect(hit).not.toBeNull();
      // Root gutters overlap at this junction. The outer prepared plane is
      // above the nominal geographic point, so it supplies camera clearance.
      expect(Math.hypot(...hit!.point)).toBeGreaterThanOrEqual(Math.hypot(...point));
      return hit!.point;
    });
    for (let axis = 0; axis < 3; axis++) expect(hits[0][axis]).toBeCloseTo(hits[1][axis], 8);
});

test('polar hit coverage matches the prepared opaque disc, including its apron and transparent corners', () => {
  for (const [index, y] of [0, 15].entries()) {
    const page = prepareCityPageGeometry({ level: 0, x: 0, y }, scene);
    const covers = createCityCoverageSampler(page), disc = plan.discs[index];
    const triangles = plan.triangles.slice(disc.firstTriangle, disc.firstTriangle + disc.triangleCount);
    const cap = { triangles, discs: [{ ...disc, firstTriangle: 0 }] };
    const [a, b, , d] = page.corners;
    for (const u of [.01, .1, .25, .5, .75, .9, .99]) for (const v of [.01, .1, .25, .5, .75, .9, .99]) {
      const point = a.map((n: number, axis: number) => n + (b[axis] - n) * u + (d[axis] - n) * v);
      const origin: [number, number, number] = [point[0], point[1], point[2] + 100];
      expect(intersectPreparedSurface(origin, [0, 0, -1], cap) !== null, `${y}: ${u}, ${v}`).toBe(covers(u, v));
    }
  }
});
