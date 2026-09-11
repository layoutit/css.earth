import { expect, test } from 'vitest';
import { admitSurfaceFeatureLabels, passesZoomGate, projectSurfaceFeature, projectSurfaceOutline, surfaceLabelOpacity, surfaceLabelRect, zoomShare } from './surface-feature-layout.js';
import type { SurfaceFeaturePolicy } from './surface-feature-types.js';

const policy: SurfaceFeaturePolicy = { minimumZoomShare: 1, minimumDiameterPixels: 30, alwaysVisibleCount: 1, maximumVisible: 3, limbCosine: 0.12 };
// Column-major eye matrix: uniform scale 0.02, no rotation, body centre 400px in front of the eye.
const matrix = [0.02, 0, 0, 0, 0, 0.02, 0, 0, 0, 0, 0.02, 0, 0, 0, -400, 1];
const feature = (x: number, y: number, z: number, radiusUnits = 10) => {
  const length = Math.hypot(x, y, z);
  return { anchorUnits: [x, y, z] as const, normal: [x / length, y / length, z / length] as const, radiusUnits };
};

test('a sub-solar anchor projects to the principal point, faces the eye and scales with the focal length', () => {
  const projected = projectSurfaceFeature(feature(0, 0, 230), matrix, 800, [5, -3]);
  expect(projected).not.toBeNull();
  expect(projected!.x).toBeCloseTo(5);
  expect(projected!.y).toBeCloseTo(-3);
  expect(projected!.facing).toBeCloseTo(1);
  // Diameter 20 units × 0.02 scale = 0.4 eye px at depth 400 − 4.6 → 800 × 0.4 / 395.4.
  expect(projected!.diameterPx).toBeCloseTo(800 * 0.4 / 395.4, 6);
});

test('anchors on the far hemisphere or behind the eye are rejected and limb anchors report a grazing facing', () => {
  expect(projectSurfaceFeature(feature(0, 0, -230), matrix, 800, [0, 0])!.facing).toBeLessThan(0);
  expect(projectSurfaceFeature(feature(230, 0, 0), matrix, 800, [0, 0])!.facing).toBeCloseTo(-230 * 0.02 / Math.hypot(4.6, 400) * -1 * -1, 2);
  const behind = [0.02, 0, 0, 0, 0, 0.02, 0, 0, 0, 0, 0.02, 0, 0, 0, 400, 1];
  expect(projectSurfaceFeature(feature(0, 0, 230), behind, 800, [0, 0])).toBeNull();
});

test('point labels sit right of their anchor dot and region labels are centred', () => {
  const projected = { x: 100, y: 50, facing: 1, diameterPx: 40 };
  expect(surfaceLabelRect('point', projected, 60, 14)).toEqual({ left: 97, top: 43, right: 168, bottom: 57 });
  expect(surfaceLabelRect('region', projected, 60, 14)).toEqual({ left: 70, top: 43, right: 130, bottom: 57 });
});

test('limb opacity fades in above the policy cosine', () => {
  expect(surfaceLabelOpacity(0.1, policy)).toBe(0);
  expect(surfaceLabelOpacity(0.22, policy)).toBeCloseTo(0.5);
  expect(surfaceLabelOpacity(0.5, policy)).toBe(1);
});

test('admission follows prepared priority, honours the size floor, the always-visible head and overlap', () => {
  const candidate = (index: number, x: number, y: number, diameterPx: number, facing = 1) => ({ index, kind: 'point' as const, projected: { x, y, facing, diameterPx }, width: 50, height: 14 });
  const result = admitSurfaceFeatureLabels([
    candidate(0, 0, 0, 10),        // below the floor but always visible as rank 0
    candidate(1, 200, 0, 60),      // visible
    candidate(2, 205, 4, 60),      // overlaps candidate 1
    candidate(3, -200, 0, 10),     // below the floor
    candidate(4, 0, 200, 60, 0.05), // beyond the limb
    candidate(5, 0, -200, 60),     // visible, then capped
    candidate(6, 300, 300, 60),    // capped by maximumVisible
  ], policy, { width: 1000, height: 1000 }, new Set());
  expect(result.accepted.map(item => item.index)).toEqual([0, 1, 5]);
  expect(result.eligible).toBe(5);
});

