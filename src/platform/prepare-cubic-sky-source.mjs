import {
  RETAINED_STAR_RADIUS_SHARE_OF_HALF_SIDE,
  cubeFaceOf,
  retainedStarTransform,
} from "./prepare-catalogue-stars.mjs";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  CUBIC_SKY_FACE_IDS,
  CUBIC_SKY_STANDARD,
  PREPARED_CUBIC_SKY_SCHEMA,
  PREPARED_CUBIC_SKY_SUN_SCHEMA,
  createCubicSkySunPresentation,
  projectDirectionToCubemapFace,
} from "./cubic-sky-contract.mjs";
import {
  compositeSunIntoCubicSkyFace,
  prepareCubicSkySunPixels,
  prepareStandardCubicSkyPixels,
  validateCubicSkySunOracle,
} from "./cubic-sky-preparation.mjs";

const FACE_SIZE = CUBIC_SKY_STANDARD.faceSize;
const [PHOTO_WIDTH, PHOTO_HEIGHT] = CUBIC_SKY_STANDARD.sourceMapSize;
const { blackPoint: BLACK_POINT, gamma: LEVEL_GAMMA, gain: GAIN } =
  CUBIC_SKY_STANDARD.photographicLevels;
const {
  sourceSigmaPixels: DIFFUSE_SIGMA,
  diffuseGain: DIFFUSE_GAIN,
  detailGain: DETAIL_GAIN,
} = CUBIC_SKY_STANDARD.photographicSeparation;
const REGISTRATION_ROTATION_DEGREES =
  CUBIC_SKY_STANDARD.photographicRegistrationRotationDegrees;
const FACE_IDS = CUBIC_SKY_FACE_IDS;
const ICRS_STANDARD_TO_GALACTIC = Object.freeze([
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.44482963, 0.7469822445,
  -0.867666149, -0.1980763734, 0.4559837762,
]);

export async function preparePlanetCubicSky({
  objectId,
  sourceRoot,
  publicRoot,
  preparedModulePath,
  ensureDirectories,
  validateSourceGroup,
  includeSun = true,
  cameraContract = null,
  pointSourceContract = null,
  // Opt-in astrometric registration (see astrometric-sky-registration.mjs):
  // the cube is sampled in ICRF through a derived rotation chain instead of
  // the shared hand-registered Euler angles. Objects that do not opt in keep
  // their accepted sky untouched.
  astrometricSampling = null,
  // Opt-in catalogue stars (see prepare-catalogue-stars.mjs): the photograph
  // keeps only its diffuse light (detail gain zero, so no star is drawn
  // twice), the stamped bands are painted into the faces from their ICRS
  // directions, and the retained band is carried in the plan for the runtime
  // to mount as points on the same cube. Supersedes the photographic
  // point-source selection, which is then not applied.
  catalogueStars = null,
  sourceSchema = `css${objectId}-prepared-star-source@1`,
}) {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId) ||
      typeof sourceRoot !== "string" || typeof publicRoot !== "string" ||
      !(preparedModulePath instanceof URL) ||
      typeof ensureDirectories !== "function" ||
      typeof validateSourceGroup !== "function" ||
      typeof sourceSchema !== "string" || sourceSchema.length === 0 ||
      (cameraContract !== null && (
        !Number.isFinite(cameraContract.rotationResponse) ||
        !Number.isFinite(cameraContract.zoomResponse) ||
        !Number.isFinite(cameraContract.horizontalFovDegrees) ||
        !Number.isFinite(cameraContract.focalLengthOverViewportWidth)
      )) ||
      (pointSourceContract !== null && (
        !Number.isInteger(pointSourceContract.drawCount) ||
        pointSourceContract.drawCount <= 0 ||
        !Number.isFinite(pointSourceContract.nativePointSizePixels) ||
        pointSourceContract.nativePointSizePixels <= 0 ||
        !Number.isInteger(pointSourceContract.logicalPointFootprintPixels) ||
        pointSourceContract.logicalPointFootprintPixels <= 0 ||
        !Number.isFinite(pointSourceContract.backgroundDetailGain) ||
        pointSourceContract.backgroundDetailGain < 0 ||
        pointSourceContract.backgroundDetailGain >= DETAIL_GAIN ||
        !Number.isFinite(pointSourceContract.backgroundDiffuseGain) ||
        pointSourceContract.backgroundDiffuseGain < 0 ||
        pointSourceContract.backgroundDiffuseGain >= DIFFUSE_GAIN ||
        typeof pointSourceContract.source !== "string" ||
        typeof pointSourceContract.sourcePath !== "string"
      )) ||
      (astrometricSampling !== null && (
        typeof astrometricSampling.model !== "string" ||
        typeof astrometricSampling.cubeFrame !== "string" ||
        !Array.isArray(astrometricSampling.matrix) ||
        astrometricSampling.matrix.length !== 9 ||
        astrometricSampling.matrix.some((value) => !Number.isFinite(value))
      ))) {
    throw new TypeError("Planet cubic-sky preparation arguments are invalid.");
  }
  if (catalogueStars !== null && (catalogueStars.schema !== "cssearth-prepared-catalogue-stars@1" ||
      !Array.isArray(catalogueStars.stars) || catalogueStars.stars.length === 0)) {
    throw new TypeError("Catalogue stars for the cubic sky are invalid.");
  }
  const photographDetailGain = catalogueStars === null ? DETAIL_GAIN : 0;
  const objectName = objectId[0].toUpperCase() + objectId.slice(1);
  await validateSourceGroup("starfield");
  await ensureDirectories();

