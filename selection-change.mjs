// src/renderers/css/rendering/prepared-silhouette-steps.ts
function walkSilhouetteLevels(levels, hysteresis, diameter, previous = 0) {
  let level = Math.min(Math.max(previous, 0), levels.length - 1);
  while (level + 1 < levels.length && diameter >= levels[level + 1].minimumDiameter) level++;
  while (level > 0 && diameter < levels[level].minimumDiameter * (1 - hysteresis)) level--;
  return level;
}

// src/renderers/css/rendering/prepared-texture-levels.ts
function selectPreparedTextureLevel(levels, diameter, previous, initial = false) {
  if (initial) return 0;
  if (levels.fixedLevel !== void 0) return levels.fixedLevel;
  if (diameter == null || !Number.isFinite(diameter)) return levels.levels.length - 1;
  return walkSilhouetteLevels(levels.levels, levels.hysteresis, diameter, previous);
}

// packages/engine/dist/index.js
var CANCELLED = Object.freeze({ cancelled: true });
var MAX_CLEARANCE_FRACTION = 10 ** 0.1 - 1;
var TRACKBALL_DRAG_INERTIA = Object.freeze({
  schema: "cssearth-trackball-throw@10",
  qualification: "REFERENCE_APP_7.3.7.1327_NATIVE_PROJECTION_AND_DECOMPILED_THROW",
  rendererSha256: "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  historyCapacity: 16,
  averagingFrameCount: 5,
  // The normalized pointer spans two units across the viewport. Its release
  // threshold of five viewport-scaled units is 2.5 CSS pixels, not five.
  minimumThrowDisplacementPixels: 2.5,
  releaseFreshnessMilliseconds: 100,
  directAngularDegreesPerTrackballRadius: 47.5,
  directAngularResponseByZoom: Object.freeze({
    model: "linear-clamped-native-training-fit",
    interceptDegrees: 69.8238784558683,
    slopeDegreesPerZoom: -16.30629044362304,
    minimumDegrees: 40,
    maximumDegrees: 52.5
  }),
  directPitchResponse: 1,
  directPitchResponseByZoom: Object.freeze({
    model: "linear-clamped-native-pure-vertical-fit",
    intercept: 0.9768198038991756,
    slopePerZoom: 0.21000705516484433,
    minimum: 1.2025381100738586,
    maximum: 1.3504854183805297
  }),
  directPitchResponseEvidence: Object.freeze({
    model: "two-point-native-endpoint-to-browser-pure-vertical-fit",
    calibrationScenarios: Object.freeze([
      "training-baseline-high-vertical-near",
      "training-baseline-high-vertical-far"
    ])
  }),
  maximumPitchVelocityDegreesPerSecond: 30,
  maximumYawVelocityDegreesPerSecond: 90,
  rotationalDampingSeconds: 1.2,
  stopVelocityRatio: 33e-4,
  sourceFunctions: Object.freeze({
    configuration: "0x005b93a0",
    trackballConstructor: "0x005ae654",
    directTrackballMove: "0x005aec2c+0x005d10a2+0x005d1d70",
    releaseThrow: "0x005ae6ea",
    velocityAverage: "0x005ae936",
    rotationalDecay: "0x005b082c+0x005d23cc"
  })
});
var ADAPTATION_LUMINANCE_CD_M2 = 0.052;
var EXPOSURE_SCALE = 2;
var STAR_LINEAR_SCALE = 1.0727;
var STAR_RADIUS_MAX_PX = 1.25;
var STAR_INTENSITY_MAX = 0.95;
var HALO_PEAK = 0.08;
var SCREEN_FACTOR_RANGE = Object.freeze([0.7, 1.5]);
var EXPOSURE_KNOBS = Object.freeze({
  adaptationLuminanceCdM2: ADAPTATION_LUMINANCE_CD_M2,
  exposureScale: EXPOSURE_SCALE,
  intensityMax: STAR_INTENSITY_MAX,
  maxRadiusPx: STAR_RADIUS_MAX_PX,
  haloPeak: HALO_PEAK,
  linearScale: STAR_LINEAR_SCALE
});
var STAR_LABEL_POLICY = Object.freeze({
  capPixels: 12,
  gapPixels: 7,
  spacingPixels: 4,
  boxHeightCaps: 2.2,
  poolSize: 1,
  maxAlpha: 0.55,
  maxAlphaStep: 0.1,
  capHeightEm: 0.72,
  magnitudeOffset: 0,
  color: "#f4f6fb",
  fontWeight: 500,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
});
var DEFAULT_LABEL_POLICY = Object.freeze({
  model: "priority-declutter-cap-height-captions",
  // Height of a capital letter on screen: the shell's navigation labels
  // (14 px in the UI stack, cap height 0.72 em); the reference's own 12 px
  // is a session knob away (the runtime's label policy setter).
  capPixels: 10.08,
  // Gap between the marker's edge and the bottom of the caption.
  gapPixels: 7,
  // Clearance two captions must keep (the reference's LABEL_SPACING_PIXELS).
  spacingPixels: 4,
  // Box height in cap heights (ascenders and descenders included).
  boxHeightCaps: 2.2,
  // Retained slots; also the most captions ever visible at once.
  poolSize: 8,
  // Candidate capacity of the one pass.
  candidateCapacity: 64,
  // Alpha ceiling and the largest alpha change per publication.
  maxAlpha: 0.72,
  maxAlphaStep: 0.1,
  // Cap height of the shell's UI font stack as a share of the em: the
  // reference's own fallback for fonts without ink metrics (system-ui
  // faces measure 0.70-0.73); the acceptance test measures the painted
  // capitals against `capPixels` with that spread as its tolerance.
  capHeightEm: 0.72
});