test('labels visible last frame keep their place ahead of overlapping newcomers', () => {
  const candidate = (index: number, x: number) => ({ index, kind: 'region' as const, projected: { x, y: 0, facing: 1, diameterPx: 60 }, width: 50, height: 14 });
  const fresh = admitSurfaceFeatureLabels([candidate(0, 0), candidate(1, 20)], policy, { width: 1000, height: 1000 }, new Set());
  expect(fresh.accepted.map(item => item.index)).toEqual([0]);
  const retained = admitSurfaceFeatureLabels([candidate(0, 0), candidate(1, 20)], policy, { width: 1000, height: 1000 }, new Set([1]));
  expect(retained.accepted.map(item => item.index)).toEqual([1]);
});

test('the zoom gate opens only at the policy share of the logarithmic zoom range', () => {
  expect(zoomShare(0.42, 0.42, 4)).toBe(0);
  expect(zoomShare(4, 0.42, 4)).toBe(1);
  expect(zoomShare(Math.sqrt(0.42 * 4), 0.42, 4)).toBeCloseTo(0.5);
  expect(passesZoomGate(3.9, 0.42, 4, policy)).toBe(false);
  expect(passesZoomGate(4, 0.42, 4, policy)).toBe(true);
  expect(passesZoomGate(undefined, 0.42, 4, policy)).toBe(false);
  expect(passesZoomGate(1, 0.42, 4, { ...policy, minimumZoomShare: 0 })).toBe(true);
  expect(passesZoomGate(2, 0.42, 4, { ...policy, minimumZoomShare: 0.5 })).toBe(true);
});

test('the outline keeps only chords whose ends face the eye', () => {
  // A 30° small circle around the sub-eye point: every rim point faces the eye.
  const R = 230, theta = Math.PI / 6;
  const front = { kind: 'circle' as const, center: [0, 0, R * Math.cos(theta)] as const, east: [R * Math.sin(theta), 0, 0] as const, north: [0, R * Math.sin(theta), 0] as const };
  const chords = projectSurfaceOutline(front, matrix, 800, [0, 0], 16);
  expect(chords).toHaveLength(16);
  const radii = chords.map(([x0, y0]) => Math.hypot(x0, y0));
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-6);
  // A circle straddling the limb loses the chords that turn away.
  const limb = { kind: 'circle' as const, center: [R * Math.cos(theta), 0, 0] as const, east: [0, 0, R * Math.sin(theta)] as const, north: [0, R * Math.sin(theta), 0] as const };
  const partial = projectSurfaceOutline(limb, matrix, 800, [0, 0], 16);
  expect(partial.length).toBeGreaterThan(0);
  expect(partial.length).toBeLessThan(16);
  const back = { kind: 'circle' as const, center: [0, 0, -R * Math.cos(theta)] as const, east: [R * Math.sin(theta), 0, 0] as const, north: [0, R * Math.sin(theta), 0] as const };
  expect(projectSurfaceOutline(back, matrix, 800, [0, 0], 16)).toEqual([]);
  // A prepared extent polygon is transported as given and closed on itself.
  const box = { kind: 'box' as const, points: [[-20, -20, 229], [20, -20, 229], [20, 20, 229], [-20, 20, 229]] as const };
  const square = projectSurfaceOutline(box, matrix, 800, [0, 0], 16);
  expect(square).toHaveLength(4);
  expect(square[3]![2]).toBeCloseTo(square[0]![0]);
});

test('labels leaving the viewport are not admitted', () => {
  const candidate = { index: 0, kind: 'region' as const, projected: { x: 490, y: 0, facing: 1, diameterPx: 60 }, width: 50, height: 14 };
  expect(admitSurfaceFeatureLabels([candidate], policy, { width: 1000, height: 1000 }, new Set()).accepted).toEqual([]);
});
