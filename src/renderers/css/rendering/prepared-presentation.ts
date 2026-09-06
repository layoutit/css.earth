import type { ObjectSelection } from "../runtime/object-contract.js";
import type { PreparedMaterialTrack, PreparedMaterialSelection, PreparedMaterialDemand } from "./prepared-material.js";
import type { PreparedResources, PreparedResourceDemand } from "./prepared-residency.js";
import type { PreparedAnimationOptions } from "./prepared-playback.js";
import { readPreparedStyle, writePreparedStyle } from "./style-access.js";
export type PreparedSelection = ObjectSelection;
export interface PreparedView {
  revision?: number; controlPitch: number; controlYaw: number; zoom: number; sceneMatrix: string;
  sunViewDirection: readonly number[] | null; reference?: { sceneMatrix: string; sunViewDirection: readonly number[] | null };
  counterRotation: string; counterRotationFor(systemTransform: string | DOMMatrix | null): string;
  levelOfDetail?: { stage: string; silhouetteDiameter: number | null; billboardOpacity: number; markerOpacity: number };
  body?: { visible?: boolean; screen?: readonly number[] | null; silhouette?: { radial: readonly number[]; centre: readonly number[]; radialSemiAxis: number; tangentialSemiAxis: number } | null };
}
export type PreparedWrite = { target: number; name: string } & (
  { kind: "attribute"; value: string | null } | { kind: "class"; value: boolean } |
  { kind: "style"; value: string } | { kind: "texture"; resource: string | null; quoted: boolean }
);
export interface PreparedSelectionNavigation { maximumZoom: number; camera?: { controlPitch: number; controlYaw: number; zoom: number }; }
export interface PreparedVariant { when: Readonly<Record<string, ObjectSelection[string]>>; required: readonly string[]; materials: readonly PreparedMaterialSelection[]; writes: readonly PreparedWrite[]; navigation?: PreparedSelectionNavigation; }
export interface PreparedTree {
  nodes: readonly { tag: string; parent: number; className: string | null; style: string; properties: readonly number[]; attributes: Readonly<Record<string, string>> }[];
  properties: readonly { name: string; value: string; custom: boolean }[]; camera: number; scene: number; stageClasses: readonly string[];
}
export type PreparedViewBinding = { target: number } & (
  { kind: "view-attribute"; property: string; source: "scene-pitch" | "control-yaw" | "zoom" | "level-of-detail-stage" | "scene-matrix"; precision: number | null } |
  { kind: "view-property"; property: string; source: "billboard-opacity" | "marker-opacity"; precision: number | null } |
  { kind: "silhouette-fit"; minimumRadius: number; unitScale: number } |
  { kind: "zoom-property"; property: string } | { kind: "shell-scale"; variable: string; defaultZoom: number } |
  { kind: "counter-rotation"; systemTransform: string | null }
);
export interface PreparedPageLayer { id: string; carrier: number; system: number; readonly [key: string]: unknown; }
export interface PreparedPresentationDefinition {
  camera: Parameters<typeof preparedScenePitch>[1]; tree: PreparedTree; variants: readonly PreparedVariant[]; materials: readonly PreparedMaterialTrack[];
  resourceOrder?: "materials-first" | "content-first"; viewBindings: readonly PreparedViewBinding[]; motionFrame?: readonly number[]; pageLayers?: readonly PreparedPageLayer[];
  animations: readonly { target: number; id: string; mode: "pose" | "motion"; keyframes: Keyframe[] | PropertyIndexedKeyframes; duration: number; sourceMinimum: number; millisecondsPerDegree: number }[];
}
export interface PreparedPresentationPlan extends PreparedResourceDemand { required: string[]; prewarm: string[]; materials: Record<string, PreparedMaterialDemand>; pressedLenses: (string | null)[]; navigation?: PreparedSelectionNavigation; }
export interface PreparedPresentationContext { own(cleanup: () => void): unknown; registerAnimation(animation: Animation, options: PreparedAnimationOptions): unknown; seekAnimation(animation: Animation, time: number): void; }
export interface PreparedFramePublication { selection: ObjectSelection; view: PreparedView; resources: PreparedResources; plan?: PreparedPresentationPlan | null; }

