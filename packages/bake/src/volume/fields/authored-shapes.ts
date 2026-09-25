/** Pure optically emitting shell field and its fixed orthographic image projection. */
import type { Bounds3, Vector3 } from '../contracts/volume-recipe.ts';
import type { ShapeCloudSettings } from '../contracts/authored-shapes.ts';

export function shapePixelToUnits(x: number, y: number, width: number, height: number): [number, number] {
  const scale = 10 / width;
  return [(x - width / 2) * scale, (height / 2 - y) * scale];
}
export function shapeUnitsToPixel(x: number, y: number, width: number, height: number): [number, number] {
  const scale = 10 / width;
  return [x / scale + width / 2, height / 2 - y / scale];
}

export function createShapeCloudField(settings: ShapeCloudSettings, width: number, height: number) {
  const unitsPerPixel = 10 / width;
  const components = settings.components.filter(component => component.enabled && component.weight > 0).map(component => {
    const [x, y] = shapePixelToUnits(component.x, component.y, width, height);
    // Raster rotation is clockwise; the physical x-right/y-up frame reverses it exactly once.
    const angle = -component.rotationDegrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const a = component.radiusX * unitsPerPixel, b = component.radiusY * unitsPerPixel;
    const halfThickness = component.thickness / 2;
    const z = Math.min(a, b) * component.depth, outer = 1 + (component.shape === 'ellipsoid' ? 0 : halfThickness) + component.softness;
    const extentX = Math.hypot(a * c, b * s) * outer, extentY = Math.hypot(a * s, b * c) * outer;
    return { x, y, c, s, a, b, z, outer, extentX, extentY, extentZ: component.shape === 'ring' ? z : z * outer,
      arcCenter: (component.arcCenterDegrees ?? 0) * Math.PI / 180,
      arcSweep: (component.arcSweepDegrees ?? 360) * Math.PI / 180,
      shape: component.shape, operation: component.operation, halfThickness, softness: component.softness,
      gain: component.weight * 1.8 / Math.min(a, b) };
  });
  // The full photograph remains a separate registered reference. Empty photo margins
  // must not consume slab samples that belong to the finite 3D emission support.
  const bounds: Bounds3 = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const component of components) {
    if (component.operation === 'subtract') continue; // A cutter cannot create or enlarge emission support.
    bounds.min[0] = Math.min(bounds.min[0], component.x - component.extentX);
    bounds.max[0] = Math.max(bounds.max[0], component.x + component.extentX);
    bounds.min[1] = Math.min(bounds.min[1], component.y - component.extentY);
    bounds.max[1] = Math.max(bounds.max[1], component.y + component.extentY);
    bounds.min[2] = Math.min(bounds.min[2], -component.extentZ);
    bounds.max[2] = Math.max(bounds.max[2], component.extentZ);
  }
  const empty = !components.some(component => component.operation === 'add');
  if (empty) { bounds.min = [0, 0, 0]; bounds.max = [0, 0, 0]; }
  // One source-pixel guard makes every authored finite-support boundary interior to the bake.
  for (let axis = 0; axis < 3; axis++) { bounds.min[axis]! -= unitsPerPixel; bounds.max[axis]! += unitsPerPixel; }
  const sampleEmission = (x: number, y: number, z: number, out: Vector3) => {
    let value = 0;
    for (const component of components) {
      const dx = x - component.x, dy = y - component.y;
      if (Math.abs(dx) >= component.extentX || Math.abs(dy) >= component.extentY || Math.abs(z) >= component.extentZ) continue;
      const localX = (dx * component.c + dy * component.s) / component.a;
      const localY = (-dx * component.s + dy * component.c) / component.b;
      const radial = Math.hypot(localX, localY), radius = Math.hypot(radial, z / component.z);
      const halfThickness = component.shape === 'ellipsoid' ? 0 : component.halfThickness;
      const distance = component.shape === 'ring'
        ? Math.hypot(radial - 1, z / component.z * (halfThickness + component.softness))
        : component.shape === 'ellipsoid' ? Math.max(0, radius - 1) : Math.abs(radius - 1);
      if (distance >= halfThickness + component.softness) continue;
      let sectorGain = 1;
      if (component.shape === 'ring' && component.arcSweep < Math.PI * 2) {
        // The sector rotates with the 3D ring; no view-dependent masks or image extrusion.
        const angle = -Math.atan2(localY, localX) - component.arcCenter;
        const delta = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
        const edge = component.arcSweep / 2, feather = Math.min(edge, Math.max(.03, component.softness, component.arcSweep * .2));
        if (delta >= edge) continue;
        const fade = Math.max(0, (delta - edge + feather) / feather);
        sectorGain = 1 - fade * fade * (3 - 2 * fade);
      }
      const t = Math.max(0, (distance - halfThickness) / component.softness);
      value += (component.operation === 'subtract' ? -1 : 1) * component.gain * sectorGain * (1 - t * t * (3 - 2 * t));
    }
    out[0] = out[1] = out[2] = Math.max(0, value);
  };
  return { bounds, unitsPerPixel, empty, sampleEmission };
}

/** Pixel-edge convention: a world position at a source texel center samples that texel exactly. */
export function createShapeImageSampler(rgb: Uint8Array, width: number, height: number) {
  if (rgb.length !== width * height * 3) throw new TypeError('Shape cloud source must be full RGB.');
  return (x: number, y: number, _z: number, out: Vector3): boolean => {
    const [px, py] = shapeUnitsToPixel(x, y, width, height);
    if (px < 0 || py < 0 || px >= width || py >= height) return false;
    const fx = Math.max(0, Math.min(width - 1, px - .5)), fy = Math.max(0, Math.min(height - 1, py - .5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const u = fx - x0, v = fy - y0;
    for (let channel = 0; channel < 3; channel++) {
      const a = rgb[(y0 * width + x0) * 3 + channel]!, b = rgb[(y0 * width + x1) * 3 + channel]!;
      const c = rgb[(y1 * width + x0) * 3 + channel]!, d = rgb[(y1 * width + x1) * 3 + channel]!;
      out[channel] = (1 - v) * (a + (b - a) * u) + v * (c + (d - c) * u);
    }
    return true;
  };
}
