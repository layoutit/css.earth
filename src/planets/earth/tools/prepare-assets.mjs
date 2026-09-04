#!/usr/bin/env node

import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { textureTintFactors } from "@layoutit/polycss";
import { packProjectiveSurfaceRaster } from
  "../../../platform/projective-surface-raster.mjs";
import {
  EARTH_MATERIAL_FRAMES_PER_SHARD,
  EARTH_MATERIAL_TILE_SIZE,
  readEarthAtmosphereModel,
} from "./atmosphere-model.mjs";
import { validateEarthSourceGroup } from "./source-manifest.mjs";
import { ensureEarthPreparationDirectories, EARTH_PUBLIC_ROOT } from "./preparation-paths.mjs";

sharp.concurrency(2);
const surfacesOnly = process.argv.includes("--surfaces-only");
const materialsOnly = process.argv.includes("--materials-only");
if (surfacesOnly && materialsOnly) {
  throw new TypeError("Earth preparation mode must be singular.");
}
const surfaceQuality = numericArgument("--surface-quality=") ?? 84;
if (![84, 88, 92].includes(surfaceQuality)) {
  throw new RangeError("Earth surface quality must be 84, 88, or 92.");
}
const surfaceOutputArgument = stringArgument("--surface-output-root=");
if (surfaceOutputArgument !== null && !surfacesOnly) {
  throw new TypeError("Earth candidate output requires --surfaces-only.");
}
const [EARTH_ATMOSPHERE_MODEL] = await Promise.all([
  readEarthAtmosphereModel(),
  validateEarthSourceGroup("scene"),
  ...(materialsOnly ? [] : [validateEarthSourceGroup("lenses")]),
  ...(surfacesOnly || materialsOnly ? [] : [
    validateEarthSourceGroup("stars"),
    validateEarthSourceGroup("interior"),
  ]),
]);
await ensureEarthPreparationDirectories();

const source = (path) => resolve(import.meta.dirname, "../source", path);
const output = (path) => resolve(EARTH_PUBLIC_ROOT, path);
const surfaceOutputRoot = surfaceOutputArgument === null
  ? EARTH_PUBLIC_ROOT
  : resolve(process.cwd(), surfaceOutputArgument);
await mkdir(surfaceOutputRoot, { recursive: true });

if (materialsOnly) {
  await prepareEarthMaterialBanks();
} else {
  const surfaceMaps = [
    [source("blue-marble-december.jpg"), "earth-surface", {
      compositeClouds: true,
    }],
    [source("blue-marble-topography.jpg"), "earth-topography"],
    [source("black-marble-2016.jpg"), "earth-night-lights"],
  ];
  for (const [input, name, options] of surfaceMaps) {
    await prepareMap(input, name, options);
  }
  if (surfaceOutputRoot === EARTH_PUBLIC_ROOT) {
    await removeLegacyExteriorDensityAssets();
  }
  if (!surfacesOnly) {
    await Promise.all([
      prepareEarthMaterialBanks(),
      prepareInteriorAssets(),
      prepareStarfield(),
      prepareLensThumbnail(source("blue-marble-december.jpg"), "earth-lens-normal.webp"),
      prepareLensThumbnail(source("blue-marble-topography.jpg"), "earth-lens-topography.webp"),
      prepareLensThumbnail(source("black-marble-2016.jpg"), "earth-lens-night-lights.webp"),
    ]);
  }
}

async function prepareMap(input, name, {
  compositeClouds = false,
} = {}) {
  const width = 8192;
  const height = 4096;
  const { data, info } = await sharp(input)
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const preparedData = compositeClouds
    ? await prepareCloudComposite(data, {
      width,
      height,
      channels: info.channels,
    })
    : data;
  await writeSphereAssets({
    data: preparedData,
    width,
    height,
    channels: info.channels,
    density: 4,
    canonical: true,
    outputRoot: surfaceOutputRoot,
    name,
    bandCount: 16,
    polarCapBandSpan: 1,
    projectiveSurface: true,
    longitudeOffsetDegrees: 0,
    webp: { quality: surfaceQuality, smartSubsample: true },
  });
}

