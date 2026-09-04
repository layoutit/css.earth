import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildPolyMeshTransform } from "@layoutit/polycss";
import sharp from "sharp";

import {
  optimizePreparedQ75Webp,
  PREPARED_Q75_WEBP_ENCODING,
} from "../../../../tools/prepared-webp.mjs";
import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../runtime/preparedLighting.mjs";
import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
  JUPITER_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await validateJupiterSourceGroup("moons");
await ensureJupiterPreparationDirectories();

const OUTPUT_MODULE = new URL("../runtime/preparedMoons.mjs", import.meta.url);
const CATALOG_PATH = resolve(JUPITER_SOURCE_ROOT, "moons/jupiter-moons.json");
const MONTAGE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "moons/galilean-satellites-pia01299.jpg",
);
const BILLBOARD_ATLAS_PATH = resolve(
  JUPITER_PUBLIC_ROOT,
  "jupiter-moon-billboards.webp",
);
const BILLBOARD_ATLAS_2X_PATH = resolve(
  JUPITER_PUBLIC_ROOT,
  "jupiter-moon-billboards@2x.webp",
);
const BILLBOARD_ATLAS_URL = "/scenes/jupiter/jupiter-moon-billboards.webp";
const BILLBOARD_ATLAS_2X_URL =
  "/scenes/jupiter/jupiter-moon-billboards@2x.webp";
const BILLBOARD_CONTENT_SIZE = 64;
const BILLBOARD_GUTTER = 2;
const BILLBOARD_STRIDE = BILLBOARD_CONTENT_SIZE + BILLBOARD_GUTTER * 2;
const BILLBOARD_COLUMNS = 2;
const BILLBOARD_ROWS = 2;
const BILLBOARD_ATLAS_WIDTH = BILLBOARD_COLUMNS * BILLBOARD_STRIDE;
const BILLBOARD_ATLAS_HEIGHT = BILLBOARD_ROWS * BILLBOARD_STRIDE;
const TILE_SIZE = 50;
const RADIUS_PRESENTATION_SCALE = 1.5;
const INNER_SYSTEM_RADIUS = 255;
const INNER_GALILEAN_RADIUS = 285;
const OUTER_GALILEAN_RADIUS = 455;
const OUTER_SYSTEM_RADIUS = 650;
const MINOR_MOON_MARKER_RADIUS = 1;
const MINOR_LABEL_CHARACTER_WIDTH_PX = 5.51;
const MINOR_LABEL_HORIZONTAL_PADDING_PX = 4;
const MINOR_LABEL_HEIGHT_PX = 10;
const DETAILED_LABEL_HEIGHT_PX = 12;
const MINOR_LABEL_COLLISION_PADDING_PX = 12;
const JUPITER_ROTATION_SECONDS = 36;
const JUPITER_ROTATION_HOURS = 9.9;
const PHYSICAL_TO_VISUAL_TIME_SCALE =
  JUPITER_ROTATION_HOURS * 3_600 / JUPITER_ROTATION_SECONDS;
const DETAILED_MOON_IDS = Object.freeze([
  "io",
  "europa",
  "ganymede",
  "callisto",
]);
const DETAILED_LABEL_OFFSETS = Object.freeze({
  io: Object.freeze([0, 0]),
  europa: Object.freeze([25, -20]),
  ganymede: Object.freeze([-25, 20]),
  callisto: Object.freeze([0, 0]),
});
const SOURCE_CROPS = Object.freeze({
  io: Object.freeze({ left: 45, top: 105, width: 365, height: 390 }),
  europa: Object.freeze({ left: 447, top: 150, width: 315, height: 325 }),
  ganymede: Object.freeze({ left: 820, top: 45, width: 485, height: 545 }),
  callisto: Object.freeze({ left: 1325, top: 65, width: 505, height: 530 }),
});

const moonCatalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
if (moonCatalog.schema !== "cssjupiter-moon-catalog@1" ||
    moonCatalog.counts?.confirmed !== 115 ||
    moonCatalog.moons?.length !== 115) {
  throw new Error("Prepared Jupiter moon catalog drifted.");
}
const physicalHtml = await readFile(
  resolve(JUPITER_SOURCE_ROOT, "moons/jpl-physical-parameters.html"),
  "utf8",
);
const detailedElementsHtml = await readFile(
  resolve(JUPITER_SOURCE_ROOT, "moons/jpl-mean-elements.html"),
  "utf8",
);
const catalogById = new Map(moonCatalog.moons.map((moon) => [moon.id, moon]));
const detailedDefinitions = Object.freeze(DETAILED_MOON_IDS.map((id) => {
  const catalog = catalogById.get(id);
  if (!catalog) throw new Error(`Jupiter moon catalog is missing ${id}.`);
  const physical = tableRow(physicalHtml, catalog.name, 4);
  const specializedOrbit = tableRow(detailedElementsHtml, catalog.name, 15);
  const meanRadiusKm = numberAt(physical, 2);
  if (numberAt(specializedOrbit, 2) !== catalog.semiMajorAxisKm ||
      numberAt(specializedOrbit, 8) !== catalog.periodDays) {
    throw new Error(`${catalog.name} detailed JPL source tables disagree.`);
  }
  return Object.freeze({
    ...catalog,
    meanRadiusKm,
    radiiKm: Object.freeze([meanRadiusKm, meanRadiusKm, meanRadiusKm]),
    crop: SOURCE_CROPS[id],
  });
}));
const detailedIds = new Set(DETAILED_MOON_IDS);
const minorDefinitions = Object.freeze(moonCatalog.moons.filter(({ id }) =>
  !detailedIds.has(id)));
if (minorDefinitions.length !== 111) {
  throw new Error(`Prepared Jupiter minor moon count drifted: ${minorDefinitions.length}.`);
}

await Promise.all([
  writeBillboardAtlas(BILLBOARD_ATLAS_PATH, 1),
  writeBillboardAtlas(BILLBOARD_ATLAS_2X_PATH, 2),
]);
await Promise.all([
  optimizePreparedQ75Webp(BILLBOARD_ATLAS_PATH),
  optimizePreparedQ75Webp(BILLBOARD_ATLAS_2X_PATH),
]);

