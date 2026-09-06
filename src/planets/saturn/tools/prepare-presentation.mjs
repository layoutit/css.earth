import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4 } from "../../../platform/prepared-ellipsoid-projection.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_SATURN_RUNTIME_SCENE as plan } from "../runtime/preparedSceneRuntime.mjs";
import { PREPARED_SATURN_LEAF_LAYOUTS as layouts } from "../runtime/leaf-layouts.mjs";
import { PREPARED_SATURN_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_SATURN_VIEWS as views } from "../runtime/preparedViews.mjs";
import { PREPARED_SATURN_STARFIELD as sky } from "../runtime/preparedStarfield.mjs";
import { PREPARED_SATURN_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";
import { cameraPlan as camera } from "./camera-plan.mjs";

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function prepareTransform(value) {
  if (!value || value === "none") return identity();
  if (value.startsWith("matrix3d(")) return readPreparedMatrix4(value);
  let matrix = identity(), remainder = value;
  for (const match of value.matchAll(/rotate([XYZ])\((-?[\d.]+)deg\)/gu)) {
    matrix = multiplyPreparedMatrix4(matrix, preparedRotationMatrix4(match[1].toLowerCase(), Number(match[2])));
    remainder = remainder.replace(match[0], "");
  }
  if (remainder.trim()) throw new TypeError(`Unsupported prepared Saturn transform: ${value}`);
  return matrix;
}

export async function prepareSaturnPresentation() {
  const exteriorAtlas = plan.preparedLighting.orbitAtlas.runtimeShards, interiorAtlas = plan.interior.atmosphere.runtimeShards;
  const exteriorLenses = lenses.controls.filter(lens => lens.view !== "interior"), normal = exteriorLenses.find(lens => lens.id === lenses.defaultLens);
  const lensAssets = lens => [
    { key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl) },
    { key: `poles:${lens.id}`, url: lens.polesUrl },
    { key: `rings:${lens.id}`, url: canonicalPreparedAsset(lens.ringUrl, lens.ring2xUrl) },
    ...(lens.id !== lenses.defaultLens && views.assets.outerPoles[lens.id]
      ? [{ key: `outer-poles:${lens.id}`, url: canonicalPreparedAsset(views.assets.outerPoles[lens.id]) }] : []),
  ];
  const interior = [...Object.entries(views.interiorLenses.normal.assets).map(([name, asset]) => ({ key: `interior:${name}`, url: canonicalPreparedAsset(asset), pool: "interior" })),
    { key: "interior:outer-poles", url: canonicalPreparedAsset(views.assets.outerPoles.normal), pool: "interior" }];
  const entries = [
    ...preparedSkyResources(sky, sun, "warm"),
    { key: "weather", url: "/scenes/saturn/saturn-weather.webp", pool: "warm" },
    { key: "ring-shadow", url: "/scenes/saturn/saturn-ring-shadow.webp", pool: "warm" },
    ...plan.ringMotionPlates.map((plate, index) => ({ key: `ring-motion:${index}`, url: canonicalPreparedAsset(plate.textureUrl, plate.texture2xUrl), pool: "warm" })),
    ...interior,
    ...exteriorLenses.flatMap(lens => lensAssets(lens).map(entry => ({ ...entry, pool: lens.id === lenses.defaultLens ? "warm" : "lenses" }))),
    ...Object.entries(exteriorAtlas.variants).map(([id, variant]) => ({ key: `exterior:${id}`, url: variant.runtimeAtlas.asset2xUrl || variant.runtimeAtlas.assetUrl, pool: "exterior-material" })),
    ...Object.entries(interiorAtlas.variants).filter(([id]) => id === "normal" || id.startsWith("normal-")).map(([id, variant]) => ({ key: `interior-material:${id}`, url: variant.runtimeAtlas.asset2xUrl || variant.runtimeAtlas.assetUrl, pool: "interior-material" })),
  ];
  const leaves = [plan.ringPlane, plan.ringShadowPlane, ...plan.ringMotionPlates.map(plate => plate.leaf),
    ...plan.bodyBands.flatMap(band => band.leaves), ...plan.interior.outerBodyBands.flatMap(band => band.leaves),
    ...plan.interior.shells.flatMap(shell => shell.leaves), ...plan.interior.sectionLeaves,
    plan.fixedMaterialPlane.leaf, plan.interior.atmosphere.leaf];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(leaves.map(leaf => leaf.style)) });
  const cameraNode = b.element("div", "polycss-camera planet-render-root", plan.camera.style);
  const scene = b.element("div", "polycss-scene", plan.camera.sceneStyle, { "aria-hidden": "true" });
  const system = b.mesh("saturn-system", plan.systemTransform);
  b.append(null, cameraNode); b.append(cameraNode, scene); b.append(scene, system);
  const ring = b.mesh("saturn-ring-orbit saturn-ring-plane", plan.meshTransform);
  b.append(system, ring); b.append(ring, b.leaf(plan.ringPlane));
  for (const plate of plan.ringMotionPlates) {
    const classes = ["saturn-ring-orbit", ...(plate.compositeMode === "flat" ? ["saturn-ring-flat"] : [])];
    const mesh = b.mesh(classes.join(" "), `${plan.meshTransform};animation-duration:${plate.durationSeconds}s`);
    b.append(system, mesh); b.append(mesh, b.leaf(plate.leaf));
  }
  const ringShadow = b.mesh("saturn-ring-shadow", plan.meshTransform);
  b.append(system, ringShadow); b.append(ringShadow, b.leaf(plan.ringShadowPlane));
  for (const group of plan.ringPointGroups) {
    const classes = [...(group.animated ? ["saturn-ring-orbit"] : []), `saturn-ring-${group.pointMode}`,
      ...(group.compositeMode === "flat" ? ["saturn-ring-flat"] : [])];
    const mesh = b.mesh(classes.join(" "), group.animated ? `${plan.meshTransform};animation-duration:${group.durationSeconds}s` : plan.meshTransform);
    b.append(system, mesh);
    for (const leaf of group.leaves) b.append(mesh, b.element("b", null, leaf.style));
  }
  const carriers = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(leaf => leaf.className?.includes("saturn-polar"));
    const key = `${polar ? "polar" : "body"}:${band.visualRotationSeconds}`;
    if (!carriers.has(key)) {
      const carrier = b.mesh(polar ? "saturn-body saturn-body-polar" : "saturn-body", `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
      b.append(system, carrier); carriers.set(key, carrier);
    }
    for (const leaf of band.leaves) b.append(carriers.get(key), leaf.tag === "s" ? b.leaf(leaf) : b.element(leaf.tag, null, leaf.style));
  }
  const cutaway = b.mesh("saturn-cutaway"); b.append(system, cutaway);
  for (const band of plan.interior.outerBodyBands) {
    if (!band.leaves.length) continue;
    const polar = band.leaves.some(leaf => leaf.className?.includes("saturn-cutaway-outer-pole"));
    const mesh = b.mesh(polar ? "saturn-body saturn-cutaway-body saturn-cutaway-polar-band" : "saturn-body saturn-cutaway-body", plan.meshTransform);
    b.append(cutaway, mesh); for (const leaf of band.leaves) b.append(mesh, b.leaf(leaf));
  }
  for (const shell of plan.interior.shells) {
    const mesh = b.mesh(`saturn-interior-shell ${shell.className}`, plan.meshTransform); b.append(cutaway, mesh);
    for (const leaf of shell.leaves) b.append(mesh, b.leaf(leaf, layouts.classes[shell.className]));
  }
  const sections = b.mesh("saturn-interior-sections", plan.meshTransform); b.append(cutaway, sections);
  for (const leaf of plan.interior.sectionLeaves) b.append(sections, b.leaf(leaf));
  const materialMesh = b.mesh("saturn-fixed-material", plan.fixedMaterialPlane.transform);
  const materialCounter = b.mesh("saturn-fixed-material-counter"), materialSystem = b.mesh("saturn-system", plan.systemTransform);
  const exteriorLeaf = b.leaf(plan.fixedMaterialPlane.leaf), interiorLeaf = b.leaf(plan.interior.atmosphere.leaf);
  exteriorLeaf.className = [exteriorLeaf.className, "saturn-exterior-material"].filter(Boolean).join(" ");
  interiorLeaf.className = [...new Set([...(interiorLeaf.className ?? "").split(/\s+/).filter(Boolean), "saturn-interior-material"])].join(" ");
  interiorLeaf.style.backgroundImage = "none";
  b.append(scene, materialSystem); b.append(materialSystem, materialCounter); b.append(materialCounter, materialMesh); b.append(materialMesh, exteriorLeaf, interiorLeaf);
  const { tree, index } = b.finish({ camera: cameraNode, scene });
  const shape = plan.fixedMaterialPlane.interactionProjection, width = shape.textureSize, height = width;
  const projection = { equatorialRadius: shape.equatorialRadius * shape.tileSize, polarRadius: shape.polarRadius * shape.tileSize,
    // Preserve the original native CSSOM read without a per-frame DOM parse.
    // Chromium ParsePositiveDouble: css_parser_fast_paths.cc at fbbe8214de267f516d9bb96a2b46446e07876218.
    counterPrecision: 6, counterFractionDigits: 7, counterFractionScale: 0.000000100000000000000009,
    coverageScale: shape.coverageScale, bodySystemMatrix: prepareTransform(system.style.transform), bodyMeshMatrix: prepareTransform([...carriers.values()][0].style.transform),
    materialSystemMatrix: prepareTransform(materialSystem.style.transform), materialMeshMatrix: prepareTransform(materialMesh.style.transform),
    baseProjection: prepareTransform(exteriorLeaf.style.transform),
    centerTranslation: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, width / 2, height / 2, 0, 1],
    inverseCenterTranslation: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -width / 2, -height / 2, 0, 1] };
  const orbit = plan.preparedLighting.orbitAtlas;
  const defaultFrame = Math.round(Math.max(0, Math.min(orbit.frameCount - 1,
    (orbit.maximumScenePitchDegrees - camera.initialScenePitchDegrees) / (orbit.maximumScenePitchDegrees - orbit.minimumScenePitchDegrees) * (orbit.frameCount - 1))));
  const frame = { source: "reference-sun-z", minimum: 0, maximum: 2, count: orbit.frameCount, baseFrame: defaultFrame, remap: null };
  const defaultPose = [{ source: "control-pitch", scale: 1, offset: 0, value: camera.defaultControlPitchDegrees, epsilon: 0.01 },
    { source: "control-yaw", scale: 1, offset: 0, value: camera.defaultControlYawDegrees, epsilon: 0.01 }];
  const track = (id, target, atlas, interior) => ({ id, target: index(target), frame, defaultPose,
    banks: Object.entries(atlas.variants).filter(([name]) => !interior || name === "normal" || name.startsWith("normal-")).map(([name, variant]) => {
      const resource = `${interior ? "interior-material" : "exterior"}:${name}`;
      const address = (p, frame) => ({ resource, frame, row: null, backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize });
      return { id: name, frames: Array.from({ length: frame.count }, (_, index) => address(variant.presentations[interior
        ? Math.round(index / (frame.count - 1) * (plan.interior.atmosphere.frameCount - 1)) : index], index)),
        default: address(variant.defaultPresentation, null), fixed: null };
    }),
    demand: { mode: interior ? "visible" : "current", prewarm: "none", capacity: 2, framesPerRow: frame.count,
      defaultFrame, initialRows: [], holdHiddenNeighborhood: false, fallback: "hold" },
    rotation: { kind: "ellipsoid", source: "view-sun", reference: "initial", baseDegrees: 0, zeroAtPole: false, polePolicy: "azimuth",
      width, height, projection, systemTransform: materialSystem.style.transform, onlyWhenEnabled: true },
    frameAttribute: null, modeAttribute: null, quoted: true });
  const variants = lenses.controls.flatMap(lens => [false, true].flatMap(rings => [false, true].map(shadows => {
    const interiorView = lens.view === "interior", content = interiorView ? normal : lens;
    const mode = !rings ? shadows ? "ringless" : "ringless-no-shadows" : shadows ? "full" : "no-shadows";
    const material = mode === "full" ? lens.materialLens : `${lens.materialLens}-${mode}`;
    return { when: { lensId: lens.id, rings, shadows }, required: [...lensAssets(content).map(entry => entry.key), ...(interiorView ? interior.map(entry => entry.key) : [])],
      writes: [{ kind: "attribute", target: -1, name: "data-view", value: interiorView ? "interior" : null },
        { kind: "attribute", target: -1, name: "data-lens", value: interiorView || lens.id === lenses.defaultLens ? null : lens.id },
        { kind: "class", target: -1, name: "saturn-hide-rings", value: !rings },
        { kind: "class", target: -1, name: "saturn-hide-shadows", value: !shadows }],
      materials: [{ track: "exterior", bank: material, mode: "default-pose", enabled: true, rotationEnabled: true, frameOverride: null, clearWhenHidden: false, fixedMode: "fixed" },
        { track: "interior", bank: interiorView ? material : "normal", mode: "default-pose", enabled: interiorView, rotationEnabled: true, frameOverride: null, clearWhenHidden: true, fixedMode: "fixed" }] };
  })));
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera, sky, sun, inputSelector: ".saturn-input-surface",
    assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: 8, concurrency: 8 }),
      preparedResourcePool("interior", entries, { retention: "selection", decoding: "sync" }),
      ...["exterior-material", "interior-material"].map(id => preparedResourcePool(id, entries, { retention: "selection", decoding: "sync", capacity: 2, concurrency: 2 }))],
      startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key), `exterior:${exteriorAtlas.defaultVariant}`] },
    tree, variants, materials: [track("exterior", exteriorLeaf, exteriorAtlas, false), track("interior", interiorLeaf, interiorAtlas, true)],
    viewBindings: [{ kind: "counter-rotation", target: index(materialCounter), systemTransform: materialSystem.style.transform }], animations: [] };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await prepareSaturnPresentation(), objectControls);
}
