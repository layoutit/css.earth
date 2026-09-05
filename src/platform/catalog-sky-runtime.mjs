// Mounts a prepared catalogue sky (catalog-sky-contract.mjs) as retained DOM
// and moves it with the camera:
//   - the stars: one retained element per prepared star, grouped by band,
//     placed once at mount by its prepared rotate angles on a sphere whose
//     radius is the focal length, inside a perspective root that shares the
//     photographic sky's eye (the same CSS perspective and origin) and an
//     orientation element that receives the same skybox matrix the
//     photographic cube receives. The compositor moves every star; a
//     publication writes one transform string;
//   - the bands: shown or hidden as a group by the photometric gate
//     (`visibleBandCount`) for the current screen factor and the session's
//     magnitude limit;
//   - the captions: a fixed pool of retained caption elements in a
//     screen-space overlay, laid out above named stars by the shared label
//     pass (label-field.mjs, the reference engine's declutter): bodies'
//     captions, handed in as reserved boxes, outrank every star; overlaps are
//     dropped by priority, never drawn over one another.
// Nothing is created after mount; a publication rewrites transforms,
// visibility and text on the retained nodes.
//
// Integration: mount once beside the object's presentation roots with the
// stage as host, and call `publish(view, { reservedCaptions })` with every
// camera publication (the orbit's `onPublish` record: `skyboxMatrix`,
// `focal`, `viewportWidth`, `viewportHeight`, `principalOffset`), passing
// the accepted body captions of the heliocentric view's own pass
// (`heliocentric.state().captions.candidates` filtered to `accepted`) so
// the two passes share one clearance rule.

import {
  LABEL_OWNER_BODY,
  createLabelDeclutter,
  createLabelSlots,
  labelBox,
  labelFontPixels,
  validateLabelPolicy,
} from "./label-field.mjs";
import {
  validatePreparedCatalogSky,
  visibleBandCount,
} from "./catalog-sky-contract.mjs";
import {
  createExposure,
  hintsLimitMagnitude,
  limitingMagnitude,
  pinMagnitude,
  starIntensity,
  starRadiusPx,
} from "./point-photometry.mjs";

// The star caption class, ranked below the label field's own classes
// (focus, Sun, body) by priority rather than by this number: reserved
// captions carry the maximum priority in the shared pass.
export const LABEL_OWNER_STAR = 3;

const nativeServices = Object.freeze({ createLabelDeclutter, createLabelSlots });