const detailedMoons = Object.freeze(detailedDefinitions.map(
  prepareDetailedMoon,
));
const minorMoonLayout = prepareMinorMoonLabelLayout(
  minorDefinitions.map(prepareMinorMoonDot),
  detailedMoons,
);
const minorMoonDots = minorMoonLayout.dots;
const namedMinorMoonCount = minorMoonDots.filter(({ label }) => label).length;
if (namedMinorMoonCount !== 53) {
  throw new Error(`Prepared named minor moon count drifted: ${namedMinorMoonCount}.`);
}
const counts = Object.freeze({
  confirmedMoonCount: moonCatalog.counts.confirmed,
  preparedMoonCount: detailedMoons.length + minorMoonDots.length,
  detailedMoonCount: detailedMoons.length,
  minorMoonCount: minorMoonDots.length,
  moonCount: detailedMoons.length + minorMoonDots.length,
  moonLeafCount: detailedMoons.length + minorMoonDots.length,
  moonSurfaceLeafCount: detailedMoons.length + minorMoonDots.length,
  moonTextureLeafCount: detailedMoons.length,
  moonSolidLeafCount: 0,
  moonDotLeafCount: minorMoonDots.length,
  moonShadowLeafCount: 0,
  moonLabelCount: detailedMoons.length + namedMinorMoonCount,
  namedMinorMoonCount,
  moonTransformGroupCount: detailedMoons.length * 4,
  moonAnimationCount: detailedMoons.length * 2,
});
const plan = Object.freeze({
  schema: "cssjupiter-prepared-low-poly-moons@2",
  sourceAuthority: Object.freeze({
    confirmedMoonCount: moonCatalog.counts.confirmed,
    catalogRetrievedAt: moonCatalog.retrievedAt,
    catalogSources: moonCatalog.sources,
    physicalParameters: "JPL Solar System Dynamics physical parameters",
    meanElements: "JPL Solar System Dynamics satellite mean elements",
    surfaceImagery: "NASA/JPL/DLR Galileo PIA01299 Galilean-satellite montage",
  }),
  presentation: Object.freeze({
    model: "prepared-billboard-galilean-moons-and-static-minor-moon-dots",
    radiusScale: RADIUS_PRESENTATION_SCALE,
    orbitDistanceModel: "logarithmic-compression-preserving-source-order",
    orbitDistanceRange: Object.freeze([
      INNER_SYSTEM_RADIUS,
      OUTER_SYSTEM_RADIUS,
    ]),
    detailedOrbitDistanceRange: Object.freeze([
      INNER_GALILEAN_RADIUS,
      OUTER_GALILEAN_RADIUS,
    ]),
    minorMoonModel: "one-dot-leaf-one-prepared-static-epoch-translate",
    minorMoonMarkerRadius: MINOR_MOON_MARKER_RADIUS,
    minorMoonPhysicalPixelFloor: Object.freeze({ dpr1: 2, dpr2: 3 }),
    minorMoonLabels: "all-IAU-named-catalog-objects",
    minorMoonLabelWidthModel: "prepared-monospace-character-count",
    minorMoonLabelLayout: minorMoonLayout.descriptor,
    minorMoonShadows: false,
    animatedMinorMoonCount: 0,
    staticEpochMinorMoonCount: minorMoonDots.length,
    sourceOrbitOrderPreserved: true,
    eccentricityPublishedButNotApplied: true,
    runtimeOrbitalCalculation: false,
    runtimeGeometryPreparation: false,
    runtimeTexturePreparation: false,
    runtimeRasterization: false,
    runtimeJavaScriptWritesPerFrame: 0,
    billboardModel: "prepared-source-alpha-planes-readdressed-on-camera-input",
  }),
  billboardAtlas: Object.freeze({
    url: BILLBOARD_ATLAS_URL,
    url2x: BILLBOARD_ATLAS_2X_URL,
    width: BILLBOARD_ATLAS_WIDTH,
    height: BILLBOARD_ATLAS_HEIGHT,
    width2x: BILLBOARD_ATLAS_WIDTH * 2,
    height2x: BILLBOARD_ATLAS_HEIGHT * 2,
    tileCount: detailedMoons.length,
    tileSize: BILLBOARD_CONTENT_SIZE,
    tileGutter: BILLBOARD_GUTTER,
    selectedDensityImageCount: 1,
    encoding: PREPARED_Q75_WEBP_ENCODING,
  }),
  moons: detailedMoons,
  minorMoonDots,
  counts,
});

await writeFile(
  OUTPUT_MODULE,
  "// Generated by tools/prepare-moons.mjs. Do not edit by hand.\n" +
    `export const PREPARED_JUPITER_MOONS = ${JSON.stringify(plan)};\n`,
);
console.log(
  `Prepared ${counts.moonCount} Jupiter moons: ${counts.detailedMoonCount} ` +
    `source-image billboards and ${counts.minorMoonCount} catalog dots.`,
);

