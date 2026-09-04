export const MARS_POLAR_OVERLAP = 1.035;
export const MARS_POLAR_INPAINT_RADIUS = 0.2;
const BOUNDARY_ANGULAR_SMOOTHING_DEGREES = 12;

export function prepareMarsPolarAtlas(source, tileSize, {
  boundaryLatitudeDegrees,
  overlap = MARS_POLAR_OVERLAP,
  inpaintRadius = MARS_POLAR_INPAINT_RADIUS,
} = {}) {
  if (!Number.isFinite(boundaryLatitudeDegrees) ||
      boundaryLatitudeDegrees <= 0 || boundaryLatitudeDegrees >= 90) {
    throw new TypeError("Mars polar boundary latitude is invalid.");
  }
  if (!Number.isInteger(tileSize) || tileSize < 2) {
    throw new TypeError("Mars polar tile size is invalid.");
  }
  if (!source?.data || !source?.info || source.info.channels < 3) {
    throw new TypeError("Mars polar source must contain raw RGB channels.");
  }

  const boundaryLatitude = boundaryLatitudeDegrees * Math.PI / 180;
  const width = tileSize * 2;
  const height = tileSize;
  const data = Buffer.alloc(width * height * 4);
  let transparentPixelCount = 0;
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    const north = poleIndex === 1;
    const boundaryProfile = prepareSmoothedBoundaryProfile({
      source,
      north,
      tileSize,
      overlap,
      boundaryLatitude,
      inpaintRadius,
    });
    const centerColor = boundaryProfile.reduce(
      (sums, color) => sums.map((sum, channel) => sum + color[channel]),
      [0, 0, 0],
    ).map((sum) => sum / boundaryProfile.length);

    for (let y = 0; y < tileSize; y += 1) {
      const planeY = (y + 0.5) / tileSize * 2 - 1;
      for (let x = 0; x < tileSize; x += 1) {
        const planeX = (x + 0.5) / tileSize * 2 - 1;
        const radius = Math.hypot(planeX, planeY);
        const destination = (y * width + poleIndex * tileSize + x) * 4;
        if (radius > 1) {
          transparentPixelCount += 1;
          continue;
        }
        const longitude = Math.atan2(planeY, planeX);
        const sourceColor = sampleProjectedSource({
          source,
          north,
          radius,
          longitude,
          overlap,
          boundaryLatitude,
        });
        const boundaryColor = interpolateBoundaryProfile(
          boundaryProfile,
          longitude,
        );
        const inpaintedColor = interpolatePolarInterior({
          centerColor,
          boundaryColor,
          radius,
          inpaintRadius,
        });
        const sourceWeight = boundarySourceWeight(radius, inpaintRadius);
        for (let channel = 0; channel < 3; channel += 1) {
          data[destination + channel] = Math.round(
            inpaintedColor[channel] * (1 - sourceWeight) +
            sourceColor[channel] * sourceWeight,
          );
        }
        data[destination + 3] = 255;
      }
    }
  }

  const inpaintSurfaceRadius = Math.min(
    1,
    inpaintRadius * overlap * Math.cos(boundaryLatitude),
  );
  return Object.freeze({
    data,
    width,
    height,
    transparentPixelRatio: transparentPixelCount / (width * height),
    stabilization: Object.freeze({
      model: "prepared-boundary-guided-polar-inpaint",
      inpaintRadiusRatio: inpaintRadius,
      transitionEndRadiusRatio: 1,
      boundaryAngularSmoothingDegrees: BOUNDARY_ANGULAR_SMOOTHING_DEGREES,
      polewardLatitudeDegrees: Number(
        (Math.acos(inpaintSurfaceRadius) * 180 / Math.PI).toFixed(6),
      ),
      runtimeProjection: false,
    }),
  });
}

function prepareSmoothedBoundaryProfile({
  source,
  north,
  tileSize,
  overlap,
  boundaryLatitude,
  inpaintRadius,
}) {
  const sampleCount = Math.max(256, tileSize * 2);
  const rawProfile = Array.from({ length: sampleCount }, (_, index) => {
    const longitude = index / sampleCount * Math.PI * 2 - Math.PI;
    return sampleProjectedSource({
      source,
      north,
      radius: inpaintRadius,
      longitude,
      overlap,
      boundaryLatitude,
    });
  });
  const smoothingRadius = Math.max(1, Math.round(
    sampleCount * BOUNDARY_ANGULAR_SMOOTHING_DEGREES / 360,
  ));
  return rawProfile.map((_, index) => {
    const sums = [0, 0, 0];
    for (let offset = -smoothingRadius;
      offset <= smoothingRadius;
      offset += 1) {
      const color = rawProfile[
        (index + offset + sampleCount) % sampleCount
      ];
      for (let channel = 0; channel < 3; channel += 1) {
        sums[channel] += color[channel];
      }
    }
    const count = smoothingRadius * 2 + 1;
    return sums.map((sum) => sum / count);
  });
}

function sampleProjectedSource({
  source,
  north,
  radius,
  longitude,
  overlap,
  boundaryLatitude,
}) {
  const surfaceRadius = Math.min(
    1,
    radius * overlap * Math.cos(boundaryLatitude),
  );
  const latitudeMagnitude = Math.acos(surfaceRadius);
  const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
  const sourceX = ((longitude / (Math.PI * 2) + 1) % 1) * source.info.width;
  const sourceY = (Math.PI / 2 - latitude) / Math.PI * source.info.height;
  return bilinearSample(source, sourceX, sourceY);
}

function interpolateBoundaryProfile(profile, longitude) {
  const normalized = ((longitude / (Math.PI * 2) + 1.5) % 1) *
    profile.length;
  const lowerIndex = Math.floor(normalized) % profile.length;
  const upperIndex = (lowerIndex + 1) % profile.length;
  const mix = normalized - Math.floor(normalized);
  return profile[lowerIndex].map((value, channel) =>
    value * (1 - mix) + profile[upperIndex][channel] * mix);
}

function interpolatePolarInterior({
  centerColor,
  boundaryColor,
  radius,
  inpaintRadius,
}) {
  const normalized = Math.min(1, radius / inpaintRadius);
  const boundaryWeight = normalized * normalized * (3 - 2 * normalized);
  return centerColor.map((value, channel) =>
    value * (1 - boundaryWeight) + boundaryColor[channel] * boundaryWeight);
}

function boundarySourceWeight(radius, inpaintRadius) {
  if (radius <= inpaintRadius) return 0;
  if (radius >= 1) return 1;
  const normalized = (radius - inpaintRadius) / (1 - inpaintRadius);
  return normalized * normalized * (3 - 2 * normalized);
}

function bilinearSample(source, sourceX, sourceY) {
  const { width, height, channels } = source.info;
  const sourceFloorX = Math.floor(sourceX);
  const x0 = ((sourceFloorX % width) + width) % width;
  const x1 = (x0 + 1) % width;
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(sourceY)));
  const y1 = Math.min(height - 1, y0 + 1);
  const mixX = sourceX - sourceFloorX;
  const mixY = sourceY - Math.floor(sourceY);
  const sample = (x, y, channel) =>
    source.data[(y * width + x) * channels + channel];
  return [0, 1, 2].map((channel) => {
    const top = sample(x0, y0, channel) * (1 - mixX) +
      sample(x1, y0, channel) * mixX;
    const bottom = sample(x0, y1, channel) * (1 - mixX) +
      sample(x1, y1, channel) * mixX;
    return top * (1 - mixY) + bottom * mixY;
  });
}
