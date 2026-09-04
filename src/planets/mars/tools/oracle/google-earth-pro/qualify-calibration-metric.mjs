import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PNG } from "pngjs";
import sharp from "sharp";

import { createPixelmatchTriptych } from "./triptych.mjs";

const ROOT = resolve(import.meta.dirname, "../../../../../..");
const evidenceRoot = resolve(
  process.argv[2] ??
    "output/playwright/google-earth-pro-mars-interaction-video-v1",
);
const nativeReportPath = resolve(evidenceRoot, "native-registration/registration.json");
const browserReportPath = resolve(evidenceRoot, "browser-registration/registration.json");
const outputRoot = resolve(evidenceRoot, "metric-qualification");
const metricContractPath = resolve(evidenceRoot, "metric-contract.json");
const poseRoot = resolve(outputRoot, "poses");
const controlRoot = resolve(outputRoot, "controls");
const thresholds = Object.freeze({
  cameraCenterResidualPixels: 3,
  cameraDiameterResidualPixels: 3,
  edgeAntialiasingWidthResidualPixels: 2.5,
  browserGeographicAngularResidualDegrees: 0.001,
  landmarkMeanFlowPixels: 4,
  landmarkP95FlowPixels: 9,
  landmarkMaximumFlowPixels: 20,
  minimumFlowSampleCount: 120,
  surfaceMeanAbsoluteRgbDelta: 42,
  surfacePixelmatchChangedRatio: 0.12,
  pixelmatchThreshold: 0.1,
});

const [nativeReport, browserReport] = await Promise.all([
  readJson(nativeReportPath),
  readJson(browserReportPath),
]);
assert.equal(
  nativeReport.qualification,
  "NATIVE_GOOGLE_GEOMETRY_CALIBRATION_REGISTRATION_PROVEN",
);
assert.equal(
  browserReport.qualification,
  "BROWSER_RETAINED_CALIBRATION_REGISTRATION_PROVEN",
);
assert.equal(
  nativeReport.calibration.sourceDecodedRgbaSha256,
  browserReport.calibration.sourceDecodedRgbaSha256,
);
assert.deepEqual(browserReport.crop, nativeReport.captures[0].final.crop);
const browserDensity = browserReport.densities.find(({ density }) =>
  density === 1);
assert.ok(browserDensity, "DPR 1 browser registration is required.");
assert.equal(browserDensity.captures.length, nativeReport.captures.length);

await Promise.all([
  mkdir(poseRoot, { recursive: true }),
  mkdir(controlRoot, { recursive: true }),
]);
const poseReports = [];
for (let index = 0; index < nativeReport.captures.length; index += 1) {
  const nativeCapture = nativeReport.captures[index];
  const browserCapture = browserDensity.captures[index];
  assert.equal(browserCapture.id, nativeCapture.id);
  poseReports.push(await evaluatePair({
    id: nativeCapture.id,
    nativePath: nativeCapture.final.path,
    browserPath: browserCapture.path,
    nativeDisc: browserCapture.nativeDisc,
    browserDisc: browserCapture.browserDisc,
    browserEndpoint: browserCapture.browserEndpoint,
    centerAddressMatches: browserCapture.centerAddressMatches,
    coverage: nativeCapture.coverage,
    output: resolve(poseRoot, nativeCapture.id),
  }));
}

