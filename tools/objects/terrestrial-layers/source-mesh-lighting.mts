import { cross3 as cross } from '../../../src/platform/vector3.mts';
import type {SourceMesh} from './contracts.mts';
import {parseMeshLighting} from './source-records.mts';
import { dotN as dot } from '../../../src/platform/vector3.mts';
const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);

const unit = (v: readonly number[]) => { const length = Math.hypot(...v); return v.map(x => x / length); };

/** Project each simplified surface texel onto the nearby released mesh. Rays
 * start at the texel, not at the body origin: necks and overhangs retain their
 * own normals. All intersection and cast-shadow work happens in preparation. */
export function createSourceMeshLighting(mesh: SourceMesh, value: unknown, metersPerUnit: number, sunDirection: readonly number[]) {
  const config=parseMeshLighting(value);
  if (![metersPerUnit, config.maximumDistanceMeters, config.rayOffsetMeters].every(Number.isFinite) ||
      !Array.isArray(sunDirection) || sunDirection.length !== 3 || !sunDirection.every(Number.isFinite) ||
      Math.abs(Math.hypot(...sunDirection) - 1) > 1e-9 || !mesh.intersect || !mesh.positions || !mesh.indices ||
      !(metersPerUnit > 0) || !(config.maximumDistanceMeters > 0) ||
      !(config.rayOffsetMeters > 0) || config.rayOffsetMeters >= config.maximumDistanceMeters ||
      ![config.ambient, config.diffuse].every(n => Number.isFinite(n) && n >= 0) ||
      config.ambient + config.diffuse > 1 ||
      (config.uniformFlood !== undefined && typeof config.uniformFlood !== 'boolean') ||
      !Array.isArray(config.floodLights) || !config.floodLights.length ||
      config.floodLights.some(light => !Array.isArray(light.direction) || light.direction.length !== 3 ||
        light.direction.some(n => !Number.isFinite(n)) || Math.abs(Math.hypot(...light.direction) - 1) > 1e-9 ||
        !Number.isFinite(light.weight) || light.weight < 0) ||
      config.ambient + config.floodLights.reduce((sum, light) => sum + light.weight, 0) > 1 + 1e-9) {
    throw new TypeError('Invalid source-mesh lighting recipe.');
  }
  const normals = mesh.positions.map(() => [0, 0, 0]);
  for (const ids of mesh.indices) {
    const [a, b, c] = ids.map(i => mesh.positions[i]), n = cross(sub(b, a), sub(c, a));
    for (const i of ids) for (let axis = 0; axis < 3; axis++) normals[i][axis] += n[axis];
  }
  for (let i = 0; i < normals.length; i++) normals[i] = unit(normals[i]);
  const report = { model: 'source-mesh-normal-and-cast-shadow', samples: 0, projected: 0, fallback: 0, castShadow: 0, maximumProjectionMeters: 0 };
  function sample(point: readonly number[], coarseNormal: readonly number[]) {
    report.samples++;
    const origin = point.map(v => v * metersPerUnit), inverse = coarseNormal.map(v => -v);
    const forward = mesh.intersect(origin, coarseNormal, config.maximumDistanceMeters);
    const backward = mesh.intersect(origin, inverse, config.maximumDistanceMeters);
    const useForward = forward && (!backward || forward.radius < backward.radius);
    const hit = useForward ? forward : backward, ray = useForward ? coarseNormal : inverse;
    let position = origin, normal = coarseNormal;
    if (hit) {
      position = origin.map((v, i) => v + hit.radius * ray[i]);
      const ids = mesh.indices[hit.faceId], [a, b, c] = ids.map(i => mesh.positions[i]);
      const ab = sub(b, a), ac = sub(c, a), ap = sub(position, a);
      const aa = dot(ab, ab), cc = dot(ac, ac), abac = dot(ab, ac), denominator = aa * cc - abac * abac;
      const u = (dot(ap, ab) * cc - dot(ap, ac) * abac) / denominator;
      const v = (dot(ap, ac) * aa - dot(ap, ab) * abac) / denominator;
      normal = unit(normals[ids[0]].map((n, i) => n * (1 - u - v) + normals[ids[1]][i] * u + normals[ids[2]][i] * v));
      report.projected++; report.maximumProjectionMeters = Math.max(report.maximumProjectionMeters, hit.radius);
    } else report.fallback++;
    const facing = Math.max(0, dot(normal, sunDirection));
    const rayOrigin = position.map((v, i) => v + normal[i] * config.rayOffsetMeters);
    const shadowed = facing > 0 && !!mesh.intersect(rayOrigin, sunDirection);
    if (shadowed) report.castShadow++;
    return {
      flood: config.uniformFlood ? 1 : config.ambient + config.floodLights.reduce((sum, light) => sum + light.weight * Math.max(0, dot(normal, light.direction)), 0),
      shadow: config.ambient + config.diffuse * (shadowed ? 0 : facing),
    };
  }
  return { sample, report };
}
