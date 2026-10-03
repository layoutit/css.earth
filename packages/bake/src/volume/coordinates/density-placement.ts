/** Authored model-only similarity; observed sky/image geometry stays fixed. */
import { parseDensityPlacement, type DensityPlacement, type Vector3, type Bounds3, type VolumeSlices } from '@cssearth/objects';
export function densityPlacementTransform(placement: DensityPlacement) {
  const p = parseDensityPlacement(placement), angle = p.rotationZDegrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const normal = ([x, y, z]: readonly number[]): Vector3 => [c * x - s * y, s * x + c * y, z];
  function point(point: readonly number[]): Vector3 {
    const rotated = normal(point.map((value, i) => value - p.pivotUnits[i]!));
    return rotated.map((value, i) => p.pivotUnits[i]! + p.translationUnits[i]! + p.scale * value) as Vector3;
  }
  function inverse(point: readonly number[]): Vector3 {
    const [x, y, z] = point.map((value, i) => (value - p.pivotUnits[i]! - p.translationUnits[i]!) / p.scale);
    return [c * x + s * y + p.pivotUnits[0], -s * x + c * y + p.pivotUnits[1], z + p.pivotUnits[2]];
  }
  function bounds(bounds: Bounds3): Bounds3 {
    const corners = [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].flatMap(y =>
      [bounds.min[2], bounds.max[2]].map(z => point([x, y, z]))));
    return { min: [0, 1, 2].map(i => Math.min(...corners.map(p => p[i]!))) as Vector3,
      max: [0, 1, 2].map(i => Math.max(...corners.map(p => p[i]!))) as Vector3 };
  }
  return { point, inverse, normal, bounds };
}
export function placeDensitySlices(slices: VolumeSlices, placement: DensityPlacement): VolumeSlices {
  const transform = densityPlacementTransform(placement);
  return { ...slices, boundsUnits: transform.bounds(slices.boundsUnits),
    approximation: { ...slices.approximation, slabPitchUnits: { x: slices.approximation.slabPitchUnits.x * placement.scale,
      y: slices.approximation.slabPitchUnits.y * placement.scale, z: slices.approximation.slabPitchUnits.z * placement.scale } },
    quads: slices.quads.map(quad => ({ ...quad, center: transform.point(quad.center), normal: transform.normal(quad.normal),
      vertices: quad.vertices.map(transform.point) as typeof quad.vertices })) };
}