import { preparedScenePitch } from "@cssearth/engine";
import { createPreparedMaterialPublisher } from "./prepared-material.js";
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.js";

const matches = (variant: PreparedVariant, selection: ObjectSelection) => Object.entries(variant.when).every(([name, value]) => selection[name] === value);
export function selectedPreparedVariant(definition: PreparedPresentationDefinition, selection: ObjectSelection) {
  const variant = definition.variants.find(variant => matches(variant, selection));
  if (!variant) throw new TypeError("The selected presentation was not prepared.");
  return variant;
}
export function resolvePreparedPresentation(definition: PreparedPresentationDefinition, { selection, view }: { selection: ObjectSelection; view: PreparedView; previousPlan?: PreparedPresentationPlan | null }): PreparedPresentationPlan {
  const variant = selectedPreparedVariant(definition, selection);
  const required = new Set(definition.resourceOrder === "materials-first" ? [] : variant.required);
  const prewarm = new Set<string>(), materials: Record<string, PreparedMaterialDemand> = {};
  for (const selected of variant.materials) {
    const track = definition.materials.find(track => track.id === selected.track);
    if (!track) throw new TypeError(`Unprepared material track: ${selected.track}.`);
    const state = resolvePreparedMaterialDemand(track, selected, view);
    for (const key of state.required) required.add(key);
    for (const key of state.prewarm) prewarm.add(key);
    materials[track.id] = state;
  }
  if (definition.resourceOrder === "materials-first") for (const key of variant.required) required.add(key);
  return { required: [...required], prewarm: [...prewarm].filter(key => !required.has(key)), materials, pressedLenses: [selection.lensId],
    ...(variant.navigation ? { navigation: variant.navigation } : {}) };
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
export function mountPreparedPresentation(stage: HTMLElement, context: PreparedPresentationContext, definition: PreparedPresentationDefinition) {
  const document = stage.ownerDocument, nodes: HTMLElement[] = [], roots: HTMLElement[] = [];
  for (const record of definition.tree.nodes) {
    const node = document.createElement(record.tag);
    nodes.push(node);
    if (record.parent === -1) { roots.push(node); context.own(() => node.remove()); }
    if (record.className !== null) node.className = record.className;
    if (record.style) node.style.cssText = record.style;
    // Keep property assignment distinct from cssText. Chrome's numeric CSS
    // parser can otherwise change the original prepared matrix precision.
    for (const propertyId of record.properties) {
      const property = definition.tree.properties[propertyId];
      if (property.custom) node.style.setProperty(property.name, property.value);
      else writePreparedStyle(node.style, property.name, property.value);
    }
    for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
    if (record.parent !== -1) nodes[record.parent].appendChild(node);
  }
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
  // Presentation owns only its prepared roots; application context siblings survive a detail handoff.
  for (const root of roots) stage.appendChild(root);
  if (roots.some(root => root.parentNode !== stage)) throw new Error("Prepared roots must belong to the mounted stage.");
  for (const name of definition.tree.stageClasses) stage.classList.add(name);
  const animations = definition.animations.map(plan => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, easing: "linear", fill: "both" });
    animation.id = plan.id; context.registerAnimation(animation, { mode: plan.mode });
    return { animation, plan };
  });
  const materials = new Map(definition.materials.map(track => [track.id,
    createPreparedMaterialPublisher(track, nodes[track.target], definition.camera)]));
  let selectionPublications = 0, framePublications = 0, styleWrites = 0, transformWrites = 0;
  const GEOMETRY_LEVEL_OF_DETAIL = Object.freeze({ stage: "geometry", silhouetteDiameter: null, billboardOpacity: 0, markerOpacity: 0 });
  const round = (value: number, precision: number | null) => precision === null ? value : Math.round(value * 10 ** precision) / 10 ** precision;
  const formatNumber = (value: number) => Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
  const target = (index: number) => index === -1 ? stage : nodes[index];
  return Object.freeze({ cameraElement, sceneElement,
    ...(definition.motionFrame ? { motionFrame: Object.freeze(definition.motionFrame.map(index => nodes[index])) } : {}),
    ...(definition.pageLayers ? { pageLayers: Object.freeze(definition.pageLayers.map(layer => Object.freeze({ ...layer,
      carrier: nodes[layer.carrier], system: nodes[layer.system] }))) } : {}),
    commitSelection({ selection, resources }: { selection: ObjectSelection; resources: PreparedResources; plan?: PreparedPresentationPlan; view?: PreparedView | null }) {
      const variant = selectedPreparedVariant(definition, selection);
      // Resolve the complete texture group before publishing any part of it.
      const writes = variant.writes.map(binding => {
        if (binding.kind !== "texture") return binding;
        const url = binding.resource === null ? null : resources.url(binding.resource);
        if (binding.resource !== null && !url) throw new Error(`Prepared selection texture is not ready: ${binding.resource}`);
        return { kind: "style" as const, target: binding.target, name: binding.name, value: url === null ? "none" : binding.quoted ? `url(${JSON.stringify(url)})` : `url(${url})` };
      });
      for (const binding of writes) {
        const element = target(binding.target);
        if (binding.kind === "attribute") writeAttribute(element, binding.name, binding.value);
        else if (binding.kind === "class") element.classList.toggle(binding.name, binding.value);
        else { writeStyle(element, binding.name, binding.value); styleWrites++; }
      }
      selectionPublications++;
    },
    publishFrame({ selection, view, resources, plan }: PreparedFramePublication) {
      // The camera's published level of detail (a perspective dolly, see
      // perspective-dolly.mjs); before its first publication the geometry
      // stage applies.
      const levelOfDetail = view.levelOfDetail ?? GEOMETRY_LEVEL_OF_DETAIL;
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
        } else if (binding.kind === "silhouette-fit") {
          // The overlay fitted to the projected silhouette: an ellipse,
          // slightly elongated and shifted outward when off-axis, exactly the
          // mathematical silhouette the prepared frames are registered to,
          // never smaller than the prepared floor (the marker it lights).
          const silhouette = view.body?.silhouette;
          element.style.visibility = view.body?.visible === false ? "hidden" : "";
          if (silhouette) {
            const radialAngle = Math.atan2(silhouette.radial[1], silhouette.radial[0]) * 180 / Math.PI;
            const radial = Math.max(silhouette.radialSemiAxis, binding.minimumRadius);
            const tangential = Math.max(silhouette.tangentialSemiAxis, binding.minimumRadius);
            const transform = `translate(${formatNumber(silhouette.centre[0])}px, ${formatNumber(silhouette.centre[1])}px) ` +
              `rotate(${formatNumber(radialAngle)}deg) ` +
              `scale(${formatNumber(radial * binding.unitScale)}, ${formatNumber(tangential * binding.unitScale)}) ` +
              `rotate(${formatNumber(-radialAngle)}deg)`;
            if (element.style.transform !== transform) { element.style.transform = transform; transformWrites++; }
          }
        } else if (binding.kind === "zoom-property") { writeStyle(element, binding.property, String(view.zoom)); styleWrites++; }
        else if (binding.kind === "shell-scale") {
          element.style.scale = `calc(var(${binding.variable}) / (var(--planet-viewport-zoom-divisor) / ${view.zoom / binding.defaultZoom}))`;
          transformWrites++;
        } else {
          const counter = binding.systemTransform === null ? view.counterRotation : view.counterRotationFor(binding.systemTransform);
          if (element.style.transform !== counter) { element.style.transform = counter; transformWrites++; }
        }
      }
      for (const { animation, plan } of animations) context.seekAnimation(animation,
        Math.max(0, Math.min(plan.duration, (view.controlPitch - plan.sourceMinimum) * plan.millisecondsPerDegree)));
      if (materials.size) for (const selected of selectedPreparedVariant(definition, selection).materials) {
        const material = materials.get(selected.track);
        if (!material) throw new TypeError(`Unprepared material track: ${selected.track}.`);
        material.publish(selected, view, resources, plan?.materials?.[selected.track]);
      }
      framePublications++;
    },
    observe() {
      return {
        presentation: { nodes: nodes.length, roots: roots.length, selectionPublications, framePublications, styleWrites, transformWrites },
        materials: Object.fromEntries([...materials].map(([id, material]) => [id, material.observe()])),
      };
    },
  });
}