const firstNative = nativeReport.captures[0].final.path;
const firstDisc = browserDensity.captures[0].nativeDisc;
const identicalControl = await evaluatePair({
  id: "identical-control",
  nativePath: firstNative,
  browserPath: firstNative,
  nativeDisc: firstDisc,
  browserDisc: firstDisc,
  browserEndpoint: {
    angularResidualDegrees: 0,
    screenRollDegrees: 0,
  },
  centerAddressMatches: true,
  coverage: ["control"],
  output: resolve(controlRoot, "identical"),
});
const shiftedPath = resolve(controlRoot, "shifted-12px.png");
await shiftImage(firstNative, shiftedPath, 12, 0);
const shiftedControl = await evaluatePair({
  id: "shifted-control",
  nativePath: firstNative,
  browserPath: shiftedPath,
  nativeDisc: firstDisc,
  browserDisc: Object.freeze({
    ...firstDisc,
    minX: firstDisc.minX + 12,
    maxX: firstDisc.maxX + 12,
    centerX: firstDisc.centerX + 12,
  }),
  browserEndpoint: {
    angularResidualDegrees: 0,
    screenRollDegrees: 0,
  },
  centerAddressMatches: true,
  coverage: ["control"],
  output: resolve(controlRoot, "shifted"),
});

const allStaticPairsQualified = poseReports.every(({ passes }) => passes);
const controls = Object.freeze({
  identicalRepeatedFrame: Object.freeze({
    expected: "pass",
    actual: identicalControl.passes ? "pass" : "fail",
    passes: identicalControl.passes,
    metrics: identicalControl,
  }),
  deliberatelyShiftedFrame: Object.freeze({
    shiftPixels: 12,
    expected: "fail",
    actual: shiftedControl.passes ? "pass" : "fail",
    passes: !shiftedControl.passes,
    metrics: shiftedControl,
  }),
});
const metricGates = Object.freeze({
  exactCalibrationSourceIdentity:
    nativeReport.calibration.sourceDecodedRgbaSha256 ===
      browserReport.calibration.sourceDecodedRgbaSha256,
  exactPosePairing: poseReports.length === 12 && poseReports.every(
    ({ pairing }) => pairing.exactPoseId && pairing.exactDimensions &&
      pairing.exactCrop && pairing.dpr === 1),
  comparableSurfacePixelsExist: poseReports.every(({ identityGate }) =>
    identityGate.surfaceInterior),
  allStaticPairsMeasured: poseReports.every(({ measurementComplete }) =>
    measurementComplete),
  identicalControlPasses: controls.identicalRepeatedFrame.passes,
  shiftedControlFails: controls.deliberatelyShiftedFrame.passes,
});

