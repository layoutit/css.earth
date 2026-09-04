#!/usr/bin/env node

import { resolve } from "node:path";

import sharp from "sharp";

import { packProjectiveSurfaceRaster } from
  "../../../platform/projective-surface-raster.mjs";

import {
  ensureVenusPreparationDirectories,
  VENUS_PUBLIC_ROOT,
  VENUS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import {
  deriveVenusPreparedMaterial,
  readVenusAtmosphereSource,
} from "./atmosphere-source.mjs";
import { validateVenusSourceGroup } from "./source-manifest.mjs";

const MAP_WIDTH = 1024;
const MAP_HEIGHT = 512;
const LATITUDE_BAND_COUNT = 16;
const POLAR_TILE = 256;
const MATERIAL_TILE_SIZE = 256;
const MATERIAL_LOGICAL_SIZE = 512;
const MATERIAL_DIRECTIONAL_FRAME_COUNT = 31;
const MATERIAL_FRAME_COUNT = 32;
const MATERIAL_FRAME_COLUMNS = 8;
const MATERIAL_FRAME_ROWS = 4;
const MATERIAL_MINIMUM_LIGHT_VIEW_Z = -0.98;
const MATERIAL_MAXIMUM_LIGHT_VIEW_Z = 0.98;
const MATERIAL_BODY_RADIUS = 248;
const MATERIAL_SUPERSAMPLING = 2;
const MATERIAL_CONTENT_SCALE = 0.992;
const MATERIAL_COVERAGE_SCALE = 1.002;
const SURFACE_EXPOSURE_SHOULDER = Object.freeze([1.4, 2.2, 0.9]);
const DIRECTIONAL_SHADOW_RELEASE = 0;
const SHADOWLESS_FLOOD_SHADOW_RELEASE = 0.3;
const SUNWARD_SHADOW_RELEASE_SMOOTHSTEP = Object.freeze([0.45, 0.92]);
const variants = Object.freeze([
  Object.freeze({
    id: "clouds",
    source: resolve(VENUS_SOURCE_ROOT, "surface/venus-clouds.jpg"),
    qualification: "OpenSpace synchronized Venus cloud deck",
  }),
  Object.freeze({
    id: "radar",
    source: resolve(VENUS_SOURCE_ROOT, "surface/venus-magellan-color-wms.png"),
    qualification: "USGS/NASA Magellan C3-MDIR synthetic-color radar mosaic",
  }),
  Object.freeze({
    id: "elevation",
    source: resolve(
      VENUS_SOURCE_ROOT,
      "surface/venus-magellan-topography-wms.png",
    ),
    qualification: "USGS/NASA Magellan C3-MDIR colorized topographic mosaic",
  }),
]);
const starfieldOnly = process.argv.includes("--starfield-only");
const surfacesOnly = process.argv.includes("--surfaces-only");
if (starfieldOnly && surfacesOnly) {
  throw new Error("Choose either --starfield-only or --surfaces-only.");
}

await Promise.all(starfieldOnly ? [
  validateVenusSourceGroup("starfield"),
] : surfacesOnly ? [
  validateVenusSourceGroup("lenses"),
] : [
  validateVenusSourceGroup("scene"),
  validateVenusSourceGroup("lenses"),
  validateVenusSourceGroup("materials"),
]);
await ensureVenusPreparationDirectories();
if (starfieldOnly) {
  await import("./prepare-starfield.mjs");
  console.log(JSON.stringify({ starfieldModes: ["standard", "high"] }));
} else if (surfacesOnly) {
  for (const variant of variants) await prepareVariant(variant);
  console.log(JSON.stringify({ variants: variants.length, densities: [1, 2] }));
} else {
  const atmosphereSource = await readVenusAtmosphereSource();
  const preparedMaterial = deriveVenusPreparedMaterial(atmosphereSource);
  for (const variant of variants) await prepareVariant(variant);
  await Promise.all([
    prepareMaterialAtlases(1, atmosphereSource, preparedMaterial),
    prepareMaterialAtlases(2, atmosphereSource, preparedMaterial),
  ]);
  console.log(JSON.stringify({ variants: variants.length, densities: [1, 2] }));
}

async function prepareVariant(variant) {
  for (const density of [1, 2]) {
    const width = MAP_WIDTH * density;
    const height = MAP_HEIGHT * density;
    let pixels;
    if (variant.id === "clouds") {
      pixels = await sharp(variant.source)
        .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .ensureAlpha()
        .raw()
        .toBuffer();
    } else {
      pixels = await sharp(variant.source)
        .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .sharpen({ sigma: density === 1 ? 0.45 : 0.65 })
        .ensureAlpha()
        .raw()
        .toBuffer();
    }
    applyPreparedSurfaceExposure(pixels);
    const suffix = density === 2 ? "@2x" : "";
    const gutter = Math.max(2, height / LATITUDE_BAND_COUNT / 4);
    const preparedMap = packProjectiveSurfaceRaster(pixels, {
      width,
      height,
      channels: 4,
      bandCount: LATITUDE_BAND_COUNT,
      gutter,
    });
    const mapPath = resolve(VENUS_PUBLIC_ROOT, `venus-${variant.id}${suffix}.webp`);
    await sharp(preparedMap.data, {
      raw: {
        width: preparedMap.packedWidth,
        height: preparedMap.packedHeight,
        channels: 4,
      },
    })
      .webp({ quality: 88, smartSubsample: true, effort: 6 })
      .toFile(mapPath);
    const polar = createPolarSprite(pixels, width, height, POLAR_TILE * density);
    await sharp(polar, {
      raw: {
        width: POLAR_TILE * density * 2,
        height: POLAR_TILE * density,
        channels: 4,
      },
    }).webp({ lossless: true, effort: 6 }).toFile(
      resolve(VENUS_PUBLIC_ROOT, `venus-poles-${variant.id}${suffix}.webp`),
    );
    if (density === 2) {
      await prepareLensTexelThumbnail(
        pixels,
        width,
        height,
        resolve(VENUS_PUBLIC_ROOT, `venus-lens-${variant.id}.webp`),
      );
    }
  }
}

function applyPreparedSurfaceExposure(pixels) {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const shoulder = SURFACE_EXPOSURE_SHOULDER[channel];
      const normalized = pixels[offset + channel] / 255;
      pixels[offset + channel] = Math.round(255 * (
        (1 - Math.exp(-shoulder * normalized)) /
        (1 - Math.exp(-shoulder))
      ));
    }
  }
}

