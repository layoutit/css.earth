import { createHash } from "node:crypto";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { PREPARED_JUPITER_MOONS } from "../runtime/preparedMoons.mjs";
import { JUPITER_LIGHT_SOURCE_GEOMETRY } from "./prepare-atmosphere.mjs";
import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
  JUPITER_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await Promise.all([
  validateJupiterSourceGroup("rings"),
  validateJupiterSourceGroup("lighting"),
]);
await ensureJupiterPreparationDirectories();

const EQUATORIAL_RADIUS_KM = 71_492;
const POLAR_RADIUS_KM = 66_854;
const EQUATORIAL_RADIUS = 230;
const RETAINED_WORLD_UNITS_PER_PRESENTATION_UNIT = 50;
const ASSET_SIZE = 1_024;
const ASSET_SIZE_2X = ASSET_SIZE * 2;
const MAXIMUM_MAIN_ALPHA = 0.4;
const OPTICAL_DEPTH_EXPONENT = 0.65;
const SHADOW_LUMINANCE_MULTIPLIER = 0.65;
const MINIMUM_MAIN_PRESENTATION_WIDTH = 3;
const RING_TILE_GRID = 4;
const RING_TILE_OVERLAP_WORLD = 50;
const SOURCE_TABLE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "rings/pds-jupiter-rings-table.html",
);
const MAIN_HALO_CAPTION_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "rings/pds-pia00701.html",
);
const GOSSAMER_CAPTION_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "rings/pds-pia01623.html",
);
const OBSERVATION_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "rings/pia00701.jpg",
);
const OUTPUT_MODULE = new URL("../runtime/preparedRings.mjs", import.meta.url);

const [sourceTable, mainHaloCaption, gossamerCaption, observationMetadata] =
  await Promise.all([
    readFile(SOURCE_TABLE_PATH, "utf8"),
    readFile(MAIN_HALO_CAPTION_PATH, "utf8"),
    readFile(GOSSAMER_CAPTION_PATH, "utf8"),
    sharp(OBSERVATION_PATH).metadata(),
  ]);

const components = Object.freeze([
  ringComponent("Halo", 100_000, 122_400, "~10^-6", 1e-6, 10_000, []),
  ringComponent(
    "Main Ring",
    122_400,
    129_100,
    "< 8 x 10^-6",
    8e-6,
    100,
    ["Metis", "Adrastea"],
  ),
  ringComponent(
    "Amalthea Gossamer Ring",
    122_400,
    181_350,
    "~5 x 10^-7",
    5e-7,
    2_600,
    ["Amalthea"],
  ),
  ringComponent(
    "Thebe Gossamer Ring",
    122_400,
    221_900,
    "~10^-7",
    1e-7,
    8_800,
    ["Thebe"],
  ),
  ringComponent(
    "Thebe Extension",
    221_900,
    270_000,
    "~10^-9",
    1e-9,
    8_800,
    ["Thebe"],
  ),
]);
const innermostPreparedMoon = [
  ...PREPARED_JUPITER_MOONS.moons,
  ...PREPARED_JUPITER_MOONS.minorMoonDots,
].reduce((nearest, moon) => moon.orbitKm < nearest.orbitKm ? moon : nearest);
const io = PREPARED_JUPITER_MOONS.moons.find((moon) => moon.id === "io");
if (innermostPreparedMoon.id !== "metis" ||
    innermostPreparedMoon.orbitKm !== 128_000 ||
    innermostPreparedMoon.displayOrbitRadius !== 255 ||
    io?.orbitKm !== 421_800 || io.displayOrbitRadius !== 285 ||
    PREPARED_JUPITER_MOONS.presentation.orbitDistanceModel !==
      "logarithmic-compression-preserving-source-order") {
  throw new Error("Jupiter prepared ring and moon radial presentations drifted.");
}
assertSourceRows(sourceTable, components);
assertCaptionEvidence(mainHaloCaption, gossamerCaption);
if (observationMetadata.width !== 369 || observationMetadata.height !== 256) {
  throw new Error("Jupiter PIA00701 observation dimensions drifted.");
}

const halo = components[0];
const main = components[1];
const amalthea = components[2];
const thebe = components[3];
const extension = components[4];
const assetPlans = Object.freeze([Object.freeze({
  id: "system",
  filename: "jupiter-rings.webp",
  filename2x: "jupiter-rings@2x.webp",
  outerRadiusKm: extension.outerRadiusKm,
  outerPresentationRadius: presentationRingRadius(extension.outerRadiusKm),
  bands: components,
})]);

