import type { MaterialSourceTrack, prepareCubicSky, prepareDirectionalSun, PreparedNode } from '../../../presentation/index.ts';
import {parse} from '@cssearth/core/schema';
import { layeredPresentationRecipe } from './presentation-recipe.ts';
import { parseLayeredDatasets, parseLayeredAtlas } from './presentation-source.ts';
import { prepareAtlasRows, prepareAtlasStill } from './atlas-rows.ts';
import { requireString, multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4 } from '@cssearth/core';
import type {createLayeredOblatePreparation} from './layered-oblate.ts';
import type {prepareLayeredLeafLayouts} from './leaf-layouts.ts';
import type {prepareCutawayMaterials} from './cutaway-materials.ts';
type LayeredScene = Awaited<ReturnType<Awaited<ReturnType<typeof createLayeredOblatePreparation>>['prepareLayeredScene']>>['runtimeScene'];

import { canonicalPreparedAsset, preparedResourcePool, PREPARED_PRESENTATION_SCHEMA } from '@cssearth/objects';
import sharp from 'sharp';
import { basename, resolve } from 'node:path';

/** The ring image is also published at these widths, smallest first: an arrival waits for the rings, and at 4 Mbps the
 * 4096-pixel image (5.3 MB) held the flight from Earth to Saturn for 15.3 s (2026-10-02). */
const RING_LEVEL_WIDTHS = [1024, 2048] as const;
/** The share of a threshold a silhouette must cross back before the level changes again: the raster pages' value. */
const RING_LEVEL_HYSTERESIS = 0.2;
/** Ring texels per CSS pixel a level must still give: the canonical @2x density. */
const RING_TEXELS_PER_CSS_PIXEL = 2;
import { prepareCssomDeclarationReads, createPreparedNodeTree } from "../../../presentation/index.ts";

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