async function removeLegacyExteriorDensityAssets() {
  for (const filename of [
    "earth-surface@2x.webp",
    "earth-surface-poles@2x.webp",
    "earth-topography@2x.webp",
    "earth-topography-poles@2x.webp",
    "earth-night-lights@2x.webp",
    "earth-night-lights-poles@2x.webp",
  ]) await rm(output(filename), { force: true });
}

async function prepareCloudComposite(base, { width, height, channels }) {
  const { data: clouds, info } = await sharp(source("blue-marble-clouds.tif"))
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(base);
  for (let sourceIndex = 0, targetIndex = 0;
    sourceIndex < clouds.length;
    sourceIndex += info.channels, targetIndex += channels) {
    const luminance = clouds[sourceIndex] * 0.2126 +
      clouds[sourceIndex + 1] * 0.7152 + clouds[sourceIndex + 2] * 0.0722;
    const alpha = Math.max(0, Math.min(0.76, (luminance - 12) / 255 * 0.8));
    for (let channel = 0; channel < 3; channel += 1) {
      const cloudColor = channel === 0 ? 245 : channel === 1 ? 250 : 255;
      output[targetIndex + channel] = Math.round(
        base[targetIndex + channel] * (1 - alpha) + cloudColor * alpha,
      );
    }
  }
  return output;
}

async function writeSphereAssets({ data, width, height, channels, density,
  canonical = false, outputRoot = EARTH_PUBLIC_ROOT, name, bandCount,
  polarCapBandSpan = 1, projectiveSurface = false,
  longitudeOffsetDegrees, webp }) {
  const suffix = canonical ? "" : density === 2 ? "@2x" : "";
  let surfaceData = data;
  let surfaceWidth = width;
  let surfaceHeight = height;
  if (projectiveSurface) {
    surfaceWidth = 2048 * density;
    surfaceHeight = 1024 * density;
    if (surfaceWidth !== width || surfaceHeight !== height) {
      surfaceData = await sharp(data, { raw: { width, height, channels } })
        .resize(surfaceWidth, surfaceHeight, { kernel: sharp.kernel.lanczos3 })
        .raw()
        .toBuffer();
    }
  }
  const oriented = projectiveSurface
    ? packProjectiveSurfaceRaster(surfaceData, {
      width: surfaceWidth,
      height: surfaceHeight,
      channels,
      bandCount,
      gutter: surfaceHeight / bandCount / 4,
    })
    : { data: orientLatitudeBands(
      surfaceData,
      { width: surfaceWidth, height: surfaceHeight, channels },
      bandCount,
    ), packedWidth: surfaceWidth, packedHeight: surfaceHeight };
  const polarTileSize = 128 * density * polarCapBandSpan;
  const poles = preparePolarAtlas(data, {
    width,
    height,
    channels,
    tileSize: polarTileSize,
    boundaryLatitudeRadians: Math.PI / 2 -
      Math.PI / bandCount * polarCapBandSpan,
    longitudeOffsetRadians: longitudeOffsetDegrees * Math.PI / 180,
  });
  await Promise.all([
    sharp(oriented.data, { raw: {
      width: oriented.packedWidth,
      height: oriented.packedHeight,
      channels,
    } })
      .webp(webp)
      .toFile(resolve(outputRoot, `${name}${suffix}.webp`)),
    sharp(poles, { raw: {
      width: polarTileSize * 4,
      height: polarTileSize,
      channels: 4,
    } })
      .webp({ ...webp, alphaQuality: 100 })
      .toFile(resolve(outputRoot, `${name}-poles${suffix}.webp`)),
  ]);
}

function stringArgument(prefix) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument === undefined ? null : argument.slice(prefix.length);
}

function numericArgument(prefix) {
  const value = stringArgument(prefix);
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function orientLatitudeBands(data, { width, height, channels }, bandCount) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(data) || !Number.isInteger(bandHeight)) {
    throw new Error("Earth latitude texture does not match its prepared band grid.");
  }
  const output = Buffer.alloc(data.length);
  const rowBytes = width * channels;
  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = band * bandHeight;
    for (let row = 0; row < bandHeight; row += 1) {
      const sourceRow = bandStart + row;
      const outputRow = bandStart + bandHeight - 1 - row;
      data.copy(output, outputRow * rowBytes, sourceRow * rowBytes, (sourceRow + 1) * rowBytes);
    }
  }
  return output;
}

