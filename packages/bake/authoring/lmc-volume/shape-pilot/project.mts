/** Analytic finite-object projection. These emitters are gas, with no duplicated dust or disc light. */
import { projectObject } from '../catalogue-render.mts';
import { tone, type Grade } from '../grade.mts';
import type { Camera } from '../render.mts';
import type { GalaxySlabDomain } from '../../milky-way-dust/galaxy-slab-domain.mts';
import { normalize } from '../geometry.mts';
import { need } from '../inputs.mts';
import type { Shape } from './source.mts';

export function finiteEmission(shape: Pick<Shape, 'emitters'>, camera: Camera, grade: Grade, domain?: GalaxySlabDomain) {
  const linear = new Float64Array(camera.width * camera.height * 3);
  for (const { object, amplitude } of shape.emitters) for (const pixel of projectObject(object, camera, 4)) {
    let fraction = 1;
    if (domain) {
      const x = pixel.pixel % camera.width, y = Math.floor(pixel.pixel / camera.width), ray = camera.ray(x + .5, y + .5), direction = normalize(ray.direction);
      fraction = pixel.nodes.reduce((sum, n) => {
        const p = ray.origin[domain.axis] + direction[domain.axis] * n.t;
        return sum + (p >= domain.min && p < domain.max ? n.fraction : 0);
      }, 0);
    }
    for (let c = 0; c < 3; c++) linear[pixel.pixel * 3 + c] += pixel.value * fraction * object.weight * amplitude * object.color[c]! * grade.coefficients[3]![c]!;
  }
  const rgb = new Float64Array(linear.length);
  for (let p = 0; p < linear.length; p += 3) { const v = tone(linear[p]!, linear[p + 1]!, linear[p + 2]!, grade.stretch, grade.saturation); rgb.set(v, p); }
  need(rgb.every(v => Number.isFinite(v) && v >= 0), 'Invalid finite emission');
  return { rgb, tau: new Float64Array(camera.width * camera.height), linear };
}