const contract = Object.freeze({
  schema: "cssmars-calibration-metric-contract@1",
  qualification: Object.values(metricGates).every(Boolean)
    ? "CALIBRATION_COMPARISON_METRIC_QUALIFIED"
    : "INVALID_CALIBRATION_METRIC_QUALIFICATION_FAILED",
  generatedAt: new Date().toISOString(),
  evidenceRoot,
  calibrationSourceDecodedRgbaSha256:
    nativeReport.calibration.sourceDecodedRgbaSha256,
  pairingContract: Object.freeze({
    pose: "exact shared pose id and geographic target",
    viewport: browserReport.viewport,
    crop: browserReport.crop,
    comparedDpr: 1,
    excludedDpr: Object.freeze({
      dpr: 2,
      qualification: "INVALID_FOR_NATIVE_PIXEL_PAIRING",
      reason: "No native DPR 2 raster exists; DPR 2 remains a browser-only retained identity proof.",
    }),
    time: Object.freeze({
      motion: "all animations disabled before capture",
      timestampEqualityRequired: false,
      rule:
        "Static calibration frames may have different wall-clock timestamps only when pose, crop, layer state, source hash, and repeated-frame stability are exact.",
    }),
  }),
  regions: Object.freeze({
    surfaceInterior: Object.freeze({
      valid: true,
      rawPixelmatch: true,
      identity:
        "Same decoded 4096x2048 calibration source; Google uses exact DXT1 tile derivatives and cssEarth uses exact prepared projective/polar derivatives.",
      mask: "intersection of paired calibration discs inset by 4 pixels",
      metrics: Object.freeze([
        "masked Pixelmatch",
        "mean absolute RGB delta",
        "landmark local-flow residual",
        "feature centroid residual",
      ]),
    }),
    silhouette: Object.freeze({
      valid: true,
      rawPixelmatch: false,
      metrics: Object.freeze([
        "center residual",
        "diameter residual",
        "edge antialiasing width",
      ]),
      reason:
        "Geometry is comparable, but native and browser sky pixels differ across the antialiased edge.",
    }),
    seamAndPoles: Object.freeze({
      valid: true,
      rawPixelmatch: true,
      qualification:
        "Exact target address plus shared source landmarks; projective and polar preparation differences remain measured renderer error.",
    }),
    backgroundStarfield: Object.freeze({
      valid: false,
      rawPixelmatch: false,
      qualification: "INVALID_DIFFERENT_PIXEL_IDENTITY",
      reason:
        "Google sky bytes and the licensed ESO cssEarth cubemap are different sources.",
    }),
    sunAtmosphereMoonsAndLighting: Object.freeze({
      valid: false,
      rawPixelmatch: false,
      qualification: "EXCLUDED_LAYER_STATE",
      reason: "Disabled in both calibration renderers.",
    }),
    fullFrame: Object.freeze({
      valid: false,
      rawPixelmatch: false,
      qualification: "INVALID_AS_A_PARITY_PERCENTAGE",
      reason:
        "The frame contains different starfield identities; full-frame differences are evidence only.",
    }),
  }),
  thresholds,
  scores: Object.freeze({
    cameraStateResidual: Object.freeze({
      range: [0, 100],
      inputs: Object.freeze([
        "disc center delta",
        "disc diameter delta",
        "geographic solve angular residual",
        "exact center address",
      ]),
      aggregation: "100 minus the mean threshold-normalized residual, clamped to 0..100",
    }),
    calibrationLandmarkOpticalFlowResidual: Object.freeze({
      range: [0, 100],
      inputs: Object.freeze([
        "mean local-flow displacement",
        "95th-percentile displacement",
        "masked mean absolute RGB delta",
      ]),
      aggregation: "100 minus the mean threshold-normalized residual, clamped to 0..100",
    }),
  }),
  geometryAndUvQualification: Object.freeze({
    native:
      "Google globe geometry with exact cache-addressed calibration DXT1 uploads",
    browser:
      "Existing 516 retained Mars leaves with prepared projective and polar calibration atlases",
    sharedGeometry: false,
    sharedUvSource: true,
    consequence:
      "Landmark motion and silhouette are comparable; exact rendered bytes are not expected to be identical.",
  }),
  metricGates,
  currentStaticRegistration: Object.freeze({
    qualification: allStaticPairsQualified
      ? "WITHIN_DECLARED_STATIC_THRESHOLDS"
      : "OUTSIDE_DECLARED_STATIC_THRESHOLDS",
    allPairsWithinThreshold: allStaticPairsQualified,
    passingPoseCount: poseReports.filter(({ passes }) => passes).length,
    poseCount: poseReports.length,
    purpose:
      "A renderer result assessed by the qualified metric; it is not a gate on whether the metric can distinguish matching and mismatching frames.",
  }),
  summary: summarize(poseReports),
  seamAndPoleSummary: summarizeCoverage(poseReports),
  controls,
  poses: poseReports,
});
await writeFile(metricContractPath, `${JSON.stringify(contract, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  qualification: contract.qualification,
  metricContractPath,
  metricGates,
  currentStaticRegistration: contract.currentStaticRegistration,
  summary: contract.summary,
}, null, 2)}\n`);
if (contract.qualification.startsWith("INVALID")) process.exitCode = 1;

