import { requireTextureLevels } from './prepared-texture-levels.mts';
import { isArray } from './is-array.mts';
import type { ObjectControls } from "../renderers/css/runtime/object-contract.ts";
import type { ObjectRuntimeDefinition } from "../renderers/css/runtime/object-runtime-types.ts";
import type { PreparedWrite } from "../renderers/css/rendering/prepared-presentation.ts";
import type { PreparedAssets } from "../renderers/css/rendering/prepared-residency.ts";
import type { PreparedCubicSkyPlan } from "./cubic-sky-contract.mts";
import type { PreparedDirectionalSunPlan } from "./directional-sun-contract.mts";
import type { EllipsoidProjectionPlan } from "../renderers/css/dist/preparation.js";
import type { PreparedMaterialAddress, PreparedMaterialFrameMapping } from "../renderers/css/dist/testing.js";
import type { PreparedMaterialTrack, PreparedMaterialSelection, PreparedMaterialBank } from "../renderers/css/dist/testing.js";
import type { PreparedVariant, PreparedPresentationDefinition, PreparedSelectionNavigation } from "./prepared-presentation.mts";
import type { PreparedDepthOrder } from "../renderers/css/rendering/prepared-depth-partitions.ts";
type PreparedContractRotation = {
  reference: "prepared" | "initial"; baseDegrees: number; zeroAtPole: boolean;
  onlyWhenEnabled?: boolean; publishWithAddress?: boolean; systemTransform?: string; polePolicy?: "azimuth";
  physical?: { width: number; height: number; systemTransform: string; projection: EllipsoidProjectionPlan };
} & ({ kind: "angle"; property: string } | { kind: "planar"; width: number; height: number } |
  { kind: "ellipsoid"; width: number; height: number; projection: EllipsoidProjectionPlan; systemTransform:string });
interface PreparedContractBank extends Omit<PreparedMaterialBank, "default" | "fixed"> {
  default: PreparedMaterialAddress | null; fixed: PreparedMaterialAddress | null;
  rows?: readonly { row: number; resource: string; firstFrame: number; lastFrame: number }[];
}
export interface PreparedContractTrack extends Omit<PreparedMaterialTrack, "banks" | "rotation" | "frame" | "frameAttribute" | "modeAttribute"> {
  frame: PreparedMaterialFrameMapping & { count: number }; banks: readonly PreparedContractBank[];
  rotation: PreparedContractRotation | null; frameAttribute: string | null; modeAttribute: string | null;
}
export interface PreparedContractVariant extends Omit<PreparedVariant, "navigation" | "materials"> {
  navigation?: { maximumZoom: number; camera: NonNullable<PreparedSelectionNavigation["camera"]> | null };
  materials: readonly (PreparedMaterialSelection & { frameOverride: number | null })[];
}
export type PreparedPresentationContract = Omit<ObjectRuntimeDefinition, "schema" | "id" | "controls" | "sky" | "sun" | "materials" | "variants" | "animations" | "destinations"> & {
  schema: string; sky: PreparedCubicSkyPlan; sun: PreparedDirectionalSunPlan | null;
  materials: readonly PreparedContractTrack[]; variants: readonly PreparedContractVariant[];
  animations: readonly (Omit<PreparedPresentationDefinition["animations"][number], "keyframes"> & { keyframes: { offset: number; transform: string }[] })[];
  destinations?: { catalog: { url: string; bytes: number; count: number; sha256: string }; defaultLens: string; statuses: { detail: string; overview: string } };
};
import { requireObjectControls } from "../../site/scene/scene-contract.mts";
import { validatePreparedCubicSky } from "./cubic-sky-contract.mts";
import { validateDirectionalSunPlan } from "./directional-sun-contract.mts";

