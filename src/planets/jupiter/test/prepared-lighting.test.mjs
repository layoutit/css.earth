import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { PREPARED_JUPITER_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../runtime/preparedLighting.mjs";
import {
  applyJupiterLinearLight,
  measurePublishedJupiterAtmosphereReference,
  prepareJupiterMaterialFrame,
  prepareJupiterMaterialProjection,
} from "../tools/prepare-atmosphere.mjs";

test("prepares a fixed-world Jupiter light and visible atmosphere", () => {
  assert.equal(PREPARED_JUPITER_LIGHTING.schema, "cssjupiter-prepared-lighting@3");
  assert.equal(PREPARED_JUPITER_LIGHTING.frameCount, 181);
  assert.match(PREPARED_JUPITER_LIGHTING.bankFingerprint, /^[a-f0-9]{12}$/u);
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.bankFingerprintSources, [
    "tools/prepare-atmosphere.mjs",
    "tools/prepare-lighting.mjs",
    "runtime/preparedScene.mjs projection metadata",
    "runtime/preparedCamera.mjs projection metadata",
    "source/atmosphere/psg-jupiter-20260830.cfg",
    "source/atmosphere/hubble-opal-minnaert.json",
    "source/presentation/navigation-marker.png",
    "Saturn accepted OpenSpace default scene-graph Sun direction",
    "sharp runtime versions",
  ]);
  assert.equal(PREPARED_JUPITER_LIGHTING.frameSize, 512);
  assert.equal(PREPARED_JUPITER_LIGHTING.presentationFrameSize, 512);
  assert.equal(PREPARED_JUPITER_LIGHTING.preparedPixelDensity, 1);
  assert.equal(PREPARED_JUPITER_LIGHTING.surfaceRadius, 238);
  assert.equal(PREPARED_JUPITER_LIGHTING.rasterSurfaceRadius, 238);
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.silhouetteCoverage, {
    model: "prepared-analytic-oblate-ellipsoid-alpha-coverage",
    projectionModel: "prepared-oblate-ellipsoid-camera-projection",
    presentationScale: 1.002,
    materialScale: 0.992,
    rimFill: "prepared-subpixel-analytic-ellipse-edge-coverage",
    sourcePixelBleed: 0,
    perPitch: true,
    supersampling: 1,
    screenshotDerived: false,
    runtime: false,
  });
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.worldLightDirection,
    [0.883835, -0.385595, 0.264864]);
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.illuminationGeometry, {
    source: "NASA PSG pinned Jupiter configuration",
    sourcePath: "source/atmosphere/psg-jupiter-20260830.cfg",
    solarLongitudeDegrees: 56.4,
    solarLatitudeDegrees: 0.53,
    observerLongitudeDegrees: 60.76,
    observerLatitudeDegrees: 0.46,
    phaseAngleDegrees: 4.360399,
    observationLightDirection: [-0.07602, -0.001245, 0.997106],
    presentation: {
      authority: "OpenSpace default scene-graph Sun direction",
      qualityReference: "Saturn",
      referencePath: "src/planets/saturn/runtime/preparedRingPoints.mjs",
      sourceRenderer:
        "OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl",
      worldLightDirection: [0.883835, -0.385595, 0.264864],
      cameraAngleDegrees: 74.641134,
      screenshotDerived: false,
      runtimeEphemeris: false,
    },
    defaultScenePitchDegrees: 40,
    poleFrame: "north-up-aligned",
    runtimeEphemeris: false,
  });
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.shadow, {
    model: "prepared-saturn-standard-openspace-terminator-opal-minnaert",
    source:
      "OpenSpace scene light, RenderableGlobe geometry, and Hubble OPAL photometry",
    ambientFloor: 0.05,
    terminatorSmoothstep: [0, 0.1],
    displayTransfer: "sRGB IEC 61966-2-1",
    referenceChannel: 160,
    linearLight: true,
    fixedWorldDirection: true,
    runtimeLightingMath: false,
  });
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.atmosphere, {
    model: "prepared-hubble-opal-minnaert-visible-cloud-atmosphere",
    source: "NASA Hubble WFC3 visible atmosphere and OPAL photometry",
    photometry: {
      source: "Simon, Wong, and Orton 2015 Hubble OPAL Jupiter photometry",
      sourcePath: "source/atmosphere/hubble-opal-minnaert.json",
      sourceDoi: "10.1088/0004-637X/812/1/55",
      law: "Minnaert",
      channels: [
        { channel: "red", filter: "F631N", wavelengthNanometers: 631,
          minnaertK: 0.999 },
        { channel: "green", filter: "F502N", wavelengthNanometers: 502,
          minnaertK: 0.95 },
        { channel: "blue", filter: "F395N", wavelengthNanometers: 395,
          minnaertK: 0.85 },
      ],
      mapComposite: "red=F631N, green=F502N, blue=F395N",
      runtimePhotometry: false,
    },
    sourceReference: {
      source: "NASA, ESA, STScI, and Amy Simon Hubble 5 January 2024 full disc",
      sourcePath: "source/presentation/navigation-marker.png",
      sourceSize: [1312, 1312],
      sourceColorSpace: "sRGB IEC 61966-2-1",
      discDetection: {
        thresholdRgb8: 4,
        bounds: [120, 147, 1083, 1024],
        connectedPixelCount: 869875,
      },
      exteriorAnnulus: [1.005, 1.03],
      exteriorSampleCount: 44312,
      exteriorMaximumRgb8: 0,
      publishedExteriorHalo: false,
    },
    colorOverlay: true,
    externalHalo: false,
    runtimeRasterization: false,
    runtimePhotometry: false,
  });
  assert.deepEqual(PREPARED_JUPITER_LIGHTING.transport, {
    model: "row-shard-cache",
    preloadBeforeMount: true,
    retainedLeafCount: 1,
    interpolation: "nearest-prepared-half-degree-frame",
    frameGutter: 8,
    rasterFrameGutter: 8,
    framesPerRow: 4,
    rowColumns: 4,
    rowCount: 46,
    defaultFrame: 86,
    defaultRow: 21,
    initialWarmRows: [20, 21, 22],
    maximumRetainedRowCount: 3,
    addressWritesOnlyOnInput: true,
    retainLastReadyPresentation: true,
    encoding: "lossless-webp",
    idleCallbacks: 0,
    publicationModel: "content-addressed-complete-bank-switch",
    initialDecodedWorkingSetBytes: 13381632,
    maximumDecodedWorkingSetBytes: 13381632,
  });
  assert.equal(PREPARED_JUPITER_LIGHTING.fullBankDecodedRgbaBytes, 201839616);
});

