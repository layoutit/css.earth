#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  SUN_PUBLIC_ROOT,
  SUN_SOURCE_ROOT,
  ensureSunPreparationDirectories,
} from "./preparation-paths.mjs";
import { validateSunSourceGroup } from "./source-manifest.mjs";

const outputArgument = process.argv.find((argument) =>
  argument.startsWith("--output="));
const outputRoot = outputArgument
  ? resolve(outputArgument.slice("--output=".length))
  : SUN_PUBLIC_ROOT;

await preparePlanetCubicSky({
  objectId: "sun",
  sourceRoot: SUN_SOURCE_ROOT,
  publicRoot: outputRoot,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: outputArgument
    ? () => mkdir(outputRoot, { recursive: true })
    : ensureSunPreparationDirectories,
  validateSourceGroup: validateSunSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
