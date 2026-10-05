import { type PreparedWrite, type PreparedSelectionNavigation, type PreparedVariant, type PreparedViewBinding, type PreparedPresentationDefinition, type PreparedTextureLevels, type PreparedTextureTile } from '@cssearth/objects';

import { writeStyle as writeRetainedStyle } from './retained-write.js';
import { createPreparedInteriorDisc } from './prepared-interior-disc.js';

import { buildPreparedTree, type PreparedTreeLease } from './prepared-tree.js';
import { bindPreparedSurfaceHit } from '../navigation/prepared-surface-hit.js';

import { createPreparedDepthPartitions } from './prepared-depth-partitions.js';

import type { ObjectSelection } from "../runtime/object-contract.js";
import type { PreparedMaterialDemand } from './prepared-material.js';

import type { PreparedResources, PreparedResourceDemand } from './prepared-residency.js';

import type { PreparedAnimationOptions } from "./prepared-playback.js";
import { readPreparedStyle, writePreparedStyle, samePreparedStyle } from "./style-access.js";
import { createTextureTileWriter, preparedTextureSizes, selectPreparedTextureLevel, unseenTextureWrites } from './prepared-texture-levels.js';

import { createLeafBoxBlocks } from './prepared-leaf-box-blocks.js';
import { createLeafBoxWriter, SEAM_OUTSET } from './prepared-leaf-box-direct.js';
import { hiddenSubtreeRoots, omittedPreparedNodes } from './prepared-omitted-nodes.js';
import { createSettlePacer } from './settle-pacer.js';
import { keepLayers } from './kept-layers.js';
import type { CameraMotionSignal } from '../navigation/camera-motion-signal.js';
import { activeResourceFallbacks } from './prepared-resource-fallbacks.js';
import { preparedDatasetPending } from '../prepared-data/dataset-tables.js';
import { selectPreparedSilhouetteStep } from './prepared-silhouette-steps.js';

export type PreparedSelection = ObjectSelection;
export interface PreparedView {
  readonly projection: import('../prepared-data/physical-projection.js').PhysicalProjection;
  revision?: number; controlPitch: number; controlYaw: number; zoom: number; sceneMatrix: string;
  sunViewDirection: readonly number[] | null; reference?: { sceneMatrix: string; sunViewDirection: readonly number[] | null };
  counterRotation: string; counterRotationFor(systemTransform: string | DOMMatrix | null): string;
  levelOfDetail: { stage: string; silhouetteDiameter: number | null; billboardOpacity: number; markerOpacity: number };
  body: { visible: boolean; screen?: readonly number[] | null; silhouette?: { radial: readonly number[]; centre: readonly number[]; radialSemiAxis: number; tangentialSemiAxis: number } | null };
  /** The camera root's principal point, and the stage's: the root moves to centre the body in the area the shell leaves
   * open, so the two differ by that move. */
  principalOffset: readonly number[];
  stageViewport: { readonly principalOffsetPixels: readonly number[] };
  viewportWidth?: number; viewportHeight?: number;
  /** Every motion animation is paused at its prepared start, where the prepared texture placements hold. */
  motionAtRest?: boolean;
}

export interface PreparedPresentationPlan extends PreparedResourceDemand { required: string[]; prewarm: string[]; materials: Record<string, PreparedMaterialDemand>; pressedDatasets: (string | null)[]; navigation?: PreparedSelectionNavigation; textureLevel?: number; textureResources?: Readonly<Record<string, string>>; textureTiles?: Readonly<Record<string, PreparedTextureTile>>;
  /** The mesh is not drawn at this level of detail: its textures only warm. */
  deferredTextures?: boolean; }
export interface PreparedPresentationContext { own(cleanup: () => void): unknown; registerAnimation(animation: Animation, options: PreparedAnimationOptions): unknown; seekAnimation(animation: Animation, time: number): void; }
export interface PreparedFramePublication { selection: ObjectSelection; view: PreparedView; resources: Pick<PreparedResources, "has" | "url">; }

import { createPreparedMaterialPublisher } from "./prepared-material.js";
import { prepareConnectedActivation } from './prepared-activation.js';
import { prepareTextureActivation } from './prepared-texture-activation.js';
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.js";

