import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_JUPITER_SCENE as scenePlan } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_CAMERA as cameraPlan } from "../runtime/preparedCamera.mjs";
import { PREPARED_JUPITER_LIGHTING as lighting } from "../runtime/preparedLighting.mjs";
import { PREPARED_JUPITER_RINGS as ringsPlan } from "../runtime/preparedRings.mjs";
import { PREPARED_JUPITER_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_JUPITER_STARFIELD as sky } from "../runtime/preparedStarfield.mjs";
import { PREPARED_JUPITER_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";

export async function prepareJupiterPresentation() {
  const warm = [...preparedSkyResources(sky, sun, "warm"), ...Object.entries(ringsPlan.assets).map(([name, asset]) => ({
    key: `rings:${name}`, url: canonicalPreparedAsset(asset), pool: "warm" })),
    { key: "shadowless", url: lighting.shadowless.url, pool: "warm" }];
  const lensKeys = id => [`surface:${id}`, `poles:${id}`];
  const entries = [...warm, ...lenses.controls.flatMap(lens => ["surface", "poles"].map(layer => ({
    key: `${layer}:${lens.id}`, url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "warm",
  }))), ...lighting.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" }))];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(scenePlan.leaves.map(leaf => leaf.style)) });
  const camera = b.element("div", "polycss-camera planet-render-root", scenePlan.camera.style);
  const scene = b.element("div", "polycss-scene", scenePlan.camera.sceneStyle);
  const system = b.mesh("jupiter-system", scenePlan.systemTransform), body = b.mesh("jupiter-body", scenePlan.bodyTransform);
  const rings = b.mesh("jupiter-rings", "");
  b.append(null, camera); b.append(camera, scene);
  for (const leaf of scenePlan.leaves) b.append(body, b.leaf(leaf));
  for (const leaf of ringsPlan.leaves) b.append(rings, b.element("s", leaf.className, leaf.style));
  b.append(system, rings, body);
  const materialSystem = b.mesh("jupiter-material-system", cameraPlan.materialDepthPresentation.materialSystemTransform);
  const counter = b.mesh("jupiter-fixed-material-counter", "");
  const material = b.mesh("jupiter-material", cameraPlan.materialDepthPresentation.materialMeshTransform);
  const leaf = b.element("s"); leaf.style.transform = cameraPlan.materialDepthPresentation.leafTransform;
  b.append(scene, materialSystem, system); b.append(materialSystem, counter); b.append(counter, material); b.append(material, leaf);
  const { tree, index } = b.finish({ camera, scene, registrations: [{ bodySystem: system, lightingOverlays: [materialSystem] }], stageClasses: ["jupiter-stage"] });
  const track = { id: "lighting", target: index(leaf),
    frame: { source: "scene-pitch", minimum: lighting.minimumPitchDegrees, maximum: lighting.maximumPitchDegrees,
      count: lighting.frameCount, baseFrame: 0, step: lighting.pitchStepDegrees, remap: null }, defaultPose: [],
    banks: [{ id: "lighting", frames: lighting.presentations.map(p => ({ resource: `lighting:${p.rowIndex}`,
      frame: p.frameIndex, row: p.rowIndex, backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize })),
      rows: lighting.rows.map((row, index) => ({ row: index, resource: `lighting:${index}`,
        firstFrame: index * lighting.transport.framesPerRow,
        lastFrame: Math.min(lighting.presentations.length - 1, (index + 1) * lighting.transport.framesPerRow - 1) })), default: null,
      fixed: { resource: "shadowless", frame: null, row: null,
        backgroundPosition: lighting.shadowless.backgroundPosition, backgroundSize: lighting.shadowless.backgroundSize } }],
    demand: { mode: "current", prewarm: "directional", capacity: lighting.transport.maximumRetainedRowCount,
      framesPerRow: lighting.transport.framesPerRow, defaultFrame: lighting.transport.defaultFrame,
      initialRows: lighting.transport.initialWarmRows, holdHiddenNeighborhood: false, preserveFrameWhenFixed: true, fallback: "nearest-frame" },
    rotation: { kind: "planar", source: "view-sun", reference: "initial", baseDegrees: 0, zeroAtPole: false,
      width: lighting.presentationFrameSize, height: lighting.presentationFrameSize, polePolicy: "azimuth" },
    frameAttribute: null, modeAttribute: null, quoted: true };
  const variants = lenses.controls.flatMap(lens => [false, true].flatMap(shadows => [false, true].map(rings => ({
    when: { lensId: lens.id, shadows, rings }, required: lensKeys(lens.id),
    writes: [{ kind: "attribute", target: -1, name: "data-lens", value: lens.id === lenses.defaultLens ? null : lens.id },
      { kind: "class", target: -1, name: "jupiter-hide-rings", value: !rings },
      { kind: "class", target: -1, name: "jupiter-hide-shadows", value: !shadows }],
    materials: [{ track: "lighting", bank: "lighting", mode: shadows ? "frames" : "fixed", enabled: true, rotationEnabled: shadows,
      frameOverride: null, clearWhenHidden: false, fixedMode: "shadowless" }],
  }))));
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: cameraPlan, sky, sun, inputSelector: null,
    assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: lighting.transport.maximumRetainedRowCount,
        concurrency: lighting.transport.maximumRetainedRowCount, reuse: true, eviction: "capacity" })],
      startup: [...warm.map(entry => entry.key), ...lensKeys(lenses.defaultLens), ...lighting.transport.initialWarmRows.map(row => `lighting:${row}`)] },
    tree, variants, materials: [track], viewBindings: [{ kind: "counter-rotation", target: index(counter),
      systemTransform: cameraPlan.materialDepthPresentation.materialSystemTransform.replace(/^transform:/, "") }],
    animations: [], observations: { constants: { renderStats: { idleJavaScriptLoops: 0 } }, counts: [], materials: [
      ...["material", "camera"].map(category => ({ category, name: "materialFrame", track: "lighting", field: "frame" })),
      { category: "material", name: "appliedFrame", track: "lighting", field: "appliedFrame" },
    ] } };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await prepareJupiterPresentation(), objectControls);
}