// src/renderers/css/rendering/prepared-material.ts
function preparedMaterialFrame(mapping, view) {
  if (!view.sunViewDirection) throw new TypeError("Prepared material requires a published Sun direction.");
  const phase = view.sunViewDirection[2];
  let low = 0, high = mapping.thresholds.length;
  while (low < high) {
    const middle = low + high >>> 1;
    if (phase < mapping.thresholds[middle]) high = middle;
    else low = middle + 1;
  }
  return mapping.indices[low];
}
function preparedMaterialState(track, selected, view) {
  const calculatedFrame = preparedMaterialFrame(track.frame, view);
  const frame = selected.frameOverride ?? calculatedFrame + (selected.frameOffset ?? 0);
  const direction = view.sunViewDirection;
  if (!direction) throw new TypeError("Prepared material requires a published Sun direction.");
  const reference = view.reference?.sunViewDirection ?? direction;
  const useDefault = view.sceneMatrix === view.reference?.sceneMatrix && direction.every((value, i) => Math.abs(value - reference[i]) < 1e-9);
  const far = track.farBank !== void 0 && (view.levelOfDetail?.stage ?? "geometry") !== "geometry";
  const bank = track.banks.find((bank2) => bank2.id === (far ? track.farBank : selected.bank));
  if (!bank) throw new TypeError(`Unprepared material bank: ${selected.bank}.`);
  const mode = selected.mode === "fixed" ? selected.fixedMode : useDefault && bank.default ? "default" : "directional";
  const address = selected.mode === "fixed" ? bank.fixed : useDefault && bank.default ? bank.default : bank.frames[frame];
  return {
    frame,
    calculatedFrame,
    useDefault,
    bank,
    address,
    row: address?.row ?? null,
    mode,
    enabled: selected.enabled,
    rotationEnabled: selected.rotationEnabled,
    sunViewDirection: direction,
    referenceDirection: reference
  };
}