const matches = (variant: PreparedVariant, selection: ObjectSelection) => Object.entries(variant.when).every(([name, value]) => selection[name] === value);
export function selectedPreparedVariant(definition: PreparedPresentationDefinition, selection: ObjectSelection) {
  if (preparedDatasetPending(definition, selection)) throw new TypeError(`The tables of dataset ${String(selection.datasetId)} have not arrived.`);
  const variant = definition.variants.find(variant => matches(variant, selection));
  if (!variant) throw new TypeError("The selected presentation was not prepared.");
  return variant;
}
// A presentation resolves every frame the camera moves; these depend only on the definition and the level, so they are
// built once and shared (nothing writes to a resolved map).
/** What a leaf taking another texture level costs the pacer, in its units: it is painted again. */
const LEVEL_LEAF_UNITS = 2;
const NO_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({});
const pageFallbacks = new WeakMap<object, Readonly<Record<string, string>>>();
const fallbacksFor = (fallbacks: Parameters<typeof activeResourceFallbacks>[0]) => {
  if (!fallbacks) return NO_FALLBACKS;
  let map = pageFallbacks.get(fallbacks);
  if (!map) pageFallbacks.set(fallbacks, map = activeResourceFallbacks(fallbacks));
  return map;
};
const resolvedLevels = new WeakMap<object, WeakMap<object, Readonly<Record<string, string>>>>();
/** A level's texture resources with this browser's fallbacks applied: one map per level and fallback set. */
function textureResourcesFor(levelResources: Readonly<Record<string, string>> | undefined, fallback: Readonly<Record<string, string>>) {
  if (levelResources === undefined && !Object.keys(fallback).length) return undefined;
  const key = levelResources ?? NO_FALLBACKS;
  let byFallback = resolvedLevels.get(key);
  if (!byFallback) resolvedLevels.set(key, byFallback = new WeakMap());
  let resolved = byFallback.get(fallback);
  if (!resolved) byFallback.set(fallback, resolved = { ...fallback, ...Object.fromEntries(Object.entries(levelResources ?? {}).map(([name, level]) => [name, fallback[level] ?? level])) });
  return resolved;
}

export function resolvePreparedPresentation(definition: PreparedPresentationDefinition, { selection, view, previousPlan }: { selection: ObjectSelection; view: import('./prepared-material.js').PreparedMaterialView | null; previousPlan?: PreparedPresentationPlan | null }): PreparedPresentationPlan {
  const variant = selectedPreparedVariant(definition, selection);
  // A body first draws its first level on every screen, then follows its silhouette: one start for a phone, a tablet
  // and a desktop. Chosen by size from the first plan, a 1280 px window waited for Earth's 80 images before it showed
  // the body (775 to 841 ms) where a phone waited for 4; from the first level both show it on 4 to 8 (369 to 413 ms)
  // and the larger window sharpens about 0.7 s later (2026-10-02).
  const textureLevel = !definition.textureLevels ? undefined : previousPlan == null && definition.textureLevels.fixedLevel === undefined ? 0
    : selectPreparedTextureLevel(definition.textureLevels, view?.levelOfDetail?.silhouetteDiameter, previousPlan?.textureLevel);
  // A level names the resource each texture reads; a capability fallback then replaces it where this browser needs one.
  const fallback = fallbacksFor(definition.assets?.fallbacks);
  const levelChoice = textureLevel === undefined ? undefined : textureLevelFor(definition.textureLevels!, textureLevel, variant, view);
  const levelResources = levelChoice?.resources, textureTiles = levelChoice?.tiles;
  const textureResources = textureResourcesFor(levelResources, fallback);
  const content = variant.required.map(key => textureResources?.[key] ?? key);
  // An opaque proxy stands for a marker- or billboard-stage body, so its mesh is not drawn
  // (see perspective-dolly.ts). Mounting one there decoded a full surface set
  // for pixels no one sees. Its group is neither required nor warmed until the
  // camera resolves the body, which re-plans and decodes before it appears.
  const deferredTextures = (view?.levelOfDetail?.stage ?? "geometry") !== "geometry";
  const required = new Set(definition.resourceOrder === "materials-first" || deferredTextures ? [] : content);
  const prewarm = new Set<string>(), materials: Record<string, PreparedMaterialDemand> = {};
  for (const selected of variant.materials) {
    if (!view) throw new TypeError('Prepared material demand requires a view.');
    const track = definition.materials.find(track => track.id === selected.track);
    if (!track) throw new TypeError(`Unprepared material track: ${selected.track}.`);
    const resolved = resolvePreparedMaterialDemand(track, selected, view);
    const state = deferredTextures ? { ...resolved, required: [], prewarm: [] } : resolved;
    for (const key of state.required) required.add(key);
    for (const key of state.prewarm) prewarm.add(key);
    materials[track.id] = state;
  }
  if (definition.resourceOrder === "materials-first" && !deferredTextures) for (const key of content) required.add(key);
  return { required: [...required], prewarm: [...prewarm].filter(key => !required.has(key)), materials, pressedDatasets: [selection.datasetId],
    ...(deferredTextures ? { deferredTextures } : {}),
    ...(textureLevel === undefined ? {} : { textureLevel }), ...(textureResources === undefined ? {} : { textureResources }),
    ...(textureTiles && Object.keys(textureTiles).length ? { textureTiles } : {}),
    ...(variant.navigation ? { navigation: variant.navigation } : {}) };
}
/** The texture resources a selection draws at a prepared level, with this browser's fallbacks: the demand a switch to that
 * level makes, so the runtime can read their hash groups ahead of it. */
