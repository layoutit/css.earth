import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const runRoot = resolve(process.argv[2] ?? resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1/" +
    "run-granular-authoritative-2026-09-02",
));
const rawContractPath = resolve(runRoot, "granular-render-contract.json");
const rawContract = JSON.parse(await readFile(rawContractPath, "utf8"));
const samples = (await readFile(rawContract.rawSamples, "utf8")).trim()
  .split("\n").filter(Boolean).map((line) => JSON.parse(line));
if (samples.length !== 201) {
  throw new Error(`Expected 201 granular samples; got ${samples.length}.`);
}

const authoritativeRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1/" +
    "run-authoritative-contract-2026-09-02",
);
const [sourceIndex, sourceSkybox, sourceSun] = await Promise.all([
  readJson(resolve(authoritativeRoot, "contract-index.json")),
  readJson(resolve(authoritativeRoot, "skybox-contract.json")),
  readJson(resolve(authoritativeRoot, "sun-presentation-contract.json")),
]);

const analyticBases = samples.map(({ requested }) => cameraBasis(requested));
const basisResiduals = samples.map((sample, index) => {
  const actual = captureBasis(sample);
  const expected = analyticBases[index];
  return Object.freeze({
    directionDegrees: vectorAngleDegrees(actual.direction, expected.direction),
    rightDegrees: vectorAngleDegrees(actual.right, expected.right),
    upDegrees: vectorAngleDegrees(actual.up, expected.up),
  });
});
const directionNorms = samples.map((sample) => vectorLength(
  sample.skyMap.uniforms.view_dir.slice(0, 3),
));
const rightNorms = samples.map((sample) => vectorLength(
  sample.skyMap.uniforms.view_right.slice(0, 3),
));
const upNorms = samples.map((sample) => vectorLength(
  sample.skyMap.uniforms.view_up.slice(0, 3),
));
const focalX = mean(directionNorms) / mean(rightNorms);
const focalY = mean(directionNorms) / mean(upNorms);
const projections = samples.map((sample) =>
  extractProjection(sample.catalogue.uniforms.ig_ModelViewProjectionMatrix));

const catalogueRotations = samples.map((sample, index) =>
  extractCatalogueRotation(
    sample.catalogue.uniforms.ig_ModelViewProjectionMatrix,
    projections[index],
  ));
const frameFlip = Object.freeze([
  Object.freeze([1, 0, 0]),
  Object.freeze([0, 1, 0]),
  Object.freeze([0, 0, -1]),
]);
const equatorialToSkyMapSamples = samples.map((sample, index) => {
  const skyRotation = matrix3FromColumnMajor4(
    sample.skyMap.uniforms.starsToCameraMatrix,
  );
  const cameraToBody = basisMatrix(analyticBases[index]);
  return multiply3(
    skyRotation,
    multiply3(
      cameraToBody,
      multiply3(frameFlip, catalogueRotations[index]),
    ),
  );
});
const equatorialToSkyMap = averageMatrices(equatorialToSkyMapSamples);
const conversionResidual = matrixResidual(
  equatorialToSkyMapSamples,
  equatorialToSkyMap,
);
const catalogueReconstructionErrors = samples.map((sample, index) => {
  const skyRotation = matrix3FromColumnMajor4(
    sample.skyMap.uniforms.starsToCameraMatrix,
  );
  const cameraToBody = basisMatrix(analyticBases[index]);
  const predictedRotation = multiply3(
    frameFlip,
    multiply3(
      transpose3(cameraToBody),
      multiply3(transpose3(skyRotation), equatorialToSkyMap),
    ),
  );
  const predicted = catalogueMvp(predictedRotation, projections[index]);
  return maximumAbsoluteDifference(
    predicted,
    sample.catalogue.uniforms.ig_ModelViewProjectionMatrix,
  );
});

