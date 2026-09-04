import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import sharp from "sharp";

import { ORACLE_SCENE_CENTER } from "./profile.mjs";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function comparePngBuffers(leftBytes, rightBytes, {
  pixelmatchThreshold = 0.1,
} = {}) {
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(
      `PNG dimensions differ: ${left.width}x${left.height} and ` +
      `${right.width}x${right.height}.`,
    );
  }
  const diff = new PNG({ width: left.width, height: left.height });
  const changedPixels = pixelmatch(
    left.data,
    right.data,
    diff.data,
    left.width,
    left.height,
    { threshold: pixelmatchThreshold, includeAA: true },
  );
  const totalPixels = left.width * left.height;
  return Object.freeze({
    width: left.width,
    height: left.height,
    changedPixels,
    totalPixels,
    changedPixelRatio: changedPixels / totalPixels,
    pixelmatchDiff: PNG.sync.write(diff),
  });
}

export function classifySceneLod(bytes) {
  const png = PNG.sync.read(bytes);
  let backgroundSamples = 0;
  let backgroundLuminance = 0;
  let backgroundBrightPixels = 0;
  const exclusionRadius = Math.min(260, png.height * 0.43);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (Math.hypot(
        x - ORACLE_SCENE_CENTER.x,
        y - ORACLE_SCENE_CENTER.y,
      ) <= exclusionRadius) continue;
      const luminance = relativeLuminance(
        png.data,
        (y * png.width + x) * 4,
      );
      backgroundSamples += 1;
      backgroundLuminance += luminance;
      if (luminance > 32) backgroundBrightPixels += 1;
    }
  }
  const centerIndex = (Math.round(ORACLE_SCENE_CENTER.y) * png.width +
    Math.round(ORACLE_SCENE_CENTER.x)) * 4;
  const backgroundMeanLuminance = backgroundLuminance / backgroundSamples;
  const backgroundBrightPixelRatio = backgroundBrightPixels / backgroundSamples;
  const centerLuminance = relativeLuminance(png.data, centerIndex);
  const mapDetailOnly = centerLuminance > 8 &&
    backgroundMeanLuminance < 0.5 && backgroundBrightPixelRatio < 0.001;
  return Object.freeze({
    state: mapDetailOnly ? "map-detail-only" : "space-scene",
    comparableSpaceScene: !mapDetailOnly,
    basis: "outer-field-luminance-and-center-disc-presence",
    backgroundSampleCount: backgroundSamples,
    backgroundMeanLuminance,
    backgroundBrightPixelRatio,
    centerLuminance,
  });
}

export async function writeAbsoluteDiff(leftPath, rightPath, outputPath) {
  const [leftBytes, rightBytes] = await Promise.all([
    readFile(leftPath),
    readFile(rightPath),
  ]);
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error("Cannot create an absolute diff for unequal dimensions.");
  }
  const output = new PNG({ width: left.width, height: left.height });
  for (let index = 0; index < output.data.length; index += 4) {
    output.data[index] = Math.abs(left.data[index] - right.data[index]);
    output.data[index + 1] = Math.abs(
      left.data[index + 1] - right.data[index + 1],
    );
    output.data[index + 2] = Math.abs(
      left.data[index + 2] - right.data[index + 2],
    );
    output.data[index + 3] = 255;
  }
  const bytes = PNG.sync.write(output);
  await writeFile(outputPath, bytes);
  return Object.freeze({
    bytes,
    width: output.width,
    height: output.height,
    sha256: sha256(bytes),
  });
}

export async function writeTriptych(
  referencePath,
  browserPath,
  absoluteDiffPath,
  outputPath,
) {
  const images = await Promise.all(
    [referencePath, browserPath, absoluteDiffPath].map(async (path) => ({
      path,
      metadata: await sharp(path).metadata(),
    })),
  );
  const width = images[0].metadata.width;
  const height = images[0].metadata.height;
  if (!width || !height || images.some(({ metadata }) =>
    metadata.width !== width || metadata.height !== height)) {
    throw new Error("Triptych inputs must have identical non-zero dimensions.");
  }
  await sharp({
    create: {
      width: width * 3,
      height,
      channels: 3,
      background: "#000000",
    },
  }).composite([
    { input: referencePath, left: 0, top: 0 },
    { input: browserPath, left: width, top: 0 },
    { input: absoluteDiffPath, left: width * 2, top: 0 },
  ]).png().toFile(outputPath);
  const bytes = await readFile(outputPath);
  return Object.freeze({
    width: width * 3,
    height,
    sha256: sha256(bytes),
  });
}

export function analyzeScenePng(bytes) {
  const png = PNG.sync.read(bytes);
  const silhouette = detectSilhouette(png);
  const planet = detectPlanet(png, silhouette);
  const sun = detectSun(png, planet, silhouette);
  const discPhase = analyzeDiscPhase(png, silhouette);
  const terminator = analyzeTerminatorShape(png, planet, silhouette, sun);
  return Object.freeze({
    width: png.width,
    height: png.height,
    planet,
    silhouette,
    sun,
    discPhase,
    terminator,
    illumination: analyzeIlluminationProfile(png, silhouette, terminator),
    background: analyzeBackground(png, silhouette),
  });
}

