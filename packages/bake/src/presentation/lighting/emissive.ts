import { canonicalPreparedAsset, preparedResourcePool, PREPARED_PRESENTATION_SCHEMA, type PreparedVariant } from '@cssearth/objects';

// The emissive presentation: the retired static lane's `prepareEmissiveSurfacePresentation` on the generic scene
// (scene/index.ts body-container layout) with the composite node conventions (composite.ts).
// An emissive body has no material track, no Shadows toggle and no directional Sun; its off-limb context and
// limb plate are silhouette-fitted roots beside the camera, exactly as the retired static presentation mounted them.
import { POINT_MIN_RADIUS_PX } from '@cssearth/engine';

import type { PresentationInputs, PresentationDraft } from '../types.ts';
import type { PresentationAdapters } from '../adapters.ts';
import { seamOutsetBinding, seamOutsetInitialValue } from '../../scene/index.ts';
const LAYERS = ['surface', 'poles', 'corona', 'limb'] as const;

type EmissiveDataset = PresentationInputs['datasets']['controls'][number];
/** The texture resources an emissive body publishes: each dataset's surface and poles, and a plate only when the raster lane
 * published one. A plate with no visible pixel is not published (preparation/raster/index.ts): its dataset draws no image
 * there, loads nothing, and its layer paints nothing, so WebKit gives it no backing. */
export function emissiveEntries(surfaces: readonly EmissiveDataset[]) {
  const published = (dataset: EmissiveDataset, layer: typeof LAYERS[number]) => layer === 'surface' || layer === 'poles' || dataset[`${layer}Url`] !== undefined;
  return surfaces.flatMap(dataset => LAYERS.filter(layer => published(dataset, layer)).map(layer => ({ key: `${layer}:${dataset.id}`,
    url: canonicalPreparedAsset(dataset[`${layer}Url` as 'surfaceUrl'], dataset[`${layer}2xUrl` as 'surface2xUrl']), pool: 'material' })));
}

