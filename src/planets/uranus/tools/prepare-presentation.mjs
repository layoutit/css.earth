import { pathToFileURL } from "node:url";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";
import { preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE as plan } from "../runtime/preparedSceneRuntime.mjs";
import { PREPARED_URANUS_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_URANUS_STARFIELD as sky } from "../runtime/preparedStarfield.mjs";
import { PREPARED_URANUS_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";

// Existing camera calibration becomes prepared data; no camera constructor or
// callback belongs to the object package at runtime.
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

export async function prepareUranusPresentation() {
  const density = String(CANONICAL_PREPARED_IMAGE_DENSITY), lighting = plan.preparedLighting;
  const surface = id => ({ surface: plan.assets.surfaces[id][density].surface, poles: plan.assets.surfaces[id][density].poles,
    default: plan.assets.fixedMaterial[id][density], shadowless: plan.assets.shadowlessMaterial[id][density] });
  const staticKeys = id => ["surface", "poles", "default", "shadowless"].map(layer => `${layer}:${id}`);
  const celestial = [...preparedSkyResources(sky, sun, "mounted"),
    { key: "rings", url: plan.assets.rings[density], pool: "mounted" }, { key: "ring-shadow", url: plan.assets.rings.shadow[density], pool: "mounted" }];
  const entries = [...celestial, ...lenses.controls.flatMap(({ id }) => [
    ...Object.entries(surface(id)).map(([layer, url]) => ({ key: `${layer}:${id}`, url, pool: "mounted" })),
    ...plan.assets.materialViewBank[id][density].rows.map((url, row) => ({ key: `row:${id}:${row}`, url, pool: "rows" })),
  ])];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.bodyBands.flatMap(band => band.leaves).map(leaf => leaf.style)) });
  const element = (tag, className, style = "") => b.element(tag, className, style, { "aria-hidden": "true" });
  const mesh = (className, style = "") => element("div", `polycss-mesh ${className}`, style);
  const texture = (className, record, url) => { const leaf = element("s", className, record.style); leaf.style.backgroundImage = `url(${url})`; return leaf; };
  const camera = element("div", "polycss-camera planet-render-root", plan.camera.style);
  const scene = element("div", "polycss-scene", plan.camera.sceneStyle), system = mesh("uranus-system", plan.systemTransform);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system);
  const ring = mesh("uranus-ring-orbit uranus-ring-plane", `${plan.meshTransform};animation-duration:${plan.preparedRingSource.planeVisualOrbitSeconds}s`);
  b.append(system, ring); b.append(ring, texture("uranus-rings", plan.ringPlane, plan.assets.rings[density]));
  const shadow = mesh("uranus-ring-shadow", plan.meshTransform);
  b.append(system, shadow); b.append(shadow, texture("uranus-ring-shadow-leaf", plan.ringShadowPlane, plan.assets.rings.shadow[density]));
  const carriers = new Map(), normal = surface(lenses.defaultLens);
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(leaf => leaf.className?.includes("uranus-polar")), key = `${polar}:${band.visualRotationSeconds}`;
    if (!carriers.has(key)) {
      const body = mesh(polar ? "uranus-body uranus-body-polar" : "uranus-body", `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
      body.style.setProperty("--uranus-surface-image", `url(${normal.surface})`); body.style.setProperty("--uranus-poles-image", `url(${normal.poles})`);
      carriers.set(key, body); b.append(system, body);
    }
    for (const leaf of band.leaves) b.append(carriers.get(key), b.leaf(leaf));
  }
  const material = mesh("uranus-fixed-material", plan.fixedMaterialPlane.transform), counter = mesh("uranus-fixed-material-counter");
  const leaf = texture("uranus-fixed-material-leaf", plan.fixedMaterialPlane.leaf, normal.default);
  b.append(scene, counter); b.append(counter, material); b.append(material, leaf);
  const { tree, index } = b.finish({ camera, scene, registrations: [{ bodySystem: system, lightingOverlays: [counter] }] });
  const defaultFrame = Math.round(cameraPlan.defaultControlPitchDegrees / cameraPlan.maximumControlPitchDegrees * (lighting.frameCount - 1));
  const banks = lenses.controls.map(({ id }) => ({ id, frames: lighting.presentations.map(p => ({
    resource: `row:${id}:${p.rowIndex}`, frame: p.frameIndex, row: p.rowIndex, backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize })),
    rows: plan.assets.materialViewBank[id][density].rows.map((_, row) => ({ row, resource: `row:${id}:${row}`,
      firstFrame: row * lighting.rowColumns, lastFrame: Math.min(lighting.frameCount - 1, (row + 1) * lighting.rowColumns - 1) })),
    default: { resource: `default:${id}`, frame: null, row: null, backgroundPosition: "0px 0px", backgroundSize: `${lighting.frameSize}px ${lighting.frameSize}px` },
    fixed: { resource: `shadowless:${id}`, frame: null, row: null, backgroundPosition: "0px 0px", backgroundSize: `${lighting.frameSize}px ${lighting.frameSize}px` },
  }));
  const initialRow = lighting.presentations[defaultFrame].rowIndex;
  const initialRows = [...new Set([-1, 0, 1].map(offset => Math.max(0, Math.min(lighting.rowCount - 1, initialRow + offset))))];
  const track = { id: "lighting", target: index(leaf), frame: { source: "reference-sun-z", minimum: 0, maximum: 2,
    count: lighting.frameCount, baseFrame: defaultFrame, remap: null },
    defaultPose: [{ source: "control-pitch", scale: 1, offset: 0, value: cameraPlan.defaultControlPitchDegrees, epsilon: .01 }], banks,
    demand: { mode: "neighborhood", prewarm: "none", capacity: 6, framesPerRow: lighting.rowColumns,
      defaultFrame, initialRows, holdHiddenNeighborhood: true, neighborhoodOffsets: [-1, 0, 1], fallback: "hold" },
    rotation: { kind: "planar", source: "view-sun", reference: "initial", baseDegrees: 0, zeroAtPole: false,
      width: lighting.frameSize, height: lighting.frameSize, polePolicy: "azimuth" }, frameAttribute: null, modeAttribute: null, quoted: false };
  const variants = lenses.controls.flatMap(({ id }) => [false, true].flatMap(shadows => [false, true].map(rings => ({
    when: { lensId: id, shadows, rings }, required: staticKeys(id), writes: [
      ...[...carriers.values()].flatMap(body => ["surface", "poles"].map(layer => ({ kind: "texture", target: index(body),
        name: `--uranus-${layer}-image`, resource: `${layer}:${id}`, quoted: false }))),
      { kind: "attribute", target: -1, name: "data-lens", value: id },
      { kind: "class", target: -1, name: "uranus-hide-rings", value: !rings },
      { kind: "class", target: -1, name: "uranus-hide-shadows", value: !shadows },
    ], materials: [{ track: "lighting", bank: id, mode: shadows ? "default-pose" : "fixed", enabled: true,
      rotationEnabled: shadows, frameOverride: null, clearWhenHidden: false, fixedMode: "shadowless" }],
  }))));
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: cameraPlan, sky, sun, inputSelector: ".uranus-input-surface",
    assets: { entries, pools: [preparedResourcePool("mounted", entries), preparedResourcePool("rows", entries,
      { retention: "selection", capacity: 6, concurrency: 6 })], startup: [...celestial.map(e => e.key), ...staticKeys(lenses.defaultLens),
        ...initialRows.map(row => `row:${lenses.defaultLens}:${row}`)] }, tree, variants, materials: [track],
    viewBindings: [{ kind: "counter-rotation", target: index(counter), systemTransform: null }], animations: [],
    observations: { constants: { dom: { mode: "semantic-transform-groups-with-bare-leaves", retainedCameraRootCount: 1,
      retainedMaterialCompositeRootCount: 0, retainedSceneRootCount: 1, retainedCubicSkyFaceCount: 6 } }, counts: [],
      materials: [...["material", "camera"].map(category => ({ category, name: "activeMaterialRow", track: "lighting", field: "row" })),
        { category: "camera", name: "materialAddressWrites", track: "lighting", field: "addressWrites" }],
      publications: [{ category: "camera", name: "transformWrites", field: "transformWrites" }],
    } };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await prepareUranusPresentation(), objectControls);
}
