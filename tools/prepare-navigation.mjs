#!/usr/bin/env node

import { mkdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  NAVIGATION_BLACKHOLE_SOURCE,
  NAVIGATION_DOWNLOAD_SOURCE,
  NAVIGATION_GITHUB_SOURCE,
  NAVIGATION_SETTINGS_SOURCE,
  NAVIGATION_SHARE_SOURCE,
  NAVIGATION_SUN_SOURCE,
  NAVIGATION_SUPERNOVA_SOURCE,
  PLANNED_MARKER_DESCRIPTORS,
} from "../src/navigation/marker-descriptors.mjs";
import {
  renderMarker,
  validateMarkerDescriptor,
  validateMarkerSourceBytes,
} from "../src/navigation/marker-recipe.mjs";
import { OBJECTS } from "../site/objects.mjs";
import { optimizePreparedQ75Webp } from "./prepared-webp.mjs";

const markerTileSize = 16;
const PLANET_MARKER_PLANETS = Object.freeze(
  OBJECTS.filter(({ id }) => id !== "sun")
    .toSorted((left, right) => left.distanceAu - right.distanceAu),
);
const IMPLEMENTED_PLANET_IDS = new Set(OBJECTS.map(({ id }) => id));

export async function loadMarkerDescriptors({
  planets = PLANET_MARKER_PLANETS,
  projectRoot = resolve(import.meta.dirname, ".."),
} = {}) {
  const planned = new Map(PLANNED_MARKER_DESCRIPTORS.map((descriptor) =>
    [descriptor.planetId, descriptor]));
  const descriptors = [];
  for (const planet of planets) {
    const descriptor = IMPLEMENTED_PLANET_IDS.has(planet.id)
      ? await loadObjectDescriptor(planet.id, projectRoot)
      : planned.get(planet.id);
    if (!descriptor) {
      throw new Error(`Navigation marker descriptor is missing: ${planet.id}.`);
    }
    validateMarkerDescriptor(descriptor);
    if (descriptor.planetId !== planet.id) {
      throw new Error(`Navigation marker identity drifted: ${planet.id}.`);
    }
    descriptors.push(descriptor);
  }
  if (new Set(descriptors.map(({ planetId }) => planetId)).size !== planets.length) {
    throw new Error("Navigation marker descriptors are not unique.");
  }
  return Object.freeze(descriptors);
}