export async function writeIndependentCaptures({
  referenceBytes,
  browserBytes,
  referenceAnalysis,
  browserAnalysis,
  outputRoot,
}) {
  const reference = PNG.sync.read(referenceBytes);
  const browser = PNG.sync.read(browserBytes);
  if (reference.width !== browser.width || reference.height !== browser.height) {
    throw new Error("Independent capture inputs must use identical dimensions.");
  }
  const sharedSilhouettes = Object.freeze([
    referenceAnalysis.silhouette,
    browserAnalysis.silhouette,
  ]);
  const sharedSuns = Object.freeze([
    referenceAnalysis.sun,
    browserAnalysis.sun,
  ].filter(({ visible }) => visible));
  const captures = Object.freeze({
    starfield: Object.freeze({
      basis: "source-background-outside-shared-silhouette-and-sun-union",
      reference: renderStarfield(reference, sharedSilhouettes, sharedSuns),
      browser: renderStarfield(browser, sharedSilhouettes, sharedSuns),
    }),
    sun: Object.freeze({
      basis: "source-pixels-inside-detected-sun-neighborhood",
      reference: renderSun(reference, referenceAnalysis.sun, sharedSilhouettes),
      browser: renderSun(browser, browserAnalysis.sun, sharedSilhouettes),
    }),
  });
  const result = {};
  for (const [id, capture] of Object.entries(captures)) {
    const referencePath = resolve(outputRoot, `${id}-google.png`);
    const browserPath = resolve(outputRoot, `${id}-browser.png`);
    const absoluteDiffPath = resolve(outputRoot, `${id}-absolute.png`);
    const triptychPath = resolve(
      outputRoot,
      `${id}-google-browser-absolute.png`,
    );
    const [referencePng, browserPng] = [
      PNG.sync.write(capture.reference),
      PNG.sync.write(capture.browser),
    ];
    await Promise.all([
      writeFile(referencePath, referencePng),
      writeFile(browserPath, browserPng),
    ]);
    const comparison = comparePngBuffers(referencePng, browserPng);
    const absoluteDiff = await writeAbsoluteDiff(
      referencePath,
      browserPath,
      absoluteDiffPath,
    );
    const triptych = await writeTriptych(
      referencePath,
      browserPath,
      absoluteDiffPath,
      triptychPath,
    );
    result[id] = Object.freeze({
      basis: capture.basis,
      ...(capture.opacityCompared === undefined ? {} : {
        opacityCompared: capture.opacityCompared,
      }),
      ...(capture.referenceTrace === undefined ? {} : {
        referenceTrace: capture.referenceTrace,
        browserTrace: capture.browserTrace,
      }),
      changedPixelRatio: comparison.changedPixelRatio,
      reference: Object.freeze({
        path: referencePath,
        sha256: sha256(referencePng),
      }),
      browser: Object.freeze({
        path: browserPath,
        sha256: sha256(browserPng),
      }),
      absoluteDiff: Object.freeze({
        path: absoluteDiffPath,
        sha256: absoluteDiff.sha256,
      }),
      triptych: Object.freeze({
        path: triptychPath,
        sha256: triptych.sha256,
      }),
    });
  }
  return Object.freeze(result);
}

export function compareSilhouetteShapes(reference, browser, {
  maximumRadiusDeltaRatio,
} = {}) {
  const referenceRadius = (reference.radiusX + reference.radiusY) / 2;
  const browserRadius = (browser.radiusX + browser.radiusY) / 2;
  const radiusDeltaRatio = Math.abs(referenceRadius - browserRadius) /
    referenceRadius;
  const centerDeltaPixels = Math.hypot(
    reference.center.x - browser.center.x,
    reference.center.y - browser.center.y,
  );
  const radiusScore = Math.min(referenceRadius, browserRadius) /
    Math.max(referenceRadius, browserRadius);
  const centerScore = clampUnit(
    1 - centerDeltaPixels / Math.max(1, referenceRadius * 0.05),
  );
  const score = radiusScore * 0.8 + centerScore * 0.2;
  const withinTolerance = Number.isFinite(maximumRadiusDeltaRatio) &&
    radiusDeltaRatio <= maximumRadiusDeltaRatio && centerDeltaPixels <= 3;
  const qualified = [referenceRadius, browserRadius, centerDeltaPixels]
    .every(Number.isFinite) && referenceRadius > 0 && browserRadius > 0;
  return Object.freeze({
    basis: "centered-radial-silhouette-without-background-area",
    score,
    scorePercent: score * 100,
    qualified,
    withinTolerance,
    maximumRadiusDeltaRatio,
    radiusDeltaRatio,
    centerDeltaPixels,
    referenceRadius,
    browserRadius,
  });
}

export function compareSunPresentations(reference, browser, {
  maximumCentroidDeltaPixels = null,
} = {}) {
  const stateMatch = reference.state === browser.state;
  if (!reference.visible && !browser.visible) {
    return Object.freeze({
      basis: "compact-bright-core-visibility-and-placement",
      eligible: false,
      appearanceCoverage: false,
      score: null,
      scorePercent: null,
      qualified: stateMatch,
      stateMatch,
      referenceState: reference.state,
      browserState: browser.state,
      centroidDeltaPixels: null,
      footprintScore: null,
      luminanceScore: null,
    });
  }
  if (!reference.visible || !browser.visible) {
    return Object.freeze({
      basis: "compact-bright-core-visibility-and-placement",
      eligible: true,
      appearanceCoverage: false,
      score: 0,
      scorePercent: 0,
      qualified: true,
      stateMatch,
      referenceState: reference.state,
      browserState: browser.state,
      centroidDeltaPixels: null,
      footprintScore: 0,
      luminanceScore: 0,
    });
  }
  const centroidDeltaPixels = Math.hypot(
    reference.centroid.x - browser.centroid.x,
    reference.centroid.y - browser.centroid.y,
  );
  const positionScale = Number.isFinite(maximumCentroidDeltaPixels)
    ? maximumCentroidDeltaPixels * 2
    : 24;
  const positionScore = clampUnit(1 - centroidDeltaPixels / positionScale);
  const footprintScore = Math.min(reference.pixelCount, browser.pixelCount) /
    Math.max(reference.pixelCount, browser.pixelCount);
  const luminanceScore = Math.min(reference.luminanceSum, browser.luminanceSum) /
    Math.max(reference.luminanceSum, browser.luminanceSum);
  const score = stateMatch
    ? positionScore * 0.5 + footprintScore * 0.25 + luminanceScore * 0.25
    : 0;
  const withinTolerance = stateMatch &&
    Number.isFinite(maximumCentroidDeltaPixels) &&
    centroidDeltaPixels <= maximumCentroidDeltaPixels;
  return Object.freeze({
    basis: "compact-bright-core-visibility-and-placement",
    eligible: true,
    appearanceCoverage: true,
    score,
    scorePercent: score * 100,
    qualified: true,
    withinTolerance,
    stateMatch,
    referenceState: reference.state,
    browserState: browser.state,
    maximumCentroidDeltaPixels,
    centroidDeltaPixels,
    positionScore,
    footprintScore,
    luminanceScore,
  });
}