function prepareDetailedMoon(definition, tileIndex) {
  const displayOrbitRadius = presentationOrbitRadius(definition.semiMajorAxisKm);
  const visualPeriodSeconds =
    definition.periodDays * 86_400 / PHYSICAL_TO_VISUAL_TIME_SCALE;
  const phaseDegrees = normalizeDegrees(
    definition.argumentOfPeriapsisDeg + definition.meanAnomalyDeg,
  );
  const phaseRadians = phaseDegrees * Math.PI / 180;
  const baseOrbitTransform = buildPolyMeshTransform({
    rotation: [definition.inclinationDeg, 0, definition.ascendingNodeDeg],
  }) ?? "none";
  const displayPosition = transformCssPoint(baseOrbitTransform, [
    displayOrbitRadius * Math.sin(phaseRadians),
    displayOrbitRadius * Math.cos(phaseRadians),
    0,
  ]);
  const displayRadii = Object.freeze(definition.radiiKm.map((radiusKm) =>
    round(physicalToDisplay(radiusKm) * RADIUS_PRESENTATION_SCALE)));
  const duration = round(visualPeriodSeconds);
  const delay = round(-visualPeriodSeconds * phaseDegrees / 360);
  const column = tileIndex % BILLBOARD_COLUMNS;
  const row = Math.floor(tileIndex / BILLBOARD_COLUMNS);
  const radiusX = displayRadii[0];
  const radiusY = displayRadii[1];
  const radiusZ = displayRadii[2];
  const labelOffset = DETAILED_LABEL_OFFSETS[definition.id];
  const localMatrix = [
    2 * radiusX / BILLBOARD_CONTENT_SIZE, 0, 0, 0,
    0, 2 * radiusY / BILLBOARD_CONTENT_SIZE, 0, 0,
    0, 0, 1, 0,
    -radiusX, -radiusY, radiusZ + 0.01, 1,
  ].map((value) => round(value, 12));
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    meanRadiusKm: definition.meanRadiusKm,
    radiiKm: definition.radiiKm,
    orbitKm: definition.semiMajorAxisKm,
    eccentricity: definition.eccentricity,
    periapsisDeg: definition.argumentOfPeriapsisDeg,
    meanAnomalyDeg: definition.meanAnomalyDeg,
    inclinationDeg: definition.inclinationDeg,
    nodeDeg: definition.ascendingNodeDeg,
    periodDays: definition.periodDays,
    sourceModel: "NASA-JPL-DLR-PIA01299-prepared-camera-facing-alpha-plane",
    surfaceTopology: "prepared-camera-facing-alpha-plane",
    displayRadii,
    radiusPresentationScale: RADIUS_PRESENTATION_SCALE,
    displayOrbitRadius: round(displayOrbitRadius),
    displayPosition: Object.freeze(displayPosition.map((value) => round(value, 8))),
    visualPeriodSeconds: duration,
    phaseDegrees: round(phaseDegrees),
    orbitTransform: `transform:${baseOrbitTransform};` +
      `animation-duration:${duration}s;animation-delay:${delay}s`,
    positionTransform: `transform:${buildPolyMeshTransform({
      position: [displayOrbitRadius, 0, 0],
    })}`,
    counterTransform:
      `--jupiter-moon-inclination:${round(definition.inclinationDeg)}deg;` +
      `--jupiter-moon-node:${round(definition.ascendingNodeDeg)}deg;` +
      `animation-duration:${duration}s;animation-delay:${delay}s`,
    billboard: Object.freeze({
      radii: displayRadii,
      tileSize: TILE_SIZE,
      textureSize: BILLBOARD_CONTENT_SIZE,
    }),
    leafCount: 1,
    leaves: Object.freeze([Object.freeze({
      tag: "s",
      style: `width:${BILLBOARD_CONTENT_SIZE}px;height:${BILLBOARD_CONTENT_SIZE}px;` +
        `transform:matrix3d(${localMatrix.join(",")});` +
        `background-image:url("${BILLBOARD_ATLAS_2X_URL}");` +
        `background-position:${-(column * BILLBOARD_STRIDE + BILLBOARD_GUTTER)}px ` +
          `${-(row * BILLBOARD_STRIDE + BILLBOARD_GUTTER)}px;` +
        `background-size:${BILLBOARD_ATLAS_WIDTH}px ${BILLBOARD_ATLAS_HEIGHT}px`,
    })]),
    label: Object.freeze({
      text: definition.name,
      radii: displayRadii,
      widthPx: 80,
      gapPx: 8,
      tileSize: TILE_SIZE,
      offsetPx: labelOffset,
      anchorTranslate: preparedLabelAnchor(displayRadii),
      offsetTransform: preparedLabelOffsetTransform(80, 8, labelOffset),
    }),
  });
}

