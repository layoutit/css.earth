#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  analyzeScenePng,
  classifySceneLod,
} from "./image-analysis.mjs";
import {
  deriveBrowserCamera,
  ORACLE_SCENE_CLIP,
  ORACLE_VIEWPORT,
} from "./profile.mjs";

const evidenceRoot = resolve(process.argv[2] ??
  "output/playwright/venus-google-sun-proper-sweep-20260901-v6");
const frameDirectory = process.argv[3] ?? "google/frames";
const sourcePath = resolve(
  "src/planets/venus/source/stars/eso0932a.tif",
);
const SAMPLE_WIDTH = 48;
const SAMPLE_HEIGHT = 30;
const DEFAULT_GOOGLE_CAMERA = Object.freeze({
  latitude: 0,
  longitude: -58.4515826,
  range: 22_963_938,
  rangeUnit: "m",
  tilt: 0,
  heading: 0,
});
const SAMPLE_LATITUDES = Object.freeze([-45, -15, 15, 45]);
const SAMPLE_LONGITUDES = Object.freeze([0, 60, 120, 180, 240, 300]);
const CATALOG_CENTER_RA_DEGREES = 40;
const CATALOG_CENTER_DEC_DEGREES = 7;
const PRESENTATION_YAW_DEGREES = 66;
const PRESENTATION_PITCH_DEGREES = -20;
const CAMERA_PITCH_RESPONSE = -1.7;
const DEFAULT_CONTROL_PITCH = 34.230769230769226;
const MAXIMUM_CONTROL_PITCH = 89;
const INITIAL_SCENE_PITCH = 40;
const basis = equatorialBasis();

const photo = await sharp(sourcePath).greyscale().raw()
  .toBuffer({ resolveWithObject: true });
if (photo.info.width !== 6000 || photo.info.height !== 3000 ||
    photo.info.channels !== 1) {
  throw new TypeError("ESO full-sky calibration source is incompatible.");
}

const frames = [];
for (const latitude of SAMPLE_LATITUDES) {
  for (const longitude of SAMPLE_LONGITUDES) {
    const id = endpointId(latitude, longitude);
    const bytes = await readFile(resolve(
      evidenceRoot,
      frameDirectory,
      `${id}.png`,
    ));
    if (!classifySceneLod(bytes).comparableSpaceScene) continue;
    frames.push(await prepareFrame(bytes, latitude, longitude));
  }
}
if (frames.length < 18) {
  throw new Error(`Only ${frames.length} comparable calibration frames.`);
}

const coarse = [];
for (let x = -180; x < 180; x += 30) {
  for (let y = -180; y < 180; y += 30) {
    for (let z = -180; z < 180; z += 30) {
      coarse.push({ x, y, z, score: scoreRotation(x, y, z) });
    }
  }
}
coarse.sort((left, right) => right.score - left.score);
let best = coarse[0];
for (const step of [15, 5, 2, 1, 0.5]) {
  let improved = true;
  while (improved) {
    improved = false;
    const candidates = [];
    for (const dx of [-step, 0, step]) {
      for (const dy of [-step, 0, step]) {
        for (const dz of [-step, 0, step]) {
          const candidate = {
            x: normalizeDegrees(best.x + dx),
            y: normalizeDegrees(best.y + dy),
            z: normalizeDegrees(best.z + dz),
          };
          candidate.score = scoreRotation(candidate.x, candidate.y, candidate.z);
          candidates.push(candidate);
        }
      }
    }
    candidates.sort((left, right) => right.score - left.score);
    if (candidates[0].score > best.score + 1e-8) {
      best = candidates[0];
      improved = true;
    }
  }
}

process.stdout.write(`${JSON.stringify({
  schema: "cssvenus-starfield-photo-registration-calibration@1",
  qualification: "GOOGLE_SCREEN_EVIDENCE_FIT_SOURCE_PHOTO_NOT_GOOGLE_BYTES",
  evidenceRoot,
  frameDirectory,
  sourcePath,
  sampleFrameCount: frames.length,
  sampleGrid: {
    latitudes: SAMPLE_LATITUDES,
    longitudes: SAMPLE_LONGITUDES,
    width: SAMPLE_WIDTH,
    height: SAMPLE_HEIGHT,
    excluded: ["planet silhouette", "Sun and other pixels above 80 luminance"],
  },
  rotationOrder: "rotate-z-after-y-after-x-in-cubemap-local-direction-space",
  identityScore: scoreRotation(0, 0, 0),
  best,
  topCoarse: coarse.slice(0, 12),
}, null, 2)}\n`);