function preparePolarAtlas(data, { width, height, channels, tileSize, boundaryLatitudeRadians, longitudeOffsetRadians }) {
  const output = Buffer.alloc(tileSize * 4 * tileSize * 4);
  const supersampling = 2;
  const sampleCount = supersampling ** 2;
  const tiles = [
    { pole: "north", inner: false },
    { pole: "south", inner: false },
    { pole: "north", inner: true },
    { pole: "south", inner: true },
  ];
  for (const [tile, { pole, inner }] of tiles.entries()) {
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const premultiplied = [0, 0, 0];
        let alphaTotal = 0;
        for (let sampleY = 0; sampleY < supersampling; sampleY += 1) {
          for (let sampleX = 0; sampleX < supersampling; sampleX += 1) {
            const unitX = (x + (sampleX + 0.5) / supersampling) / tileSize * 2 - 1;
            const unitY = (y + (sampleY + 0.5) / supersampling) / tileSize * 2 - 1;
            const radius = Math.hypot(unitX, unitY);
            if (radius > 1) continue;
            const sampleRadius = inner ? 1 : radius;
            const latitudeMagnitude = Math.acos(Math.min(
              1,
              sampleRadius * Math.cos(boundaryLatitudeRadians),
            ));
            const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
            let longitude = Math.atan2(unitY, unitX) - longitudeOffsetRadians;
            longitude = ((longitude % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const sourceX = longitude / (Math.PI * 2) * width - 0.5;
            const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
            const rgba = sampleBilinear(data, { width, height, channels }, sourceX, sourceY);
            const alpha = rgba[3] / 255;
            for (let channel = 0; channel < 3; channel += 1) premultiplied[channel] += rgba[channel] * alpha;
            alphaTotal += alpha;
          }
        }
        const target = (y * tileSize * 4 + tile * tileSize + x) * 4;
        if (alphaTotal > 0) {
          for (let channel = 0; channel < 3; channel += 1) output[target + channel] = Math.round(premultiplied[channel] / alphaTotal);
          output[target + 3] = Math.round(alphaTotal / sampleCount * 255);
        }
      }
    }
  }
  return output;
}

function sampleBilinear(data, { width, height, channels }, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = x0 + 1;
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - Math.floor(y);
  const sample = (sourceX, sourceY, channel) => {
    const wrappedX = ((sourceX % width) + width) % width;
    return data[(sourceY * width + wrappedX) * channels + channel] ?? (channel === 3 ? 255 : 0);
  };
  const rgba = [0, 0, 0, 255];
  for (let channel = 0; channel < 4; channel += 1) {
    if (channel >= channels) continue;
    const top = sample(x0, y0, channel) * (1 - tx) + sample(x1, y0, channel) * tx;
    const bottom = sample(x0, y1, channel) * (1 - tx) + sample(x1, y1, channel) * tx;
    rgba[channel] = Math.round(top * (1 - ty) + bottom * ty);
  }
  return rgba;
}