test("uses the Hubble halo evidence and linear-light discipline", async () => {
  assert.deepEqual(
    await measurePublishedJupiterAtmosphereReference(),
    PREPARED_JUPITER_LIGHTING.atmosphere.sourceReference,
  );
  assert.equal(applyJupiterLinearLight(160, 0.5), 116);
  assert.notEqual(applyJupiterLinearLight(160, 0.5), 80);
  const frame = prepareJupiterMaterialFrame(40);
  const outsideOffset = (256 * frame.width + 500) * 4;
  assert.deepEqual([...frame.data.subarray(outsideOffset, outsideOffset + 4)],
    [0, 0, 0, 0]);
  const centerOffset = (256 * frame.width + 256) * 4;
  const litOffset = (256 * frame.width + 450) * 4;
  const shadowOffset = (256 * frame.width + 125) * 4;
  assert.ok(frame.data[centerOffset + 3] > frame.data[litOffset + 3]);
  assert.ok(frame.data[shadowOffset + 3] > frame.data[centerOffset + 3]);
  assert.ok(frame.data[shadowOffset + 3] >= 190);
  assert.ok(
    frame.data[litOffset] !== frame.data[litOffset + 1] ||
    frame.data[litOffset + 1] !== frame.data[litOffset + 2],
  );
});

test("requires a readable prepared terminator at the default view", () => {
  const frame = prepareJupiterMaterialFrame(40);
  const terminator = measureReadablePreparedTerminator(frame);
  assert.ok(terminator.projectedLightMagnitude >= 0.8,
    `presentation light is still camera-flat: ${JSON.stringify(terminator)}`);
  assert.ok(terminator.litMean >= 120,
    `lit hemisphere is too dim: ${JSON.stringify(terminator)}`);
  assert.ok(terminator.shadowMean <= 90,
    `shadow hemisphere is too bright: ${JSON.stringify(terminator)}`);
  assert.ok(terminator.hemisphereContrast >= 45,
    `terminator contrast is unreadable: ${JSON.stringify(terminator)}`);
  assert.ok(terminator.shadowFractionBelow100 >= 0.5,
    `shadow coverage is insufficient: ${JSON.stringify(terminator)}`);
});

