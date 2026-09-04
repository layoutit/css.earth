const DEFAULT_DETAIL_BLEND_START_RADIUS = 0.08;
const DEFAULT_DETAIL_BLEND_END_RADIUS = 0.96;

export function preparePolarContinuationAtlas({
  source,
  tileSize,
  firstMeasuredRow,
  lastMeasuredRow,
  measuredHeight,
  overlap = 1.035,
  detailLookbackDegrees = 0.5,
  polarDetails = Object.freeze({}),
  detailBlendStartRadius = DEFAULT_DETAIL_BLEND_START_RADIUS,
  detailBlendEndRadius = DEFAULT_DETAIL_BLEND_END_RADIUS,
  edgeStructureWeight = 0.3,
  alphaOpaqueRadius = 0.43,
  alphaTransparentRadius = 0.93,
  measuredProjectionEdgeLatitudeDegrees = null,
}) {
  if (!source?.data || !source?.info || source.info.channels < 3 ||
      !Number.isSafeInteger(tileSize) || tileSize < 16 ||
      !Number.isSafeInteger(firstMeasuredRow) ||
      !Number.isSafeInteger(lastMeasuredRow) ||
      !Number.isSafeInteger(measuredHeight) || measuredHeight < 2 ||
      firstMeasuredRow < 0 || lastMeasuredRow >= measuredHeight ||
      firstMeasuredRow >= lastMeasuredRow ||
      !validPolarDetails(polarDetails) ||
      !(detailBlendStartRadius >= 0 &&
        detailBlendStartRadius < detailBlendEndRadius &&
        detailBlendEndRadius <= 1) ||
      !(edgeStructureWeight >= 0 && edgeStructureWeight <= 1) ||
      !(alphaOpaqueRadius >= 0 &&
        alphaOpaqueRadius < alphaTransparentRadius &&
        alphaTransparentRadius <= 1) ||
      !(measuredProjectionEdgeLatitudeDegrees === null ||
        Number.isFinite(measuredProjectionEdgeLatitudeDegrees) &&
        measuredProjectionEdgeLatitudeDegrees >= 0 &&
        measuredProjectionEdgeLatitudeDegrees < 90)) {
    throw new TypeError("Jupiter polar continuation input is invalid.");
  }
  const width = tileSize * 2;
  const height = tileSize;
  const data = Buffer.alloc(width * height * 4);
  const center = tileSize / 2;
  const sourceHeight = source.info.height;
  const scaleRow = (row) => row / (measuredHeight - 1) * (sourceHeight - 1);
  const lookbackRows = detailLookbackDegrees / 180 * sourceHeight;
  const polePlans = Object.freeze([
    Object.freeze({
      id: "south",
      edgeRow: scaleRow(lastMeasuredRow),
      inward: -1,
      detail: polarDetails.south ?? null,
      measuredLatitudeDegrees:
        Math.abs(90 - lastMeasuredRow / (measuredHeight - 1) * 180),
    }),
    Object.freeze({
      id: "north",
      edgeRow: scaleRow(firstMeasuredRow),
      inward: 1,
      detail: polarDetails.north ?? null,
      measuredLatitudeDegrees:
        90 - firstMeasuredRow / (measuredHeight - 1) * 180,
    }),
  ]);
  const harmonicOrder = 32;
  const harmonics = polePlans.map(({ edgeRow, inward }) =>
    measuredLongitudeHarmonics(
      source,
      edgeRow,
      inward,
      lookbackRows,
      harmonicOrder,
    ));
  const detailPlans = polePlans.map(({ detail }) =>
    detail ? prepareDetailPlan(detail) : null);
  let transparentPixelCount = 0;

  for (let poleIndex = 0; poleIndex < polePlans.length; poleIndex += 1) {
    const plan = polePlans[poleIndex];
    const harmonic = harmonics[poleIndex];
    const detailPlan = detailPlans[poleIndex];
    const unmeasuredCoreRadius = measuredProjectionEdgeLatitudeDegrees === null
      ? null
      : (90 - plan.measuredLatitudeDegrees) /
        (90 - measuredProjectionEdgeLatitudeDegrees);
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const dx = (x + 0.5 - center) / center;
        const dy = (y + 0.5 - center) / center;
        const radius = Math.hypot(dx, dy) / overlap;
        const destination = (y * width + poleIndex * tileSize + x) * 4;
        if (radius > 1) {
          transparentPixelCount += 1;
          continue;
        }
        const longitude = Math.atan2(dx, -dy);
        let measured = measuredProjectionEdgeLatitudeDegrees === null
          ? harmonicSample(harmonic, longitude + Math.PI, radius)
          : projectedPolarSample({
            source,
            pole: plan.id,
            longitude,
            radius,
            unmeasuredCoreRadius,
            measuredProjectionEdgeLatitudeDegrees,
            harmonic,
          });
        if (detailPlan) {
          const detailWeight = 1 - smootherStep(
            (radius - detailBlendStartRadius) /
              (detailBlendEndRadius - detailBlendStartRadius),
          );
          const detailX = (dx / overlap * detailPlan.structureRadius + 1) / 2 *
            (detailPlan.structure.info.width - 1);
          const detailY = (dy / overlap * detailPlan.structureRadius + 1) / 2 *
            (detailPlan.structure.info.height - 1);
          measured = injectPolarStructure({
            base: measured,
            sample: bilinearSample(detailPlan.structure, detailX, detailY),
            detailPlan,
            detailWeight,
            edgeStructureWeight,
          });
        }
        const alphaWeight = 1 - smootherStep(
          (radius - alphaOpaqueRadius) /
            (alphaTransparentRadius - alphaOpaqueRadius),
        );
        for (let channel = 0; channel < 3; channel += 1) {
          data[destination + channel] = Math.round(measured[channel]);
        }
        data[destination + 3] = Math.round(alphaWeight * 255);
        if (alphaWeight === 0) transparentPixelCount += 1;
      }
    }
  }

  const detailedPoles = polePlans
    .filter(({ detail }) => detail)
    .map(({ id }) => id);
  return Object.freeze({
    data,
    width,
    height,
    model: measuredProjectionEdgeLatitudeDegrees !== null &&
        detailedPoles.length > 0
      ? "measured-polar-projection-with-source-structured-unmeasured-core"
      : measuredProjectionEdgeLatitudeDegrees !== null
        ? "measured-polar-projection-with-harmonic-unmeasured-core"
      : detailedPoles.length > 0
        ? "source-structure-hubble-chroma-bounded-polar-atlas"
        : "measured-edge-harmonic-bounded-polar-continuation",
    detailLookbackDegrees,
    harmonicOrder,
    detailedPoles: Object.freeze(detailedPoles),
    centerDetailWeight: detailedPoles.length > 0 ? 1 : 0,
    edgeDetailWeight: detailedPoles.length > 0 ? edgeStructureWeight : 0,
    detailBlendStartRadius: detailedPoles.length > 0
      ? detailBlendStartRadius
      : null,
    detailBlendEndRadius: detailedPoles.length > 0
      ? detailBlendEndRadius
      : null,
    alphaOpaqueRadius,
    alphaTransparentRadius,
    measuredProjectionEdgeLatitudeDegrees,
    polarProjectionAngularSamples:
      measuredProjectionEdgeLatitudeDegrees === null ? null : 9,
    unmeasuredCoreHarmonicOrder:
      measuredProjectionEdgeLatitudeDegrees === null ? null : 2,
    unmeasuredCoreRadius: measuredProjectionEdgeLatitudeDegrees === null
      ? null
      : Object.freeze(Object.fromEntries(polePlans.map((plan) => [
        plan.id,
        Number(((90 - plan.measuredLatitudeDegrees) /
          (90 - measuredProjectionEdgeLatitudeDegrees)).toFixed(6)),
      ]))),
    transparentPixelRatio: transparentPixelCount / (width * height),
  });
}