export function compareStarfieldFeatures(
  referenceBytes,
  browserBytes,
  referenceAnalysis,
  browserAnalysis,
) {
  const reference = PNG.sync.read(referenceBytes);
  const browser = PNG.sync.read(browserBytes);
  if (reference.width !== browser.width || reference.height !== browser.height) {
    throw new Error("Starfield inputs must use identical dimensions.");
  }
  const threshold = 12;
  const referenceMask = starfieldFeatureMask(reference, referenceAnalysis,
    browserAnalysis, threshold);
  const browserMask = starfieldFeatureMask(browser, referenceAnalysis,
    browserAnalysis, threshold);
  let referenceCount = 0;
  let browserCount = 0;
  let matchedReference = 0;
  let matchedBrowser = 0;
  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const index = y * reference.width + x;
      if (referenceMask[index]) {
        referenceCount += 1;
        if (hasNeighbor(browserMask, reference.width, reference.height, x, y)) {
          matchedReference += 1;
        }
      }
      if (browserMask[index]) {
        browserCount += 1;
        if (hasNeighbor(referenceMask, reference.width, reference.height, x, y)) {
          matchedBrowser += 1;
        }
      }
    }
  }
  const recall = referenceCount === 0 ? 0 : matchedReference / referenceCount;
  const precision = browserCount === 0 ? 0 : matchedBrowser / browserCount;
  const featureF1 = recall + precision === 0
    ? 0
    : 2 * recall * precision / (recall + precision);
  const referenceMean = referenceAnalysis.background.meanLuminance;
  const browserMean = browserAnalysis.background.meanLuminance;
  const luminanceScore = Math.min(referenceMean, browserMean) /
    Math.max(referenceMean, browserMean);
  const score = featureF1 * 0.75 + luminanceScore * 0.25;
  const qualified = referenceCount >= 100 && browserCount >= 100;
  return Object.freeze({
    basis: "bright-feature-f1-with-one-pixel-tolerance-and-luminance-ratio",
    score,
    scorePercent: score * 100,
    qualified,
    threshold,
    referenceFeaturePixels: referenceCount,
    browserFeaturePixels: browserCount,
    matchedReferenceFeaturePixels: matchedReference,
    matchedBrowserFeaturePixels: matchedBrowser,
    precision,
    recall,
    featureF1,
    referenceMeanLuminance: referenceMean,
    browserMeanLuminance: browserMean,
    luminanceScore,
  });
}

export function compareShadowShapes(
  referenceBytes,
  browserBytes,
  referenceAnalysis,
  browserAnalysis,
) {
  const reference = PNG.sync.read(referenceBytes);
  const browser = PNG.sync.read(browserBytes);
  if (reference.width !== browser.width || reference.height !== browser.height) {
    throw new Error("Shadow-shape inputs must use identical dimensions.");
  }
  const referenceShape = shadowShapeMask(reference, referenceAnalysis);
  const browserShape = shadowShapeMask(browser, browserAnalysis);
  let referenceLitPixels = 0;
  let browserLitPixels = 0;
  let intersectionPixels = 0;
  for (let index = 0; index < referenceShape.mask.length; index += 1) {
    if (referenceShape.mask[index]) referenceLitPixels += 1;
    if (browserShape.mask[index]) browserLitPixels += 1;
    if (referenceShape.mask[index] && browserShape.mask[index]) {
      intersectionPixels += 1;
    }
  }
  const bothEmpty = referenceLitPixels === 0 && browserLitPixels === 0;
  const dice = bothEmpty
    ? 1
    : 2 * intersectionPixels / (referenceLitPixels + browserLitPixels);
  const maximumLitFraction = Math.max(referenceShape.litFraction,
    browserShape.litFraction);
  const litFractionScore = maximumLitFraction === 0
    ? 1
    : Math.min(referenceShape.litFraction, browserShape.litFraction) /
      maximumLitFraction;
  const score = dice * 0.8 + litFractionScore * 0.2;
  const qualified = referenceShape.qualified && browserShape.qualified;
  return Object.freeze({
    basis: "binary-lit-shape-from-source-visible-terminator-geometry",
    opacityCompared: false,
    score,
    scorePercent: score * 100,
    qualified,
    dice,
    litFractionScore,
    intersectionPixels,
    reference: shadowShapeSummary(referenceShape),
    browser: shadowShapeSummary(browserShape),
  });
}