test("fits every prepared atmosphere frame to the projected oblate body", () => {
  const defaultProjection = prepareJupiterMaterialProjection(40);
  assert.deepEqual(defaultProjection, {
    model: "prepared-oblate-ellipsoid-camera-projection",
    pitchDegrees: 40,
    rotationXDegrees: 43.13,
    radiusX: 230,
    radiusY: 223.150307,
    rasterRadiusX: 238,
    rasterRadiusY: 230.912057,
    rasterCoverageRadiusX: 238.476,
    rasterCoverageRadiusY: 231.373881,
    presentationScale: 1.002,
    materialScale: 0.992,
    right: [1, 0, 0],
    down: [0, 0.729804415237, -0.683655992076],
    view: [0, 0.683655992076, 0.729804415237],
    runtime: false,
  });
  assert.ok(prepareJupiterMaterialProjection(-3.13).radiusY >
    defaultProjection.radiusY);
  assert.ok(prepareJupiterMaterialProjection(86.87).radiusY <
    defaultProjection.radiusY);
  assert.ok(Math.abs(
    defaultProjection.rasterCoverageRadiusY /
      defaultProjection.rasterRadiusY - 1.002,
  ) < 1e-8);
});

test("pins every prepared lighting row to its runtime bytes", async () => {
  assert.equal(PREPARED_JUPITER_LIGHTING.rows.length, 46);
  assert.equal(PREPARED_JUPITER_LIGHTING.presentations.length, 181);
  let totalBytes = 0;
  for (const row of PREPARED_JUPITER_LIGHTING.rows) {
    const bytes = await readFile(new URL(
      `../../../../public${row.url}`,
      import.meta.url,
    ));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, row.width);
    assert.equal(metadata.height, row.height);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), row.sha256);
    assert.equal(bytes.byteLength, row.bytes);
    totalBytes += bytes.byteLength;
  }
  assert.equal(totalBytes, PREPARED_JUPITER_LIGHTING.totalBytes);
  assert.notEqual(
    PREPARED_JUPITER_LIGHTING.rows[0].sha256,
    PREPARED_JUPITER_LIGHTING.rows.at(-1).sha256,
  );
  assert.deepEqual(
    PREPARED_JUPITER_LIGHTING.presentations.map(({ frameIndex }) => frameIndex),
    Array.from({ length: 181 }, (_, index) => index),
  );
  assert.deepEqual(
    PREPARED_JUPITER_LIGHTING.presentations[86].projection,
    prepareJupiterMaterialProjection(39.87),
  );
});