async function prepareEarthMaterialBanks() {
  const frameCount = 128;
  const columns = Math.sqrt(EARTH_MATERIAL_FRAMES_PER_SHARD);
  const rows = columns;
  const shardCount = frameCount / EARTH_MATERIAL_FRAMES_PER_SHARD;
  if (!Number.isInteger(columns) || !Number.isInteger(shardCount)) {
    throw new Error("Earth material shards require a square frame layout.");
  }
  const defaultFrame = Math.round((65 - 40) / 65 * (frameCount - 1));
  for (const role of ["lighting", "atmosphere"]) {
    for (const density of [1, 2]) {
      const suffix = density === 2 ? "@2x" : "";
      const size = EARTH_MATERIAL_TILE_SIZE * density;
      const gutter = 2 * density;
      const stride = size + gutter * 2;
      const defaultRgba = renderEarthMaterialFrame({
        size,
        scenePitchDegrees: 40,
        role,
        atmosphereModel: EARTH_ATMOSPHERE_MODEL,
      });
      await sharp(defaultRgba, {
        raw: { width: size, height: size, channels: 4 },
      }).webp({ lossless: true }).toFile(output(
        `earth-${role}-default${suffix}.webp`,
      ));
      if (role === "lighting") {
        const shadowlessRgba = renderEarthMaterialFrame({
          size,
          scenePitchDegrees: 40,
          role,
          atmosphereModel: EARTH_ATMOSPHERE_MODEL,
          shadowless: true,
        });
        await sharp(shadowlessRgba, {
          raw: { width: size, height: size, channels: 4 },
        }).webp({ lossless: true }).toFile(output(
          `earth-${role}-shadowless${suffix}.webp`,
        ));
      }
      for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
        const shardWidth = stride * columns;
        const shardHeight = stride * rows;
        const shard = Buffer.alloc(shardWidth * shardHeight * 4);
        for (let frameOffset = 0;
          frameOffset < EARTH_MATERIAL_FRAMES_PER_SHARD;
          frameOffset += 1) {
          const frameIndex = shardIndex * EARTH_MATERIAL_FRAMES_PER_SHARD +
            frameOffset;
          const columnIndex = frameOffset % columns;
          const tileRowIndex = Math.floor(frameOffset / columns);
          const scenePitchDegrees = 65 - frameIndex /
            (frameCount - 1) * 65;
          const frame = renderEarthMaterialFrame({
            size,
            scenePitchDegrees,
            role,
            atmosphereModel: EARTH_ATMOSPHERE_MODEL,
          });
          blitRgba(frame, size, size, shard, shardWidth, shardHeight, {
            left: columnIndex * stride + gutter,
            top: tileRowIndex * stride + gutter,
          });
        }
        await sharp(shard, {
          raw: { width: shardWidth, height: shardHeight, channels: 4 },
        }).webp({ lossless: true }).toFile(output(
          `earth-${role}-row-${String(shardIndex).padStart(2, "0")}` +
          `${suffix}.webp`,
        ));
      }
    }
  }
  await removeObsoleteMaterialRows(shardCount, frameCount);
  if (defaultFrame < 0 || defaultFrame >= frameCount) {
    throw new Error("Earth default material frame is invalid.");
  }
}

async function removeObsoleteMaterialRows(firstObsoleteRow, previousRowCount) {
  for (const role of ["lighting", "atmosphere"]) {
    for (const density of [1, 2]) {
      const suffix = density === 2 ? "@2x" : "";
      for (let rowIndex = firstObsoleteRow;
        rowIndex < previousRowCount;
        rowIndex += 1) {
        await rm(output(
          `earth-${role}-row-${String(rowIndex).padStart(2, "0")}` +
          `${suffix}.webp`,
        ), { force: true });
      }
    }
  }
}

function renderEarthMaterialFrame({
  size,
  scenePitchDegrees,
  role,
  atmosphereModel,
  shadowless = false,
}) {
  const radius = size * 0.468;
  const center = (size - 1) / 2;
  const rgba = Buffer.alloc(size * size * 4);
  const radians = Math.PI / 180;
  const screenToObject = (vector) => rotateZ(
    rotateX(
      rotateZ(
        rotateY(vector, scenePitchDegrees * radians),
        60 * radians,
      ),
      -23.4 * radians,
    ),
    -128 * radians,
  );
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const worldLight = normalizeVector([0.883835, -0.385595, 0.264864]);
  const objectLight = shadowless
    ? view
    : normalizeVector(rotateZ(
      rotateX(
        rotateZ(worldLight, 60 * radians),
        -23.4 * radians,
      ),
      -128 * radians,
    ));
  const solarTint = "#fff1ea";
  const maximumTint = textureTintFactors(
    Math.PI,
    solarTint,
    solarTint,
    0.05 * Math.PI,
  );
  const maximumLightingFactor = Math.max(
    maximumTint.r,
    maximumTint.g,
    maximumTint.b,
  );
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const screenX = (x - center) / radius * 230;
      const screenY = (y - center) / radius * 230;
      const origin = [0, 1, 2].map((axis) =>
        right[axis] * screenX + down[axis] * screenY);
      const hit = intersectViewRayWithEarth(origin, view);
      if (!hit) continue;
      const lightAlignment = dotVector(hit.normal, objectLight);
      const lambert = Math.max(0, lightAlignment);
      if (role === "lighting") {
        const diffuse = lambert * smoothstep(0, 0.1, lambert);
        const tint = textureTintFactors(
          Math.PI * diffuse,
          solarTint,
          solarTint,
          0.05 * Math.PI,
        );
        const lightingFactor = Math.max(tint.r, tint.g, tint.b) /
          maximumLightingFactor;
        const desiredChannel = applyLinearTint(160, lightingFactor);
        rgba[offset + 3] = Math.round(Math.max(
          0,
          Math.min(0.93, 1 - desiredChannel / 160),
        ) * 255);
        continue;
      }
      const atmosphere = preparedAtmosphereTexel({
        normal: hit.normal,
        view,
        objectLight,
        lightAlignment,
        model: atmosphereModel,
      });
      rgba[offset] = atmosphere.r;
      rgba[offset + 1] = atmosphere.g;
      rgba[offset + 2] = atmosphere.b;
      rgba[offset + 3] = atmosphere.a;
    }
  }
  return rgba;
}