async function prepareFrame(bytes, latitude, longitude) {
  const analysis = analyzeScenePng(bytes);
  const actual = await sharp(bytes)
    .resize(SAMPLE_WIDTH, SAMPLE_HEIGHT, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const camera = deriveBrowserCamera({
    latitude,
    longitude,
    range: 23_003_602,
    rangeUnit: "m",
    tilt: 0,
    heading: 0,
  }, DEFAULT_GOOGLE_CAMERA);
  const renderedPitch = INITIAL_SCENE_PITCH * (1 -
    (camera.controlPitch - DEFAULT_CONTROL_PITCH) /
      (MAXIMUM_CONTROL_PITCH - DEFAULT_CONTROL_PITCH));
  const skyboxPitch = INITIAL_SCENE_PITCH + CAMERA_PITCH_RESPONSE *
    (renderedPitch - INITIAL_SCENE_PITCH) + PRESENTATION_PITCH_DEGREES;
  const valid = [];
  const directions = [];
  const actualLog = [];
  const perspective = 0.8660254 * ORACLE_VIEWPORT.height;
  for (let y = 0; y < SAMPLE_HEIGHT; y += 1) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      const screenX = ORACLE_SCENE_CLIP.x +
        (x + 0.5) / SAMPLE_WIDTH * ORACLE_SCENE_CLIP.width;
      const screenY = ORACLE_SCENE_CLIP.y +
        (y + 0.5) / SAMPLE_HEIGHT * ORACLE_SCENE_CLIP.height;
      const planetDistance = Math.hypot(
        screenX - (analysis.silhouette.center.x + ORACLE_SCENE_CLIP.x),
        screenY - (analysis.silhouette.center.y + ORACLE_SCENE_CLIP.y),
      );
      const value = actual[y * SAMPLE_WIDTH + x];
      const included = planetDistance > analysis.silhouette.radiusX * 1.12 &&
        value <= 80;
      valid.push(included);
      actualLog.push(Math.log1p(value));
      const view = normalize([
        screenX - ORACLE_VIEWPORT.width / 2,
        screenY - ORACLE_VIEWPORT.height / 2,
        -perspective,
      ]);
      directions.push(rotateZ(
        rotateX(
          rotateY(view, camera.controlYaw),
          -skyboxPitch,
        ),
        -PRESENTATION_YAW_DEGREES,
      ));
    }
  }
  const actualStats = centeredStats(actualLog, valid);
  return Object.freeze({
    valid: Object.freeze(valid),
    directions: Object.freeze(directions),
    actualCentered: Object.freeze(actualStats.centered),
    actualNorm: actualStats.norm,
  });
}

function scoreRotation(xDegrees, yDegrees, zDegrees) {
  const rotation = rotationMatrix(xDegrees, yDegrees, zDegrees);
  let total = 0;
  for (const frame of frames) {
    const predicted = frame.directions.map((direction) =>
      Math.log1p(samplePhoto(transform(rotation, direction))));
    const predictedStats = centeredStats(predicted, frame.valid);
    let dot = 0;
    for (let index = 0; index < predicted.length; index += 1) {
      if (!frame.valid[index]) continue;
      dot += predictedStats.centered[index] * frame.actualCentered[index];
    }
    total += dot / Math.max(1e-9, predictedStats.norm * frame.actualNorm);
  }
  return total / frames.length;
}

function samplePhoto(direction) {
  const equatorial = cameraToEquatorial(direction);
  const standardX = equatorial[0];
  const standardY = equatorial[2];
  const standardZ = equatorial[1];
  const galacticX = -0.0548755604 * standardX -
    0.8734370902 * standardY - 0.4838350155 * standardZ;
  const galacticY = 0.4941094279 * standardX -
    0.44482963 * standardY + 0.7469822445 * standardZ;
  const galacticZ = clamp(-0.867666149 * standardX -
    0.1980763734 * standardY + 0.4559837762 * standardZ, -1, 1);
  const sourceX = Math.floor((Math.PI - Math.atan2(galacticY, galacticX)) /
    (2 * Math.PI) * photo.info.width);
  const sourceY = Math.floor((Math.PI / 2 - Math.asin(galacticZ)) /
    Math.PI * photo.info.height);
  return photo.data[clamp(sourceY, 0, photo.info.height - 1) *
    photo.info.width + modulo(sourceX, photo.info.width)];
}

function cameraToEquatorial(direction) {
  return normalize([
    basis.right[0] * direction[0] - basis.up[0] * direction[1] -
      basis.forward[0] * direction[2],
    basis.right[1] * direction[0] - basis.up[1] * direction[1] -
      basis.forward[1] * direction[2],
    basis.right[2] * direction[0] - basis.up[2] * direction[1] -
      basis.forward[2] * direction[2],
  ]);
}

function equatorialBasis() {
  const rightAscension = CATALOG_CENTER_RA_DEGREES * Math.PI / 180;
  const declination = CATALOG_CENTER_DEC_DEGREES * Math.PI / 180;
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

function rotationMatrix(x, y, z) {
  return [
    transformEuler([1, 0, 0], x, y, z),
    transformEuler([0, 1, 0], x, y, z),
    transformEuler([0, 0, 1], x, y, z),
  ];
}

function transformEuler(direction, x, y, z) {
  return rotateZ(rotateY(rotateX(direction, x), y), z);
}

function transform(matrix, direction) {
  return [
    matrix[0][0] * direction[0] + matrix[1][0] * direction[1] +
      matrix[2][0] * direction[2],
    matrix[0][1] * direction[0] + matrix[1][1] * direction[1] +
      matrix[2][1] * direction[2],
    matrix[0][2] * direction[0] + matrix[1][2] * direction[1] +
      matrix[2][2] * direction[2],
  ];
}

function centeredStats(values, valid) {
  let sum = 0;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (!valid[index]) continue;
    sum += values[index];
    count += 1;
  }
  const mean = sum / count;
  const centered = values.map((value, index) => valid[index] ? value - mean : 0);
  const norm = Math.sqrt(centered.reduce((total, value) =>
    total + value * value, 0));
  return { centered, norm };
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

function endpointId(latitude, longitude) {
  const latitudeId = latitude < 0 ? `m${Math.abs(latitude)}` :
    latitude > 0 ? `p${latitude}` : "z0";
  return `angular-r23003602-lat${latitudeId}-lon${String(longitude)
    .padStart(3, "0")}`;
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function normalizeDegrees(value) {
  return modulo(value + 180, 360) - 180;
}

function modulo(value, divisor) {
  return (value % divisor + divisor) % divisor;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