export function mountRetainedCatalogSky({
  host,
  plan,
  objectId,
  magnitudeLimit = null,
  labelPolicy = plan?.labels?.policy ?? null,
  labelMagnitudeLimit = plan?.labels?.magnitudeLimit ?? null,
  ordinaryLabelLimit = plan?.labels?.ordinaryLimit ?? null,
  // The label pass's factories; only the browser suite's mutation gate
  // substitutes them, to prove its overlap checks bite.
  services = nativeServices,
}) {
  validatePreparedCatalogSky(plan);
  if (!(host instanceof HTMLElement) || !/^[a-z][a-z0-9-]*$/u.test(objectId) ||
      typeof plan.projection.cssPerspective !== "string" || !plan.projection.cssPerspective) {
    throw new TypeError("Retained catalogue sky mount arguments are invalid.");
  }
  let policy = validateLabelPolicy(labelPolicy);
  let bandMagnitudeLimit = magnitudeLimit ?? plan.bands[plan.bands.length - 1].edgeMagnitude;
  let captionMagnitudeLimit = labelMagnitudeLimit;
  let ordinaryLimit = ordinaryLabelLimit;
  if (!Number.isFinite(bandMagnitudeLimit) || !Number.isFinite(captionMagnitudeLimit)) {
    throw new TypeError("Catalogue sky magnitude limits must be finite.");
  }
  if (!Number.isSafeInteger(ordinaryLimit) || ordinaryLimit < 0 || ordinaryLimit > policy.poolSize) {
    throw new TypeError("The ordinary caption limit must be an integer within the pool.");
  }
  const document = host.ownerDocument;
  const focal = plan.projection.cssPerspective;

  // The stars.
  const root = document.createElement("div");
  root.className = `planet-catalog-sky planet-render-root ${objectId}-catalog-sky`;
  root.ariaHidden = "true";
  root.style.setProperty("--planet-catalog-sky-focal", focal);
  root.style.setProperty("--planet-catalog-sky-radius", focal);
  let halo = plan.presentation.halo;
  const applyHalo = () => {
    root.style.setProperty("--planet-catalog-star-halo-blur", String(halo.blurRadii));
    root.style.setProperty("--planet-catalog-star-halo-spread", String(halo.spreadRadii));
    root.style.setProperty("--planet-catalog-star-halo-alpha", String(halo.alpha));
  };
  applyHalo();
  const cube = document.createElement("div");
  cube.className = "planet-catalog-sky-cube";
  const orientation = document.createElement("div");
  orientation.className = `planet-catalog-sky-orientation ${objectId}-catalog-sky-orientation`;
  const columns = plan.stars;
  // The live photometry: the prepared radius and luminance columns ship;
  // a session's exposure knob (see `setExposure`) re-evaluates the chain
  // over the prepared magnitudes into these, and the elements follow.
  const liveRadius = [...columns.radiusPx];
  const liveAlpha = [...columns.alpha];
  let exposure = Object.freeze({
    adaptationLuminanceCdM2: plan.photometry.exposure.adaptationLuminanceCdM2,
    exposureScale: plan.photometry.exposure.exposureScale ?? plan.photometry.exposureScale,
    intensityMax: plan.presentation.star.intensityMax,
    maxRadiusPx: plan.presentation.star.maxRadiusPx,
    source: "prepared",
  });
  const bandElements = [];
  const starElements = [];
  for (const band of plan.bands) {
    const group = document.createElement("div");
    group.className = "planet-catalog-sky-band";
    group.dataset.band = String(band.index);
    group.dataset.faintestMagnitude = String(band.faintestMagnitude);
    for (let index = band.start; index < band.end; index += 1) {
      const star = document.createElement("s");
      star.className = "planet-catalog-star";
      star.dataset.hip = String(columns.hip[index]);
      const rgb = plan.colorClasses[columns.colorClass[index]].rgb;
      star.style.setProperty("--planet-catalog-star-radius", `${columns.radiusPx[index]}px`);
      star.style.setProperty("--planet-catalog-star-rgb", `${rgb[0]} ${rgb[1]} ${rgb[2]}`);
      star.style.opacity = String(columns.alpha[index]);
      // Prepared angles; the radius is the root's variable, so a viewport
      // change moves every star through one property.
      star.style.transform = `rotateY(${columns.rotateYDegrees[index]}deg) ` +
        `rotateX(${columns.rotateXDegrees[index]}deg) ` +
        "translateZ(calc(-1 * var(--planet-catalog-sky-radius)))";
      group.appendChild(star);
      starElements.push(star);
    }
    orientation.appendChild(group);
    bandElements.push(group);
  }
  cube.appendChild(orientation);
  root.appendChild(cube);
  host.prepend(root);

  // The captions.
  const overlay = document.createElement("div");
  overlay.className = `planet-catalog-sky-labels planet-render-root ${objectId}-catalog-labels`;
  overlay.ariaHidden = "true";
  overlay.style.fontSize = `${labelFontPixels(policy)}px`;
  const labelElements = [];
  for (let index = 0; index < policy.poolSize; index += 1) {
    const element = document.createElement("s");
    element.className = `planet-catalog-label ${objectId}-catalog-label`;
    element.style.opacity = "0";
    element.style.visibility = "hidden";
    overlay.appendChild(element);
    labelElements.push(element);
  }
  host.appendChild(overlay);
  // Widths per cap height, measured once from the retained DOM at mount
  // (one layout for every name) and then the measuring nodes are gone: the
  // shell's font stack resolves to the platform's system face, so widths
  // are measured, never assumed.
  const widthPerCapHeight = measureWidthsPerCapHeight(document, overlay, plan.named, policy.capPixels);

  const { createLabelDeclutter: createDeclutter, createLabelSlots: createSlots } = { ...nativeServices, ...services };
  let declutter = createDeclutter({ capacity: policy.candidateCapacity, spacingPixels: policy.spacingPixels });
  let pool = createSlots({ poolSize: policy.poolSize, maxAlpha: policy.maxAlpha, maxAlphaStep: policy.maxAlphaStep });
  const published = labelElements.map(() => ({ text: null, transform: null, opacity: null, hidden: true }));
  let publishedMatrix = null;
  let rotation = null;
  let publishedFactor = null;
  let publishedBandCount = null;
  let lastView = null;
  let lastCandidates = [];
  let lastAccepted = [];
  let lastReservedCount = 0;
  let settled = false;
  let publications = 0;
  let destroyed = false;

  const applyBands = (factor) => {
    const count = visibleBandCount(plan, { screenFactor: factor, magnitudeLimit: bandMagnitudeLimit });
    if (count === publishedBandCount) return count;
    bandElements.forEach((group, index) => {
      const hidden = index >= count;
      if (group.hidden !== hidden) group.hidden = hidden;
    });
    publishedBandCount = count;
    return count;
  };

  return Object.freeze({
    plan,
    root,
    orientation,
    overlay,
    bandElements: Object.freeze(bandElements),
    labelElements: Object.freeze(labelElements),
    retainedStarCount: starElements.length,
    retainedLabelCount: labelElements.length,
    publish(view, { reservedCaptions = [] } = {}) {
      if (destroyed) throw new Error("Catalogue sky is destroyed.");
      if (typeof view?.skyboxMatrix !== "string" || !(view.focal > 0) ||
          !(view.viewportWidth > 0) || !(view.viewportHeight > 0) ||
          !Array.isArray(view.principalOffset) || view.principalOffset.length !== 2 ||
          view.principalOffset.some((value) => !Number.isFinite(value))) {
        throw new TypeError("Catalogue sky publication needs the skybox matrix and the perspective camera's facts.");
      }
      if (view.skyboxMatrix !== publishedMatrix) {
        orientation.style.transform = view.skyboxMatrix;
        rotation = rotationFromMatrix3d(new DOMMatrix(view.skyboxMatrix));
        publishedMatrix = view.skyboxMatrix;
      }
      const factor = screenFactor(view.viewportWidth, view.viewportHeight);
      if (factor !== publishedFactor) {
        root.style.setProperty("--planet-catalog-sky-radius", `calc(${focal} / ${factor})`);
        publishedFactor = factor;
      }
      applyBands(factor);
      lastView = Object.freeze({
        focal: view.focal, viewportWidth: view.viewportWidth, viewportHeight: view.viewportHeight,
        principalOffset: Object.freeze([...view.principalOffset]), screenFactor: factor,
      });
      publishCaptions(lastView, reservedCaptions);
      publications += 1;
    },
    // Session knobs. Bands: the faintest prepared band shown. Captions: the
    // policy's geometry and alpha, and the faintest named star captioned.
    setMagnitudeLimit(limit) {
      if (!Number.isFinite(limit)) throw new TypeError("Magnitude limit must be finite.");
      bandMagnitudeLimit = limit;
      if (publishedFactor !== null) applyBands(publishedFactor);
      return bandMagnitudeLimit;
    },
    setLabelPolicy({ magnitudeLimit: nextLimit, ordinaryLimit: nextOrdinary, ...overrides } = {}) {
      if (nextLimit !== undefined) {
        if (!Number.isFinite(nextLimit)) throw new TypeError("Caption magnitude limit must be finite.");
        captionMagnitudeLimit = nextLimit;
      }
      if (nextOrdinary !== undefined) {
        if (!Number.isSafeInteger(nextOrdinary) || nextOrdinary < 0 || nextOrdinary > policy.poolSize) {
          throw new TypeError("The ordinary caption limit must be an integer within the pool.");
        }
        ordinaryLimit = nextOrdinary;
      }
      if (Object.keys(overrides).length) {
        const next = validateLabelPolicy(Object.freeze({ ...policy, ...overrides, poolSize: policy.poolSize }));
        policy = next;
        overlay.style.fontSize = `${labelFontPixels(policy)}px`;
        declutter = createDeclutter({ capacity: policy.candidateCapacity, spacingPixels: policy.spacingPixels });
        pool = createSlots({ poolSize: policy.poolSize, maxAlpha: policy.maxAlpha, maxAlphaStep: policy.maxAlphaStep });
        settled = false;
      }
      if (lastView !== null) publishCaptions(lastView, []);
      return Object.freeze({ policy, magnitudeLimit: captionMagnitudeLimit, ordinaryLimit });
    },
    // The exposure, live: which eye the chain models (the adaptation
    // luminance; the reference's 0.052 is fully dark-adapted, higher is
    // less adapted and dims every star in proportion), the gain in front
    // of the tone map, the luminance ceiling and the disc ceiling. The
    // chain is re-evaluated over the prepared magnitudes for every star and
    // the retained elements are rewritten once; the prepared values are
    // the defaults and what ships. `haloPeak` is the reference's bloom peak
    // (the shadow's colour alpha is twice it, see the prepared halo).
    setExposure({ adaptationLuminanceCdM2, exposureScale, intensityMax, maxRadiusPx, haloPeak } = {}) {
      const next = Object.freeze({
        ...exposure,
        ...(adaptationLuminanceCdM2 === undefined ? {} : { adaptationLuminanceCdM2 }),
        ...(exposureScale === undefined ? {} : { exposureScale }),
        ...(intensityMax === undefined ? {} : { intensityMax }),
        ...(maxRadiusPx === undefined ? {} : { maxRadiusPx }),
        source: "session",
      });
      if (!(next.intensityMax > 0) || next.intensityMax > 1 || !(next.maxRadiusPx > 0)) {
        throw new TypeError("Star exposure ceilings are invalid.");
      }
      const chain = createExposure({
        fovDegrees: plan.projection.horizontalFovDegrees,
        adaptationLuminanceCdM2: next.adaptationLuminanceCdM2,
        exposureScale: next.exposureScale,
      });
      for (let index = 0; index < starElements.length; index += 1) {
        const magnitude = columns.magnitude[index];
        const radius = Number(starRadiusPx(chain, magnitude, next.maxRadiusPx).toFixed(3));
        const alpha = Number(starIntensity(chain, magnitude, next.intensityMax).toFixed(3));
        if (radius !== liveRadius[index]) {
          liveRadius[index] = radius;
          starElements[index].style.setProperty("--planet-catalog-star-radius", `${radius}px`);
        }
        if (alpha !== liveAlpha[index]) {
          liveAlpha[index] = alpha;
          starElements[index].style.opacity = String(alpha);
        }
      }
      exposure = next;
      if (haloPeak !== undefined) this.setStarPresentation({ haloAlpha: haloPeak * 2 });
      if (lastView !== null) publishCaptions(lastView, []);
      return Object.freeze({
        ...exposure,
        limitingMagnitude: limitingMagnitude(chain),
        hintsLimitMagnitude: hintsLimitMagnitude(chain),
        pinMagnitude: pinMagnitude(chain),
        haloPeak: halo.alpha / 2,
      });
    },
    // The bloom, live: blur and spread in radii, and the colour alpha.
    setStarPresentation({ haloBlurRadii, haloSpreadRadii, haloAlpha } = {}) {
      const next = {
        ...halo,
        ...(haloBlurRadii === undefined ? {} : { blurRadii: haloBlurRadii }),
        ...(haloSpreadRadii === undefined ? {} : { spreadRadii: haloSpreadRadii }),
        ...(haloAlpha === undefined ? {} : { alpha: haloAlpha }),
      };
      if (!(next.blurRadii >= 0) || !(next.spreadRadii >= 0) || !(next.alpha > 0) || next.alpha > 1) {
        throw new TypeError("Star halo presentation is invalid.");
      }
      halo = Object.freeze(next);
      applyHalo();
      return halo;
    },
    state() {
      return Object.freeze({
        starCount: starElements.length,
        bandCount: bandElements.length,
        visibleBandCount: publishedBandCount ?? 0,
        visibleStarCount: plan.bands.slice(0, publishedBandCount ?? 0).reduce((total, band) => total + band.count, 0),
        magnitudeLimit: bandMagnitudeLimit,
        screenFactor: publishedFactor,
        view: lastView,
        publications,
        halo,
        exposure,
        labels: Object.freeze({
          policy,
          magnitudeLimit: captionMagnitudeLimit,
          ordinaryLimit,
          namedCount: plan.named.length,
          reservedCount: lastReservedCount,
          candidateCount: lastCandidates.length,
          acceptedCount: lastAccepted.length,
          candidates: Object.freeze(lastCandidates.map((candidate) => Object.freeze({
            key: candidate.key, owner: candidate.owner, id: candidate.id, text: candidate.text,
            priority: candidate.priority, anchor: candidate.anchor, alpha: candidate.alpha, ...candidate.box,
            accepted: lastAccepted.includes(candidate),
          }))),
          slots: Object.freeze(pool.slots.map((slot) => Object.freeze({
            occupant: slot.occupant, text: slot.text, alpha: slot.alpha, target: slot.target,
            anchor: slot.anchor, bottomOffsetPx: slot.bottomOffsetPx,
          }))),
          widthPerCapHeight: Object.freeze(Object.fromEntries(widthPerCapHeight)),
        }),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.remove();
      overlay.remove();
    },
  });

  // One pass over the reserved (body) captions and every named star on
  // screen, brightest first, then the retained slots and their writes.
  function publishCaptions({ focal: focalPx, viewportWidth, viewportHeight, principalOffset: [ox, oy], screenFactor: factor }, reservedCaptions) {
    declutter.reset();
    const candidates = [];
    let reservedCount = 0;
    for (const reserved of reservedCaptions) {
      if (!Array.isArray(reserved?.anchor) || !(reserved.widthPx >= 0) ||
          !Number.isFinite(reserved.bottomOffsetPx) || !Number.isFinite(reserved.topOffsetPx)) {
        throw new TypeError("A reserved caption needs its anchor and box.");
      }
      declutter.add({
        owner: LABEL_OWNER_BODY, id: reserved.id ?? reserved.key ?? String(reservedCount),
        priority: Number.MAX_VALUE, anchor: [reserved.anchor[0], reserved.anchor[1]],
        widthPx: reserved.widthPx, bottomOffsetPx: reserved.bottomOffsetPx, topOffsetPx: reserved.topOffsetPx,
      });
      reservedCount += 1;
    }
    const halfWidth = viewportWidth / 2;
    const halfHeight = viewportHeight / 2;
    if (rotation !== null) {
      for (const star of plan.named) {
        const magnitude = columns.magnitude[star.index];
        if (magnitude > captionMagnitudeLimit) continue;
        const [x, y, z] = star.direction;
        const ex = rotation[0] * x + rotation[1] * y + rotation[2] * z;
        const ey = rotation[3] * x + rotation[4] * y + rotation[5] * z;
        const depth = -(rotation[6] * x + rotation[7] * y + rotation[8] * z);
        if (!(depth > 0.05)) continue;
        // Camera-root coordinates: the eye at the principal point, the same
        // frame the heliocentric view's captions are anchored in.
        const screenX = ox + focalPx * ex / depth;
        const screenY = oy + focalPx * ey / depth;
        if (Math.abs(screenX) > halfWidth || Math.abs(screenY) > halfHeight) continue;
        const geometry = labelBox(policy, {
          widthPerCapHeight: widthPerCapHeight.get(star.index),
          markerRadiusPx: liveRadius[star.index] * factor,
        });
        // A caption is drawn whole or not at all: its box stays inside the
        // viewport (the reference clips by anchor; a clipped name reads as
        // a defect on a retained overlay).
        if (screenX - geometry.widthPx / 2 < -halfWidth || screenX + geometry.widthPx / 2 > halfWidth ||
            screenY - geometry.topOffsetPx < -halfHeight) continue;
        const anchor = [screenX, screenY];
        if (!declutter.add({ owner: LABEL_OWNER_STAR, id: star.hip, priority: -magnitude, anchor, ...geometry })) break;
        candidates.push({
          owner: LABEL_OWNER_STAR, id: star.hip, key: `star:${star.hip}`, priority: -magnitude, anchor,
          alpha: liveAlpha[star.index], text: star.name, bottomOffsetPx: geometry.bottomOffsetPx,
          box: Object.freeze({ widthPx: geometry.widthPx, bottomOffsetPx: geometry.bottomOffsetPx, topOffsetPx: geometry.topOffsetPx }),
        });
      }
    }
    // The pass, then the reference's ordinary-caption budget: the first
    // `ordinaryLimit` accepted stars in priority order carry a caption.
    const acceptedKeys = new Set(declutter.resolve()
      .filter((entry) => entry.owner === LABEL_OWNER_STAR).map((entry) => `star:${entry.id}`));
    lastReservedCount = reservedCount;
    lastCandidates = candidates;
    lastAccepted = candidates.filter((candidate) => acceptedKeys.has(candidate.key))
      .sort((a, b) => b.priority - a.priority).slice(0, ordinaryLimit);
    const slots = pool.assign(lastAccepted, settled);
    settled = true;
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const element = labelElements[index];
      const record = published[index];
      const hidden = slot.occupant === null || slot.alpha <= 0;
      if (!hidden) {
        if (record.text !== slot.text) {
          element.textContent = slot.text;
          record.text = slot.text;
        }
        // The overlay is centred on the principal point: back from the
        // camera-root frame, then the caption's bottom-centre at the anchor,
        // `bottomOffset` above it.
        const transform = `translate(${formatNumber(slot.anchor[0] - ox)}px, ` +
          `${formatNumber(slot.anchor[1] - oy - slot.bottomOffsetPx)}px) translate(-50%, -100%)`;
        if (record.transform !== transform) {
          element.style.transform = transform;
          record.transform = transform;
        }
        const opacity = formatNumber(slot.alpha);
        if (record.opacity !== opacity) {
          element.style.opacity = opacity;
          record.opacity = opacity;
        }
      }
      if (record.hidden !== hidden) {
        element.style.visibility = hidden ? "hidden" : "";
        record.hidden = hidden;
      }
    }
  }
}

function measureWidthsPerCapHeight(document, overlay, named, capPixels) {
  const measure = document.createElement("div");
  measure.className = "planet-catalog-sky-measure";
  const elements = named.map((star) => {
    const element = document.createElement("s");
    element.textContent = star.name;
    measure.appendChild(element);
    return element;
  });
  overlay.appendChild(measure);
  const widths = new Map();
  try {
    named.forEach((star, index) => {
      const width = elements[index].getBoundingClientRect().width;
      widths.set(star.index, width > 0 ? width / capPixels : star.name.length * 0.9);
    });
  } finally {
    measure.remove();
  }
  return widths;
}

// The reference's resolution compensation, clamp(min(w, h) / 600, 0.7, 1.5);
// the same numbers the preparation's photometry carries.
function screenFactor(width, height) {
  return Math.min(1.5, Math.max(0.7, Math.min(width, height) / 600));
}

// Row-major 3x3 rotation from a CSS matrix3d: the linear part mapping a
// cube-local direction into the sky root's camera space.
function rotationFromMatrix3d(matrix) {
  return [
    matrix.m11, matrix.m21, matrix.m31,
    matrix.m12, matrix.m22, matrix.m32,
    matrix.m13, matrix.m23, matrix.m33,
  ];
}

function formatNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(3)).toString();
}