const catalog = JSON.parse(await readFile(resolve(
  sourceRoot,
  "stars/hyg-v41-field.json",
), "utf8"));
if (catalog.schema !== sourceSchema ||
    !Number.isFinite(catalog.projection?.centerRaDegrees) ||
    !Number.isFinite(catalog.projection?.centerDecDegrees)) {
  throw new TypeError(`${objectName} star-coordinate source is incompatible.`);
}
const photo = await sharp(resolve(
  sourceRoot,
  "stars/eso0932a.tif",
)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (photo.info.width !== PHOTO_WIDTH ||
    photo.info.height !== PHOTO_HEIGHT ||
    photo.info.channels !== 3) {
  throw new TypeError(`${objectName} ESO full-sky photograph is incompatible.`);
}
const diffusePhoto = await prepareWrappedDiffuse(photo.data, photo.info);
const basis = equatorialCubemapBasis(catalog.projection);
const registration = rotationMatrix(REGISTRATION_ROTATION_DEGREES);
const astrometricMatrix = astrometricSampling?.matrix ?? null;
const sunOracle = includeSun
  ? validateCubicSkySunOracle(JSON.parse(await readFile(resolve(
    sourceRoot,
    "sun/google-maps-sun-oracle.json",
  ), "utf8")))
  : null;
const sunPresentation = includeSun ? createCubicSkySunPresentation() : null;
const faces = [];
let selectedPointSources = null;
for (const density of [1, 2]) {
  const faceSize = FACE_SIZE * density;
  const sun = includeSun
    ? await prepareCubicSkySunPixels({
      sourcePath: resolve(sourceRoot, "sun/google-maps-sun.png"),
      oracle: sunOracle,
      density,
    })
    : null;
  const preparedFaces = FACE_IDS.map((id) => {
    const highContrastPixels = preparePhotographicFace(
      id,
      faceSize,
      basis,
      registration,
      photo.data,
      diffusePhoto,
      photo.info,
      photographDetailGain,
      DIFFUSE_GAIN,
      astrometricMatrix,
    );
    const photographicStandardPixels = prepareStandardCubicSkyPixels(
      highContrastPixels,
    );
    const standardPixels = pointSourceContract === null || catalogueStars !== null
      ? photographicStandardPixels
      : prepareStandardCubicSkyPixels(preparePhotographicFace(
        id,
        faceSize,
        basis,
        registration,
        photo.data,
        diffusePhoto,
        photo.info,
        pointSourceContract.backgroundDetailGain,
        pointSourceContract.backgroundDiffuseGain,
        astrometricMatrix,
      ));
    const pointSelectionPixels = pointSourceContract !== null && density === 1
      ? prepareStandardCubicSkyPixels(preparePhotographicFace(
        id,
        faceSize,
        basis,
        registration,
        photo.data,
        diffusePhoto,
        photo.info,
        pointSourceContract.backgroundDetailGain,
        DIFFUSE_GAIN,
        astrometricMatrix,
      ))
      : standardPixels;
    return {
      id,
      highContrastPixels,
      photographicStandardPixels,
      pointSelectionPixels,
      standardPixels,
    };
  });
  if (pointSourceContract !== null && catalogueStars === null && density === 1) {
    selectedPointSources = selectPhotographicPointSources(
      preparedFaces,
      pointSourceContract.drawCount,
      faceSize,
    );
  }
  for (const {
    id,
    highContrastPixels,
    standardPixels,
  } of preparedFaces) {
    if (catalogueStars !== null) {
      // The stamped bands, at their ICRS directions (cube-local axes).
      for (const facePixels of [standardPixels, highContrastPixels]) {
        stampCatalogueStars({ faceId: id, facePixels, faceSize, density, stars: catalogueStars.stars });
      }
    }
    if (pointSourceContract !== null && catalogueStars === null) {
      applyPreparedPointSources({
        pixels: standardPixels,
        faceSize,
        density,
        pointSources: selectedPointSources.get(id),
        logicalPointFootprintPixels:
          pointSourceContract.logicalPointFootprintPixels,
      });
    }
    if (includeSun) {
      for (const facePixels of [standardPixels, highContrastPixels]) {
        compositeSunIntoCubicSkyFace({
          faceId: id,
          facePixels,
          sunPixels: sun.pixels,
          sunSize: sun.size,
          faceSize,
          localDirection: sunPresentation.localDirection,
        });
      }
    }
    const suffix = density === 1 ? "" : "@2x";
    const highContrastFileName =
      `${objectId}-starfield-${id}${suffix}.webp`;
    const standardFileName =
      `${objectId}-starfield-${id}-standard${suffix}.webp`;
    await sharp(highContrastPixels, {
      raw: { width: faceSize, height: faceSize, channels: 3 },
    }).webp({ lossless: true, effort: 6 }).toFile(resolve(
      publicRoot,
      highContrastFileName,
    ));
    await sharp(standardPixels, {
      raw: { width: faceSize, height: faceSize, channels: 3 },
    }).webp({ lossless: true, effort: 6 }).toFile(resolve(
      publicRoot,
      standardFileName,
    ));
    if (density === 1) {
      faces.push({
        id,
        url: `/scenes/${objectId}/${standardFileName}`,
        url2x:
          `/scenes/${objectId}/${objectId}-starfield-${id}-standard@2x.webp`,
        highContrastUrl:
          `/scenes/${objectId}/${highContrastFileName}`,
        highContrastUrl2x:
          `/scenes/${objectId}/${objectId}-starfield-${id}@2x.webp`,
      });
    }
  }
}

const hashes = Object.fromEntries(await Promise.all(
  FACE_IDS.flatMap((id) => [
    `${objectId}-starfield-${id}.webp`,
    `${objectId}-starfield-${id}@2x.webp`,
    `${objectId}-starfield-${id}-standard.webp`,
    `${objectId}-starfield-${id}-standard@2x.webp`,
  ]).map(async (fileName) => {
    const bytes = await readFile(resolve(publicRoot, fileName));
    return [fileName, Object.freeze({
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })];
  }),
));

const prepared = Object.freeze({
  schema: PREPARED_CUBIC_SKY_SCHEMA,
  standard: CUBIC_SKY_STANDARD.schema,
  model: "prepared-photographic-full-sky-retained-css-cubemap",
  source: "ESO eso0932a all-sky panorama",
  sourceCredit: "ESO/S. Brunier",
  sourceLicense: "CC-BY-4.0",
  sourceMapSize: Object.freeze([PHOTO_WIDTH, PHOTO_HEIGHT]),
  faceSize: FACE_SIZE,
  faceSize2x: FACE_SIZE * 2,
  faces: Object.freeze(faces.map((face) => Object.freeze(face))),
  ...(astrometricSampling === null ? {
    centerRaDegrees: catalog.projection.centerRaDegrees,
    centerDecDegrees: catalog.projection.centerDecDegrees,
  } : {}),
  cameraPitchResponse: cameraContract?.rotationResponse ??
    CUBIC_SKY_STANDARD.cameraPitchResponse,
  cameraZoomResponse: cameraContract?.zoomResponse ??
    CUBIC_SKY_STANDARD.cameraZoomResponse,
  presentationPitchOffsetDegrees:
    CUBIC_SKY_STANDARD.presentationPitchOffsetDegrees,
  presentationYawOffsetDegrees:
    CUBIC_SKY_STANDARD.presentationYawOffsetDegrees,
  photographicLevels: Object.freeze({
    blackPoint: BLACK_POINT,
    gamma: LEVEL_GAMMA,
    gain: GAIN,
  }),
  ...(catalogueStars === null ? {} : {
    catalogueStars: Object.freeze({
      schema: catalogueStars.schema,
      model: catalogueStars.model,
      source: catalogueStars.source,
      // The photograph is the Milky Way's diffuse light only; every star
      // drawn comes from the catalogue, once: the stamped bands in the
      // faces, the retained band as points on the same cube.
      coexistence: "photograph-diffuse-only-catalogue-points-once",
      photographDetailGain,
      limitingMagnitude: catalogueStars.limitingMagnitude,
      exposure: catalogueStars.exposure,
      bands: catalogueStars.bands,
      count: catalogueStars.count,
      stampedCount: catalogueStars.count - catalogueStars.retainedCount,
      retainedCount: catalogueStars.retainedCount,
      retainedRadiusShareOfHalfSide: RETAINED_STAR_RADIUS_SHARE_OF_HALF_SIDE,
      retained: Object.freeze(catalogueStars.stars.filter((star) => star.presentation === "retained").map((star) => Object.freeze({
        hip: star.hip, name: star.name, magnitude: star.magnitude, band: star.band,
        direction: star.direction, radiusPx: star.retainedRadiusPx, luminance: star.luminance, color: star.color,
        transform: retainedStarTransform(star.direction),
      }))),
      // Named stars beyond the retained band are not carried: checks read
      // the catalogue itself.
      namedRetainedCount: catalogueStars.stars.filter((star) => star.name && star.presentation === "retained").length,
    }),
  }),
  photographicSeparation: Object.freeze({
    model: CUBIC_SKY_STANDARD.photographicSeparation.model,
    sourceSigmaPixels: DIFFUSE_SIGMA,
    diffuseGain: DIFFUSE_GAIN,
    detailGain: DETAIL_GAIN,
    evidence: "accepted Venus planet-first visual hierarchy",
    ...(pointSourceContract === null ? {} : {
      standardDiffuseGain: pointSourceContract.backgroundDiffuseGain,
      standardDetailGain: pointSourceContract.backgroundDetailGain,
    }),
  }),
  standardPresentation: CUBIC_SKY_STANDARD.standardPresentation,
  ...(astrometricSampling === null ? {
    photographicRegistration: Object.freeze({
      rotationDegrees: REGISTRATION_ROTATION_DEGREES,
      rotationOrder:
        "rotate-z-after-y-after-x-in-cubemap-local-direction-space",
    }),
  } : {
    astrometricRegistration: astrometricSampling,
  }),
  catalogRegistration: Object.freeze({
    source: "HYG Stellar Database v4.1",
    sourceLicense: "CC-BY-SA-4.0",
    role: astrometricSampling === null
      ? "coordinate-registration audit; photograph owns visible stars"
      : "retained source record only; the photograph is registered " +
        "astrometrically and owns visible stars",
  }),
  ...(cameraContract === null ? {} : {
    cameraContract: Object.freeze({ ...cameraContract }),
    ...(cameraContract.oracle === true ? {
      oracleCameraContract: Object.freeze({ ...cameraContract }),
    } : {}),
    projection: Object.freeze({
      axis: "horizontal",
      horizontalFovDegrees: cameraContract.horizontalFovDegrees,
      focalLengthOverViewportWidth:
        cameraContract.focalLengthOverViewportWidth,
      cssPerspective:
        `${cameraContract.focalLengthOverViewportWidth * 100}cqw`,
      runtimeProjection: false,
    }),
  }),
  ...(pointSourceContract === null ? {} : {
    pointSourcePresentation: Object.freeze({
      model: "prepared-diffuse-photograph-plus-compact-point-sources",
      selectedCount: pointSourceContract.drawCount,
      logicalPointFootprintPixels:
        pointSourceContract.logicalPointFootprintPixels,
      nativeOraclePointSizePixels:
        pointSourceContract.nativePointSizePixels,
      source: pointSourceContract.source,
      sourcePath: pointSourceContract.sourcePath,
      positionSource:
        "licensed ESO photographic local maxima; no Google catalogue bytes",
      runtimePointRendering: false,
      qualification:
        "native fixed-size catalogue behavior collapsed into the prepared " +
        "cubemap; point positions and colors remain ESO-derived",
    }),
  }),
  ...(includeSun ? { sun: Object.freeze({
    schema: PREPARED_CUBIC_SKY_SUN_SCHEMA,
    model: "google-source-levels-screen-baked-into-starfield",
    logicalSize: CUBIC_SKY_STANDARD.sun.logicalSize,
    presentationSize: CUBIC_SKY_STANDARD.sun.presentationSize,
    presentationAlphaGain: CUBIC_SKY_STANDARD.sun.presentationAlphaGain,
    presentationCoreGain: CUBIC_SKY_STANDARD.sun.presentationCoreGain,
    ...sunPresentation,
    billboard: false,
    bakedIntoStarfield: true,
    directionalRayCount: 0,
    sourceRayPeakCount: sunOracle.rayPeaks.length,
    coronaModel: "source-derived-median-and-levels-without-radial-mask",
    sourceMedianRadius: CUBIC_SKY_STANDARD.sun.sourceMedianRadius,
    sourceBlackPoint: CUBIC_SKY_STANDARD.sun.sourceBlackPoint,
    sourceLevelGamma: CUBIC_SKY_STANDARD.sun.sourceLevelGamma,
    ...projectDirectionToCubemapFace(sunPresentation.localDirection),
    projection: "prepared-direction-space-tangent-disc-over-all-cubemap-faces",
    zoomBinding: "entire-starfield-field-of-view",
    lightBinding: "shared-direction-with-prepared-terminator-phase-bank",
    runtimeRasterization: false,
    oracle: Object.freeze({
      canonicalUrl: sunOracle.canonicalUrl,
      observedAssetUrl: sunOracle.asset.url,
      observedAssetSha256: sunOracle.asset.sha256,
      bytesRedistributed: true,
      qualification:
        "Google source pixels with a 3 px median spike damping pass and " +
        "user-directed luminance cutoff; no radial mask; direction is " +
        "presentation-derived, not ephemeris-derived",
    }),
  }) } : {}),
  runtimeRasterization: false,
  orientation: "camera-rotation-only-no-translation-or-parallax",
  qualification:
    (astrometricSampling === null
      ? "source-photographed full sky; orientation is registered to Galactic " +
        `coordinates but no observer epoch or ${objectName} ephemeris is ` +
        "claimed; "
      : "source-photographed full sky sampled in ICRF through the J2000 " +
        "galactic frame and the anchor-registered panorama; the scene " +
        `registration carries the ${objectName} pole and epoch; Solar System ` +
        "objects in the mosaic are capture artefacts; ") +
    (includeSun
      ? "the external Sun is prepared into the cubemap"
      : "no Sun is baked into the cubemap"),
  hashes: Object.freeze(hashes),
});

await writeFile(
  preparedModulePath,
  "// Generated by tools/prepare-starfield.mjs from declared local sources.\n" +
    `export const PREPARED_${objectId.toUpperCase()}_STARFIELD = ` +
      `Object.freeze(${JSON.stringify(prepared)});\n`,
);
await rm(resolve(publicRoot, `${objectId}-starfield.webp`), {
  force: true,
});
console.log(
  `Prepared ${faces.length * 4} ${objectName} starfield cubemap images.`,
);
}