function createPolarSprite(map, width, height, tileSize) {
  const output = Buffer.alloc(tileSize * tileSize * 2 * 4);
  const sampleCount = 4;
  const boundaryLatitude = Math.PI / 2 - Math.PI / 16;
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    const north = poleIndex === 0;
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const targetOffset = (y * tileSize * 2 + poleIndex * tileSize + x) * 4;
        const premultiplied = [0, 0, 0];
        let alpha = 0;
        for (let sampleY = 0; sampleY < 2; sampleY += 1) {
          for (let sampleX = 0; sampleX < 2; sampleX += 1) {
            const unitX = (x + (sampleX + 0.5) / 2) / tileSize * 2 - 1;
            const unitY = (y + (sampleY + 0.5) / 2) / tileSize * 2 - 1;
            const radius = Math.hypot(unitX, unitY);
            if (radius > 1) continue;
            const longitude = modulo(Math.atan2(unitY, unitX), Math.PI * 2);
            const latitudeMagnitude = Math.acos(
              Math.min(1, radius * Math.cos(boundaryLatitude)),
            );
            const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
            const sourceX = longitude / (Math.PI * 2) * width - 0.5;
            const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
            const sampled = samplePolarMap(
              map,
              width,
              height,
              sourceX,
              sourceY,
              radius,
              tileSize,
            );
            const sampleAlpha = sampled[3] / 255;
            alpha += sampleAlpha;
            for (let channel = 0; channel < 3; channel += 1) {
              premultiplied[channel] += sampled[channel] * sampleAlpha;
            }
          }
        }
        if (alpha === 0) continue;
        for (let channel = 0; channel < 3; channel += 1) {
          output[targetOffset + channel] = Math.round(premultiplied[channel] / alpha);
        }
        output[targetOffset + 3] = Math.round(alpha / sampleCount * 255);
      }
    }
  }
  return output;
}

function samplePolarMap(map, width, height, sourceX, sourceY, radius, tileSize) {
  const direct = sampleWrappedBilinearRgba(map, width, height, sourceX, sourceY);
  const poleBlendRadius = 2 / tileSize;
  if (radius >= poleBlendRadius) return direct;
  const average = [0, 0, 0, 0];
  for (let longitudeIndex = 0; longitudeIndex < 32; longitudeIndex += 1) {
    const sample = sampleWrappedBilinearRgba(
      map,
      width,
      height,
      (longitudeIndex + 0.5) / 32 * width - 0.5,
      sourceY,
    );
    for (let channel = 0; channel < 4; channel += 1) average[channel] += sample[channel];
  }
  const directAmount = radius / poleBlendRadius;
  return average.map((sum, channel) =>
    directAmount * direct[channel] + (1 - directAmount) * sum / 32);
}