export function compareIlluminationTransfers(reference, browser) {
  const weights = Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 3, 5]);
  const binScores = reference.meanLuminance.map((referenceMean, index) => {
    const browserMean = browser.meanLuminance[index];
    const maximum = Math.max(referenceMean, browserMean);
    return maximum === 0 ? 1 : Math.min(referenceMean, browserMean) / maximum;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const score = binScores.reduce((sum, value, index) =>
    sum + value * weights[index], 0) / totalWeight;
  const qualified = reference.sampleCounts.every((count) => count >= 100) &&
    browser.sampleCounts.every((count) => count >= 100);
  return Object.freeze({
    basis: "absolute-light-axis-luminance-profile-with-sunward-shoulder-weighting",
    score,
    scorePercent: score * 100,
    qualified,
    weights,
    binScores: Object.freeze(binScores),
    reference,
    browser,
  });
}

export function compareTerminatorShapes(reference, browser) {
  const orientationDeltaDegrees = circularAngleDifference(
    reference.lightDirectionDegrees,
    browser.lightDirectionDegrees,
  );
  const comparisonQualified = reference.trace.coherent && browser.trace.coherent;
  return Object.freeze({
    comparisonBasis: "terminator-geometry-only",
    opacityCompared: false,
    comparisonQualified,
    qualification: comparisonQualified
      ? "BOTH_TERMINATOR_TRACES_COHERENT"
      : "UNRESOLVED_INCOHERENT_TERMINATOR_TRACE",
    referenceTrace: reference.trace,
    browserTrace: browser.trace,
    orientationDeltaDegrees,
    boundaryOffsetDeltaRadii: Math.abs(
      reference.fit.offsetRadii - browser.fit.offsetRadii,
    ),
    boundaryTiltDelta: Math.abs(
      reference.fit.tilt - browser.fit.tilt,
    ),
    boundaryCurvatureDelta: Math.abs(
      reference.fit.curvature - browser.fit.curvature,
    ),
    normalizedSymmetricShapeDistance: symmetricShapeDistance(
      reference.boundary,
      browser.boundary,
    ),
  });
}

export function interactionDelta(defaultBytes, endpointBytes) {
  const baseline = PNG.sync.read(defaultBytes);
  const endpoint = PNG.sync.read(endpointBytes);
  if (baseline.width !== endpoint.width || baseline.height !== endpoint.height) {
    throw new Error("Interaction endpoints must have identical dimensions.");
  }
  const baselinePlanet = detectPlanet(baseline, detectSilhouette(baseline));
  const endpointPlanet = detectPlanet(endpoint, detectSilhouette(endpoint));
  const planetRadius = Math.ceil(Math.max(
    baselinePlanet.radius,
    endpointPlanet.radius,
  ) * 1.05);
  let planetChanged = 0;
  let planetPixels = 0;
  let backgroundChanged = 0;
  let backgroundPixels = 0;
  const center = ORACLE_SCENE_CENTER;
  for (let y = 0; y < baseline.height; y += 1) {
    for (let x = 0; x < baseline.width; x += 1) {
      const index = (y * baseline.width + x) * 4;
      const changed = maximumChannelDelta(
        baseline.data,
        endpoint.data,
        index,
      ) > 25;
      const distance = Math.hypot(x - center.x, y - center.y);
      if (distance <= planetRadius) {
        planetPixels += 1;
        if (changed) planetChanged += 1;
      } else if (distance >= planetRadius + 24) {
        backgroundPixels += 1;
        if (changed) backgroundChanged += 1;
      }
    }
  }
  return Object.freeze({
    planetChangedPixelRatio: planetPixels === 0
      ? null
      : planetChanged / planetPixels,
    backgroundChangedPixelRatio: backgroundPixels === 0
      ? null
      : backgroundChanged / backgroundPixels,
  });
}

function detectPlanet(png, silhouette) {
  const { x: centerX, y: centerY } = ORACLE_SCENE_CENTER;
  const candidates = new Uint8Array(png.width * png.height);
  const visited = new Uint8Array(candidates.length);
  const queue = new Int32Array(candidates.length);
  const searchRadius = Math.min(silhouette.radiusX, silhouette.radiusY) * 0.98;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (Math.hypot(x - centerX, y - centerY) > searchRadius) continue;
      const index = (y * png.width + x) * 4;
      const red = png.data[index];
      const green = png.data[index + 1];
      const blue = png.data[index + 2];
      // Keep the classifier chromatic rather than bright. A zoomed, back-lit
      // Venus can be almost entirely below the previous daytime luminance
      // floor even though its warm disc remains geometrically distinct from
      // the neutral starfield.
      if (red < 8 || green < 6 || red < blue * 1.08 || green < blue * 0.92) {
        continue;
      }
      candidates[y * png.width + x] = 1;
    }
  }
  let largest = null;
  for (let start = 0; start < candidates.length; start += 1) {
    if (!candidates[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let count = 0;
    let minimumX = png.width;
    let minimumY = png.height;
    let maximumX = -1;
    let maximumY = -1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % png.width;
      const y = Math.floor(current / png.width);
      count += 1;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
      for (const neighbor of [
        current - 1,
        current + 1,
        current - png.width,
        current + png.width,
      ]) {
        if (neighbor < 0 || neighbor >= candidates.length ||
            visited[neighbor] || !candidates[neighbor]) continue;
        const neighborX = neighbor % png.width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (!largest || count > largest.count) {
      largest = { count, minimumX, minimumY, maximumX, maximumY };
    }
  }
  const litBounds = largest && largest.count >= 25
    ? Object.freeze({
      minimumX: largest.minimumX,
      minimumY: largest.minimumY,
      maximumX: largest.maximumX,
      maximumY: largest.maximumY,
    })
    : null;
  return Object.freeze({
    center: Object.freeze({ x: centerX, y: centerY }),
    radius: (silhouette.radiusX + silhouette.radiusY) / 2,
    qualifyingPixels: largest?.count ?? 0,
    litBounds,
  });
}

function detectSilhouette(png) {
  const { x: centerX, y: centerY } = ORACLE_SCENE_CENTER;
  const minimumRadius = 80;
  const maximumRadius = Math.min(240, png.height / 2 - 8);
  const comparisonOffset = 4;
  const samplesPerRing = 720;
  const rings = [];
  for (let radius = minimumRadius - comparisonOffset;
    radius <= maximumRadius + comparisonOffset;
    radius += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let sample = 0; sample < samplesPerRing; sample += 1) {
      const radians = sample * Math.PI * 2 / samplesPerRing;
      const x = Math.round(centerX + Math.cos(radians) * radius);
      const y = Math.round(centerY + Math.sin(radians) * radius);
      const index = (y * png.width + x) * 4;
      red += png.data[index];
      green += png.data[index + 1];
      blue += png.data[index + 2];
    }
    rings.push(Object.freeze({
      radius,
      red: red / samplesPerRing,
      green: green / samplesPerRing,
      blue: blue / samplesPerRing,
    }));
  }
  const edges = [];
  for (let radius = minimumRadius; radius <= maximumRadius; radius += 1) {
    const before = rings[radius - comparisonOffset -
      (minimumRadius - comparisonOffset)];
    const after = rings[radius + comparisonOffset -
      (minimumRadius - comparisonOffset)];
    edges.push(Object.freeze({
      radius,
      strength: Math.hypot(
        after.red - before.red,
        after.green - before.green,
        after.blue - before.blue,
      ),
    }));
  }
  const maximumStrength = Math.max(...edges.map(({ strength }) => strength));
  if (!Number.isFinite(maximumStrength) || maximumStrength < 8) {
    throw new Error("The scene-only capture does not contain a stable Venus silhouette.");
  }
  const candidateThreshold = maximumStrength * 0.72;
  const radius = Math.max(...edges
    .filter(({ strength }) => strength >= candidateThreshold)
    .map((edge) => edge.radius));
  return Object.freeze({
    model: "centered-radial-ring-color-edge-circle",
    center: ORACLE_SCENE_CENTER,
    radiusX: radius,
    radiusY: radius,
    qualifyingPixels: Math.round(Math.PI * radius * radius),
    edgeStrength: maximumStrength,
    edgeWindowPixels: comparisonOffset * 2,
  });
}

function detectSun(png, planet, silhouette) {
  const luminanceThreshold = 90;
  const clippedRayLuminanceThreshold = 25;
  const minimumComponentPixels = 200;
  const minimumLimbComponentPixels = 50;
  const minimumClippedRayPixels = 80;
  const maximumComponentDiameter = 160;
  const maximumComponentAspectRatio = 4;
  const minimumCorePixels = 12;
  const minimumClippedCorePixels = 2;
  const exclusionRadiusX = silhouette.radiusX * 1.08;
  const exclusionRadiusY = silhouette.radiusY * 1.08;
  const detector = Object.freeze({
    planet,
    exclusionRadiusX,
    exclusionRadiusY,
    maximumComponentDiameter,
    maximumComponentAspectRatio,
    minimumCorePixels,
    minimumClippedCorePixels,
  });
  let brightest = brightestSunComponent(png, detector, {
    luminanceThreshold,
    minimumComponentPixels,
    minimumLimbComponentPixels,
    edgeOnly: false,
  });
  if (!brightest) {
    brightest = brightestSunComponent(png, detector, {
      luminanceThreshold: clippedRayLuminanceThreshold,
      minimumComponentPixels: minimumClippedRayPixels,
      minimumLimbComponentPixels: minimumClippedRayPixels,
      edgeOnly: true,
    });
  }

  if (!brightest) {
    return Object.freeze({
      state: "absent",
      visible: false,
      luminanceThreshold,
      clippedRayLuminanceThreshold,
      minimumComponentPixels,
      minimumLimbComponentPixels,
      minimumClippedRayPixels,
      maximumComponentDiameter,
      maximumComponentAspectRatio,
      minimumCorePixels,
      minimumClippedCorePixels,
    });
  }
  const bounds = Object.freeze(brightest.bounds);
  const centroid = Object.freeze(brightest.centroid);
  const touchesSceneEdge = bounds.minimumX === 0 || bounds.minimumY === 0 ||
    bounds.maximumX === png.width - 1 || bounds.maximumY === png.height - 1;
  const overlapsPlanetLimb = brightest.overlapsPlanetLimb;
  return Object.freeze({
    state: overlapsPlanetLimb ? "limb" : touchesSceneEdge ? "clipped" : "visible",
    visible: true,
    luminanceThreshold,
    clippedRayLuminanceThreshold,
    minimumComponentPixels,
    minimumLimbComponentPixels,
    minimumClippedRayPixels,
    maximumComponentDiameter,
    maximumComponentAspectRatio,
    minimumCorePixels,
    minimumClippedCorePixels,
    pixelCount: brightest.pixelCount,
    corePixelCount: brightest.corePixelCount,
    maximumLuminance: brightest.maximumLuminance,
    luminanceSum: brightest.luminanceSum,
    centroid,
    bounds,
    touchesSceneEdge,
    overlapsPlanetLimb,
  });
}

function brightestSunComponent(png, detector, {
  luminanceThreshold,
  minimumComponentPixels,
  minimumLimbComponentPixels,
  edgeOnly,
}) {
  const candidates = new Uint8Array(png.width * png.height);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const normalizedX = (x - detector.planet.center.x) /
        detector.exclusionRadiusX;
      const normalizedY = (y - detector.planet.center.y) /
        detector.exclusionRadiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        continue;
      }
      const index = (y * png.width + x) * 4;
      if (relativeLuminance(png.data, index) >= luminanceThreshold) {
        candidates[y * png.width + x] = 1;
      }
    }
  }
  const visited = new Uint8Array(candidates.length);
  const queue = new Int32Array(candidates.length);
  let brightest = null;
  for (let start = 0; start < candidates.length; start += 1) {
    if (!candidates[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let pixelCount = 0;
    let luminanceSum = 0;
    let corePixelCount = 0;
    let maximumLuminance = 0;
    let weightedX = 0;
    let weightedY = 0;
    let minimumX = png.width;
    let minimumY = png.height;
    let maximumX = -1;
    let maximumY = -1;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % png.width;
      const y = Math.floor(current / png.width);
      const luminance = relativeLuminance(png.data, current * 4);
      const red = png.data[current * 4];
      const green = png.data[current * 4 + 1];
      const blue = png.data[current * 4 + 2];
      pixelCount += 1;
      luminanceSum += luminance;
      maximumLuminance = Math.max(maximumLuminance, luminance);
      if (luminance >= 220 && red >= 220 && green >= 200 && blue >= 150) {
        corePixelCount += 1;
      }
      weightedX += x * luminance;
      weightedY += y * luminance;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          if (neighborX < 0 || neighborX >= png.width ||
              neighborY < 0 || neighborY >= png.height) continue;
          const neighbor = neighborY * png.width + neighborX;
          if (!candidates[neighbor] || visited[neighbor]) continue;
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    const bounds = { minimumX, minimumY, maximumX, maximumY };
    const touchesSceneEdge = minimumX === 0 || minimumY === 0 ||
      maximumX === png.width - 1 || maximumY === png.height - 1;
    if (edgeOnly && !touchesSceneEdge) continue;
    if (corePixelCount < (edgeOnly
      ? detector.minimumClippedCorePixels
      : detector.minimumCorePixels)) continue;
    const componentWidth = maximumX - minimumX + 1;
    const componentHeight = maximumY - minimumY + 1;
    if (componentWidth > detector.maximumComponentDiameter ||
        componentHeight > detector.maximumComponentDiameter ||
        Math.max(componentWidth, componentHeight) /
          Math.max(1, Math.min(componentWidth, componentHeight)) >
            detector.maximumComponentAspectRatio) {
      continue;
    }
    const centroid = {
      x: weightedX / luminanceSum,
      y: weightedY / luminanceSum,
    };
    const componentRadius = Math.max(componentWidth, componentHeight) / 2;
    const centerDistance = Math.hypot(
      centroid.x - detector.planet.center.x,
      centroid.y - detector.planet.center.y,
    );
    const overlapsPlanetLimb = centerDistance <= Math.max(
      detector.exclusionRadiusX,
      detector.exclusionRadiusY,
    ) + componentRadius;
    if (pixelCount < minimumComponentPixels &&
        !(overlapsPlanetLimb && pixelCount >= minimumLimbComponentPixels)) {
      continue;
    }
    const component = {
      pixelCount,
      corePixelCount,
      maximumLuminance,
      luminanceSum,
      centroid,
      bounds,
      touchesSceneEdge,
      overlapsPlanetLimb,
    };
    if (!brightest || component.luminanceSum > brightest.luminanceSum) {
      brightest = component;
    }
  }
  return brightest;
}

function renderSilhouette({ width, height }, silhouette) {
  const output = opaqueBlackPng(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (x - silhouette.center.x) / silhouette.radiusX;
      const normalizedY = (y - silhouette.center.y) / silhouette.radiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        setRgb(output, x, y, 255, 255, 255);
      }
    }
  }
  return output;
}

