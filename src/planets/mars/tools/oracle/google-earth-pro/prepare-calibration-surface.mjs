import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

import { packProjectiveSurfaceRaster } from
  "../../../../../platform/projective-surface-raster.mjs";
import {
  MARS_BODY_LATITUDE_BOUNDS_DEGREES,
  marsBodyRasterBands,
} from "../../body-geometry.mjs";
import { prepareMarsPolarAtlas } from "../../polar-projection.mjs";

const GENERATOR_VERSION = "1.0.0";
const SOURCE_WIDTH = 4096;
const SOURCE_HEIGHT = 2048;
const TILE_SIZE = 256;
const GOOGLE_MAX_LEVEL = 3;
const SOURCE_COLOR_SPACE = Object.freeze({
  name: "sRGB",
  transfer: "IEC 61966-2-1 nonlinear",
  channels: "8-bit unassociated RGBA",
  alpha: "fully opaque",
});
const calibrationRoot = resolve(
  import.meta.dirname,
  "../../../../../../.local/oracles/google-earth-pro/calibration",
);
const verifyOnly = process.argv.slice(2).includes("--verify");
if (process.argv.slice(2).some((argument) => argument !== "--verify")) {
  throw new Error("Usage: prepare-calibration-surface.mjs [--verify]");
}

const generatorBytes = await readFile(import.meta.filename);
const sourceRgba = renderCalibrationSurface();
const sourceDecodedRgbaSha256 = sha256(sourceRgba);
const sourcePng = await encodeLosslessPng(sourceRgba, {
  width: SOURCE_WIDTH,
  height: SOURCE_HEIGHT,
});
const sourceDescriptor = Object.freeze({
  path: "mars-calibration-equirectangular.png",
  width: SOURCE_WIDTH,
  height: SOURCE_HEIGHT,
  colorSpace: SOURCE_COLOR_SPACE,
  encodedBytes: sourcePng.length,
  encodedSha256: sha256(sourcePng),
  decodedRgbaSha256: sourceDecodedRgbaSha256,
});
const artifacts = new Map([
  [sourceDescriptor.path, sourcePng],
]);

const google = await prepareGoogleTilePyramid();
const cssEarth = await prepareCssEarthAtlases();
const googleManifestBytes = jsonBytes(google.manifest);
const cssEarthManifestBytes = jsonBytes(cssEarth.manifest);
artifacts.set("google/manifest.json", googleManifestBytes);
artifacts.set("css-earth/manifest.json", cssEarthManifestBytes);
for (const [path, bytes] of [...google.artifacts, ...cssEarth.artifacts]) {
  artifacts.set(path, bytes);
}

const manifest = Object.freeze({
  schema: "cssmars-calibration-surface@1",
  qualification: "DETERMINISTIC_UNLIT_REGISTRATION_SOURCE",
  generator: Object.freeze({
    version: GENERATOR_VERSION,
    path: "tools/oracle/google-earth-pro/prepare-calibration-surface.mjs",
    sha256: sha256(generatorBytes),
  }),
  source: sourceDescriptor,
  design: Object.freeze({
    projection: "plate-carree equirectangular",
    longitudeDomainDegrees: Object.freeze([-180, 180]),
    latitudeDomainDegrees: Object.freeze([90, -90]),
    gridStepDegrees: 30,
    features: Object.freeze([
      "labeled latitude-longitude cells",
      "unequal north and south pole markers",
      "unique cyan-white prime meridian",
      "different magenta and yellow antimeridian seam edges",
      "four unequal quadrant palettes",
      "one-pixel, two-pixel, and three-pixel registration dots",
      "per-cell deterministic color identity without rotational symmetry",
    ]),
    lighting: "none; emitted RGBA is authoritative",
  }),
  derivatives: Object.freeze({
    google: Object.freeze({
      manifestPath: "google/manifest.json",
      manifestSha256: sha256(googleManifestBytes),
      sourceDecodedRgbaSha256,
    }),
    cssEarth: Object.freeze({
      manifestPath: "css-earth/manifest.json",
      manifestSha256: sha256(cssEarthManifestBytes),
      sourceDecodedRgbaSha256,
    }),
  }),
});
artifacts.set("manifest.json", jsonBytes(manifest));