function preparedAtmosphereTexel({
  normal,
  view,
  objectLight,
  lightAlignment,
  model,
}) {
  if (model?.schema !== "cssearth-openspace-atmosphere-source@1") {
    throw new TypeError("Earth atmosphere model is incompatible.");
  }
  const response = model.presentationResponse;
  if (response?.schema !==
      "cssearth-google-earth-pro-atmosphere-presentation-response@1") {
    throw new TypeError("Earth atmosphere presentation response is incompatible.");
  }
  const observed = response.observedResponse;
  const transfer = response.cleanRoomTransfer;
  const viewAlignment = Math.max(0, dotVector(normal, view));
  const rayleighHorizon = Math.sqrt(
    2 * model.rayleigh.scaleHeightKm / model.planetRadiusKm,
  );
  const mieHorizon = Math.sqrt(
    2 * model.mie.scaleHeightKm / model.planetRadiusKm,
  );
  const rayleighAirMass = 1 / Math.sqrt(
    viewAlignment ** 2 + rayleighHorizon ** 2,
  );
  const mieAirMass = 1 / Math.sqrt(
    viewAlignment ** 2 + mieHorizon ** 2,
  );
  const rayleigh = model.rayleigh.scatteringPerKm.map((coefficient) =>
    1 - Math.exp(
      -coefficient * model.rayleigh.scaleHeightKm * rayleighAirMass,
    ));
  const mie = model.mie.scatteringPerKm.map((coefficient) =>
    1 - Math.exp(
      -coefficient * model.mie.scaleHeightKm * mieAirMass,
    ));
  const scatteringAlignment = clamp(dotVector(objectLight, view), -1, 1);
  const rayleighPhase = 0.75 * (1 + scatteringAlignment ** 2);
  const g = model.mie.anisotropy;
  const miePhase = (1 - g ** 2) / Math.pow(
    1 + g ** 2 - 2 * g * scatteringAlignment,
    1.5,
  );
  const signal = rayleigh.map((value, channel) =>
    value * rayleighPhase +
      mie[channel] * miePhase * transfer.mieContribution);
  const twilightCosine = Math.sqrt(
    2 * model.atmosphereHeightKm / model.planetRadiusKm,
  );
  const sunlight = smoothstep(
    -twilightCosine,
    twilightCosine,
    lightAlignment,
  );
  const color = signal.map((value) => 1 - Math.exp(
    -value * sunlight * model.sunIntensity * observed.exposure,
  ));
  const luminance = color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11;
  const limb = clamp(rayleighAirMass * rayleighHorizon, 0, 1);
  const alpha = clamp(
    luminance * observed.skyAlphaLuminanceScale * limb,
    0,
    transfer.earthMaximumOpacity,
  );
  return {
    r: Math.round(color[0] * 255),
    g: Math.round(color[1] * 255),
    b: Math.round(color[2] * 255),
    a: Math.round(alpha * 255),
  };
}

function blitRgba(sourceRgba, sourceWidth, sourceHeight, targetRgba,
  targetWidth, targetHeight, { left, top }) {
  if (left < 0 || top < 0 || left + sourceWidth > targetWidth ||
      top + sourceHeight > targetHeight) {
    throw new RangeError("Earth prepared material frame exceeds its shard.");
  }
  const rowBytes = sourceWidth * 4;
  for (let row = 0; row < sourceHeight; row += 1) {
    sourceRgba.copy(
      targetRgba,
      ((top + row) * targetWidth + left) * 4,
      row * rowBytes,
      (row + 1) * rowBytes,
    );
  }
}

