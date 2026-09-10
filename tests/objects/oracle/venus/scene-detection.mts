import { PNG } from "pngjs";
import { ORACLE_SCENE_CENTER } from "./profile.mts";
import { relativeLuminance } from "./image-pixels.mts";
import type { Bounds, Silhouette, Planet, SunDetector, SunComponent } from "./analysis-types.mts";

export function classifySceneLod(bytes: Buffer) {
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

export function detectPlanet(png: PNG, silhouette: Silhouette) {
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
  let largest: ({ count: number } & Bounds) | null = null;
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

export function detectSilhouette(png: PNG) {
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

export function detectSun(png: PNG, planet: Planet, silhouette: Silhouette) {
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
      visible: false as const,
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
    visible: true as const,
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

export function brightestSunComponent(png: PNG, detector: SunDetector, { luminanceThreshold, minimumComponentPixels, minimumLimbComponentPixels, edgeOnly }: { luminanceThreshold: number; minimumComponentPixels: number; minimumLimbComponentPixels: number; edgeOnly: boolean }) {
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
  let brightest: SunComponent | null = null;
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

export function analyzeBackground(png: PNG, silhouette: Silhouette) {
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