function projectedPolarSample({
  source,
  pole,
  longitude,
  radius,
  unmeasuredCoreRadius,
  measuredProjectionEdgeLatitudeDegrees,
  harmonic,
}) {
  const normalizedCoreRadius = Math.max(0.000001, unmeasuredCoreRadius);
  const continued = harmonicSample(
    harmonic,
    longitude + Math.PI,
    Math.min(1, radius / normalizedCoreRadius),
    2,
  );
  const absoluteLatitude = 90 - radius *
    (90 - measuredProjectionEdgeLatitudeDegrees);
  const latitude = pole === "north" ? absoluteLatitude : -absoluteLatitude;
  const projected = angularlySupersampledPolarSource(
    source,
    longitude,
    latitude,
    radius,
  );
  const projectedWeight = smootherStep(radius / normalizedCoreRadius);
  return continued.map((value, channel) =>
    value * (1 - projectedWeight) + projected[channel] * projectedWeight);
}

function angularlySupersampledPolarSource(source, longitude, latitude, radius) {
  const sampleCount = 9;
  const halfWidth = Math.max(0, 1 - radius / 0.65) * 0.3;
  const projected = [0, 0, 0];
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const sampleLongitude = longitude - halfWidth + halfWidth * 2 *
      sampleIndex / (sampleCount - 1);
    const sample = bilinearSample(
      source,
      (sampleLongitude + Math.PI) / (Math.PI * 2) * source.info.width,
      (90 - latitude) / 180 * (source.info.height - 1),
    );
    for (let channel = 0; channel < 3; channel += 1) {
      projected[channel] += sample[channel] / sampleCount;
    }
  }
  return projected;
}