function renderStarfield(source, silhouettes, suns) {
  const output = PNG.sync.read(PNG.sync.write(source));
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      if (silhouettes.some((silhouette) => {
        const normalizedX = (x - silhouette.center.x) /
          (silhouette.radiusX * 1.12);
        const normalizedY = (y - silhouette.center.y) /
          (silhouette.radiusY * 1.12);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      }) || suns.some((sun) => insideSunNeighborhood(x, y, sun))) {
        setRgb(output, x, y, 0, 0, 0);
      }
    }
  }
  return output;
}

function renderSun(source, sun, silhouettes) {
  const output = opaqueBlackPng(source.width, source.height);
  if (!sun.visible) return output;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (!insideSunNeighborhood(x, y, sun) || silhouettes.some((silhouette) => {
        const normalizedX = (x - silhouette.center.x) /
          (silhouette.radiusX * 1.01);
        const normalizedY = (y - silhouette.center.y) /
          (silhouette.radiusY * 1.01);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      })) {
        continue;
      }
      const index = (y * source.width + x) * 4;
      setRgb(output, x, y, source.data[index], source.data[index + 1],
        source.data[index + 2]);
    }
  }
  return output;
}

function insideSunNeighborhood(x, y, sun) {
  const padding = 64;
  return x >= sun.bounds.minimumX - padding &&
    x <= sun.bounds.maximumX + padding &&
    y >= sun.bounds.minimumY - padding &&
    y <= sun.bounds.maximumY + padding;
}

