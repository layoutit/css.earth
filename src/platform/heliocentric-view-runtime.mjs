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
//     findable on its orbit once its true disc is too small to read.
// Everything is created once; publication only rewrites transforms and
// visibility on the retained nodes.
export function mountRetainedHeliocentricView({
  host,
  before = null,
  plan,
  objectId,
  sunImageUrl,
  markerSprite,
  orbitPoolSpare = 48,
}) {
  validatePreparedHeliocentricView(plan);
  if (!(host instanceof HTMLElement) ||
      (before !== null && !(before instanceof HTMLElement)) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) || typeof sunImageUrl !== "string" ||
      typeof markerSprite?.url !== "string" ||
      !Number.isSafeInteger(markerSprite.index) || markerSprite.index < 0 ||
      !Number.isSafeInteger(markerSprite.count) ||
      markerSprite.count <= markerSprite.index ||
      !(markerSprite.size > 0)) {
    throw new TypeError("Retained heliocentric view mount arguments are invalid.");
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
  marker.style.width = `${markerSprite.size}px`;
  marker.style.height = `${markerSprite.size}px`;
  marker.style.margin = `${-markerSprite.size / 2}px 0 0 ` +
    `${-markerSprite.size / 2}px`;
  marker.style.backgroundImage = `url("${markerSprite.url}")`;
  marker.style.backgroundPosition = `${(markerSprite.index /
    Math.max(1, markerSprite.count - 1) * 100).toFixed(4)}% center`;
  marker.style.backgroundSize = `${markerSprite.count * 100}% 100%`;
  marker.style.opacity = "0";
  overlay.appendChild(marker);
  host.appendChild(overlay);

  let lastProjection = null;
  let publishedSunTransform = null;
  let publishedSunHidden = true;
  let publishedOrbitOpacity = null;
  let publishedMarkerOpacity = null;
  let activePieceCount = 0;
  let overflowCount = 0;
  let destroyed = false;

  return Object.freeze({
    plan,
    root: sunRoot,
    sunRoot,
    sun,
    overlay,
    marker,
    retainedOrbitPieceCount: poolSize,
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
      });
      lastProjection = projection;
      publishSun(projection);
      publishOrbit(projection);
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
    const segments = projection.orbitSegments;
    const count = Math.min(segments.length, pieces.length);
    if (segments.length > pieces.length) overflowCount += 1;
    // Pieces are laid out at the overlay's centre, so the projection's
    // centre-relative screen offsets are the translation as they are.
    for (let index = 0; index < count; index += 1) {
      const [x0, y0, x1, y1] = segments[index];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.hypot(dx, dy);
      const piece = pieces[index];
      piece.style.transform = `matrix(${formatNumber(dx)},${formatNumber(dy)},${
        formatNumber(-dy / length)},${formatNumber(dx / length)},${
        formatNumber(x0)},${formatNumber(y0)})`;
      if (piece.style.visibility !== "") piece.style.visibility = "";
    }
    for (let index = count; index < activePieceCount; index += 1) {
      pieces[index].style.visibility = "hidden";
    }
    activePieceCount = count;
  }

}

function formatNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
