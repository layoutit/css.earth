import { canonicalPreparedAsset,preparedSunResources,preparedResourcePool,CANONICAL_PREPARED_IMAGE_DENSITY } from '../../../src/platform/prepared-object-assets.mjs';
import { PREPARED_PRESENTATION_SCHEMA,requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mjs';
import { prepareCssomDeclarationReads } from '../../prepared-cssom.mjs';
import { createPreparedNodeTree } from '../../prepared-node-tree.mjs';
import { prepareMaterialTracks } from '../../prepare-materials.mjs';
import { requirePreparedResourceCatalog } from '../../object-runtime-contract.mjs';

/** Retained affine leaves and a camera-facing row-addressed material share one scene. */
export async function prepareAffinePresentation({config,scene:scenePlan,camera:cameraPlan,lighting,lenses,sun,controls}) {
  const bank = lighting.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)];
  const celestial = preparedSunResources(sun, "warm");
  const lensKeys = id => [`surface:${id}`, `poles:${id}`];
  const entries = [...celestial, ...lenses.controls.flatMap(lens => ["surface", "poles"].map(layer => ({
    key: `${layer}:${lens.id}`, url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "warm",
  }))), ...bank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url ?? row.assetUrl, pool: "lighting" }))];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(scenePlan.leaves.map(leaf => leaf.style)) });
  const camera = b.element("div", `polycss-camera ${config.namespace}-camera planet-render-root`, "perspective:1000000px");
  const scene = b.element("div", "polycss-scene");
  const system = b.mesh(`${config.namespace}-system`, scenePlan.systemTransform), body = b.mesh(`${config.namespace}-body`, scenePlan.bodyTransform);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of scenePlan.leaves) b.append(body, b.leaf(leaf));
  const counter = b.mesh(`${config.namespace}-material-counter`, "");
  const materialSystem = b.mesh(`${config.namespace}-system ${config.namespace}-material-system`, scenePlan.systemTransform);
  const material = b.mesh(`${config.namespace}-material`, scenePlan.bodyTransform);
  const plane = b.mesh(`${config.namespace}-material-plane`, `transform:${cameraPlan.materialDepthContract.planeTransform}`);
  const leaf = b.element("s");
  b.append(scene, counter); b.append(counter, materialSystem); b.append(materialSystem, material);
  b.append(material, plane); b.append(plane, leaf);
  const { tree, index } = b.finish({ camera, scene,  stageClasses: [`${config.namespace}-stage`] });
  const track = { id: "lighting", target: index(leaf),
    frame: { source: "prepared-light-z", minimum: lighting.minimumLightViewZ, maximum: lighting.maximumLightViewZ,
      count: bank.presentations.length, span: lighting.frameCount - 1, maximumFrame: lighting.frameCount - 1,
      baseFrame: 0, remap: null },
    banks: [{ id: "lighting", frames: bank.presentations.map(p => ({ resource: `lighting:${p.rowIndex}`,
      frame: p.frameIndex, row: p.rowIndex, backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize })),
      rows: bank.rows.map((row, index) => ({ row: index, resource: `lighting:${index}`,
        firstFrame: index * bank.transport.framesPerRow,
        lastFrame: Math.min(bank.presentations.length - 1, (index + 1) * bank.transport.framesPerRow - 1) })), default: null, fixed: null }],
    demand: { capacity: bank.transport.maximumRetainedRowCount, defaultFrame: lighting.defaultFrame },
    rotation: { kind: "angle", source: "prepared-light", reference: "prepared", baseDegrees: lighting.baseLightAzimuthDegrees,
      zeroAtPole: true, property: "rotate", publishWithAddress: true }, frameAttribute: null, modeAttribute: null, quoted: true };
  const variants = lenses.controls.flatMap(lens => [false, true].map(shadows => ({
    when: { lensId: lens.id, shadows }, required: lensKeys(lens.id),
    writes: [{ kind: "attribute", target: -1, name: "data-lens", value: lens.id === lenses.defaultLens ? null : lens.id }],
    materials: [{ track: "lighting", bank: "lighting", mode: "frames", enabled: true, rotationEnabled: true,
      frameOverride: null, frameOffset: shadows ? 0 : lighting.shadowlessFrameOffset, clearWhenHidden: false, fixedMode: "shadowless",
      modeLabel: shadows ? "directional-terminator-and-atmosphere" : "directional-atmosphere-without-ground-shadow" }],
  })));
  const presentation = { schema: PREPARED_PRESENTATION_SCHEMA, camera: cameraPlan, sky: scenePlan.starfield, sun, assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: bank.transport.maximumRetainedRowCount,
        concurrency: bank.transport.maximumRetainedRowCount, reuse: true, eviction: "capacity" })],
      startup: [...celestial.map(entry => entry.key), ...lensKeys(lenses.defaultLens), ...bank.transport.initialWarmRows.map(row => `lighting:${row}`)] },
    tree, variants, materials: [track], viewBindings: [{ kind: "counter-rotation", target: index(counter), systemTransform: null }],
    animations: [] };
  const prepared={...presentation,materials:prepareMaterialTracks(presentation)};
  requirePreparedPresentation(prepared,{controls}); requirePreparedResourceCatalog(prepared.assets);
  return {...prepared,schema:"cssearth-object-runtime@4",id:config.namespace,controls};
}