function prepareMinorMoonDot(definition) {
  const displayOrbitRadius = presentationOrbitRadius(definition.semiMajorAxisKm);
  const phaseDegrees = normalizeDegrees(
    definition.argumentOfPeriapsisDeg + definition.meanAnomalyDeg,
  );
  const angle = -phaseDegrees * Math.PI / 180;
  let position = [
    displayOrbitRadius * Math.cos(angle),
    displayOrbitRadius * Math.sin(angle),
    0,
  ];
  position = rotateVectorX(position, definition.inclinationDeg * Math.PI / 180);
  position = rotateVectorZ(position, definition.ascendingNodeDeg * Math.PI / 180);
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    sourceModel: "JPL-mean-elements-prepared-static-epoch-translate",
    orbitKm: definition.semiMajorAxisKm,
    displayOrbitRadius: round(displayOrbitRadius),
    phaseDegrees: round(phaseDegrees),
    animated: false,
    displayPosition: Object.freeze(position.map((value) => round(value, 8))),
    style: `translate:${position.map((value) =>
      `${round(value * TILE_SIZE, 4)}px`).join(" ")}`,
    label: definition.romanNumeral && !definition.name.startsWith("S/")
      ? Object.freeze({
        text: definition.name,
        radii: Object.freeze([
          MINOR_MOON_MARKER_RADIUS,
          MINOR_MOON_MARKER_RADIUS,
          MINOR_MOON_MARKER_RADIUS,
        ]),
        widthPx: Math.ceil(
          definition.name.length * MINOR_LABEL_CHARACTER_WIDTH_PX +
            MINOR_LABEL_HORIZONTAL_PADDING_PX,
        ),
        gapPx: 4,
        tileSize: TILE_SIZE,
      })
      : null,
  });
}

