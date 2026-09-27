import { PNG } from "pngjs";
import { relativeLuminance } from "./image-pixels.mts";
import type { Point, Analysis, Silhouette, Planet, Sun, Terminator } from "./analysis-types.mts";

export function analyzeIlluminationProfile(png: PNG, silhouette: Silhouette, terminator: Terminator) {
  const binCount = 10;
  const sums = new Array<number>(binCount).fill(0);
  const sampleCounts = new Array<number>(binCount).fill(0);
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

export function analyzeDiscPhase(png: PNG, silhouette: Silhouette) {
  const values: number[] = [];
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
  const percentile = (fraction: number) => values[Math.floor(
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

export function shadowShapeMask(png: PNG, analysis: Pick<Analysis, "silhouette" | "discPhase" | "terminator">) {
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

export function detectAnnulusLightDirection(luminance: Float32Array, width: number, height: number, silhouette: Silhouette) {
  let best: (Point & { mean: number }) | null = null;
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
  if (!best) throw new Error("No annulus direction samples.");
  return Object.freeze({ x: best.x, y: best.y });
}

export function normalizeDirection(x: number, y: number) {
  const length = Math.hypot(x, y);
  if (length < 1e-9) return Object.freeze({ x: 1, y: 0 });
  return Object.freeze({ x: x / length, y: y / length });
}

export function shadowShapeSummary(shape: ReturnType<typeof shadowShapeMask>) {
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

export function analyzeTerminatorShape(png: PNG, planet: Planet, silhouette: Silhouette, sun: Sun) {
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
    let strongest: { along: number; edgeStrength: number } | null = null;
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

export function blurredLuminance(png: PNG, blurRadius: number) {
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

export function directionalWindowMean(luminance: Float32Array, width: number, height: number, center: Point, alongAxis: Point, acrossAxis: Point, across: number, alongStart: number, length: number) {
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

export function quadraticFit(points: readonly Point[]) {
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

export function solveThreeByThree(rows: readonly (readonly number[])[]) {
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

export function symmetricShapeDistance(left: readonly Point[], right: readonly Point[]) {
  const nearestMean = (source: readonly Point[], target: readonly Point[]) => source.reduce((sum, point) => {
    const nearest = target.reduce((minimum, candidate) => Math.min(
      minimum,
      Math.hypot(point.x - candidate.x, point.y - candidate.y),
    ), Number.POSITIVE_INFINITY);
    return sum + nearest;
  }, 0) / source.length;
  return (nearestMean(left, right) + nearestMean(right, left)) / 2;
}

export function normalizedDegrees(degrees: number) {
  return (degrees % 360 + 360) % 360;
}

export function circularAngleDifference(left: number, right: number) {
  const raw = Math.abs(normalizedDegrees(left) - normalizedDegrees(right));
  return Math.min(raw, 360 - raw);
}
