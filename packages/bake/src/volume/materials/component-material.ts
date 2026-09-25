/** Assign observation color once to finite 3D emitters; never project an image through depth. */
import { createEmissionField, emissionKernel, prepareEmissionComponent } from '../fields/emission.ts';
import type { EmissionFieldModel, EmissionVector3 } from '../contracts/emission.ts';

const QUADRATURE_STEPS = 24;
export interface MaterialImage { id: string; sampleRgb(x: number, y: number, out: EmissionVector3): boolean }

export function createEmissionMaterial(model: EmissionFieldModel, image: MaterialImage,
  field = createEmissionField(model)) {
  if (!image.id || typeof image.sampleRgb !== 'function') throw new TypeError('Component material requires a registered source image.');
  const pixel: EmissionVector3 = [0, 0, 0];
  const components = model.components.map(component => {
    const prepared = prepareEmissionComponent(component), rgb: EmissionVector3 = [0, 0, 0];
    let total = 0, observed = 0, positive = 0;
    // Midpoint quadrature in the component's own projected coordinates. Its complete finite
    // footprint is integrated; authored z, shear and width remain unchanged by the image.
    for (let v = 0; v < QUADRATURE_STEPS; v++) for (let u = 0; u < QUADRATURE_STEPS; u++) {
      const a = 8 * ((u + .5) / QUADRATURE_STEPS - .5), b = 8 * ((v + .5) / QUADRATURE_STEPS - .5);
      const weight = emissionKernel(a) * emissionKernel(b); total += weight;
      const dx = a * component.sigma[0], dy = b * component.sigma[1];
      const available = image.sampleRgb(component.center[0] + prepared.c * dx - prepared.s * dy,
        component.center[1] + prepared.s * dx + prepared.c * dy, pixel);
      if (available && pixel.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255))
        throw new TypeError('Registered material image returned invalid RGB.');
      if (available) observed += weight;
      const peak = available ? Math.max(...pixel) : 0;
      if (peak > 0) positive += weight;
      // Explicit no-data/black support stays neutral instead of deleting emission or
      // extending the nearest colored pixel beyond the observed footprint.
      for (let c = 0; c < 3; c++) rgb[c] += weight * (peak > 0 ? 255 * pixel[c] / peak : 255);
    }
    for (let c = 0; c < 3; c++) rgb[c] = Math.min(255, Math.max(0, rgb[c] / total));
    return { id: component.id, rgb, covered: positive > 0, observedKernelFraction: observed / total,
      coloredKernelFraction: positive / total };
  });
  return { sampleMaterial: field.createMaterialSampler(components), receipt: {
    schema: 'cssearth-component-bound-material@1', sourceId: image.id, fieldIdentity: model.identity,
    method: 'One source chromaticity per finite 3D emission component, mixed by its unchanged local emission.',
    quadrature: { rule: 'midpoint', samplesPerProjectedAxis: QUADRATURE_STEPS, supportSigma: [-4, 4] },
    components, assumptions: [
      'A projected image does not determine front/back colors. Component-footprint color association is an authored approximation, not measured 3D spectroscopy.',
      'Overlapping projected components with identical footprints remain color-degenerate; no synthetic depth variation is introduced.',
      'One chromaticity per existing component can smooth detail finer than its support; source imagery never extends that support or changes neutral alpha.',
      'Missing or black source coverage contributes neutral material and is counted separately; no nearest-pixel color extension.',
    ],
  } };
}