function preparePhotographicFace(
  face,
  faceSize,
  basis,
  registration,
  sourcePixels,
  diffusePixels,
  sourceInfo,
  detailGain,
  diffuseGain,
  astrometricMatrix = null,
) {
  const pixels = Buffer.alloc(faceSize * faceSize * 3);
  const matrix = ICRS_STANDARD_TO_GALACTIC;
  for (let y = 0; y < faceSize; y += 1) {
    const v = y / (faceSize - 1) * 2 - 1;
    for (let x = 0; x < faceSize; x += 1) {
      const u = x / (faceSize - 1) * 2 - 1;
      const [cameraX, cameraY, cameraZ] = cubeFaceDirection(face, u, v);
      const cameraLength = Math.hypot(cameraX, cameraY, cameraZ);
      const directionX = cameraX / cameraLength;
      const directionY = cameraY / cameraLength;
      const directionZ = cameraZ / cameraLength;
      let galacticX;
      let galacticY;
      let galacticZ;
      if (astrometricMatrix !== null) {
        // Cube-local direction is an ICRF direction; the matrix takes it
        // straight into the panorama's galactic frame.
        galacticX = astrometricMatrix[0] * directionX +
          astrometricMatrix[1] * directionY + astrometricMatrix[2] * directionZ;
        galacticY = astrometricMatrix[3] * directionX +
          astrometricMatrix[4] * directionY + astrometricMatrix[5] * directionZ;
        galacticZ = clamp(
          astrometricMatrix[6] * directionX + astrometricMatrix[7] * directionY +
            astrometricMatrix[8] * directionZ,
          -1,
          1,
        );
      } else {
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
        galacticX = matrix[0] * equatorialX +
          matrix[1] * equatorialZ + matrix[2] * equatorialY;
        galacticY = matrix[3] * equatorialX +
          matrix[4] * equatorialZ + matrix[5] * equatorialY;
        galacticZ = clamp(
          matrix[6] * equatorialX + matrix[7] * equatorialZ +
            matrix[8] * equatorialY,
          -1,
          1,
        );
      }
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
        detailGain,
        diffuseGain,
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
  detailGain,
  diffuseGain,
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
  const sourceLuminance = 0.2126 * sampled[0] + 0.7152 * sampled[1] +
    0.0722 * sampled[2];
  const diffuseLuminance = 0.2126 * sampledDiffuse[0] +
    0.7152 * sampledDiffuse[1] + 0.0722 * sampledDiffuse[2];
  const normalizedLuminance = normalizedStarfieldLuminance(sourceLuminance);
  const normalizedDiffuse = normalizedStarfieldLuminance(diffuseLuminance);
  const separatedLuminance = clamp(
    normalizedDiffuse * diffuseGain +
      (normalizedLuminance - normalizedDiffuse) * detailGain,
    0,
    1,
  );
  const preparedLuminance = Math.pow(separatedLuminance, LEVEL_GAMMA) *
    255 * GAIN;
  const luminanceGain = sourceLuminance === 0
    ? 0
    : preparedLuminance / sourceLuminance;
  for (let channel = 0; channel < 3; channel += 1) {
    target[targetOffset + channel] = Math.round(clamp(
      sampled[channel] * luminanceGain,
      0,
      255,
    ));
  }
}

function selectPhotographicPointSources(preparedFaces, drawCount, faceSize) {
  const candidates = [];
  for (const {
    id,
    photographicStandardPixels,
    pointSelectionPixels,
  } of preparedFaces) {
    for (let y = 1; y < faceSize - 1; y += 1) {
      for (let x = 1; x < faceSize - 1; x += 1) {
        const index = y * faceSize + x;
        const score = pointSourceScore(
          photographicStandardPixels,
          pointSelectionPixels,
          index,
        );
        if (score <= 0) continue;
        let localMaximum = true;
        for (let offsetY = -1; offsetY <= 1 && localMaximum; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            const neighborIndex =
              (y + offsetY) * faceSize + x + offsetX;
            const neighborScore = pointSourceScore(
              photographicStandardPixels,
              pointSelectionPixels,
              neighborIndex,
            );
            if (neighborScore > score ||
                (neighborScore === score && neighborIndex < index)) {
              localMaximum = false;
              break;
            }
          }
        }
        if (!localMaximum) continue;
        const pixelOffset = index * 3;
        candidates.push({
          face: id,
          x,
          y,
          score,
          color: [
            photographicStandardPixels[pixelOffset],
            photographicStandardPixels[pixelOffset + 1],
            photographicStandardPixels[pixelOffset + 2],
          ],
        });
      }
    }
  }
  candidates.sort((left, right) =>
    right.score - left.score ||
    FACE_IDS.indexOf(left.face) - FACE_IDS.indexOf(right.face) ||
    left.y - right.y || left.x - right.x);
  if (candidates.length < drawCount) {
    throw new Error(
      `Photographic sky exposed ${candidates.length} point sources; ` +
      `${drawCount} are required.`,
    );
  }
  const selected = candidates.slice(0, drawCount);
  return new Map(FACE_IDS.map((face) => [
    face,
    selected.filter((candidate) => candidate.face === face),
  ]));
}

function applyPreparedPointSources({
  pixels,
  faceSize,
  density,
  pointSources,
  logicalPointFootprintPixels,
}) {
  const footprint = logicalPointFootprintPixels * density;
  for (const pointSource of pointSources) {
    const centerX = (pointSource.x + 0.5) * density - 0.5;
    const centerY = (pointSource.y + 0.5) * density - 0.5;
    const startX = Math.round(centerX - (footprint - 1) / 2);
    const startY = Math.round(centerY - (footprint - 1) / 2);
    for (let y = startY; y < startY + footprint; y += 1) {
      if (y < 0 || y >= faceSize) continue;
      for (let x = startX; x < startX + footprint; x += 1) {
        if (x < 0 || x >= faceSize) continue;
        const offset = (y * faceSize + x) * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          pixels[offset + channel] = Math.max(
            pixels[offset + channel],
            pointSource.color[channel],
          );
        }
      }
    }
  }
  return pixels;
}

