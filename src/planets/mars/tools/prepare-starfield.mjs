#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureMarsPreparationDirectories,
  MARS_PUBLIC_ROOT,
  MARS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMarsSourceGroup } from "./source-manifest.mjs";

const googleEarthContract = JSON.parse(await readFile(new URL(
  "../source/sky/google-earth-pro-contract.json",
  import.meta.url,
), "utf8"));
const projection = googleEarthContract.camera.projection;
const catalogue = googleEarthContract.sky.catalogue;

await preparePlanetCubicSky({
  objectId: "mars",
  sourceRoot: MARS_SOURCE_ROOT,
  publicRoot: MARS_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureMarsPreparationDirectories,
  validateSourceGroup: validateMarsSourceGroup,
  includeSun: false,
  cameraContract: Object.freeze({
    oracle: true,
    source: "Google Earth Pro Mars native render contract",
    sourcePath: "source/sky/google-earth-pro-contract.json",
    rotationResponse:
      googleEarthContract.camera.cubicTransport.rotationResponse,
    zoomResponse: googleEarthContract.camera.cubicTransport.zoomResponse,
    horizontalFovDegrees: projection.horizontalFovDegrees,
    focalLengthOverViewportWidth: projection.focalX / 2,
    qualification:
      "201 native headless samples; licensed ESO pixels replace Google sky bytes",
  }),
  pointSourceContract: Object.freeze({
    source: "Google Earth Pro Mars fixed-size catalogue draw contract",
    sourcePath: "source/sky/google-earth-pro-contract.json",
    drawCount: catalogue.drawCount,
    nativePointSizePixels: catalogue.pointSizePixels,
    logicalPointFootprintPixels: 1,
    backgroundDiffuseGain: 0.68,
    backgroundDetailGain: 0.4,
  }),
});