test("prepares the shared unbounded cubic-sky camera contract", () => {
  assert.equal(PREPARED_JUPITER_CAMERA.schema, "cssjupiter-prepared-camera@6");
  assert.equal(PREPARED_JUPITER_CAMERA.cameraModel, "accumulated-matrix3d");
  assert.equal(PREPARED_JUPITER_CAMERA.minimumControlPitchDegrees, 0);
  assert.equal(PREPARED_JUPITER_CAMERA.maximumControlPitchDegrees, 89);
  assert.equal(PREPARED_JUPITER_CAMERA.defaultControlPitchDegrees,
    34.230769230769226);
  assert.equal(PREPARED_JUPITER_CAMERA.defaultControlYawDegrees, 0);
  assert.equal(PREPARED_JUPITER_CAMERA.initialScenePitchDegrees, 40);
  assert.equal(PREPARED_JUPITER_CAMERA.maximumScenePitchDegrees, 65);
  assert.equal(PREPARED_JUPITER_CAMERA.defaultZoom, 1.1);
  assert.equal(PREPARED_JUPITER_CAMERA.minimumZoom, 0.42);
  assert.equal(PREPARED_JUPITER_CAMERA.maximumZoom, 4);
  assert.equal(PREPARED_JUPITER_CAMERA.sceneScale, 0.022);
  assert.equal(PREPARED_JUPITER_CAMERA.logicalBodyDiameter, 460);
  assert.deepEqual(PREPARED_JUPITER_CAMERA.materialDepthPresentation, {
    model: "prepared-front-depth-biased-camera-facing-material-plane",
    materialSystemTransform: "transform:rotateX(3.13deg)",
    materialMeshTransform: "transform:rotateZ(-145deg)",
    leafTransform:
      "matrix3d(-39.580876089594,27.714827806878,0,0," +
      "-20.226403700986,-28.886298129124,-33.033797936429,0," +
      "-19.60644838124,-28.00091017496,36.490220761837,0," +
      "10944.747488320054,-5935.278027690676,16582.205692110612,1)",
    cameraPerspectivePx: 1_000_000,
    frameSize: 512,
    rasterSurfaceRadius: 238,
    scenePitchDegrees: 40,
    frontDepth: 222.177563,
    depthBias: 0.5,
    right: [0.573576436351, -0.819152044289, 0],
    down: [-0.597820778672, -0.418598615725, -0.683655992076],
    view: [-0.560018203499, -0.392128967625, 0.729804415237],
    runtimeDepthMath: false,
    runtimeZoomTransformWrites: false,
  });
  assert.equal(PREPARED_JUPITER_CAMERA.horizontalOrbit, true);
  assert.equal(PREPARED_JUPITER_CAMERA.pitchBounded, false);
  assert.equal(PREPARED_JUPITER_CAMERA.yawBounded, false);
  assert.equal(PREPARED_JUPITER_CAMERA.runtimeMatrixFormatting, true);
  assert.equal(PREPARED_JUPITER_CAMERA.responsiveFit.model,
    "continuous-aspect-smoothstep");
});

test("keeps unattended playback on compositor animations", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /createRetainedCubicSkyOrbit/);
  assert.match(client, /counterRotationFor/);
  assert.match(client, /sunViewDirection/);
  assert.doesNotMatch(client, /orbitBank|DecompressionStream/);
  assert.match(client, /createRowShardCache/);
  assert.match(client, /materialCache\.presentation\(materialFrame\)/);
  assert.match(client, /mounted\.materialLeaf\.style\.backgroundPosition/);
  assert.doesNotMatch(client, /materialLeaves|\.style\.opacity/);
  assert.doesNotMatch(client, /setInterval|setTimeout|DOMMatrix|canvas|getContext/);
  assert.doesNotMatch(css, /clip-path|mask:|filter:|linear-gradient|radial-gradient|mix-blend-mode/);
  assert.match(css, /html\[data-playing="true"\] \.jupiter-body/);
});

function measureReadablePreparedTerminator(frame) {
  const reference = PREPARED_JUPITER_LIGHTING.shadow.referenceChannel;
  const center = frame.width / 2;
  const [lightX, lightY] = frame.cameraLightDirection;
  const projectedLightMagnitude = Math.hypot(lightX, lightY);
  const projectedLightX = lightX / projectedLightMagnitude;
  const projectedLightY = lightY / projectedLightMagnitude;
  const lit = [];
  const shadow = [];
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const normalizedX = (x + 0.5 - center) /
        frame.projection.rasterCoverageRadiusX;
      const normalizedY = (y + 0.5 - center) /
        frame.projection.rasterCoverageRadiusY;
      if (normalizedX ** 2 + normalizedY ** 2 > 0.85 ** 2) continue;
      const lightwardPosition = normalizedX * projectedLightX +
        normalizedY * projectedLightY;
      if (Math.abs(lightwardPosition) < 0.2) continue;
      const offset = (y * frame.width + x) * 4;
      const alpha = frame.data[offset + 3] / 255;
      const red = frame.data[offset] * alpha + reference * (1 - alpha);
      const green = frame.data[offset + 1] * alpha + reference * (1 - alpha);
      const blue = frame.data[offset + 2] * alpha + reference * (1 - alpha);
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      (lightwardPosition > 0 ? lit : shadow).push(luminance);
    }
  }
  const mean = (values) => values.reduce((total, value) =>
    total + value, 0) / values.length;
  const litMean = mean(lit);
  const shadowMean = mean(shadow);
  return Object.freeze({
    projectedLightMagnitude,
    litMean,
    shadowMean,
    hemisphereContrast: litMean - shadowMean,
    shadowFractionBelow100:
      shadow.filter((value) => value < 100).length / shadow.length,
  });
}