if (verifyOnly) {
  const failures = [];
  for (const [relativePath, expected] of artifacts) {
    const absolutePath = resolve(calibrationRoot, relativePath);
    try {
      const actual = await readFile(absolutePath);
      if (!actual.equals(expected)) {
        failures.push(`${relativePath}: byte drift`);
      }
    } catch (error) {
      failures.push(`${relativePath}: ${error?.code ?? error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Calibration verification failed:\n${failures.join("\n")}`,
    );
  }
} else {
  for (const [relativePath, bytes] of artifacts) {
    const absolutePath = resolve(calibrationRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  mode: verifyOnly ? "verify" : "write",
  root: calibrationRoot,
  artifactCount: artifacts.size,
  source: sourceDescriptor,
  googleTileCount: google.manifest.tiles.length,
  cssEarthAtlasCount: cssEarth.manifest.atlases.length,
  sourceDecodedRgbaSha256,
}, null, 2)}\n`);

async function prepareGoogleTilePyramid() {
  const tileArtifacts = [];
  const tiles = [];
  for (let level = 0; level <= GOOGLE_MAX_LEVEL; level += 1) {
    const rowCount = 2 ** level;
    const columnCount = rowCount * 2;
    const levelWidth = columnCount * TILE_SIZE;
    const levelHeight = rowCount * TILE_SIZE;
    const levelRgba = level === GOOGLE_MAX_LEVEL
      ? sourceRgba
      : await sharp(sourceRgba, {
        raw: {
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          channels: 4,
        },
      }).resize(levelWidth, levelHeight, {
        fit: "fill",
        kernel: sharp.kernel.nearest,
      }).raw().toBuffer();
    for (let y = 0; y < rowCount; y += 1) {
      for (let x = 0; x < columnCount; x += 1) {
        const tileRgba = extractRgba(levelRgba, {
          sourceWidth: levelWidth,
          left: x * TILE_SIZE,
          top: y * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
        });
        const tilePng = await encodeLosslessPng(tileRgba, {
          width: TILE_SIZE,
          height: TILE_SIZE,
        });
        const path = `google/tiles/z${level}/${x}/${y}.png`;
        tileArtifacts.push([path, tilePng]);
        tiles.push(Object.freeze({
          level,
          x,
          y,
          path,
          width: TILE_SIZE,
          height: TILE_SIZE,
          longitudeRangeDegrees: Object.freeze([
            -180 + x / columnCount * 360,
            -180 + (x + 1) / columnCount * 360,
          ]),
          latitudeRangeDegrees: Object.freeze([
            90 - (y + 1) / rowCount * 180,
            90 - y / rowCount * 180,
          ]),
          sourceDecodedRgbaSha256,
          decodedRgbaSha256: sha256(tileRgba),
          encodedBytes: tilePng.length,
          encodedSha256: sha256(tilePng),
        }));
      }
    }
  }
  return Object.freeze({
    artifacts: Object.freeze(tileArtifacts),
    manifest: Object.freeze({
      schema: "cssmars-calibration-google-tiles@1",
      sourcePath: "../mars-calibration-equirectangular.png",
      sourceDecodedRgbaSha256,
      projection: "plate-carree geographic 2-by-1 quadtree",
      addressing: "z/x/y with north-origin rows",
      tileSize: TILE_SIZE,
      minimumLevel: 0,
      maximumLevel: GOOGLE_MAX_LEVEL,
      resampling: "nearest-neighbor from the one authoritative source",
      colorSpace: SOURCE_COLOR_SPACE,
      tiles: Object.freeze(tiles),
    }),
  });
}

async function prepareCssEarthAtlases() {
  const entries = [];
  const atlasArtifacts = [];
  for (const scale of [1, 2]) {
    const surfaceWidth = 2048 * scale;
    const surfaceHeight = 1024 * scale;
    const surfaceRgba = scale === 2
      ? sourceRgba
      : await sharp(sourceRgba, {
        raw: {
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          channels: 4,
        },
      }).resize(surfaceWidth, surfaceHeight, {
        fit: "fill",
        kernel: sharp.kernel.nearest,
      }).raw().toBuffer();
    const gutter = surfaceHeight / 16 / 4;
    const packed = packProjectiveSurfaceRaster(surfaceRgba, {
      width: surfaceWidth,
      height: surfaceHeight,
      channels: 4,
      bands: marsBodyRasterBands(surfaceHeight),
      gutter,
    });
    const surfacePng = await encodeLosslessPng(packed.data, {
      width: packed.packedWidth,
      height: packed.packedHeight,
    });
    const surfacePath = scale === 1
      ? "css-earth/mars-calibration-surface.png"
      : "css-earth/mars-calibration-surface@2x.png";
    atlasArtifacts.push([surfacePath, surfacePng]);
    entries.push(derivativeDescriptor({
      id: `projective-surface-${scale}x`,
      path: surfacePath,
      bytes: surfacePng,
      rgba: packed.data,
      width: packed.packedWidth,
      height: packed.packedHeight,
      role: "drop-in retained Mars body projective atlas",
      sourceDecodedRgbaSha256,
      preparation: Object.freeze({
        sourceWidth: surfaceWidth,
        sourceHeight: surfaceHeight,
        sourceResampling: scale === 1 ? "nearest-neighbor 0.5x" : "identity",
        bandLatitudeBoundsDegrees: MARS_BODY_LATITUDE_BOUNDS_DEGREES,
        gutter,
        packedBandCount: packed.bandCount,
      }),
    }));

    const poleTileSize = 256 * scale;
    const poles = prepareMarsPolarAtlas({
      data: surfaceRgba,
      info: {
        width: surfaceWidth,
        height: surfaceHeight,
        channels: 4,
      },
    }, poleTileSize, {
      boundaryLatitudeDegrees: 87.1875,
    });
    const polesPng = await encodeLosslessPng(poles.data, {
      width: poles.width,
      height: poles.height,
    });
    const polesPath = scale === 1
      ? "css-earth/mars-calibration-poles.png"
      : "css-earth/mars-calibration-poles@2x.png";
    atlasArtifacts.push([polesPath, polesPng]);
    entries.push(derivativeDescriptor({
      id: `polar-atlas-${scale}x`,
      path: polesPath,
      bytes: polesPng,
      rgba: poles.data,
      width: poles.width,
      height: poles.height,
      role: "drop-in retained Mars north and south polar atlas",
      sourceDecodedRgbaSha256,
      preparation: Object.freeze({
        sourceWidth: surfaceWidth,
        sourceHeight: surfaceHeight,
        tileSize: poleTileSize,
        boundaryLatitudeDegrees: 87.1875,
        projection: poles.stabilization,
      }),
    }));
  }
  return Object.freeze({
    artifacts: Object.freeze(atlasArtifacts),
    manifest: Object.freeze({
      schema: "cssmars-calibration-css-earth-atlases@1",
      sourcePath: "../mars-calibration-equirectangular.png",
      sourceDecodedRgbaSha256,
      colorSpace: SOURCE_COLOR_SPACE,
      runtimePreparation: false,
      atlases: Object.freeze(entries),
    }),
  });
}

function renderCalibrationSurface() {
  const rgba = Buffer.alloc(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
  const quadrants = [
    [74, 27, 37],
    [28, 76, 54],
    [27, 49, 88],
    [95, 69, 24],
  ];
  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    const latitudeCell = Math.min(5, Math.floor(y / SOURCE_HEIGHT * 6));
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const longitudeCell = Math.min(11, Math.floor(x / SOURCE_WIDTH * 12));
      const quadrant = (y >= SOURCE_HEIGHT / 2 ? 2 : 0) +
        (x >= SOURCE_WIDTH / 2 ? 1 : 0);
      const variation = ((longitudeCell * 17 + latitudeCell * 29) % 23) - 11;
      const micro = ((x >> 4) + (y >> 4) + longitudeCell) % 2;
      const color = quadrants[quadrant];
      setPixel(rgba, x, y, [
        clampByte(color[0] + variation + micro * 2),
        clampByte(color[1] + Math.round(variation * 0.6)),
        clampByte(color[2] - Math.round(variation * 0.4) + micro),
        255,
      ]);
    }
  }

  for (let longitude = -150; longitude <= 150; longitude += 30) {
    const x = longitudeToX(longitude);
    drawVerticalLine(rgba, x, 2, [194, 205, 220, 255]);
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = latitudeToY(latitude);
    drawHorizontalLine(rgba, y, latitude === 0 ? 5 : 2,
      latitude === 0 ? [255, 255, 255, 255] : [194, 205, 220, 255]);
  }

  const primeX = longitudeToX(0);
  drawVerticalLine(rgba, primeX, 11, [8, 31, 38, 255]);
  drawVerticalLine(rgba, primeX, 7, [57, 232, 241, 255]);
  drawVerticalLine(rgba, primeX, 2, [255, 255, 255, 255]);
  fillRect(rgba, 0, 0, 12, SOURCE_HEIGHT, [244, 35, 194, 255]);
  fillRect(
    rgba,
    SOURCE_WIDTH - 12,
    0,
    12,
    SOURCE_HEIGHT,
    [255, 214, 38, 255],
  );

  for (let latitudeCell = 0; latitudeCell < 6; latitudeCell += 1) {
    const latitude = 75 - latitudeCell * 30;
    for (let longitudeCell = 0; longitudeCell < 12; longitudeCell += 1) {
      const longitude = -165 + longitudeCell * 30;
      const label = `${latitude >= 0 ? "N" : "S"}${String(
        Math.abs(latitude),
      ).padStart(2, "0")}${longitude >= 0 ? "E" : "W"}${String(
        Math.abs(longitude),
      ).padStart(3, "0")}`;
      const cellX = Math.round(longitudeCell / 12 * SOURCE_WIDTH);
      const cellY = Math.round(latitudeCell / 6 * SOURCE_HEIGHT);
      drawText(rgba, label, cellX + 26, cellY + 28, 4,
        [247, 248, 242, 255], [4, 7, 12, 255]);
      const identity = longitudeCell + latitudeCell * 12 + 1;
      drawDot(rgba, cellX + 62 + identity % 211,
        cellY + 122 + identity % 97, 1 + identity % 3,
        cellIdentityColor(identity));
    }
  }

  drawText(rgba, "P000", primeX + 18, latitudeToY(8), 6,
    [255, 255, 255, 255], [4, 32, 38, 255]);
  drawText(rgba, "A180", 22, latitudeToY(-6), 6,
    [255, 255, 255, 255], [65, 3, 48, 255]);
  drawText(rgba, "A180", SOURCE_WIDTH - 175, latitudeToY(-6), 6,
    [18, 15, 2, 255], [255, 230, 66, 255]);
  drawNorthPoleMarker(rgba);
  drawSouthPoleMarker(rgba);
  drawRegistrationDots(rgba);
  return rgba;
}

function drawNorthPoleMarker(rgba) {
  const centerX = longitudeToX(-67);
  fillRect(rgba, centerX - 88, 4, 176, 58, [20, 203, 255, 255]);
  for (let step = 0; step < 6; step += 1) {
    fillRect(rgba, centerX - 84 + step * 28, 62, 18, 14 + step * 7,
      [240, 250, 255, 255]);
  }
  drawText(rgba, "N90", centerX - 51, 15, 5,
    [4, 17, 25, 255], [20, 203, 255, 255]);
}

function drawSouthPoleMarker(rgba) {
  const centerX = longitudeToX(103);
  const centerY = SOURCE_HEIGHT - 39;
  fillRect(rgba, centerX - 102, centerY - 25, 204, 50,
    [255, 112, 30, 255]);
  for (let radius = 8; radius <= 34; radius += 8) {
    drawRing(rgba, centerX, centerY, radius,
      radius % 16 === 0 ? [12, 9, 5, 255] : [255, 240, 190, 255]);
  }
  drawText(rgba, "S90", centerX + 48, centerY - 18, 4,
    [15, 8, 2, 255], [255, 112, 30, 255]);
}

function drawRegistrationDots(rgba) {
  const dots = [
    [-137.25, 52.75, 1, [255, 255, 255, 255]],
    [-91.5, -11.25, 2, [66, 240, 255, 255]],
    [-23.75, 37.5, 3, [255, 84, 199, 255]],
    [17.125, -42.625, 1, [255, 224, 44, 255]],
    [73.5, 19.25, 2, [115, 255, 95, 255]],
    [149.875, -66.375, 3, [255, 112, 38, 255]],
  ];
  for (const [longitude, latitude, radius, color] of dots) {
    const x = longitudeToX(longitude);
    const y = latitudeToY(latitude);
    drawCross(rgba, x, y, 8 + radius * 2, [5, 8, 13, 255]);
    drawDot(rgba, x, y, radius, color);
  }
}

async function encodeLosslessPng(rgba, { width, height }) {
  const encoded = await sharp(rgba, {
    raw: { width, height, channels: 4 },
  }).png({
    compressionLevel: 9,
    adaptiveFiltering: false,
    palette: false,
  }).toBuffer();
  const decoded = await sharp(encoded).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== width || decoded.info.height !== height ||
      decoded.info.channels !== 4 || !decoded.data.equals(rgba)) {
    throw new Error(`PNG round trip changed ${width}x${height} RGBA bytes.`);
  }
  return encoded;
}

function derivativeDescriptor({
  id,
  path,
  bytes,
  rgba,
  width,
  height,
  role,
  sourceDecodedRgbaSha256: sourceHash,
  preparation,
}) {
  return Object.freeze({
    id,
    path,
    role,
    width,
    height,
    colorSpace: SOURCE_COLOR_SPACE,
    sourceDecodedRgbaSha256: sourceHash,
    decodedRgbaSha256: sha256(rgba),
    encodedBytes: bytes.length,
    encodedSha256: sha256(bytes),
    preparation,
  });
}

function extractRgba(source, {
  sourceWidth,
  left,
  top,
  width,
  height,
}) {
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = ((top + y) * sourceWidth + left) * 4;
    source.copy(output, y * width * 4, sourceOffset,
      sourceOffset + width * 4);
  }
  return output;
}

function setPixel(rgba, x, y, color) {
  if (x < 0 || y < 0 || x >= SOURCE_WIDTH || y >= SOURCE_HEIGHT) return;
  const offset = (Math.floor(y) * SOURCE_WIDTH + Math.floor(x)) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function fillRect(rgba, left, top, width, height, color) {
  for (let y = Math.max(0, Math.floor(top));
       y < Math.min(SOURCE_HEIGHT, Math.ceil(top + height)); y += 1) {
    for (let x = Math.max(0, Math.floor(left));
         x < Math.min(SOURCE_WIDTH, Math.ceil(left + width)); x += 1) {
      setPixel(rgba, x, y, color);
    }
  }
}

function drawVerticalLine(rgba, centerX, width, color) {
  fillRect(rgba, Math.round(centerX - width / 2), 0, width, SOURCE_HEIGHT,
    color);
}

function drawHorizontalLine(rgba, centerY, height, color) {
  fillRect(rgba, 0, Math.round(centerY - height / 2), SOURCE_WIDTH, height,
    color);
}

function drawDot(rgba, centerX, centerY, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) {
        setPixel(rgba, centerX + x, centerY + y, color);
      }
    }
  }
}

function drawRing(rgba, centerX, centerY, radius, color) {
  const inner = (radius - 1.5) ** 2;
  const outer = (radius + 1.5) ** 2;
  for (let y = -radius - 2; y <= radius + 2; y += 1) {
    for (let x = -radius - 2; x <= radius + 2; x += 1) {
      const distance = x * x + y * y;
      if (distance >= inner && distance <= outer) {
        setPixel(rgba, centerX + x, centerY + y, color);
      }
    }
  }
}

function drawCross(rgba, centerX, centerY, radius, color) {
  fillRect(rgba, centerX - radius, centerY - 1, radius * 2 + 1, 3, color);
  fillRect(rgba, centerX - 1, centerY - radius, 3, radius * 2 + 1, color);
}

function drawText(rgba, text, left, top, scale, color, background) {
  const glyphWidth = 5 * scale;
  const glyphHeight = 7 * scale;
  const width = text.length * (glyphWidth + scale) + scale * 2;
  fillRect(rgba, left - scale, top - scale, width, glyphHeight + scale * 2,
    background);
  for (let characterIndex = 0;
       characterIndex < text.length;
       characterIndex += 1) {
    const glyph = glyphFor(text[characterIndex]);
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if (glyph[y][x] !== "1") continue;
        fillRect(
          rgba,
          left + characterIndex * (glyphWidth + scale) + x * scale,
          top + y * scale,
          scale,
          scale,
          color,
        );
      }
    }
  }
}

function longitudeToX(longitude) {
  return Math.round((longitude + 180) / 360 * (SOURCE_WIDTH - 1));
}

function latitudeToY(latitude) {
  return Math.round((90 - latitude) / 180 * (SOURCE_HEIGHT - 1));
}

function cellIdentityColor(identity) {
  return [
    72 + identity * 47 % 184,
    72 + identity * 83 % 184,
    72 + identity * 131 % 184,
    255,
  ];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function glyphFor(character) {
  const glyphs = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  "N": ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  };
  return glyphs[character] ?? glyphs[" "];
}
