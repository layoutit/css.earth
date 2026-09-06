import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_NEPTUNE_SCENE as plan } from "../runtime/preparedScene.mjs";
import { PREPARED_NEPTUNE_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_NEPTUNE_STARFIELD as sky } from "../runtime/preparedStarfield.mjs";
import { PREPARED_NEPTUNE_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";
const cameraPlan = {
  "cameraModel": "accumulated-matrix3d",
  "minimumControlPitchDegrees": 0,
  "maximumControlPitchDegrees": 89,
  "defaultControlPitchDegrees": 34.230769230769226,
  "defaultControlYawDegrees": -105,
  "materialReferenceControlPitchDegrees": 34.230769230769226,
  "materialReferenceControlYawDegrees": 0,
  "initialScenePitchDegrees": 40,
  "maximumScenePitchDegrees": 65,
  "minimumZoom": 0.42,
  "maximumZoom": 4,
  "defaultZoom": 1.1,
  "sceneScale": 0.022,
  "logicalBodyDiameter": 460,
  "pitchBounded": false,
  "yawBounded": false,
  "responsiveFit": {
    "model": "continuous-aspect-smoothstep",
    "portraitBaseWidthShare": 0.34,
    "narrowPortraitWidthShareGain": 0.08,
    "landscapeWidthShareGain": 0.02,
    "narrowPortraitAspectRatio": 0.46,
    "portraitAspectRatio": 0.75,
    "squareAspectRatio": 1,
    "maximumHeightShare": 0.61,
    "maximumMobilePreviewShare": 0.925,
    "minimumZoom": 0.42,
    "maximumZoom": 2
  }
};

export async function prepareNeptunePresentation() {
  const warm = [...preparedSkyResources(sky, sun, "warm"), { key: "rings", url: "/scenes/neptune/neptune-rings@2x.webp", pool: "warm" }];
  const staticKeys = id => ["surface", "poles", "material", "shadowlessMaterial"].map(layer => `${layer}:${id}`);
  const entries = [...warm, ...lenses.controls.flatMap(lens => [
    ...["surface", "poles", "material", "shadowlessMaterial"].map(layer => ({ key: `${layer}:${lens.id}`,
      url: canonicalPreparedAsset(lens[`${layer}Url`], lens[`${layer}2xUrl`]), pool: "variant" })),
    ...lens.orbitMaterial.rows.map((row, index) => ({ key: `lighting:${lens.id}:${index}`, url: row.assetUrl, pool: "lighting" })),
  ])];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([
    ...plan.bodyBands.flatMap(band => band.leaves), plan.ring.leaf, plan.fixedMaterialPlane.leaf].map(leaf => leaf.style)) });
  const mesh = (name, style = "") => b.element("div", name.includes("polycss-") ? name : `polycss-mesh ${name}`, style);
  const camera = b.element("div", "polycss-camera planet-render-root", plan.camera.style);
  // The legacy initialTransform is a transform value assigned as cssText;
  // native CSS rejects it. The shared camera supplies the initial scene pose.
  const scene = mesh("polycss-scene"); scene.attributes["aria-hidden"] = "true";
  const system = mesh("neptune-system", plan.systemTransform), ring = mesh("neptune-ring-plane", plan.meshTransform), ringLeaf = b.leaf(plan.ring.leaf);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, ring); b.append(ring, ringLeaf);
  const carriers = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(leaf => leaf.className?.includes("neptune-polar")), key = polar ? "polar" : "body";
    if (!carriers.has(key)) {
      const body = mesh(polar ? "neptune-body neptune-body-polar" : "neptune-body", `${plan.meshTransform};animation-duration:${plan.motion.bodyVisualRotationSeconds}s`);
      carriers.set(key, body); b.append(system, body);
    }
    for (const leaf of band.leaves) b.append(carriers.get(key), b.leaf(leaf));
  }
  const counter = mesh("neptune-fixed-material-counter"), material = mesh("neptune-fixed-material", plan.fixedMaterialPlane.transform), leaf = b.leaf(plan.fixedMaterialPlane.leaf);
  leaf.className = [leaf.className, "neptune-exterior-material"].filter(Boolean).join(" ");
  b.append(system, counter); b.append(counter, material); b.append(material, leaf);
  ringLeaf.style.backgroundImage = 'url("/scenes/neptune/neptune-rings@2x.webp")';
  const { tree, index } = b.finish({ camera, scene });
  const initialOrbit = lenses.controls.find(lens => lens.id === lenses.defaultLens).orbitMaterial;
  const defaultFrame = Math.round((initialOrbit.maximumScenePitchDegrees - cameraPlan.initialScenePitchDegrees) /
    (initialOrbit.maximumScenePitchDegrees - initialOrbit.minimumScenePitchDegrees) * (initialOrbit.frameCount - 1));
  const initialRow = initialOrbit.presentations[defaultFrame].rowIndex;
  const initialRows = [initialRow - 1, initialRow, initialRow + 1].filter(row => row >= 0 && row < initialOrbit.rows.length);
  const banks = lenses.controls.map(lens => ({ id: lens.id,
    frames: lens.orbitMaterial.presentations.map(p => ({ resource: `lighting:${lens.id}:${p.rowIndex}`, frame: p.frameIndex, row: p.rowIndex,
      backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize })),
    rows: lens.orbitMaterial.rows.map((_, row) => ({ row, resource: `lighting:${lens.id}:${row}`, firstFrame: row * lens.orbitMaterial.frameColumns,
      lastFrame: Math.min(lens.orbitMaterial.frameCount - 1, (row + 1) * lens.orbitMaterial.frameColumns - 1) })),
    default: { resource: `material:${lens.id}`, frame: null, row: null, backgroundPosition: "0px 0px", backgroundSize: "1024px 1024px" },
    fixed: { resource: `shadowlessMaterial:${lens.id}`, frame: null, row: null, backgroundPosition: "0px 0px", backgroundSize: "1024px 1024px" },
  }));
  const track = { id: "lighting", target: index(leaf), frame: { source: "reference-sun-z", minimum: 0, maximum: 2,
      count: initialOrbit.frameCount, baseFrame: defaultFrame, remap: null },
    defaultPose: [{ source: "control-pitch", scale: 1, offset: 0, value: cameraPlan.defaultControlPitchDegrees, epsilon: .01 }], banks,
    demand: { mode: "away-enabled-or-lens-change", prewarm: "none", capacity: 3, framesPerRow: initialOrbit.frameColumns,
      defaultFrame, initialRows, holdHiddenNeighborhood: false, fallback: "hold" },
    rotation: { kind: "planar", source: "view-sun", reference: "initial", baseDegrees: 0, zeroAtPole: false,
      width: 1024, height: 1024, polePolicy: "azimuth" }, frameAttribute: null, modeAttribute: null, quoted: true };
  const variants = lenses.controls.flatMap(({ id }) => [false, true].flatMap(shadows => [false, true].map(rings => ({
    when: { lensId: id, shadows, rings }, required: staticKeys(id), writes: [
      ...["surface", "poles"].map(layer => ({ kind: "texture", target: -1, name: `--neptune-${layer}-image`, resource: `${layer}:${id}`, quoted: true })),
      { kind: "attribute", target: -1, name: "data-lens", value: id },
      { kind: "class", target: -1, name: "neptune-hide-rings", value: !rings },
      { kind: "class", target: -1, name: "neptune-hide-shadows", value: !shadows },
    ], materials: [{ track: "lighting", bank: id, mode: shadows ? "default-pose" : "fixed", enabled: true, rotationEnabled: shadows,
      frameOverride: null, clearWhenHidden: false, fixedMode: "shadowlessMaterial" }],
  }))));
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: cameraPlan, sky, sun, inputSelector: ".neptune-input-surface",
    assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm" }),
      preparedResourcePool("variant", entries, { retention: "selection", capacity: 8, concurrency: 8 }),
      preparedResourcePool("lighting", entries, { retention: "selection", capacity: 3, concurrency: 3, eviction: "capacity" })],
      startup: [...warm.map(e => e.key), ...staticKeys(lenses.defaultLens), ...initialRows.map(row => `lighting:${lenses.defaultLens}:${row}`)] },
    tree, variants, materials: [track], viewBindings: [{ kind: "counter-rotation", target: index(counter), systemTransform: system.style.transform }], animations: [] };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await prepareNeptunePresentation(), objectControls);
}