function prepareMinorMoonLabelLayout(dots, detailedMoons) {
  const sampleScenePitchStepDegrees =
    PREPARED_JUPITER_LIGHTING.pitchStepDegrees;
  const sampleScenePitchDegrees = Object.freeze(Array.from(
    { length: PREPARED_JUPITER_LIGHTING.frameCount },
    (_, index) => PREPARED_JUPITER_LIGHTING.minimumPitchDegrees +
      index * sampleScenePitchStepDegrees,
  ));
  const sampleTotalPitchRadians = sampleScenePitchDegrees.map((pitch) =>
    (pitch + PREPARED_JUPITER_SCENE.geometry.axialTiltDegrees) * Math.PI / 180);
  const zoom = PREPARED_JUPITER_CAMERA.defaultZoom;
  const candidates = [Object.freeze([0, 0])];
  for (const radius of [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]) {
    candidates.push(
      Object.freeze([0, -radius]), Object.freeze([0, radius]),
      Object.freeze([-radius, 0]), Object.freeze([radius, 0]),
      Object.freeze([-radius, -radius]), Object.freeze([radius, -radius]),
      Object.freeze([-radius, radius]), Object.freeze([radius, radius]),
      Object.freeze([-radius / 2, -radius]),
      Object.freeze([radius / 2, -radius]),
      Object.freeze([-radius / 2, radius]),
      Object.freeze([radius / 2, radius]),
    );
  }
  const namedDots = dots.filter(({ label }) => label);
  const offsetsById = new Map(namedDots.map(({ id }) => [id, []]));
  let previousOffsets = new Map();
  let maximumOffsetPx = 0;
  for (const pitch of sampleTotalPitchRadians) {
    const named = namedDots.map((dot) => ({
      dot,
      point: Object.freeze([
        dot.displayPosition[0] * zoom,
        (
          dot.displayPosition[1] * Math.cos(pitch) -
          dot.displayPosition[2] * Math.sin(pitch)
        ) * zoom,
      ]),
      density: 0,
    }));
    for (const candidate of named) {
      candidate.density = named.filter((other) => other !== candidate).reduce(
        (total, other) => total + Number(Math.hypot(
          candidate.point[0] - other.point[0],
          candidate.point[1] - other.point[1],
        ) < 100),
        0,
      );
    }
    named.sort((left, right) => right.density - left.density ||
      compareText(left.dot.name, right.dot.name));
    const placed = detailedMoons.map((moon) => {
      const [offsetX, offsetY] = moon.label.offsetPx;
      const x = moon.displayPosition[0] * zoom;
      const y = (
        moon.displayPosition[1] * Math.cos(pitch) -
        moon.displayPosition[2] * Math.sin(pitch)
      ) * zoom;
      return Object.freeze({
        name: moon.name,
        left: x + offsetX - moon.label.widthPx / 2,
        right: x + offsetX + moon.label.widthPx / 2,
        top: y + moon.displayRadii[1] * zoom + moon.label.gapPx + offsetY,
        bottom: y + moon.displayRadii[1] * zoom + moon.label.gapPx + offsetY +
          DETAILED_LABEL_HEIGHT_PX,
      });
    });
    for (let first = 0; first < placed.length; first += 1) {
      for (let second = first + 1; second < placed.length; second += 1) {
        if (boxesOverlap(placed[first], placed[second], 0)) {
          throw new Error(
            `Prepared Galilean moon labels ${placed[first].name} and ` +
              `${placed[second].name} overlap at ` +
              `${round(pitch * 180 / Math.PI)} degrees: ` +
              `${JSON.stringify([placed[first], placed[second]])}.`,
          );
        }
      }
    }
    const currentOffsets = new Map();
    for (const candidate of named) {
      const previous = previousOffsets.get(candidate.dot.id) ?? [0, 0];
      const orderedOffsets = candidates.map((offset, index) => ({
        offset,
        index,
        distance: Math.hypot(
          offset[0] - previous[0],
          offset[1] - previous[1],
        ),
      })).sort((left, right) =>
        left.distance - right.distance || left.index - right.index);
      let selected = null;
      for (const { offset } of orderedOffsets) {
        const [x, y] = candidate.point;
        const box = Object.freeze({
          left: x + offset[0] - candidate.dot.label.widthPx / 2,
          right: x + offset[0] + candidate.dot.label.widthPx / 2,
          top: y + candidate.dot.label.gapPx +
            MINOR_MOON_MARKER_RADIUS * zoom + offset[1],
          bottom: y + candidate.dot.label.gapPx +
            MINOR_MOON_MARKER_RADIUS * zoom + offset[1] +
            MINOR_LABEL_HEIGHT_PX,
        });
        if (placed.every((occupied) => !boxesOverlap(
          box,
          occupied,
          MINOR_LABEL_COLLISION_PADDING_PX,
        ))) {
          selected = Object.freeze({ offset, box });
          break;
        }
      }
      if (!selected) {
        throw new Error(
          `Could not prepare a collision-free label for ${candidate.dot.name}.`,
        );
      }
      currentOffsets.set(candidate.dot.id, selected.offset);
      offsetsById.get(candidate.dot.id).push(selected.offset);
      maximumOffsetPx = Math.max(
        maximumOffsetPx,
        Math.hypot(...selected.offset),
      );
      placed.push(selected.box);
    }
    previousOffsets = currentOffsets;
  }
  const defaultMaterialStateIndex =
    PREPARED_JUPITER_LIGHTING.transport.defaultFrame;
  const preparedDots = Object.freeze(dots.map((dot) => Object.freeze({
    ...dot,
    label: dot.label
      ? prepareMinorMoonLabel(
        dot.label,
        offsetsById.get(dot.id),
        defaultMaterialStateIndex,
      )
      : null,
  })));
  return Object.freeze({
    dots: preparedDots,
    descriptor: Object.freeze({
      model: "prepared-camera-state-greedy-nameplate-collision-layout",
      sampleScenePitchDegrees: Object.freeze([
        sampleScenePitchDegrees[0],
        sampleScenePitchDegrees.at(-1),
      ]),
      sampleScenePitchStepDegrees,
      materialStateCount: sampleScenePitchDegrees.length,
      defaultMaterialStateIndex,
      collisionCountAtSamples: 0,
      reservedDetailedMoonLabelCount: detailedMoons.length,
      detailedMoonEpoch: "prepared-css-animation-start",
      maximumOffsetPx: round(maximumOffsetPx),
      runtimeLayout: false,
      runtimeSelection: "prepared-material-state-index",
      runtimeInterpolation: false,
    }),
  });
}