const skyTimeModel = fitSkyRotation(samples);
const drawnSun = samples.flatMap((sample, index) => sample.sun === null
  ? []
  : [{ sample, index, direction: recoverSunDirection(
    sample,
    analyticBases[index],
  ) }]);
const sunTimeModel = fitSunDirection(drawnSun);
const sunDistanceOverFar = drawnSun.map(({ sample, index }) =>
  sample.sunPresentation.cameraDistance / projections[index].far);
const sunHalfExtentOverFar = drawnSun.map(({ sample, index }) =>
  sample.sunPresentation.localHalfExtent / projections[index].far);
const sunHalfExtentOverCenter = drawnSun.map(({ sample }) =>
  sample.sunPresentation.halfExtentPerCameraDistance);
const centerFactor = mean(sunDistanceOverFar);
const sunCenterResiduals = drawnSun.map(({ sample, index }) => {
  const direction = sunDirectionAt(
    sunTimeModel,
    Date.parse(sample.completedAt) / 1_000,
  );
  const bodyToCameraRay = transpose3(basisMatrix(analyticBases[index]));
  const cameraRay = multiplyVector3(bodyToCameraRay, direction);
  const distance = projections[index].far * centerFactor;
  const cameraGl = [
    cameraRay[0] * distance,
    cameraRay[1] * distance,
    -cameraRay[2] * distance,
    1,
  ];
  const predicted = project4(projections[index].matrix, cameraGl);
  const actual = sample.sunPresentation.centerNdc;
  return Object.freeze({
    visibility: sample.sunPresentation.visibility,
    ndc: Math.hypot(predicted[0] - actual[0], predicted[1] - actual[1]),
    pixels: Math.hypot(
      (predicted[0] - actual[0]) * sample.sun.viewport[2] / 2,
      (predicted[1] - actual[1]) * sample.sun.viewport[3] / 2,
    ),
  });
});
const visibleSunCenterResiduals = sunCenterResiduals.filter(({ visibility }) =>
  visibility === "fully-visible" || visibility === "partially-visible");
const culling = samples.map((sample, index) => {
  const direction = sunDirectionAt(
    sunTimeModel,
    Date.parse(sample.completedAt) / 1_000,
  );
  const separationDegrees = vectorAngleDegrees(
    direction,
    analyticBases[index].direction,
  );
  const front = dot(direction, analyticBases[index].direction) > 0;
  const inferredMechanism = sample.sun !== null
    ? "drawn"
    : front ? "planet-occultation-cull" : "rear-frustum-cull";
  return Object.freeze({
    index: sample.index,
    family: sample.requested.family,
    familyIndex: sample.familyIndex,
    requested: sample.requested,
    drawState: sample.sunPresentation.visibility,
    inferredMechanism,
    sunToViewCenterDegrees: separationDegrees,
    near: projections[index].near,
    far: projections[index].far,
  });
});

const componentShaders = rawContract.exactProgramShaders.filter(({ program }) =>
  [6, 24, 27].includes(program));
const projectionResiduals = projections.map(({ starDistance, measuredScale }) =>
  Math.abs(starDistance - measuredScale));