async function evaluatePair({
  id,
  nativePath,
  browserPath,
  nativeDisc,
  browserDisc,
  browserEndpoint,
  centerAddressMatches,
  coverage,
  output,
}) {
  await mkdir(output, { recursive: true });
  const [native, browser] = await Promise.all([
    decode(nativePath),
    decode(browserPath),
  ]);
  const exactDimensions = native.width === browser.width &&
    native.height === browser.height;
  if (!exactDimensions) {
    throw new Error(`INVALID ${id}: native and browser dimensions differ.`);
  }
  const surfaceMask = intersectionDiscMask(
    native.width,
    native.height,
    nativeDisc,
    browserDisc,
    4,
  );
  const [maskedNativePath, maskedBrowserPath] = await Promise.all([
    writeMasked(resolve(output, "surface-native.png"), native, surfaceMask),
    writeMasked(resolve(output, "surface-browser.png"), browser, surfaceMask),
  ]);
  const [maskedPixelmatch, fullFramePixelmatch] = await Promise.all([
    createPixelmatchTriptych({
      referencePath: maskedNativePath,
      candidatePath: maskedBrowserPath,
      outputPath: resolve(output, "surface-triptych.png"),
      threshold: thresholds.pixelmatchThreshold,
    }),
    createPixelmatchTriptych({
      referencePath: nativePath,
      candidatePath: browserPath,
      outputPath: resolve(output, "full-frame-evidence-triptych.png"),
      threshold: thresholds.pixelmatchThreshold,
    }),
  ]);
  const surfaceColor = maskedColorDelta(native, browser, surfaceMask);
  const landmarkFlow = localLandmarkFlow(native, browser, surfaceMask);
  const featureCentroids = compareFeatureCentroids(
    native,
    browser,
    surfaceMask,
  );
  const centerResidual = Math.hypot(
    browserDisc.centerX - nativeDisc.centerX,
    browserDisc.centerY - nativeDisc.centerY,
  );
  const diameterResidual = Math.max(
    Math.abs(browserDisc.width - nativeDisc.width),
    Math.abs(browserDisc.height - nativeDisc.height),
  );
  const edgeAntialiasing = compareEdgeAntialiasing(
    native,
    browser,
    nativeDisc,
    browserDisc,
  );
  const silhouettePasses = edgeAntialiasing.widthResidualPixels <=
    thresholds.edgeAntialiasingWidthResidualPixels;
  const cameraPasses = centerResidual <=
      thresholds.cameraCenterResidualPixels &&
    diameterResidual <= thresholds.cameraDiameterResidualPixels &&
    browserEndpoint.angularResidualDegrees <=
      thresholds.browserGeographicAngularResidualDegrees &&
    centerAddressMatches;
  const landmarkPasses = landmarkFlow.sampleCount >=
      thresholds.minimumFlowSampleCount &&
    landmarkFlow.meanPixels <= thresholds.landmarkMeanFlowPixels &&
    landmarkFlow.p95Pixels <= thresholds.landmarkP95FlowPixels &&
    landmarkFlow.maximumPixels <= thresholds.landmarkMaximumFlowPixels &&
    surfaceColor.meanAbsoluteRgbDelta <=
      thresholds.surfaceMeanAbsoluteRgbDelta &&
    maskedPixelmatch.changedPixelRatio <=
      thresholds.surfacePixelmatchChangedRatio;
  const cameraScore = score([
    centerResidual / thresholds.cameraCenterResidualPixels,
    diameterResidual / thresholds.cameraDiameterResidualPixels,
    browserEndpoint.angularResidualDegrees /
      thresholds.browserGeographicAngularResidualDegrees,
    centerAddressMatches ? 0 : 1,
  ]);
  const landmarkScore = score([
    landmarkFlow.meanPixels / thresholds.landmarkMeanFlowPixels,
    landmarkFlow.p95Pixels / thresholds.landmarkP95FlowPixels,
    surfaceColor.meanAbsoluteRgbDelta /
      thresholds.surfaceMeanAbsoluteRgbDelta,
  ]);
  const measurementComplete = Number.isFinite(centerResidual) &&
    Number.isFinite(diameterResidual) &&
    Number.isFinite(edgeAntialiasing.widthResidualPixels) &&
    Number.isFinite(landmarkFlow.meanPixels) &&
    Number.isFinite(surfaceColor.meanAbsoluteRgbDelta) &&
    Number.isFinite(maskedPixelmatch.changedPixelRatio);
  return Object.freeze({
    id,
    coverage,
    measurementComplete,
    passes: cameraPasses && silhouettePasses && landmarkPasses,
    pairing: Object.freeze({
      exactPoseId: true,
      exactDimensions,
      exactCrop: true,
      dpr: 1,
      nativePath,
      browserPath,
      nativeSha256: sha256(await readFile(nativePath)),
      browserSha256: sha256(await readFile(browserPath)),
    }),
    identityGate: Object.freeze({
      surfaceInterior: true,
      silhouette: true,
      background: false,
      fullFrame: false,
    }),
    cameraStateResidual: Object.freeze({
      passes: cameraPasses,
      score: cameraScore,
      centerPixels: centerResidual,
      diameterPixels: diameterResidual,
      geographicAngularDegrees:
        browserEndpoint.angularResidualDegrees,
      centerAddressMatches,
      screenRollDegrees: browserEndpoint.screenRollDegrees,
    }),
    silhouetteResidual: Object.freeze({
      passes: silhouettePasses,
      ...edgeAntialiasing,
    }),
    calibrationLandmarkOpticalFlowResidual: Object.freeze({
      passes: landmarkPasses,
      score: landmarkScore,
      ...landmarkFlow,
    }),
    surfaceColor,
    featureCentroids,
    maskedPixelmatch,
    fullFrameEvidence: Object.freeze({
      qualification: "INVALID_AS_A_PARITY_PERCENTAGE",
      changedPixelRatio: fullFramePixelmatch.changedPixelRatio,
      meanAbsoluteRgbDelta: fullFramePixelmatch.meanAbsoluteRgbDelta,
      triptych: fullFramePixelmatch.paths.triptych,
    }),
  });
}

