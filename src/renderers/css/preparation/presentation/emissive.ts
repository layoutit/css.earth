// The emissive presentation: the retired static lane's `prepareEmissiveSurfacePresentation` on the generic scene
// (scene/index.ts body-container layout) with the composite node conventions (composite.ts).
// An emissive body has no material track, no Shadows toggle and no directional Sun; its off-limb context and
// limb plate are silhouette-fitted roots beside the camera, exactly as the retired static presentation mounted them.
import { canonicalPreparedAsset, preparedResourcePool } from '../../rendering/prepared-object-assets.js';
import { POINT_MIN_RADIUS_PX } from '@cssearth/engine';
import type { PreparedVariant } from '../../rendering/prepared-presentation.js';
import type { PresentationInputs, PresentationDraft } from './types.js';
import type { PresentationAdapters } from './adapters.js';
import { seamOutsetBinding, seamOutsetInitialValue } from '../scene/seam-outset.js';
const PREPARED_PRESENTATION_SCHEMA = 'cssearth-prepared-presentation@3';
const LAYERS = ['surface', 'poles', 'corona', 'limb'] as const;

export async function prepareEmissive(input: PresentationInputs, adapters: PresentationAdapters): Promise<PresentationDraft> {
  const { namespace: ns, scene: plan, assets, lenses } = input;
  const { createPreparedNodeTree, prepareCssomDeclarationReads } = adapters;
  const material = plan.material as unknown as { model?: string; offLimbContext?: { logicalSize: number }; limbMaterial?: { logicalSize: number } };
  if (material.model !== 'emissive' || !assets.emission) throw new TypeError('Emissive presentation needs the prepared emission material and plates.');
  if (input.sun !== null && input.sun !== undefined) throw new TypeError('An emissive body carries no directional Sun.');
  const entries = lenses.controls.flatMap(lens => LAYERS.map(layer => ({ key: `${layer}:${lens.id}`,
    url: canonicalPreparedAsset(lens[`${layer}Url` as 'surfaceUrl'], lens[`${layer}2xUrl` as 'surface2xUrl']), pool: 'material' })));
  const required = (id: string) => LAYERS.map(layer => `${layer}:${id}`);
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.leaves.map(leaf => leaf.style)) });
  // Same camera/scene/system/body nodes as composite.ts: the shared orbit writes the perspective and dolly.
  const camera = b.element('div', 'polycss-camera planet-render-root');
  const scene = b.element('div', 'polycss-scene', `transform:${plan.camera.defaultTransform}`, { 'aria-hidden': 'true', 'data-polycss-lighting': 'baked' });
  const system = b.mesh(`${ns}-system`, `transform:${plan.systemTransform}`), body = b.mesh(`${ns}-body`, '', { style: '' });
  const seamOutset = plan.body.seamRepair?.outset;
  if (seamOutset) system.style.setProperty(seamOutset.property, seamOutsetInitialValue(seamOutset, plan.camera.logicalBodyDiameter));
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.body.leaves) b.append(body, b.leaf(leaf));
  // Off-limb context (stationary observed plate behind the sphere) and limb plate (rim over the leaves):
  // two silhouette-fitted roots, the retired static layout with scale 1 (projected camera).
  const corona = b.element('div', `${ns}-corona-layer planet-render-root`, '', { 'aria-hidden': 'true' });
  corona.style.setProperty(`--${ns}-camera-zoom`, '1'); corona.style.scale = '1';
  const limb = b.element('div', `${ns}-limb-layer planet-render-root`, '', { 'aria-hidden': 'true' });
  limb.style.setProperty(`--${ns}-camera-zoom`, '1'); limb.style.scale = '1';
  b.append(null, corona, limb);
  const { tree, index } = b.finish({ camera, scene });
  const targets = [body, body, corona, limb];
  const variants: PreparedVariant[] = lenses.controls.map(lens => ({ when: { lensId: lens.id }, required: required(lens.id), writes: [
    ...LAYERS.map((layer, i) => ({ kind: 'texture' as const, target: index(targets[i]!), name: `--${ns}-${layer}-image`, resource: `${layer}:${lens.id}`, quoted: true })),
    { kind: 'attribute', target: -1, name: 'data-lens', value: lens.id }, { kind: 'attribute', target: -1, name: 'data-view', value: null },
  ], materials: [] }));
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.starfield, sun: null,
    assets: { entries, pools: [preparedResourcePool('material', entries, { retention: 'selection', capacity: 8, concurrency: 8 })],
      startup: required(lenses.defaultLens) },
    tree, variants, materials: [],
    viewBindings: [
      ...[corona, limb].map(node => ({ kind: 'silhouette-fit' as const, target: index(node), minimumRadius: POINT_MIN_RADIUS_PX, unitScale: 2 / plan.camera.logicalBodyDiameter })),
      { kind: 'view-attribute', target: -1, property: 'data-lod', source: 'level-of-detail-stage', precision: null },
      ...([['data-polycss-camera-rot-x', 'scene-pitch', 2], ['data-polycss-camera-rot-y', 'control-yaw', null],
        ['data-polycss-camera-zoom', 'zoom', null], [`data-${ns}-camera-matrix`, 'scene-matrix', null]] as const)
        .map(([property, source, precision]) => ({ kind: 'view-attribute' as const, target: index(camera), property, source, precision })),
      ...(seamOutset ? [seamOutsetBinding(seamOutset, index(system))] : []),
    ],
    animations: [],
  };
}