function prepareMinorMoonLabel(label, offsets, defaultMaterialStateIndex) {
  const offsetTransforms = [];
  const transformIndices = new Map();
  const offsetTransformIndicesByMaterialState = offsets.map((offset) => {
    const transform = preparedLabelOffsetTransform(
      label.widthPx,
      label.gapPx,
      offset,
    );
    let index = transformIndices.get(transform);
    if (index === undefined) {
      index = offsetTransforms.length;
      transformIndices.set(transform, index);
      offsetTransforms.push(transform);
    }
    return index;
  });
  return Object.freeze({
    ...label,
    offsetPx: offsets[defaultMaterialStateIndex],
    anchorTranslate: preparedLabelAnchor(label.radii),
    offsetTransforms: Object.freeze(offsetTransforms),
    offsetTransformIndicesByMaterialState: Object.freeze(
      offsetTransformIndicesByMaterialState,
    ),
  });
}

function boxesOverlap(left, right, padding) {
  return left.left < right.right + padding &&
    left.right > right.left - padding &&
    left.top < right.bottom + padding &&
    left.bottom > right.top - padding;
}

function transformCssPoint(transform, point) {
  if (transform === "none") return point;
  const match = /^matrix3d\(([^)]+)\)$/u.exec(transform);
  if (match) {
    const matrix = match[1].split(",").map(Number);
    const [x, y, z] = point;
    return [
      matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
      matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
      matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    ];
  }
  const rotations = [...transform.matchAll(
    /rotate([XYZ])\((-?[\d.]+)deg\)/gu,
  )];
  if (rotations.length === 0) {
    throw new Error(`Unsupported prepared moon transform: ${transform}.`);
  }
  return rotations.reverse().reduce((vector, rotation) => {
    const angle = Number(rotation[2]) * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const [x, y, z] = vector;
    if (rotation[1] === "X") {
      return [x, cosine * y - sine * z, sine * y + cosine * z];
    }
    if (rotation[1] === "Y") {
      return [cosine * x + sine * z, y, -sine * x + cosine * z];
    }
    return [cosine * x - sine * y, sine * x + cosine * y, z];
  }, point);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function preparedLabelAnchor(radii) {
  return `0px ${round(radii[1], 12)}px ${round(radii[2] + 0.01, 12)}px`;
}

function preparedLabelOffsetTransform(widthPx, gapPx, [offsetX, offsetY]) {
  return `translate(${round(-widthPx / 2 + offsetX, 12)}px,` +
    `${round(gapPx + offsetY, 12)}px)`;
}

function presentationOrbitRadius(orbitKm) {
  const sourceMinimum = Math.min(...moonCatalog.moons.map(({ semiMajorAxisKm }) =>
    semiMajorAxisKm));
  const sourceMaximum = Math.max(...moonCatalog.moons.map(({ semiMajorAxisKm }) =>
    semiMajorAxisKm));
  const galileanMinimum = detailedDefinitions[0].semiMajorAxisKm;
  const galileanMaximum = detailedDefinitions.at(-1).semiMajorAxisKm;
  if (orbitKm <= galileanMinimum) {
    return logarithmicRange(
      orbitKm,
      sourceMinimum,
      galileanMinimum,
      INNER_SYSTEM_RADIUS,
      INNER_GALILEAN_RADIUS,
    );
  }
  if (orbitKm <= galileanMaximum) {
    return logarithmicRange(
      orbitKm,
      galileanMinimum,
      galileanMaximum,
      INNER_GALILEAN_RADIUS,
      OUTER_GALILEAN_RADIUS,
    );
  }
  return logarithmicRange(
    orbitKm,
    galileanMaximum,
    sourceMaximum,
    OUTER_GALILEAN_RADIUS,
    OUTER_SYSTEM_RADIUS,
  );
}