function pointSourceScore(photographicPixels, diffusePixels, pixelIndex) {
  const offset = pixelIndex * 3;
  return rgbLuminance(photographicPixels, offset) -
    rgbLuminance(diffusePixels, offset);
}

function rgbLuminance(pixels, offset) {
  return 0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] +
    0.0722 * pixels[offset + 2];
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
  const floorY = Math.floor(sourceY);
  const y0 = clamp(floorY, 0, height - 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = sourceX - floorX;
  const ty = sourceY - floorY;
  return [0, 1, 2].map((channel) => mix(
    mix(
      source[(y0 * width + x0) * 3 + channel],
      source[(y0 * width + x1) * 3 + channel],
      tx,
    ),
    mix(
      source[(y1 * width + x0) * 3 + channel],
      source[(y1 * width + x1) * 3 + channel],
      tx,
    ),
    ty,
  ));
}

function normalizedStarfieldLuminance(luminance) {
  return clamp((luminance - BLACK_POINT) / (255 - BLACK_POINT), 0, 1);
}

async function prepareWrappedDiffuse(source, info) {
  const padding = Math.ceil(DIFFUSE_SIGMA * 4);
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
  }).blur(DIFFUSE_SIGMA).extract({
    left: padding,
    top: 0,
    width: info.width,
    height: info.height,
  }).raw().toBuffer();
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

