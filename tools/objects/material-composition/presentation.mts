import type {MaterialSourceTrack} from '../../prepare-materials.mts';
import {parse} from './data-schema.mts';
import {layeredPresentationRecipe} from './presentation-recipe.mts';
import {parseLayeredLenses,parseLayeredAtlas} from './presentation-source.mts';
import {requireString} from '../../source-values.mts';
import type {createLayeredOblatePreparation} from './layered-oblate.mts';
import type {prepareLayeredLeafLayouts} from './leaf-layouts.mts';
import type {prepareCutawayMaterials} from '../cutaway/materials.mts';
import type {preparePlanetCubicSky} from '../../../src/platform/prepare-cubic-sky-source.mts';
import type {preparePlanetDirectionalSun} from '../../../src/platform/prepare-directional-sun.mts';
import type {PreparedNode} from '../../prepared-node-tree.mts';
type LayeredScene = Awaited<ReturnType<Awaited<ReturnType<typeof createLayeredOblatePreparation>>['prepareLayeredScene']>>['runtimeScene'];
import { prepareAtlasRows } from './atlas-rows.mts';

import { canonicalPreparedAsset, preparedResourcePool } from "../../../src/platform/prepared-object-assets.mts";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../src/platform/prepared-presentation-contract.mts";
import { multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4 } from "../../../src/renderers/css/dist/preparation.js";
import { prepareCssomDeclarationReads } from "../../prepared-cssom.mts";
import { createPreparedNodeTree } from "../../prepared-node-tree.mts";

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function prepareTransform(value:string|null|undefined) {
  if (!value || value === "none") return identity();
  if (value.startsWith("matrix3d(")) return readPreparedMatrix4(value);
  let matrix = identity(), remainder = value;
  for (const match of value.matchAll(/rotate([XYZ])\((-?[\d.]+)deg\)/gu)) {
    matrix = multiplyPreparedMatrix4(matrix, preparedRotationMatrix4(match[1] === 'X' ? 'x' : match[1] === 'Y' ? 'y' : 'z', Number(match[2])));
    remainder = remainder.replace(match[0], "");
  }
  if (remainder.trim()) throw new TypeError(`Unsupported prepared layered transform: ${value}`);
  return matrix;
}