function logarithmicRange(value, sourceMinimum, sourceMaximum, outputMinimum,
  outputMaximum) {
  if (sourceMinimum === sourceMaximum) return outputMinimum;
  const amount = (Math.log(value) - Math.log(sourceMinimum)) /
    (Math.log(sourceMaximum) - Math.log(sourceMinimum));
  return outputMinimum + amount * (outputMaximum - outputMinimum);
}

async function writeBillboardAtlas(path, density) {
  const width = BILLBOARD_ATLAS_WIDTH * density;
  const height = BILLBOARD_ATLAS_HEIGHT * density;
  const atlas = Buffer.alloc(width * height * 4);
  for (let index = 0; index < detailedDefinitions.length; index += 1) {
    const definition = detailedDefinitions[index];
    const tile = await prepareSourceTile(definition.crop, density);
    const targetX = (
      index % BILLBOARD_COLUMNS * BILLBOARD_STRIDE + BILLBOARD_GUTTER
    ) * density;
    const targetY = (
      Math.floor(index / BILLBOARD_COLUMNS) * BILLBOARD_STRIDE + BILLBOARD_GUTTER
    ) * density;
    const tileSize = BILLBOARD_CONTENT_SIZE * density;
    for (let row = 0; row < tileSize; row += 1) {
      tile.copy(
        atlas,
        ((targetY + row) * width + targetX) * 4,
        row * tileSize * 4,
        (row + 1) * tileSize * 4,
      );
    }
  }
  await sharp(atlas, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(path);
}

async function prepareSourceTile(crop, density) {
  const side = Math.max(crop.width, crop.height);
  const left = Math.round(crop.left + crop.width / 2 - side / 2);
  const top = Math.round(crop.top + crop.height / 2 - side / 2);
  const size = BILLBOARD_CONTENT_SIZE * density;
  const { data } = await sharp(MONTAGE_PATH)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const normalizedX = (x + 0.5 - size / 2) / (size * 0.465);
      const normalizedY = (y + 0.5 - size / 2) / (size * 0.465);
      const radius = Math.hypot(normalizedX, normalizedY);
      const edge = 1 - smoothstep(0.965, 1.015, radius);
      const brightness = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      const blackBackgroundGuard = radius < 0.88
        ? 1
        : smoothstep(3, 18, brightness);
      data[offset + 3] = Math.round(255 * edge * blackBackgroundGuard);
    }
  }
  return data;
}

function physicalToDisplay(radiusKm) {
  return PREPARED_JUPITER_SCENE.geometry.equatorialRadius /
    PREPARED_JUPITER_SCENE.geometry.equatorialRadiusKm * radiusKm;
}

function tableRow(html, name, minimumCells) {
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)]
      .map((match) => stripMarkup(match[1]));
    if (cells[0] === name && cells.length >= minimumCells) return cells;
  }
  throw new Error(`JPL Jupiter moon row drifted for ${name}.`);
}

function stripMarkup(value) {
  return value.replace(/<[^>]+>/gu, " ")
    .replaceAll("&pm;", "±")
    .replaceAll("&nbsp;", " ")
    .replace(/&[^;]+;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function numberAt(row, index) {
  const value = Number.parseFloat(row[index]);
  if (!Number.isFinite(value)) throw new Error(`JPL numeric cell drifted: ${row[index]}.`);
  return value;
}

function smoothstep(edge0, edge1, value) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function rotateVectorX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateVectorZ([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}