// Paints the stamped bands into a face: each star a small Gaussian at its
// face pixel, its peak the chain's luminance in the star's colour, added to
// the diffuse photograph and clamped. Sub-pixel radii (the faint bands)
// become a single softened pixel, which the face's own upscaling spreads to
// about what a faint star should be on screen.
function stampCatalogueStars({ faceId, facePixels, faceSize, density, stars }) {
  // Face pixels per screen pixel at the face centre: a face spans 90
  // degrees over faceSize pixels against the stage's 60-degree field.
  const facePixelsPerScreenPixel = (faceSize / 2) / (1247 / density * Math.tan(Math.PI / 4)) * (1 / density);
  for (const star of stars) {
    if (star.presentation !== "stamped") continue;
    const { face, u, v } = cubeFaceOf(star.direction);
    if (face !== faceId) continue;
    const centreX = (u + 1) / 2 * (faceSize - 1);
    const centreY = (v + 1) / 2 * (faceSize - 1);
    const sigma = Math.max(0.55, star.rawRadiusPx * facePixelsPerScreenPixel * density * 0.6);
    const reach = Math.ceil(sigma * 2.5);
    for (let y = Math.max(0, Math.floor(centreY - reach)); y <= Math.min(faceSize - 1, Math.ceil(centreY + reach)); y += 1) {
      for (let x = Math.max(0, Math.floor(centreX - reach)); x <= Math.min(faceSize - 1, Math.ceil(centreX + reach)); x += 1) {
        const distance = Math.hypot(x - centreX, y - centreY);
        const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma)) * star.luminance;
        if (weight < 1 / 255) continue;
        const offset = (y * faceSize + x) * 3;
        facePixels[offset] = Math.min(255, facePixels[offset] + Math.round(star.color[0] * weight));
        facePixels[offset + 1] = Math.min(255, facePixels[offset + 1] + Math.round(star.color[1] * weight));
        facePixels[offset + 2] = Math.min(255, facePixels[offset + 2] + Math.round(star.color[2] * weight));
      }
    }
  }
}

function cubeFaceDirection(face, u, v) {
  if (face === "front") return [u, v, -1];
  if (face === "right") return [1, v, u];
  if (face === "back") return [-u, v, 1];
  if (face === "left") return [-1, v, -u];
  if (face === "top") return [u, -1, -v];
  return [u, 1, v];
}

function rotationMatrix({ x, y, z }) {
  const columns = [
    rotateEuler([1, 0, 0], x, y, z),
    rotateEuler([0, 1, 0], x, y, z),
    rotateEuler([0, 0, 1], x, y, z),
  ];
  return [
    columns[0][0], columns[1][0], columns[2][0],
    columns[0][1], columns[1][1], columns[2][1],
    columns[0][2], columns[1][2], columns[2][2],
  ];
}

function rotateEuler(direction, x, y, z) {
  return rotateZ(rotateY(rotateX(direction, x), y), z);
}

function rotateX([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function modulo(value, divisor) {
  return (value % divisor + divisor) % divisor;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