function sampleWrappedBilinearRgba(map, width, height, sourceX, sourceY) {
  const x0 = Math.floor(sourceX);
  const y = clamp(sourceY, 0, height - 1);
  const y0 = Math.floor(y);
  const y1 = Math.min(height - 1, y0 + 1);
  const x1 = x0 + 1;
  const xAmount = sourceX - x0;
  const yAmount = y - y0;
  return [0, 1, 2, 3].map((channel) => {
    const top = mix(
      map[(y0 * width + modulo(x0, width)) * 4 + channel],
      map[(y0 * width + modulo(x1, width)) * 4 + channel],
      xAmount,
    );
    const bottom = mix(
      map[(y1 * width + modulo(x0, width)) * 4 + channel],
      map[(y1 * width + modulo(x1, width)) * 4 + channel],
      xAmount,
    );
    return mix(top, bottom, yAmount);
  });
}

async function prepareLensTexelThumbnail(map, width, height, outputPath) {
  const size = 64;
  const cropSize = Math.round(height / 2);
  await sharp(map, { raw: { width, height, channels: 4 } })
    .extract({
      left: Math.round((width - cropSize) / 2),
      top: Math.round((height - cropSize) / 2),
      width: cropSize,
      height: cropSize,
    })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .webp({ quality: 88, effort: 6 })
    .toFile(outputPath);
}

async function prepareMaterialAtlases(density, source, model) {
  const tileSize = MATERIAL_TILE_SIZE * density;
  const width = tileSize * MATERIAL_FRAME_COLUMNS;
  const height = tileSize * MATERIAL_FRAME_ROWS;
  const material = Buffer.alloc(width * height * 4);
  const observation = Buffer.alloc(width * height * 4);
  const lighting = Buffer.alloc(width * height * 4);
  for (let frame = 0; frame < MATERIAL_FRAME_COUNT; frame += 1) {
    const shadowlessFlood = frame === MATERIAL_FRAME_COUNT - 1;
    const lightViewZ = shadowlessFlood
      ? 1
      : mix(
        MATERIAL_MINIMUM_LIGHT_VIEW_Z,
        MATERIAL_MAXIMUM_LIGHT_VIEW_Z,
        frame / (MATERIAL_DIRECTIONAL_FRAME_COUNT - 1),
      );
    const lightDirection = shadowlessFlood
      ? Object.freeze([0, 0, 1])
      : Object.freeze([
        -Math.sqrt(Math.max(0, 1 - lightViewZ * lightViewZ)),
        0,
        lightViewZ,
      ]);
    const frameX = frame % MATERIAL_FRAME_COLUMNS * tileSize;
    const frameY = Math.floor(frame / MATERIAL_FRAME_COLUMNS) * tileSize;
    prepareMaterialFrame({
      material,
      observation,
      lighting,
      atlasWidth: width,
      tileSize,
      frameX,
      frameY,
      lightDirection,
      shadowReleaseMaximum: shadowlessFlood
        ? SHADOWLESS_FLOOD_SHADOW_RELEASE
        : DIRECTIONAL_SHADOW_RELEASE,
      source,
      model,
    });
  }
  const suffix = density === 2 ? "@2x" : "";
  await Promise.all([
    writeMaterialAtlas(material, width, height, `venus-material${suffix}.webp`),
    writeMaterialAtlas(
      observation,
      width,
      height,
      `venus-observation-material${suffix}.webp`,
    ),
    writeLightingAtlas(lighting, width, height, `venus-lighting${suffix}.webp`),
  ]);
}