const assets = {};
for (const plan of assetPlans) {
  const data2x = renderRingAsset(plan, ASSET_SIZE_2X);
  const path2x = resolve(JUPITER_PUBLIC_ROOT, plan.filename2x);
  const path = resolve(JUPITER_PUBLIC_ROOT, plan.filename);
  await sharp(data2x, {
    raw: { width: ASSET_SIZE_2X, height: ASSET_SIZE_2X, channels: 4 },
  })
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toFile(path2x);
  await sharp(data2x, {
    raw: { width: ASSET_SIZE_2X, height: ASSET_SIZE_2X, channels: 4 },
  })
    .resize(ASSET_SIZE, ASSET_SIZE, { kernel: sharp.kernel.lanczos3 })
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toFile(path);
  assets[plan.id] = Object.freeze({
    id: plan.id,
    url: `/scenes/jupiter/${plan.filename}`,
    url2x: `/scenes/jupiter/${plan.filename2x}`,
    outerRadiusKm: plan.outerRadiusKm,
    outerPresentationRadius: plan.outerPresentationRadius,
    one: await assetDescriptor(path, ASSET_SIZE),
    two: await assetDescriptor(path2x, ASSET_SIZE_2X),
  });
}

const leafPlans = Object.freeze(ringTiles(assets.system));

const prepared = Object.freeze({
  schema: "cssjupiter-prepared-rings@2",
  sourceAuthority: Object.freeze({
    statistics: "NASA PDS Ring-Moon Systems Node vital statistics",
    statisticsPath: "source/rings/pds-jupiter-rings-table.html",
    mainHaloObservation: "NASA/JPL Galileo PIA00701",
    mainHaloCaptionPath: "source/rings/pds-pia00701.html",
    gossamerObservation: "NASA/JPL Galileo PIA01623",
    gossamerCaptionPath: "source/rings/pds-pia01623.html",
    observationPath: "source/rings/pia00701.jpg",
  }),
  system: Object.freeze({
    model: "three-part-jovian-ring-system-with-two-gossamer-components",
    parts: Object.freeze(["halo", "main", "gossamer"]),
    components,
    equatorialRadiusKm: EQUATORIAL_RADIUS_KM,
    equatorialRadius: EQUATORIAL_RADIUS,
    radialPresentation: Object.freeze({
      model: "same-prepared-logarithmic-inner-system-map-as-jupiter-moons",
      retainedWorldUnitsPerPresentationUnit:
        RETAINED_WORLD_UNITS_PER_PRESENTATION_UNIT,
      anchors: Object.freeze([
        Object.freeze({
          id: "jupiter-equator",
          sourceRadiusKm: EQUATORIAL_RADIUS_KM,
          presentationRadius: EQUATORIAL_RADIUS,
        }),
        Object.freeze({
          id: innermostPreparedMoon.id,
          sourceRadiusKm: innermostPreparedMoon.orbitKm,
          presentationRadius: innermostPreparedMoon.displayOrbitRadius,
        }),
        Object.freeze({
          id: io.id,
          sourceRadiusKm: io.orbitKm,
          presentationRadius: io.displayOrbitRadius,
        }),
      ]),
      sourceOrderPreserved: true,
      runtimeMapping: false,
    }),
  }),
  presentation: Object.freeze({
    model: "prepared-source-bounded-low-opacity-log-depth-visibility",
    sourceColorModel: "Galileo-clear-filter-neutral-monochrome",
    maximumMainAlpha: MAXIMUM_MAIN_ALPHA,
    opticalDepthExponent: OPTICAL_DEPTH_EXPONENT,
    minimumMainRingPresentationWidth: MINIMUM_MAIN_PRESENTATION_WIDTH,
    qualification:
      "low-opacity visibility emphasis preserving measured radial bounds and optical-depth ordering",
    haloModel: "prepared-optical-depth-composite-with-source-thickness-metadata",
    gossamerModel:
      "prepared-optical-depth-composite-with-edge-to-center-two-to-one-brightness",
    verticalPresentation:
      "source-thickness-retained-as-metadata-without-stacked-transparent-planes",
    tileGrid: RING_TILE_GRID,
    tileOverlapWorld: RING_TILE_OVERLAP_WORLD,
    runtimeGeometry: false,
    runtimeRasterization: false,
  }),
  shadow: Object.freeze({
    model: "prepared-ray-to-oblate-jupiter-ring-transmission",
    solarLongitudeDegrees:
      JUPITER_LIGHT_SOURCE_GEOMETRY.solarLongitudeDegrees,
    solarLatitudeDegrees:
      JUPITER_LIGHT_SOURCE_GEOMETRY.solarLatitudeDegrees,
    physicalDirectTransmission: 0,
    presentationLuminanceMultiplier: SHADOW_LUMINANCE_MULTIPLIER,
    qualification:
      "prepared luminance reduction preserving the complete ring silhouette",
    sourceObservation: "PIA00701 ring and halo truncation in Jupiter shadow",
    runtimeShadow: false,
  }),
  assets: Object.freeze(assets),
  leaves: leafPlans,
  retainedDom: Object.freeze({
    transformGroupCount: 1,
    leafCount: leafPlans.length,
    maximumLeafWorldSize: Number((
      presentationRingRadius(extension.outerRadiusKm) * 2 *
      RETAINED_WORLD_UNITS_PER_PRESENTATION_UNIT / RING_TILE_GRID +
      RING_TILE_OVERLAP_WORLD
    ).toFixed(6)),
    stackedTransparentPlaneCount: 0,
    runtimeTopology: false,
  }),
});