function renderShadowShape(source, analysis) {
  const shape = shadowShapeMask(source, analysis);
  const output = opaqueBlackPng(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (shape.mask[y * source.width + x]) {
        setRgb(output, x, y, 255, 255, 255);
      }
    }
  }
  return output;
}

function renderIlluminationProfile({ width, height }, analysis) {
  const output = opaqueBlackPng(width, height);
  const { center, radiusX, radiusY } = analysis.silhouette;
  const direction = analysis.terminator.lightDirection;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (x - center.x) / radiusX;
      const normalizedY = (y - center.y) / radiusY;
      if (Math.hypot(normalizedX, normalizedY) > 0.94) continue;
      const along = normalizedX * direction.x + normalizedY * direction.y;
      const bin = Math.max(0, Math.min(
        analysis.illumination.meanLuminance.length - 1,
        Math.floor((along + 0.94) / 1.88 *
          analysis.illumination.meanLuminance.length),
      ));
      const level = Math.round(analysis.illumination.meanLuminance[bin]);
      setRgb(output, x, y, level, level, level);
    }
  }
  return output;
}

function analyzeIlluminationProfile(png, silhouette, terminator) {
  const binCount = 10;
  const sums = new Array(binCount).fill(0);
  const sampleCounts = new Array(binCount).fill(0);
  const { center, radiusX, radiusY } = silhouette;
  const direction = terminator.lightDirection;
  for (let y = Math.floor(center.y - radiusY); y <= center.y + radiusY; y += 1) {
    for (let x = Math.floor(center.x - radiusX); x <= center.x + radiusX; x += 1) {
      const normalizedX = (x - center.x) / radiusX;
      const normalizedY = (y - center.y) / radiusY;
      if (Math.hypot(normalizedX, normalizedY) > 0.94) continue;
      const along = normalizedX * direction.x + normalizedY * direction.y;
      const bin = Math.max(0, Math.min(
        binCount - 1,
        Math.floor((along + 0.94) / 1.88 * binCount),
      ));
      sums[bin] += relativeLuminance(
        png.data,
        (y * png.width + x) * 4,
      );
      sampleCounts[bin] += 1;
    }
  }
  const meanLuminance = sums.map((sum, index) =>
    sampleCounts[index] === 0 ? 0 : sum / sampleCounts[index]);
  return Object.freeze({
    basis: "absolute-light-axis-luminance-profile-inside-94-percent-disc",
    binCount,
    meanLuminance: Object.freeze(meanLuminance),
    sampleCounts: Object.freeze(sampleCounts),
    nightSideMean: meanLuminance.slice(0, 8)
      .reduce((sum, value) => sum + value, 0) / 8,
    shoulderMean: meanLuminance[8],
    sunwardPeakMean: meanLuminance[9],
  });
}

function analyzeDiscPhase(png, silhouette) {
  const values = [];
  const radiusX = silhouette.radiusX * 0.9;
  const radiusY = silhouette.radiusY * 0.9;
  for (let y = Math.floor(silhouette.center.y - radiusY);
    y <= silhouette.center.y + radiusY; y += 1) {
    for (let x = Math.floor(silhouette.center.x - radiusX);
      x <= silhouette.center.x + radiusX; x += 1) {
      const normalizedX = (x - silhouette.center.x) / radiusX;
      const normalizedY = (y - silhouette.center.y) / radiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY > 1) continue;
      values.push(relativeLuminance(png.data, (y * png.width + x) * 4));
    }
  }
  values.sort((left, right) => left - right);
  const meanLuminance = values.reduce((sum, value) => sum + value, 0) /
    values.length;
  const percentile = (fraction) => values[Math.floor(
    (values.length - 1) * fraction,
  )];
  const p10 = percentile(0.1);
  const p50 = percentile(0.5);
  const p90 = percentile(0.9);
  const lowHighRatio = p90 === 0 ? 1 : p10 / p90;
  const state = meanLuminance >= 80 && lowHighRatio >= 0.55
    ? "fully-lit"
    : meanLuminance <= 45 && lowHighRatio >= 0.25
      ? "fully-shadowed"
      : "partial";
  return Object.freeze({
    basis: "inner-disc-luminance-percentiles",
    state,
    sampleCount: values.length,
    meanLuminance,
    p10,
    p50,
    p90,
    lowHighRatio,
  });
}

function shadowShapeMask(png, analysis) {
  const { silhouette, discPhase, terminator } = analysis;
  const analysisRadiusX = silhouette.radiusX * 0.9;
  const analysisRadiusY = silhouette.radiusY * 0.9;
  const lightDirection = terminator.lightDirection;
  const acrossDirection = Object.freeze({
    x: -lightDirection.y,
    y: lightDirection.x,
  });
  const fullyLit = discPhase.state === "fully-lit";
  const fullyShadowed = discPhase.state === "fully-shadowed";
  const mask = new Uint8Array(png.width * png.height);
  let analyzedPixels = 0;
  let litPixels = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const normalizedX = (x - silhouette.center.x) / analysisRadiusX;
      const normalizedY = (y - silhouette.center.y) / analysisRadiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
        continue;
      }
      analyzedPixels += 1;
      if (fullyLit) {
        mask[y * png.width + x] = 1;
        litPixels += 1;
        continue;
      }
      if (fullyShadowed || !terminator.trace.coherent) continue;
      const along = normalizedX * lightDirection.x +
        normalizedY * lightDirection.y;
      const across = normalizedX * acrossDirection.x +
        normalizedY * acrossDirection.y;
      const boundary = terminator.fit.offsetRadii +
        terminator.fit.tilt * across + terminator.fit.curvature * across ** 2;
      if (along >= boundary) {
        mask[y * png.width + x] = 1;
        litPixels += 1;
      }
    }
  }
  const litFraction = analyzedPixels === 0 ? 0 : litPixels / analyzedPixels;
  return Object.freeze({
    mask,
    model: fullyLit
      ? "fully-lit-disc"
      : fullyShadowed
        ? "fully-shadowed-disc"
        : terminator.trace.coherent
          ? "quadratic-terminator-lit-side"
          : "unresolved-incoherent-terminator",
    analyzedPixels,
    litPixels,
    litFraction,
    lightDirection,
    trace: terminator.trace,
    fit: terminator.fit,
    qualified: analyzedPixels > 10_000 &&
      (terminator.trace.coherent || fullyLit || fullyShadowed),
  });
}