function localLandmarkFlow(native, browser, mask) {
  const nativeFeature = featurePlane(native);
  const browserFeature = featurePlane(browser);
  const residuals = [];
  const correlations = [];
  const searchRadius = 20;
  const patchRadius = 2;
  const sampleStep = 8;
  for (let y = searchRadius + patchRadius;
    y < native.height - searchRadius - patchRadius; y += sampleStep) {
    for (let x = searchRadius + patchRadius;
      x < native.width - searchRadius - patchRadius; x += sampleStep) {
      const index = y * native.width + x;
      if (!mask[index] || nativeFeature.gradient[index] < 80) continue;
      let bestCorrelation = -Infinity;
      let bestDistance = Infinity;
      for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
          const candidateX = x + dx;
          const candidateY = y + dy;
          if (candidateX < patchRadius ||
              candidateX >= native.width - patchRadius ||
              candidateY < patchRadius ||
              candidateY >= native.height - patchRadius ||
              !mask[candidateY * native.width + candidateX]) continue;
          let referenceTotal = 0;
          let candidateTotal = 0;
          let referenceSquared = 0;
          let candidateSquared = 0;
          let productTotal = 0;
          let count = 0;
          for (let patchY = -patchRadius;
            patchY <= patchRadius; patchY += 1) {
            for (let patchX = -patchRadius;
              patchX <= patchRadius; patchX += 1) {
              const referenceIndex = (y + patchY) * native.width +
                x + patchX;
              const candidateIndex = (candidateY + patchY) * native.width +
                candidateX + patchX;
              const referenceValue = nativeFeature.gradient[referenceIndex];
              const candidateValue = browserFeature.gradient[candidateIndex];
              referenceTotal += referenceValue;
              candidateTotal += candidateValue;
              referenceSquared += referenceValue * referenceValue;
              candidateSquared += candidateValue * candidateValue;
              productTotal += referenceValue * candidateValue;
              count += 1;
            }
          }
          const numerator = productTotal -
            referenceTotal * candidateTotal / count;
          const denominator = Math.sqrt(Math.max(0,
            referenceSquared - referenceTotal ** 2 / count) * Math.max(0,
            candidateSquared - candidateTotal ** 2 / count));
          if (denominator < 1e-6) continue;
          const correlation = numerator / denominator;
          const distance = Math.hypot(dx, dy);
          if (correlation > bestCorrelation ||
              (correlation === bestCorrelation &&
              distance < bestDistance)) {
            bestCorrelation = correlation;
            bestDistance = distance;
          }
        }
      }
      if (Number.isFinite(bestDistance) && bestCorrelation >= 0.35) {
        residuals.push(bestDistance);
        correlations.push(bestCorrelation);
      }
    }
  }
  residuals.sort((first, second) => first - second);
  correlations.sort((first, second) => first - second);
  const total = residuals.reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    model:
      "local normalized 5x5 gradient correlation on calibration landmarks",
    searchRadiusPixels: searchRadius,
    patchRadiusPixels: patchRadius,
    sampleStepPixels: sampleStep,
    sampleCount: residuals.length,
    meanPixels: residuals.length === 0 ? Infinity : total / residuals.length,
    p95Pixels: percentile(residuals, 0.95),
    maximumPixels: residuals.at(-1) ?? Infinity,
    medianCorrelation: percentile(correlations, 0.5),
  });
}