import { PREPARED_PRESENTATION_SCHEMA } from "./prepared-schema.mts";
export { PREPARED_PRESENTATION_SCHEMA, PREPARED_OBJECT_RUNTIME_SCHEMA } from "./prepared-schema.mts";
const tags = new Set(["div", "span", "s", "b", "u"]);
function fail(message: string): never { throw new TypeError(`Prepared presentation: ${message}.`); }
const scalar = (value: unknown) => value === null || ["string", "boolean"].includes(typeof value) || typeof value === "number" && Number.isFinite(value);
function string(value: unknown, label: string): asserts value is string { if (typeof value !== "string" || !value.length) fail(`${label} must be a nonempty string`); }
function finite(value: unknown, label: string): asserts value is number { if (!Number.isFinite(value)) fail(`${label} must be finite`); }
const integer = (value: unknown, label: string, minimum = 0) => { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) fail(`${label} must be an integer at least ${minimum}`); };
const choice = <T,>(value: T, choices: ReadonlySet<T>, label: string) => { if (!choices.has(value)) fail(`unsupported ${label}: ${value}`); };
function record(value: unknown, label: string, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} must be a plain record`);
  for (const key of Object.keys(value)) if (!fields.includes(key)) fail(`unsupported ${label} field ${key}`);
}
function array<T>(value: readonly T[] | undefined, label: string): readonly T[] { if (!isArray(value)) fail(`${label} must be an array`); return value!; }
function unique(values: readonly unknown[], label: string) { if (new Set(values).size !== values.length) fail(`${label} has duplicate identities`); }

// This is also used before serialization. Getters, cycles, symbols and callable
// payloads are rejected before accessing values; JSON coercion is not validation.
export function requirePreparedData<T>(value: T, label = "data", seen = new Set<object>()) {
  if (scalar(value)) return value;
  if (!value || typeof value !== "object" || seen.has(value) ||
      ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))) fail(`${label} must contain only acyclic JSON data`);
  if (Object.getOwnPropertySymbols(value).length) fail(`${label} cannot contain symbols`);
  seen.add(value);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (isArray(value) && key === "length") continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) fail(`${label}.${key} cannot be executable`);
    requirePreparedData(descriptor.value, `${label}.${key}`, seen);
  }
  seen.delete(value);
  return value;
}

export function requirePreparedPresentation(input: unknown, options: { controls: unknown; assets?: PreparedAssets }): PreparedPresentationContract {
  // The candidate is exposed only after all structural and referential checks below succeed.
  const plan = input as PreparedPresentationContract;
  const controls = requireObjectControls(options.controls);
  const assets = options.assets ?? plan?.assets;
  requirePreparedData(plan);
  record(plan, "plan", ["schema", "camera", "sky", "sun", "assets", "tree", "variants", "materials", "viewBindings", "animations", "motion", "facing", "depthPartitions", "resourceOrder", "destinations", "motionFrame", "surfaceHit", "textureLevels", "features"]);
  if (plan.resourceOrder !== undefined) choice(plan.resourceOrder, new Set(["content-first", "materials-first"]), "resource order");
  if (plan.schema !== PREPARED_PRESENTATION_SCHEMA) fail("schema is incompatible");
  requireObjectControls(controls);
  validatePreparedCubicSky(plan.sky);
  if (plan.sun !== null) validateDirectionalSunPlan(plan.sun);
  if (!(plan.camera?.sceneScale > 0) || !(plan.camera.minimumZoom > 0) || !(plan.camera.maximumZoom >= plan.camera.minimumZoom)) fail("camera plan is incomplete");
  if (!isArray(assets?.entries)) fail("resource catalog is missing");
  const resources = new Set(assets.entries.map(entry => entry.key));
  if (plan.textureLevels !== undefined) requireTextureLevels(plan.textureLevels, plan.variants, resources);
  const resource = (key: string | null, nullable = false) => { if (!(nullable && key === null) && !resources.has(key!)) fail(`undeclared resource ${key}`); };
  const resourceList = (list: readonly string[], label: string) => { array(list, label).forEach(key => resource(key)); unique(list, label); };
  const tree = plan.tree;
  record(tree, "tree", ["nodes", "properties", "camera", "scene", "stageClasses", "activationGroups"]);
  for (const property of array(tree.properties,"prepared style properties")) {
    record(property,"prepared style property",["name","value","custom"]);string(property.name,"prepared property name");
    if(typeof property.value!=="string"||typeof property.custom!=="boolean")fail("prepared property assignment is invalid");
    if(/^(?:clipPath|mask.*|filter|mixBlendMode|backgroundBlendMode)$/.test(property.name)||/(?:linear|radial|conic)-gradient\s*\(/i.test(property.value))fail("unsupported scene property");
  }
  array(tree.nodes, "nodes");
  if (!tree.nodes.length) fail("retained tree is empty");
  const node = (id: number, stage = false) => { integer(id, "node reference", stage ? -1 : 0); if (id >= tree.nodes.length) fail(`undeclared node ${id}`); };
  for (const [index, entry] of tree.nodes.entries()) {
    record(entry, "node", ["parent", "tag", "className", "style", "properties", "attributes"]);
    integer(entry.parent, "node parent", -1);
    if (entry.parent >= index) fail("node parents must precede children");
    choice(entry.tag, tags, "retained tag");
    if (entry.className !== null && typeof entry.className !== "string" || typeof entry.style !== "string") fail("node class/style must be prepared strings or an absent class");
    for (const property of array(entry.properties,"prepared property references")) {
      integer(property,"prepared property reference");if(property>=tree.properties.length)fail("undeclared prepared property");
    }
    record(entry.attributes, "attributes", Object.keys(entry.attributes ?? {}));
    for (const [name, value] of Object.entries(entry.attributes)) {
      // Preserve an explicitly present empty source declaration without opening
      // an alternate channel for CSS or overriding prepared property writes.
      if (name === "style" && value === "" && entry.style === "" && entry.properties.length === 0) continue;
      attribute(name);
      if (typeof value !== "string") fail("prepared attribute values must be strings");
    }
    if (/\b(?:clip-path|mask(?:-\w+)?|filter|mix-blend-mode|background-blend-mode)\s*:|(?:linear|radial|conic)-gradient\s*\(/i.test(entry.style)) fail("unsupported scene style");
  }
  node(tree.camera); node(tree.scene);
  if (tree.nodes[tree.camera].parent !== -1 || !ancestor(tree.scene, tree.camera)) fail("one camera root must own the scene");
  if (tree.nodes.filter(entry => /(?:^|\s)polycss-camera(?:\s|$)/.test(entry.className ?? "")).length !== 1 ||
      !/(?:^|\s)polycss-camera(?:\s|$)/.test(tree.nodes[tree.camera].className ?? "")) fail("tree requires exactly one camera");
  if (tree.nodes.filter(entry => /(?:^|\s)polycss-scene(?:\s|$)/.test(entry.className ?? "")).length !== 1) fail("tree requires exactly one scene");
  array(tree.stageClasses, "stage classes").forEach(value => string(value, "stage class"));
  if (tree.activationGroups !== undefined) {
    const containers = new Set(tree.nodes.map(node => node.parent)), activated = new Set();
    for (const group of array(tree.activationGroups, 'activation groups')) {
      array(group, 'activation group');
      if (!group.length || group.length > 64) fail('activation group must contain 1 to 64 leaves');
      for (const target of group) {
        node(target);
        if (containers.has(target) || target === tree.camera || target === tree.scene || activated.has(target)) fail('activation target must be a unique retained leaf');
        activated.add(target);
      }
    }
  }
  function ancestor(child: number, parent: number) { for (let id = tree.nodes[child]?.parent; id >= 0; id = tree.nodes[id].parent) if (id === parent) return true; return false; }
  const partitionScenes = new Set<number>();
  if (plan.depthPartitions !== undefined) {
    const partition = plan.depthPartitions;
    record(partition, 'depth partitions', ['groups', 'order']);
    const roots = new Set(), ordered = new Set();
    const groups = array(partition.groups, 'depth groups');
    if (groups.length < 2 || groups.length > 128) fail('depth partitions require 2 to 128 retained groups');
    for (const group of groups) {
      record(group, 'depth group', ['root', 'scene']); node(group.root); node(group.scene);
      if (tree.nodes[group.root].parent !== tree.camera || !ancestor(group.scene, group.root) ||
          roots.has(group.root) || partitionScenes.has(group.scene) || [tree.scene, tree.camera].includes(group.scene)) fail('depth group must own an independent projected carrier');
      roots.add(group.root); partitionScenes.add(group.scene);
    }
    function order(entry: PreparedDepthOrder, depth = 0) {
      if (depth > 64) fail('depth order exceeds prepared traversal bound');
      if ('group' in entry) {
        record(entry, 'depth leaf', ['group']); integer(entry.group, 'depth group index');
        if (entry.group >= groups.length || ordered.has(entry.group)) fail('depth order requires each group exactly once');
        ordered.add(entry.group);
      } else if ('sequence' in entry) {
        record(entry, 'depth sequence', ['sequence']);
        const sequence = array(entry.sequence, 'depth sequence');
        if (sequence.length < 2 || sequence.length > groups.length) fail('depth sequence requires 2 to group-count entries');
        for (const child of sequence) order(child, depth + 1);
      } else {
        record(entry, 'depth split', ['plane', 'back', 'front']);
        if (array(entry.plane, 'depth plane').length !== 4 || !entry.plane.every(Number.isFinite) ||
            Math.abs(Math.hypot(...entry.plane.slice(0, 3)) - 1) > 1e-6) fail('depth split requires a normalized finite plane');
        order(entry.back, depth + 1); order(entry.front, depth + 1);
      }
    }
    order(partition.order);
    if (ordered.size !== groups.length) fail('depth order must cover every group');
  }
  function attribute(name: string) { if (!/^(?:data-[a-z0-9-]+|aria-[a-z0-9-]+)$/.test(name)) fail(`unsupported attribute ${name}`); }
  const forbiddenProperty = /^(?:transform|scale|rotate|perspective)$/;
  const activationTargets = new Set(tree.activationGroups?.flat() ?? []);
  function write(binding: PreparedWrite) {
    record(binding, "selection binding", ["kind", "target", "name", "value", "resource", "quoted"]);
    node(binding.target, true); string(binding.name, "binding name");
    if (binding.kind === 'style' && binding.name === 'display' && activationTargets.has(binding.target)) fail('selection display cannot race prepared activation');
    choice(binding.kind, new Set(["style", "texture", "attribute", "class"]), "selection binding");
    if (binding.kind === "texture") { resource(binding.resource, true); if (typeof binding.quoted !== "boolean") fail("texture quote mode is required"); }
    else if (binding.kind === "class") { if (typeof binding.value !== "boolean") fail("class binding must be boolean"); }
    else if (binding.kind === "attribute") { attribute(binding.name); if (binding.value !== null && typeof binding.value !== "string") fail("attribute binding must be a string or null"); }
    else if (typeof binding.value !== "string" || forbiddenProperty.test(binding.name)) fail("selection style cannot own camera or pose publication");
    if (binding.target === tree.camera || binding.target === tree.scene) fail("selection bindings cannot write camera/scene state");
  }
  const tracks = array(plan.materials, "materials"); unique(tracks.map(track => track.id), "material tracks");
  const trackMap = new Map(tracks.map(track => [track.id, track]));
  for (const track of tracks) {
    record(track, "material", ["id", "target", "frame", "defaultFrame", "banks", "rotation", "frameAttribute", "modeAttribute", "quoted", "farBank"]);
    string(track.id, "track id"); node(track.target);
    if ([tree.camera, tree.scene].includes(track.target)) fail("material target cannot own camera transforms");
    frameMapping(track.frame);
    integer(track.defaultFrame, "default frame");
    if (track.defaultFrame >= track.frame.count) fail("default frame is outside prepared addresses");
    array(track.banks, "material banks"); unique(track.banks.map(bank => bank.id), "material banks");
    if (!track.banks.length) fail("material banks are empty");
    // A far bank (optional) replaces the selected bank while the camera's
    // published level of detail is past the geometry stage: the same frames
    // from one small atlas, so the row shards stop streaming.
    if (track.farBank !== undefined) {
      string(track.farBank, "far bank");
      const far = track.banks.find(bank => bank.id === track.farBank);
      if (!far) fail("undeclared far bank");
      if (!far.rows?.length) fail("far bank requires prepared rows");
      if (!far.fixed) fail("far bank requires a fixed address");
    }
    for (const bank of track.banks) {
      record(bank, "bank", ["id", "frames", "default", "fixed", "rows"]); string(bank.id, "bank id");
      if (array(bank.frames, "frame addresses").length !== track.frame.count) fail("every material frame requires a prepared address");
      bank.frames.forEach((value, index) => { address(value); if (value.frame !== index) fail("frame addresses must be ordered"); });
      if (bank.default !== null) address(bank.default);
      if (bank.fixed !== null) address(bank.fixed);
      if (bank.rows !== undefined) {
        array(bank.rows, "prepared rows").forEach((row, index) => {
          record(row, "prepared row", ["row", "resource", "firstFrame", "lastFrame"]);
          if (row.row !== index) fail("prepared rows must be ordered");
          resource(row.resource); integer(row.firstFrame, "first row frame"); integer(row.lastFrame, "last row frame");
          if (row.firstFrame > row.lastFrame || row.lastFrame >= bank.frames.length) fail("prepared row extent is invalid");
          for (let frame = row.firstFrame; frame <= row.lastFrame; frame++) {
            if (bank.frames[frame].row !== index || bank.frames[frame].resource !== row.resource) fail("row and frame addresses disagree");
          }
        });
      }
    }
    if (track.rotation !== null) {
      record(track.rotation, "rotation", ["kind", "reference", "baseDegrees", "zeroAtPole", "property", "width", "height", "projection", "polePolicy", "systemTransform", "onlyWhenEnabled", "publishWithAddress", "physical"]);
      choice(track.rotation.kind, new Set(["angle", "planar", "ellipsoid"]), "rotation kind");
      choice(track.rotation.reference, new Set(["prepared", "initial"]), "rotation reference");
      finite(track.rotation.baseDegrees, "rotation base");
      if (typeof track.rotation.zeroAtPole !== "boolean") fail("pole rotation policy is required");
      for(const key of ["onlyWhenEnabled","publishWithAddress"] as const)if(track.rotation[key]!==undefined&&typeof track.rotation[key]!=="boolean")fail(`rotation ${key} must be boolean`);
      if(track.rotation.systemTransform!==undefined)string(track.rotation.systemTransform,"rotation system transform");
      if (track.rotation.polePolicy !== undefined && track.rotation.polePolicy !== "azimuth") fail("unsupported pole azimuth policy");
      if (track.rotation.kind === "angle") string(track.rotation.property, "angle property");
      else { finite(track.rotation.width, "rotation width"); finite(track.rotation.height, "rotation height"); if (track.rotation.width <= 0 || track.rotation.height <= 0) fail("rotation size must be positive"); }
      if (track.rotation.kind === "ellipsoid") { string(track.rotation.systemTransform,"ellipsoid system transform"); projection(track.rotation.projection); }
      if(track.rotation.physical!==undefined){
        const physical=track.rotation.physical;
        record(physical,"physical material projection",["width","height","systemTransform","projection"]);
        finite(physical.width,"physical material width");finite(physical.height,"physical material height");
        if(!(physical.width>0)||!(physical.height>0))fail("physical material size must be positive");
        string(physical.systemTransform,"physical material system transform");projection(physical.projection);
      }
    }
    if (track.frameAttribute !== null) attribute(track.frameAttribute);
    if (track.modeAttribute !== null) attribute(track.modeAttribute);
    if (typeof track.quoted !== "boolean") fail("material quote mode is required");
  }
  function address(value: PreparedMaterialAddress) {
    record(value, "address", ["resource", "frame", "row", "backgroundPosition", "backgroundSize", "prewarm"]);
    resource(value.resource, true);
    if (value.prewarm !== undefined) resourceList(value.prewarm, "prepared neighboring rows");
    if (value.frame !== null) integer(value.frame, "address frame");
    if (value.row !== null) integer(value.row, "address row");
    string(value.backgroundPosition, "background position"); string(value.backgroundSize, "background size");
  }
  function frameMapping(value: PreparedMaterialFrameMapping & { count: number }) {
    record(value, "frame mapping", ["count", "thresholds", "indices"]);
    integer(value.count, "frame count", 1);
    const thresholds = array(value.thresholds, "phase thresholds");
    if (thresholds.some((phase, i) => !Number.isFinite(phase) || phase < -1 || phase > 1 || i > 0 && phase <= thresholds[i-1])) fail("phase thresholds must increase within the light domain");
    if (array(value.indices, "phase frames").length !== thresholds.length+1 || value.indices.some(frame => !Number.isSafeInteger(frame) || frame < 0 || frame >= value.count)) fail("phase frames must address the prepared bank");

  }
  function matrix(values: unknown, label: string) { if (!isArray(values) || values.length !== 16 || !values.every(Number.isFinite)) fail(`${label} must be a finite prepared matrix`); }
  function projection(value: EllipsoidProjectionPlan) {
    record(value, "ellipsoid projection", ["equatorialRadius", "polarRadius", "coverageScale", "bodySystemMatrix", "bodyMeshMatrix", "materialSystemMatrix", "materialMeshMatrix", "baseProjection", "centerTranslation", "inverseCenterTranslation", "counterPrecision", "counterFractionDigits", "counterFractionScale","textureEllipse"]);
    for (const key of ["equatorialRadius", "polarRadius", "coverageScale"] as const) if (!(value[key] > 0)) fail(`projection ${key} must be positive`);
    if(value.counterPrecision!==undefined&&(!Number.isInteger(value.counterPrecision)||value.counterPrecision<1||value.counterPrecision>16))fail("projection counter precision must be bounded");
    if(value.counterFractionDigits!==undefined&&(!Number.isInteger(value.counterFractionDigits)||value.counterFractionDigits<1||value.counterFractionDigits>16||!Number.isFinite(value.counterFractionScale)||(value.counterFractionScale ?? NaN)<=0||value.counterPrecision===undefined))fail("projection fractional precision must be bounded");
    if(value.counterFractionScale!==undefined&&value.counterFractionDigits===undefined)fail("projection fractional scale requires precision");
    for (const key of ["bodySystemMatrix", "bodyMeshMatrix", "materialSystemMatrix", "materialMeshMatrix", "baseProjection", "centerTranslation", "inverseCenterTranslation"] as const) matrix(value[key], key);
    if(value.textureEllipse!==undefined){
      const ellipse=value.textureEllipse;record(ellipse,"texture ellipse",["center","covariance"]);
      if(!isArray(ellipse.center)||ellipse.center.length!==2||!ellipse.center.every(Number.isFinite)||
        !isArray(ellipse.covariance)||ellipse.covariance.length!==3||!ellipse.covariance.every(Number.isFinite))fail("texture ellipse must be finite");
      const [xx,xy,yy]=ellipse.covariance;
      if(!(xx>0)||!(xx*yy-xy*xy>0))fail("texture ellipse covariance must be positive definite");
    }
  }
  const lensIds = (controls.lenses?.controls ?? []).map(lens => lens.id);
  const settings = new Map((controls.settings?.controls ?? []).map(control => [control.name, control]));
  if (plan.destinations !== undefined) {
    record(plan.destinations, "destinations", ["catalog", "defaultLens", "statuses"]);
    const {catalog,defaultLens,statuses}=plan.destinations;
    if (!catalog?.url?.startsWith("/scenes/") || !Number.isSafeInteger(catalog.bytes) || catalog.bytes < 1 ||
        !Number.isSafeInteger(catalog.count) || catalog.count < 1 || !/^[a-f0-9]{64}$/.test(catalog.sha256??"") ||
        !lensIds.includes(defaultLens)) fail("destinations require a pinned catalogue and declared lens");
    record(statuses,"destination statuses",["detail","overview"]); string(statuses.detail,"detail status");string(statuses.overview,"overview status");
  }
  if (plan.features !== undefined) {
    const features = plan.features;
    record(features, "surface features", ["catalog", "selection", "target", "lensIds", "meshRadiusUnits", "policy", "outline", "surfaceRadiusUnits", "surfaceEllipsoidUnits"]);
    record(features.catalog, "surface feature catalog", ["url", "bytes", "sha256", "count"]);
    if (!features.catalog.url?.startsWith("/scenes/") || !/^[a-f0-9]{64}$/.test(features.catalog.sha256 ?? "")) fail("surface features require a pinned catalogue");
    integer(features.catalog.bytes, "feature catalog bytes", 1); integer(features.catalog.count, "feature catalog count", 1);
    if (features.selection !== undefined) {
      const selection = features.selection;
      record(selection, "surface feature selection", ["count", "banks"]);
      integer(selection.count, "surface feature selection count", 1);
      const count = selection.count;
      const banks = array(selection.banks, "surface feature selection banks");
      if (!banks.length || banks.length > 256) fail("surface feature selection banks are out of range");
      let found = 0; const urls: string[] = [];
      for (const bank of banks) {
        record(bank, "surface feature selection bank", ["url", "bytes", "sha256", "count"]);
        if (!bank.url?.startsWith("/scenes/") || !/^[a-f0-9]{64}$/.test(bank.sha256 ?? "")) fail("surface feature selection requires pinned banks");
        integer(bank.bytes, "feature selection bank bytes", 1); integer(bank.count, "feature selection bank count", 1); found += bank.count; urls.push(bank.url);
      }
      unique(urls, "surface feature selection bank URLs");
      if (found !== count) fail("surface feature selection bank counts drifted");
    }
    node(features.target); if (!ancestor(features.target, tree.scene)) fail("surface feature target must belong to scene");
    const lenses = array(features.lensIds, "surface feature lenses"); unique(lenses, "surface feature lenses");
    if (!lenses.length || lenses.some(id => !lensIds.includes(id))) fail("surface features require declared lenses");
    finite(features.meshRadiusUnits, "surface feature mesh radius"); if (!(features.meshRadiusUnits > 0)) fail("surface feature mesh radius must be positive");
    if (features.surfaceRadiusUnits !== undefined) {
      record(features.surfaceRadiusUnits, "surface feature radius band", ["minimum", "maximum"]);
      finite(features.surfaceRadiusUnits.minimum, "surface feature radius minimum"); finite(features.surfaceRadiusUnits.maximum, "surface feature radius maximum");
      if (!(features.surfaceRadiusUnits.minimum > 0) || features.surfaceRadiusUnits.maximum < features.surfaceRadiusUnits.minimum) fail("surface feature radius band is invalid");
    }
    if (features.surfaceEllipsoidUnits !== undefined) {
      if (features.surfaceRadiusUnits !== undefined) fail("surface features declare one surface model");
      const ellipsoid = features.surfaceEllipsoidUnits;
      record(ellipsoid, "surface feature ellipsoid", ["equatorial", "polar", "north", "minimumShare", "maximumShare"]);
      finite(ellipsoid.equatorial, "surface feature equatorial semi-axis"); finite(ellipsoid.polar, "surface feature polar semi-axis");
      if (!(ellipsoid.polar > 0) || ellipsoid.polar > ellipsoid.equatorial || Math.abs(ellipsoid.equatorial - features.meshRadiusUnits) > 1e-6 * ellipsoid.equatorial) fail("surface feature ellipsoid semi-axes must fit the mesh radius");
      const north = array(ellipsoid.north, "surface feature polar axis"); north.forEach(n => finite(n, "surface feature polar axis"));
      if (north.length !== 3 || Math.abs(Math.hypot(north[0], north[1], north[2]) - 1) > 1e-9) fail("surface feature polar axis must be a unit axis");
      finite(ellipsoid.minimumShare, "surface feature ellipsoid minimum share"); finite(ellipsoid.maximumShare, "surface feature ellipsoid maximum share");
      if (!(ellipsoid.minimumShare > 0) || ellipsoid.minimumShare > 1 || ellipsoid.maximumShare < 1 || ellipsoid.maximumShare < ellipsoid.minimumShare) fail("surface feature ellipsoid band must contain the reference surface");
    }
    record(features.policy, "surface feature policy", ["minimumZoomShare", "minimumDiameterPixels", "alwaysVisibleCount", "maximumVisible", "limbCosine"]);
    finite(features.policy.minimumZoomShare, "surface feature zoom share"); if (features.policy.minimumZoomShare < 0 || features.policy.minimumZoomShare > 1) fail("surface feature zoom share is out of range");
    finite(features.policy.minimumDiameterPixels, "surface feature size floor"); if (!(features.policy.minimumDiameterPixels > 0)) fail("surface feature size floor must be positive");
    integer(features.policy.alwaysVisibleCount, "surface feature head count"); integer(features.policy.maximumVisible, "surface feature cap", 1);
    finite(features.policy.limbCosine, "surface feature limb cosine"); if (features.policy.limbCosine < 0 || features.policy.limbCosine >= 1) fail("surface feature limb cosine is out of range");
    record(features.outline, "surface feature outline", ["pieces"]); integer(features.outline.pieces, "surface feature outline pieces", 8);
    if (features.outline.pieces > 512) fail("surface feature outline pool is too large");
  }
  if (plan.motionFrame !== undefined) {
    if (!array(plan.motionFrame,"motion frame").length) fail("motion frame is empty");
    unique(plan.motionFrame,"motion frame");
    for(const id of plan.motionFrame) {node(id);if(!ancestor(id,tree.scene))fail("motion frame must belong to scene");}
  }
  if (plan.surfaceHit !== undefined) {
    const hit = plan.surfaceHit;
    record(hit, 'surface hit', ['target', 'triangles', 'frontFace', 'lensRanges']); node(hit.target);
    if (hit.frontFace !== undefined && !['clockwise','counter-clockwise'].includes(hit.frontFace)) fail('invalid surface front face');
    if (!ancestor(hit.target, tree.scene)) fail('surface hit target must belong to scene');
    const triangles = array(hit.triangles, 'surface hit triangles');
    if (!triangles.length || triangles.length > 10000) fail('surface hit mesh exceeds its bounds');
    if (hit.lensRanges !== undefined) {
      const ranges = array(hit.lensRanges, 'surface lens ranges');
      if (ranges.length !== lensIds.length || new Set(ranges.map(range => range.lensId)).size !== ranges.length) fail('surface ranges must cover every lens once');
      for (const range of ranges) {
        record(range, 'surface lens range', ['lensId', 'start', 'count']);
        if (!lensIds.includes(range.lensId) || !Number.isSafeInteger(range.start) || range.start < 0 ||
            !Number.isSafeInteger(range.count) || range.count < 1 || range.start + range.count > triangles.length) fail('invalid surface lens range');
      }
    }
    for (const triangle of triangles) {
      if (!isArray(triangle) || triangle.length !== 3 || triangle.some(point =>
        !isArray(point) || point.length !== 3 || point.some(n => !Number.isFinite(n)))) fail('surface hit requires finite prepared triangles');
    }
  }
  const variants = array(plan.variants, "selection variants");
  for (const variant of variants) {
    record(variant, "variant", ["when", "required", "writes", "materials", "navigation", "hiddenSubtrees"]);
    if (variant.hiddenSubtrees !== undefined) {
      const containers = new Set(plan.tree.nodes.map(node => node.parent)), hidden = new Set();
      const holds = (root: number, id: number) => { for (let at = id; at >= 0; at = plan.tree.nodes[at].parent) if (at === root) return true; return false; };
      for (const root of array(variant.hiddenSubtrees, "hidden subtrees")) {
        if (typeof root !== "number" || !Number.isInteger(root) || root < 0 || root >= plan.tree.nodes.length || !containers.has(root) || holds(root, plan.tree.camera) || holds(root, plan.tree.scene) || hidden.has(root))
          fail("a hidden subtree must be a unique container outside the camera and scene path");
        hidden.add(root);
      }
    }
    if(variant.navigation!==undefined) {
      record(variant.navigation,"navigation",["maximumZoom","camera"]);
      const {maximumZoom,camera}=variant.navigation;
      if(!Number.isFinite(maximumZoom)||maximumZoom<plan.camera.minimumZoom||maximumZoom>plan.camera.maximumZoom)fail("navigation zoom must be bounded");
      if(camera!==null) {
        record(camera,"navigation camera",["controlPitch","controlYaw","controlRoll","zoom","transition"]);
        if(camera.transition!==undefined) {
          record(camera.transition,"camera transition",["durationMilliseconds","preserveZoom"]);
          if(!Number.isFinite(camera.transition.durationMilliseconds)||camera.transition.durationMilliseconds<=0||camera.transition.durationMilliseconds>10000||typeof camera.transition.preserveZoom!=="boolean")fail("camera transition must be bounded");
        }
        if(camera.controlRoll!==undefined&&!Number.isFinite(camera.controlRoll))fail("navigation roll must be finite");
        if(![camera.controlPitch,camera.controlYaw,camera.zoom].every(Number.isFinite)||camera.zoom<plan.camera.minimumZoom||camera.zoom>maximumZoom)fail("navigation camera must be bounded");
      }
    }
    record(variant.when, "selection key", ["lensId", ...settings.keys()]);
    if (lensIds.length ? !lensIds.includes(String(variant.when.lensId)) : Object.hasOwn(variant.when, "lensId")) fail("variant must match the declared lens capability");
    for (const [key, value] of Object.entries(variant.when)) if (key !== "lensId") {
      const control = settings.get(key);
      if (!control || control.kind !== "toggle" || typeof value !== "boolean") fail("presentation variants may only bind discrete toggle settings");
    }
    resourceList(variant.required, "required selection resources");
    array(variant.writes, "selection writes").forEach(write);
    const materials = array(variant.materials, "selected materials");
    unique(materials.map(value => value.track), "selected tracks");
    if (materials.length !== tracks.length) fail("each variant must specify every material track");
    for (const selected of materials) {
      record(selected, "selected material", ["track", "bank", "mode", "enabled", "rotationEnabled", "frameOverride", "frameOffset", "clearWhenHidden", "fixedMode", "modeLabel", "addressAttributes", "publishWhenHidden"]);
      const track = trackMap.get(selected.track);
      if (!track || !track.banks.some(bank => bank.id === selected.bank)) fail("undeclared selected material bank");
      choice(selected.mode, new Set(["frames", "fixed"]), "selected material mode");
      for (const key of ["enabled", "rotationEnabled", "clearWhenHidden"] as const) if (typeof selected[key] !== "boolean") fail(`selected ${key} must be boolean`);
      if (selected.frameOverride !== null && (!Number.isSafeInteger(selected.frameOverride) || selected.frameOverride < 0 || selected.frameOverride >= track.frame.count)) fail("frame override is outside prepared addresses");
      if (selected.frameOffset !== undefined && (!Number.isSafeInteger(selected.frameOffset) || selected.frameOffset < 0 ||
          selected.frameOffset > 0 && selected.frameOffset <= Math.max(...track.frame.indices) ||
          selected.frameOffset+Math.max(...track.frame.indices)>=track.frame.count)) fail("frame offset is outside prepared addresses");
      if(selected.publishWhenHidden!==undefined)choice(selected.publishWhenHidden,new Set(["always","static","never"]),"hidden address publication");
      string(selected.fixedMode, "fixed mode");
      if (selected.modeLabel !== undefined) string(selected.modeLabel, "material observation mode");
      for (const binding of array(selected.addressAttributes ?? [], "address attributes")) {
        record(binding, "address attribute", ["name", "source", "value"]); attribute(binding.name);
        choice(binding.source, new Set(["frame", "mode", "mode-or-frame", "literal"]), "address attribute source");
        if (binding.source !== "literal" && binding.value !== null || binding.value !== null && typeof binding.value !== "string") fail("address attribute value must be a literal string or null");
      }
      const bank = track.banks.find(bank => bank.id === selected.bank);
      if (selected.mode === "fixed" && !bank!.fixed) fail("selected mode requires its prepared address");
    }
  }
  const toggleNames = [...new Set(variants.flatMap(variant => Object.keys(variant.when).filter(key => key !== "lensId")))];
  if (toggleNames.length > 12) fail("selection table exceeds bounded toggle combinations");
  for (const lensId of lensIds.length ? lensIds : [null]) for (let index = 0; index < 2 ** toggleNames.length; index++) {
    const state: Record<string, string | boolean | null> = { lensId, ...Object.fromEntries(toggleNames.map((name, bit) => [name, !!(index & 2 ** bit)])) };
    if (variants.filter(variant => Object.entries(variant.when).every(([key, value]) => state[key] === value)).length !== 1) fail(`selection table must cover ${JSON.stringify(state)} exactly once`);
  }
  for (const binding of array(plan.viewBindings, "view bindings")) {
    record(binding, "view binding", ["kind", "target", "property", "systemTransform", "source", "precision", "minimumRadius", "unitScale", "hysteresis", "levels", "sceneFromBody", "radii", "inset", "slices"]);
    choice(binding.kind, new Set(["counter-rotation", "view-attribute", "view-property", "silhouette-fit", "silhouette-step-property", "interior-disc"]), "view binding");
    // The stage itself may carry a published level-of-detail attribute or
    // property; every other binding names a retained node.
    node(binding.target, ["view-attribute", "view-property"].includes(binding.kind));
    if ([tree.camera, tree.scene].includes(binding.target) && binding.kind !== "view-attribute") fail("view binding cannot duplicate the camera publisher");
    if (binding.kind === "interior-disc") {
      const matrix = array(binding.sceneFromBody, "interior disc frame"), radii = array(binding.radii, "interior disc radii");
      matrix.forEach(value => finite(value, "interior disc frame")); radii.forEach(value => finite(value, "interior disc radius"));
      if (matrix.length !== 16 || [3, 7, 11].some(index => matrix[index] !== 0) || matrix[15] !== 1 || radii.length !== 3 || radii.some(value => value <= 0) ||
          !(binding.inset > 0 && binding.inset < 1) || !Number.isFinite(binding.inset) || tree.nodes[binding.target].parent !== tree.scene ||
          plan.camera.projection?.model !== "css-perspective-shared-with-sky") fail("interior disc requires an affine frame inside the perspective scene");
    } else if (binding.kind === "silhouette-fit") {
      // The overlay fitted to the projected silhouette a perspective camera
      // publishes (see perspective-dolly.mjs), never below a prepared radius.
      if (!(binding.minimumRadius >= 0) || !(binding.unitScale > 0)) fail("silhouette fit requires a prepared floor and unit scale");
      if (!plan.camera.projection || plan.camera.projection.model !== "css-perspective-shared-with-sky") fail("silhouette fit requires the perspective camera");
    } else if (binding.kind === "silhouette-step-property") {
      // A prepared value per published silhouette step; thresholds are CSS pixels.
      string(binding.property, "silhouette step property");
      if (!binding.property.startsWith("--")) fail("silhouette step property must be a custom property");
      finite(binding.hysteresis, "silhouette step hysteresis");
      if (binding.hysteresis < 0 || binding.hysteresis >= 1) fail("silhouette step hysteresis must be in [0, 1)");
      const levels = array(binding.levels, "silhouette steps");
      if (levels.length < 2 || levels.length > 64) fail("silhouette steps must hold 2 to 64 levels");
      let previous = -1;
      for (const [index, level] of levels.entries()) {
        record(level, "silhouette step", ["minimumDiameter", "value"]);
        finite(level.minimumDiameter, "silhouette step diameter"); string(level.value, "silhouette step value");
        if (index === 0 ? level.minimumDiameter !== 0 : level.minimumDiameter <= previous) fail("silhouette steps must start at 0 and increase");
        previous = level.minimumDiameter;
      }
    } else if (binding.kind === "view-property") {
      string(binding.property, "view property");
      if (!binding.property.startsWith("--")) fail("view property must be a custom property");
      choice(binding.source, new Set(["billboard-opacity", "marker-opacity"]), "view property source");
      if (binding.precision !== null) { integer(binding.precision, "view property precision"); if (binding.precision > 12) fail("invalid view property precision"); }
    } else if (binding.kind === "view-attribute") {
      attribute(binding.property);
      choice(binding.source, new Set(["scene-pitch", "control-yaw", "zoom", "scene-matrix", "level-of-detail-stage"]), "view attribute source");
      if (binding.target === -1 && binding.source !== "level-of-detail-stage") fail("only the level of detail is published on the stage");
      if (binding.precision !== null) { integer(binding.precision, "view attribute precision"); if (binding.precision > 12 || binding.source === "scene-matrix") fail("invalid view attribute precision"); }
    } else if (binding.systemTransform !== null && typeof binding.systemTransform !== "string") fail("counter rotation needs its immutable prepared transform");
  }
  for (const animation of array(plan.animations, "animations")) {
    record(animation, "animation", ["target", "id", "keyframes", "duration", "mode", "sourceMinimum", "millisecondsPerDegree"]);
    node(animation.target); string(animation.id, "animation id");
    if ([tree.camera, tree.scene].includes(animation.target)) fail("prepared animation cannot target the camera or scene");
    if (animation.mode !== "pose" || !(animation.duration > 0)) fail("unsupported prepared animation");
    finite(animation.sourceMinimum, "animation minimum"); finite(animation.millisecondsPerDegree, "animation time mapping");
    if (!array(animation.keyframes, "keyframes").length) fail("prepared animation has no keyframes");
    for (const frame of animation.keyframes) { record(frame, "keyframe", ["offset", "transform"]); finite(frame.offset, "keyframe offset"); string(frame.transform, "keyframe transform"); }
  }
  if (plan.motion !== undefined) for (const animation of array(plan.motion, "motion")) {
    record(animation, "motion", ["target", "id", "keyframes", "duration", "timings"]);
    node(animation.target); string(animation.id, "motion id");
    for (const timing of array(animation.timings, "motion timings")) {
      record(timing, "motion timing", ["when", "duration"]);
      if (!timing.when || typeof timing.when !== 'object' || isArray(timing.when) || !(timing.duration > 0)) fail("invalid motion timing");
    }
    if ([tree.camera, tree.scene].includes(animation.target) || !(animation.duration > 0)) fail("unsupported prepared motion");
    if (!array(animation.keyframes, "motion keyframes").length) fail("prepared motion has no keyframes");
    for (const frame of animation.keyframes) {
      record(frame, "keyframe", ["offset", "transform"]); finite(frame.offset, "keyframe offset"); string(frame.transform, "keyframe transform");
      if (frame.offset < 0 || frame.offset > 1) fail("motion offset must be within animation");
    }
  }
  if (plan.facing !== undefined) {
    const targets = new Set();
    for (const face of array(plan.facing, 'facing planes')) {
      record(face, 'facing plane', ['target', 'plane', 'tolerance']); node(face.target);
      if (!(Number.isFinite(face.tolerance) && face.tolerance > 0)) fail('native backface tolerance must be positive');
      if ([tree.camera, tree.scene].includes(face.target) || targets.has(face.target) || tree.nodes.some(node => node.parent === face.target)) fail('facing target must be a unique prepared leaf');
      if (!ancestor(face.target, tree.scene) && ![...partitionScenes].some(scene => ancestor(face.target, scene))) fail('facing target must belong to scene');
      targets.add(face.target);
      if (array(face.plane, 'facing plane coordinates').length !== 4) fail('facing plane needs four coordinates');
      face.plane.forEach(value => finite(value, 'facing plane coordinate'));
      if (Math.abs(Math.hypot(...face.plane.slice(0, 3)) - 1) > 1e-6) fail('facing plane must have a unit normal');
    }
  }
  return plan;
}
