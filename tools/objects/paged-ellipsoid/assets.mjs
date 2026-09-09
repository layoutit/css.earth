import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { readCoraltempAnomaly } from "./sst-anomaly.mjs";
import { verifyPreparedMurImage, writeMurLegend } from "./mur-imagery.mjs";
import { prepareElevationMap, writeElevationLegend } from "./elevation.mjs";
import { prepareNightLightsMap, writeNightLightsLegend } from "./night-lights.mjs";
import { textureTintFactors } from "@layoutit/polycss";
import { cutInteriorPoles } from "./interior-poles.mjs";
import { readMantleTomography, tomographyLegend } from "./tomography.mjs";
import { applyDisplayGamma } from "./display-tone.mjs";


export async function preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory, surfaceRasterPlan, atmosphere, atmosphereModel, raster, mode = 'all' }) {
const { bakeSurfaceRaster, surfacePageUrls } = raster;
const { MATERIAL_FRAMES_PER_SHARD, MATERIAL_TILE_SIZE, prepareAtmosphereMaterialFrame } = atmosphere;
const ATMOSPHERE_MODEL = atmosphereModel;
const PUBLIC_ROOT = publicDirectory;
const surfaceOutputRoot = publicDirectory;
const surfaceQuality = config.surface.quality;
const source = path => resolve(sourceDirectory,path);
const produced = new Set();
const output = path => { produced.add(`${config.publicBase}${path}`); return resolve(publicDirectory,path); };
await mkdir(publicDirectory,{recursive:true});
if (mode === 'interior') {
  await prepareInteriorAssets({ exterior: false });
  return { assets: [...produced].sort() };
}
if (mode !== 'materials') {
  const inputs = new Map();
  const bindings = JSON.parse(await readFile(source('content/lens-bindings.json'), 'utf8'));
  const focusByMap = new Map(bindings.controls.map(lens => [lens.surfacePagePrefix, lens.focus]));
  for (const map of config.surface.maps) {
    let input = source(map.path);
    if (map.scientific) {
      if (map.scientific.kind === "coraltemp-anomaly") {
        const decoded = await readCoraltempAnomaly(input, map.scientific);
        input = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
      } else if (map.scientific.kind === "gebco-elevation") {
        const decoded = await preparePagedSurfaceMap({ config, sourceDirectory, map });
        input = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
        await writeElevationLegend(map.scientific, output(map.scientific.legend.image));
      } else if (map.scientific.kind === "black-marble-radiance") {
        const decoded = await preparePagedSurfaceMap({ config, sourceDirectory, map });
        input = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
        await writeNightLightsLegend(map.scientific, output(map.scientific.legend.image));
      } else if (map.scientific.kind === "gibs-mur-imagery") {
        input = await verifyPreparedMurImage(sourceDirectory, map.scientific);
        await writeMurLegend(sourceDirectory, output("earth-enso-legend.png"));
      } else throw new TypeError("Unknown scientific surface source");
    }
    inputs.set(map.name, input);
    if (mode !== 'thumbnails') await prepareMap(input,map.name,{compositeClouds:map.compositeClouds,displayGamma:map.displayGamma,kernel:map.scientific?"nearest":undefined,webp:map.webp});
  }
  if (mode === 'thumbnails') await prepareInteriorAssets({ exterior: false, thumbnailsOnly: true });
  else if (mode !== 'maps') await prepareInteriorAssets();
  for (const map of config.surface.maps) {
    let input = inputs.get(map.name);
    if (map.compositeClouds || map.displayGamma !== undefined) {
      const preview = await preparePagedSurfaceMap({ config: { ...config, surface: { ...config.surface, width: 2048, height: 1024 } }, sourceDirectory, map });
      input = await sharp(preview.data, { raw: preview.info }).png().toBuffer();
    }
    await prepareLensThumbnail(input,map.thumbnail,focusByMap.get(map.name)?.longitude ?? null,map.thumbnailRegion);
  }
}
if (mode !== 'surfaces' && mode !== 'thumbnails' && mode !== 'maps') await prepareMaterialBanks();
return { assets: [...produced].sort() };
async function prepareMap(input, name, {
  compositeClouds = false, displayGamma, kernel = "lanczos3", webp = {},
} = {}) {
  const { data: preparedData, info } = await preparePagedSurfaceMap({
    config, sourceDirectory, map: { path: input, compositeClouds, displayGamma }, kernel,
  });
  const { width, height } = info;
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
    webp: { quality: surfaceQuality, smartSubsample: true, ...webp },
  });
}