export function preparedTextureLevelKeys(definition: PreparedPresentationDefinition, selection: ObjectSelection, level: number): string[] {
  const levelResources = definition.textureLevels?.levels[level]?.resources;
  if (!levelResources || preparedDatasetPending(definition, selection)) return [];
  const resources = textureResourcesFor(levelResources, fallbacksFor(definition.assets?.fallbacks))!;
  return selectedPreparedVariant(definition, selection).required.flatMap(key => key in levelResources ? [resources[key]!] : []);
}
// One choice per level and set of kept-back textures: a turn that hides the same faces again reuses it, so the texture map
// it resolves to is reused too (textureResourcesFor).
const levelChoices = new WeakMap<PreparedTextureLevels, Map<string, { resources: Record<string, string>; tiles: Record<string, PreparedTextureTile> }>>();
/** The selected level's resources and sheet tiles, except that a texture whose faces the camera cannot see keeps the first level. */
function textureLevelFor(levels: PreparedTextureLevels, level: number, variant: PreparedVariant, view: import('./prepared-material.js').PreparedMaterialView | null) {
  const { resources, tiles = {} } = levels.levels[level]!;
  if (!levels.placements || level === 0 || !view?.projection || view.motionAtRest !== true || !(view.viewportWidth! > 0) || !(view.viewportHeight! > 0)) return { resources, tiles };
  const unseen = unseenTextureWrites(levels.placements, view.projection, { width: view.viewportWidth!, height: view.viewportHeight! });
  if (!unseen.size) return { resources, tiles };
  const seen = new Set<string>(), hidden = new Set<string>();
  for (const write of variant.writes) if (write.kind === 'texture' && write.resource !== null && write.resource in resources)
    (unseen.has(write.name) ? hidden : seen).add(write.resource);
  const kept = [...hidden].filter(key => !seen.has(key)).sort();
  if (!kept.length) return { resources, tiles };
  let choices = levelChoices.get(levels);
  if (!choices) levelChoices.set(levels, choices = new Map());
  const choiceKey = `${level}:${kept.join('\n')}`, known = choices.get(choiceKey);
  if (known) return known;
  const first = levels.levels[0]!, chosen = { ...resources }, chosenTiles: Record<string, PreparedTextureTile> = { ...tiles };
  for (const key of kept) {
    chosen[key] = first.resources[key]!;
    if (first.tiles?.[key]) chosenTiles[key] = first.tiles[key]; else delete chosenTiles[key];
  }
  const choice = { resources: chosen, tiles: chosenTiles };
  choices.set(choiceKey, choice);
  return choice;
}
const datasetKey = (name: string) => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function readAttribute(element: HTMLElement, name: string) {
  return name.startsWith("data-") ? element.dataset[datasetKey(name)] ?? null : element.getAttribute(name);
}
function writeAttribute(element: HTMLElement, name: string, value: string | null) {
  if (name.startsWith("data-")) {
    if (value === null) delete element.dataset[datasetKey(name)];
    else element.dataset[datasetKey(name)] = value;
  } else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
const styleValue = (element: HTMLElement, name: string) => readPreparedStyle(element.style, name);
function writeStyle(element: HTMLElement, name: string, value: string) {
  writePreparedStyle(element.style, name, value);
}

// No geometry, atlas addressing, band grouping, source conversion, or package
// callbacks enter this builder. The ordered records are final prepared DOM.
export function mountPreparedPresentation(stage: HTMLElement, context: PreparedPresentationContext, definition: PreparedPresentationDefinition, preparedTree?: PreparedTreeLease, initialProjection?: import('../prepared-data/physical-projection.js').PhysicalProjection, progressiveActivation = false, deferConnection = false) {
  const { nodes, roots } = preparedTree ? preparedTree.claim(definition.tree, stage.ownerDocument, context.own)
    : buildPreparedTree(definition.tree, stage.ownerDocument, context.own, stage, definition.assetOrigin,
      new Set(definition.variants.flatMap(variant => [...omittedPreparedNodes(definition.tree, variant)])));
  const cameraElement = nodes[definition.tree.camera], sceneElement = nodes[definition.tree.scene];
  // What a selection hides is not mounted (prepared-omitted-nodes.ts): a body with several shape models mounts only the
  // mesh its dataset draws on, and a hidden subtree (Earth's and Saturn's cutaways) only while a dataset shows it. Their
  // nodes stay built but unattached, and a selection swaps them.
  const detachable = new Map<string, { parent: HTMLElement; leaves: HTMLElement[] }>();
  const meshes = definition.tree.meshes ?? [], meshKey = (name: string) => `mesh:${name}`;
  for (const mesh of meshes) detachable.set(meshKey(mesh.name), { parent: nodes[definition.tree.nodes[mesh.leaves[0]![0]].parent],
    leaves: mesh.leaves.flatMap(([first, count]) => nodes.slice(first, first + count)) });
  const hiddenRoots = new Set(definition.variants.flatMap(variant => [...hiddenSubtreeRoots(variant)]));
  const subtreeKey = (root: number) => `subtree:${root}`;
  for (const root of hiddenRoots) detachable.set(subtreeKey(root), { parent: nodes[root],
    leaves: definition.tree.nodes.flatMap((record, index) => record.parent === root ? [nodes[index]] : []) });
  const mountDetachable = (key: string, on: boolean) => {
    const group = detachable.get(key);
    if (!group) return;
    if (!on) { for (const leaf of group.leaves) leaf.remove(); return; }
    const detached = group.leaves.filter(leaf => !leaf.parentNode);
    if (detached.length) group.parent.append(...detached);
  };
  // A mesh or subtree the server rendered is the one its selection shows; one built here waits for a selection that shows it.
  for (const mesh of meshes) if (!detachable.get(meshKey(mesh.name))!.leaves.some(leaf => leaf.dataset.preparedNode !== undefined)) mountDetachable(meshKey(mesh.name), false);
  for (const root of hiddenRoots) if (!detachable.get(subtreeKey(root))!.leaves.some(leaf => leaf.dataset.preparedNode !== undefined)) mountDetachable(subtreeKey(root), false);
  const owned = () => roots.some(root => root.parentNode === stage);
  const stageBindings = new Map<string, PreparedWrite>();
  for (const variant of definition.variants) for (const binding of variant.writes) {
    if (binding.target === -1) stageBindings.set(`${binding.kind}:${binding.name}`, binding);
  }
  for (const binding of stageBindings.values()) {
    const previous = binding.kind === "attribute" ? readAttribute(stage, binding.name)
      : binding.kind === "class" ? stage.classList.contains(binding.name) : styleValue(stage, binding.name);
    context.own(() => {
      if (!owned()) return;
      if (binding.kind === "attribute") {
        const value = typeof previous === "string" ? previous : null;
        if (readAttribute(stage, binding.name) !== value) writeAttribute(stage, binding.name, value);
      } else if (binding.kind === "class") {
        if (stage.classList.contains(binding.name) !== previous) stage.classList.toggle(binding.name, previous === true);
      } else if (styleValue(stage, binding.name) !== String(previous)) writeStyle(stage, binding.name, String(previous));
    });
  }
  for (const name of definition.tree.stageClasses) {
    const previous = stage.classList.contains(name);
    context.own(() => { if (owned() && stage.classList.contains(name) !== previous) stage.classList.toggle(name, previous); });
  }
  if (progressiveActivation && !definition.tree.activationGroups) throw new TypeError('Flight activation requires prepared groups.');
  const textureBindings = new Map((definition.tree.textureBindings ?? []).map(binding =>
    [`${binding.target}:${binding.name}`, binding.leaves.map(index => nodes[index])] as const));
  const leafIndex = new Map((definition.tree.textureBindings ?? []).flatMap(binding => binding.leaves.map(index => [nodes[index]!, index] as const)));
  const textureSize = preparedTextureSizes(definition);
  const surfaceScenes = [sceneElement, ...(definition.depthPartitions?.groups ?? []).map(group => nodes[group.scene])];
  // A slot may list no element (a carrier the depth partitions emptied): only listed elements make a body textured.
  const textureLeaves = new Set([...textureBindings.values()].flat()), textured = textureLeaves.size > 0;
  const textureActivation = prepareTextureActivation(preparedTree && progressiveActivation && textured
    ? (definition.tree.activationGroups ?? []).map(group => group.map(index => nodes[index])
      .filter(node => textureLeaves.has(node) && surfaceScenes.some(scene => scene.contains(node)))) : [], context.own);
  const activate = textured ? textureActivation.activate : prepareConnectedActivation(preparedTree && progressiveActivation
    ? (definition.tree.activationGroups ?? []).map(group => group.map(index => nodes[index])) : [], context.own,
    // Empty structural anchors can be leaves after preparation partitions the
    // surface. Hit testing and feature binding need their ancestry immediately.
    [definition.surfaceHit?.target, definition.features?.target].flatMap(index => index === undefined ? [] : [nodes[index]]),
    [sceneElement, ...(definition.depthPartitions?.groups ?? []).map(group => nodes[group.scene])]);
  // The same prepared groups let the camera bring a resolving mesh back in stages.
  const revealGroups = Object.freeze((definition.tree.activationGroups ?? []).map(group => Object.freeze(group.map(index => nodes[index]))));
  // Prepared handles below own motion: its clock, pause state and disposal, without forcing live style discovery.
  // Delivered scene CSS carries no motion (site/build/prepared-motion-css.mts); only a server-rendered saved view poses
  // a target with a paused CSS animation of its own (prepared-native-view.ts), which the handles replace.
  for (const plan of [...definition.motion ?? [], ...definition.animations]) {
    const style = nodes[plan.target].style;
    if (style.animation) style.removeProperty('animation');
  }
  const motion = (definition.motion ?? []).map(plan => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, iterations: Infinity, easing: 'linear', fill: 'both' });
    animation.id = plan.id;
    // A light curve (opacity keyframes) plays on its own permission and moves no texel.
    context.registerAnimation(animation, { mode: 'motion', initialTime: 0, ...(plan.keyframes.every(frame => 'opacity' in frame) ? { lightCurve: true } : {}) });
    return { animation, plan, duration: plan.duration };
  });
  // Presentation owns only its prepared roots; application context siblings survive a detail handoff.
  let kept = false;
  const connect = () => {
    for (const root of roots) if (root.parentNode !== stage) stage.appendChild(root);
    if (roots.some(root => root.parentNode !== stage)) throw new Error("Prepared roots must belong to the mounted stage.");
    for (const name of definition.tree.stageClasses) if (!stage.classList.contains(name)) stage.classList.add(name);
    // Faces that leave the screen keep their surfaces (kept-layers.ts).
    if (!kept) { kept = true; context.own(keepLayers(cameraElement, stage.ownerDocument.defaultView)); }
  };
  if (!deferConnection) connect();
  const animations = definition.animations.map(plan => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, easing: "linear", fill: "both" });
    animation.id = plan.id; context.registerAnimation(animation, { mode: plan.mode });
    return { animation, plan };
  });
  const framePublisher = createPreparedFramePublisher(definition, stage, nodes, sceneElement, controlPitch => {
    for (const { animation, plan } of animations) context.seekAnimation(animation,
      Math.max(0, Math.min(plan.duration, (controlPitch - plan.sourceMinimum) * plan.millisecondsPerDegree)));
  }, initialProjection, owned);
  let selectionPublications = 0, styleWrites = 0;
  // Tiled page leaves take their final background placement with every image write (prepared-texture-levels.ts).
  const textureTiles = createTextureTileWriter(definition.textureLevels, nodes, writeStyle);
  let selectedTextures = new Map<string, { target: number; name: string }>();
  const styleKey = (binding: { target: number; name: string }) => `${binding.target}:${binding.name.startsWith("--") ? binding.name : binding.name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
  const target = (index: number) => index === -1 ? stage : nodes[index];
  // A leaf's box follows the image it takes: both land in one write, so the leaf repaints once (prepared-leaf-box-direct.ts).
  const writeLeafTexture = (leaf: HTMLElement, image: string, shown: string | undefined) => {
    textureActivation.write(leaf, image);
    if (shown !== undefined) styleWrites += framePublisher.showLeafImage(leafIndex.get(leaf)!, textureSize(shown));
  };
  function publishStyle(index: number, name: string, value: string, shown?: string) {
    if (name === 'display' && textureActivation.deferDisplay(target(index), value)) return;
    const leaves = textureBindings.get(`${index}:${name}`);
    if (leaves) {
      for (const leaf of leaves) writeLeafTexture(leaf, value, shown);
      styleWrites += leaves.length;
    } else if (!samePreparedStyle(styleValue(target(index), name), name, value)) { writeStyle(target(index), name, value); styleWrites++; }
  }
  type CommittedWrite = Exclude<PreparedWrite, { kind: "texture" }> & { shown?: string } | { kind: "tile"; target: number; name: string; tile: PreparedTextureTile | undefined };
  function publish(binding: CommittedWrite) {
    const element = target(binding.target);
    if (binding.kind === "attribute") { if (readAttribute(element, binding.name) !== binding.value) writeAttribute(element, binding.name, binding.value); }
    else if (binding.kind === "class") { if (element.classList.contains(binding.name) !== binding.value) element.classList.toggle(binding.name, binding.value); }
    else if (binding.kind === "tile") styleWrites += textureTiles.publish(binding.target, binding.name, binding.tile);
    else publishStyle(binding.target, binding.name, binding.value, binding.shown);
  }
  // A texture level swap repaints every leaf whose page changes: Earth's 160 leaves took one 256 ms commit on the iPad
  // (2026-09-30), after the zoom had settled. A level-only commit lands its changed leaves a slice a frame, each leaf
  // with its image and its tile placement, held while the camera moves (settle-pacer.ts); a dataset change still lands
  // whole. A page is split across frames too: the Moon's pages of 96 to 128 leaves, each landing whole, made four frames
  // of 41 to 79 ms after a flight landed there on the iPad (2026-10-04).
  let committedVariant: unknown = null, levelPacer: ReturnType<typeof createSettlePacer> | null = null;
  const pendingLevels = new Map<string, { leaves: readonly HTMLElement[]; done: number; image: string; shown: string | undefined; tile: Extract<CommittedWrite, { kind: "tile" }> | null }>();
  return Object.freeze({ cameraElement, sceneElement, connect, activate, revealGroups,
    ...(definition.surfaceHit ? { surfaceHitTest: bindPreparedSurfaceHit(definition.surfaceHit, nodes[definition.surfaceHit.target], sceneElement, cameraElement, () => stage.dataset.dataset) } : {}),
    ...(definition.motionFrame ? { motionFrame: Object.freeze(definition.motionFrame.map(index => nodes[index])) } : {}),
    ...(definition.features ? { featureTarget: nodes[definition.features.target] } : {}),
    commitSelection({ selection, resources, plan, motion: cameraMotion = null }: { selection: ObjectSelection; resources: PreparedResources; plan?: PreparedPresentationPlan; view?: PreparedView | null; motion?: CameraMotionSignal | null }) {
      const variant = selectedPreparedVariant(definition, selection);
      // A commit of the same dataset only changes texture levels; a new one supersedes any level still waiting.
      const levelOnly = variant === committedVariant;
      committedVariant = variant;
      pendingLevels.clear();
      // Resolve the complete texture group before publishing any part of it.
      const writes = variant.writes.flatMap((binding): CommittedWrite[] => {
        if (binding.kind !== "texture") return [binding];
        const shown = binding.resource === null ? null : plan?.textureResources?.[binding.resource] ?? binding.resource;
        const url = shown === null ? null : resources.url(shown);
        // A deferred (undrawn) mesh publishes no texture at all; the resolving
        // camera re-plans and commits the complete group before it is shown.
        if (binding.resource !== null && !url && !plan?.deferredTextures) throw new Error(`Prepared selection texture is not ready: ${binding.resource}`);
        const image = { kind: "style" as const, target: binding.target, name: binding.name, value: url === null ? "none" : binding.quoted ? `url(${JSON.stringify(url)})` : `url(${url})`,
          ...(shown === null ? {} : { shown }) };
        // A page some level draws from a shared sheet places its leaves on its tile (or on the page itself) with every image.
        if (binding.resource === null || !textureTiles.has(binding.target, binding.name)) return [image];
        return [image, { kind: "tile" as const, target: binding.target, name: binding.name, tile: plan?.textureTiles?.[binding.resource] }];
      });
      // Texture references belong to the committed dataset. Retire references
      // absent from its successor in the same publication, without embedding
      // every inactive dataset's clearing writes in every prepared variant.
      const nextStyles = new Set(writes.filter(binding => binding.kind === "style").map(styleKey));
      // Alternative radial meshes address different atlas layouts. Unmount the
      // outgoing mesh before changing their shared image, then mount the
      // incoming mesh only after the complete dataset has been published.
      // If publication is interrupted, the body fails closed instead of
      // rendering one mesh with another mesh's texel addresses.
      for (const mesh of meshes) if (mesh.name !== variant.mesh) mountDetachable(meshKey(mesh.name), false);
      const hiddenNow = hiddenSubtreeRoots(variant);
      for (const root of hiddenRoots) if (hiddenNow.has(root)) mountDetachable(subtreeKey(root), false);
      for (const [key, binding] of selectedTextures) if (!nextStyles.has(key)) {
        publishStyle(binding.target, binding.name, "none");
      }
      for (let index = 0; index < writes.length; index++) {
        const binding = writes[index]!, leaves = binding.kind === "style" ? textureBindings.get(`${binding.target}:${binding.name}`) : undefined;
        if (!levelOnly || binding.kind !== "style" || !leaves?.some(leaf => leaf.style.backgroundImage !== binding.value)) { publish(binding); continue; }
        // A page's image and its tile placement land together.
        const next = writes[index + 1];
        const tile = next?.kind === "tile" && next.target === binding.target && next.name === binding.name ? next : null;
        if (tile) index++;
        pendingLevels.set(`${binding.target}:${binding.name}`, { leaves, done: 0, image: binding.value, shown: binding.shown, tile });
      }
      if (pendingLevels.size) {
        if (!levelPacer) context.own(() => levelPacer?.destroy());
        levelPacer ??= createSettlePacer((budget, moving) => {
          // What is left of a level waits while the camera moves, like the commit that started it. A drag begun a third
          // of a second after a zoom in on Earth ran into the pages still landing: seven or eight frames of 29 to 54 ms
          // in its first half second on the iPad, and none with the rest held for the next pause (2026-10-05).
          if (moving) return 0;
          let written = 0;
          for (const [key, unit] of pendingLevels) {
            if (written >= budget) break;
            const share = unit.leaves.slice(unit.done, unit.done + Math.max(1, Math.floor((budget - written) / LEVEL_LEAF_UNITS)));
            unit.done += share.length;
            if (unit.tile) styleWrites += textureTiles.publish(unit.tile.target, unit.tile.name, unit.tile.tile, new Set(share));
            for (const leaf of share) writeLeafTexture(leaf, unit.image, unit.shown);
            styleWrites += share.length; written += share.length * LEVEL_LEAF_UNITS;
            if (unit.done < unit.leaves.length) continue;
            pendingLevels.delete(key);
            // A tile leaf the page's binding does not list takes its placement with the page's last slice.
            if (unit.tile) styleWrites += textureTiles.publish(unit.tile.target, unit.tile.name, unit.tile.tile);
          }
          return written;
        }, { motion: cameraMotion });
        levelPacer.request();
      }
      for (const root of hiddenRoots) if (!hiddenNow.has(root)) mountDetachable(subtreeKey(root), true);
      if (variant.mesh !== undefined) mountDetachable(meshKey(variant.mesh), true);
      selectedTextures = new Map(variant.writes.filter(binding => binding.kind === "texture").map(binding => [styleKey(binding), binding]));
      for (const entry of motion) {
        const duration = entry.plan.timings.find(timing => Object.entries(timing.when).every(([name, value]) => selection[name] === value))?.duration ?? entry.plan.duration;
        if (duration !== entry.duration) {
          (entry.animation.effect as KeyframeEffect).updateTiming({ duration });
          entry.duration = duration;
        }
      }
      selectionPublications++;
    },
    publishCamera: framePublisher.publishCamera,
    publishFrame: framePublisher.publish,
    observe() {
      const frame = framePublisher.observe();
      return {
        presentation: { nodes: nodes.length, roots: roots.length, selectionPublications, framePublications: frame.framePublications,
          styleWrites: styleWrites + frame.styleWrites, transformWrites: frame.transformWrites },
        materials: frame.materials,
      };
    },
  });
}

/** Publish the same prepared camera-dependent styles in a browser or a native response. */
export function createPreparedFramePublisher(definition: PreparedPresentationDefinition, stage: HTMLElement,
  nodes: readonly HTMLElement[], sceneElement: HTMLElement, seekPose: (controlPitch: number) => void = () => {},
  initialProjection?: import('../prepared-data/physical-projection.js').PhysicalProjection, connected = () => sceneElement.isConnected) {
  const publishDepth = createPreparedDepthPartitions(definition.depthPartitions, nodes, sceneElement);
  if (initialProjection) publishDepth(initialProjection);
  const materials = new Map(definition.materials.map(track => [track.id,
    createPreparedMaterialPublisher(track, nodes[track.target])]));
  let framePublications = 0, styleWrites = 0, transformWrites = 0;
  const round = (value: number, precision: number | null) => precision === null ? value : Math.round(value * 10 ** precision) / 10 ** precision;
  const formatNumber = (value: number) => Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
  const target = (index: number) => index === -1 ? stage : nodes[index];
  // Hysteresis needs the step each silhouette binding last published.
  const silhouetteSteps = new Map<PreparedViewBinding, number>();
  // A leaf box group's step is written on its own leaves; until then they inherit the binding target's initial step.
  // Leaf boxes receive final values, never their prepared variables (prepared-leaf-box-direct.ts); other step
  // properties keep their plain write.
  const leafBoxes = createLeafBoxWriter(definition.viewBindings, nodes, writeStyle);
  const readStep = (index: number, property: string) => leafBoxes.owns(index, property) ? leafBoxes.read(index, property) : styleValue(target(index), property);
  const writeStep = (index: number, property: string, value: string) => {
    if (leafBoxes.owns(index, property)) styleWrites += leafBoxes.set(index, property, value);
    else { writeStyle(target(index), property, value); styleWrites++; }
  };
  const leafBoxBlocks = new Map(definition.viewBindings.flatMap(binding => binding.kind === "silhouette-step-property" && binding.groups
    ? [[binding as PreparedViewBinding, createLeafBoxBlocks({ ...binding, groups: binding.groups },
      name => readStep(binding.groups![name]![0]!, binding.property) || readStep(binding.target, binding.property),
      (name, value) => { for (const leaf of binding.groups![name]!) writeStep(leaf, binding.property, value); })] as const] : []));
  // A body-wide step property (the surface seam outset) reaches every leaf, so a change restyles the whole mesh: like the
  // leaf-box steps it switches only once the camera has stopped (motion-freezes-membership.md), and the seam outset of
  // leaf boxes lands a slice of leaves per frame. The first value is written at once.
  const bodySteps = new Map(definition.viewBindings.flatMap(binding => binding.kind === "silhouette-step-property" && !binding.groups
    ? [[binding as PreparedViewBinding, (() => {
      let wanted: string | null = null;
      const paced = leafBoxes.owns(binding.target, binding.property) && binding.property === SEAM_OUTSET;
      const pacer = createSettlePacer((budget, moving) => {
        if (moving || wanted === null) return 0;
        if (paced) { const leaves = leafBoxes.drainOutset(wanted, budget); styleWrites += leaves; return leaves; }
        if (readStep(binding.target, binding.property) === wanted) return 0;
        writeStep(binding.target, binding.property, wanted); return 1;
      });
      return (value: string, detached: boolean) => {
        if (detached) {
          wanted = value;
          if (readStep(binding.target, binding.property) !== value) writeStep(binding.target, binding.property, value);
          return;
        }
        pacer.published();
        const first = wanted === null && !readStep(binding.target, binding.property);
        wanted = value;
        pacer.request(first);
      };
    })()] as const] : []));
  const interiorDiscs = new Map(definition.viewBindings.flatMap(binding => binding.kind === "interior-disc"
    ? [[binding.target, createPreparedInteriorDisc(binding)] as const] : []));
  /** Camera-following overlays: transforms (and a one-off visibility when the body hides). They follow every
   * camera publication, including a departing scene whose presentation is held by navigation: a held Pi1 Gruis
   * once left its corona plate centred and full size while the mesh flew away. */
  function followCamera(binding: PreparedViewBinding, element: HTMLElement, view: PreparedView): boolean {
    if (binding.kind === "interior-disc") {
      const transform = interiorDiscs.get(binding.target)!(view.projection);
      const visibility = transform ? "visible" : "hidden";
      if (element.style.visibility !== visibility) { element.style.visibility = visibility; styleWrites++; }
      if (transform && writeRetainedStyle(element, 'transform', transform)) transformWrites++;
    } else if (binding.kind === "silhouette-fit") {
      // The overlay fitted to the projected silhouette: an ellipse,
      // slightly elongated and shifted outward when off-axis, exactly the
      // mathematical silhouette the prepared frames are registered to,
      // never smaller than the prepared floor (the marker it lights).
      const silhouette = view.body.silhouette;
      // Written only on change: this binding publishes every frame (motion-freezes-membership.md).
      const visibility = view.body.visible === false ? "hidden" : "";
      if (element.style.visibility !== visibility) { element.style.visibility = visibility; styleWrites++; }
      if (silhouette) {
        // This transform already owns physical framing. The legacy shell's
        // individual scale would otherwise apply the same fit a second time.
        if (element.style.scale !== "1") element.style.scale = "1";
        if (element.style.transformOrigin !== "50% 50%") element.style.transformOrigin = "50% 50%";
        const radialAngle = Math.atan2(silhouette.radial[1], silhouette.radial[0]) * 180 / Math.PI;
        const radial = Math.max(silhouette.radialSemiAxis, binding.minimumRadius);
        const tangential = Math.max(silhouette.tangentialSemiAxis, binding.minimumRadius);
        // The silhouette is measured from the camera root's centre; this overlay sits on the stage beside the root,
        // so it takes the root's move too (the phone layout lifts the root above the sheet).
        const shiftX = view.stageViewport.principalOffsetPixels[0] - view.principalOffset[0];
        const shiftY = view.stageViewport.principalOffsetPixels[1] - view.principalOffset[1];
        const transform = `translate(${formatNumber(silhouette.centre[0] + shiftX)}px, ${formatNumber(silhouette.centre[1] + shiftY)}px) ` +
          `rotate(${formatNumber(radialAngle)}deg) ` +
          `scale(${formatNumber(radial * binding.unitScale)}, ${formatNumber(tangential * binding.unitScale)}) ` +
          `rotate(${formatNumber(-radialAngle)}deg)`;
        if (writeRetainedStyle(element, 'transform', transform)) transformWrites++;
      }
    } else if (binding.kind === "counter-rotation") {
      const counter = binding.systemTransform === null ? view.counterRotation : view.counterRotationFor(binding.systemTransform);
      if (writeRetainedStyle(element, 'transform', counter)) transformWrites++;
    } else return false;
    return true;
  }
  return {
    publishCamera(view: PreparedView) {
      publishDepth(view.projection);
      for (const binding of definition.viewBindings) followCamera(binding, target(binding.target), view);
    },
    publish({ selection, view, resources }: PreparedFramePublication) {
      publishDepth(view.projection);
      const levelOfDetail = view.levelOfDetail;
      for (const binding of definition.viewBindings) {
        const element = target(binding.target);
        if (binding.kind === "view-attribute") {
          // Only the level of detail is read (by stylesheets). The camera-pose attributes older packages still carry
          // (scene pitch, yaw, zoom, matrix) have no reader and would change every frame: they are not published
          // (docs/performance/motion-freezes-membership.md). The generator no longer emits them.
          if (binding.source !== "level-of-detail-stage") continue;
          const value = levelOfDetail.stage;
          if (readAttribute(element, binding.property) !== value) writeAttribute(element, binding.property, value);
        } else if (binding.kind === "view-property") {
          // An opacity on the element that draws it, guarded by the last value written (retained-write.ts).
          const value = formatNumber(round(binding.source === "billboard-opacity" ? levelOfDetail.billboardOpacity : levelOfDetail.markerOpacity, binding.precision));
          if (writeRetainedStyle(element, binding.property, value)) styleWrites++;
        } else if (followCamera(binding, element, view)) {
          continue;
        } else if (binding.kind === "silhouette-step-property" && binding.groups) {
          // Each group of leaf boxes publishes its own step (prepared-leaf-box-blocks.ts).
          const blocks = leafBoxBlocks.get(binding)!;
          const next = { projection: view.projection, silhouetteDiameter: levelOfDetail.silhouetteDiameter,
            motionAtRest: view.motionAtRest, viewportWidth: view.viewportWidth, viewportHeight: view.viewportHeight };
          if (connected()) blocks.publish(next);
          else blocks.prepare(next);
        } else if (binding.kind === "silhouette-step-property") {
          // A prepared value per published silhouette step, such as the surface seam outset.
          const level = selectPreparedSilhouetteStep(binding, levelOfDetail.silhouetteDiameter, silhouetteSteps.get(binding));
          if (level !== undefined) {
            silhouetteSteps.set(binding, level);
            bodySteps.get(binding)!(binding.levels[level].value, !connected());
          }
        }
      }
      seekPose(view.controlPitch);
      if (materials.size) for (const selected of selectedPreparedVariant(definition, selection).materials) {
        const material = materials.get(selected.track);
        if (!material) throw new TypeError(`Unprepared material track: ${selected.track}.`);
        material.publish(selected, view, resources);
      }
      framePublications++;
    },
    /** The leaf on node `index` shows an image of this stated size: its box follows; returns the style writes. */
    showLeafImage(index: number, size: readonly [number, number] | undefined) { return leafBoxes.image(index, size); },
    observe() { return { framePublications, styleWrites, transformWrites,
      materials: Object.fromEntries([...materials].map(([id, material]) => [id, material.observe()])) }; },
  };
}
