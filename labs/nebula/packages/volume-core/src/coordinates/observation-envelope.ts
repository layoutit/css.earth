import type {ObservationMapping} from '../contracts/observation-mapping.ts';
import type {Bounds3,Vector3 as Vec3} from '../contracts/volume-recipe.ts';
export function observationEnvelope(mapping:ObservationMapping,bounds:Bounds3):Bounds3 {
  const points = [bounds.min[2], bounds.max[2]].flatMap(z => [bounds.min[0], bounds.max[0]].flatMap(x =>
    [bounds.min[1], bounds.max[1]].map(y => mapping.pointAtDepth(x, y, z))));
  return { min: [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]!))) as Vec3,
    max: [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis]!))) as Vec3 };
}