export function preparePolarSurfaceTransition({
  source,
  polarDetails,
  transitionStartLatitudeDegrees = 48,
  transitionEndLatitudeDegrees = 64,
  edgeStructureWeight = 0.3,
  innerDetailRadius = 0.72,
  outerDetailRadius = 0.9,
}) {
  if (!source?.data || !source?.info || source.info.channels < 3 ||
      !validPolarDetails(polarDetails) ||
      !(transitionStartLatitudeDegrees >= 0 &&
        transitionStartLatitudeDegrees < transitionEndLatitudeDegrees &&
        transitionEndLatitudeDegrees < 90) ||
      !(edgeStructureWeight >= 0 && edgeStructureWeight <= 1) ||
      !(innerDetailRadius > 0 &&
        innerDetailRadius < outerDetailRadius && outerDetailRadius <= 1)) {
    throw new TypeError("Jupiter polar surface transition input is invalid.");
  }
  const output = Buffer.from(source.data);
  const detailPlans = Object.freeze({
    north: polarDetails.north ? prepareDetailPlan(polarDetails.north) : null,
    south: polarDetails.south ? prepareDetailPlan(polarDetails.south) : null,
  });
  const { width, height, channels } = source.info;
  for (let y = 0; y < height; y += 1) {
    const latitude = 90 - (y + 0.5) / height * 180;
    const absoluteLatitude = Math.abs(latitude);
    if (absoluteLatitude < transitionStartLatitudeDegrees ||
        absoluteLatitude > transitionEndLatitudeDegrees) continue;
    const detailPlan = latitude >= 0 ? detailPlans.north : detailPlans.south;
    if (!detailPlan) continue;
    const transition = smootherStep(
      (absoluteLatitude - transitionStartLatitudeDegrees) /
        (transitionEndLatitudeDegrees - transitionStartLatitudeDegrees),
    );
    const detailRadius = innerDetailRadius +
      (outerDetailRadius - innerDetailRadius) * transition;
    for (let x = 0; x < width; x += 1) {
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const detailX = (Math.cos(longitude) * detailRadius + 1) / 2 *
        (detailPlan.structure.info.width - 1);
      const detailY = (Math.sin(longitude) * detailRadius + 1) / 2 *
        (detailPlan.structure.info.height - 1);
      const index = (y * width + x) * channels;
      const base = [output[index], output[index + 1], output[index + 2]];
      const transitioned = injectPolarStructure({
        base,
        sample: bilinearSample(detailPlan.structure, detailX, detailY),
        detailPlan,
        structureWeight: edgeStructureWeight * transition,
        tintWeight: 0,
      });
      for (let channel = 0; channel < 3; channel += 1) {
        output[index + channel] = Math.round(transitioned[channel]);
      }
    }
  }
  return Object.freeze({ data: output, info: source.info });
}