async function writeSphereAssets({ data, width, height, channels, density,
  canonical = false, outputRoot = PUBLIC_ROOT, name, bandCount,
  polarCapBandSpan = 1, projectiveSurface = false,
  longitudeOffsetDegrees, webp, cutaway }) {
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
  if (projectiveSurface) {
    const urls = surfacePageUrls(name, surfaceRasterPlan.pages.length, suffix);
    for (const [page, url] of urls.entries()) {
      const raster = bakeSurfaceRaster(surfaceData, {
        width: surfaceWidth, height: surfaceHeight, channels,
      }, surfaceRasterPlan.cells, surfaceWidth / 1024, page);
      await sharp(raster.data, { raw: raster })
        .webp({ ...webp, alphaQuality: 100 })
        .toFile(output(url.split("/").at(-1)));
    }
  } else {
    const oriented = orientLatitudeBands(surfaceData,
      { width: surfaceWidth, height: surfaceHeight, channels }, bandCount);
    await sharp(oriented, { raw: { width: surfaceWidth, height: surfaceHeight, channels } })
      .webp(webp).toFile(output(`${name}${suffix}.webp`));
  }
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
  if (cutaway) cutInteriorPoles(poles, polarTileSize, cutaway);
  await sharp(poles, { raw: {
      width: polarTileSize * 4,
      height: polarTileSize,
      channels: 4,
    } })
      .webp(cutaway ? { lossless: true } : { ...webp, alphaQuality: 100 })
      .toFile(output(`${name}-poles${suffix}.webp`));
}

function orientLatitudeBands(data, { width, height, channels }, bandCount) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(data) || !Number.isInteger(bandHeight)) {
    throw new Error("Paged ellipsoid latitude texture does not match its prepared band grid.");
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

async function prepareMaterialBanks() {
  const frameCount = config.material.frameCount;
  const columns = Math.sqrt(MATERIAL_FRAMES_PER_SHARD);
  const rows = columns;
  const shardCount = frameCount / MATERIAL_FRAMES_PER_SHARD;
  if (!Number.isInteger(columns) || !Number.isInteger(shardCount)) {
    throw new Error("Paged ellipsoid material shards require a square frame layout.");
  }
  const defaultFrame = Math.round((65 - 40) / 65 * (frameCount - 1));
  for (const role of ["lighting", "atmosphere"]) {
    for (const density of [1, 2]) {
      const suffix = density === 2 ? "@2x" : "";
      const size = MATERIAL_TILE_SIZE * density;
      const gutter = 2 * density;
      const stride = size + gutter * 2;
      const defaultRgba = renderMaterialFrame({
        size,
        scenePitchDegrees: 40,
        role,
        atmosphereModel: ATMOSPHERE_MODEL,
      });
      await sharp(defaultRgba, {
        raw: { width: size, height: size, channels: 4 },
      }).webp({ lossless: true }).toFile(output(
        `${config.namespace}-${role}-default${suffix}.webp`,
      ));
      if (role === "lighting") {
        const shadowlessRgba = renderMaterialFrame({
          size,
          scenePitchDegrees: 40,
          role,
          atmosphereModel: ATMOSPHERE_MODEL,
          shadowless: true,
        });
        await sharp(shadowlessRgba, {
          raw: { width: size, height: size, channels: 4 },
        }).webp({ lossless: true }).toFile(output(
          `${config.namespace}-${role}-shadowless${suffix}.webp`,
        ));
      }
      for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
        const shardWidth = stride * columns;
        const shardHeight = stride * rows;
        const shard = Buffer.alloc(shardWidth * shardHeight * 4);
        for (let frameOffset = 0;
          frameOffset < MATERIAL_FRAMES_PER_SHARD;
          frameOffset += 1) {
          const frameIndex = shardIndex * MATERIAL_FRAMES_PER_SHARD +
            frameOffset;
          const columnIndex = frameOffset % columns;
          const tileRowIndex = Math.floor(frameOffset / columns);
          const scenePitchDegrees = 65 - frameIndex /
            (frameCount - 1) * 65;
          const frame = renderMaterialFrame({
            size,
            scenePitchDegrees,
            phaseFrame: frameIndex,
            role,
            atmosphereModel: ATMOSPHERE_MODEL,
          });
          blitRgba(frame, size, size, shard, shardWidth, shardHeight, {
            left: columnIndex * stride + gutter,
            top: tileRowIndex * stride + gutter,
          });
        }
        await sharp(shard, {
          raw: { width: shardWidth, height: shardHeight, channels: 4 },
        }).webp({ lossless: true }).toFile(output(
          `${config.namespace}-${role}-row-${String(shardIndex).padStart(2, "0")}` +
          `${suffix}.webp`,
        ));
      }
    }
  }
  if (defaultFrame < 0 || defaultFrame >= frameCount) {
    throw new Error("Paged ellipsoid default material frame is invalid.");
  }
}

