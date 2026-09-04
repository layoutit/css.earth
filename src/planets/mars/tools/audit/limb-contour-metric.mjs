export const MARS_LIMB_CONTOUR_THRESHOLDS = Object.freeze({
  alpha: 8,
  rayCount: 1_440,
  maximumAbsoluteCssPixels: Object.freeze({ dpr1: 2, dpr2: 1.5 }),
  maximumRmsCssPixels: 0.75,
});

export function measureMarsLimbContour({
  actualAlpha,
  actualWidth,
  actualHeight,
  expectedCoverage,
  expectedWidth,
  expectedHeight,
  expectedRect,
  thresholds = MARS_LIMB_CONTOUR_THRESHOLDS,
}) {
  if (actualAlpha.length !== actualWidth * actualHeight) {
    throw new RangeError("Actual alpha dimensions do not match the buffer.");
  }
  if (expectedCoverage.length !== expectedWidth * expectedHeight) {
    throw new RangeError("Expected coverage dimensions do not match the buffer.");
  }
  const outward = new Uint8Array(actualAlpha.length);
  const inward = new Uint8Array(actualAlpha.length);
  let actualPixelCount = 0;
  let expectedPixelCount = 0;
  let outwardPixelCount = 0;
  let inwardPixelCount = 0;
  for (let y = 0; y < actualHeight; y += 1) {
    for (let x = 0; x < actualWidth; x += 1) {
      const index = y * actualWidth + x;
      const actualVisible = actualAlpha[index] >= thresholds.alpha;
      const expectedVisible = expectedSample({
        x,
        y,
        expectedCoverage,
        expectedWidth,
        expectedHeight,
        expectedRect,
      }) >= thresholds.alpha;
      if (actualVisible) actualPixelCount += 1;
      if (expectedVisible) expectedPixelCount += 1;
      if (actualVisible && !expectedVisible) {
        outward[index] = actualAlpha[index];
        outwardPixelCount += 1;
      }
      if (expectedVisible && !actualVisible) {
        inward[index] = 255;
        inwardPixelCount += 1;
      }
    }
  }
  const center = Object.freeze({
    x: expectedRect.x + expectedRect.width / 2,
    y: expectedRect.y + expectedRect.height / 2,
  });
  const maximumRadius = Math.hypot(
    expectedRect.width / 2,
    expectedRect.height / 2,
  ) + Math.max(expectedRect.width, expectedRect.height) * 0.08;
  const pixelDensity = expectedWidth / 512;
  const deviations = [];
  for (let index = 0; index < thresholds.rayCount; index += 1) {
    const angle = index / thresholds.rayCount * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const actualRadius = lastVisibleRadius({
      maximumRadius,
      sample(radius) {
        return actualSample(
          actualAlpha,
          actualWidth,
          actualHeight,
          center.x + cosine * radius,
          center.y + sine * radius,
        ) >= thresholds.alpha;
      },
    });
    const expectedRadius = lastVisibleRadius({
      maximumRadius,
      sample(radius) {
        return expectedSample({
          x: center.x + cosine * radius,
          y: center.y + sine * radius,
          expectedCoverage,
          expectedWidth,
          expectedHeight,
          expectedRect,
        }) >= thresholds.alpha;
      },
    });
    deviations.push((actualRadius - expectedRadius) / pixelDensity);
  }
  const maximumOutwardCssPixels = Math.max(0, ...deviations);
  const maximumInwardCssPixels = Math.max(
    0,
    ...deviations.map((value) => -value),
  );
  const maximumAbsoluteCssPixels = Math.max(
    maximumOutwardCssPixels,
    maximumInwardCssPixels,
  );
  const rmsCssPixels = Math.sqrt(deviations.reduce(
    (sum, value) => sum + value * value,
    0,
  ) / deviations.length);
  const maximumAcceptedAbsoluteCssPixels = pixelDensity === 1
    ? thresholds.maximumAbsoluteCssPixels.dpr1
    : thresholds.maximumAbsoluteCssPixels.dpr2;
  return Object.freeze({
    actualPixelCount,
    expectedPixelCount,
    outwardPixelCount,
    inwardPixelCount,
    maximumOutwardCssPixels: rounded(maximumOutwardCssPixels),
    maximumInwardCssPixels: rounded(maximumInwardCssPixels),
    maximumAbsoluteCssPixels: rounded(maximumAbsoluteCssPixels),
    rmsCssPixels: rounded(rmsCssPixels),
    maximumAcceptedAbsoluteCssPixels,
    passes:
      maximumAbsoluteCssPixels <= maximumAcceptedAbsoluteCssPixels &&
      rmsCssPixels <= thresholds.maximumRmsCssPixels,
    outward,
    inward,
  });
}

function actualSample(alpha, width, height, x, y) {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || column >= width || row < 0 || row >= height) return 0;
  return alpha[row * width + column];
}

function expectedSample({
  x,
  y,
  expectedCoverage,
  expectedWidth,
  expectedHeight,
  expectedRect,
}) {
  const column = Math.floor(
    (x - expectedRect.x) / expectedRect.width * expectedWidth,
  );
  const row = Math.floor(
    (y - expectedRect.y) / expectedRect.height * expectedHeight,
  );
  if (column < 0 || column >= expectedWidth || row < 0 || row >= expectedHeight) {
    return 0;
  }
  return expectedCoverage[row * expectedWidth + column];
}

function lastVisibleRadius({ maximumRadius, sample }) {
  let lastVisible = 0;
  for (let radius = 0; radius <= maximumRadius; radius += 0.5) {
    if (sample(radius)) lastVisible = radius;
  }
  return lastVisible;
}

function rounded(value) {
  return Number(value.toFixed(6));
}
