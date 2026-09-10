import {
  projectHeliocentricView,
  trailWeightsForSpans,
  validTrailSpans,
  validatePreparedHeliocentricView,
} from "./heliocentric-view.mjs";
import {
  LABEL_OWNER_BODY,
  LABEL_OWNER_FOCUS,
  LABEL_OWNER_SUN,
  createLabelDeclutter,
  createLabelSlots,
  labelBox,
  labelFontPixels,
  validateLabelPolicy,
} from "./label-field.mjs";
import { selectStarLabel } from "./star-labels.mjs";
import { createExposure } from "./star-photometry.mjs";
import { bindObjectNavigationTarget, supportsObjectNavigation } from "../renderers/css/dist/navigation.js";

const LABEL_OWNER_STAR = 3;

// Mounts the retained DOM of a body's heliocentric neighbourhood and moves it
// with the camera:
//   - the Sun, a billboard in its own perspective root (`sunRoot`, inserted
//     before the body's camera root so it paints beneath it and the body
//     covers the Sun when the Sun is beyond it); the shared orbit gives both
//     roots the same eye;
//   - the orbit, a fixed pool of screen-space line pieces in an overlay root
//     that shares the camera root's box, written from the projection's
//     camera-relative float64 result;
//   - a body marker in the same overlay: the object's sprite from the shared
//     navigation atlas, the same few pixels the shell's header draws, whose
//     opacity the object's level-of-detail policy sets so the body stays
//     findable on its orbit once its true disc is too small to read;
//   - when the plan carries the planetary system, its points and captions
//     live in a celestial layer before the focused body's camera, so the
//     body naturally occludes them. Its orbit lines retain their distance fade;
//     and a Sun marker from the atlas that floors the Sun once its sprite is
//     too small to read, exactly as the body marker floors the body.
// Everything is created once; publication only rewrites transforms and
// visibility on the retained nodes.
export function mountRetainedHeliocentricView({
  host,
  before = null,
  plan,
  objectId,
  sunImageUrl,
  markerSprite,
  systemMarkers = null,
  // Captions (see label-field.mjs): a policy and a name per body, the
  // observer's own included; null draws no captions.
  labels = null,
  orbitPoolSpare = 48,
  systemPoolSpare = 8,
}) {
  validatePreparedHeliocentricView(plan);
  if (!(host instanceof HTMLElement) ||
      (before !== null && !(before instanceof HTMLElement)) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) || typeof sunImageUrl !== "string" ||
      typeof markerSprite?.url !== "string" || !validSprite(markerSprite)) {
    throw new TypeError("Retained heliocentric view mount arguments are invalid.");
  }
  const system = plan.system ?? null;
  if (system !== null && (typeof systemMarkers?.url !== "string" ||
      !validSprite(systemMarkers.sun) ||
      system.bodies.some((body) => !validSprite(systemMarkers.bodies?.[body.id])) ||
      !validPhaseAtlas(systemMarkers.phase))) {
    throw new TypeError("A prepared planetary system needs a marker sprite for the Sun and every body, and the phase atlas.");
  }
  const phaseAtlas = system === null ? null : systemMarkers.phase;
  if (labels !== null) {
    validateLabelPolicy(labels.policy);
    const needed = [objectId, ...(system === null ? [] : ["sun", ...system.bodies.map((body) => body.id)])];
    if (needed.some((id) => typeof labels.names?.[id] !== "string" || labels.names[id].length === 0)) {
      throw new TypeError("Captions need a name for the observer, the Sun and every system body.");
    }
  }
  const document = host.ownerDocument;
  const sunRoot = document.createElement("div");
  sunRoot.className =
    `planet-heliocentric-sun-camera planet-render-root ${objectId}-sun-camera`;
  sunRoot.ariaHidden = "true";
  host.insertBefore(sunRoot, before);
  const sun = document.createElement("s");
  // `<object>-directional-sun` is kept as an alias: it is the selector the
  // object's existing sky tests isolate the Sun by.
  sun.className =
    `planet-heliocentric-sun ${objectId}-sun ${objectId}-directional-sun`;
  sun.ariaHidden = "true";
  sun.style.width = `${plan.sun.sprite.imagePixels}px`;
  sun.style.height = `${plan.sun.sprite.imagePixels}px`;
  sun.style.margin = `${-plan.sun.sprite.imagePixels / 2}px 0 0 ` +
    `${-plan.sun.sprite.imagePixels / 2}px`;
  sun.style.backgroundImage = `url("${sunImageUrl}")`;
  sun.hidden = true;
  sunRoot.appendChild(sun);

  // Like the Sun, this sibling paints after the sky and before the body's
  // camera. Native body pixels occlude celestial points and text together.
  const celestialRoot = document.createElement("div");
  celestialRoot.className = `planet-heliocentric-sky planet-render-root ${objectId}-celestial-vault`;
  host.insertBefore(celestialRoot, before);

  const overlay = document.createElement("div");
  overlay.className =
    `planet-heliocentric-orbit planet-render-root ${objectId}-orbit`;
  overlay.ariaHidden = "true";
  const poolSize = plan.orbit.vertexCount + orbitPoolSpare;
  const pieces = [];
  for (let index = 0; index < poolSize; index += 1) {
    const piece = document.createElement("s");
    piece.className = "planet-heliocentric-orbit-piece";
    piece.style.visibility = "hidden";
    overlay.appendChild(piece);
    pieces.push(piece);
  }
  const marker = document.createElement("s");
  marker.className = `planet-heliocentric-body-marker ${objectId}-body-marker`;
  // The prepared atlas supplies the tile; projection sets its apparent size.
  applySprite(marker, markerSprite);
  marker.style.opacity = "0";
  overlay.appendChild(marker);

  // The atlas supplies the retained image; its navigation size is only the
  // source scale. Publication fits each marker to its apparent physical or
  // photometric diameter at the camera's distance.
  const systemGroup = document.createElement("div");
  systemGroup.className = `planet-heliocentric-system ${objectId}-planetary-system`;
  const systemMarkerGroup = document.createElement("div");
  systemMarkerGroup.className = "planet-heliocentric-system-markers";
  const systemPieces = [];
  const systemMarkerElements = new Map();
  const systemPhaseElements = new Map();
  const publishedPhaseRolls = new Map();
  let systemPoolSize = 0;
  if (system !== null) {
    systemPoolSize = system.bodies.reduce(
      (total, body) => total + (body.orbit === null ? 0 : body.orbit.vertexCount + systemPoolSpare),
      0,
    );
    for (let index = 0; index < systemPoolSize; index += 1) {
      const piece = document.createElement("s");
      piece.className =
        "planet-heliocentric-orbit-piece planet-heliocentric-system-orbit-piece";
      piece.style.visibility = "hidden";
      systemGroup.appendChild(piece);
      systemPieces.push(piece);
    }
    for (const body of system.bodies) {
      const element = document.createElement("s");
      element.className =
        `planet-heliocentric-system-marker ${objectId}-system-marker`;
      element.dataset.body = body.id;
      // A body's sprite may come from its own strip (the dwarf planets have
      // no navigation tile); otherwise from the shared atlas.
      applySprite(element, { url: systemMarkers.url, ...systemMarkers.bodies[body.id] });
      // Brightness belongs to the point, independent of orbit visibility.
      element.style.opacity = String(body.illumination.markerOpacity);
      element.style.visibility = "hidden";
      // Phase: the object's own billboard lighting atlas, the frame chosen
      // once from the prepared light depth, scaled to the marker and rolled
      // every publication so its lit side faces the Sun on screen.
      const phase = document.createElement("s");
      phase.className = "planet-heliocentric-marker-phase";
      const frame = phaseFrameFor(phaseAtlas, body.illumination.lightViewZ);
      const size = systemMarkers.bodies[body.id].size;
      phase.style.backgroundImage = `url("${phaseAtlas.url}")`;
      phase.style.backgroundSize = `${phaseAtlas.columns * size}px ${phaseAtlas.rowCount * size}px`;
      phase.style.backgroundPosition = `${-(frame % phaseAtlas.columns) * size}px ` +
        `${-Math.floor(frame / phaseAtlas.columns) * size}px`;
      phase.dataset.frame = String(frame);
      element.appendChild(phase);
      systemMarkerGroup.appendChild(element);
      systemMarkerElements.set(body.id, element);
      systemPhaseElements.set(body.id, { element: phase, frame });
    }
    systemGroup.style.opacity = "0";
    overlay.appendChild(systemGroup);
    celestialRoot.appendChild(systemMarkerGroup);
  }
  // The Sun's floor: the atlas Sun tile over the sprite's position, faded in
  // by the dolly as the sprite falls below the tile's size.
  let sunMarker = null;
  if (system !== null) {
    sunMarker = document.createElement("s");
    sunMarker.className = `planet-heliocentric-sun-marker ${objectId}-sun-marker`;
    applySprite(sunMarker, { ...systemMarkers.sun, url: systemMarkers.url });
    sunMarker.style.opacity = "0";
    sunMarker.style.visibility = "hidden";
    celestialRoot.appendChild(sunMarker);
  }
  // Captions: a fixed pool of retained caption elements in the overlay,
  // laid out above their markers by the one declutter pass, and one hidden
  // measuring element per name so each caption's width per cap height is
  // read from the retained DOM once at mount (no canvas, no per-frame
  // measurement). Their font is the shell's UI stack at the size that lands
  // capitals at the policy's cap height.
  let labelField = null;
  let skyView = null;
  let labelFrame = null;
  if (labels !== null) {
    const policy = labels.policy;
    const fontPixels = labelFontPixels(policy);
    const group = document.createElement("div");
    group.className = `planet-heliocentric-captions ${objectId}-captions`;
    group.style.fontSize = `${fontPixels}px`;
    const widthPerCapHeight = new Map();
    const measures = [];
    for (const [id, name] of Object.entries(labels.names)) {
      const measure = document.createElement("s");
      measure.className = "planet-heliocentric-caption-measure";
      measure.textContent = name;
      group.appendChild(measure);
      measures.push([id, measure]);
    }
    const elements = [];
    for (let index = 0; index < policy.poolSize; index += 1) {
      const element = document.createElement("s");
      element.className = `planet-heliocentric-caption ${objectId}-caption`;
      element.style.setProperty("--planet-caption-opacity", "0");
      element.style.visibility = "hidden";
      group.appendChild(element);
      elements.push(element);
    }
    celestialRoot.appendChild(group);
    labelField = {
      policy, group, elements, measures, widthPerCapHeight,
      declutter: createLabelDeclutter({ capacity: policy.candidateCapacity, spacingPixels: policy.spacingPixels }),
      pool: createLabelSlots({ poolSize: policy.poolSize, maxAlpha: policy.maxAlpha, maxAlphaStep: policy.maxAlphaStep }),
      published: elements.map(() => ({ text: null, transform: null, opacity: null, hidden: true })),
      measured: false,
      settled: false,
      accepted: [],
      candidates: 0,
    };
    const records = labels.stars?.records.filter(star => supportsObjectNavigation(host, star.id)) ?? [];
    if (labels.stars && records.length) {
      const starPolicy = { ...policy, poolSize: labels.stars.policy.poolSize };
      const starGroup = document.createElement("div");
      starGroup.className = "planet-heliocentric-star-captions";
      starGroup.style.fontSize = `${labelFontPixels(starPolicy)}px`;
      const measures = new Map();
      for (const star of records) {
        const measure = document.createElement("s");
        measure.className = "planet-heliocentric-caption-measure planet-cubic-sky-caption";
        measure.textContent = star.name;
        starGroup.appendChild(measure);
        measures.set(star.id, measure);
      }
      const element = document.createElement("s");
      element.className = `planet-heliocentric-caption planet-cubic-sky-caption ${objectId}-star-caption`;
      element.style.setProperty("--planet-caption-opacity", "0");
      element.style.visibility = "hidden";
      starGroup.appendChild(element);
      labelField.stars = { group: starGroup, element, records, navigation: bindObjectNavigationTarget(element, host), measures, widths: new Map(), policy: starPolicy,
        pool: createLabelSlots(starPolicy), candidate: null, accepted: false, measured: false };
    }
  }
  host.appendChild(overlay);
  if (labelField?.stars) celestialRoot.appendChild(labelField.stars.group);

  let lastProjection = null;
  let publishedSunTransform = null;
  let publishedSunHidden = true;
  let publishedOrbitOpacity = null;
  let publishedMarkerOpacity = null;
  let publishedSystemOpacity = null;
  let publishedSunMarkerOpacity = null;
  let publishedSunMarkerTransform = null;
  let publishedSunMarkerHidden = true;
  let activePieceCount = 0;
  let overflowCount = 0;
  let activeSystemPieceCount = 0;
  let systemOverflowCount = 0;
  let visibleSystemMarkerCount = 0;
  const publishedSystemMarkerTransforms = new Map();
  const systemMarkerHidden = new Map();
  let systemOpacity = 0;
  let sunMarkerOpacity = 0;
  // A session's trail spans: null draws the prepared trails.
  let trailSpans = null;
  let trailWeights = null;
  let destroyed = false;

  return Object.freeze({
    plan,
    root: sunRoot,
    sunRoot,
    sun,
    overlay,
    celestialRoot,
    marker,
    systemGroup,
    systemMarkerGroup,
    sunMarker,
    retainedOrbitPieceCount: poolSize,
    retainedSystemOrbitPieceCount: systemPoolSize,
    retainedSystemMarkerCount: systemMarkerElements.size,
    retainedSunMarkerCount: sunMarker === null ? 0 : 1,
    retainedCaptionCount: labelField === null ? 0 : labelField.elements.length,
    setSkyView({ matrix, exposure }) {
      if (!labelField?.stars) return;
      if (skyView?.matrix !== matrix) {
        const m = new DOMMatrix(matrix);
        skyView = { matrix, rotation: [m.m11, m.m21, m.m31, m.m12, m.m22, m.m32, m.m13, m.m23, m.m33], exposure };
      } else skyView.exposure = exposure;
    },
    publish({
      rotation,
      distance,
      focal,
      viewportWidth,
      viewportHeight,
      principalOffset,
      visibleRect = null,
    }) {
      if (destroyed) throw new Error("Heliocentric view is destroyed.");
      const projection = projectHeliocentricView(plan, {
        rotation,
        distance,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
        visibleRect,
        // Nearby viewpoints still see planets in the vault; only the
        // prepared orbit line work follows the distance-dependent fade.
        system: system !== null,
        systemOrbits: systemOpacity > 0,
        trailWeights,
      });
      lastProjection = projection;
      publishSun(projection);
      publishOrbit(projection);
      if (system !== null) {
        publishSystem(projection);
        publishSunMarker(projection);
      }
      if (labelField !== null) publishCaptions(projection, visibleRect);
      return projection;
    },
    setOrbitOpacity(opacity) {
      const value = String(clamp(opacity, 0, 1));
      if (value === publishedOrbitOpacity) return;
      overlay.style.opacity = value;
      publishedOrbitOpacity = value;
    },
    setMarkerOpacity(opacity) {
      const value = String(clamp(opacity, 0, 1));
      if (value === publishedMarkerOpacity) return;
      marker.style.opacity = value;
      publishedMarkerOpacity = value;
    },
    // The system orbit visibility, set before publication to skip hidden
    // ring work while retaining visible planetary points.
    setSystemOpacity(opacity) {
      if (system === null) throw new Error("The plan carries no planetary system.");
      systemOpacity = clamp(opacity, 0, 1);
      const value = String(systemOpacity);
      if (value === publishedSystemOpacity) return;
      systemGroup.style.opacity = value;
      publishedSystemOpacity = value;
    },
    // Re-weights every prepared ring for a session's spans (null restores
    // the prepared trails); the next publication draws them.
    setTrailSpans(spans) {
      if (spans === null || spans === undefined) {
        trailSpans = null;
        trailWeights = null;
        return null;
      }
      if (!validTrailSpans(spans)) {
        throw new TypeError("Orbit trail spans must be finite turns leaving part of the orbit undrawn.");
      }
      trailSpans = Object.freeze({ solidTurns: spans.solidTurns, fadeTurns: spans.fadeTurns });
      const weights = { own: plan.orbit.closed === false ? plan.orbit.trail : trailWeightsForSpans(plan.orbit.chordBehindTurns, trailSpans) };
      for (const body of system?.bodies ?? []) {
        if (body.orbit !== null) weights[body.id] = trailWeightsForSpans(body.orbit.chordBehindTurns, trailSpans);
      }
      trailWeights = Object.freeze(weights);
      return trailSpans;
    },
    // Session knob for the caption policy (see label-field.mjs): the cap
    // height, gap, spacing and alpha ceiling may be retuned by eye; null
    // restores the prepared policy. Widths are re-measured on the next
    // publication at the new cap height; the retained pool is unchanged.
    setLabelPolicy(options = null) {
      if (labelField === null) return null;
      if (options !== null && (typeof options !== "object" || Array.isArray(options))) {
        throw new TypeError("Label policy options must be a record or null.");
      }
      const prepared = labels.policy;
      const next = { ...prepared };
      if (options !== null) {
        for (const [name, value] of Object.entries(options)) {
          if (!["capPixels", "gapPixels", "spacingPixels", "maxAlpha", "maxAlphaStep", "boxHeightCaps"].includes(name)) {
            throw new TypeError(`Unknown label policy knob: ${name}.`);
          }
          next[name] = value;
        }
        next.poolSize = prepared.poolSize;
        next.candidateCapacity = prepared.candidateCapacity;
      }
      validateLabelPolicy(next);
      labelField.policy = Object.freeze(next);
      labelField.group.style.fontSize = `${labelFontPixels(next)}px`;
      labelField.declutter = createLabelDeclutter({ capacity: next.candidateCapacity, spacingPixels: next.spacingPixels });
      labelField.pool.setMaxAlpha?.(next.maxAlpha);
      labelField.measured = false;
      if (labelField.stars) {
        const stars = labelField.stars;
        stars.policy = { ...next, poolSize: stars.policy.poolSize };
        stars.group.style.fontSize = `${labelFontPixels(next)}px`;
        stars.pool.setMaxAlpha(next.maxAlpha);
        stars.measured = false;
      }
      return Object.freeze({ ...next, source: options === null ? "prepared" : "session" });
    },
    setSunMarkerOpacity(opacity) {
      if (sunMarker === null) throw new Error("The plan carries no Sun marker.");
      sunMarkerOpacity = clamp(opacity, 0, 1);
      const value = String(sunMarkerOpacity);
      if (value === publishedSunMarkerOpacity) return;
      sunMarker.style.opacity = value;
      publishedSunMarkerOpacity = value;
    },
    state() {
      return Object.freeze({
        sun: lastProjection?.sun ?? null,
        bodySilhouetteRadius: lastProjection?.body.silhouetteRadius ?? null,
        orbitPieceCount: activePieceCount,
        retainedOrbitPieceCount: poolSize,
        orbitPoolOverflows: overflowCount,
        orbitOpacity: publishedOrbitOpacity === null
          ? 1
          : Number(publishedOrbitOpacity),
        markerOpacity: publishedMarkerOpacity === null
          ? 0
          : Number(publishedMarkerOpacity),
        trailSpans: trailSpans ?? plan.orbit.trailSpans,
        trailSpansSource: trailSpans === null ? "prepared" : "session",
        ...(labelField === null ? {} : {
          captions: Object.freeze({
            policy: labelField.policy,
            candidateCount: labelField.candidates,
            acceptedCount: labelField.accepted.length,
            // Every candidate of the last pass with its box, and which were
            // accepted: enough for a test to recompute the pass on its own.
            candidates: Object.freeze((labelField.candidateList ?? []).map((candidate) => Object.freeze({
              key: candidate.key, owner: candidate.owner, id: candidate.id, text: candidate.text,
              priority: candidate.priority, anchor: candidate.anchor, alpha: candidate.alpha, ...candidate.box,
              accepted: labelField.accepted.includes(candidate),
            }))),
            poolSize: labelField.policy.poolSize,
            widthPerCapHeight: Object.freeze(Object.fromEntries(labelField.widthPerCapHeight)),
            slots: Object.freeze(labelField.pool.slots.map((slot) => Object.freeze({
              occupant: slot.occupant, text: slot.text, alpha: slot.alpha, target: slot.target,
              anchor: slot.anchor, bottomOffsetPx: slot.bottomOffsetPx,
            }))),
            stars: labelField.stars ? Object.freeze({ policy: labelField.stars.policy,
              candidate: labelField.stars.candidate, accepted: labelField.stars.accepted,
              slots: labelField.stars.pool.slots.map(slot => ({ ...slot, anchor: [...slot.anchor] })) }) : null,
          }),
        }),
        ...(system === null ? {} : {
          systemOpacity,
          systemPieceCount: activeSystemPieceCount,
          retainedSystemOrbitPieceCount: systemPoolSize,
          systemPoolOverflows: systemOverflowCount,
          systemMarkerVisibleCount: visibleSystemMarkerCount,
          systemBodies: lastProjection?.system === null || lastProjection?.system === undefined
            ? null
            : Object.freeze(lastProjection.system.bodies.map((body) => Object.freeze({
              id: body.id,
              visible: body.marker.visible,
              classification: body.marker.classification,
              screen: body.marker.screen,
              diameterPx: body.marker.diameterPx,
              alpha: body.marker.alpha,
              physicalDiameterPx: body.marker.physicalDiameterPx,
              orbitPieceCount: body.orbitSegments.length,
              illumination: Object.freeze({
                ...system.bodies.find(({ id }) => id === body.id).illumination,
                phaseFrame: systemPhaseElements.get(body.id).frame,
                phaseRollDegrees: publishedPhaseRolls.get(body.id) ?? null,
              }),
            }))),
          sunMarkerOpacity,
          sunMarkerVisible: !publishedSunMarkerHidden,
        }),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      labelField?.stars?.navigation.destroy();
      if (labelFrame !== null) host.ownerDocument.defaultView.cancelAnimationFrame(labelFrame);
      sunRoot.remove();
      overlay.remove();
      celestialRoot.remove();
    },
  });

  function publishSun(projection) {
    const state = projection.sun;
    const hidden = !state.visible && state.classification !== "partially-visible";
    if (!hidden) {
      // Face the eye: the billboard's +z is the direction from the Sun to
      // the eye; any roll about it is fine for a radially symmetric sprite.
      const eye = state.eye;
      const length = Math.hypot(eye[0], eye[1], eye[2]);
      const normal = [-eye[0] / length, -eye[1] / length, -eye[2] / length];
      const rightLength = Math.hypot(normal[2], normal[0]);
      const right = rightLength > 1e-9
        ? [normal[2] / rightLength, 0, -normal[0] / rightLength]
        : [1, 0, 0];
      const up = [
        normal[1] * right[2] - normal[2] * right[1],
        normal[2] * right[0] - normal[0] * right[2],
        normal[0] * right[1] - normal[1] * right[0],
      ];
      const scale = state.spriteScale;
      // Root coordinates: the eye sits at the principal point, `focal` in
      // front of the root.
      const [ox, oy] = projection.principalOffset;
      const transform = `matrix3d(${[
        right[0] * scale, right[1] * scale, right[2] * scale, 0,
        up[0] * scale, up[1] * scale, up[2] * scale, 0,
        normal[0], normal[1], normal[2], 0,
        ox + eye[0], oy + eye[1], eye[2] + projection.focal, 1,
      ].map(formatNumber).join(",")})`;
      if (transform !== publishedSunTransform) {
        sun.style.transform = transform;
        publishedSunTransform = transform;
      }
    }
    if (hidden !== publishedSunHidden) {
      sun.hidden = hidden;
      publishedSunHidden = hidden;
    }
  }

  function publishOrbit(projection) {
    const result = writePieces(pieces, projection.orbitSegments, activePieceCount);
    activePieceCount = result.count;
    if (result.overflowed) overflowCount += 1;
    marker.style.transform = `scale(${formatNumber(Math.max(markerSprite.size,
      2 * projection.body.silhouetteRadius) / markerSprite.size)})`;
  }

  function publishSystem(projection) {
    const projected = projection.system;
    if (projected === null) {
      // Invisible: hide whatever was active and write nothing else.
      activeSystemPieceCount = writePieces(systemPieces, [], activeSystemPieceCount).count;
      for (const [id, element] of systemMarkerElements) setMarkerHidden(id, element, true);
      visibleSystemMarkerCount = 0;
      return;
    }
    const segments = [];
    for (const body of projected.bodies) {
      for (const segment of body.orbitSegments) segments.push(segment);
      const element = systemMarkerElements.get(body.id);
      const state = body.marker;
      if (state.visible) {
        const scale = state.diameterPx / systemMarkers.bodies[body.id].size;
        const transform = `translate(${formatNumber(state.screen[0])}px, ` +
          `${formatNumber(state.screen[1])}px) scale(${formatNumber(scale)})`;
        if (publishedSystemMarkerTransforms.get(body.id) !== transform) {
          element.style.transform = transform;
          publishedSystemMarkerTransforms.set(body.id, transform);
        }
        element.style.opacity = formatNumber(state.alpha);
        // The lit side faces the Sun: the atlas lights from screen right
        // at zero roll, so the roll is the Sun's on-screen direction from
        // the marker (y up, as the object's own overlay measures it).
        const sunScreen = projection.sun.screen ?? null;
        if (sunScreen !== null) {
          const roll = Math.round((Math.atan2(-(sunScreen[1] - state.screen[1]), sunScreen[0] - state.screen[0]) *
            180 / Math.PI - phaseAtlas.baseLightAzimuthDegrees) * 4) / 4;
          if (publishedPhaseRolls.get(body.id) !== roll) {
            systemPhaseElements.get(body.id).element.style.transform = `rotate(${roll}deg)`;
            publishedPhaseRolls.set(body.id, roll);
          }
        }
      }
      setMarkerHidden(body.id, element, !state.visible);
    }
    visibleSystemMarkerCount = projected.bodies.filter((body) => body.marker.visible).length;
    const result = writePieces(systemPieces, segments, activeSystemPieceCount);
    activeSystemPieceCount = result.count;
    if (result.overflowed) systemOverflowCount += 1;
  }

  // Visibility follows the projection alone; the dolly's opacity, written
  // after the publication, fades the marker without a second projection.
  function publishSunMarker(projection) {
    const state = projection.sun;
    const hidden = state.screen === undefined ||
      state.classification === "behind-camera" || state.classification === "behind-body" ||
      state.classification === "outside-viewport";
    if (!hidden) {
      const transform = `translate(${formatNumber(state.screen[0])}px, ` +
        `${formatNumber(state.screen[1])}px)`;
      if (transform !== publishedSunMarkerTransform) {
        sunMarker.style.transform = transform;
        publishedSunMarkerTransform = transform;
      }
    }
    if (hidden !== publishedSunMarkerHidden) {
      sunMarker.style.visibility = hidden ? "hidden" : "";
      publishedSunMarkerHidden = hidden;
    }
  }

  // Captions for every marker on screen: the observer (always admitted, at
  // its marker's opacity), the Sun (by its marker), and each system body
  // (by brightness, once the system is visible). The pass, the slots and
  // the writes are all bounded by the policy's pool.
  function publishCaptions(projection, visibleRect = null) {
    const field = labelField;
    field.visibleRect = visibleRect;
    if (!field.measured) {
      // Once: the retained measuring elements' widths, per cap height.
      const capPixels = field.policy.capPixels;
      for (const [id, element] of field.measures) {
        const width = element.getBoundingClientRect().width;
        field.widthPerCapHeight.set(id, width > 0 ? width / capPixels : field.policy.boxHeightCaps * 3);
      }
      field.measured = true;
    }
    const { policy, declutter } = field;
    declutter.reset();
    const candidates = [];
    const consider = (owner, id, priority, screen, markerRadiusPx, alpha) => {
      if (!(alpha > 0) || screen === null || screen === undefined) return;
      const geometry = labelBox(policy, { widthPerCapHeight: field.widthPerCapHeight.get(id), markerRadiusPx });
      const anchor = [screen[0], screen[1]];
      declutter.add({ owner, id, priority, anchor, ...geometry });
      candidates.push({ owner, id, key: `${owner}:${id}`, priority, anchor, alpha,
        text: labels.names[id], bottomOffsetPx: geometry.bottomOffsetPx,
        box: Object.freeze({ widthPx: geometry.widthPx, bottomOffsetPx: geometry.bottomOffsetPx, topOffsetPx: geometry.topOffsetPx }) });
    };
    // The observer: its marker sits at the root's centre (the projection
    // places the body there); admitted above everything once the marker
    // shows, exactly as the reference labels its focused body.
    const ownMarkerOpacity = publishedMarkerOpacity === null ? 0 : Number(publishedMarkerOpacity);
    consider(LABEL_OWNER_FOCUS, objectId, 1000, [0, 0],
      Math.max(markerSprite.size / 2, projection.body.silhouetteRadius), ownMarkerOpacity);
    if (system !== null) {
      // The Sun: brightest of all (the reference ranks by -magnitude; the
      // Sun's -27 puts it above every planet), once its marker floors in.
      const sunVisible = !publishedSunMarkerHidden && projection.sun.screen !== undefined;
      consider(LABEL_OWNER_SUN, "sun", 27, sunVisible ? projection.sun.screen : null,
        systemMarkers.sun.size / 2, sunMarkerOpacity);
      if (projection.system !== null) {
        for (const body of projection.system.bodies) {
          // Priority follows apparent magnitude; text keeps the caption
          // policy's brightness independently of the point's faint flux.
          consider(LABEL_OWNER_BODY, body.id, body.marker.labelPriority,
            body.marker.visible ? body.marker.screen : null, body.marker.diameterPx / 2, 1);
        }
      }
    }
    const stars = field.stars;
    if (stars && skyView) {
      if (!stars.measured) {
        for (const [id, measure] of stars.measures) stars.widths.set(id, measure.getBoundingClientRect().width);
        stars.measured = true;
      }
      const exposure = createExposure({ ...labels.stars.exposure, ...skyView.exposure });
      const star = selectStarLabel({ stars: stars.records, rotation: skyView.rotation, exposure,
        focal: projection.focal, principalOffset: projection.principalOffset,
        visibleRect: visibleRect ?? { left: -projection.viewportWidth / 2, top: -projection.viewportHeight / 2,
          right: projection.viewportWidth / 2, bottom: projection.viewportHeight / 2 } });
      stars.candidate = star;
      if (star) {
        const box = labelBox(stars.policy, { widthPerCapHeight: stars.widths.get(star.id) / stars.policy.capPixels,
          markerRadiusPx: star.radiusPx });
        declutter.add({ owner: LABEL_OWNER_STAR, id: star.id, priority: star.priority, anchor: star.anchor, ...box });
        candidates.push({ owner: LABEL_OWNER_STAR, id: star.id, key: `${LABEL_OWNER_STAR}:${star.id}`,
          priority: star.priority, anchor: star.anchor, alpha: 1, text: star.name,
          bottomOffsetPx: box.bottomOffsetPx, box });
      }
    }
    field.candidates = candidates.length;
    field.candidateList = candidates;
    const acceptedKeys = new Set(declutter.resolve().map((entry) => `${entry.owner}:${entry.id}`));
    field.accepted = candidates.filter((candidate) => acceptedKeys.has(candidate.key));
    const slots = field.pool.assign(field.accepted.filter(candidate => candidate.owner !== LABEL_OWNER_STAR), field.settled);
    if (stars) {
      const accepted = field.accepted.filter(candidate => candidate.owner === LABEL_OWNER_STAR);
      stars.accepted = accepted.length > 0;
      const [slot] = stars.pool.assign(accepted, field.settled);
      const element = stars.element;
      const visible = slot.occupant !== null && slot.alpha > 0;
      const target = visible ? accepted.find(candidate => candidate.key === slot.occupant) : undefined;
      stars.navigation.update(target?.id ?? null, target?.text);
      if (visible) {
        if (element.textContent !== slot.text) element.textContent = slot.text;
        element.dataset.occupant = slot.occupant;
        element.style.transform = `translate(${formatNumber(slot.anchor[0])}px, ${formatNumber(slot.anchor[1] - slot.bottomOffsetPx)}px) translate(-50%, -100%)`;
      }
      element.style.setProperty("--planet-caption-opacity", formatNumber(slot.alpha));
      element.style.visibility = visible ? "" : "hidden";
    }
    field.settled = true;
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const element = field.elements[index];
      const published = field.published[index];
      const hidden = slot.occupant === null || slot.alpha <= 0;
      if (!hidden) {
        if (published.text !== slot.text) {
          element.textContent = slot.text;
          published.text = slot.text;
        }
        // Bottom-centre of the caption at the anchor, `bottomOffset` above it.
        const transform = `translate(${formatNumber(slot.anchor[0])}px, ` +
          `${formatNumber(slot.anchor[1] - slot.bottomOffsetPx)}px) translate(-50%, -100%)`;
        if (published.transform !== transform) {
          element.style.transform = transform;
          published.transform = transform;
        }
        const opacity = formatNumber(slot.alpha);
        if (published.opacity !== opacity) {
          element.style.setProperty("--planet-caption-opacity", opacity);
          published.opacity = opacity;
        }
      }
      if (published.hidden !== hidden) {
        element.style.visibility = hidden ? "hidden" : "";
        published.hidden = hidden;
      }
    }
    // Both caption populations finish their bounded fades after camera input
    // stops, including frames with no eligible star caption at all.
    if (labelFrame === null && (field.pool.slots.some(slot => slot.alpha !== slot.target) ||
        stars?.pool.slots.some(slot => slot.alpha !== slot.target))) {
      labelFrame = host.ownerDocument.defaultView.requestAnimationFrame(() => {
        labelFrame = null;
        if (!destroyed && lastProjection) publishCaptions(lastProjection, field.visibleRect);
      });
    }
  }

  function setMarkerHidden(id, element, hidden) {
    if (systemMarkerHidden.get(id) === hidden) return;
    element.style.visibility = hidden ? "hidden" : "";
    systemMarkerHidden.set(id, hidden);
  }
}

