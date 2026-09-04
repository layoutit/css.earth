import sharp from "sharp";

import { CUBIC_SKY_STANDARD } from "./cubic-sky-contract.mjs";

export const CUBIC_SKY_SUN_ORACLE_SCHEMA =
  "cssearth-google-maps-sun-oracle@1";

export function prepareStandardCubicSkyPixels(highContrastPixels) {
  if (!Buffer.isBuffer(highContrastPixels) ||
      highContrastPixels.length % 3 !== 0) {
    throw new TypeError("High-contrast cubic-sky pixels are invalid.");
  }
  const {
    saturation,
    luminanceGamma,
    gain,
  } = CUBIC_SKY_STANDARD.standardPresentation;
  const pixels = Buffer.alloc(highContrastPixels.length);
  for (let offset = 0; offset < highContrastPixels.length; offset += 3) {
    const red = highContrastPixels[offset];
    const green = highContrastPixels[offset + 1];
    const blue = highContrastPixels[offset + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const compressedLuminance = 255 * Math.pow(
      luminance / 255,
      luminanceGamma,
    ) * gain;
    const luminanceScale = luminance === 0
      ? 0
      : compressedLuminance / luminance;
    pixels[offset] = Math.round(clamp(
      (luminance + (red - luminance) * saturation) * luminanceScale,
      0,
      255,
    ));
    pixels[offset + 1] = Math.round(clamp(
      (luminance + (green - luminance) * saturation) * luminanceScale,
      0,
      255,
    ));
    pixels[offset + 2] = Math.round(clamp(
      (luminance + (blue - luminance) * saturation) * luminanceScale,
      0,
      255,
    ));
  }
  return pixels;
}

export function validateCubicSkySunOracle(oracle) {
  const standard = CUBIC_SKY_STANDARD.sun;
  if (oracle?.schema !== CUBIC_SKY_SUN_ORACLE_SCHEMA ||
      oracle.asset?.width !== standard.logicalSize ||
      oracle.asset?.height !== standard.logicalSize ||
      oracle.rayPeaks?.length !== 24 ||
      oracle.presentation?.sourceTreatment !==
        "3 px source median followed by luminance levels with no radial masking" ||
      oracle.qualification?.redistribution !==
        "exact Google asset retained as a local visual-oracle input; " +
        "redistribution rights are unverified") {
    throw new TypeError("Cubic-sky Sun oracle measurements are incompatible.");
  }
  return oracle;
}

export async function prepareCubicSkySunPixels({
  sourcePath,
  oracle,
  density,
}) {
  validateCubicSkySunOracle(oracle);
  if (![1, 2].includes(density)) {
    throw new TypeError("Cubic-sky Sun density must be 1 or 2.");
  }
  const standard = CUBIC_SKY_STANDARD.sun;
  const size = standard.logicalSize * density;
  const source = await sharp(sourcePath).resize(size, size, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  }).median(standard.sourceMedianRadius).removeAlpha().raw().toBuffer();
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const sourceOffset = (y * size + x) * 3;
      const sourceColor = [
        source[sourceOffset],
        source[sourceOffset + 1],
        source[sourceOffset + 2],
      ];
      const sourceLuminance = mean(sourceColor);
      const normalizedLuminance = clamp(
        (sourceLuminance - standard.sourceBlackPoint) /
          (255 - standard.sourceBlackPoint),
        0,
        1,
      );
      const preparedLuminance = 255 * Math.pow(
        normalizedLuminance,
        standard.sourceLevelGamma,
      );
      const luminanceGain = sourceLuminance === 0
        ? 0
        : preparedLuminance / sourceLuminance;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(clamp(
          sourceColor[channel] * luminanceGain,
          0,
          255,
        ));
      }
      pixels[offset + 3] = 255;
    }
  }
  return Object.freeze({ pixels, size });
}

export function compositeSunIntoCubicSkyFace({
  faceId,
  facePixels,
  sunPixels,
  sunSize,
  faceSize,
  localDirection,
}) {
  const standard = CUBIC_SKY_STANDARD.sun;
  const projectionWidth = standard.presentationSize[0] /
    standard.canonicalFocalPixels;
  const projectionHeight = standard.presentationSize[1] /
    standard.canonicalFocalPixels;
  const tangentRight = normalize(cross([0, 1, 0], localDirection));
  const tangentUp = normalize(cross(localDirection, tangentRight));
  for (let y = 0; y < faceSize; y += 1) {
    const v = y / (faceSize - 1) * 2 - 1;
    for (let x = 0; x < faceSize; x += 1) {
      const u = x / (faceSize - 1) * 2 - 1;
      const direction = normalize(cubeFaceDirection(faceId, u, v));
      const forward = dot(direction, localDirection);
      if (forward <= 0) continue;
      const tangentX = dot(direction, tangentRight) / forward;
      const tangentY = dot(direction, tangentUp) / forward;
      const sourceX = tangentX / projectionWidth * sunSize +
        sunSize / 2 - 0.5;
      const sourceY = tangentY / projectionHeight * sunSize +
        sunSize / 2 - 0.5;
      if (sourceX < 0 || sourceX >= sunSize - 1 ||
          sourceY < 0 || sourceY >= sunSize - 1) continue;
      const sample = sampleBilinearRgba(
        sunPixels,
        sunSize,
        sunSize,
        sourceX,
        sourceY,
      );
      const sourceRadius = Math.hypot(
        sourceX + 0.5 - sunSize / 2,
        sourceY + 0.5 - sunSize / 2,
      );
      const sourceGain = mix(
        standard.presentationCoreGain,
        standard.presentationAlphaGain,
        smoothStep(8, 22, sourceRadius),
      );
      const targetOffset = (y * faceSize + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const sourceLevel = clamp(sample[channel] * sourceGain, 0, 255);
        facePixels[targetOffset + channel] = Math.round(
          255 - (255 - facePixels[targetOffset + channel]) *
          (255 - sourceLevel) / 255,
        );
      }
    }
  }
  return facePixels;
}

function cubeFaceDirection(face, u, v) {
  if (face === "front") return [u, v, -1];
  if (face === "right") return [1, v, u];
  if (face === "back") return [-u, v, 1];
  if (face === "left") return [-1, v, -u];
  if (face === "top") return [u, -1, -v];
  return [u, 1, v];
}

function sampleBilinearRgba(pixels, width, height, sourceX, sourceY) {
  const x0 = clamp(Math.floor(sourceX), 0, width - 1);
  const y0 = clamp(Math.floor(sourceY), 0, height - 1);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = sourceX - x0;
  const ty = sourceY - y0;
  return [0, 1, 2, 3].map((channel) => mix(
    mix(
      pixels[(y0 * width + x0) * 4 + channel],
      pixels[(y0 * width + x1) * 4 + channel],
      tx,
    ),
    mix(
      pixels[(y1 * width + x0) * 4 + channel],
      pixels[(y1 * width + x1) * 4 + channel],
      tx,
    ),
    ty,
  ));
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothStep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