function validPolarDetails(details) {
  if (!details || typeof details !== "object") return false;
  return [details.north, details.south].every((detail) =>
    !detail || (
      detail.structure?.data && detail.structure?.info?.channels >= 3 &&
      detail.palette?.data && detail.palette?.info?.channels >= 3 &&
      Number.isFinite(detail.contrast) && detail.contrast >= 0 &&
      detail.contrast <= 1 &&
      Number.isFinite(detail.tint) && detail.tint >= 0 && detail.tint <= 1 &&
      (!Number.isFinite(detail.structureRadius) ||
        (detail.structureRadius > 0 && detail.structureRadius <= 1))
    ));
}

function prepareDetailPlan(detail) {
  const structureStats = imageStatistics(detail.structure, {
    maximumRadius: 0.9,
    minimumLuminance: 3,
  });
  const paletteStats = imageStatistics(detail.palette, {
    maximumRadius: 0.88,
    minimumLuminance: 24,
  });
  const paletteLuminance = luminance(paletteStats.mean);
  return Object.freeze({
    structure: detail.structure,
    structureMean: structureStats.luminanceMean,
    structureDeviation: Math.max(1, structureStats.luminanceDeviation),
    paletteChroma: Object.freeze(paletteStats.mean.map((value) =>
      value / Math.max(1, paletteLuminance))),
    contrast: detail.contrast,
    tint: detail.tint,
    structureRadius: detail.structureRadius ?? 0.9,
  });
}

function injectPolarStructure({
  base,
  sample,
  detailPlan,
  detailWeight,
  edgeStructureWeight,
  structureWeight: explicitStructureWeight,
  tintWeight: explicitTintWeight,
}) {
  const standardizedLuminance = Math.max(-2.4, Math.min(2.4,
    (luminance(sample) - detailPlan.structureMean) /
      detailPlan.structureDeviation));
  const baseLuminance = Math.max(1, luminance(base));
  const structureWeight = explicitStructureWeight ?? (
    edgeStructureWeight + (1 - edgeStructureWeight) * detailWeight
  );
  const luminanceGain = Math.exp(
    standardizedLuminance * detailPlan.contrast * structureWeight,
  );
  const targetLuminance = Math.max(4, Math.min(246,
    baseLuminance * luminanceGain));
  const structured = base.map((value) =>
    value * targetLuminance / baseLuminance);
  const tinted = detailPlan.paletteChroma.map((ratio) =>
    ratio * targetLuminance);
  const tintWeight = explicitTintWeight ?? detailPlan.tint * detailWeight;
  return structured.map((value, channel) => Math.max(0, Math.min(255,
    value * (1 - tintWeight) + tinted[channel] * tintWeight)));
}

function imageStatistics(source, { maximumRadius, minimumLuminance }) {
  const centerX = (source.info.width - 1) / 2;
  const centerY = (source.info.height - 1) / 2;
  const radiusX = Math.max(1, centerX);
  const radiusY = Math.max(1, centerY);
  const stride = Math.max(1, Math.floor(
    Math.min(source.info.width, source.info.height) / 256));
  const mean = [0, 0, 0];
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;
  let count = 0;
  for (let y = 0; y < source.info.height; y += stride) {
    for (let x = 0; x < source.info.width; x += stride) {
      const radius = Math.hypot(
        (x - centerX) / radiusX,
        (y - centerY) / radiusY,
      );
      if (radius > maximumRadius) continue;
      const sample = pixelSample(source, x, y);
      const sampleLuminance = luminance(sample);
      if (sampleLuminance < minimumLuminance) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        mean[channel] += sample[channel];
      }
      luminanceSum += sampleLuminance;
      luminanceSquaredSum += sampleLuminance * sampleLuminance;
      count += 1;
    }
  }
  if (count === 0) throw new Error("Jupiter polar detail has no usable pixels.");
  const luminanceMean = luminanceSum / count;
  return Object.freeze({
    mean: Object.freeze(mean.map((value) => value / count)),
    luminanceMean,
    luminanceDeviation: Math.sqrt(Math.max(0,
      luminanceSquaredSum / count - luminanceMean * luminanceMean)),
  });
}