// Writes screen-space segments onto a piece pool: each piece is a unit-width
// bar laid out at the overlay's centre, so the projection's centre-relative
// offsets are the translation as they are and the segment is the bar's x
// axis. Pieces beyond the segment count are hidden.
function writePieces(pool, segments, previousCount) {
  const count = Math.min(segments.length, pool.length);
  for (let index = 0; index < count; index += 1) {
    const [x0, y0, x1, y1, weight] = segments[index];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const piece = pool[index];
    piece.style.transform = `matrix(${formatNumber(dx)},${formatNumber(dy)},${
      formatNumber(-dy / length)},${formatNumber(dx / length)},${
      formatNumber(x0)},${formatNumber(y0)})`;
    // The chord's trail weight: the line fades backwards from the body.
    const opacity = formatNumber(weight);
    if (piece.style.opacity !== opacity) piece.style.opacity = opacity;
    if (piece.style.visibility !== "") piece.style.visibility = "";
  }
  for (let index = count; index < previousCount; index += 1) {
    pool[index].style.visibility = "hidden";
  }
  return { count, overflowed: segments.length > pool.length };
}

// The lighting atlas: a grid of frames indexed by the light's view depth,
// lit from `baseLightAzimuthDegrees` at zero roll.
function validPhaseAtlas(atlas) {
  return typeof atlas?.url === "string" && Number.isSafeInteger(atlas.columns) && atlas.columns > 0 &&
    Number.isSafeInteger(atlas.rowCount) && atlas.rowCount > 0 &&
    Number.isSafeInteger(atlas.frameCount) && atlas.frameCount > 1 &&
    atlas.frameCount <= atlas.columns * atlas.rowCount &&
    Number.isFinite(atlas.minimumLightViewZ) && Number.isFinite(atlas.maximumLightViewZ) &&
    atlas.maximumLightViewZ > atlas.minimumLightViewZ &&
    Number.isFinite(atlas.baseLightAzimuthDegrees);
}

// The same frame choice as the object's own overlay: the light's view depth
// mapped across the atlas's range.
function phaseFrameFor(atlas, lightViewZ) {
  return Math.round(Math.max(0, Math.min(1,
    (lightViewZ - atlas.minimumLightViewZ) / (atlas.maximumLightViewZ - atlas.minimumLightViewZ))) *
    (atlas.frameCount - 1));
}

function validSprite(sprite) {
  return Number.isSafeInteger(sprite?.index) && sprite.index >= 0 &&
    Number.isSafeInteger(sprite.count) && sprite.count > sprite.index &&
    sprite.size > 0;
}

// The tile at `index` of the atlas strip, the whole tile scaled to `size`
// pixels, centred on the element's layout position.
function applySprite(element, sprite) {
  element.style.width = `${sprite.size}px`;
  element.style.height = `${sprite.size}px`;
  element.style.margin = `${-sprite.size / 2}px 0 0 ${-sprite.size / 2}px`;
  element.style.backgroundImage = `url("${sprite.url}")`;
  element.style.backgroundPosition = `${(sprite.index /
    Math.max(1, sprite.count - 1) * 100).toFixed(4)}% center`;
  element.style.backgroundSize = `${sprite.count * 100}% 100%`;
}

function formatNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