function prepareMaterialFrame({
  material,
  observation,
  lighting,
  atlasWidth,
  tileSize,
  frameX,
  frameY,
  lightDirection,
  shadowReleaseMaximum,
  source,
  model,
}) {
  const logicalScale = tileSize / MATERIAL_LOGICAL_SIZE;
  const bodyRadius = MATERIAL_BODY_RADIUS * logicalScale;
  const sampleCount = MATERIAL_SUPERSAMPLING ** 2;
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const combinedPremultiplied = [0, 0, 0];
      const observationPremultiplied = [0, 0, 0];
      const lightingPremultiplied = [0, 0, 0];
      let combinedAlpha = 0;
      let observationAlpha = 0;
      let lightingAlpha = 0;
      for (let sampleY = 0; sampleY < MATERIAL_SUPERSAMPLING; sampleY += 1) {
        for (let sampleX = 0; sampleX < MATERIAL_SUPERSAMPLING; sampleX += 1) {
          const screenX = (
            x + (sampleX + 0.5) / MATERIAL_SUPERSAMPLING - tileSize / 2
          ) / bodyRadius;
          const screenY = (
            y + (sampleY + 0.5) / MATERIAL_SUPERSAMPLING - tileSize / 2
          ) / bodyRadius;
          const sample = prepareMaterialSample(
            screenX,
            screenY,
            lightDirection,
            shadowReleaseMaximum,
            source,
            model,
          );
          combinedAlpha += sample.combined[3];
          observationAlpha += sample.observation[3];
          lightingAlpha += sample.lighting[3];
          for (let channel = 0; channel < 3; channel += 1) {
            combinedPremultiplied[channel] +=
              sample.combined[channel] * sample.combined[3];
            observationPremultiplied[channel] +=
              sample.observation[channel] * sample.observation[3];
            lightingPremultiplied[channel] +=
              sample.lighting[channel] * sample.lighting[3];
          }
        }
      }
      writeAveragedPixel(
        material,
        ((frameY + y) * atlasWidth + frameX + x) * 4,
        combinedPremultiplied,
        combinedAlpha,
        sampleCount,
      );
      writeAveragedPixel(
        observation,
        ((frameY + y) * atlasWidth + frameX + x) * 4,
        observationPremultiplied,
        observationAlpha,
        sampleCount,
      );
      writeAveragedPixel(
        lighting,
        ((frameY + y) * atlasWidth + frameX + x) * 4,
        lightingPremultiplied,
        lightingAlpha,
        sampleCount,
      );
    }
  }
}

function prepareMaterialSample(
  screenX,
  screenY,
  lightDirection,
  shadowReleaseMaximum,
  source,
  model,
) {
  const displayRadius = Math.hypot(screenX, screenY);
  if (displayRadius > model.outerRadiusScale) {
    return {
      combined: [0, 0, 0, 0],
      observation: [0, 0, 0, 0],
      lighting: [0, 0, 0, 0],
    };
  }
  const sunResponse = source.sunIntensity / (1 + source.sunIntensity);
  let atmosphereAlpha;
  let lightingAlpha = 0;
  let normal;
  if (displayRadius <= MATERIAL_COVERAGE_SCALE) {
    let materialX = screenX / MATERIAL_CONTENT_SCALE;
    let materialY = screenY / MATERIAL_CONTENT_SCALE;
    const materialRadius = Math.hypot(materialX, materialY);
    if (materialRadius > 1) {
      materialX /= materialRadius;
      materialY /= materialRadius;
    }
    const clampedRadius = Math.min(1, materialRadius);
    const viewAlignment = Math.sqrt(Math.max(0, 1 - clampedRadius * clampedRadius));
    normal = [materialX, materialY, viewAlignment];
    const rawLightAlignment = dot(normal, lightDirection);
    const diffuse = Math.max(0, rawLightAlignment) * smoothStep(-0.18, 0.08, rawLightAlignment);
    const ambient = Math.sqrt(source.averageGroundReflectance);
    lightingAlpha = 1 - (ambient + (1 - ambient) * diffuse);
    const sunward = model.nightFloor +
      (1 - model.nightFloor) * Math.sqrt(Math.max(0, rawLightAlignment));
    atmosphereAlpha = Math.pow(
      1 - viewAlignment,
      model.limbExponent,
    ) * model.maximumAlpha * sunward * sunResponse;
  } else {
    const tangent = displayRadius === 0
      ? [0, 0, 0]
      : [screenX / displayRadius, screenY / displayRadius, 0];
    normal = tangent;
    const lightAlignment = Math.max(0, dot(normal, lightDirection));
    const sunward = model.nightFloor +
      (1 - model.nightFloor) * Math.sqrt(lightAlignment);
    const altitudeKm = (displayRadius - 1) * source.planetRadiusKm;
    const rayleighColumn = source.rayleigh.scatteringPerKm.map((coefficient) =>
      coefficient * Math.sqrt(
        2 * Math.PI * (source.planetRadiusKm + altitudeKm) *
          source.rayleigh.scaleHeightKm,
      ) * Math.exp(-altitudeKm / source.rayleigh.scaleHeightKm));
    const mieColumn = source.mie.extinctionPerKm.map((coefficient) =>
      coefficient * Math.sqrt(
        2 * Math.PI * (source.planetRadiusKm + altitudeKm) *
          source.mie.scaleHeightKm,
      ) * Math.exp(-altitudeKm / source.mie.scaleHeightKm));
    const lineOfSightOpacity = mean(rayleighColumn.map(
      (value, channel) => 1 - Math.exp(-(value + mieColumn[channel])),
    ));
    const altitudeFade = 1 - smoothStep(
      model.fadeStartAltitudeKm,
      source.atmosphereHeightKm,
      altitudeKm,
    );
    atmosphereAlpha = lineOfSightOpacity * sunward * sunResponse * altitudeFade;
  }
  if (displayRadius <= MATERIAL_COVERAGE_SCALE) {
    const sunwardShadowRelease = shadowReleaseMaximum * smoothStep(
      SUNWARD_SHADOW_RELEASE_SMOOTHSTEP[0],
      SUNWARD_SHADOW_RELEASE_SMOOTHSTEP[1],
      lightDirection[2],
    );
    lightingAlpha *= 1 - sunwardShadowRelease;
  }
  const combinedAlpha = 1 - (1 - lightingAlpha) * (1 - atmosphereAlpha);
  const atmosphereShare = combinedAlpha === 0 ? 0 : atmosphereAlpha / combinedAlpha;
  const observationAtmosphereAlpha = displayRadius > 1 ? atmosphereAlpha : 0;
  const observationAlpha = 1 -
    (1 - lightingAlpha) * (1 - observationAtmosphereAlpha);
  const observationAtmosphereShare = observationAlpha === 0
    ? 0
    : observationAtmosphereAlpha / observationAlpha;
  return {
    combined: [
      model.color[0] * atmosphereShare,
      model.color[1] * atmosphereShare,
      model.color[2] * atmosphereShare,
      combinedAlpha,
    ],
    observation: [
      model.color[0] * observationAtmosphereShare,
      model.color[1] * observationAtmosphereShare,
      model.color[2] * observationAtmosphereShare,
      observationAlpha,
    ],
    lighting: [0, 0, 0, lightingAlpha],
  };
}