function luminance(sample) {
  return sample[0] * 0.2126 + sample[1] * 0.7152 + sample[2] * 0.0722;
}

function pixelSample(source, x, y) {
  const index = (y * source.info.width + x) * source.info.channels;
  return [
    source.data[index],
    source.data[index + 1],
    source.data[index + 2],
  ];
}

function smootherStep(value) {
  const amount = Math.max(0, Math.min(1, value));
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

function measuredLongitudeHarmonics(
  source,
  edgeRow,
  inward,
  lookbackRows,
  order,
) {
  const values = new Float64Array(source.info.width * 3);
  const sampleRows = Math.max(2, Math.ceil(lookbackRows) + 1);
  for (let rowIndex = 0; rowIndex < sampleRows; rowIndex += 1) {
    const row = edgeRow + inward * lookbackRows * rowIndex /
      Math.max(1, sampleRows - 1);
    for (let column = 0; column < source.info.width; column += 1) {
      const sample = bilinearSample(source, column, row);
      for (let channel = 0; channel < 3; channel += 1) {
        values[column * 3 + channel] += sample[channel] / sampleRows;
      }
    }
  }
  const coefficients = [0, 1, 2].map(() => Object.freeze({
    cosine: new Float64Array(order + 1),
    sine: new Float64Array(order + 1),
  }));
  for (let channel = 0; channel < 3; channel += 1) {
    for (let column = 0; column < source.info.width; column += 1) {
      coefficients[channel].cosine[0] += values[column * 3 + channel] /
        source.info.width;
    }
    for (let harmonic = 1; harmonic <= order; harmonic += 1) {
      let cosine = 0;
      let sine = 0;
      for (let column = 0; column < source.info.width; column += 1) {
        const angle = column / source.info.width * Math.PI * 2;
        const value = values[column * 3 + channel];
        cosine += value * Math.cos(harmonic * angle);
        sine += value * Math.sin(harmonic * angle);
      }
      const normalized = Math.PI * harmonic / (order + 1);
      const lanczos = Math.sin(normalized) / normalized;
      coefficients[channel].cosine[harmonic] =
        2 * cosine / source.info.width * lanczos;
      coefficients[channel].sine[harmonic] =
        2 * sine / source.info.width * lanczos;
    }
  }
  return Object.freeze({ order, coefficients: Object.freeze(coefficients) });
}

function harmonicSample(plan, angle, radius, maximumOrder = plan.order) {
  return [0, 1, 2].map((channel) => {
    const { cosine, sine } = plan.coefficients[channel];
    let value = cosine[0];
    let radiusPower = radius;
    for (let harmonic = 1;
      harmonic <= Math.min(plan.order, maximumOrder);
      harmonic += 1) {
      value += radiusPower * (
        cosine[harmonic] * Math.cos(harmonic * angle) +
        sine[harmonic] * Math.sin(harmonic * angle)
      );
      radiusPower *= radius;
    }
    return Math.max(0, Math.min(255, value));
  });
}

function bilinearSample(source, sourceX, sourceY) {
  const { width, height, channels } = source.info;
  const floorX = Math.floor(sourceX);
  const x0 = ((floorX % width) + width) % width;
  const x1 = (x0 + 1) % width;
  const floorY = Math.floor(sourceY);
  const y0 = Math.max(0, Math.min(height - 1, floorY));
  const y1 = Math.max(0, Math.min(height - 1, floorY + 1));
  const xAmount = sourceX - floorX;
  const yAmount = sourceY - floorY;
  const sample = (x, y, channel) =>
    source.data[(y * width + x) * channels + channel];
  return [0, 1, 2].map((channel) => {
    const top = sample(x0, y0, channel) * (1 - xAmount) +
      sample(x1, y0, channel) * xAmount;
    const bottom = sample(x0, y1, channel) * (1 - xAmount) +
      sample(x1, y1, channel) * xAmount;
    return top * (1 - yAmount) + bottom * yAmount;
  });
}