await writeFile(
  OUTPUT_MODULE,
  "// Generated by tools/prepare-rings.mjs. Do not edit by hand.\n" +
    `export const PREPARED_JUPITER_RINGS = ${JSON.stringify(prepared)};\n`,
);
for (const filename of await readdir(JUPITER_PUBLIC_ROOT)) {
  if (/^jupiter-ring-(?:main|halo|amalthea-gossamer|thebe-gossamer)(?:@2x)?\.webp$/u
    .test(filename)) {
    await unlink(resolve(JUPITER_PUBLIC_ROOT, filename));
  }
}
console.log(
  `Prepared Jupiter rings: ${prepared.leaves.length} retained leaves, ` +
  `${Object.values(assets).reduce((total, asset) =>
    total + asset.one.bytes + asset.two.bytes, 0)} bytes.`,
);

function ringComponent(
  name,
  innerRadiusKm,
  outerRadiusKm,
  opticalDepthText,
  opticalDepth,
  verticalThicknessKm,
  associatedMoons,
) {
  return Object.freeze({
    name,
    innerRadiusKm,
    outerRadiusKm,
    opticalDepthText,
    opticalDepth,
    verticalThicknessKm,
    associatedMoons: Object.freeze(associatedMoons),
  });
}

function assertSourceRows(html, expectedComponents) {
  for (const component of expectedComponents) {
    const start = html.indexOf(`<td>${component.name}</td>`);
    const end = html.indexOf("</tr>", start);
    if (start < 0 || end < 0) {
      throw new Error(`Jupiter PDS ring row is missing: ${component.name}.`);
    }
    const cells = [...html.slice(start, end).matchAll(
      /<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gu,
    )].map((match) => stripHtml(match[1]));
    const expected = [
      component.name,
      component.innerRadiusKm.toLocaleString("en-US"),
      component.outerRadiusKm.toLocaleString("en-US"),
      component.opticalDepthText,
      component.verticalThicknessKm >= 10_000
        ? `~${component.verticalThicknessKm.toLocaleString("en-US")}`
        : String(component.verticalThicknessKm),
      "Tenuous, broad",
      component.associatedMoons.join(", "),
    ];
    if (cells.length < expected.length || expected.some((value, index) =>
      cells[index] !== value)) {
      throw new Error(`Jupiter PDS ring row drifted: ${component.name}.`);
    }
  }
}