function renderMaterialFrame({
  size,
  scenePitchDegrees,
  role,
  atmosphereModel,
  shadowless = false,
  phaseFrame,
}) {
  if (role === "atmosphere") {
    return prepareAtmosphereMaterialFrame({ size, frame: phaseFrame, model: atmosphereModel }).data;
  }
  const radius = size * config.material.discRadius;
  const center = (size - 1) / 2;
  const rgba = Buffer.alloc(size * size * 4);
  const radians = Math.PI / 180;
  const screenToObject = (vector) => rotateZ(
    rotateX(
      rotateZ(
        rotateY(vector, scenePitchDegrees * radians),
        -config.geometry.PRESENTATION_NODE_DEGREES * radians,
      ),
      -config.geometry.OBLIQUITY_DEGREES * radians,
    ),
    -config.geometry.MESH_ROTATION_Z * radians,
  );
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const worldLight = normalizeVector(config.material.worldLight);
  const objectLight = shadowless
    ? view
    : normalizeVector(rotateZ(
      rotateX(
        rotateZ(worldLight, -config.geometry.PRESENTATION_NODE_DEGREES * radians),
        -config.geometry.OBLIQUITY_DEGREES * radians,
      ),
      -config.geometry.MESH_ROTATION_Z * radians,
    ));
  const solarTint = config.material.solarTint;
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
      const screenX = (x - center) / radius * config.geometry.EQUATORIAL_RADIUS;
      const screenY = (y - center) / radius * config.geometry.EQUATORIAL_RADIUS;
      const origin = [0, 1, 2].map((axis) =>
        right[axis] * screenX + down[axis] * screenY);
      const hit = intersectEllipsoid(origin, view);
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

    }
  }
  return rgba;
}