export async function prepareNavigation({
  projectRoot = resolve(import.meta.dirname, ".."),
  outputRoot = resolve(projectRoot, "public/navigation"),
  planets = PLANET_MARKER_PLANETS,
} = {}) {
  const navigationSourceRoot = resolve(projectRoot, "src/navigation/source");
  const descriptors = await loadMarkerDescriptors({ planets, projectRoot });
  await mkdir(outputRoot, { recursive: true });
  await Promise.all(descriptors.map(({ planetId }) =>
    unlink(resolve(outputRoot, `${planetId}.webp`)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    })));

  for (const density of [1, 2]) {
    const tileSize = markerTileSize * density;
    const tiles = [];
    for (let index = 0; index < descriptors.length; index += 1) {
      const descriptor = descriptors[index];
      const sourcePath = descriptor.owner === "object"
        ? resolve(
            projectRoot,
            "src/planets",
            descriptor.planetId,
            "source",
            descriptor.source.path,
          )
        : resolve(navigationSourceRoot, descriptor.source.path);
      tiles.push({
        input: await renderMarker(descriptor, { sourcePath, tileSize }),
        left: index * tileSize,
        top: 0,
      });
    }
    const outputPath = resolve(
      outputRoot,
      `planet-markers${density === 2 ? "@2x" : ""}.webp`,
    );
    await sharp({
      create: {
        width: tileSize * descriptors.length,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(tiles)
      .webp({ lossless: true, effort: 6 })
      .toFile(outputPath);
    await optimizePreparedQ75Webp(outputPath);
  }

  const sunSourcePath = resolve(navigationSourceRoot, NAVIGATION_SUN_SOURCE.path);
  const sunSource = await validateMarkerSourceBytes(
    NAVIGATION_SUN_SOURCE,
    sunSourcePath,
  );
  for (const density of [1, 2]) {
    const tileSize = 48 * density;
    const sunSize = 28 * density;
    const sunMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sunSize}" height="${sunSize}">` +
      `<circle cx="${sunSize / 2}" cy="${sunSize / 2}" ` +
      `r="${13 * density}" fill="white"/>` +
      "</svg>",
    );
    const sun = await sharp(sunSource)
      .trim({ threshold: 10 })
      .resize(sunSize, sunSize, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      })
      .greyscale()
      .blur(0.9 * density)
      .linear(0.58, 78)
      .tint("#e6a436")
      .modulate({ brightness: 1.12 })
      .ensureAlpha()
      .composite([{ input: sunMask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const outputPath = resolve(
      outputRoot,
      `sun-marker${density === 2 ? "@2x" : ""}.webp`,
    );
    await sharp({
      create: {
        width: tileSize,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: sun,
        left: (tileSize - sunSize) / 2,
        top: (tileSize - sunSize) / 2,
      }])
      .webp({ lossless: true, effort: 6 })
      .toFile(outputPath);
    await optimizePreparedQ75Webp(outputPath);
  }

  const blackHoleSource = await validateMarkerSourceBytes(
    NAVIGATION_BLACKHOLE_SOURCE,
    resolve(navigationSourceRoot, NAVIGATION_BLACKHOLE_SOURCE.path),
  );
  await Promise.all([
    "blackhole-marker.webp",
    "blackhole-marker@2x.webp",
    "supernova-marker.webp",
    "supernova-marker@2x.webp",
  ].map((filename) => unlink(resolve(outputRoot, filename)).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  })));
  const blackHoleLuminance = Object.freeze([0.2126, 0.7152, 0.0722]);
  for (const density of [1, 2]) {
    const tileSize = 48 * density;
    const blackHoleBase = sharp(blackHoleSource)
      .extract({ left: 112, top: 112, width: 800, height: 800 })
      .resize(tileSize, tileSize, {
        fit: "contain",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      });
    const [blackHoleRgb, blackHoleAlpha] = await Promise.all([
      blackHoleBase.clone()
        .recomb([
          blackHoleLuminance.map((channel) => channel * 0.78),
          blackHoleLuminance.map((channel) => channel * 0.60),
          blackHoleLuminance,
        ])
        .modulate({ brightness: 1.12 })
        .removeAlpha()
        .raw()
        .toBuffer(),
      blackHoleBase.clone()
        .removeAlpha()
        .greyscale()
        .linear(3, -6)
        .raw()
        .toBuffer(),
    ]);
    const outputPath = resolve(
      outputRoot,
      `blackhole-marker${density === 2 ? "@2x" : ""}.png`,
    );
    await sharp(blackHoleRgb, {
      raw: {
        width: tileSize,
        height: tileSize,
        channels: 3,
      },
    })
      .joinChannel(blackHoleAlpha, {
        raw: {
          width: tileSize,
          height: tileSize,
          channels: 1,
        },
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
  }

  const supernovaSource = await validateMarkerSourceBytes(
    NAVIGATION_SUPERNOVA_SOURCE,
    resolve(navigationSourceRoot, NAVIGATION_SUPERNOVA_SOURCE.path),
  );
  for (const density of [1, 2]) {
    const tileSize = 48 * density;
    const markSize = 30 * density;
    const supernovaBase = sharp(supernovaSource)
      .rotate(45, { background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .trim({ background: "#000", threshold: 4 })
      .resize(markSize, markSize, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.7 });
    const [supernovaRgb, supernovaAlpha] = await Promise.all([
      supernovaBase.clone()
        .removeAlpha()
        .raw()
        .toBuffer(),
      supernovaBase.clone()
        .removeAlpha()
        .greyscale()
        .linear(3, -6)
        .raw()
        .toBuffer(),
    ]);
    const supernova = await sharp(supernovaRgb, {
      raw: {
        width: markSize,
        height: markSize,
        channels: 3,
      },
    })
      .joinChannel(supernovaAlpha, {
        raw: {
          width: markSize,
          height: markSize,
          channels: 1,
        },
      })
      .png()
      .toBuffer();
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${markSize}" height="${markSize}">` +
      `<circle cx="${markSize / 2}" cy="${markSize / 2}" ` +
      `r="${markSize / 2 - density}" fill="white"/>` +
      "</svg>",
    );
    const clipped = await sharp(supernova)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const outputPath = resolve(
      outputRoot,
      `supernova-marker${density === 2 ? "@2x" : ""}.png`,
    );
    await sharp({
      create: {
        width: tileSize,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: clipped,
        left: (tileSize - markSize) / 2,
        top: (tileSize - markSize) / 2,
      }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
  }

  const actionSources = Object.freeze([
    Object.freeze({ id: "github", source: NAVIGATION_GITHUB_SOURCE }),
    Object.freeze({ id: "settings", source: NAVIGATION_SETTINGS_SOURCE }),
    Object.freeze({ id: "download", source: NAVIGATION_DOWNLOAD_SOURCE }),
    Object.freeze({ id: "share", source: NAVIGATION_SHARE_SOURCE }),
  ]);
  for (const { id, source } of actionSources) {
    const sourceBytes = await validateMarkerSourceBytes(
      source,
      resolve(navigationSourceRoot, source.path),
    );
    for (const density of [1, 2]) {
      const tileSize = 48 * density;
      const markSize = 26 * density;
      const actionMask = await sharp(sourceBytes)
        .trim({ threshold: 10 })
        .resize(markSize, markSize, {
          fit: "contain",
          position: "centre",
          kernel: sharp.kernel.lanczos3,
        })
        .ensureAlpha()
        .png()
        .toBuffer();
      const shade = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${markSize}" height="${markSize}">` +
        '<defs><radialGradient id="shade" cx="32%" cy="27%" r="84%">' +
        '<stop offset="0" stop-color="#cecece"/>' +
        '<stop offset="0.08" stop-color="#b8b8b8"/>' +
        '<stop offset="0.62" stop-color="#969696"/>' +
        '<stop offset="1" stop-color="#757575"/>' +
        '</radialGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/>' +
        "</svg>",
      );
      const action = await sharp(shade)
        .ensureAlpha()
        .composite([{ input: actionMask, blend: "dest-in" }])
        .png()
        .toBuffer();
      const outputPath = resolve(
        outputRoot,
        `${id}-marker${density === 2 ? "@2x" : ""}.webp`,
      );
      await sharp({
        create: {
          width: tileSize,
          height: tileSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{
          input: action,
          left: (tileSize - markSize) / 2,
          top: (tileSize - markSize) / 2,
        }])
        .webp({ lossless: true, effort: 6 })
        .toFile(outputPath);
      await optimizePreparedQ75Webp(outputPath);
    }
  }

  return Object.freeze({
    outputRoot,
    planetCount: descriptors.length,
    sourceHashes: Object.freeze([
      ...descriptors.map(({ source }) => source.expectedSha256),
      NAVIGATION_SUN_SOURCE.expectedSha256,
      NAVIGATION_BLACKHOLE_SOURCE.expectedSha256,
      NAVIGATION_SUPERNOVA_SOURCE.expectedSha256,
      NAVIGATION_GITHUB_SOURCE.expectedSha256,
      NAVIGATION_SETTINGS_SOURCE.expectedSha256,
      NAVIGATION_DOWNLOAD_SOURCE.expectedSha256,
      NAVIGATION_SHARE_SOURCE.expectedSha256,
    ]),
  });
}

async function loadObjectDescriptor(planetId, projectRoot) {
  const modulePath = resolve(
    projectRoot,
    "src/planets",
    planetId,
    "tools/navigation-marker.mjs",
  );
  const module = await import(pathToFileURL(modulePath));
  return module.default;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await prepareNavigation();
  console.log(JSON.stringify({
    ...result,
    planetMarkerAtlas:
      `${markers.length} prepared 16px raster markers with 2x density`,
    sunMarker: "NASA HMI raster marker with 2x density",
    blackHoleMarker: "NASA/GSFC simulated accretion-disk marker with 2x density",
    supernovaMarker: "NASA/ESA/CSA Webb MIRI Cassiopeia A marker with 2x density",
    actionMarkers: "4 prepared monochrome shaded markers with 2x density",
  }));
}