function writeAveragedPixel(output, offset, premultiplied, alpha, sampleCount) {
  if (alpha === 0) return;
  for (let channel = 0; channel < 3; channel += 1) {
    output[offset + channel] = Math.round(premultiplied[channel] / alpha);
  }
  output[offset + 3] = Math.round(alpha / sampleCount * 255);
}

function writeMaterialAtlas(data, width, height, filename) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(resolve(VENUS_PUBLIC_ROOT, filename));
}

function writeLightingAtlas(data, width, height, filename) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .resize(width / 2, height / 2, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ lossless: true, effort: 6 })
    .toFile(resolve(VENUS_PUBLIC_ROOT, filename));
}

function validateSunOracle(oracle) {
  if (oracle.schema !== "cssearth-google-maps-sun-oracle@1" ||
      oracle.asset?.width !== SUN_LOGICAL_SIZE ||
      oracle.asset?.height !== SUN_LOGICAL_SIZE ||
      oracle.rayPeaks?.length !== 24 ||
      oracle.presentation?.sourceTreatment !==
        "3 px source median followed by luminance levels with no radial masking" ||
      oracle.qualification?.redistribution !==
        "exact Google asset retained as a local visual-oracle input; " +
        "redistribution rights are unverified") {
    throw new TypeError("Venus Sun oracle measurements are incompatible.");
  }
}