// src/renderers/css/rendering/prepared-material-demand.ts
function resolvePreparedMaterialDemand(track, selected, view) {
  const state = preparedMaterialState(track, selected, view);
  const address = state.address;
  const needsAddress = state.enabled || selected.publishWhenHidden === "static" && state.mode !== "directional";
  return {
    required: needsAddress && address?.resource != null ? [address.resource] : [],
    prewarm: state.enabled ? address?.prewarm ?? [] : [],
    frame: state.frame,
    row: state.row,
    mode: state.mode,
    bank: state.bank.id
  };
}

// src/renderers/css/rendering/prepared-presentation.ts
var matches = (variant, selection) => Object.entries(variant.when).every(([name, value]) => selection[name] === value);
function selectedPreparedVariant(definition, selection) {
  const variant = definition.variants.find((variant2) => matches(variant2, selection));
  if (!variant) throw new TypeError("The selected presentation was not prepared.");
  return variant;
}
function resolvePreparedPresentation(definition, { selection, view, previousPlan, initial = false }) {
  const variant = selectedPreparedVariant(definition, selection);
  const textureLevel = definition.textureLevels ? selectPreparedTextureLevel(
    definition.textureLevels,
    view?.levelOfDetail?.silhouetteDiameter,
    previousPlan?.textureLevel,
    initial
  ) : void 0;
  const textureResources = textureLevel === void 0 ? void 0 : definition.textureLevels.levels[textureLevel].resources;
  const content = variant.required.map((key) => textureResources?.[key] ?? key);
  const deferredTextures = (view?.levelOfDetail?.stage ?? "geometry") === "marker";
  const required = new Set(definition.resourceOrder === "materials-first" || deferredTextures ? [] : content);
  const prewarm = /* @__PURE__ */ new Set(), materials = {};
  for (const selected of variant.materials) {
    if (!view) throw new TypeError("Prepared material demand requires a view.");
    const track = definition.materials.find((track2) => track2.id === selected.track);
    if (!track) throw new TypeError(`Unprepared material track: ${selected.track}.`);
    const state = resolvePreparedMaterialDemand(track, selected, view);
    for (const key of state.required) required.add(key);
    for (const key of state.prewarm) prewarm.add(key);
    materials[track.id] = state;
  }
  if (definition.resourceOrder === "materials-first" && !deferredTextures) for (const key of content) required.add(key);
  return {
    required: [...required],
    prewarm: [...prewarm].filter((key) => !required.has(key)),
    materials,
    pressedLenses: [selection.lensId],
    ...deferredTextures ? { deferredTextures } : {},
    ...textureLevel === void 0 ? {} : { textureLevel, textureResources },
    ...variant.navigation ? { navigation: variant.navigation } : {}
  };
}

// src/renderers/css/rendering/object-feature-controls.ts
var OBJECT_SPEED_STATES = Object.freeze([
  Object.freeze({ label: "off", value: 0 }),
  Object.freeze({ label: "normal", value: 1 }),
  Object.freeze({ label: "fast", value: 2 }),
  Object.freeze({ label: "fastest", value: 3 }),
  Object.freeze({ label: "superfast", value: 4 })
]);