function intersectViewRayWithEarth(origin, direction) {
  const equatorialSquared = 230 ** 2;
  const polarSquared = (230 * 6356.752 / 6378.137) ** 2;
  const coefficientA =
    (direction[0] ** 2 + direction[1] ** 2) / equatorialSquared +
    direction[2] ** 2 / polarSquared;
  const coefficientB = 2 * (
    (origin[0] * direction[0] + origin[1] * direction[1]) /
      equatorialSquared +
    origin[2] * direction[2] / polarSquared
  );
  const coefficientC =
    (origin[0] ** 2 + origin[1] ** 2) / equatorialSquared +
    origin[2] ** 2 / polarSquared - 1;
  const discriminant = coefficientB ** 2 - 4 * coefficientA * coefficientC;
  if (!Number.isFinite(discriminant) || discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [
    (-coefficientB - root) / (2 * coefficientA),
    (-coefficientB + root) / (2 * coefficientA),
  ].map((distance) => {
    const position = [0, 1, 2].map((axis) =>
      origin[axis] + direction[axis] * distance);
    const normal = normalizeVector([
      position[0] / equatorialSquared,
      position[1] / equatorialSquared,
      position[2] / polarSquared,
    ]);
    return { position, normal, visibility: dotVector(normal, direction) };
  });
  return candidates[0].visibility >= candidates[1].visibility
    ? candidates[0]
    : candidates[1];
}

function dotVector(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function rotateX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

function applyLinearTint(channel, factor) {
  const srgb = channel / 255;
  const linear = srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
  const lit = Math.max(0, Math.min(1, linear * factor));
  const encoded = lit <= 0.0031308
    ? lit * 12.92
    : 1.055 * Math.pow(lit, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

async function prepareInteriorAssets() {
  const interior = JSON.parse(await readFile(
    source("interior/earth-interior.json"),
    "utf8",
  ));
  validateInteriorSource(interior);
  await prepareInteriorOuterPoles();
  for (const layer of interior.layers.slice(1)) {
    for (const density of [1, 2]) {
      const width = 1024 * density;
      const height = 512 * density;
      const data = renderInteriorShell(width, height, hexRgb(layer.color));
      await writeSphereAssets({
        data,
        width,
        height,
        channels: 3,
        density,
        name: `earth-interior-${layer.id}`,
        bandCount: 8,
        longitudeOffsetDegrees: 0,
        webp: { lossless: true },
      });
    }
  }
  for (const density of [1, 2]) {
    const faceSize = 512 * density;
    const section = renderInteriorSection(interior, faceSize);
    const suffix = density === 2 ? "@2x" : "";
    await sharp(section, {
      raw: { width: faceSize * 2, height: faceSize, channels: 4 },
    }).webp({ lossless: true }).toFile(output(
      `earth-interior-section${suffix}.webp`,
    ));
  }
  const thumbnail = renderInteriorThumbnail(interior, 96);
  await sharp(thumbnail, {
    raw: { width: 96, height: 96, channels: 4 },
  }).webp({ quality: 88, alphaQuality: 100 }).toFile(
    output("earth-view-interior.webp"),
  );
}

async function prepareInteriorOuterPoles() {
  for (const density of [1, 2]) {
    const width = 2048 * density;
    const height = 1024 * density;
    const { data: base, info } = await sharp(
      source("blue-marble-december.jpg"),
    ).resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const clouded = await prepareCloudComposite(base, {
      width,
      height,
      channels: info.channels,
    });
    const data = prepareEarthObjectLightingMap({
      data: clouded,
      width,
      height,
      channels: info.channels,
    });
    await writeSphereAssets({
      data,
      width,
      height,
      channels: info.channels,
      density,
      name: "earth-interior-outer",
      bandCount: 16,
      longitudeOffsetDegrees: 0,
      webp: { quality: 88, smartSubsample: true },
    });
    const tileSize = 128 * density;
    const poles = preparePolarAtlas(data, {
      width,
      height,
      channels: info.channels,
      tileSize,
      boundaryLatitudeRadians: Math.PI / 2 - Math.PI / 16,
      longitudeOffsetRadians: 0,
    });
    for (let tile = 0; tile < 2; tile += 1) {
      for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
          const unitX = (x + 0.5) / tileSize * 2 - 1;
          const unitY = (y + 0.5) / tileSize * 2 - 1;
          const longitude = Math.atan2(unitY, unitX) * 180 / Math.PI;
          if (angularDistance(longitude, -56.25) <= 56.25) {
            poles[(y * tileSize * 4 + tile * tileSize + x) * 4 + 3] = 0;
          }
        }
      }
    }
    const suffix = density === 2 ? "@2x" : "";
    await sharp(poles, {
      raw: { width: tileSize * 4, height: tileSize, channels: 4 },
    }).webp({ lossless: true }).toFile(output(
      `earth-interior-outer-poles${suffix}.webp`,
    ));
  }
}

function prepareEarthObjectLightingMap({ data, width, height, channels }) {
  const output = Buffer.from(data);
  const radians = Math.PI / 180;
  const worldLight = normalizeVector([0.883835, -0.385595, 0.264864]);
  const objectLight = normalizeVector(rotateZ(
    rotateX(
      rotateZ(worldLight, 60 * radians),
      -23.4 * radians,
    ),
    -128 * radians,
  ));
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const latitudeRadius = Math.cos(latitude);
    for (let x = 0; x < width; x += 1) {
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const normal = [
        latitudeRadius * Math.cos(longitude),
        latitudeRadius * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const lambert = Math.max(0, dotVector(normal, objectLight));
      const factor = 0.12 + 0.88 * lambert * smoothstep(0, 0.1, lambert);
      const offset = (y * width + x) * channels;
      for (let channel = 0; channel < 3; channel += 1) {
        output[offset + channel] = applyLinearTint(data[offset + channel], factor);
      }
    }
  }
  return output;
}

function angularDistance(left, right) {
  return Math.abs(((left - right + 180) % 360 + 360) % 360 - 180);
}

function validateInteriorSource(value) {
  if (value?.schema !== "cssearth-earth-interior-source@1" ||
      !Number.isFinite(value.earthRadiusKm) || value.earthRadiusKm <= 0 ||
      !Array.isArray(value.layers) || value.layers.length !== 4) {
    throw new TypeError("Earth interior source is incompatible.");
  }
  let expectedOuter = value.earthRadiusKm;
  for (const layer of value.layers) {
    if (typeof layer.id !== "string" || !/^#[0-9a-f]{6}$/iu.test(layer.color) ||
        layer.outerRadiusKm !== expectedOuter ||
        !Number.isFinite(layer.innerRadiusKm) || layer.innerRadiusKm < 0 ||
        layer.innerRadiusKm >= layer.outerRadiusKm) {
      throw new TypeError(`Earth interior layer is incompatible: ${layer.id}.`);
    }
    expectedOuter = layer.innerRadiusKm;
  }
  if (expectedOuter !== 0) {
    throw new TypeError("Earth interior layers do not close at the center.");
  }
}

function renderInteriorShell(width, height, color) {
  const rgb = Buffer.alloc(width * height * 3);
  const light = normalizeVector([0.72, -0.38, 0.58]);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const latitudeRadius = Math.cos(latitude);
    for (let x = 0; x < width; x += 1) {
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const normal = [
        latitudeRadius * Math.cos(longitude),
        latitudeRadius * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const diffuse = 0.46 + 0.54 * Math.max(0, dotVector(normal, light));
      const offset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[offset + channel] = Math.round(color[channel] * diffuse);
      }
    }
  }
  return rgb;
}

function renderInteriorSection(interior, faceSize) {
  const width = faceSize * 2;
  const rgba = Buffer.alloc(width * faceSize * 4);
  const faceGains = [0.86, 1];
  for (let face = 0; face < 2; face += 1) {
    for (let y = 0; y < faceSize; y += 1) {
      const vertical = 1 - (y + 0.5) / faceSize * 2;
      for (let x = 0; x < faceSize; x += 1) {
        const horizontal = (x + 0.5) / faceSize;
        const radius = Math.hypot(horizontal, vertical);
        if (radius > 1) continue;
        const layer = interior.layers.find(({ innerRadiusKm, outerRadiusKm }) =>
          radius * interior.earthRadiusKm >= innerRadiusKm &&
          radius * interior.earthRadiusKm <= outerRadiusKm) ??
          interior.layers.at(-1);
        const color = hexRgb(layer.color);
        const radialShade = 0.74 + 0.26 * Math.sqrt(1 - radius * radius);
        const offset = (y * width + face * faceSize + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          rgba[offset + channel] = Math.round(
            color[channel] * radialShade * faceGains[face],
          );
        }
        rgba[offset + 3] = 255;
      }
    }
  }
  return rgba;
}

function renderInteriorThumbnail(interior, size) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radiusPixels = size * 0.46;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / radiusPixels;
      const dy = (y - center) / radiusPixels;
      const radius = Math.hypot(dx, dy);
      if (radius > 1) continue;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const inCutaway = angle >= -45 && angle <= 45;
      const layer = interior.layers.find(({ innerRadiusKm, outerRadiusKm }) =>
        radius * interior.earthRadiusKm >= innerRadiusKm &&
        radius * interior.earthRadiusKm <= outerRadiusKm) ??
        interior.layers.at(-1);
      const color = inCutaway ? hexRgb(layer.color) : [42, 99, 139];
      const shade = 0.64 + 0.36 * Math.sqrt(1 - radius * radius);
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = Math.round(color[channel] * shade);
      }
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function hexRgb(value) {
  return [1, 3, 5].map((offset) => Number.parseInt(
    value.slice(offset, offset + 2),
    16,
  ));
}