function blitRgba(sourceRgba, sourceWidth, sourceHeight, targetRgba,
  targetWidth, targetHeight, { left, top }) {
  if (left < 0 || top < 0 || left + sourceWidth > targetWidth ||
      top + sourceHeight > targetHeight) {
    throw new RangeError("Paged ellipsoid prepared material frame exceeds its shard.");
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

function intersectEllipsoid(origin, direction) {
  const equatorialSquared = config.geometry.EQUATORIAL_RADIUS ** 2;
  const polarSquared = (config.geometry.EQUATORIAL_RADIUS * config.polarRadiusKm / config.equatorialRadiusKm) ** 2;
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

async function prepareInteriorAssets({ exterior = true, thumbnailsOnly = false } = {}) {
  const interior = JSON.parse(await readFile(
    source(config.interiorPath),
    "utf8",
  ));
  validateInteriorSource(interior);
  const tomography = await readMantleTomography(sourceDirectory, interior, config);
  if (tomography && !thumbnailsOnly) {
    const legend = tomographyLegend(tomography.recipe);
    await sharp(legend.data, { raw: legend }).png().toFile(output(tomography.recipe.legend.image));
  }
  if (exterior) await prepareInteriorOuterPoles();
  for (const bank of [{ name: 'interior', tomography: null }, ...(tomography ? [{ name: 'tomography', tomography }] : [])]) {
  const tomography = bank.tomography;
  if (!thumbnailsOnly) {
  for (const layer of interior.layers.slice(1)) {
    if (tomography && layer.id !== 'mantle' && !tomography.recipe.schematicColors?.[layer.id]) continue;
    for (const density of [1, 2]) {
      const width = 1024 * density;
      const height = 512 * density;
      const data = renderInteriorShell(width, height, hexRgb(tomography?.recipe.schematicColors?.[layer.id] ?? layer.color), layer.id === 'mantle' ? tomography : null);
      await writeSphereAssets({
        data,
        width,
        height,
        channels: 3,
        density,
        name: `${config.namespace}-${bank.name}-${layer.id}`,
        bandCount: 8,
        longitudeOffsetDegrees: 0,
        webp: layer.id === 'mantle' && tomography ? tomography.recipe.webp : { lossless: true },
        cutaway: interior.presentation?.cutThroughCenter || layer.innerRadiusKm > 0 ? config.geometry.interiorCutaway : undefined,
      });
    }
  }
  for (const density of [1, 2]) {
    const faceSize = 512 * density;
    const section = renderInteriorSection(interior, faceSize, tomography);
    const suffix = density === 2 ? "@2x" : "";
    await sharp(section, {
      raw: { width: faceSize * 2, height: faceSize, channels: 4 },
    }).webp(tomography ? { ...tomography.recipe.webp, alphaQuality: 100 } : { lossless: true }).toFile(output(
      `${config.namespace}-${bank.name}-section${suffix}.webp`,
    ));
  }
  }
  const thumbnail = renderInteriorThumbnail(interior, 96, tomography);
  await sharp(thumbnail, {
    raw: { width: 96, height: 96, channels: 4 },
  }).webp({ quality: 88, alphaQuality: 100 }).toFile(
    output(`${config.namespace}-view-${bank.name}.webp`),
  );
  }
}

async function prepareInteriorOuterPoles() {
  for (const density of [1, 2]) {
    const width = 2048 * density;
    const height = 1024 * density;
    const { data: base, info } = await sharp(
      source(config.surface.maps[0].path),
    ).resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    applyDisplayGamma(base, config.surface.maps[0].displayGamma);
    const clouded = await prepareCloudComposite(base, {
      width,
      height,
      channels: info.channels,
      config,
      sourceDirectory,
    });
    const lit = prepareObjectLightingMap({
      data: clouded,
      width,
      height,
      channels: info.channels,
    });
    for (const [suffix, data] of [["", clouded], ["-lit", lit]]) await writeSphereAssets({
      data,
      width,
      height,
      channels: info.channels,
      density,
      name: `${config.namespace}-interior-outer${suffix}`,
      projectiveSurface: true,
      bandCount: 16,
      longitudeOffsetDegrees: 0,
      webp: { quality: 88, smartSubsample: true },
      cutaway: config.geometry.interiorCutaway,
    });
  }
}

function prepareObjectLightingMap({ data, width, height, channels }) {
  const output = Buffer.from(data);
  const radians = Math.PI / 180;
  const worldLight = normalizeVector(config.material.worldLight);
  const objectLight = normalizeVector(rotateZ(
    rotateX(
      rotateZ(worldLight, -config.geometry.PRESENTATION_NODE_DEGREES * radians),
      -config.geometry.OBLIQUITY_DEGREES * radians,
    ),
    -config.geometry.MESH_ROTATION_Z * radians,
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

function validateInteriorSource(value) {
  if (value?.schema !== config.interiorSchema ||
      !Number.isFinite(value[config.interiorRadiusKey]) || value[config.interiorRadiusKey] <= 0 ||
      !Array.isArray(value.layers) || value.layers.length !== 4) {
    throw new TypeError("Paged ellipsoid interior source is incompatible.");
  }
  let expectedOuter = value[config.interiorRadiusKey];
  for (const layer of value.layers) {
    if (typeof layer.id !== "string" || !/^#[0-9a-f]{6}$/iu.test(layer.color) ||
        layer.outerRadiusKm !== expectedOuter ||
        !Number.isFinite(layer.innerRadiusKm) || layer.innerRadiusKm < 0 ||
        layer.innerRadiusKm >= layer.outerRadiusKm) {
      throw new TypeError(`Paged ellipsoid interior layer is incompatible: ${layer.id}.`);
    }
    expectedOuter = layer.innerRadiusKm;
  }
  if (expectedOuter !== 0) {
    throw new TypeError("Paged ellipsoid interior layers do not close at the center.");
  }
}

function renderInteriorShell(width, height, color, tomography) {
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
      const sampledColor = tomography?.shellColor(longitude * 180 / Math.PI, latitude * 180 / Math.PI);
      const offset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[offset + channel] = sampledColor ? sampledColor[channel] : Math.round(color[channel] * diffuse);
      }
    }
  }
  return rgb;
}

function renderInteriorSection(interior, faceSize, tomography) {
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
          radius * interior[config.interiorRadiusKey] >= innerRadiusKm &&
          radius * interior[config.interiorRadiusKey] <= outerRadiusKm) ??
          interior.layers.at(-1);
        const scientific = tomography && layer.id === 'mantle';
        const color = scientific ? tomography.sectionColor(face, radius, vertical, horizontal) : hexRgb(tomography?.recipe.schematicColors?.[layer.id] ?? layer.color);
        const radialShade = 0.74 + 0.26 * Math.sqrt(1 - radius * radius);
        const offset = (y * width + face * faceSize + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          rgba[offset + channel] = Math.round(
            color[channel] * (scientific ? 1 : radialShade * faceGains[face]),
          );
        }
        rgba[offset + 3] = 255;
      }
    }
  }
  return rgba;
}