// src/renderers/css/runtime/object-contract.ts
var nonempty = (value) => typeof value === "string" && value.length > 0;
function requireObjectControls(content, objectId = "unknown") {
  if (!content || typeof content !== "object" || !Object.hasOwn(content, "lenses") || !Object.hasOwn(content, "settings")) {
    throw new TypeError(`Object ${objectId} must export its lenses and settings content.`);
  }
  for (const name of ["lenses", "settings"]) {
    if (content[name] != null && !Array.isArray(content[name]?.controls)) {
      throw new TypeError(`Object ${objectId} ${name} controls must be an array.`);
    }
  }
  const lensControls = content.lenses?.controls ?? [], lensIds = lensControls.map((lens) => lens.id);
  if (lensIds.some((id) => !nonempty(id)) || new Set(lensIds).size !== lensIds.length || lensIds.length && !lensIds.includes(content.lenses.defaultLens)) {
    throw new TypeError(`Object ${objectId} lens IDs/default are invalid.`);
  }
  const surfaceIds = lensControls.filter((lens) => lens.volume === void 0 || lens.volume.surface === lens.id).map((lens) => lens.id);
  for (const lens of lensControls) {
    if (lens.volume === void 0) continue;
    const volume = lens.volume;
    if (!volume || typeof volume !== "object" || !nonempty(volume.objectId) || !nonempty(volume.lensId) || !surfaceIds.includes(volume.surface)) {
      throw new TypeError(`Object ${objectId} lens ${lens.id} must name a cloud object, its dataset and a prepared surface lens.`);
    }
  }
  if (lensControls.length && !surfaceIds.length) throw new TypeError(`Object ${objectId} has no prepared surface lens.`);
  const settings = content.settings?.controls ?? [], names = settings.map((setting) => setting.name);
  if (names.some((name) => !nonempty(name) || ["motion", "heliosphere", "illustrationModels", "surfaceLabels", "minimap", "threeDStars"].includes(name)) || new Set(names).size !== names.length || settings.some((setting) => !["toggle", "cycle"].includes(setting.kind) || !nonempty(setting.label) || (setting.kind === "toggle" ? typeof setting.checked !== "boolean" : !nonempty(setting.state)))) {
    throw new TypeError(`Object ${objectId} settings controls are invalid.`);
  }
  return content;
}
function objectCycleStates(control) {
  const states = control.states ?? (control.name === "speed" ? OBJECT_SPEED_STATES : null);
  if (!Array.isArray(states) || !states.length || states.some((state) => !nonempty(state.label) || !Number.isFinite(state.value)) || new Set(states.map((state) => state.label)).size !== states.length || new Set(states.map((state) => state.value)).size !== states.length || !states.some((state) => state.label === control.state)) {
    throw new TypeError(`Cycle ${control.name} requires its actual states and default.`);
  }
  return states;
}
function initialObjectSelection(controls, lensId, settings) {
  requireObjectControls(controls);
  if (lensId !== void 0) requireObjectAction(controls, { kind: "lens", id: lensId });
  const selection = { lensId: lensId ?? controls.lenses?.defaultLens ?? null };
  for (const control of controls.settings?.controls ?? []) {
    if (control.kind === "toggle") selection[control.name] = control.checked;
    else {
      const state = objectCycleStates(control).find((state2) => state2.label === control.state);
      if (!state) throw new TypeError(`Cycle ${control.name} has no initial state.`);
      selection[control.name] = state.value;
    }
  }
  if (settings !== void 0) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new TypeError("Initial settings must be a record.");
    for (const [name, value] of Object.entries(settings)) {
      const control = controls.settings?.controls.find((control2) => control2.name === name);
      if (!control || (control.kind === "toggle" ? typeof value !== "boolean" : typeof value !== "number")) throw new TypeError(`Invalid initial setting: ${name}.`);
      requireObjectAction(controls, control.kind === "toggle" ? { kind: "toggle", name, value } : { kind: "cycle", name, value });
      selection[name] = value;
    }
  }
  return Object.freeze(selection);
}
function requireObjectAction(controls, action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) throw new TypeError("Object action must be a record.");
  if (action.kind === "lens") {
    if (!(controls.lenses?.controls ?? []).some((lens) => lens.id === action.id)) throw new RangeError(`Unknown object lens: ${action.id}.`);
  } else {
    const control = (controls.settings?.controls ?? []).find((control2) => control2.name === action.name);
    if (!control || control.kind !== action.kind || (control.kind === "toggle" ? typeof action.value !== "boolean" : !objectCycleStates(control).some((state) => state.value === action.value))) throw new RangeError(`Unknown object control action: ${action.name}.`);
  }
  return Object.freeze({ ...action });
}
function reduceObjectSelection(selection, action) {
  return Object.freeze(action.kind === "lens" ? { ...selection, lensId: action.id } : { ...selection, [action.name]: action.value });
}

