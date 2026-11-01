/** One slab of the model: only the light, stars and dust inside its interval, at native sampling. */
import type { GalaxySlabDomain } from './slab-domain.mts';
import { catalogueBasis, projectCatalogue } from '../catalogue-render.mts';
import { gradedPrediction } from '../grade.mts';
import type { CatalogueScene, LmcModel } from '../scene.mts';
import type { VolumeObject } from '../catalogue-volume.mts';
import { need } from '../inputs.mts';
export function intersectsSlab(object: VolumeObject, domain: GalaxySlabDomain): boolean {
  const radius = Math.sqrt(object.axes.reduce((s, r, k) => s + (object.basis[k][domain.axis] * r) ** 2, 0));
  return object.center[domain.axis] + radius >= domain.min && object.center[domain.axis] - radius < domain.max;
}
export function localScene(scene: CatalogueScene, domain: GalaxySlabDomain): CatalogueScene {
  const out: CatalogueScene = {
    ...scene,
    objects: scene.objects.filter(v => intersectsSlab(v, domain)),
    dustLayer: { ...scene.dustLayer, clouds: scene.dustLayer.clouds.filter(v => intersectsSlab(v, domain)) },
  };
  const p = scene.oldPopulation.points,
    indices = [];
  for (let i = 0; i < p.count; i++) {
    const v = p.positions[i * 3 + domain.axis];
    if (v >= domain.min && v < domain.max) indices.push(i);
  }
  const positions = new Float64Array(indices.length * 3),
    rgb = new Float32Array(indices.length * 3),
    components = new Uint8Array(indices.length);
  for (let j = 0; j < indices.length; j++) {
    const i = indices[j];
    for (let c = 0; c < 3; c++) {
      positions[j * 3 + c] = p.positions[i * 3 + c];
      rgb[j * 3 + c] = p.rgb[i * 3 + c];
    }
    components[j] = p.components[i];
  }
  out.oldPopulation = { ...scene.oldPopulation, points: { count: indices.length, positions, rgb, components } };
  return out;
}
export function projectLmcSlab(
  source: Pick<LmcModel, 'scene' | 'amplitudes' | 'grade'>,
  domain: GalaxySlabDomain,
  camera: Parameters<typeof projectCatalogue>[1],
  pixels?: Uint8Array,
) {
  const { scene, amplitudes, grade } = source,
    local = localScene(scene, domain),
    projection = projectCatalogue(local, camera, 0.015, pixels, domain, {
      objectSubpixels: 4,
      cacheFinishedDust: true,
      gaussianTailSigma: 10,
    }),
    basis = catalogueBasis(projection, local, amplitudes),
    rgb = gradedPrediction(basis, grade);
  need(projection.transmittance, 'The local transfer must return its own dust transmittance');
  const tau = Float64Array.from(
    projection.transmittance[0],
    (_, p) => -Math.log(Math.max(1e-30, Math.max(...projection.transmittance!.map(a => a[p])))),
  );
  return { rgb, tau };
}
