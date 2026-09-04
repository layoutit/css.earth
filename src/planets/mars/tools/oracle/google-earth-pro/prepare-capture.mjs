import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createMarsNativeCaptureKml,
  GOOGLE_EARTH_PRO_MARS_ORACLE,
  GOOGLE_EARTH_PRO_MARS_POSES,
} from "./profile.mjs";

const outputRoot = resolve(
  process.argv[2] ??
    `output/playwright/google-earth-pro-mars-oracle-${timestampSlug()}`,
);
const nativeRoot = resolve(outputRoot, "native");
const browserRoot = resolve(outputRoot, "browser");
const componentRoot = resolve(outputRoot, "components");

await Promise.all([
  mkdir(resolve(nativeRoot, "captures"), { recursive: true }),
  mkdir(browserRoot, { recursive: true }),
  mkdir(componentRoot, { recursive: true }),
]);

const profilePath = resolve(outputRoot, "capture-contract.json");
const kmlPath = resolve(nativeRoot, "mars-oracle-sweep.kml");
const nativeManifestPath = resolve(nativeRoot, "capture-manifest.json");
const nativeManifest = {
  schema: "cssmars-google-earth-pro-native-capture@1",
  qualification: "AWAITING_NATIVE_CAPTURE",
  oracleProfile: GOOGLE_EARTH_PRO_MARS_ORACLE,
  fixedTimeUtc: GOOGLE_EARTH_PRO_MARS_ORACLE.capture.fixedTimeUtc,
  application: GOOGLE_EARTH_PRO_MARS_ORACLE.application,
  contentSize: GOOGLE_EARTH_PRO_MARS_ORACLE.capture.nativeContentSize,
  chromeHidden: null,
  animationSettled: null,
  displayScaleFactor: null,
  poses: GOOGLE_EARTH_PRO_MARS_POSES.map((entry) => ({
    ...entry,
    capture: null,
    stability: null,
    observedCamera: null,
    browserCamera: null,
  })),
};

await Promise.all([
  writeFile(
    profilePath,
    `${JSON.stringify({
      ...GOOGLE_EARTH_PRO_MARS_ORACLE,
      poses: GOOGLE_EARTH_PRO_MARS_POSES,
    }, null, 2)}\n`,
  ),
  writeFile(kmlPath, createMarsNativeCaptureKml()),
  writeFile(nativeManifestPath, `${JSON.stringify(nativeManifest, null, 2)}\n`),
]);

process.stdout.write(`${JSON.stringify({
  ok: true,
  outputRoot,
  poseCount: GOOGLE_EARTH_PRO_MARS_POSES.length,
  captureContract: profilePath,
  nativeSweepKml: kmlPath,
  nativeManifest: nativeManifestPath,
  next:
    "Launch the bound Google Earth Pro build, switch to Mars, import the KML, hide chrome, settle each endpoint, and populate the native manifest.",
}, null, 2)}\n`);

function timestampSlug() {
  return new Date().toISOString()
    .replaceAll(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z");
}
