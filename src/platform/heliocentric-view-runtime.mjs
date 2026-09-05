import {
  projectHeliocentricView,
  validatePreparedHeliocentricView,
} from "./heliocentric-view.mjs";

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
//   - when the plan carries the planetary system, a system group in the same
//     overlay: one fixed pool of line pieces for the other planets' orbits and
//     one marker per planet from the same atlas, the group's opacity set by
//     the camera's distance so the system appears as the camera dollies out;
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
  // Exactly the shell's marker: the tile at `index` of the atlas strip, the
  // whole tile scaled to `size` pixels, never larger.
  applySprite(marker, markerSprite);
  marker.style.opacity = "0";
  overlay.appendChild(marker);

  // The planetary system: a group whose opacity the dolly writes, holding a
  // shared piece pool for every other orbit and one marker per body. Markers
  // are screen-space billboards at the shell's own presentation size for the
  // body, and that size is a deliberate floor: from this body every other
  // planet's true disc is far below one pixel (Venus at closest approach is
  // under half a pixel), so a true angular size would render the system as
  // empty space and ellipses. Planetarium software floors the same way.
  const systemGroup = document.createElement("div");
  systemGroup.className = `planet-heliocentric-system ${objectId}-planetary-system`;
  const systemPieces = [];
  const systemMarkerElements = new Map();
  const systemPhaseElements = new Map();
  const publishedPhaseRolls = new Map();
  let systemPoolSize = 0;
  if (system !== null) {
    systemPoolSize = system.bodies.reduce(
      (total, body) => total + body.orbit.vertexCount + systemPoolSpare,
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
      applySprite(element, { ...systemMarkers.bodies[body.id], url: systemMarkers.url });
      // Brightness: the prepared flux as opacity, so Venus is brilliant and
      // Neptune sits on the floor; the group's opacity fades them together.
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
      systemGroup.appendChild(element);
      systemMarkerElements.set(body.id, element);
      systemPhaseElements.set(body.id, { element: phase, frame });
    }
    systemGroup.style.opacity = "0";
    overlay.appendChild(systemGroup);
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
    overlay.appendChild(sunMarker);
  }
  host.appendChild(overlay);

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
  let destroyed = false;

  return Object.freeze({
    plan,
    root: sunRoot,
    sunRoot,
    sun,
    overlay,
    marker,
    systemGroup,
    sunMarker,
    retainedOrbitPieceCount: poolSize,
    retainedSystemOrbitPieceCount: systemPoolSize,
    retainedSystemMarkerCount: systemMarkerElements.size,
    retainedSunMarkerCount: sunMarker === null ? 0 : 1,
    publish({
      rotation,
      distance,
      focal,
      viewportWidth,
      viewportHeight,
      principalOffset,
    }) {
      if (destroyed) throw new Error("Heliocentric view is destroyed.");
      const projection = projectHeliocentricView(plan, {
        rotation,
        distance,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
        // Nothing of the system is projected while it is invisible.
        system: system !== null && systemOpacity > 0,
      });
      lastProjection = projection;
      publishSun(projection);
      publishOrbit(projection);
      if (system !== null) {
        publishSystem(projection);
        publishSunMarker(projection);
      }
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
    // The system's visibility, set by the dolly before each publication so
    // the projection knows whether to work on it at all.
    setSystemOpacity(opacity) {
      if (system === null) throw new Error("The plan carries no planetary system.");
      systemOpacity = clamp(opacity, 0, 1);
      const value = String(systemOpacity);
      if (value === publishedSystemOpacity) return;
      systemGroup.style.opacity = value;
      publishedSystemOpacity = value;
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
      sunRoot.remove();
      overlay.remove();
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
        const transform = `translate(${formatNumber(state.screen[0])}px, ` +
          `${formatNumber(state.screen[1])}px)`;
        if (publishedSystemMarkerTransforms.get(body.id) !== transform) {
          element.style.transform = transform;
          publishedSystemMarkerTransforms.set(body.id, transform);
        }
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
