import { requireObjectControls } from "../../site/scene-contract.mjs";
import { validatePreparedCubicSky } from "./cubic-sky-contract.mjs";
import { validateDirectionalSunPlan } from "./directional-sun-contract.mjs";
import { validatePreparedHeliocentricView } from "./heliocentric-view.mjs";

export const PREPARED_PRESENTATION_SCHEMA = "cssearth-prepared-presentation@1";
export const PREPARED_OBJECT_RUNTIME_SCHEMA = "cssearth-object-runtime@2";
const tags = new Set(["div", "span", "s", "b", "u"]);
const frameSources = new Set(["sun-z", "prepared-light-z", "scene-pitch", "reference-sun-z"]);
const demandModes = new Set(["current", "visible", "visible-directional", "away-enabled-or-lens-change", "neighborhood"]);
const materialFields = new Set(["bank", "frame", "calculatedFrame", "appliedFrame", "appliedRow", "row", "mode", "lightRollDegrees", "addressWrites", "transformWrites", "enabled", "rotationEnabled", "sunViewDirection"]);
const fail = message => { throw new TypeError(`Prepared presentation: ${message}.`); };
const scalar = value => value === null || ["string", "boolean"].includes(typeof value) || typeof value === "number" && Number.isFinite(value);
const string = (value, label) => { if (typeof value !== "string" || !value.length) fail(`${label} must be a nonempty string`); };
const finite = (value, label) => { if (!Number.isFinite(value)) fail(`${label} must be finite`); };
const integer = (value, label, minimum = 0) => { if (!Number.isSafeInteger(value) || value < minimum) fail(`${label} must be an integer at least ${minimum}`); };
const choice = (value, choices, label) => { if (!choices.has(value)) fail(`unsupported ${label}: ${value}`); };
function record(value, label, fields) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} must be a plain record`);
  for (const key of Object.keys(value)) if (!fields.includes(key)) fail(`unsupported ${label} field ${key}`);
}
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value; }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} has duplicate identities`); }

// This is also used before serialization. Getters, cycles, symbols and callable
// payloads are rejected before accessing values; JSON coercion is not validation.
export function requirePreparedData(value, label = "data", seen = new Set()) {
  if (scalar(value)) return value;
  if (!value || typeof value !== "object" || seen.has(value) ||
      ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))) fail(`${label} must contain only acyclic JSON data`);
  if (Object.getOwnPropertySymbols(value).length) fail(`${label} cannot contain symbols`);
  seen.add(value);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) fail(`${label}.${key} cannot be executable`);
    requirePreparedData(descriptor.value, `${label}.${key}`, seen);
  }
  seen.delete(value);
  return value;
}