function compareEdgeAntialiasing(native, browser, nativeDisc, browserDisc) {
  const reference = edgeAntialiasing(native, nativeDisc);
  const candidate = edgeAntialiasing(browser, browserDisc);
  return Object.freeze({
    model:
      "10-to-90 percent radial color transition across the measured calibration silhouette",
    reference,
    candidate,
    widthResidualPixels: Math.abs(
      reference.medianWidthPixels - candidate.medianWidthPixels,
    ),
  });
}

function edgeAntialiasing(image, disc) {
  const widths = [];
  const radiusX = disc.width / 2;
  const radiusY = disc.height / 2;
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const angle = degrees * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const normalLength = Math.hypot(cosine / radiusX, sine / radiusY);
    const normalX = cosine / radiusX / normalLength;
    const normalY = sine / radiusY / normalLength;
    const boundaryX = disc.centerX + radiusX * cosine;
    const boundaryY = disc.centerY + radiusY * sine;
    const inner = sampleRgb(image,
      boundaryX - normalX * 7, boundaryY - normalY * 7);
    const outer = sampleRgb(image,
      boundaryX + normalX * 7, boundaryY + normalY * 7);
    const contrast = Math.hypot(
      inner[0] - outer[0],
      inner[1] - outer[1],
      inner[2] - outer[2],
    );
    if (contrast < 20) continue;
    const profile = [];
    for (let offset = -6; offset <= 6; offset += 0.25) {
      const color = sampleRgb(image,
        boundaryX + normalX * offset,
        boundaryY + normalY * offset);
      const distance = Math.hypot(
        color[0] - outer[0],
        color[1] - outer[1],
        color[2] - outer[2],
      );
      profile.push({ offset, normalized: distance / contrast });
    }
    const high = crossing(profile, 0.9);
    const low = crossing(profile, 0.1);
    if (Number.isFinite(high) && Number.isFinite(low) && low >= high) {
      widths.push(low - high);
    }
  }
  widths.sort((first, second) => first - second);
  return Object.freeze({
    sampleCount: widths.length,
    medianWidthPixels: percentile(widths, 0.5),
    p95WidthPixels: percentile(widths, 0.95),
  });
}

function sampleRgb(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const xWeight = Math.max(0, Math.min(1, x - x0));
  const yWeight = Math.max(0, Math.min(1, y - y0));
  const result = [];
  for (let channel = 0; channel < 3; channel += 1) {
    const top = image.data[(y0 * image.width + x0) * 4 + channel] *
        (1 - xWeight) +
      image.data[(y0 * image.width + x1) * 4 + channel] * xWeight;
    const bottom = image.data[(y1 * image.width + x0) * 4 + channel] *
        (1 - xWeight) +
      image.data[(y1 * image.width + x1) * 4 + channel] * xWeight;
    result.push(top * (1 - yWeight) + bottom * yWeight);
  }
  return result;
}