async function renderPreparedSunPixels(oracle, density) {
  const size = SUN_LOGICAL_SIZE * density;
  const source = await sharp(resolve(
    VENUS_SOURCE_ROOT,
    "sun/google-maps-sun.png",
  )).resize(size, size, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  }).median(SUN_SOURCE_MEDIAN_RADIUS).removeAlpha().raw().toBuffer();
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
          (sourceLuminance - SUN_SOURCE_BLACK_POINT) /
            (255 - SUN_SOURCE_BLACK_POINT),
          0,
          1,
        );
        const preparedLuminance = 255 * Math.pow(
          normalizedLuminance,
          SUN_SOURCE_LEVEL_GAMMA,
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

async function readSunOracle() {
  return JSON.parse(await readFile(
    resolve(VENUS_SOURCE_ROOT, "sun/google-maps-sun-oracle.json"),
    "utf8",
  ));
}

async function prepareStarfield() {
  const catalog = JSON.parse(await readFile(
    resolve(VENUS_SOURCE_ROOT, "stars/hyg-v41-field.json"),
    "utf8",
  ));
  if (catalog.schema !== "cssvenus-prepared-star-cubemap-source@1" ||
      catalog.source?.license !== "CC-BY-SA-4.0" ||
      catalog.presentation?.faceSize !== STARFIELD_FACE_SIZE ||
      catalog.presentation?.selectedStars !== STARFIELD_POINT_COUNT ||
      catalog.presentation?.pointOpacity !== STARFIELD_OPACITY ||
      JSON.stringify(catalog.projection?.faceOrder) !==
        JSON.stringify(STARFIELD_FACE_IDS) ||
      catalog.stars?.length !== STARFIELD_POINT_COUNT) {
    throw new TypeError("Venus starfield source is incompatible.");
  }
  const photo = await sharp(resolve(
    VENUS_SOURCE_ROOT,
    "stars/eso0932a.tif",
  )).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (photo.info.width !== STARFIELD_PHOTO_WIDTH ||
      photo.info.height !== STARFIELD_PHOTO_HEIGHT ||
      photo.info.channels !== 3) {
    throw new TypeError("Venus ESO full-sky photograph is incompatible.");
  }
  const diffusePhoto = await prepareWrappedStarfieldDiffuse(
    photo.data,
    photo.info,
  );
  const basis = equatorialCubemapBasis(catalog.projection);
  const sunOracle = await readSunOracle();
  validateSunOracle(sunOracle);
  for (const density of [1, 2]) {
    const faceSize = STARFIELD_FACE_SIZE * density;
    const sun = await renderPreparedSunPixels(sunOracle, density);
    for (const id of STARFIELD_FACE_IDS) {
      const highContrastPixels = preparePhotographicStarfieldFace(
        id,
        faceSize,
        basis,
        photo.data,
        diffusePhoto,
        photo.info,
      );
      const standardPixels = prepareStandardCubicSkyPixels(
        highContrastPixels,
      );
      for (const pixels of [standardPixels, highContrastPixels]) {
        compositeSunIntoStarfieldFace(
          id,
          pixels,
          sun.pixels,
          sun.size,
          faceSize,
        );
      }
      const suffix = density === 1 ? "" : "@2x";
      await sharp(highContrastPixels, {
        raw: { width: faceSize, height: faceSize, channels: 3 },
      }).webp({ lossless: true, effort: 6 }).toFile(resolve(
        VENUS_PUBLIC_ROOT,
        `venus-starfield-${id}${suffix}.webp`,
      ));
      await sharp(standardPixels, {
        raw: { width: faceSize, height: faceSize, channels: 3 },
      }).webp({ lossless: true, effort: 6 }).toFile(resolve(
        VENUS_PUBLIC_ROOT,
        `venus-starfield-${id}-standard${suffix}.webp`,
      ));
    }
  }
}

function preparePhotographicStarfieldFace(
  face,
  faceSize,
  basis,
  sourcePixels,
  diffusePixels,
  sourceInfo,
) {
  const pixels = Buffer.alloc(faceSize * faceSize * 3);
  const matrix = ICRS_STANDARD_TO_GALACTIC;
  const registration = ESO_CUBEMAP_REGISTRATION_MATRIX;
  for (let y = 0; y < faceSize; y += 1) {
    const v = y / (faceSize - 1) * 2 - 1;
    for (let x = 0; x < faceSize; x += 1) {
      const u = x / (faceSize - 1) * 2 - 1;
      let cameraX;
      let cameraY;
      let cameraZ;
      if (face === "front") [cameraX, cameraY, cameraZ] = [u, v, -1];
      else if (face === "right") [cameraX, cameraY, cameraZ] = [1, v, u];
      else if (face === "back") [cameraX, cameraY, cameraZ] = [-u, v, 1];
      else if (face === "left") [cameraX, cameraY, cameraZ] = [-1, v, -u];
      else if (face === "top") [cameraX, cameraY, cameraZ] = [u, -1, -v];
      else [cameraX, cameraY, cameraZ] = [u, 1, v];
      const cameraLength = Math.hypot(cameraX, cameraY, cameraZ);
      const directionX = cameraX / cameraLength;
      const directionY = cameraY / cameraLength;
      const directionZ = cameraZ / cameraLength;
      const registeredX = registration[0] * directionX +
        registration[1] * directionY + registration[2] * directionZ;
      const registeredY = registration[3] * directionX +
        registration[4] * directionY + registration[5] * directionZ;
      const registeredZ = registration[6] * directionX +
        registration[7] * directionY + registration[8] * directionZ;
      const equatorialX = basis.right[0] * registeredX -
        basis.up[0] * registeredY - basis.forward[0] * registeredZ;
      const equatorialY = basis.right[1] * registeredX -
        basis.up[1] * registeredY - basis.forward[1] * registeredZ;
      const equatorialZ = basis.right[2] * registeredX -
        basis.up[2] * registeredY - basis.forward[2] * registeredZ;
      const standardX = equatorialX;
      const standardY = equatorialZ;
      const standardZ = equatorialY;
      const galacticX = matrix[0] * standardX + matrix[1] * standardY +
        matrix[2] * standardZ;
      const galacticY = matrix[3] * standardX + matrix[4] * standardY +
        matrix[5] * standardZ;
      const galacticZ = clamp(
        matrix[6] * standardX + matrix[7] * standardY +
          matrix[8] * standardZ,
        -1,
        1,
      );
      const galacticLongitude = Math.atan2(galacticY, galacticX);
      const galacticLatitude = Math.asin(galacticZ);
      const sourceX = (Math.PI - galacticLongitude) / (2 * Math.PI) *
        sourceInfo.width - 0.5;
      const sourceY = (Math.PI / 2 - galacticLatitude) / Math.PI *
        sourceInfo.height - 0.5;
      writeLeveledWrappedBilinearRgb(
        pixels,
        (y * faceSize + x) * 3,
        sourcePixels,
        diffusePixels,
        sourceInfo.width,
        sourceInfo.height,
        sourceX,
        sourceY,
      );
    }
  }
  return pixels;
}

function writeLeveledWrappedBilinearRgb(
  target,
  targetOffset,
  source,
  diffuse,
  width,
  height,
  sourceX,
  sourceY,
) {
  const sampled = sampleWrappedBilinearRgb(
    source,
    width,
    height,
    sourceX,
    sourceY,
  );
  const sampledDiffuse = sampleWrappedBilinearRgb(
    diffuse,
    width,
    height,
    sourceX,
    sourceY,
  );
  const [sampledRed, sampledGreen, sampledBlue] = sampled;
  const sourceLuminance = 0.2126 * sampledRed + 0.7152 * sampledGreen +
    0.0722 * sampledBlue;
  const diffuseLuminance = 0.2126 * sampledDiffuse[0] +
    0.7152 * sampledDiffuse[1] + 0.0722 * sampledDiffuse[2];
  const normalizedLuminance = normalizedStarfieldLuminance(sourceLuminance);
  const normalizedDiffuse = normalizedStarfieldLuminance(diffuseLuminance);
  const separatedLuminance = clamp(
    normalizedDiffuse * STARFIELD_PHOTO_DIFFUSE_GAIN +
      (normalizedLuminance - normalizedDiffuse) *
        STARFIELD_PHOTO_DETAIL_GAIN,
    0,
    1,
  );
  const preparedLuminance = Math.pow(
    separatedLuminance,
    STARFIELD_PHOTO_LEVEL_GAMMA,
  ) * 255 * STARFIELD_PHOTO_GAIN;
  const luminanceGain = sourceLuminance === 0
    ? 0
    : preparedLuminance / sourceLuminance;
  target[targetOffset] = Math.round(clamp(sampledRed * luminanceGain, 0, 255));
  target[targetOffset + 1] = Math.round(clamp(
    sampledGreen * luminanceGain,
    0,
    255,
  ));
  target[targetOffset + 2] = Math.round(clamp(
    sampledBlue * luminanceGain,
    0,
    255,
  ));
}

function sampleWrappedBilinearRgb(
  source,
  width,
  height,
  sourceX,
  sourceY,
) {
  const floorX = Math.floor(sourceX);
  const x0 = modulo(floorX, width);
  const x1 = (x0 + 1) % width;
  const y0 = clamp(Math.floor(sourceY), 0, height - 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = sourceX - floorX;
  const ty = sourceY - Math.floor(sourceY);
  const offset00 = (y0 * width + x0) * 3;
  const offset10 = (y0 * width + x1) * 3;
  const offset01 = (y1 * width + x0) * 3;
  const offset11 = (y1 * width + x1) * 3;
  const sampledRed = mix(
    mix(source[offset00], source[offset10], tx),
    mix(source[offset01], source[offset11], tx),
    ty,
  );
  const sampledGreen = mix(
    mix(source[offset00 + 1], source[offset10 + 1], tx),
    mix(source[offset01 + 1], source[offset11 + 1], tx),
    ty,
  );
  const sampledBlue = mix(
    mix(source[offset00 + 2], source[offset10 + 2], tx),
    mix(source[offset01 + 2], source[offset11 + 2], tx),
    ty,
  );
  return [sampledRed, sampledGreen, sampledBlue];
}

function normalizedStarfieldLuminance(luminance) {
  return clamp(
    (luminance - STARFIELD_PHOTO_BLACK_POINT) /
      (255 - STARFIELD_PHOTO_BLACK_POINT),
    0,
    1,
  );
}

async function prepareWrappedStarfieldDiffuse(source, info) {
  const padding = Math.ceil(STARFIELD_PHOTO_DIFFUSE_SIGMA * 4);
  const extendedWidth = info.width + padding * 2;
  const extended = Buffer.alloc(extendedWidth * info.height * info.channels);
  const sourceStride = info.width * info.channels;
  const extendedStride = extendedWidth * info.channels;
  const paddingBytes = padding * info.channels;
  for (let y = 0; y < info.height; y += 1) {
    const sourceRow = y * sourceStride;
    const extendedRow = y * extendedStride;
    source.copy(
      extended,
      extendedRow,
      sourceRow + sourceStride - paddingBytes,
      sourceRow + sourceStride,
    );
    source.copy(
      extended,
      extendedRow + paddingBytes,
      sourceRow,
      sourceRow + sourceStride,
    );
    source.copy(
      extended,
      extendedRow + paddingBytes + sourceStride,
      sourceRow,
      sourceRow + paddingBytes,
    );
  }
  return sharp(extended, {
    raw: {
      width: extendedWidth,
      height: info.height,
      channels: info.channels,
    },
  }).blur(STARFIELD_PHOTO_DIFFUSE_SIGMA).extract({
    left: padding,
    top: 0,
    width: info.width,
    height: info.height,
  }).raw().toBuffer();
}

function compositeSunIntoStarfieldFace(
  faceId,
  face,
  sunPixels,
  sunSize,
  faceSize,
) {
  const projectionWidth = SUN_PRESENTATION_WIDTH / SUN_CANONICAL_FOCAL_PIXELS;
  const projectionHeight = SUN_PRESENTATION_HEIGHT / SUN_CANONICAL_FOCAL_PIXELS;
  const tangentRight = normalize(cross([0, 1, 0], SUN_LOCAL_DIRECTION));
  const tangentUp = normalize(cross(SUN_LOCAL_DIRECTION, tangentRight));
  for (let y = 0; y < faceSize; y += 1) {
      const v = y / (faceSize - 1) * 2 - 1;
      for (let x = 0; x < faceSize; x += 1) {
        const u = x / (faceSize - 1) * 2 - 1;
        const direction = normalize(cubeFaceDirection(faceId, u, v));
        const forward = dot(direction, SUN_LOCAL_DIRECTION);
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
          SUN_PRESENTATION_CORE_GAIN,
          SUN_PRESENTATION_ALPHA_GAIN,
          smoothStep(8, 22, sourceRadius),
        );
        const targetOffset = (y * faceSize + x) * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          const sourceLevel = clamp(sample[channel] * sourceGain, 0, 255);
          face[targetOffset + channel] = Math.round(
            255 - (255 - face[targetOffset + channel]) *
            (255 - sourceLevel) / 255,
          );
        }
      }
  }
}