const contactSheetPath = await createContactSheet(samples);
const sequencePackages = await collectSequencePackages();
const implementationContract = Object.freeze({
  schema: "cssmars-google-earth-pro-implementation-render-contract@1",
  qualification:
    "NATIVE_HEADLESS_CAMERA_SKYMAP_CATALOGUE_SUN_EQUATIONS_WITH_MEASURED_RESIDUALS",
  generatedAt: new Date().toISOString(),
  source: Object.freeze({
    application: "Google Earth Pro Mars",
    version: rawContract.source.version,
    architecture: rawContract.source.architecture,
    executableSha256: rawContract.source.executableSha256,
    rendererSha256: sourceIndex.sourceApplication.rendererSha256,
    linkedProgramShaders: componentShaders,
    exactResources: sourceIndex.resources,
  }),
  capture: Object.freeze({
    sampleCount: samples.length,
    families: rawContract.capture.families,
    viewport: rawContract.capture.viewport,
    visibleWindowCount: 0,
    rawSampleLog: rawContract.rawSamples,
    visualEvidence: contactSheetPath,
    sequencePackages,
    inputQualification:
      "Programmatic native SetViewInfo trajectories; endpoint geometry and time response are proven, pointer gesture timing is not.",
  }),
  camera: Object.freeze({
    requestedState: Object.freeze([
      "latitude", "longitude", "distance", "heading", "tilt",
    ]),
    bodyFrame: Object.freeze({
      radial:
        "n = [cos(lat)*sin(lon), -sin(lat), cos(lat)*cos(lon)]",
      eastScreenRightAtZeroHeading:
        "r = [-cos(lon), 0, sin(lon)]",
      northScreenUpAtZeroHeading:
        "u = [sin(lat)*sin(lon), cos(lat), sin(lat)*cos(lon)]",
      headingTangent: "s = r*sin(heading) + u*cos(heading)",
      viewDirection: "d = n*cos(tilt) + s*sin(tilt)",
      viewRight: "x = r*cos(heading) - u*sin(heading)",
      viewUp: "y = s*cos(tilt) - n*sin(tilt)",
      maximumAngularResidualDegrees: Object.freeze({
        direction: Math.max(...basisResiduals.map(({ directionDegrees }) =>
          directionDegrees)),
        right: Math.max(...basisResiduals.map(({ rightDegrees }) =>
          rightDegrees)),
        up: Math.max(...basisResiduals.map(({ upDegrees }) => upDegrees)),
      }),
    }),
    skyRay: Object.freeze({
      equation:
        "ray = view_dir + ndcY*view_up + ndcX*view_right",
      viewDirectionScale: numericRange(directionNorms),
      viewRightScale: numericRange(rightNorms),
      viewUpScale: numericRange(upNorms),
    }),
    projection: Object.freeze({
      convention: "OpenGL right-handed perspective; clipW = -cameraZ",
      focalX,
      focalY,
      horizontalFovDegrees: 2 * Math.atan(1 / focalX) * 180 / Math.PI,
      verticalFovDegrees: 2 * Math.atan(1 / focalY) * 180 / Math.PI,
      matrix:
        "[[focalX,0,0,0],[0,focalY,0,0],[0,0,A,B],[0,0,-1,0]]",
      nearFromAB: "near = B / (A - 1)",
      farFromAB: "far = B / (A + 1)",
      nearRange: numericRange(projections.map(({ near }) => near)),
      farRange: numericRange(projections.map(({ far }) => far)),
    }),
  }),
  skybox: Object.freeze({
    passes: Object.freeze({
      skyMap: Object.freeze({
        draw: sourceSkybox.skyMap.draw,
        sampler: sourceSkybox.skyMap.sampler,
        exactShaderFormula: Object.freeze([
          "win = gl_FragCoord.xy * viewport_crop.zw + viewport_crop.xy",
          "dir = view_dir + view_up*win.y + view_right*win.x",
          "dir = normalize(starsToCameraMatrix * vec4(dir,1))",
          "dir is converted galactic-to-equatorial and plate-carree projected",
          "rgb = texture2D(skymapTexture, uv).rgb * 0.35; alpha = 1",
        ]),
      }),
      catalogue: Object.freeze({
        draw: sourceSkybox.catalogue.draw,
        sampler: sourceSkybox.catalogue.sampler,
        attributes: sourceSkybox.catalogue.attributes,
        exactShaderFormula: Object.freeze([
          "position = MVP * cataloguePosition; gl_PointSize = 4.5",
          "radialIntensity = texture2D(radialResponse, [0.5*radius,0.5]).r",
          "radiance = RGB * magnitude * radialIntensity",
          "rgb = 1 - exp(-40 * radiance); alpha = radialIntensity",
        ]),
      }),
    }),
    coupling: Object.freeze({
      equatorialToSkyMap,
      equation:
        "equatorialToSkyMap = starsToCameraMatrix * cameraToBody * flipCameraZ * catalogueRotation",
      maximumMatrixElementResidual: conversionResidual.maximum,
      rmsMatrixElementResidual: conversionResidual.rms,
      catalogueRotation:
        "flipCameraZ * transpose(cameraToBody) * transpose(starsToCameraMatrix) * equatorialToSkyMap",
      catalogueSphereDistance: "(near + far) / 2",
      maximumSphereDistanceResidual: Math.max(...projectionResiduals),
      maximumReconstructedMvpElementResidual:
        Math.max(...catalogueReconstructionErrors),
    }),
    time: skyTimeModel,
  }),
  sun: Object.freeze({
    identity: Object.freeze({
      visibleModel: "earth::evll::SunModel",
      lightModel: "earth::evll::SunLight",
      independentFromSkyMapAndCatalogue: true,
    }),
    draw: Object.freeze({
      program: sourceSun.defaultPath.drawProgram,
      primitive: sourceSun.defaultPath.primitive,
      vertexCount: sourceSun.defaultPath.vertexCount,
      blend: sourceSun.defaultPath.blend,
      depth: sourceSun.defaultPath.depth,
      texture: sourceSun.defaultPath.texture,
      linkedShaders: componentShaders.filter(({ program }) => program === 6),
    }),
    placement: Object.freeze({
      bodyDirectionTimeModel: sunTimeModel,
      centerDistance: "far * centerDistanceOverFar.mean",
      centerDistanceOverFar: numericRange(sunDistanceOverFar),
      localHalfExtent: "far * halfExtentOverFar.mean",
      halfExtentOverFar: numericRange(sunHalfExtentOverFar),
      halfExtentOverCenter: numericRange(sunHalfExtentOverCenter),
      localGeometry: "square XY quad at local Z=0",
      billboardNormal:
        "the local plane normal points from the Sun center toward the camera",
      apparentSize:
        "independent of zoom while visible because center and half-extent both scale with far",
      maximumCenterReplayResidualPixels:
        Math.max(...visibleSunCenterResiduals.map(({ pixels }) => pixels)),
      rmsCenterReplayResidualPixels: Math.sqrt(mean(
        visibleSunCenterResiduals.map(({ pixels }) => pixels * pixels),
      )),
      replayResidualScope:
        "fully or partially visible Sun samples; near-camera-plane samples are excluded because NDC is singular there",
    }),
    culling: Object.freeze({
      states: Object.freeze([
        "fully-visible", "partially-visible", "outside-viewport",
        "behind-camera", "draw-culled",
      ]),
      drawCount: drawnSun.length,
      omittedDrawCount: samples.length - drawnSun.length,
      inferredPlanetOccultationCount: culling.filter(({ inferredMechanism }) =>
        inferredMechanism === "planet-occultation-cull").length,
      inferredRearFrustumCount: culling.filter(({ inferredMechanism }) =>
        inferredMechanism === "rear-frustum-cull").length,
      zoomOccultationTransitionMeters: Object.freeze({
        lastCulled: maximumRequestedDistance(culling, "draw-culled"),
        firstDrawn: minimumRequestedDistance(culling, "fully-visible"),
        path: "log-zoom",
      }),
      samples: culling,
    }),
  }),
  qualifications: Object.freeze({
    proven: Object.freeze([
      "camera orientation equations",
      "projection and dynamic near/far extraction",
      "sky-map ray and UV shader path",
      "catalogue projection, star record, radial response, and tone map",
      "shared sky-map/catalogue celestial transform",
      "Sun texture, shader, billboard scale law, motion, clipping, and draw omission",
    ]),
    unresolved: Object.freeze([
      "repeatable native timeline/epoch control",
      "native pointer-drag temporal easing and inertia",
      "roll and non-default field-of-view controls",
      "multiple native save-render viewport aspect ratios",
    ]),
  }),
});