export function requirePreparedPresentation(plan, { controls, assets = plan?.assets } = {}) {
  requirePreparedData(plan);
  record(plan, "plan", ["schema", "camera", "sky", "sun", "inputSelector", "assets", "tree", "variants", "materials", "viewBindings", "animations", "observations", "resourceOrder", "destinations", "motionFrame", "pageLayers", "heliocentricView"]);
  if (plan.resourceOrder !== undefined) choice(plan.resourceOrder, new Set(["content-first", "materials-first"]), "resource order");
  if (plan.schema !== PREPARED_PRESENTATION_SCHEMA) fail("schema is incompatible");
  requireObjectControls(controls);
  validatePreparedCubicSky(plan.sky, { requireSun: false });
  if (plan.sun !== null) validateDirectionalSunPlan(plan.sun);
  if (!(plan.camera?.sceneScale > 0) || !(plan.camera.minimumZoom > 0) || !(plan.camera.maximumZoom >= plan.camera.minimumZoom)) fail("camera plan is incomplete");
  if (plan.inputSelector !== null) string(plan.inputSelector, "input selector");
  if (plan.heliocentricView !== undefined) heliocentricView(plan.heliocentricView, plan);
  if (!Array.isArray(assets?.entries)) fail("resource catalog is missing");
  const resources = new Set(assets.entries.map(entry => entry.key));
  const resource = (key, nullable = false) => { if (!(nullable && key === null) && !resources.has(key)) fail(`undeclared resource ${key}`); };
  const resourceList = (list, label) => { array(list, label).forEach(key => resource(key)); unique(list, label); };
  const tree = plan.tree;
  record(tree, "tree", ["nodes", "properties", "camera", "scene", "registrations", "stageClasses"]);
  for (const property of array(tree.properties,"prepared style properties")) {
    record(property,"prepared style property",["name","value","custom"]);string(property.name,"prepared property name");
    if(typeof property.value!=="string"||typeof property.custom!=="boolean")fail("prepared property assignment is invalid");
    if(/^(?:clipPath|mask.*|filter|mixBlendMode|backgroundBlendMode)$/.test(property.name)||/(?:linear|radial|conic)-gradient\s*\(/i.test(property.value))fail("unsupported scene property");
  }
  array(tree.nodes, "nodes");
  if (!tree.nodes.length) fail("retained tree is empty");
  const node = (id, stage = false) => { integer(id, "node reference", stage ? -1 : 0); if (id >= tree.nodes.length) fail(`undeclared node ${id}`); };
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
  if (tree.nodes.filter(entry => /(?:^|\s)polycss-camera(?:\s|$)/.test(entry.className)).length !== 1 ||
      !/(?:^|\s)polycss-camera(?:\s|$)/.test(tree.nodes[tree.camera].className)) fail("tree requires exactly one camera");
  if (tree.nodes.filter(entry => /(?:^|\s)polycss-scene(?:\s|$)/.test(entry.className)).length !== 1) fail("tree requires exactly one scene");
  array(tree.stageClasses, "stage classes").forEach(value => string(value, "stage class"));
  if (!array(tree.registrations, "registrations").length) fail("body-layer registration is required");
  for (const registration of tree.registrations) {
    record(registration, "registration", ["bodySystem", "lightingOverlays"]); node(registration.bodySystem);
    if (!ancestor(registration.bodySystem, tree.scene)) fail("body system must belong to the scene");
    if (!array(registration.lightingOverlays, "lighting overlays").length) fail("lighting overlays are missing");
    registration.lightingOverlays.forEach(id => node(id)); unique(registration.lightingOverlays, "lighting overlays");
  }
  function ancestor(child, parent) { for (let id = tree.nodes[child]?.parent; id >= 0; id = tree.nodes[id].parent) if (id === parent) return true; return false; }
  function attribute(name) { if (!/^(?:data-[a-z0-9-]+|aria-[a-z0-9-]+)$/.test(name)) fail(`unsupported attribute ${name}`); }
  const forbiddenProperty = /^(?:transform|scale|rotate|perspective)$/;
  function write(binding) {
    record(binding, "selection binding", ["kind", "target", "name", "value", "resource", "quoted"]);
    node(binding.target, true); string(binding.name, "binding name");
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
    record(track, "material", ["id", "target", "frame", "defaultPose", "banks", "demand", "rotation", "frameAttribute", "modeAttribute", "quoted", "farBank"]);
    string(track.id, "track id"); node(track.target);
    if ([tree.camera, tree.scene].includes(track.target)) fail("material target cannot own camera transforms");
    frameMapping(track.frame);
    array(track.defaultPose, "default pose").forEach(test => {
      record(test, "pose test", ["source", "scale", "offset", "value", "epsilon"]);
      choice(test.source, new Set(["control-pitch", "control-yaw", "frame"]), "pose source");
      for (const key of ["scale", "offset", "value", "epsilon"]) finite(test[key], `pose ${key}`);
      if (test.epsilon <= 0) fail("pose epsilon must be positive");
    });
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
    record(track.demand, "demand", ["mode", "prewarm", "capacity", "framesPerRow", "defaultFrame", "defaultRow", "initialRows", "holdHiddenNeighborhood", "fallback", "preserveFrameWhenFixed", "neighborhoodOffsets"]);
    choice(track.demand.mode, demandModes, "demand mode");
    choice(track.demand.prewarm, new Set(["none", "symmetric", "directional"]), "prewarm mode");
    choice(track.demand.fallback, new Set(["hold", "same-column", "nearest-frame"]), "missing-row policy");
    if (track.demand.fallback !== "hold" && track.banks.some(bank => !bank.rows?.length)) fail("row fallback requires prepared row extents");
    integer(track.demand.capacity, "demand capacity", 1); integer(track.demand.framesPerRow, "frames per row", 1);
    integer(track.demand.defaultFrame, "default frame");
    if (track.demand.defaultFrame >= track.frame.count) fail("default frame is outside prepared addresses");
    array(track.demand.initialRows, "initial rows").forEach(row => integer(row, "initial row"));
    if(track.demand.defaultRow!==undefined){integer(track.demand.defaultRow,"default row");if(track.banks.some(bank=>track.demand.defaultRow>=bank.rows?.length))fail("default row is outside prepared rows");}
    if (typeof track.demand.holdHiddenNeighborhood !== "boolean") fail("hidden-neighborhood policy is required");
    if (track.demand.preserveFrameWhenFixed !== undefined && typeof track.demand.preserveFrameWhenFixed !== "boolean") fail("fixed frame history policy must be boolean");
    if (track.demand.prewarm !== "none" && track.banks.some(bank => !bank.rows?.length)) fail("prewarming requires prepared rows");
    if (track.demand.mode === "away-enabled-or-lens-change" && track.banks.some(bank => !bank.rows?.length)) fail("transition demand requires prepared rows");
    if (track.demand.mode === "neighborhood") {
      const offsets = array(track.demand.neighborhoodOffsets, "neighborhood offsets");
      unique(offsets, "neighborhood offsets");
      if (!offsets.includes(0) || offsets.length * 2 > track.demand.capacity) fail("neighborhood requires committed and replacement capacity");
      if (track.demand.prewarm !== "none" || track.banks.some(bank => !bank.rows?.length)) fail("neighborhood requires prepared rows and no extra prewarming");
      for (const offset of offsets) if (!Number.isSafeInteger(offset) || Math.abs(offset) >= Math.max(...track.banks.map(bank => bank.rows.length))) fail("invalid neighborhood offset");
    } else if (track.demand.neighborhoodOffsets !== undefined) fail("neighborhood offsets require neighborhood demand");
    if (track.rotation !== null) {
      record(track.rotation, "rotation", ["kind", "source", "reference", "baseDegrees", "zeroAtPole", "property", "width", "height", "projection", "polePolicy", "systemTransform", "onlyWhenEnabled", "publishWithAddress"]);
      choice(track.rotation.kind, new Set(["angle", "planar", "ellipsoid"]), "rotation kind");
      choice(track.rotation.source, new Set(["view-sun", "prepared-light"]), "rotation source");
      choice(track.rotation.reference, new Set(["prepared", "initial"]), "rotation reference");
      finite(track.rotation.baseDegrees, "rotation base");
      if (typeof track.rotation.zeroAtPole !== "boolean") fail("pole rotation policy is required");
      for(const key of ["onlyWhenEnabled","publishWithAddress"])if(track.rotation[key]!==undefined&&typeof track.rotation[key]!=="boolean")fail(`rotation ${key} must be boolean`);
      if(track.rotation.systemTransform!==undefined)string(track.rotation.systemTransform,"rotation system transform");
      if (track.rotation.polePolicy !== undefined && track.rotation.polePolicy !== "azimuth") fail("unsupported pole azimuth policy");
      if (track.rotation.kind === "angle") string(track.rotation.property, "angle property");
      else { finite(track.rotation.width, "rotation width"); finite(track.rotation.height, "rotation height"); if (track.rotation.width <= 0 || track.rotation.height <= 0) fail("rotation size must be positive"); }
      if (track.rotation.kind === "ellipsoid") projection(track.rotation.projection);
    }
    if (track.frameAttribute !== null) attribute(track.frameAttribute);
    if (track.modeAttribute !== null) attribute(track.modeAttribute);
    if (typeof track.quoted !== "boolean") fail("material quote mode is required");
  }
  function address(value) {
    record(value, "address", ["resource", "frame", "row", "backgroundPosition", "backgroundSize"]);
    resource(value.resource, true);
    if (value.frame !== null) integer(value.frame, "address frame");
    if (value.row !== null) integer(value.row, "address row");
    string(value.backgroundPosition, "background position"); string(value.backgroundSize, "background size");
  }
  function frameMapping(value) {
    record(value, "frame mapping", ["source", "minimum", "maximum", "count", "baseFrame", "remap", "span", "maximumFrame", "step"]);
    choice(value.source, frameSources, "frame source"); finite(value.minimum, "frame minimum"); finite(value.maximum, "frame maximum");
    if (value.maximum <= value.minimum) fail("frame range must increase");
    integer(value.count, "frame count", 1); finite(value.baseFrame, "base frame");
    if (value.step !== undefined && (!Number.isFinite(value.step) || value.step <= 0 || value.span !== undefined)) fail("frame step must be positive and cannot duplicate a span");
    if (value.span !== undefined) { finite(value.span, "frame span"); if (value.span <= 0) fail("frame span must be positive"); }
    if (value.maximumFrame !== undefined) { integer(value.maximumFrame, "maximum frame"); if (value.maximumFrame >= value.count) fail("maximum frame exceeds prepared addresses"); }
    if (value.remap !== null) {
      record(value.remap, "phase remap", ["kind", "lowerTransition", "plateau", "upperTransition", "plateauViewZ"]);
      if (value.remap.kind !== "phase-plateau") fail("unsupported phase remap");
      for (const key of ["lowerTransition", "plateau", "upperTransition"]) {
        const pair = array(value.remap[key], key); if (pair.length !== 2 || !pair.every(Number.isFinite) || pair[1] <= pair[0]) fail("phase intervals must increase");
      }
      finite(value.remap.plateauViewZ, "plateau value");
      if (value.remap.lowerTransition[1] !== value.remap.plateau[0] || value.remap.plateau[1] !== value.remap.upperTransition[0]) fail("phase remap intervals must meet");
    }
  }
  function matrix(values, label) { if (!Array.isArray(values) || values.length !== 16 || !values.every(Number.isFinite)) fail(`${label} must be a finite prepared matrix`); }
  function projection(value) {
    record(value, "ellipsoid projection", ["equatorialRadius", "polarRadius", "coverageScale", "bodySystemMatrix", "bodyMeshMatrix", "materialSystemMatrix", "materialMeshMatrix", "baseProjection", "centerTranslation", "inverseCenterTranslation", "counterPrecision", "counterFractionDigits", "counterFractionScale"]);
    for (const key of ["equatorialRadius", "polarRadius", "coverageScale"]) if (!(value[key] > 0)) fail(`projection ${key} must be positive`);
    if(value.counterPrecision!==undefined&&(!Number.isInteger(value.counterPrecision)||value.counterPrecision<1||value.counterPrecision>16))fail("projection counter precision must be bounded");
    if(value.counterFractionDigits!==undefined&&(!Number.isInteger(value.counterFractionDigits)||value.counterFractionDigits<1||value.counterFractionDigits>16||!Number.isFinite(value.counterFractionScale)||value.counterFractionScale<=0||value.counterPrecision===undefined))fail("projection fractional precision must be bounded");
    if(value.counterFractionScale!==undefined&&value.counterFractionDigits===undefined)fail("projection fractional scale requires precision");
    for (const key of ["bodySystemMatrix", "bodyMeshMatrix", "materialSystemMatrix", "materialMeshMatrix", "baseProjection", "centerTranslation", "inverseCenterTranslation"]) matrix(value[key], key);
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
  if (plan.motionFrame !== undefined) {
    if (!array(plan.motionFrame,"motion frame").length) fail("motion frame is empty");
    unique(plan.motionFrame,"motion frame");
    for(const id of plan.motionFrame) {node(id);if(!ancestor(id,tree.scene))fail("motion frame must belong to scene");}
  }
  if (plan.pageLayers !== undefined) {
    const layers=array(plan.pageLayers,"page layers");unique(layers.map(layer=>layer.id),"page layers");
    for(const layer of layers) {
      record(layer,"page layer",["id","plan","carrier","system","className","textureClassName","lensIds"]);
      for(const key of ["id","className","textureClassName"])string(layer[key],`page layer ${key}`);
      for(const key of ["carrier","system"]){node(layer[key]);if(!ancestor(layer[key],tree.scene))fail("page layer must belong to scene");}
      if(!ancestor(layer.carrier,layer.system))fail("page carrier must belong to its system");
      if(!array(layer.lensIds,"page lenses").length||layer.lensIds.some(id=>!lensIds.includes(id)))fail("page layer requires declared lenses");
      if(layer.plan?.schema!=="cssearth-prepared-map-pages@1"||!/^\/scenes\/[a-z][a-z0-9-]*\/$/.test(layer.plan.assetPath??""))fail("page layer requires a prepared map plan and asset scope");
    }
  }
  const variants = array(plan.variants, "selection variants");
  for (const variant of variants) {
    record(variant, "variant", ["when", "required", "writes", "materials", "navigation"]);
    if(variant.navigation!==undefined) {
      record(variant.navigation,"navigation",["maximumZoom","camera"]);
      const {maximumZoom,camera}=variant.navigation;
      if(!Number.isFinite(maximumZoom)||maximumZoom<plan.camera.minimumZoom||maximumZoom>plan.camera.maximumZoom)fail("navigation zoom must be bounded");
      if(camera!==null) {
        record(camera,"navigation camera",["controlPitch","controlYaw","zoom"]);
        if(![camera.controlPitch,camera.controlYaw,camera.zoom].every(Number.isFinite)||camera.zoom<plan.camera.minimumZoom||camera.zoom>maximumZoom)fail("navigation camera must be bounded");
      }
    }
    record(variant.when, "selection key", ["lensId", ...settings.keys()]);
    if (!lensIds.includes(variant.when.lensId)) fail("variant must name one declared exclusive lens");
    for (const [key, value] of Object.entries(variant.when)) if (key !== "lensId") {
      const control = settings.get(key);
      if (control.kind !== "toggle" || typeof value !== "boolean") fail("presentation variants may only bind discrete toggle settings");
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
      choice(selected.mode, new Set(["frames", "default-pose", "fixed"]), "selected material mode");
      for (const key of ["enabled", "rotationEnabled", "clearWhenHidden"]) if (typeof selected[key] !== "boolean") fail(`selected ${key} must be boolean`);
      if (selected.frameOverride !== null && (!Number.isSafeInteger(selected.frameOverride) || selected.frameOverride < 0 || selected.frameOverride >= track.frame.count)) fail("frame override is outside prepared addresses");
      if (selected.frameOffset !== undefined && (!Number.isSafeInteger(selected.frameOffset) || selected.frameOffset < 0 ||
          selected.frameOffset > 0 && selected.frameOffset <= (track.frame.maximumFrame??track.frame.count-1) ||
          selected.frameOffset+(track.frame.maximumFrame??track.frame.count-1)>=track.frame.count)) fail("frame offset is outside prepared addresses");
      if(selected.publishWhenHidden!==undefined)choice(selected.publishWhenHidden,new Set(["always","static","never"]),"hidden address publication");
      string(selected.fixedMode, "fixed mode");
      if (selected.modeLabel !== undefined) string(selected.modeLabel, "material observation mode");
      for (const binding of array(selected.addressAttributes ?? [], "address attributes")) {
        record(binding, "address attribute", ["name", "source", "value"]); attribute(binding.name);
        choice(binding.source, new Set(["frame", "mode", "mode-or-frame", "literal"]), "address attribute source");
        if (binding.source !== "literal" && binding.value !== null || binding.value !== null && typeof binding.value !== "string") fail("address attribute value must be a literal string or null");
      }
      const bank = track.banks.find(bank => bank.id === selected.bank);
      if (selected.mode === "fixed" && !bank.fixed || selected.mode === "default-pose" && !bank.default) fail("selected mode requires its prepared address");
    }
  }
  const toggleNames = [...new Set(variants.flatMap(variant => Object.keys(variant.when).filter(key => key !== "lensId")))];
  if (toggleNames.length > 12) fail("selection table exceeds bounded toggle combinations");
  for (const lensId of lensIds) for (let index = 0; index < 2 ** toggleNames.length; index++) {
    const state = { lensId, ...Object.fromEntries(toggleNames.map((name, bit) => [name, !!(index & 2 ** bit)])) };
    if (variants.filter(variant => Object.entries(variant.when).every(([key, value]) => state[key] === value)).length !== 1) fail(`selection table must cover ${JSON.stringify(state)} exactly once`);
  }
  for (const binding of array(plan.viewBindings, "view bindings")) {
    record(binding, "view binding", ["kind", "target", "property", "variable", "defaultZoom", "systemTransform", "source", "precision", "minimumRadius", "unitScale"]);
    choice(binding.kind, new Set(["zoom-property", "shell-scale", "counter-rotation", "view-attribute", "view-property", "silhouette-fit"]), "view binding");
    // The stage itself may carry a published level-of-detail attribute or
    // property; every other binding names a retained node.
    node(binding.target, ["view-attribute", "view-property"].includes(binding.kind));
    if ([tree.camera, tree.scene].includes(binding.target) && binding.kind !== "view-attribute") fail("view binding cannot duplicate the camera publisher");
    if (binding.kind === "silhouette-fit") {
      // The overlay fitted to the projected silhouette a perspective camera
      // publishes (see perspective-dolly.mjs), never below a prepared radius.
      if (!(binding.minimumRadius >= 0) || !(binding.unitScale > 0)) fail("silhouette fit requires a prepared floor and unit scale");
      if (!plan.camera.projection || plan.camera.projection.model !== "css-perspective-shared-with-sky") fail("silhouette fit requires the perspective camera");
    } else if (binding.kind === "view-property") {
      string(binding.property, "view property");
      if (!binding.property.startsWith("--") ) fail("view property must be a custom property");
      choice(binding.source, new Set(["billboard-opacity", "marker-opacity"]), "view property source");
      if (binding.precision !== null) { integer(binding.precision, "view property precision"); if (binding.precision > 12) fail("invalid view property precision"); }
    } else if (binding.kind === "view-attribute") {
      attribute(binding.property);
      choice(binding.source, new Set(["scene-pitch", "control-yaw", "zoom", "scene-matrix", "level-of-detail-stage"]), "view attribute source");
      if (binding.target === -1 && binding.source !== "level-of-detail-stage") fail("only the level of detail is published on the stage");
      if (binding.precision !== null) { integer(binding.precision, "view attribute precision"); if (binding.precision > 12 || binding.source === "scene-matrix") fail("invalid view attribute precision"); }
    } else if (binding.kind === "zoom-property") string(binding.property, "zoom property");
    else if (binding.kind === "shell-scale") { string(binding.variable, "shell variable"); if (!(binding.defaultZoom > 0)) fail("scale default zoom must be positive"); }
    else if (binding.systemTransform !== null && typeof binding.systemTransform !== "string") fail("counter rotation needs its immutable prepared transform");
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
  record(plan.observations, "observations", ["constants", "materials", "counts", "publications", "attributes", "selection", "sums", "levelOfDetail"]);
  for(const binding of array(plan.observations.levelOfDetail??[],"level-of-detail observations")) {
    record(binding,"level-of-detail observation",["category","name","track"]);
    choice(binding.category,new Set(["camera","material","sky"]),"observation category");string(binding.name,"observation name");
    if(!trackMap.has(binding.track))fail("undeclared level-of-detail track");
  }
  for(const binding of array(plan.observations.attributes??[],"attribute observations")) {
    record(binding,"attribute observation",["category","name","target","attribute","default"]);
    choice(binding.category,new Set(["camera","material","sky"]),"observation category");string(binding.name,"observation name");node(binding.target);attribute(binding.attribute);
    if(binding.default!==null&&typeof binding.default!=="string")fail("attribute observation default must be string or null");
  }
  for(const binding of array(plan.observations.selection??[],"selection observations")) {
    record(binding,"selection observation",["category","name","key"]);
    choice(binding.category,new Set(["camera","material","sky"]),"observation category");string(binding.name,"observation name");
    if(binding.key!=="lensId"&&!settings.has(binding.key))fail("observation must name a declared selection");
  }
  for(const binding of array(plan.observations.sums??[],"summed observations")) {
    record(binding,"summed observation",["category","name","tracks","field","includePresentation"]);
    choice(binding.category,new Set(["camera","material","sky"]),"observation category");string(binding.name,"observation name");
    choice(binding.field,new Set(["addressWrites","transformWrites"]),"summed field");
    if(typeof binding.includePresentation!=="boolean"||binding.includePresentation&&binding.field!=="transformWrites")fail("invalid presentation sum");
    unique(array(binding.tracks,"summed tracks"),"summed tracks");if(!binding.tracks.length||binding.tracks.some(id=>!trackMap.has(id)))fail("undeclared summed track");
  }
  for (const binding of array(plan.observations.publications ?? [], "publication observations")) {
    record(binding, "publication observation", ["category", "name", "field"]);
    choice(binding.category, new Set(["camera", "material", "sky"]), "observation category"); string(binding.name, "observation name");
    choice(binding.field, new Set(["selectionPublications", "framePublications", "styleWrites", "transformWrites"]), "publication field");
  }
  for (const binding of array(plan.observations.materials, "material observations")) {
    record(binding, "material observation", ["category", "name", "track", "field"]);
    choice(binding.category, new Set(["camera", "material", "sky"]), "observation category"); string(binding.name, "observation name");
    if (!trackMap.has(binding.track)) fail("undeclared observation track"); choice(binding.field, materialFields, "observation field");
  }
  for (const count of array(plan.observations.counts, "count observations")) {
    record(count, "count observation", ["category", "name", "target", "kind", "includeRoot"]);
    choice(count.category, new Set(["dom", "renderStats"]), "count category"); string(count.name, "count name"); node(count.target);
    choice(count.kind, new Set(["nodes", "leaves"]), "count kind"); if (typeof count.includeRoot !== "boolean") fail("count root policy is required");
  }
  return plan;
}

// The Sun as real geometry with the body's orbit (see heliocentric-view.mjs):
// needs the observed Sun plan for its direction and sprite, the perspective
// camera that frames by dolly, and the shell's own navigation sprite as the
// far-view marker. A planetary system needs one sprite per prepared body and
// the Sun from the same atlas, and a phase atlas; captions need a policy and
// a name for every body drawn.
function heliocentricView(value, plan) {
  record(value, "heliocentric view", ["plan", "bodyMarker", "systemMarkers", "labels"]);
  const { plan: view, bodyMarker, systemMarkers, labels } = value;
  validatePreparedHeliocentricView(view);
  const nonempty = text => typeof text === "string" && text.length > 0;
  const sprite = marker => Number.isSafeInteger(marker?.index) && marker.index >= 0 &&
    Number.isSafeInteger(marker.count) && marker.count > marker.index && marker.size > 0 &&
    (marker.url === undefined || nonempty(marker.url));
  if (plan.sun == null || plan.camera.projection?.model !== "css-perspective-shared-with-sky" ||
      !nonempty(bodyMarker?.url) || !sprite(bodyMarker)) {
    fail("a heliocentric view requires the observed Sun plan, a perspective camera and the shell's body marker");
  }
  const bodyIds = view.system === undefined ? [] : view.system.bodies.map(body => body.id);
  if (labels !== undefined && (labels === null || typeof labels.policy !== "object" || typeof labels.names !== "object" ||
      (view.system !== undefined && (!nonempty(labels.names.sun) || bodyIds.some(id => !nonempty(labels.names[id])))))) {
    fail("captions require a policy and a name for the observer, the Sun and every system body");
  }
  if (view.system !== undefined && (!nonempty(systemMarkers?.url) || !sprite(systemMarkers.sun) ||
      bodyIds.some(id => !sprite(systemMarkers.bodies?.[id])) ||
      !nonempty(systemMarkers.phase?.url) || !(systemMarkers.phase.frameCount > 1))) {
    fail("a prepared planetary system requires a shell marker for the Sun and every body, and a phase atlas");
  }
}