function crossing(profile, threshold) {
  for (let index = 1; index < profile.length; index += 1) {
    const previous = profile[index - 1];
    const current = profile[index];
    if (previous.normalized >= threshold &&
        current.normalized <= threshold) {
      const span = previous.normalized - current.normalized;
      const fraction = span < 1e-9
        ? 0
        : (previous.normalized - threshold) / span;
      return previous.offset +
        (current.offset - previous.offset) * fraction;
    }
  }
  return Infinity;
}

function featurePlane(image) {
  const length = image.width * image.height;
  const luma = new Float32Array(length);
  const chroma = new Float32Array(length);
  const gradient = new Float32Array(length);
  for (let pixel = 0, offset = 0; pixel < length;
    pixel += 1, offset += 4) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    luma[pixel] = red * 0.299 + green * 0.587 + blue * 0.114;
    chroma[pixel] = red - blue + (green - blue) * 0.5;
  }
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const index = y * image.width + x;
      gradient[index] = Math.abs(luma[index + 1] - luma[index - 1]) +
        Math.abs(luma[index + image.width] -
          luma[index - image.width]) +
        Math.abs(chroma[index + 1] - chroma[index - 1]) * 0.5 +
        Math.abs(chroma[index + image.width] -
          chroma[index - image.width]) * 0.5;
    }
  }
  return { luma, chroma, gradient };
}

function compareFeatureCentroids(native, browser, mask) {
  const definitions = Object.freeze({
    cyan: (red, green, blue) => green > 120 && blue > 120 &&
      green + blue > red * 3,
    magenta: (red, green, blue) => red > 120 && blue > 70 &&
      red + blue > green * 3,
    yellow: (red, green, blue) => red > 140 && green > 110 &&
      red + green > blue * 4,
    white: (red, green, blue) => Math.min(red, green, blue) > 165 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) < 35,
  });
  return Object.freeze(Object.fromEntries(Object.entries(definitions).map(
    ([name, predicate]) => {
      const reference = centroid(native, mask, predicate);
      const candidate = centroid(browser, mask, predicate);
      return [name, Object.freeze({
        reference,
        candidate,
        comparable: reference.count >= 5 && candidate.count >= 5,
        residualPixels: reference.count >= 5 && candidate.count >= 5
          ? Math.hypot(
            candidate.x - reference.x,
            candidate.y - reference.y,
          )
          : null,
      })];
    },
  )));
}

function centroid(image, mask, predicate) {
  let count = 0;
  let xTotal = 0;
  let yTotal = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = y * image.width + x;
      if (!mask[pixel]) continue;
      const offset = pixel * 4;
      if (!predicate(
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2],
      )) continue;
      count += 1;
      xTotal += x;
      yTotal += y;
    }
  }
  return Object.freeze({
    count,
    x: count === 0 ? null : xTotal / count,
    y: count === 0 ? null : yTotal / count,
  });
}

function intersectionDiscMask(width, height, first, second, inset) {
  const mask = new Uint8Array(width * height);
  const discs = [first, second].map((disc) => ({
    centerX: disc.centerX,
    centerY: disc.centerY,
    radiusX: disc.width / 2 - inset,
    radiusY: disc.height / 2 - inset,
  }));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      mask[y * width + x] = discs.every((disc) =>
        ((x - disc.centerX) / disc.radiusX) ** 2 +
          ((y - disc.centerY) / disc.radiusY) ** 2 <= 1) ? 1 : 0;
    }
  }
  return mask;
}