function detectAnnulusLightDirection(
  luminance,
  width,
  height,
  silhouette,
) {
  let best = null;
  for (let degrees = 0; degrees < 360; degrees += 2) {
    const radians = degrees * Math.PI / 180;
    const direction = { x: Math.cos(radians), y: Math.sin(radians) };
    let sum = 0;
    let count = 0;
    for (let radius = 0.72; radius <= 0.9; radius += 0.03) {
      for (let offsetDegrees = -12; offsetDegrees <= 12; offsetDegrees += 4) {
        const offset = offsetDegrees * Math.PI / 180;
        const x = Math.round(silhouette.center.x + silhouette.radiusX * radius *
          Math.cos(radians + offset));
        const y = Math.round(silhouette.center.y + silhouette.radiusY * radius *
          Math.sin(radians + offset));
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        sum += luminance[y * width + x];
        count += 1;
      }
    }
    const mean = count === 0 ? 0 : sum / count;
    if (!best || mean > best.mean) best = { ...direction, mean };
  }
  return Object.freeze({ x: best.x, y: best.y });
}

function normalizeDirection(x, y) {
  const length = Math.hypot(x, y);
  if (length < 1e-9) return Object.freeze({ x: 1, y: 0 });
  return Object.freeze({ x: x / length, y: y / length });
}

function shadowShapeSummary(shape) {
  return Object.freeze({
    model: shape.model,
    analyzedPixels: shape.analyzedPixels,
    litPixels: shape.litPixels,
    litFraction: shape.litFraction,
    lightDirection: shape.lightDirection,
    trace: shape.trace,
    fit: shape.fit,
    qualified: shape.qualified,
  });
}

function starfieldFeatureMask(
  png,
  referenceAnalysis,
  browserAnalysis,
  threshold,
) {
  const mask = new Uint8Array(png.width * png.height);
  const silhouettes = [
    referenceAnalysis.silhouette,
    browserAnalysis.silhouette,
  ];
  const suns = [referenceAnalysis.sun, browserAnalysis.sun]
    .filter(({ visible }) => visible);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (silhouettes.some((silhouette) => {
        const normalizedX = (x - silhouette.center.x) /
          (silhouette.radiusX * 1.12);
        const normalizedY = (y - silhouette.center.y) /
          (silhouette.radiusY * 1.12);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      }) || suns.some((sun) => insideSunNeighborhood(x, y, sun))) {
        continue;
      }
      const index = (y * png.width + x) * 4;
      if (relativeLuminance(png.data, index) >= threshold) {
        mask[y * png.width + x] = 1;
      }
    }
  }
  return mask;
}

function hasNeighbor(mask, width, height, x, y) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const candidateX = x + offsetX;
      const candidateY = y + offsetY;
      if (candidateX < 0 || candidateX >= width ||
          candidateY < 0 || candidateY >= height) continue;
      if (mask[candidateY * width + candidateX]) return true;
    }
  }
  return false;
}

function opaqueBlackPng(width, height) {
  const output = new PNG({ width, height });
  for (let index = 3; index < output.data.length; index += 4) {
    output.data[index] = 255;
  }
  return output;
}

function setRgb(png, x, y, red, green, blue) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const index = (y * png.width + x) * 4;
  png.data[index] = red;
  png.data[index + 1] = green;
  png.data[index + 2] = blue;
  png.data[index + 3] = 255;
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function analyzeTerminatorShape(png, planet, silhouette, sun) {
  const radius = (silhouette.radiusX + silhouette.radiusY) / 2;
  // A broad, scale-relative blur removes radar/cloud texture before tracing.
  // The resulting ridge follows the illumination boundary, not local albedo.
  const luminance = blurredLuminance(png, Math.max(7, Math.round(radius * 0.08)));
  const lightAxis = sun.visible
    ? normalizeDirection(
      sun.centroid.x - silhouette.center.x,
      sun.centroid.y - silhouette.center.y,
    )
    : detectAnnulusLightDirection(
      luminance,
      png.width,
      png.height,
      silhouette,
    );
  const acrossAxis = Object.freeze({ x: -lightAxis.y, y: lightAxis.x });
  const boundary = [];
  for (let normalizedAcross = -0.8;
    normalizedAcross <= 0.8001;
    normalizedAcross += 0.05) {
    const across = normalizedAcross * radius;
    const chord = Math.sqrt(Math.max(0, radius * radius - across * across));
    const minimumAlong = -chord * 0.9;
    const maximumAlong = chord * 0.9;
    const halfWindow = Math.max(3, Math.round(radius * 0.035));
    let strongest = null;
    for (let along = minimumAlong + halfWindow;
      along <= maximumAlong - halfWindow;
      along += 1) {
      const before = directionalWindowMean(
        luminance,
        png.width,
        png.height,
        planet.center,
        lightAxis,
        acrossAxis,
        across,
        along - halfWindow,
        halfWindow,
      );
      const after = directionalWindowMean(
        luminance,
        png.width,
        png.height,
        planet.center,
        lightAxis,
        acrossAxis,
        across,
        along + 1,
        halfWindow,
      );
      const edgeStrength = after - before;
      if (!strongest || edgeStrength > strongest.edgeStrength) {
        strongest = { along, edgeStrength };
      }
    }
    if (!strongest || strongest.edgeStrength <= 0) continue;
    const normalizedAlong = strongest.along / radius;
    boundary.push(Object.freeze({
      x: lightAxis.x * normalizedAlong + acrossAxis.x * normalizedAcross,
      y: lightAxis.y * normalizedAlong + acrossAxis.y * normalizedAcross,
      alongRadii: normalizedAlong,
      acrossRadii: normalizedAcross,
      edgeStrength: strongest.edgeStrength,
    }));
  }
  if (boundary.length < 9) {
    throw new Error("The Venus terminator does not yield a stable geometric trace.");
  }
  const firstFit = quadraticFit(boundary.map((point) => Object.freeze({
    x: point.acrossRadii,
    y: point.alongRadii,
  })));
  const inliers = boundary.filter((point) => Math.abs(
    point.alongRadii - (firstFit.intercept + firstFit.linear *
      point.acrossRadii + firstFit.quadratic * point.acrossRadii ** 2),
  ) <= 0.14);
  const fit = quadraticFit((inliers.length >= 9 ? inliers : boundary)
    .map((point) => Object.freeze({
      x: point.acrossRadii,
      y: point.alongRadii,
    })));
  const maximumCoherentRmsErrorRadii = 0.12;
  return Object.freeze({
    comparisonBasis: "terminator-geometry-only",
    opacityMeasured: false,
    lightDirection: lightAxis,
    lightDirectionDegrees: normalizedDegrees(
      Math.atan2(lightAxis.y, lightAxis.x) * 180 / Math.PI,
    ),
    boundary: Object.freeze(boundary),
    trace: Object.freeze({
      coherent: fit.rmsError <= maximumCoherentRmsErrorRadii,
      maximumRmsErrorRadii: maximumCoherentRmsErrorRadii,
      rmsErrorRadii: fit.rmsError,
    }),
    fit: Object.freeze({
      offsetRadii: fit.intercept,
      tilt: fit.linear,
      curvature: fit.quadratic,
      rmsErrorRadii: fit.rmsError,
    }),
  });
}

