import { PNG } from "pngjs";
import { ORACLE_SCENE_CENTER } from "./profile.mts";
import { sha256 } from '@cssearth/core/node';
import { clampUnit, maximumChannelDelta, relativeLuminance, hasNeighbor, insideSunNeighborhood } from "./image-pixels.mts";
import { detectPlanet, detectSilhouette, detectSun, analyzeBackground } from "./scene-detection.mts";
import { analyzeIlluminationProfile, analyzeDiscPhase, shadowShapeMask, shadowShapeSummary, analyzeTerminatorShape, symmetricShapeDistance, circularAngleDifference } from "./scene-illumination.mts";
import type { Analysis, Silhouette, Sun, Illumination, Terminator } from "./analysis-types.mts";
export { sha256 };
export { comparePngBuffers, writeAbsoluteDiff, writeTriptych } from "./image-pixels.mts";
export { classifySceneLod } from "./scene-detection.mts";
export { writeIndependentCaptures } from "./isolated-captures.mts";

export function analyzeScenePng(bytes: Buffer) {
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

export function compareSilhouetteShapes(reference: Silhouette, browser: Silhouette, { maximumRadiusDeltaRatio }: { maximumRadiusDeltaRatio?: number } = {}) {
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
  const withinTolerance = typeof maximumRadiusDeltaRatio === "number" && Number.isFinite(maximumRadiusDeltaRatio) &&
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

export function compareSunPresentations(reference: Sun, browser: Sun, { maximumCentroidDeltaPixels = null }: { maximumCentroidDeltaPixels?: number | null } = {}) {
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
  const positionScale = typeof maximumCentroidDeltaPixels === "number" && Number.isFinite(maximumCentroidDeltaPixels)
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
    typeof maximumCentroidDeltaPixels === "number" && Number.isFinite(maximumCentroidDeltaPixels) &&
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

export function compareStarfieldFeatures(referenceBytes: Buffer, browserBytes: Buffer, referenceAnalysis: Analysis, browserAnalysis: Analysis) {
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

export function compareShadowShapes(referenceBytes: Buffer, browserBytes: Buffer, referenceAnalysis: Analysis, browserAnalysis: Analysis) {
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

export function compareIlluminationTransfers(reference: Illumination, browser: Illumination) {
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

export function compareTerminatorShapes(reference: Terminator, browser: Terminator) {
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

export function interactionDelta(defaultBytes: Buffer, endpointBytes: Buffer) {
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

export function starfieldFeatureMask(png: PNG, referenceAnalysis: Analysis, browserAnalysis: Analysis, threshold: number) {
  const mask = new Uint8Array(png.width * png.height);
  const silhouettes = [
    referenceAnalysis.silhouette,
    browserAnalysis.silhouette,
  ];
  const suns = [referenceAnalysis.sun, browserAnalysis.sun]
    .filter((sun) => sun.visible);
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