export async function prepareLayeredOblatePresentation({publicDirectory,config:input,plan,layouts,datasets:datasetInput,views,sky,sun}: {publicDirectory:string;config:unknown;plan:LayeredScene;layouts:ReturnType<typeof prepareLayeredLeafLayouts>;datasets:unknown;views:Awaited<ReturnType<typeof prepareCutawayMaterials>>;sky:Awaited<ReturnType<typeof prepareCubicSky>>;sun:Awaited<ReturnType<typeof prepareDirectionalSun>>}) {
  const config=parse(input,layeredPresentationRecipe,'layered presentation recipe'),datasets=parseLayeredDatasets(datasetInput);
  const {namespace,camera}=config;
  const exteriorAtlas = parseLayeredAtlas(plan.preparedLighting.orbitAtlas.runtimeShards), interiorAtlas = parseLayeredAtlas(plan.interior.atmosphere.runtimeShards);
  // The cutaway is parked (no interior dataset): the scene then carries no cutaway nodes, interior material or assets.
  const cutawayShown = datasets.controls.some(dataset => dataset.view === "interior");
  const exteriorDatasets = datasets.controls.filter(dataset => dataset.view !== "interior"), normal = exteriorDatasets.find(dataset => dataset.id === datasets.defaultDataset);
  if (!normal) throw new Error('Layered presentation has no default exterior dataset.');
  const datasetAssets = (dataset:ReturnType<typeof parseLayeredDatasets>['controls'][number]) => [
    { key: `surface:${dataset.id}`, url: canonicalPreparedAsset(requireString(dataset.surfaceUrl), dataset.surface2xUrl) },
    { key: `poles:${dataset.id}`, url: requireString(dataset.polesUrl) },
    { key: `rings:${dataset.id}`, url: canonicalPreparedAsset(requireString(dataset.ringUrl), dataset.ring2xUrl) },
    ...(dataset.id !== datasets.defaultDataset && views.assets.outerPoles[dataset.id]
      ? [{ key: `outer-poles:${dataset.id}`, url: canonicalPreparedAsset(views.assets.outerPoles[dataset.id]) }] : []),
  ];
  const interior = !cutawayShown ? [] : [...Object.entries(views.interiorDatasets.normal.assets).map(([name, asset]) => ({ key: `interior:${name}`, url: canonicalPreparedAsset(asset), pool: "interior" })),
    { key: "interior:outer-poles", url: canonicalPreparedAsset(views.assets.outerPoles.normal), pool: "interior" }];
  const rowBanks = new Map<string,Awaited<ReturnType<typeof prepareAtlasRows>> & {pool:string}>();
  const stills = new Map<string,Awaited<ReturnType<typeof prepareAtlasStill>> & {pool:string}>();
  // A material leaf's box is one tile of its atlas (below); every frame is addressed at the atlas's own pixels, and the
  // factor the recipe drew a tile at is kept to scale the box back up in its matrix.
  const tileScales = new Map<string, number>();
  const tileScale = (pool: string, scale: number) => {
    if ((tileScales.get(pool) ?? scale) !== scale) throw new Error(`Layered ${pool} atlases draw their tiles at different scales.`);
    tileScales.set(pool, scale);
  };
  for (const [pool, atlas, prefix] of [["exterior-material", exteriorAtlas, "exterior"], ...(cutawayShown ? [["interior-material", interiorAtlas, "interior-material"]] as const : [])] as const) {
    for (const [name, variant] of Object.entries(atlas.variants)) {
      if (pool === "interior-material" && name !== "normal" && !name.startsWith("normal-")) continue;
      const resource = `${prefix}:${name}`;
      // Shadows off lights the body from the viewer (flood lighting), so a shadowless bank shows one frame: its last, full
      // phase, the frame the default view shows. It ships alone and its rows are never published.
      if (name.endsWith("-no-shadows")) {
        const frame = Math.max(...variant.presentations.map(p => p.frameIndex));
        const still = await prepareAtlasStill({ variant, resource, publicDirectory, frame, native: true });
        tileScale(pool, still.presentationScale); stills.set(resource, { ...still, pool });
        continue;
      }
      const rows = await prepareAtlasRows({ variant, resource, publicDirectory, native: true });
      tileScale(pool, rows.presentationScale);
      rowBanks.set(resource, { ...rows, pool });
    }
  }
  // Each ring image reduced to the level widths, drawn once per file: the datasets share one ring image.
  const ringLevelUrls = new Map<string, string[]>();
  for (const dataset of exteriorDatasets) {
    const url = canonicalPreparedAsset(requireString(dataset.ringUrl), dataset.ring2xUrl);
    if (ringLevelUrls.has(url)) continue;
    const file = resolve(publicDirectory, basename(url)), { width } = await sharp(file).metadata();
    if (!width || RING_LEVEL_WIDTHS.some(level => level >= width)) throw new Error(`Layered ring image ${url} is ${width} pixels wide; its levels are ${RING_LEVEL_WIDTHS.join(' and ')}.`);
    ringLevelUrls.set(url, await Promise.all(RING_LEVEL_WIDTHS.map(async level => {
      const name = basename(url).replace(/(?:@2x)?\.webp$/u, `-level-${level}.webp`);
      await sharp(file).resize(level, level).webp({ lossless: true, effort: 6 }).toFile(resolve(publicDirectory, name));
      return url.slice(0, url.length - basename(url).length) + name;
    })));
  }
  const ringKeys = exteriorDatasets.map(dataset => `rings:${dataset.id}`);
  const ringLevelEntries = exteriorDatasets.flatMap(dataset => ringLevelUrls.get(canonicalPreparedAsset(requireString(dataset.ringUrl), dataset.ring2xUrl))!
    .map((url, level) => ({ key: `rings:${dataset.id}:level:${RING_LEVEL_WIDTHS[level]}`, url, pool: "rings" })));
  const entries = [
    { key: "ring-shadow", url: `/scenes/${namespace}/${namespace}-ring-shadow.webp`, pool: "warm" },
    ...interior,
    ...exteriorDatasets.flatMap(dataset => datasetAssets(dataset).map(entry => ({ ...entry, pool: ringKeys.includes(entry.key) ? "rings" : dataset.id === datasets.defaultDataset ? "warm" : "datasets" }))),
    ...ringLevelEntries,
    ...[...rowBanks.values()].flatMap(({ entries, pool }) => entries.map(entry => ({ ...entry, pool }))),
    ...[...stills.values()].map(({ entry, pool }) => ({ ...entry, pool })),
  ];
  const leaves = [plan.ringPlane, plan.ringShadowPlane,
    ...plan.bodyBands.flatMap(band => band.leaves), ...!cutawayShown ? [] : [...plan.interior.outerBodyBands.flatMap(band => band.leaves),
      ...plan.interior.shells.flatMap(shell => shell.leaves), ...plan.interior.sectionLeaves, plan.interior.atmosphere.leaf],
    plan.fixedMaterialPlane.leaf];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(leaves.map(leaf => leaf.style)) });
  const cameraNode = b.element("div", "polycss-camera object-render-root", plan.camera.style);
  const scene = b.element("div", "polycss-scene", plan.camera.sceneStyle, { "aria-hidden": "true" });
  const system = b.mesh(`${namespace}-system`, plan.systemTransform);
  b.append(null, cameraNode); b.append(cameraNode, scene); b.append(scene, system);
  const ring = b.mesh(`${namespace}-ring-orbit ${namespace}-ring-plane`, plan.meshTransform);
  const ringLeaf = b.leaf(plan.ringPlane);
  // The ring image is a texture the levels swap by the silhouette's size; each variant writes its dataset's.
  ringLeaf.style.backgroundImage = `var(--${namespace}-rings)`;
  b.append(system, ring); b.append(ring, ringLeaf);
  const ringShadow = b.mesh(`${namespace}-ring-shadow`, plan.meshTransform);
  b.append(system, ringShadow); b.append(ringShadow, b.leaf(plan.ringShadowPlane));
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
  const cutaway = cutawayShown ? b.mesh(`${namespace}-cutaway`) : null;
  if (cutaway) { cutaway.style.display = "none"; b.append(system, cutaway); }
  if (cutaway) for (const band of plan.interior.outerBodyBands) {
    if (!band.leaves.length) continue;
    const polar = band.leaves.some(leaf => leaf.className?.includes(`${namespace}-cutaway-outer-pole`));
    const mesh = b.mesh(polar ? `${namespace}-body ${namespace}-cutaway-body ${namespace}-cutaway-polar-band` : `${namespace}-body ${namespace}-cutaway-body`, plan.meshTransform);
    b.append(cutaway, mesh); for (const leaf of band.leaves) b.append(mesh, b.leaf(leaf));
  }
  if (cutaway) {
    for (const shell of plan.interior.shells) {
      const mesh = b.mesh(`${namespace}-interior-shell ${shell.className}`, plan.meshTransform); b.append(cutaway, mesh);
      for (const leaf of shell.leaves) b.append(mesh, b.leaf(leaf, layouts.classes[shell.className]));
    }
    const sections = b.mesh(`${namespace}-interior-sections`, plan.meshTransform); b.append(cutaway, sections);
    for (const leaf of plan.interior.sectionLeaves) b.append(sections, b.leaf(leaf));
  }
  const materialMesh = b.mesh(`${namespace}-fixed-material`, plan.fixedMaterialPlane.transform);
  const materialCounter = b.mesh(`${namespace}-fixed-material-counter`), materialSystem = b.mesh(`${namespace}-system`, plan.systemTransform);
  const exteriorLeaf = b.leaf(plan.fixedMaterialPlane.leaf), interiorLeaf = cutaway ? b.leaf(plan.interior.atmosphere.leaf) : null;
  // A browser backs a layer at its box: Saturn's lighting drew a 256 px tile in a 1,024 px box, 36 MB at DPR 3. Each leaf's
  // box is now its tile and its matrix scales the tile back up, so every texel lands where it did (base · S = the old
  // placement of the enlarged box) and the runtime fit (prepared-ellipsoid-projection.ts) maps the same ellipse.
  const tileBox = new Map<PreparedNode, number>();
  for (const [leaf, pool] of [[exteriorLeaf, "exterior-material"], ...(interiorLeaf ? [[interiorLeaf, "interior-material"]] as const : [])] as const) {
    for (const name of ["background-image", "background-position", "background-size"]) leaf.style.removeProperty(name);
    const scale = tileScales.get(pool) ?? 1, size = plan.fixedMaterialPlane.interactionProjection.textureSize / scale;
    if (!Number.isFinite(size) || size <= 0) throw new Error(`Layered ${pool} tile box is invalid.`);
    leaf.style.setProperty("--polycss-atlas-width", `${size}px`); leaf.style.setProperty("--polycss-atlas-height", `${size}px`);
    leaf.style.transform = `matrix3d(${multiplyPreparedMatrix4(prepareTransform(leaf.style.transform), [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).join(",")})`;
    tileBox.set(leaf, size);
  }
  exteriorLeaf.className = [exteriorLeaf.className, `${namespace}-exterior-material`].filter(Boolean).join(" ");
  if (interiorLeaf) {
    interiorLeaf.className = [...new Set([...(interiorLeaf.className ?? "").split(/\s+/).filter(Boolean), `${namespace}-interior-material`])].join(" ");
    interiorLeaf.style.backgroundImage = "none";
  }
  b.append(scene, materialSystem); b.append(materialSystem, materialCounter); b.append(materialCounter, materialMesh); b.append(materialMesh, exteriorLeaf, ...interiorLeaf ? [interiorLeaf] : []);
  const { tree, index } = b.finish({ camera: cameraNode, scene });
  const shape = plan.fixedMaterialPlane.interactionProjection;
  // Each material leaf is fitted in its own box, from its own (tile-scaled) matrix.
  const projectionFor = (leaf: PreparedNode, size: number) => ({ equatorialRadius: shape.equatorialRadius * shape.tileSize, polarRadius: shape.polarRadius * shape.tileSize,
    // Preserve the original native CSSOM read without a per-frame DOM parse.
    // Chromium ParsePositiveDouble: css_parser_fast_paths.cc at fbbe8214de267f516d9bb96a2b46446e07876218.
    ...config.counterSerialization,
    coverageScale: shape.coverageScale, bodySystemMatrix: prepareTransform(system.style.transform), bodyMeshMatrix: prepareTransform([...carriers.values()][0].style.transform),
    materialSystemMatrix: prepareTransform(materialSystem.style.transform), materialMeshMatrix: prepareTransform(materialMesh.style.transform),
    baseProjection: prepareTransform(leaf.style.transform),
    centerTranslation: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, size / 2, size / 2, 0, 1],
    inverseCenterTranslation: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -size / 2, -size / 2, 0, 1] });
  const orbit = plan.preparedLighting.orbitAtlas;
  const defaultFrame = Math.round(Math.max(0, Math.min(orbit.frameCount - 1,
    (orbit.maximumScenePitchDegrees - camera.initialScenePitchDegrees) / (orbit.maximumScenePitchDegrees - orbit.minimumScenePitchDegrees) * (orbit.frameCount - 1))));
  const frame = { source: "reference-sun-z", minimum: 0, maximum: 2, count: orbit.frameCount, baseFrame: defaultFrame, remap: null };
  const track = (id:string, target:PreparedNode, atlas:ReturnType<typeof parseLayeredAtlas>, interior:boolean):MaterialSourceTrack => ({ id, target: index(target), frame,
    banks: Object.entries(atlas.variants).filter(([name]) => !interior || name === "normal" || name.startsWith("normal-")).map(([name, variant]) => {
      const resource = `${interior ? "interior-material" : "exterior"}:${name}`;
      const still = stills.get(resource);
      if (still) return { id: name, frames: [], default: null, fixed: still.fixed };
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
      width: tileBox.get(target)!, height: tileBox.get(target)!, projection: projectionFor(target, tileBox.get(target)!), systemTransform: materialSystem.style.transform, onlyWhenEnabled: true },
    frameAttribute: null, modeAttribute: null, quoted: true });
  const variants = datasets.controls.flatMap(dataset => [false, true].flatMap(rings => [false, true].map(shadows => {
    const interiorView = dataset.view === "interior", content = interiorView ? normal : dataset;
    const mode = !rings ? shadows ? "ringless" : "ringless-no-shadows" : shadows ? "full" : "no-shadows";
    const material = mode === "full" ? dataset.materialDataset : `${dataset.materialDataset}-${mode}`;
    return { when: { datasetId: dataset.id, rings, shadows }, required: [...datasetAssets(content).map(entry => entry.key), ...(interiorView ? interior.map(entry => entry.key) : [])],
      writes: [...cutaway ? [{ kind: "style", target: index(cutaway), name: "display", value: interiorView ? "block" : "none" }] : [],
        { kind: "attribute", target: -1, name: "data-view", value: interiorView ? "interior" : null },
        { kind: "attribute", target: -1, name: "data-dataset", value: interiorView || dataset.id === datasets.defaultDataset ? null : dataset.id },
        { kind: "texture", target: index(ring), name: `--${namespace}-rings`, resource: `rings:${content.id}`, quoted: true },
        { kind: "class", target: -1, name: `${namespace}-hide-rings`, value: !rings },
        { kind: "class", target: -1, name: `${namespace}-hide-shadows`, value: !shadows }],
      materials: [{ track: "exterior", bank: material, mode: shadows ? "frames" : "fixed", enabled: true, rotationEnabled: true, frameOverride: null, clearWhenHidden: false, fixedMode: "fixed" },
        ...cutaway ? [{ track: "interior", bank: interiorView ? material : "normal", mode: interiorView && !shadows ? "fixed" as const : "frames" as const, enabled: interiorView, rotationEnabled: true, frameOverride: null, clearWhenHidden: true, fixedMode: "fixed" }] : []] };
  })));
  // The ring image's side over the body's diameter, both in scene units: its texels span that many silhouette diameters.
  const ringStyle = String(plan.ringPlane.style);
  const ringMatrix = prepareTransform(/(?:^|;)transform:(matrix3d\([^)]*\))/u.exec(ringStyle)?.[1]), ringBox = Number.parseFloat(/--polycss-atlas-width:([\d.]+)px/u.exec(ringStyle)?.[1] ?? '');
  const ringSpan = ringBox * Math.hypot(ringMatrix[0]!, ringMatrix[1]!, ringMatrix[2]!) / (2 * shape.equatorialRadius * shape.tileSize);
  if (!(ringSpan > 1)) throw new Error(`Layered ring plane spans ${ringSpan} body diameters.`);
  // A level of width w gives the canonical density while w ≥ density · span · D, so the next is chosen from D = w / (density · span).
  const textureLevels = { hysteresis: RING_LEVEL_HYSTERESIS, levels: [...RING_LEVEL_WIDTHS, null].map((width, level) => ({
    minimumDiameter: level === 0 ? 0 : RING_LEVEL_WIDTHS[level - 1]! / (RING_TEXELS_PER_CSS_PIXEL * ringSpan),
    resources: Object.fromEntries(ringKeys.map(key => [key, width === null ? key : `${key}:level:${width}`])) })) };
  const firstLevel = textureLevels.levels[0]!.resources;
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera, sky, sun, textureLevels, assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("rings", entries, { retention: "selection", decoding: "sync", capacity: 2, concurrency: 2 }),
      preparedResourcePool("datasets", entries, { retention: "selection", decoding: "sync", capacity: 8, concurrency: 8 }),
      ...cutawayShown ? [preparedResourcePool("interior", entries, { retention: "selection", decoding: "sync" })] : [],
      ...["exterior-material", ...cutawayShown ? ["interior-material"] : []].map(id => preparedResourcePool(id, entries, { retention: "selection", decoding: "sync", capacity: 2, concurrency: 2 }))],
      startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key), firstLevel[`rings:${normal.id}`]!] },
    tree, variants, materials: [track("exterior", exteriorLeaf, exteriorAtlas, false), ...interiorLeaf ? [track("interior", interiorLeaf, interiorAtlas, true)] : []],
    viewBindings: [{ kind: "counter-rotation", target: index(materialCounter), systemTransform: materialSystem.style.transform }], animations: [] };
}