function renderInteriorThumbnail(interior, size, tomography) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radiusPixels = size * 0.46;
  // A wider section makes the data legible in the 14 px list icon without
  // changing the globe's cut geometry or the source layer proportions.
  const halfCutawayDegrees = (interior.presentation?.thumbnailCutawayDegrees ?? 90) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / radiusPixels;
      const dy = (y - center) / radiusPixels;
      const radius = Math.hypot(dx, dy);
      if (radius > 1) continue;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const inCutaway = angle >= -halfCutawayDegrees && angle <= halfCutawayDegrees;
      const layer = interior.layers.find(({ innerRadiusKm, outerRadiusKm }) =>
        radius * interior[config.interiorRadiusKey] >= innerRadiusKm &&
        radius * interior[config.interiorRadiusKey] <= outerRadiusKm) ??
        interior.layers.at(-1);
      const scientific = inCutaway && tomography && layer.id === 'mantle';
      const color = scientific ? tomography.sectionColor(0, radius, -dy, dx)
        : inCutaway ? hexRgb(tomography?.recipe.schematicColors?.[layer.id] ?? layer.color) : [42, 99, 139];
      const shade = 0.64 + 0.36 * Math.sqrt(1 - radius * radius);
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = Math.round(color[channel] * (scientific ? 1 : shade));
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

async function prepareLensThumbnail(input, filename, longitude = null, region = {}) {
  const metadata = await sharp(input).metadata();
  const centerLongitude = region.longitude ?? longitude ?? 0;
  const centerLatitude = region.latitude ?? 0;
  const spanDegrees = region.spanDegrees ?? 90;
  if (!Number.isFinite(centerLongitude) || Math.abs(centerLongitude) > 180 ||
      !Number.isFinite(centerLatitude) || Math.abs(centerLatitude) > 90 ||
      !Number.isFinite(spanDegrees) || spanDegrees <= 0 || spanDegrees > 180) {
    throw new TypeError('Invalid dataset thumbnail region.');
  }
  const cropSize = Math.max(1, Math.round(metadata.height * spanDegrees / 180));
  const size = 96;
  await sharp(input)
    .extract({
      left: Math.max(0, Math.min(metadata.width - cropSize, Math.round((centerLongitude + 180) / 360 * metadata.width - cropSize / 2))),
      top: Math.max(0, Math.min(metadata.height - cropSize, Math.round((90 - centerLatitude) / 180 * metadata.height - cropSize / 2))),
      width: cropSize,
      height: cropSize,
    })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .webp({ quality: 88, effort: 6 })
    .toFile(output(filename));
}



function smoothstep(edge0, edge1, value) {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

}

// Shared interpretation for globe assets and the small sidebar preview.
export async function preparePagedSurfaceMap({ config, sourceDirectory, map, kernel = map.scientific ? "nearest" : "lanczos3" }) {
  const width = config.surface.width;
  const height = config.surface.height;
  if (map.scientific?.kind === "gebco-elevation") return prepareElevationMap({ sourceDirectory, map, width, height });
  if (map.scientific?.kind === "black-marble-radiance") return prepareNightLightsMap({ sourceDirectory, map, width, height });
  const { data, info } = await sharp(Buffer.isBuffer(map.path) ? map.path : resolve(sourceDirectory, map.path))
    .resize(width, height, { fit: "fill", kernel })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  applyDisplayGamma(data, map.displayGamma);
  const preparedData = map.compositeClouds
    ? await prepareCloudComposite(data, {
      width,
      height,
      channels: info.channels, config, sourceDirectory,
    })
    : data;
  return { data: preparedData, info };
}

async function prepareCloudComposite(base, { width, height, channels, config, sourceDirectory }) {
  const { data: clouds, info } = await sharp(resolve(sourceDirectory, config.surface.clouds.path))
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
    const alpha = Math.max(0, Math.min(config.surface.clouds.maximumAlpha, (luminance - config.surface.clouds.threshold) / 255 * config.surface.clouds.scale));
    for (let channel = 0; channel < 3; channel += 1) {
      const cloudColor = config.surface.clouds.color[channel];
      output[targetIndex + channel] = Math.round(
        base[targetIndex + channel] * (1 - alpha) + cloudColor * alpha,
      );
    }
  }
  return output;
}