async function prepareStarfield() {
  const csv = await readFile(source("stars/hygdata_v41.csv"), "utf8");
  const stars = csv.split("\n").slice(1).map((line) => {
    const cells = line.split(",").map((value) => value.replace(/^"|"$/gu, ""));
    return { ra: Number(cells[7]), dec: Number(cells[8]), mag: Number(cells[13]), ci: Number(cells[16]) };
  }).filter(({ ra, dec, mag }) => Number.isFinite(ra) && Number.isFinite(dec) && Number.isFinite(mag) && mag <= 6.8)
    .sort((left, right) => left.mag - right.mag)
    .slice(0, 1800);
  if (stars.length !== 1800) throw new Error(`HYG Earth star selection contains ${stars.length} entries.`);
  const width = 1920;
  const height = 1080;
  const rgb = Buffer.alloc(width * height * 3);
  for (const star of stars) {
    const x = Math.max(0, Math.min(width - 1, Math.round((star.ra / 24) * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round(((90 - star.dec) / 180) * (height - 1))));
    const intensity = Math.max(96, Math.min(255, Math.round(255 - (star.mag + 1.5) * 23)));
    const radius = star.mag < 1 ? 2 : star.mag < 3 ? 1 : 0;
    const tint = starColor(star.ci);
    for (let oy = -radius; oy <= radius; oy += 1) for (let ox = -radius; ox <= radius; ox += 1) {
      const px = x + ox;
      const py = y + oy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const falloff = ox === 0 && oy === 0 ? 1 : 0.42;
      const offset = (py * width + px) * 3;
      for (let channel = 0; channel < 3; channel += 1) rgb[offset + channel] = Math.max(rgb[offset + channel], Math.round(intensity * tint[channel] * falloff));
    }
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } })
    .webp({ quality: 82, smartSubsample: true })
    .toFile(output("earth-starfield.webp"));
}

async function prepareLensThumbnail(input, filename) {
  const metadata = await sharp(input).metadata();
  const cropSize = Math.round(metadata.height / 2);
  const size = 96;
  await sharp(input)
    .extract({
      left: Math.round((metadata.width - cropSize) / 2),
      top: Math.round((metadata.height - cropSize) / 2),
      width: cropSize,
      height: cropSize,
    })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .webp({ quality: 88, effort: 6 })
    .toFile(output(filename));
}

function starColor(ci) {
  if (!Number.isFinite(ci)) return [0.92, 0.95, 1];
  const red = Math.max(0.72, Math.min(1, 0.94 + ci * 0.08));
  const blue = Math.max(0.72, Math.min(1, 1 - ci * 0.12));
  return [red, 0.94, blue];
}

function smoothstep(edge0, edge1, value) {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