function blurredLuminance(png, blurRadius) {
  const stride = png.width + 1;
  const integral = new Float64Array((png.width + 1) * (png.height + 1));
  for (let y = 0; y < png.height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < png.width; x += 1) {
      rowSum += relativeLuminance(png.data, (y * png.width + x) * 4);
      integral[(y + 1) * stride + x + 1] =
        integral[y * stride + x + 1] + rowSum;
    }
  }
  const output = new Float32Array(png.width * png.height);
  for (let y = 0; y < png.height; y += 1) {
    const minimumY = Math.max(0, y - blurRadius);
    const maximumY = Math.min(png.height - 1, y + blurRadius);
    for (let x = 0; x < png.width; x += 1) {
      const minimumX = Math.max(0, x - blurRadius);
      const maximumX = Math.min(png.width - 1, x + blurRadius);
      const sum = integral[(maximumY + 1) * stride + maximumX + 1] -
        integral[minimumY * stride + maximumX + 1] -
        integral[(maximumY + 1) * stride + minimumX] +
        integral[minimumY * stride + minimumX];
      output[y * png.width + x] = sum /
        ((maximumX - minimumX + 1) * (maximumY - minimumY + 1));
    }
  }
  return output;
}

function directionalWindowMean(
  luminance,
  width,
  height,
  center,
  alongAxis,
  acrossAxis,
  across,
  alongStart,
  length,
) {
  let sum = 0;
  let count = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const along = alongStart + offset;
    const x = Math.round(
      center.x + alongAxis.x * along + acrossAxis.x * across,
    );
    const y = Math.round(
      center.y + alongAxis.y * along + acrossAxis.y * across,
    );
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    sum += luminance[y * width + x];
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

function quadraticFit(points) {
  let x1 = 0;
  let x2 = 0;
  let x3 = 0;
  let x4 = 0;
  let y = 0;
  let xy = 0;
  let x2y = 0;
  for (const point of points) {
    const squared = point.x * point.x;
    x1 += point.x;
    x2 += squared;
    x3 += squared * point.x;
    x4 += squared * squared;
    y += point.y;
    xy += point.x * point.y;
    x2y += squared * point.y;
  }
  const [intercept, linear, quadratic] = solveThreeByThree([
    [points.length, x1, x2, y],
    [x1, x2, x3, xy],
    [x2, x3, x4, x2y],
  ]);
  const squareError = points.reduce((sum, point) => {
    const predicted = intercept + linear * point.x + quadratic * point.x * point.x;
    return sum + (point.y - predicted) ** 2;
  }, 0);
  return Object.freeze({
    intercept,
    linear,
    quadratic,
    rmsError: Math.sqrt(squareError / points.length),
  });
}

function solveThreeByThree(rows) {
  const matrix = rows.map((row) => [...row]);
  for (let pivot = 0; pivot < 3; pivot += 1) {
    let strongest = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[strongest][pivot])) {
        strongest = row;
      }
    }
    [matrix[pivot], matrix[strongest]] = [matrix[strongest], matrix[pivot]];
    const divisor = matrix[pivot][pivot];
    if (Math.abs(divisor) < 1e-12) {
      throw new Error("Terminator geometry is degenerate.");
    }
    for (let column = pivot; column < 4; column += 1) {
      matrix[pivot][column] /= divisor;
    }
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      for (let column = pivot; column < 4; column += 1) {
        matrix[row][column] -= factor * matrix[pivot][column];
      }
    }
  }
  return matrix.map((row) => row[3]);
}

function symmetricShapeDistance(left, right) {
  const nearestMean = (source, target) => source.reduce((sum, point) => {
    const nearest = target.reduce((minimum, candidate) => Math.min(
      minimum,
      Math.hypot(point.x - candidate.x, point.y - candidate.y),
    ), Number.POSITIVE_INFINITY);
    return sum + nearest;
  }, 0) / source.length;
  return (nearestMean(left, right) + nearestMean(right, left)) / 2;
}

function normalizedDegrees(degrees) {
  return (degrees % 360 + 360) % 360;
}

function circularAngleDifference(left, right) {
  const raw = Math.abs(normalizedDegrees(left) - normalizedDegrees(right));
  return Math.min(raw, 360 - raw);
}

function analyzeBackground(png, silhouette) {
  let samples = 0;
  let luminanceSum = 0;
  let brightPixels = 0;
  let veryBrightPixels = 0;
  const exclusionRadius = Math.max(
    silhouette.radiusX,
    silhouette.radiusY,
  ) * 1.12;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (Math.hypot(
        x - silhouette.center.x,
        y - silhouette.center.y,
      ) <= exclusionRadius) continue;
      const index = (y * png.width + x) * 4;
      const luminance = relativeLuminance(png.data, index);
      samples += 1;
      luminanceSum += luminance;
      if (luminance > 32) brightPixels += 1;
      if (luminance > 96) veryBrightPixels += 1;
    }
  }
  return Object.freeze({
    sampleCount: samples,
    meanLuminance: luminanceSum / samples,
    brightPixelRatio: brightPixels / samples,
    veryBrightPixelRatio: veryBrightPixels / samples,
  });
}

function maximumChannelDelta(left, right, index) {
  return Math.max(
    Math.abs(left[index] - right[index]),
    Math.abs(left[index + 1] - right[index + 1]),
    Math.abs(left[index + 2] - right[index + 2]),
  );
}

function relativeLuminance(data, index) {
  return data[index] * 0.2126 +
    data[index + 1] * 0.7152 +
    data[index + 2] * 0.0722;
}