const implementationPath = resolve(runRoot, "implementation-contract.json");
await writeFile(
  implementationPath,
  `${JSON.stringify(implementationContract, null, 2)}\n`,
);
const index = Object.freeze({
  schema: "cssmars-google-earth-pro-granular-contract-index@1",
  qualification: implementationContract.qualification,
  generatedAt: implementationContract.generatedAt,
  rawContract: Object.freeze({
    path: rawContractPath,
    sha256: await fileSha256(rawContractPath),
  }),
  implementationContract: Object.freeze({
    path: implementationPath,
    sha256: await fileSha256(implementationPath),
  }),
  visualEvidence: contactSheetPath,
  sequencePackages,
  validation: Object.freeze({
    sampleCount: samples.length,
    cameraMaximumAngularResidualDegrees:
      implementationContract.camera.bodyFrame.maximumAngularResidualDegrees,
    skyCatalogueMaximumMvpResidual:
      implementationContract.skybox.coupling
        .maximumReconstructedMvpElementResidual,
    sunMaximumCenterReplayResidualPixels:
      implementationContract.sun.placement.maximumCenterReplayResidualPixels,
  }),
});
const indexPath = resolve(runRoot, "contract-index-granular.json");
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: true,
  qualification: index.qualification,
  implementationPath,
  indexPath,
  contactSheetPath,
  validation: index.validation,
}, null, 2)}\n`);

function cameraBasis({ latitude, longitude, heading, tilt }) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  const azimuth = heading * Math.PI / 180;
  const pitch = tilt * Math.PI / 180;
  const radial = [
    Math.cos(lat) * Math.sin(lon),
    -Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  ];
  const rightAtZero = [-Math.cos(lon), 0, Math.sin(lon)];
  const upAtZero = [
    Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
    Math.sin(lat) * Math.cos(lon),
  ];
  const headingTangent = add3(
    scale3(rightAtZero, Math.sin(azimuth)),
    scale3(upAtZero, Math.cos(azimuth)),
  );
  return Object.freeze({
    direction: normalize3(add3(
      scale3(radial, Math.cos(pitch)),
      scale3(headingTangent, Math.sin(pitch)),
    )),
    right: normalize3(add3(
      scale3(rightAtZero, Math.cos(azimuth)),
      scale3(upAtZero, -Math.sin(azimuth)),
    )),
    up: normalize3(add3(
      scale3(headingTangent, Math.cos(pitch)),
      scale3(radial, -Math.sin(pitch)),
    )),
  });
}

function captureBasis(sample) {
  return Object.freeze({
    direction: normalize3(sample.skyMap.uniforms.view_dir.slice(0, 3)),
    right: normalize3(sample.skyMap.uniforms.view_right.slice(0, 3)),
    up: normalize3(sample.skyMap.uniforms.view_up.slice(0, 3)),
  });
}

function basisMatrix({ right, up, direction }) {
  return Object.freeze([
    Object.freeze([right[0], up[0], direction[0]]),
    Object.freeze([right[1], up[1], direction[1]]),
    Object.freeze([right[2], up[2], direction[2]]),
  ]);
}

function extractProjection(mvp) {
  const ratios = [];
  for (let column = 0; column < 3; column += 1) {
    const z = mvp[column * 4 + 2];
    const w = mvp[column * 4 + 3];
    if (Math.abs(w) > 1e-6) ratios.push(-z / w);
  }
  const A = mean(ratios);
  const B = mvp[14];
  const near = B / (A - 1);
  const far = B / (A + 1);
  const measuredScaleX = Math.hypot(mvp[0], mvp[4], mvp[8]) / focalX;
  const measuredScaleY = Math.hypot(mvp[1], mvp[5], mvp[9]) / focalY;
  const measuredScale = (measuredScaleX + measuredScaleY) / 2;
  return Object.freeze({
    A,
    B,
    near,
    far,
    starDistance: (near + far) / 2,
    measuredScale,
    matrix: Object.freeze([
      focalX, 0, 0, 0,
      0, focalY, 0, 0,
      0, 0, A, -1,
      0, 0, B, 0,
    ]),
  });
}

function extractCatalogueRotation(mvp, projection) {
  const scale = projection.measuredScale;
  return Object.freeze([
    Object.freeze([mvp[0] / (focalX * scale),
      mvp[4] / (focalX * scale), mvp[8] / (focalX * scale)]),
    Object.freeze([mvp[1] / (focalY * scale),
      mvp[5] / (focalY * scale), mvp[9] / (focalY * scale)]),
    Object.freeze([-mvp[3] / scale, -mvp[7] / scale, -mvp[11] / scale]),
  ]);
}

function catalogueMvp(rotation, projection) {
  const scale = projection.measuredScale;
  const modelView = [
    [rotation[0][0] * scale, rotation[0][1] * scale,
      rotation[0][2] * scale, 0],
    [rotation[1][0] * scale, rotation[1][1] * scale,
      rotation[1][2] * scale, 0],
    [rotation[2][0] * scale, rotation[2][1] * scale,
      rotation[2][2] * scale, 0],
    [0, 0, 0, 1],
  ];
  return rowsToColumnMajor4(multiply4(
    columnMajor4ToRows(projection.matrix),
    modelView,
  ));
}

function fitSkyRotation(allSamples) {
  const referenceTimeSeconds = Date.parse(allSamples[0].completedAt) / 1_000;
  const referenceMatrix = matrix3FromColumnMajor4(
    allSamples[0].skyMap.uniforms.starsToCameraMatrix,
  );
  const points = allSamples.map((sample) => {
    const relative = multiply3(
      transpose3(referenceMatrix),
      matrix3FromColumnMajor4(sample.skyMap.uniforms.starsToCameraMatrix),
    );
    return Object.freeze({
      time: Date.parse(sample.completedAt) / 1_000 - referenceTimeSeconds,
      angle: Math.atan2(relative[0][2], relative[0][0]) * 180 / Math.PI,
    });
  });
  const fit = linearFit(points);
  const residuals = allSamples.map((sample, index) => {
    const angle = (fit.intercept + fit.slope * points[index].time) *
      Math.PI / 180;
    return maximumAbsoluteDifference(
      flatten3(multiply3(referenceMatrix, rotationY(angle))),
      flatten3(matrix3FromColumnMajor4(
        sample.skyMap.uniforms.starsToCameraMatrix,
      )),
    );
  });
  return Object.freeze({
    referenceTimeUtc: new Date(referenceTimeSeconds * 1_000).toISOString(),
    referenceMatrix,
    equation:
      "starsToCameraMatrix(t) = referenceMatrix * rotationY(intercept + angularRate*(t-referenceTime))",
    interceptDegrees: fit.intercept,
    angularRateDegreesPerSecond: fit.slope,
    angularRateDegreesPerHour: fit.slope * 3_600,
    fittedPeriodHours: 360 / Math.abs(fit.slope * 3_600),
    maximumMatrixElementResidual: Math.max(...residuals),
    qualification:
      "Empirical live-time fit; the native timeline was not independently pinned.",
  });
}

function recoverSunDirection(sample, basis) {
  const modelView = sample.sun.uniforms.ig_ModelViewMatrix;
  const cameraRay = [modelView[12], modelView[13], -modelView[14]];
  return normalize3(multiplyVector3(basisMatrix(basis), cameraRay));
}

function fitSunDirection(sunSamples) {
  const referenceTimeSeconds = Date.parse(
    sunSamples[0].sample.completedAt,
  ) / 1_000;
  const points = sunSamples.map(({ sample, direction }) => ({
    time: Date.parse(sample.completedAt) / 1_000 - referenceTimeSeconds,
    angle: Math.atan2(direction[0], direction[2]) * 180 / Math.PI,
  }));
  unwrapAngles(points);
  const fit = linearFit(points);
  const y = mean(sunSamples.map(({ direction }) => direction[1]));
  const model = {
    referenceTimeUtc: new Date(referenceTimeSeconds * 1_000).toISOString(),
    azimuthAtReferenceDegrees: fit.intercept,
    angularRateDegreesPerSecond: fit.slope,
    angularRateDegreesPerHour: fit.slope * 3_600,
    fittedPeriodHours: 360 / Math.abs(fit.slope * 3_600),
    bodyY: y,
  };
  const errors = sunSamples.map(({ sample, direction }) =>
    vectorAngleDegrees(
      sunDirectionAt(model, Date.parse(sample.completedAt) / 1_000),
      direction,
    ));
  return Object.freeze({
    ...model,
    equation:
      "dir(t) = [sqrt(1-y^2)*sin(azimuth(t)), y, sqrt(1-y^2)*cos(azimuth(t))]",
    maximumAngularResidualDegrees: Math.max(...errors),
    rmsAngularResidualDegrees: Math.sqrt(mean(errors.map((value) =>
      value * value))),
    qualification:
      "Empirical body-frame fit from the exact Sun model-view translation; native timeline not independently pinned.",
  });
}

function sunDirectionAt(model, timeSeconds) {
  const reference = Date.parse(model.referenceTimeUtc) / 1_000;
  const angle = (model.azimuthAtReferenceDegrees +
    model.angularRateDegreesPerSecond * (timeSeconds - reference)) *
    Math.PI / 180;
  const radius = Math.sqrt(1 - model.bodyY * model.bodyY);
  return Object.freeze([
    radius * Math.sin(angle),
    model.bodyY,
    radius * Math.cos(angle),
  ]);
}

function maximumRequestedDistance(cullingSamples, drawState) {
  const distances = cullingSamples.filter(({ family, drawState: state }) =>
    family === "log-zoom" && state === drawState)
    .map(({ requested }) => requested.distance);
  return distances.length === 0 ? null : Math.max(...distances);
}

function minimumRequestedDistance(cullingSamples, drawState) {
  const distances = cullingSamples.filter(({ family, drawState: state }) =>
    family === "log-zoom" && state === drawState)
    .map(({ requested }) => requested.distance);
  return distances.length === 0 ? null : Math.min(...distances);
}

async function createContactSheet(allSamples) {
  const families = Object.keys(rawContract.capture.families);
  const selected = families.flatMap((family) => {
    const familySamples = allSamples.filter(({ requested }) =>
      requested.family === family);
    return Array.from({ length: 6 }, (_, index) => familySamples[Math.round(
      index * (familySamples.length - 1) / 5,
    )]);
  });
  const panelWidth = 418;
  const panelHeight = 259;
  const panels = await Promise.all(selected.map(({ framePath }) =>
    sharp(framePath).resize(panelWidth, panelHeight).png().toBuffer()));
  const outputPath = resolve(runRoot, "native-granular-contract-contact-sheet.png");
  await sharp({
    create: {
      width: panelWidth * 6,
      height: panelHeight * families.length,
      channels: 4,
      background: "#000000",
    },
  }).composite(panels.map((input, index) => ({
    input,
    left: (index % 6) * panelWidth,
    top: Math.floor(index / 6) * panelHeight,
  }))).png().toFile(outputPath);
  return outputPath;
}

async function collectSequencePackages() {
  return Object.freeze(await Promise.all(Object.entries(
    rawContract.capture.families,
  ).map(async ([family, expectedFrameCount]) => {
    const file = `google_earth_pro_mars_${family.replaceAll("-", "_")}.json`;
    const path = resolve(runRoot, "sequences", family, "package", file);
    const manifest = await readJson(path);
    if (manifest.frameCount !== expectedFrameCount) {
      throw new Error(
        `${family} packaged ${manifest.frameCount}/${expectedFrameCount} frames.`,
      );
    }
    return Object.freeze({
      family,
      path,
      frameCount: manifest.frameCount,
      keyframeCount: manifest.keyframes.exported.length,
      sha256: await fileSha256(path),
    });
  })));
}

function matrix3FromColumnMajor4(matrix) {
  return Object.freeze(Array.from({ length: 3 }, (_, row) => Object.freeze(
    Array.from({ length: 3 }, (_, column) => matrix[column * 4 + row]),
  )));
}

function columnMajor4ToRows(matrix) {
  return Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, column) => matrix[column * 4 + row]));
}

function rowsToColumnMajor4(matrix) {
  return Array.from({ length: 16 }, (_, index) =>
    matrix[index % 4][Math.floor(index / 4)]);
}

function multiply3(left, right) {
  return left.map((row) => right[0].map((_, column) => row.reduce(
    (sum, value, index) => sum + value * right[index][column],
    0,
  )));
}

function multiply4(left, right) {
  return left.map((row) => right[0].map((_, column) => row.reduce(
    (sum, value, index) => sum + value * right[index][column],
    0,
  )));
}

function multiplyVector3(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function transpose3(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function rotationY(angle) {
  return [
    [Math.cos(angle), 0, Math.sin(angle)],
    [0, 1, 0],
    [-Math.sin(angle), 0, Math.cos(angle)],
  ];
}

function averageMatrices(matrices) {
  return matrices[0].map((row, rowIndex) => row.map((_, columnIndex) =>
    mean(matrices.map((matrix) => matrix[rowIndex][columnIndex]))));
}

function matrixResidual(matrices, reference) {
  const values = matrices.flatMap((matrix) => matrix.flatMap((row, rowIndex) =>
    row.map((value, columnIndex) => value - reference[rowIndex][columnIndex])));
  return Object.freeze({
    maximum: Math.max(...values.map(Math.abs)),
    rms: Math.sqrt(mean(values.map((value) => value * value))),
  });
}

function linearFit(points) {
  const meanX = mean(points.map(({ time }) => time));
  const meanY = mean(points.map(({ angle }) => angle));
  const numerator = points.reduce((sum, { time, angle }) =>
    sum + (time - meanX) * (angle - meanY), 0);
  const denominator = points.reduce((sum, { time }) =>
    sum + (time - meanX) ** 2, 0);
  const slope = numerator / denominator;
  return Object.freeze({ slope, intercept: meanY - slope * meanX });
}

function unwrapAngles(points) {
  let previous = points[0].angle;
  for (const point of points) {
    while (point.angle - previous > 180) point.angle -= 360;
    while (point.angle - previous < -180) point.angle += 360;
    previous = point.angle;
  }
}

function project4(matrix, vector) {
  const clip = Array.from({ length: 4 }, (_, row) =>
    matrix[row] * vector[0] + matrix[4 + row] * vector[1] +
    matrix[8 + row] * vector[2] + matrix[12 + row] * vector[3]);
  return Object.freeze([
    clip[0] / clip[3],
    clip[1] / clip[3],
    clip[2] / clip[3],
    clip[3],
  ]);
}

function flatten3(matrix) {
  return matrix.flat();
}

function maximumAbsoluteDifference(left, right) {
  return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

function vectorAngleDegrees(left, right) {
  return Math.acos(Math.max(-1, Math.min(1,
    dot(normalize3(left), normalize3(right)),
  ))) * 180 / Math.PI;
}

function add3(left, right) {
  return left.map((value, index) => value + right[index]);
}

function scale3(vector, scale) {
  return vector.map((value) => value * scale);
}

function normalize3(vector) {
  const length = vectorLength(vector);
  return vector.map((value) => value / length);
}

function vectorLength(vector) {
  return Math.hypot(...vector);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numericRange(values) {
  return Object.freeze({
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    mean: mean(values),
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
