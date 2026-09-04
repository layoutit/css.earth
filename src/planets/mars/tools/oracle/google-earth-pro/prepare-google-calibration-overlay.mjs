import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const calibrationRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/calibration",
);
const sourceManifestPath = resolve(calibrationRoot, "manifest.json");
const googleManifestPath = resolve(calibrationRoot, "google/manifest.json");
const outputPath = resolve(process.argv[2] ??
  "output/playwright/google-earth-pro-mars-interaction-video-v1/" +
  "native-registration/calibration-overlay.kml");
const manifestPath = outputPath.replace(/\.kml$/u, ".json");
const [sourceManifest, googleManifest] = await Promise.all([
  readJson(sourceManifestPath),
  readJson(googleManifestPath),
]);
const selectedLevel = googleManifest.maximumLevel;
const tiles = googleManifest.tiles.filter(({ level }) =>
  level === selectedLevel);
if (tiles.length !== 128 || selectedLevel !== 3) {
  throw new Error("Expected the checked 128-tile z3 calibration derivative.");
}
const overlays = tiles.map((tile) => {
  const [west, east] = tile.longitudeRangeDegrees;
  const [south, north] = tile.latitudeRangeDegrees;
  const href = xml(pathToFileURL(resolve(calibrationRoot, tile.path)).href);
  return [
    "    <GroundOverlay>",
    `      <name>cal-z${tile.level}-x${tile.x}-y${tile.y}</name>`,
    "      <visibility>1</visibility>",
    "      <drawOrder>100</drawOrder>",
    `      <Icon><href>${href}</href></Icon>`,
    "      <altitudeMode>clampToGround</altitudeMode>",
    "      <LatLonBox>",
    `        <north>${north}</north>`,
    `        <south>${south}</south>`,
    `        <east>${east}</east>`,
    `        <west>${west}</west>`,
    "        <rotation>0</rotation>",
    "      </LatLonBox>",
    "    </GroundOverlay>",
  ].join("\n");
});
const kml = [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<kml xmlns=\"http://www.opengis.net/kml/2.2\">",
  "  <Document>",
  "    <name>cssMars deterministic calibration surface</name>",
  "    <visibility>1</visibility>",
  ...overlays,
  "  </Document>",
  "</kml>",
  "",
].join("\n");
const kmlBytes = Buffer.from(kml);
const manifest = Object.freeze({
  schema: "cssmars-google-earth-pro-calibration-overlay@1",
  qualification: "PREPARED_EXPLICIT_GEOGRAPHIC_CALIBRATION_BINDING",
  outputPath,
  kmlSha256: sha256(kmlBytes),
  sourceManifestPath,
  sourceDecodedRgbaSha256: sourceManifest.source.decodedRgbaSha256,
  googleManifestPath,
  projection: googleManifest.projection,
  addressing: googleManifest.addressing,
  level: selectedLevel,
  tileCount: tiles.length,
  runtimePreparation: false,
  tiles: Object.freeze(tiles.map((tile) => Object.freeze({
    level: tile.level,
    x: tile.x,
    y: tile.y,
    path: resolve(calibrationRoot, tile.path),
    decodedRgbaSha256: tile.decodedRgbaSha256,
    longitudeRangeDegrees: tile.longitudeRangeDegrees,
    latitudeRangeDegrees: tile.latitudeRangeDegrees,
  }))),
});
await mkdir(dirname(outputPath), { recursive: true });
await Promise.all([
  writeFile(outputPath, kmlBytes),
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
]);
process.stdout.write(`${JSON.stringify({
  ok: true,
  outputPath,
  manifestPath,
  qualification: manifest.qualification,
  kmlSha256: manifest.kmlSha256,
  sourceDecodedRgbaSha256: manifest.sourceDecodedRgbaSha256,
  tileCount: manifest.tileCount,
}, null, 2)}\n`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function xml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