function sampleBilinearRgba(pixels, width, height, sourceX, sourceY) {
  const x0 = clamp(Math.floor(sourceX), 0, width - 1);
  const y0 = clamp(Math.floor(sourceY), 0, height - 1);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = sourceX - x0;
  const ty = sourceY - y0;
  const output = [];
  for (let channel = 0; channel < 4; channel += 1) {
    const top = mix(
      pixels[(y0 * width + x0) * 4 + channel],
      pixels[(y0 * width + x1) * 4 + channel],
      tx,
    );
    const bottom = mix(
      pixels[(y1 * width + x0) * 4 + channel],
      pixels[(y1 * width + x1) * 4 + channel],
      tx,
    );
    output.push(mix(top, bottom, ty));
  }
  return output;
}

function equatorialCubemapBasis(projection) {
  const rightAscension = projection.centerRaDegrees * Math.PI / 180;
  const declination = projection.centerDecDegrees * Math.PI / 180;
  return Object.freeze({
    forward: normalize([
      Math.cos(declination) * Math.cos(rightAscension),
      Math.sin(declination),
      Math.cos(declination) * Math.sin(rightAscension),
    ]),
    right: normalize([-Math.sin(rightAscension), 0, Math.cos(rightAscension)]),
    up: normalize([
      -Math.sin(declination) * Math.cos(rightAscension),
      Math.cos(declination),
      -Math.sin(declination) * Math.sin(rightAscension),
    ]),
  });
}

function cubeFaceDirection(face, u, v) {
  const directions = {
    front: [u, v, -1],
    right: [1, v, u],
    back: [-u, v, 1],
    left: [-1, v, -u],
    top: [u, -1, -v],
    bottom: [u, 1, v],
  };
  return directions[face];
}

function projectDirectionToCubeFace([x, y, z]) {
  const maximum = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (maximum === Math.abs(z)) {
    return z < 0
      ? { face: "front", u: x / -z, v: y / -z }
      : { face: "back", u: -x / z, v: y / z };
  }
  if (maximum === Math.abs(x)) {
    return x > 0
      ? { face: "right", u: z / x, v: y / x }
      : { face: "left", u: -z / -x, v: y / -x };
  }
  return y < 0
    ? { face: "top", u: x / -y, v: -z / -y }
    : { face: "bottom", u: x / y, v: z / y };
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

function modulo(value, divisor) {
  return (value % divisor + divisor) % divisor;
}