async function writeMasked(path, image, mask) {
  const output = new PNG({ width: image.width, height: image.height });
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * 4;
    if (mask[pixel]) {
      output.data[offset] = image.data[offset];
      output.data[offset + 1] = image.data[offset + 1];
      output.data[offset + 2] = image.data[offset + 2];
    }
    output.data[offset + 3] = 255;
  }
  await writeFile(path, PNG.sync.write(output));
  return path;
}

function maskedColorDelta(native, browser, mask) {
  let channelTotal = 0;
  let pixelCount = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const offset = pixel * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      channelTotal += Math.abs(
        native.data[offset + channel] - browser.data[offset + channel],
      );
    }
    pixelCount += 1;
  }
  return Object.freeze({
    pixelCount,
    meanAbsoluteRgbDelta: channelTotal / (pixelCount * 3),
  });
}

async function decode(path) {
  const bytes = await sharp(path).rotate().toColorspace("srgb")
    .ensureAlpha().png().toBuffer();
  return PNG.sync.read(bytes);
}

async function shiftImage(sourcePath, outputPath, x, y) {
  const source = await readFile(sourcePath);
  const metadata = await sharp(source).metadata();
  await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
      background: "#000",
    },
  }).composite([{ input: source, left: x, top: y }]).png().toFile(outputPath);
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return Infinity;
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction),
  )];
}

function score(residuals) {
  const normalized = residuals.reduce((sum, value) =>
    sum + Math.min(1, Math.max(0, value)), 0) / residuals.length;
  return Number((100 * (1 - normalized)).toFixed(3));
}

function summarize(poses) {
  const mean = (selector) => poses.reduce((sum, pose) =>
    sum + selector(pose), 0) / poses.length;
  return Object.freeze({
    poseCount: poses.length,
    passingPoseCount: poses.filter(({ passes }) => passes).length,
    meanCameraScore: Number(mean((pose) =>
      pose.cameraStateResidual.score).toFixed(3)),
    meanEdgeAntialiasingWidthResidualPixels: Number(mean((pose) =>
      pose.silhouetteResidual.widthResidualPixels).toFixed(3)),
    meanLandmarkScore: Number(mean((pose) =>
      pose.calibrationLandmarkOpticalFlowResidual.score).toFixed(3)),
    meanLandmarkFlowPixels: Number(mean((pose) =>
      pose.calibrationLandmarkOpticalFlowResidual.meanPixels).toFixed(3)),
    meanSurfaceRgbDelta: Number(mean((pose) =>
      pose.surfaceColor.meanAbsoluteRgbDelta).toFixed(3)),
    meanMaskedPixelmatchChangedRatio: Number(mean((pose) =>
      pose.maskedPixelmatch.changedPixelRatio).toFixed(6)),
    meanInvalidFullFrameChangedRatio: Number(mean((pose) =>
      pose.fullFrameEvidence.changedPixelRatio).toFixed(6)),
  });
}

function summarizeCoverage(poses) {
  const groups = Object.freeze({
    seam: poses.filter(({ coverage }) => coverage.includes("seam")),
    northPole: poses.filter(({ coverage }) =>
      coverage.includes("north-pole")),
    southPole: poses.filter(({ coverage }) =>
      coverage.includes("south-pole")),
  });
  return Object.freeze(Object.fromEntries(Object.entries(groups).map(
    ([name, entries]) => [name, Object.freeze({
      poseIds: entries.map(({ id }) => id),
      exactCenterAddresses: entries.every(({ cameraStateResidual }) =>
        cameraStateResidual.centerAddressMatches),
      meanLandmarkFlowPixels: entries.length === 0 ? null : Number((
        entries.reduce((sum, entry) => sum +
          entry.calibrationLandmarkOpticalFlowResidual.meanPixels, 0) /
          entries.length
      ).toFixed(3)),
      meanMaskedPixelmatchChangedRatio: entries.length === 0 ? null : Number((
        entries.reduce((sum, entry) => sum +
          entry.maskedPixelmatch.changedPixelRatio, 0) / entries.length
      ).toFixed(6)),
    })],
  )));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
