import { createPreparedInteriorDisc, type PreparedInteriorDisc } from './prepared-interior-disc.js';
import { buildPreparedTree, type PreparedTreeLease } from './prepared-tree.js';
import { bindPreparedSurfaceHit, type PreparedSurfaceHit } from '../navigation/prepared-surface-hit.js';
import { createPreparedDepthPartitions, type PreparedDepthPartitions } from './prepared-depth-partitions.js';
import type { ObjectSelection } from "../runtime/object-contract.js";
import type { PreparedMaterialTrack, PreparedMaterialSelection, PreparedMaterialDemand } from "./prepared-material.js";
import type { PreparedAssets, PreparedResources, PreparedResourceDemand } from "./prepared-residency.js";
import type { PreparedAnimationOptions } from "./prepared-playback.js";
import { readPreparedStyle, writePreparedStyle } from "./style-access.js";
import { selectPreparedTextureLevel, textureTileStyles, tiledTextureKeys, unseenTextureWrites, type PreparedTextureLevels, type PreparedTexturePlacements, type PreparedTextureTile } from './prepared-texture-levels.js';
import { createLeafBoxBlocks } from './prepared-leaf-box-blocks.js';
import { activeResourceFallbacks } from './prepared-resource-fallbacks.js';
import { selectPreparedSilhouetteStep, type PreparedSilhouetteSteps } from './prepared-silhouette-steps.js';
import type { PreparedSurfaceFeaturePlan } from '../labels/surface-feature-types.js';
import type { PreparedAssetOrigin } from './prepared-asset-origin.js';
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
export type PreparedWrite = { target: number; name: string } & (
  { kind: "attribute"; value: string | null } | { kind: "class"; value: boolean } |
  { kind: "style"; value: string } | { kind: "texture"; resource: string | null; quoted: boolean }
);
export interface PreparedSelectionNavigation { maximumZoom: number; camera?: { controlPitch: number; controlYaw: number; controlRoll?: number; zoom: number; transition?: { durationMilliseconds: number; preserveZoom: boolean } } | null; }
export interface PreparedVariant { when: Readonly<Record<string, ObjectSelection[string]>>; required: readonly string[]; materials: readonly PreparedMaterialSelection[]; writes: readonly PreparedWrite[]; navigation?: PreparedSelectionNavigation;
  /** Containers this selection does not show. Server markup for it omits their descendants; the runtime builds any it adopts without. */
  hiddenSubtrees?: readonly number[]; }
export interface PreparedTree {
  /** Offline first-paint batches. Runtime restores these exact retained leaves. */
  activationGroups?: readonly (readonly number[])[];
  nodes: readonly { tag: string; parent: number; className: string | null; style: string; properties: readonly number[]; attributes: Readonly<Record<string, string>> }[];
  properties: readonly { name: string; value: string; custom: boolean }[]; camera: number; scene: number; stageClasses: readonly string[];
}
export type PreparedViewBinding = { target: number } & (
  { kind: "view-attribute"; property: string; source: "scene-pitch" | "control-yaw" | "zoom" | "level-of-detail-stage" | "scene-matrix"; precision: number | null } |
  { kind: "view-property"; property: string; source: "billboard-opacity" | "marker-opacity"; precision: number | null } |
  { kind: "silhouette-fit"; minimumRadius: number; unitScale: number } |
  ({ kind: "interior-disc" } & PreparedInteriorDisc) |
  ({ kind: "silhouette-step-property"; property: string; placements?: PreparedTexturePlacements;
    /** Leaf boxes (prepared-leaf-box-blocks.ts): the leaves that share each published step, by block or `property`. */
    groups?: Readonly<Record<string, readonly number[]>>; groupSizes?: Readonly<Record<string, readonly number[]>> } & PreparedSilhouetteSteps) |
  { kind: "counter-rotation"; systemTransform: string | null }
);
export interface PreparedPresentationDefinition {
  textureLevels?: PreparedTextureLevels;
  /** The resource catalogue; presentation reads only its capability fallbacks. */
  assets?: PreparedAssets;
  camera: Parameters<typeof preparedScenePitch>[1]; tree: PreparedTree; variants: readonly PreparedVariant[]; materials: readonly PreparedMaterialTrack[];
  resourceOrder?: "materials-first" | "content-first"; viewBindings: readonly PreparedViewBinding[]; motionFrame?: readonly number[];
  animations: readonly { target: number; id: string; mode: "pose" | "motion"; keyframes: Keyframe[] | PropertyIndexedKeyframes; duration: number; sourceMinimum: number; millisecondsPerDegree: number }[];
  /** Authored infinite motion, resolved from source CSS during preparation. */
  motion?: readonly { target: number; id: string; keyframes: { offset: number; transform: string }[]; duration: number; timings: readonly { when: Readonly<Record<string, ObjectSelection[string]>>; duration: number }[] }[];
  features?: PreparedSurfaceFeaturePlan;
  depthPartitions?: PreparedDepthPartitions;
  surfaceHit?: PreparedSurfaceHit;
  assetOrigin?: PreparedAssetOrigin;
}
export interface PreparedPresentationPlan extends PreparedResourceDemand { required: string[]; prewarm: string[]; materials: Record<string, PreparedMaterialDemand>; pressedLenses: (string | null)[]; navigation?: PreparedSelectionNavigation; textureLevel?: number; textureResources?: Readonly<Record<string, string>>; textureTiles?: Readonly<Record<string, PreparedTextureTile>>;
  /** The mesh is not drawn at this level of detail: its textures only warm. */
  deferredTextures?: boolean; }