// src/renderers/css/rendering/object-selection-runtime.ts
var sameKeys = (a, b) => a.length === b.length && a.every((key, index) => key === b[index]);
var sameDemand = (a, b) => sameKeys(a.required, b.required) && sameKeys(a.prewarm, b.prewarm);
function createObjectSelectionRuntime({
  definition,
  presentation,
  residency,
  lifetime,
  initialLens,
  initialSettings,
  onChange = () => {
  },
  prepareSelection,
  onCommit = () => {
  },
  onFatalError,
  onMaterialError = () => {
  },
  deferTextureRefinement = false
}) {
  const initialSelection = initialObjectSelection(definition.controls, initialLens, initialSettings);
  let desired = initialSelection, committed = null, committedPlan = null, view = null;
  let committedBy = null;
  let active = null, destroyed = false, started = false, error = null;
  let requests = 0, passes = 0, commits = 0, framePublications = 0;
  let textureRefinement = !deferTextureRefinement;
  const live = () => !destroyed && !lifetime.disposed;
  const state = () => Object.freeze({
    desired,
    committed,
    plan: committedPlan,
    committedBy,
    pending: active !== null && active.intent.kind !== "frame",
    loadingMaterial: active?.intent.kind === "frame",
    ready: committed !== null && live(),
    error,
    viewRevision: view?.revision ?? null
  });
  const notify = () => {
    if (live()) onChange(state());
  };
  function resolve(selection) {
    try {
      if (!view) throw new Error("Prepared selection requires a published view.");
      return resolvePreparedPresentation(definition, { selection, view, previousPlan: committedPlan, initial: !committed || !textureRefinement });
    } catch (failure) {
      if (live()) onFatalError(failure);
      throw failure;
    }
  }
  function frame(nextSelection = committed) {
    if (!live() || !nextSelection || !view) return;
    residency.beginFrame();
    try {
      presentation.publishFrame({ selection: nextSelection, view, resources: residency.resources });
      framePublications++;
    } finally {
      residency.endFrame();
    }
  }
  function discard(request) {
    if (!request?.ticket) return;
    const ticket = request.ticket;
    request.ticket = null;
    residency.discard(ticket);
  }
  function releaseDemand(request) {
    discard(request);
    discard(request.previous);
  }
  function endRequest(request) {
    releaseDemand(request);
    active = null;
    desired = committed ?? initialSelection;
  }
  function planFor(request) {
    if (!request.plan) throw new Error("Prepared selection request has no demand plan.");
    return request.plan;
  }
  function preparePass(request, plan) {
    passes++;
    request.plan = plan;
    request.ticket = residency.request(plan, { stabilize: request.intent.kind === "frame" });
    request.previous = null;
    return request.ticket;
  }
  function run(selection, kind, signal, frameCamera = true) {
    if (!live() || signal?.aborted) return Promise.resolve(false);
    const superseded = active;
    let previous = active;
    while (previous && !previous.ticket) previous = previous.previous;
    const request = { selection, intent: { kind, frameCamera }, controller: new AbortController(), ticket: null, plan: null, previous };
    active = request;
    superseded?.controller.abort();
    const operationSignal = signal ? AbortSignal.any([signal, request.controller.signal]) : request.controller.signal;
    desired = selection;
    error = null;
    requests++;
    const current = () => live() && active === request;
    let cancel;
    const cancelled = new Promise((resolve2) => {
      cancel = () => resolve2({ cancelled: true });
    });
    const abort = () => {
      cancel();
      if (!current()) return;
      endRequest(request);
      notify();
    };
    operationSignal.addEventListener("abort", abort, { once: true });
    const work = (async () => {
      try {
        notify();
      } catch (failure) {
        if (current()) onFatalError(failure);
        throw failure;
      }
      await Promise.resolve();
      let prepared = false;
      let preparation;
      while (current()) {
        let ticket;
        try {
          const plan = resolve(selection);
          ticket = request.ticket && request.plan && sameDemand(plan, planFor(request)) ? request.ticket : preparePass(request, plan);
          if (!prepared && kind === "selection" && prepareSelection) {
            preparation = Promise.resolve(prepareSelection(selection, operationSignal));
            prepared = true;
          }
          const ready = preparation ? Promise.all([ticket.ready, preparation]).then(([value]) => value) : ticket.ready;
          const result = await Promise.race([lifetime.wait(ready), cancelled]);
          if (!current() || result.cancelled) {
            discard(request);
            return false;
          }
          if (!result.value || request.ticket !== ticket) continue;
        } catch (failure) {
          if (!current()) {
            discard(request);
            return false;
          }
          endRequest(request);
          error = failure instanceof Error ? failure.message : String(failure);
          try {
            notify();
          } catch (publicationFailure) {
            onFatalError(publicationFailure);
            throw publicationFailure;
          }
          throw failure;
        }
        try {
          const plan = resolve(selection);
          if (!sameDemand(plan, planFor(request)) || plan.required.some((key) => !residency.resources.has(key))) {
            preparePass(request, plan);
            continue;
          }
          request.plan = plan;
          residency.beginFrame();
          try {
            presentation.commitSelection({ selection, plan, view, resources: residency.resources });
          } finally {
            residency.endFrame();
          }
          if (!current()) {
            discard(request);
            return false;
          }
          residency.commit(ticket);
          request.ticket = null;
          frame(selection);
          if (!current()) return false;
          onCommit(selection, plan, request.intent);
          if (!current()) return false;
          committed = selection;
          committedPlan = plan;
          committedBy = request.intent;
          commits++;
          endRequest(request);
          notify();
          return live();
        } catch (failure) {
          if (current()) onFatalError(failure);
          throw failure;
        }
      }
      discard(request);
      return false;
    })();
    work.catch(() => {
    });
    return work.then((value) => live() && value).finally(() => {
      operationSignal.removeEventListener("abort", abort);
      request.controller.abort();
    });
  }
  return Object.freeze({
    start() {
      if (!live()) return Promise.resolve(false);
      if (started) throw new Error("Initial object selection may start only once.");
      if (!view) throw new Error("Initial object selection requires the shared camera publication.");
      started = true;
      return run(desired, "initial");
    },
    dispatch(action, options = {}) {
      if (!live() || !committed) return Promise.resolve(false);
      const valid = requireObjectAction(definition.controls, action);
      const next = reduceObjectSelection(desired, valid);
      return run(next, "selection", options.signal, options.frameCamera);
    },
    setView(next) {
      if (!live()) return;
      view = next;
      try {
        const plan = committed ? resolve(committed) : null;
        const prepared = plan && committedPlan && sameDemand(plan, committedPlan) && plan.required.every((key) => residency.resources.has(key));
        frame(committed);
        if (prepared && live()) committedPlan = plan;
        if (active) {
          if (active.ticket) {
            const plan2 = resolve(active.selection);
            if (!sameKeys(plan2.required, planFor(active).required)) preparePass(active, plan2);
          }
          return;
        }
        if (!committed) return;
        if (prepared) return;
        run(committed, "frame").catch((failure) => {
          if (live()) onMaterialError(failure);
        });
      } catch (failure) {
        if (live()) onFatalError(failure);
        throw failure;
      }
    },
    refineTextures() {
      if (!live()) return;
      textureRefinement = true;
      if (view) this.setView(view);
    },
    state,
    stats: () => Object.freeze({ ...state(), requests, passes, commits, framePublications, destroyed }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active?.controller.abort();
      if (active) releaseDemand(active);
      active = null;
    }
  });
}
export {
  createObjectSelectionRuntime
};