function assertCaptionEvidence(mainCaption, gossamerObservation) {
  const mainText = stripHtml(mainCaption);
  const gossamerText = stripHtml(gossamerObservation);
  for (const evidence of [
    "a flat main ring, a lenticular halo interior to the main ring, and the gossamer ring, outside the main ring",
    "abruptly truncated close to the planet, at the point where it passes into Jupiter’s shadow",
    "A faint mist of particles can be seen above and below the main rings",
  ]) {
    if (!mainText.includes(evidence)) {
      throw new Error(`Jupiter PIA00701 evidence drifted: ${evidence}.`);
    }
  }
  for (const evidence of [
    "about twice as bright as the central region",
    "only seen to precisely the orbital distance of Amalthea",
    "another faint but wider stripe",
  ]) {
    if (!gossamerText.includes(evidence)) {
      throw new Error(`Jupiter PIA01623 evidence drifted: ${evidence}.`);
    }
  }
}

function stripHtml(value) {
  return value
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&nbsp;", " ")
    .replaceAll(" ", " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function renderRingAsset(plan, size) {
  const data = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const pixelScale = plan.outerPresentationRadius / center;
  for (let y = 0; y < size; y += 1) {
    const presentationY = (y + 0.5 - center) * pixelScale;
    for (let x = 0; x < size; x += 1) {
      const presentationX = (x + 0.5 - center) * pixelScale;
      const presentationRadius = Math.hypot(presentationX, presentationY);
      let alpha = 0;
      const premultiplied = [0, 0, 0];
      for (const band of plan.bands) {
        const innerFadeKm = band.name === "Main Ring" ? 600 : 4_000;
        const outerFadeKm = band.name === "Main Ring" ? 120 : 1_200;
        const inner = presentationRingRadius(band.innerRadiusKm);
        const outer = presentationRingRadius(band.outerRadiusKm);
        const sourceInnerFade = inner - presentationRingRadius(
          band.innerRadiusKm - innerFadeKm,
        );
        const sourceOuterFade = presentationRingRadius(
          band.outerRadiusKm + outerFadeKm,
        ) - outer;
        const readabilityExpansion = band.name === "Main Ring"
          ? Math.max(0, MINIMUM_MAIN_PRESENTATION_WIDTH - (outer - inner))
          : 0;
        const coverage = radialCoverage(
          presentationRadius,
          inner - readabilityExpansion,
          outer,
          sourceInnerFade,
          sourceOuterFade,
        );
        const bandAlpha = Math.min(
          1,
          presentationAlpha(band.opticalDepth) * coverage,
        );
        const contribution = bandAlpha * (1 - alpha);
        const color = ringColor(band.name);
        for (let channel = 0; channel < 3; channel += 1) {
          premultiplied[channel] += color[channel] * contribution;
        }
        alpha += contribution;
      }
      if (alpha <= 0) continue;
      const sourceRadiusKm = sourceRingRadius(presentationRadius);
      const angle = Math.atan2(presentationY, presentationX);
      if (rayIntersectsJupiter(
        sourceRadiusKm * Math.cos(angle),
        sourceRadiusKm * Math.sin(angle),
      )) {
        for (let channel = 0; channel < 3; channel += 1) {
          premultiplied[channel] *= SHADOW_LUMINANCE_MULTIPLIER;
        }
      }
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(premultiplied[channel] / alpha);
      }
      data[offset + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  }
  return data;
}

function radialCoverage(radius, inner, outer, innerFade, outerFade) {
  if (radius <= inner - innerFade || radius >= outer + outerFade) return 0;
  const innerCoverage = smoothstep(inner - innerFade, inner, radius);
  const outerCoverage = 1 - smoothstep(outer, outer + outerFade, radius);
  return innerCoverage * outerCoverage;
}

function presentationAlpha(opticalDepth) {
  return MAXIMUM_MAIN_ALPHA * Math.pow(
    opticalDepth / 8e-6,
    OPTICAL_DEPTH_EXPONENT,
  );
}

function rayIntersectsJupiter(xKm, yKm) {
  const longitude = JUPITER_LIGHT_SOURCE_GEOMETRY.solarLongitudeDegrees *
    Math.PI / 180;
  const latitude = JUPITER_LIGHT_SOURCE_GEOMETRY.solarLatitudeDegrees *
    Math.PI / 180;
  const light = [
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  ];
  const inverseEquatorialSquared = 1 / (EQUATORIAL_RADIUS_KM ** 2);
  const inversePolarSquared = 1 / (POLAR_RADIUS_KM ** 2);
  const a = (light[0] ** 2 + light[1] ** 2) * inverseEquatorialSquared +
    light[2] ** 2 * inversePolarSquared;
  const b = 2 * (xKm * light[0] + yKm * light[1]) *
    inverseEquatorialSquared;
  const c = (xKm ** 2 + yKm ** 2) * inverseEquatorialSquared - 1;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant <= 0) return false;
  const root = Math.sqrt(discriminant);
  return (-b - root) / (2 * a) > 0 || (-b + root) / (2 * a) > 0;
}

function ringTiles(asset) {
  const worldRadius = asset.outerPresentationRadius *
    RETAINED_WORLD_UNITS_PER_PRESENTATION_UNIT;
  const worldDiameter = worldRadius * 2;
  const tileWorldSize = worldDiameter / RING_TILE_GRID;
  return Array.from({ length: RING_TILE_GRID ** 2 }, (_, tileIndex) => {
    const column = tileIndex % RING_TILE_GRID;
    const row = Math.floor(tileIndex / RING_TILE_GRID);
    const overlapX = column === RING_TILE_GRID - 1 ? 0 : RING_TILE_OVERLAP_WORLD;
    const overlapY = row === RING_TILE_GRID - 1 ? 0 : RING_TILE_OVERLAP_WORLD;
    return Object.freeze({
      component: "system",
      tileIndex,
      tileColumn: column,
      tileRow: row,
      className: "jupiter-ring-leaf jupiter-ring-system",
      style:
        `width:${(tileWorldSize + overlapX).toFixed(6)}px;` +
        `height:${(tileWorldSize + overlapY).toFixed(6)}px;` +
        `transform:translate3d(${(-worldRadius + column * tileWorldSize)
          .toFixed(6)}px,${(-worldRadius + row * tileWorldSize)
          .toFixed(6)}px,0px);` +
        `background-image:url("${asset.url2x}");` +
        `background-position:${(-column * tileWorldSize).toFixed(6)}px ` +
          `${(-row * tileWorldSize).toFixed(6)}px;` +
        `background-size:${worldDiameter.toFixed(6)}px ` +
          `${worldDiameter.toFixed(6)}px`,
    });
  });
}

function ringColor(name) {
  if (name === "Main Ring") return [190, 187, 182];
  if (name === "Halo") return [177, 174, 170];
  if (name === "Amalthea Gossamer Ring") return [171, 166, 160];
  return [163, 158, 153];
}

function presentationRingRadius(sourceRadiusKm) {
  if (sourceRadiusKm <= innermostPreparedMoon.orbitKm) {
    return logarithmicRange(
      sourceRadiusKm,
      EQUATORIAL_RADIUS_KM,
      innermostPreparedMoon.orbitKm,
      EQUATORIAL_RADIUS,
      innermostPreparedMoon.displayOrbitRadius,
    );
  }
  return logarithmicRange(
    sourceRadiusKm,
    innermostPreparedMoon.orbitKm,
    io.orbitKm,
    innermostPreparedMoon.displayOrbitRadius,
    io.displayOrbitRadius,
  );
}

function sourceRingRadius(presentationRadius) {
  if (presentationRadius <= innermostPreparedMoon.displayOrbitRadius) {
    return inverseLogarithmicRange(
      presentationRadius,
      EQUATORIAL_RADIUS_KM,
      innermostPreparedMoon.orbitKm,
      EQUATORIAL_RADIUS,
      innermostPreparedMoon.displayOrbitRadius,
    );
  }
  return inverseLogarithmicRange(
    presentationRadius,
    innermostPreparedMoon.orbitKm,
    io.orbitKm,
    innermostPreparedMoon.displayOrbitRadius,
    io.displayOrbitRadius,
  );
}

function logarithmicRange(value, sourceMinimum, sourceMaximum, outputMinimum,
  outputMaximum) {
  const amount = (Math.log(value) - Math.log(sourceMinimum)) /
    (Math.log(sourceMaximum) - Math.log(sourceMinimum));
  return outputMinimum + amount * (outputMaximum - outputMinimum);
}

function inverseLogarithmicRange(value, sourceMinimum, sourceMaximum,
  outputMinimum, outputMaximum) {
  const amount = (value - outputMinimum) / (outputMaximum - outputMinimum);
  return Math.exp(
    Math.log(sourceMinimum) + amount *
      (Math.log(sourceMaximum) - Math.log(sourceMinimum)),
  );
}

async function assetDescriptor(path, size) {
  const bytes = await readFile(path);
  return Object.freeze({
    width: size,
    height: size,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