export async function prepareEmissive(input: PresentationInputs, adapters: PresentationAdapters): Promise<PresentationDraft> {
  const { namespace: ns, scene: plan, assets, datasets } = input;
  const { createPreparedNodeTree, prepareCssomDeclarationReads } = adapters;
  const material = plan.material as unknown as { model?: string; offLimbContext?: { logicalSize: number }; limbMaterial?: { logicalSize: number } };
  if (material.model !== 'emissive' || !assets.emission) throw new TypeError('Emissive presentation needs the prepared emission material and plates.');
  if (input.sun !== null && input.sun !== undefined) throw new TypeError('An emissive body carries no directional Sun.');
  // A dataset that names a companion cloud borrows another dataset's prepared surface, so it owns no plates and needs
  // no variant of its own; the selection resolves it to the surface it borrows before this definition is read.
  const surfaces = datasets.controls.filter(dataset => dataset.volume === undefined || dataset.volume.surface === dataset.id);
  const entries = emissiveEntries(surfaces), keys = new Set(entries.map(entry => entry.key));
  const required = (id: string) => LAYERS.map(layer => `${layer}:${id}`).filter(key => keys.has(key));
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.leaves.map(leaf => leaf.style)) });
  // Same camera/scene/system/body nodes as composite.ts: the shared orbit writes the perspective and dolly.
  const camera = b.element('div', 'polycss-camera object-render-root');
  const scene = b.element('div', 'polycss-scene', `transform:${plan.camera.defaultTransform}`, { 'aria-hidden': 'true', 'data-polycss-lighting': 'baked' });
  const system = b.mesh(`${ns}-system`, `transform:${plan.systemTransform}`), body = b.mesh(`${ns}-body`, '', { style: '' });
  const seamOutset = plan.body.seamRepair?.outset;
  if (seamOutset) system.style.setProperty(seamOutset.property, seamOutsetInitialValue(seamOutset, plan.camera.logicalBodyDiameter));
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.body.leaves) b.append(body, b.leaf(leaf));
  // Off-limb context (stationary observed plate behind the sphere) and limb plate (rim over the leaves):
  // two silhouette-fitted roots, the retired static layout with scale 1 (projected camera).
  const corona = b.element('div', `${ns}-corona-layer object-render-root`, '', { 'aria-hidden': 'true' });
  corona.style.scale = '1';
  const limb = b.element('div', `${ns}-limb-layer object-render-root`, '', { 'aria-hidden': 'true' });
  limb.style.scale = '1';
  // Each plate reads its own texture write here, where the bindings find it; what ships is the write on the plate itself
  // (texture-image-records.ts), so the page's stylesheet names no image.
  corona.style.backgroundImage = `var(--${ns}-corona-image)`; limb.style.backgroundImage = `var(--${ns}-limb-image)`;
  b.append(null, corona, limb);
  // A pulsating star dims under a black veil on the limb plate, the body's own silhouette at the plate's logical size:
  // it covers the sphere and the rim without letting the sky behind show through, and animates opacity only.
  const lightCurve = input.lightCurve, diameter = plan.camera.logicalBodyDiameter;
  const veil = lightCurve ? b.element('div', `${ns}-light-veil`, `position:absolute;left:50%;top:50%;width:${diameter}px;height:${diameter}px;` +
    `margin:${-diameter / 2}px 0 0 ${-diameter / 2}px;border-radius:50%;background:#000;opacity:${lightCurve.keyframes[0]!.opacity}`, { 'aria-hidden': 'true' }) : null;
  if (veil) b.append(limb, veil);
  const { tree, index } = b.finish({ camera, scene });
  const targets = [body, body, corona, limb];
  // Every dataset gets a variant. One that names a companion cloud draws the plates of the surface it borrows, so the
  // table stays complete and nothing at runtime has to know that this dataset is not a surface of its own.
  const variants: PreparedVariant[] = datasets.controls.map(dataset => {
    const surfaceId = dataset.volume?.surface ?? dataset.id;
    return { when: { datasetId: dataset.id }, required: required(surfaceId), writes: [
      ...LAYERS.map((layer, i) => ({ kind: 'texture' as const, target: index(targets[i]!), name: `--${ns}-${layer}-image`,
        resource: keys.has(`${layer}:${surfaceId}`) ? `${layer}:${surfaceId}` : null, quoted: true })),
      { kind: 'attribute', target: -1, name: 'data-dataset', value: dataset.id }, { kind: 'attribute', target: -1, name: 'data-view', value: null },
    ], materials: [] };
  });
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.starfield, sun: null,
    assets: { entries, pools: [preparedResourcePool('material', entries, { retention: 'selection', capacity: 8, concurrency: 8 })],
      // The default dataset may be a companion volume, a disc around this star: it borrows a surface, and startup loads that
      // one, the same resolution every variant makes. Asking for a surface named after the volume would find nothing.
      startup: required(datasets.controls.find(dataset => dataset.id === datasets.defaultDataset)?.volume?.surface ?? datasets.defaultDataset) },
    tree, variants, materials: [],
    viewBindings: [
      ...[corona, limb].map(node => ({ kind: 'silhouette-fit' as const, target: index(node), minimumRadius: POINT_MIN_RADIUS_PX, unitScale: 2 / plan.camera.logicalBodyDiameter })),
      // No camera-pose attributes: nothing reads them, and a camera move would rewrite them every frame
      // (docs/performance/motion-freezes-membership.md).
      { kind: 'view-attribute', target: -1, property: 'data-lod', source: 'level-of-detail-stage', precision: null },
      ...(seamOutset ? [seamOutsetBinding(seamOutset, index(system))] : []),
    ],
    animations: [],
    ...(lightCurve && veil ? { motion: [
      { target: index(veil), id: `${ns}-light-curve`, keyframes: lightCurve.keyframes.map(frame => ({ ...frame })), duration: lightCurve.durationMs, timings: [] },
      // The off-limb light is the star's own and dims with it; a star with no plate publishes none and animates nothing there.
      ...(entries.some(entry => entry.key.startsWith('corona:')) ? [{ target: index(corona), id: `${ns}-light-curve-corona`,
        keyframes: lightCurve.keyframes.map(frame => ({ offset: frame.offset, opacity: (1 - Number(frame.opacity)).toFixed(4) })), duration: lightCurve.durationMs, timings: [] }] : []),
    ] } : {}),
  };
}