export async function prepareLayeredOblatePresentation({publicDirectory,config:input,plan,layouts,lenses:lensInput,views,sky,sun}: {publicDirectory:string;config:unknown;plan:LayeredScene;layouts:ReturnType<typeof prepareLayeredLeafLayouts>;lenses:unknown;views:Awaited<ReturnType<typeof prepareCutawayMaterials>>;sky:Awaited<ReturnType<typeof preparePlanetCubicSky>>;sun:Awaited<ReturnType<typeof preparePlanetDirectionalSun>>}) {
  const config=parse(input,layeredPresentationRecipe,'layered presentation recipe'),lenses=parseLayeredLenses(lensInput);
  const {namespace,camera}=config;
  const exteriorAtlas = parseLayeredAtlas(plan.preparedLighting.orbitAtlas.runtimeShards), interiorAtlas = parseLayeredAtlas(plan.interior.atmosphere.runtimeShards);
  const exteriorLenses = lenses.controls.filter(lens => lens.view !== "interior"), normal = exteriorLenses.find(lens => lens.id === lenses.defaultLens);
  if (!normal) throw new Error('Layered presentation has no default exterior lens.');
  const lensAssets = (lens:ReturnType<typeof parseLayeredLenses>['controls'][number]) => [
    { key: `surface:${lens.id}`, url: canonicalPreparedAsset(requireString(lens.surfaceUrl), lens.surface2xUrl) },
    { key: `poles:${lens.id}`, url: requireString(lens.polesUrl) },
    { key: `rings:${lens.id}`, url: canonicalPreparedAsset(requireString(lens.ringUrl), lens.ring2xUrl) },
    ...(lens.id !== lenses.defaultLens && views.assets.outerPoles[lens.id]
      ? [{ key: `outer-poles:${lens.id}`, url: canonicalPreparedAsset(views.assets.outerPoles[lens.id]) }] : []),
  ];
  const interior = [...Object.entries(views.interiorLenses.normal.assets).map(([name, asset]) => ({ key: `interior:${name}`, url: canonicalPreparedAsset(asset), pool: "interior" })),
    { key: "interior:outer-poles", url: canonicalPreparedAsset(views.assets.outerPoles.normal), pool: "interior" }];
  const rowBanks = new Map<string,Awaited<ReturnType<typeof prepareAtlasRows>> & {pool:string}>();
  for (const [pool, atlas, prefix] of [["exterior-material", exteriorAtlas, "exterior"], ["interior-material", interiorAtlas, "interior-material"]] as const) {
    for (const [name, variant] of Object.entries(atlas.variants)) {
      if (pool === "interior-material" && name !== "normal" && !name.startsWith("normal-")) continue;
      const resource = `${prefix}:${name}`;
      const rows = await prepareAtlasRows({ variant, resource, publicDirectory });
      rowBanks.set(resource, { ...rows, pool });
    }
  }
  const entries = [
    { key: "ring-shadow", url: `/scenes/${namespace}/${namespace}-ring-shadow.webp`, pool: "warm" },
    ...plan.ringMotionPlates.map((plate, index) => ({ key: `ring-motion:${index}`, url: canonicalPreparedAsset(plate.textureUrl, plate.texture2xUrl), pool: "warm" })),
    ...interior,
    ...exteriorLenses.flatMap(lens => lensAssets(lens).map(entry => ({ ...entry, pool: lens.id === lenses.defaultLens ? "warm" : "lenses" }))),
    ...[...rowBanks.values()].flatMap(({ entries, pool }) => entries.map(entry => ({ ...entry, pool }))),
  ];
  const leaves = [plan.ringPlane, plan.ringShadowPlane, ...plan.ringMotionPlates.map(plate => plate.leaf),
    ...plan.bodyBands.flatMap(band => band.leaves), ...plan.interior.outerBodyBands.flatMap(band => band.leaves),
    ...plan.interior.shells.flatMap(shell => shell.leaves), ...plan.interior.sectionLeaves,
    plan.fixedMaterialPlane.leaf, plan.interior.atmosphere.leaf];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(leaves.map(leaf => leaf.style)) });
  const cameraNode = b.element("div", "polycss-camera planet-render-root", plan.camera.style);
  const scene = b.element("div", "polycss-scene", plan.camera.sceneStyle, { "aria-hidden": "true" });
  const system = b.mesh(`${namespace}-system`, plan.systemTransform);
  b.append(null, cameraNode); b.append(cameraNode, scene); b.append(scene, system);
  const ring = b.mesh(`${namespace}-ring-orbit ${namespace}-ring-plane`, plan.meshTransform);
  b.append(system, ring); b.append(ring, b.leaf(plan.ringPlane));
  for (const plate of plan.ringMotionPlates) {
    const classes = [`${namespace}-ring-orbit`, ...(plate.compositeMode === "flat" ? [`${namespace}-ring-flat`] : [])];
    const mesh = b.mesh(classes.join(" "), `${plan.meshTransform};animation-duration:${plate.durationSeconds}s`);
    b.append(system, mesh); b.append(mesh, b.leaf(plate.leaf));
  }
  const ringShadow = b.mesh(`${namespace}-ring-shadow`, plan.meshTransform);
  b.append(system, ringShadow); b.append(ringShadow, b.leaf(plan.ringShadowPlane));
  for (const group of plan.ringPointGroups) {
    const classes = [...(group.animated ? [`${namespace}-ring-orbit`] : []), `${namespace}-ring-${group.pointMode}`,
      ...(group.compositeMode === "flat" ? [`${namespace}-ring-flat`] : [])];
    const mesh = b.mesh(classes.join(" "), group.animated ? `${plan.meshTransform};animation-duration:${group.durationSeconds}s` : plan.meshTransform);
    b.append(system, mesh);
    for (const leaf of group.leaves) b.append(mesh, b.element("b", null, leaf.style));
  }
  const carriers = new Map<string,PreparedNode>();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(leaf => leaf.className?.includes(`${namespace}-polar`));
    const key = `${polar ? "polar" : "body"}:${band.visualRotationSeconds}`;
    if (!carriers.has(key)) {
      const carrier = b.mesh(polar ? `${namespace}-body ${namespace}-body-polar` : `${namespace}-body`, `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
      b.append(system, carrier); carriers.set(key, carrier);
    }
    for (const leaf of band.leaves) b.append(carriers.get(key)!, leaf.tag === "s" ? b.leaf(leaf) : b.element(requireString(leaf.tag), null, leaf.style));
  }
  const cutaway = b.mesh(`${namespace}-cutaway`);
  cutaway.style.display = "none";
  b.append(system, cutaway);
  for (const band of plan.interior.outerBodyBands) {
    if (!band.leaves.length) continue;
    const polar = band.leaves.some(leaf => leaf.className?.includes(`${namespace}-cutaway-outer-pole`));
    const mesh = b.mesh(polar ? `${namespace}-body ${namespace}-cutaway-body ${namespace}-cutaway-polar-band` : `${namespace}-body ${namespace}-cutaway-body`, plan.meshTransform);
    b.append(cutaway, mesh); for (const leaf of band.leaves) b.append(mesh, b.leaf(leaf));
  }
  for (const shell of plan.interior.shells) {
    const mesh = b.mesh(`${namespace}-interior-shell ${shell.className}`, plan.meshTransform); b.append(cutaway, mesh);
    for (const leaf of shell.leaves) b.append(mesh, b.leaf(leaf, layouts.classes[shell.className]));
  }
  const sections = b.mesh(`${namespace}-interior-sections`, plan.meshTransform); b.append(cutaway, sections);
  for (const leaf of plan.interior.sectionLeaves) b.append(sections, b.leaf(leaf));
  const materialMesh = b.mesh(`${namespace}-fixed-material`, plan.fixedMaterialPlane.transform);
  const materialCounter = b.mesh(`${namespace}-fixed-material-counter`), materialSystem = b.mesh(`${namespace}-system`, plan.systemTransform);
  const exteriorLeaf = b.leaf(plan.fixedMaterialPlane.leaf), interiorLeaf = b.leaf(plan.interior.atmosphere.leaf);
  for (const leaf of [exteriorLeaf, interiorLeaf]) {
    for (const name of ["background-image", "background-position", "background-size"]) leaf.style.removeProperty(name);
  }
  exteriorLeaf.className = [exteriorLeaf.className, `${namespace}-exterior-material`].filter(Boolean).join(" ");
  interiorLeaf.className = [...new Set([...(interiorLeaf.className ?? "").split(/\s+/).filter(Boolean), `${namespace}-interior-material`])].join(" ");
  interiorLeaf.style.backgroundImage = "none";
  b.append(scene, materialSystem); b.append(materialSystem, materialCounter); b.append(materialCounter, materialMesh); b.append(materialMesh, exteriorLeaf, interiorLeaf);
  const { tree, index } = b.finish({ camera: cameraNode, scene });
  const shape = plan.fixedMaterialPlane.interactionProjection, width = shape.textureSize, height = width;
  const projection = { equatorialRadius: shape.equatorialRadius * shape.tileSize, polarRadius: shape.polarRadius * shape.tileSize,
    // Preserve the original native CSSOM read without a per-frame DOM parse.
    // Chromium ParsePositiveDouble: css_parser_fast_paths.cc at fbbe8214de267f516d9bb96a2b46446e07876218.
    ...config.counterSerialization,
    coverageScale: shape.coverageScale, bodySystemMatrix: prepareTransform(system.style.transform), bodyMeshMatrix: prepareTransform([...carriers.values()][0].style.transform),
    materialSystemMatrix: prepareTransform(materialSystem.style.transform), materialMeshMatrix: prepareTransform(materialMesh.style.transform),
    baseProjection: prepareTransform(exteriorLeaf.style.transform),
    centerTranslation: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, width / 2, height / 2, 0, 1],
    inverseCenterTranslation: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -width / 2, -height / 2, 0, 1] };
  const orbit = plan.preparedLighting.orbitAtlas;
  const defaultFrame = Math.round(Math.max(0, Math.min(orbit.frameCount - 1,
    (orbit.maximumScenePitchDegrees - camera.initialScenePitchDegrees) / (orbit.maximumScenePitchDegrees - orbit.minimumScenePitchDegrees) * (orbit.frameCount - 1))));
  const frame = { source: "reference-sun-z", minimum: 0, maximum: 2, count: orbit.frameCount, baseFrame: defaultFrame, remap: null };
  const track = (id:string, target:PreparedNode, atlas:ReturnType<typeof parseLayeredAtlas>, interior:boolean):MaterialSourceTrack => ({ id, target: index(target), frame,
    banks: Object.entries(atlas.variants).filter(([name]) => !interior || name === "normal" || name.startsWith("normal-")).map(([name, variant]) => {
      const resource = `${interior ? "interior-material" : "exterior"}:${name}`;
      const rows = rowBanks.get(resource);
      if (!rows) throw new Error(`Layered material rows are missing: ${resource}`);
      const frames = Array.from({ length: frame.count }, (_, index) => ({ ...rows.frames[interior
          ? Math.round(index / (frame.count - 1) * (plan.interior.atmosphere.frameCount - 1)) : index], frame: index }));
      return { id: name, rows: rows.rows.map(row => ({ ...row,
        firstFrame: frames.findIndex(p => p.row === row.row), lastFrame: frames.findLastIndex(p => p.row === row.row) })),
        frames,
        default: null, fixed: null };
    }),
    demand: { capacity: 2, defaultFrame },
    rotation: { kind: "ellipsoid", source: "view-sun", reference: "initial", baseDegrees: 0, zeroAtPole: false, polePolicy: "azimuth",
      width, height, projection, systemTransform: materialSystem.style.transform, onlyWhenEnabled: true },
    frameAttribute: null, modeAttribute: null, quoted: true });
  const variants = lenses.controls.flatMap(lens => [false, true].flatMap(rings => [false, true].map(shadows => {
    const interiorView = lens.view === "interior", content = interiorView ? normal : lens;
    const mode = !rings ? shadows ? "ringless" : "ringless-no-shadows" : shadows ? "full" : "no-shadows";
    const material = mode === "full" ? lens.materialLens : `${lens.materialLens}-${mode}`;
    return { when: { lensId: lens.id, rings, shadows }, required: [...lensAssets(content).map(entry => entry.key), ...(interiorView ? interior.map(entry => entry.key) : [])],
      writes: [{ kind: "style", target: index(cutaway), name: "display", value: interiorView ? "block" : "none" },
        { kind: "attribute", target: -1, name: "data-view", value: interiorView ? "interior" : null },
        { kind: "attribute", target: -1, name: "data-lens", value: interiorView || lens.id === lenses.defaultLens ? null : lens.id },
        { kind: "class", target: -1, name: `${namespace}-hide-rings`, value: !rings },
        { kind: "class", target: -1, name: `${namespace}-hide-shadows`, value: !shadows }],
      materials: [{ track: "exterior", bank: material, mode: "frames", enabled: true, rotationEnabled: true, frameOverride: null, clearWhenHidden: false, fixedMode: "fixed" },
        { track: "interior", bank: interiorView ? material : "normal", mode: "frames", enabled: interiorView, rotationEnabled: true, frameOverride: null, clearWhenHidden: true, fixedMode: "fixed" }] };
  })));
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera, sky, sun, assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: 8, concurrency: 8 }),
      preparedResourcePool("interior", entries, { retention: "selection", decoding: "sync" }),
      ...["exterior-material", "interior-material"].map(id => preparedResourcePool(id, entries, { retention: "selection", decoding: "sync", capacity: 2, concurrency: 2 }))],
      startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key)] },
    tree, variants, materials: [track("exterior", exteriorLeaf, exteriorAtlas, false), track("interior", interiorLeaf, interiorAtlas, true)],
    viewBindings: [{ kind: "counter-rotation", target: index(materialCounter), systemTransform: materialSystem.style.transform }], animations: [] };
}