export interface PreparedPresentationContext { own(cleanup: () => void): unknown; registerAnimation(animation: Animation, options: PreparedAnimationOptions): unknown; seekAnimation(animation: Animation, time: number): void; }
export interface PreparedFramePublication { selection: ObjectSelection; view: PreparedView; resources: Pick<PreparedResources, "has" | "url">; }

import { preparedScenePitch } from "@cssearth/engine";
import { createPreparedMaterialPublisher } from "./prepared-material.js";
import { prepareConnectedActivation } from './prepared-activation.js';
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.js";

const matches = (variant: PreparedVariant, selection: ObjectSelection) => Object.entries(variant.when).every(([name, value]) => selection[name] === value);
export function selectedPreparedVariant(definition: PreparedPresentationDefinition, selection: ObjectSelection) {
  const variant = definition.variants.find(variant => matches(variant, selection));
  if (!variant) throw new TypeError("The selected presentation was not prepared.");
  return variant;
}
export function resolvePreparedPresentation(definition: PreparedPresentationDefinition, { selection, view, previousPlan, initial = false }: { selection: ObjectSelection; view: import('./prepared-material.js').PreparedMaterialView | null; previousPlan?: PreparedPresentationPlan | null; initial?: boolean }): PreparedPresentationPlan {
  const variant = selectedPreparedVariant(definition, selection);
  const textureLevel = definition.textureLevels ? selectPreparedTextureLevel(definition.textureLevels,
    view?.levelOfDetail?.silhouetteDiameter, previousPlan?.textureLevel, initial) : undefined;
  // A level names the resource each texture reads; a capability fallback then replaces it where this browser needs one.
  const fallback = activeResourceFallbacks(definition.assets?.fallbacks);
  const levelChoice = textureLevel === undefined ? undefined : textureLevelFor(definition.textureLevels!, textureLevel, variant, view);
  const levelResources = levelChoice?.resources, textureTiles = levelChoice?.tiles;
  const textureResources = levelResources === undefined && !Object.keys(fallback).length ? undefined
    : { ...fallback, ...Object.fromEntries(Object.entries(levelResources ?? {}).map(([key, level]) => [key, fallback[level] ?? level])) };
  const content = variant.required.map(key => textureResources?.[key] ?? key);
  // An opaque proxy stands for a marker-stage body, so its mesh is not drawn
  // (see perspective-dolly.ts). Mounting one there decoded a full surface set
  // for pixels no one sees. Its group is neither required nor warmed until the
  // camera resolves the body, which re-plans and decodes before it appears.
  const deferredTextures = (view?.levelOfDetail?.stage ?? "geometry") === "marker";
  const required = new Set(definition.resourceOrder === "materials-first" || deferredTextures ? [] : content);
  const prewarm = new Set<string>(), materials: Record<string, PreparedMaterialDemand> = {};
  for (const selected of variant.materials) {
    if (!view) throw new TypeError('Prepared material demand requires a view.');
    const track = definition.materials.find(track => track.id === selected.track);
    if (!track) throw new TypeError(`Unprepared material track: ${selected.track}.`);
    const state = resolvePreparedMaterialDemand(track, selected, view);
    for (const key of state.required) required.add(key);
    for (const key of state.prewarm) prewarm.add(key);
    materials[track.id] = state;
  }
  if (definition.resourceOrder === "materials-first" && !deferredTextures) for (const key of content) required.add(key);
  return { required: [...required], prewarm: [...prewarm].filter(key => !required.has(key)), materials, pressedLenses: [selection.lensId],
    ...(deferredTextures ? { deferredTextures } : {}),
    ...(textureLevel === undefined ? {} : { textureLevel }), ...(textureResources === undefined ? {} : { textureResources }),
    ...(textureTiles && Object.keys(textureTiles).length ? { textureTiles } : {}),
    ...(variant.navigation ? { navigation: variant.navigation } : {}) };
}
/** The selected level's resources and sheet tiles, except that a texture whose faces the camera cannot see keeps the first level. */
function textureLevelFor(levels: PreparedTextureLevels, level: number, variant: PreparedVariant, view: import('./prepared-material.js').PreparedMaterialView | null) {
  const { resources, tiles = {} } = levels.levels[level]!;
  if (!levels.placements || level === 0 || !view?.projection || view.motionAtRest !== true || !(view.viewportWidth! > 0) || !(view.viewportHeight! > 0)) return { resources, tiles };
  const unseen = unseenTextureWrites(levels.placements, view.projection, { width: view.viewportWidth!, height: view.viewportHeight! });
  if (!unseen.size) return { resources, tiles };
  const seen = new Set<string>(), hidden = new Set<string>();
  for (const write of variant.writes) if (write.kind === 'texture' && write.resource !== null && write.resource in resources)
    (unseen.has(write.name) ? hidden : seen).add(write.resource);
  const first = levels.levels[0]!, chosen = { ...resources }, chosenTiles: Record<string, PreparedTextureTile> = { ...tiles };
  for (const key of hidden) if (!seen.has(key)) {
    chosen[key] = first.resources[key]!;
    if (first.tiles?.[key]) chosenTiles[key] = first.tiles[key]; else delete chosenTiles[key];
  }
  return { resources: chosen, tiles: chosenTiles };
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
export function mountPreparedPresentation(stage: HTMLElement, context: PreparedPresentationContext, definition: PreparedPresentationDefinition, preparedTree?: PreparedTreeLease, initialProjection?: import('../prepared-data/physical-projection.js').PhysicalProjection, progressiveActivation = false) {
  const { nodes, roots } = preparedTree ? preparedTree.claim(definition.tree, stage.ownerDocument, context.own)
    : buildPreparedTree(definition.tree, stage.ownerDocument, context.own, stage, definition.assetOrigin,
      new Set(definition.variants.flatMap(variant => variant.hiddenSubtrees ?? [])));
  const cameraElement = nodes[definition.tree.camera], sceneElement = nodes[definition.tree.scene];
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
      if (binding.kind === "attribute") writeAttribute(stage, binding.name, typeof previous === "string" ? previous : null);
      else if (binding.kind === "class") stage.classList.toggle(binding.name, previous === true);
      else writeStyle(stage, binding.name, String(previous));
    });
  }
  for (const name of definition.tree.stageClasses) {
    const previous = stage.classList.contains(name);
    context.own(() => { if (owned()) stage.classList.toggle(name, previous); });
  }
  if (progressiveActivation && !definition.tree.activationGroups) throw new TypeError('Flight activation requires prepared groups.');
  const activate = prepareConnectedActivation(preparedTree && progressiveActivation
    ? (definition.tree.activationGroups ?? []).map(group => group.map(index => nodes[index])) : [], context.own);
  // The same prepared groups let the camera bring a resolving mesh back in stages.
  const revealGroups = Object.freeze((definition.tree.activationGroups ?? []).map(group => Object.freeze(group.map(index => nodes[index]))));
  // Disable CSS-owned motion before attachment. Prepared handles below own its
  // clock, pause state and disposal without forcing live style discovery.
  for (const plan of [...definition.motion ?? [], ...definition.animations]) nodes[plan.target].style.animation = 'none';
  const motion = (definition.motion ?? []).map(plan => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, iterations: Infinity, easing: 'linear', fill: 'both' });
    animation.id = plan.id;
    context.registerAnimation(animation, { mode: 'motion', initialTime: 0 });
    return { animation, plan, duration: plan.duration };
  });
  // Presentation owns only its prepared roots; application context siblings survive a detail handoff.
  for (const root of roots) stage.appendChild(root);
  if (roots.some(root => root.parentNode !== stage)) throw new Error("Prepared roots must belong to the mounted stage.");
  for (const name of definition.tree.stageClasses) stage.classList.add(name);
  const animations = definition.animations.map(plan => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, easing: "linear", fill: "both" });
    animation.id = plan.id; context.registerAnimation(animation, { mode: plan.mode });
    return { animation, plan };
  });
  const framePublisher = createPreparedFramePublisher(definition, stage, nodes, sceneElement, controlPitch => {
    for (const { animation, plan } of animations) context.seekAnimation(animation,
      Math.max(0, Math.min(plan.duration, (controlPitch - plan.sourceMinimum) * plan.millisecondsPerDegree)));
  }, initialProjection);
  let selectionPublications = 0, styleWrites = 0;
  const tiledKeys = tiledTextureKeys(definition.textureLevels);
  let selectedTextures = new Map<string, { target: number; name: string }>();
  const styleKey = (binding: { target: number; name: string }) => `${binding.target}:${binding.name.startsWith("--") ? binding.name : binding.name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
  const target = (index: number) => index === -1 ? stage : nodes[index];
  return Object.freeze({ cameraElement, sceneElement, activate, revealGroups,
    ...(definition.surfaceHit ? { surfaceHitTest: bindPreparedSurfaceHit(definition.surfaceHit, nodes[definition.surfaceHit.target], sceneElement, cameraElement, () => stage.dataset.lens) } : {}),
    ...(definition.motionFrame ? { motionFrame: Object.freeze(definition.motionFrame.map(index => nodes[index])) } : {}),
    ...(definition.features ? { featureTarget: nodes[definition.features.target] } : {}),
    commitSelection({ selection, resources, plan }: { selection: ObjectSelection; resources: PreparedResources; plan?: PreparedPresentationPlan; view?: PreparedView | null }) {
      const variant = selectedPreparedVariant(definition, selection);
      // Resolve the complete texture group before publishing any part of it.
      const writes = variant.writes.flatMap(binding => {
        if (binding.kind !== "texture") return [binding];
        const url = binding.resource === null ? null : resources.url(plan?.textureResources?.[binding.resource] ?? binding.resource);
        // A deferred (undrawn) mesh publishes no texture at all; the resolving
        // camera re-plans and commits the complete group before it is shown.
        if (binding.resource !== null && !url && !plan?.deferredTextures) throw new Error(`Prepared selection texture is not ready: ${binding.resource}`);
        const image = { kind: "style" as const, target: binding.target, name: binding.name, value: url === null ? "none" : binding.quoted ? `url(${JSON.stringify(url)})` : `url(${url})` };
        // A page some level draws from a shared sheet carries its tile (or its own placement) with every image.
        if (binding.resource === null || !tiledKeys.has(binding.resource)) return [image];
        return [image, ...textureTileStyles(binding.name, plan?.textureTiles?.[binding.resource]).map(([name, value]) => ({ kind: "style" as const, target: binding.target, name, value }))];
      });
      // Texture references belong to the committed dataset. Retire references
      // absent from its successor in the same publication, without embedding
      // every inactive dataset's clearing writes in every prepared variant.
      const nextStyles = new Set(writes.filter(binding => binding.kind === "style").map(styleKey));
      const profileDisplay = (binding: typeof writes[number], value: string) => binding.kind === "style" &&
        binding.name.startsWith("--") && binding.name.endsWith("-display") && binding.value === value;
      const hiddenProfiles = writes.filter(binding => profileDisplay(binding, "none"));
      const shownProfiles = writes.filter(binding => profileDisplay(binding, "block"));
      const contentWrites = writes.filter(binding => !profileDisplay(binding, "none") && !profileDisplay(binding, "block"));
      const publish = (binding: typeof writes[number]) => {
        const element = target(binding.target);
        if (binding.kind === "attribute") writeAttribute(element, binding.name, binding.value);
        else if (binding.kind === "class") element.classList.toggle(binding.name, binding.value);
        else { writeStyle(element, binding.name, binding.value); styleWrites++; }
      };
      // Alternative radial meshes address different atlas layouts. Hide the
      // outgoing profile before changing their shared image, then reveal the
      // incoming profile only after the complete dataset has been published.
      // If publication is interrupted, the body fails closed instead of
      // rendering one mesh with another mesh's texel addresses.
      for (const binding of hiddenProfiles) publish(binding);
      for (const [key, binding] of selectedTextures) if (!nextStyles.has(key)) {
        writeStyle(target(binding.target), binding.name, "none"); styleWrites++;
      }
      for (const binding of contentWrites) publish(binding);
      for (const binding of shownProfiles) publish(binding);
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
  initialProjection?: import('../prepared-data/physical-projection.js').PhysicalProjection) {
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
  const leafBoxBlocks = new Map(definition.viewBindings.flatMap(binding => binding.kind === "silhouette-step-property" && binding.groups
    ? [[binding as PreparedViewBinding, createLeafBoxBlocks({ ...binding, groups: binding.groups },
      name => styleValue(nodes[binding.groups![name]![0]!]!, binding.property) || styleValue(target(binding.target), binding.property),
      (name, value) => { for (const leaf of binding.groups![name]!) { writeStyle(nodes[leaf]!, binding.property, value); styleWrites++; } })] as const] : []));
  const interiorDiscs = new Map(definition.viewBindings.flatMap(binding => binding.kind === "interior-disc"
    ? [[binding.target, createPreparedInteriorDisc(binding)] as const] : []));
  return {
    publish({ selection, view, resources }: PreparedFramePublication) {
      publishDepth(view.projection);
      const levelOfDetail = view.levelOfDetail;
      for (const binding of definition.viewBindings) {
        const element = target(binding.target);
        if (binding.kind === "view-attribute") {
          let value = binding.source === "scene-pitch" ? preparedScenePitch(view.controlPitch, definition.camera)
            : binding.source === "control-yaw" ? view.controlYaw : binding.source === "zoom" ? view.zoom
              : binding.source === "level-of-detail-stage" ? levelOfDetail.stage : view.sceneMatrix;
          if (binding.precision !== null) { const scale = 10 ** binding.precision; value = Math.round(Number(value) * scale) / scale; }
          if (readAttribute(element, binding.property) !== String(value)) writeAttribute(element, binding.property, String(value));
        } else if (binding.kind === "view-property") {
          const value = formatNumber(round(binding.source === "billboard-opacity" ? levelOfDetail.billboardOpacity : levelOfDetail.markerOpacity, binding.precision));
          if (styleValue(element, binding.property) !== value) { writeStyle(element, binding.property, value); styleWrites++; }
        } else if (binding.kind === "interior-disc") {
          const transform = interiorDiscs.get(binding.target)!(view.projection);
          const visibility = transform ? "visible" : "hidden";
          if (element.style.visibility !== visibility) { element.style.visibility = visibility; styleWrites++; }
          if (transform && element.style.transform !== transform) { element.style.transform = transform; transformWrites++; }
        } else if (binding.kind === "silhouette-fit") {
          // The overlay fitted to the projected silhouette: an ellipse,
          // slightly elongated and shifted outward when off-axis, exactly the
          // mathematical silhouette the prepared frames are registered to,
          // never smaller than the prepared floor (the marker it lights).
          const silhouette = view.body.silhouette;
          element.style.visibility = view.body.visible === false ? "hidden" : "";
          if (silhouette) {
            // This transform already owns physical framing. The legacy shell's
            // individual scale would otherwise apply the same fit a second time.
            element.style.scale = "1";
            element.style.transformOrigin = "50% 50%";
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
            if (element.style.transform !== transform) { element.style.transform = transform; transformWrites++; }
          }
        } else if (binding.kind === "silhouette-step-property" && binding.groups) {
          // Each group of leaf boxes publishes its own step (prepared-leaf-box-blocks.ts).
          leafBoxBlocks.get(binding)!.publish({ projection: view.projection, silhouetteDiameter: levelOfDetail.silhouetteDiameter,
            motionAtRest: view.motionAtRest, viewportWidth: view.viewportWidth, viewportHeight: view.viewportHeight });
        } else if (binding.kind === "silhouette-step-property") {
          // A prepared value per published silhouette step, such as the surface seam outset.
          const level = selectPreparedSilhouetteStep(binding, levelOfDetail.silhouetteDiameter, silhouetteSteps.get(binding));
          if (level !== undefined) {
            silhouetteSteps.set(binding, level);
            const value = binding.levels[level].value;
            if (styleValue(element, binding.property) !== value) { writeStyle(element, binding.property, value); styleWrites++; }
          }
        } else {
          const counter = binding.systemTransform === null ? view.counterRotation : view.counterRotationFor(binding.systemTransform);
          if (element.style.transform !== counter) { element.style.transform = counter; transformWrites++; }
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
    observe() { return { framePublications, styleWrites, transformWrites,
      materials: Object.fromEntries([...materials].map(([id, material]) => [id, material.observe()])) }; },
  };
}
