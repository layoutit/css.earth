import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";

import sharp from "sharp";

import {
  getCurrentVersion,
  getStreamingProgress,
  getViewInfo,
  moveCamera,
  saveScreenShot,
  setViewInfo,
  waitForStreaming,
} from "./controller.mjs";
import {
  GOOGLE_EARTH_PRO_MARS_ORACLE,
  GOOGLE_EARTH_PRO_MARS_POSES,
} from "./profile.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const liveRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1",
);
const outputArgument = process.argv.slice(2).find((value) =>
  !value.startsWith("--"));
const runRoot = resolve(outputArgument ?? resolve(
  liveRoot,
  `run-${new Date().toISOString().replaceAll(/[:.]/gu, "-")}`,
));
if (!runRoot.startsWith(`${liveRoot}/run-`)) {
  throw new Error(`Output must be a run directory beneath ${liveRoot}.`);
}
const nativeRoot = resolve(runRoot, "native");
const starfieldFrameRoot = resolve(runRoot, "frames-starfield");
const sunFrameRoot = resolve(runRoot, "frames-starfield-sun");
const differenceRoot = resolve(runRoot, "frames-sun-difference");
const rawResourceRoot = resolve(runRoot, "resources-raw");
const resourcePreviewRoot = resolve(runRoot, "resources-preview");
const snapshotLogPath = resolve(runRoot, "renderer-snapshots.jsonl");
const uniformLogPath = resolve(runRoot, "active-uniforms.tsv");
const installLogPath = resolve(runRoot, "contract-hook-install.tsv");
const layerLiveRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-live-layer-matrix-v1",
);
const controlFilePath = resolve(layerLiveRoot, "mode.bin");
const controlLogPath = resolve(layerLiveRoot, "control.tsv");
const priorResourceRoot = resolve(liveRoot, "textures");
const appRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/Google Earth Pro Mars Oracle.app",
);
const executablePath = resolve(appRoot, "Contents/MacOS/Google Earth");
const appName = "id:dev.polycss.GoogleEarthProMarsOracle";
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/window-audit",
);
const hookManifestPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/contracts/manifest.json",
);
const crop = Object.freeze({ left: 0, top: 80, width: 2092, height: 1070 });
const limit = numberArgument("--limit", GOOGLE_EARTH_PRO_MARS_POSES.length);
const poses = GOOGLE_EARTH_PRO_MARS_POSES.slice(0, limit);

for (const path of [
  runRoot,
  nativeRoot,
  starfieldFrameRoot,
  sunFrameRoot,
  differenceRoot,
  rawResourceRoot,
  resourcePreviewRoot,
]) {
  await mkdir(path, { recursive: true });
}

execFileSync(process.execPath, [
  resolve(import.meta.dirname, "build-render-contract-hook.mjs"),
], { stdio: "inherit" });
const hookManifest = JSON.parse(await readFile(hookManifestPath, "utf8"));
const processState = await ensureInstrumentedOracle(hookManifest);
const version = await getCurrentVersion({ appName });
const beforeAudit = auditWindows(processState.pid);
assertHeadless(beforeAudit, processState.pid, "before capture");

const captures = [];
for (let index = 0; index < poses.length; index += 1) {
  const pose = poses[index];
  const requestedCamera = Object.freeze({
    latitude: pose.nativeCamera.latitude,
    longitude: pose.nativeCamera.longitude,
    distance: pose.nativeCamera.rangeMeters,
    tilt: pose.nativeCamera.tilt,
    azimuth: pose.nativeCamera.heading,
    speed: 10,
  });
  const immediateObservedCamera = await setViewInfo({
    ...requestedCamera,
    appName,
  });
  let streaming;
  try {
    streaming = await waitForStreaming({
      appName,
      stableReadings: 2,
      intervalMilliseconds: 125,
      timeoutMilliseconds: 5_000,
    });
  } catch (error) {
    streaming = Object.freeze({
      settled: false,
      warning: error.message,
      relevance:
        "Terrain streaming is out of scope because the ground draw is suppressed; renderer snapshots and native sky captures remain authoritative.",
    });
  }
  const observedCamera = await getViewInfo({ appName });
  const frameNumber = String(index + 1).padStart(4, "0");

  const off = await captureIsolatedState({
    pose,
    frameNumber,
    sun: false,
    frameRoot: starfieldFrameRoot,
    suffix: "starfield",
  });
  const on = await captureIsolatedState({
    pose,
    frameNumber,
    sun: true,
    frameRoot: sunFrameRoot,
    suffix: "starfield-sun",
  });
  const differencePath = resolve(differenceRoot, `frame_${frameNumber}.png`);
  const sunDifference = await compareAndRenderDifference(
    off.framePath,
    on.framePath,
    differencePath,
  );
  const offSnapshots = bestSnapshots(await snapshotsForRevision(off.control.revision));
  const onSnapshots = bestSnapshots(await snapshotsForRevision(on.control.revision));
  captures.push(Object.freeze({
    index: index + 1,
    pose,
    requestedCamera,
    immediateObservedCamera,
    observedCamera,
    normalizationDelta: numericDelta(requestedCamera, observedCamera),
    streaming,
    streamingProgress: await getStreamingProgress({ appName }),
    off: Object.freeze({ ...off, snapshots: offSnapshots }),
    on: Object.freeze({ ...on, snapshots: onSnapshots }),
    sunDifference,
  }));
  process.stdout.write(
    `[${index + 1}/${poses.length}] ${pose.id} ` +
      `sun-delta=${sunDifference.changedPixelRatioAboveTolerance.toFixed(6)}\n`,
  );
}

const interactions = await captureInteractionContract();
const afterAudit = auditWindows(processState.pid);
assertHeadless(afterAudit, processState.pid, "after capture");
const resourceManifest = await materializeResources(captures, processState.pid);
const contracts = deriveContracts(captures, interactions, resourceManifest);
const contactSheetPath = resolve(runRoot, "native-sun-sweep-contact-sheet.png");
await createSunContactSheet(captures, contactSheetPath);
const evidence = Object.freeze({
  schema: "cssmars-google-earth-pro-render-contract-evidence@1",
  qualification:
    "NATIVE_HEADLESS_CAMERA_SKY_AND_SUN_CONTRACT_EXTRACTED_FROM_LIVE_GL",
  generatedAt: new Date().toISOString(),
  application: Object.freeze({
    version,
    appRoot,
    executablePath,
    executableSha256: await fileSha256(executablePath),
    process: processState,
  }),
  provenance: Object.freeze({
    staticOracle: GOOGLE_EARTH_PRO_MARS_ORACLE,
    hookManifestPath,
    hookManifest,
    snapshotLogPath,
    uniformLogPath,
    controlFilePath,
    controlLogPath,
  }),
  capture: Object.freeze({
    posePlanCount: GOOGLE_EARTH_PRO_MARS_POSES.length,
    capturedPoseCount: poses.length,
    crop,
    channelTolerance: 5,
    headlessBefore: beforeAudit,
    headlessAfter: afterAudit,
    contactSheetPath,
  }),
  contracts,
  resources: resourceManifest,
  interactions,
  captures: Object.freeze(captures),
});
const evidencePath = resolve(runRoot, "render-contract-evidence.json");
const cameraContractPath = resolve(runRoot, "camera-contract.json");
const skyboxContractPath = resolve(runRoot, "skybox-contract.json");
const sunContractPath = resolve(runRoot, "sun-contract.json");
await Promise.all([
  writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`),
  writeFile(cameraContractPath, `${JSON.stringify(contracts.camera, null, 2)}\n`),
  writeFile(skyboxContractPath, `${JSON.stringify(contracts.skybox, null, 2)}\n`),
  writeFile(sunContractPath, `${JSON.stringify(contracts.sun, null, 2)}\n`),
]);
process.stdout.write(`${JSON.stringify({
  ok: true,
  qualification: evidence.qualification,
  evidencePath,
  cameraContractPath,
  skyboxContractPath,
  sunContractPath,
  contactSheetPath,
  capturedPoseCount: poses.length,
  headless: afterAudit.visibleWindowCount === 0,
  resources: resourceManifest.length,
}, null, 2)}\n`);

async function captureIsolatedState({
  pose,
  frameNumber,
  sun,
  frameRoot,
  suffix,
}) {
  const control = await setLayerControl({
    mode: "hide-ground",
    atmosphere: false,
    sun,
  });
  await new Promise((accept) => setTimeout(accept, sun ? 300 : 200));
  const nativeCapture = await saveScreenShot({
    path: resolve(nativeRoot, `${pose.id}-${suffix}`),
    appName,
  });
  const framePath = resolve(frameRoot, `frame_${frameNumber}.png`);
  await sharp(nativeCapture.path).rotate().extract(crop).png().toFile(framePath);
  await waitForRevisionSnapshots(control.revision);
  return Object.freeze({
    control,
    nativeCapture,
    framePath,
    frameSha256: await fileSha256(framePath),
  });
}

async function ensureInstrumentedOracle(manifest) {
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,state=,command="], {
    encoding: "utf8",
  }).split("\n").map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/u);
    return match === null ? null : {
      pid: Number(match[1]),
      state: match[2],
      command: match[3],
    };
  }).filter((entry) => entry !== null &&
    entry.command === executablePath && !entry.state.includes("E"));
  if (rows.length !== 1) {
    throw new Error(`Expected one healthy headless oracle; found ${rows.length}.`);
  }
  const [{ pid, state }] = rows;
  assertHeadless(auditWindows(pid), pid, "instrumentation attach");
  const lsof = execFileSync("/usr/sbin/lsof", ["-p", String(pid)], {
    encoding: "utf8",
  });
  const loadedHooks = [...new Set(lsof.split("\n").flatMap((line) => {
    const match = line.match(/(\/[^ ]*libcssmars_googleearth_contract_hook[^ ]*\.dylib)/u);
    return match === null ? [] : [match[1]];
  }))];
  const suitableLoaded = loadedHooks.some((path) =>
    path.endsWith("contract_hook.dylib") || path.endsWith("contract_hook_v3.dylib"));
  const lldbCommands = [
    lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG", snapshotLogPath),
    lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG", uniformLogPath),
    lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT", rawResourceRoot),
    lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_INSTALL_LOG", installLogPath),
  ];
  if (!suitableLoaded) {
    lldbCommands.push(
      `expr (void*)dlopen(${lldbString(manifest.artifacts.hook.path)}, 2)`,
    );
  }
  execFileSync("/usr/bin/lldb", [
    "-b", "-p", String(pid),
    ...lldbCommands.flatMap((command) => ["-o", command]),
    "-o", "detach",
    "-o", "quit",
  ], { stdio: "inherit", maxBuffer: 4 * 1024 * 1024 });
  return Object.freeze({
    pid,
    state,
    visibleWindowCount: 0,
    contractHooksLoadedBeforeAttach: Object.freeze(loadedHooks),
    loadedNewHook: !suitableLoaded,
    selectedHookPath: suitableLoaded
      ? loadedHooks.find((path) => path.endsWith("contract_hook_v3.dylib")) ??
        loadedHooks.find((path) => path.endsWith("contract_hook.dylib"))
      : manifest.artifacts.hook.path,
  });
}

async function setLayerControl({ mode, atmosphere, sun }) {
  const previous = await readFile(controlFilePath);
  if (previous.length !== 32) {
    throw new Error(`Layer control must be 32 bytes; got ${previous.length}.`);
  }
  const revision = (previous.readUInt32LE(20) + 1) >>> 0 || 1;
  const bytes = Buffer.alloc(32);
  bytes.write(mode, 0, 15, "utf8");
  bytes[16] = atmosphere ? 49 : 48;
  bytes[17] = sun ? 49 : 48;
  bytes.writeUInt32LE(revision, 20);
  const descriptor = await open(controlFilePath, "r+");
  try {
    await descriptor.write(bytes, 0, bytes.length, 0);
    await descriptor.sync();
  } finally {
    await descriptor.close();
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const history = await readControlLog();
    const applied = history.find((entry) => entry.revision === revision);
    if (applied !== undefined) {
      if (applied.atmosphere !== atmosphere || applied.sun !== sun) {
        throw new Error(`Control ${revision} acknowledged incorrect toggles.`);
      }
      return Object.freeze({ mode, atmosphere, sun, revision, applied });
    }
    await new Promise((accept) => setTimeout(accept, 50));
  }
  throw new Error(`Control revision ${revision} was not acknowledged.`);
}

async function waitForRevisionSnapshots(revision) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const snapshots = await snapshotsForRevision(revision);
    if (snapshots.some(({ classification }) => classification?.skyMap) &&
        snapshots.some(({ classification }) => classification?.catalogueStars)) {
      return;
    }
    await new Promise((accept) => setTimeout(accept, 50));
  }
  throw new Error(`Renderer snapshots missing for control revision ${revision}.`);
}

async function snapshotsForRevision(revision) {
  try {
    const source = await readFile(snapshotLogPath, "utf8");
    return source.trim().split("\n").filter(Boolean).map((line) =>
      JSON.parse(line)).filter((entry) => entry.revision === revision);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function bestSnapshots(snapshots) {
  const selected = new Map();
  for (const snapshot of snapshots) {
    const fixedTexture = snapshot.samplers?.fixedFunctionUnit0?.texture ?? 0;
    const key = [
      snapshot.context,
      snapshot.program,
      snapshot.primitive,
      snapshot.count,
      fixedTexture,
    ].join(":");
    const score = Object.keys(snapshot.attributes ?? {}).length * 1_000 +
      Object.keys(snapshot.uniforms ?? {}).length * 10 +
      Object.keys(snapshot.samplers ?? {}).length;
    const current = selected.get(key);
    if (current === undefined || score > current.score) {
      selected.set(key, { score, snapshot });
    }
  }
  return Object.freeze([...selected.values()].map(({ snapshot }) => snapshot));
}

async function captureInteractionContract() {
  const base = Object.freeze({
    latitude: 0,
    longitude: 0,
    distance: 7_800_000,
    tilt: 0,
    azimuth: 0,
    speed: 10,
  });
  const vectors = Object.freeze([
    [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25],
    [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2],
  ]);
  const traces = [];
  for (const [x, y] of vectors) {
    await setViewInfo({ ...base, appName });
    const before = await getViewInfo({ appName });
    const accepted = await moveCamera({ x, y, appName });
    const samples = [];
    const started = Date.now();
    for (const targetMilliseconds of [0, 50, 100, 200, 350]) {
      const remaining = targetMilliseconds - (Date.now() - started);
      if (remaining > 0) {
        await new Promise((acceptSleep) => setTimeout(acceptSleep, remaining));
      }
      samples.push(Object.freeze({
        elapsedMilliseconds: Date.now() - started,
        camera: await getViewInfo({ appName }),
      }));
    }
    const stopped = await moveCamera({ x: 0, y: 0, appName });
    await new Promise((accept) => setTimeout(accept, 100));
    const after = await getViewInfo({ appName });
    traces.push(Object.freeze({
      input: Object.freeze({ x, y }),
      before,
      accepted,
      samples: Object.freeze(samples),
      stopped,
      after,
      delta: numericDelta(before, after),
    }));
  }
  await setViewInfo({ ...base, appName });
  return Object.freeze({
    schema: "cssmars-google-earth-pro-move-camera-interaction@1",
    command: "MoveCamera {x, y}",
    interpretation:
      "The Apple event accepts x/y but the zero-window renderer showed no material public camera movement at the tested values; this command is not treated as a drag oracle.",
    base,
    traces: Object.freeze(traces),
  });
}

function deriveContracts(captureEntries, interactionEntries, resources) {
  const firstOff = captureEntries[0].off.snapshots;
  const firstSky = firstOff.find(({ classification }) => classification.skyMap);
  const firstStars = firstOff.find(({ classification }) =>
    classification.catalogueStars);
  if (firstSky === undefined || firstStars === undefined) {
    throw new Error("Missing sky or catalogue-star renderer contract.");
  }
  const dir = firstSky.uniforms.view_dir.slice(0, 3);
  const right = firstSky.uniforms.view_right.slice(0, 3);
  const up = firstSky.uniforms.view_up.slice(0, 3);
  const horizontalFovDegrees = 2 * Math.atan(vectorLength(right) /
    vectorLength(dir)) * 180 / Math.PI;
  const verticalFovDegrees = 2 * Math.atan(vectorLength(up) /
    vectorLength(dir)) * 180 / Math.PI;
  const pairedPrograms = captureEntries.map((entry) => {
    const offPrograms = new Set(entry.off.snapshots.map(({ program }) => program));
    const onPrograms = new Set(entry.on.snapshots.map(({ program }) => program));
    return Object.freeze({
      poseId: entry.pose.id,
      onOnlyPrograms: Object.freeze([...onPrograms].filter((id) =>
        !offPrograms.has(id))),
      offOnlyPrograms: Object.freeze([...offPrograms].filter((id) =>
        !onPrograms.has(id))),
      changedPixelRatioAboveTolerance:
        entry.sunDifference.changedPixelRatioAboveTolerance,
      changedBounds: entry.sunDifference.changedBounds,
      largestChangedComponent: entry.sunDifference.largestChangedComponent,
    });
  });
  const allOnOnlyPrograms = [...new Set(pairedPrograms.flatMap((entry) =>
    entry.onOnlyPrograms))].sort((left, right) => left - right);
  const sunVisibleCount = captureEntries.filter((entry) =>
    entry.sunDifference.largestChangedComponent.pixelCount > 100).length;
  return Object.freeze({
    camera: Object.freeze({
      schema: "cssmars-google-earth-pro-camera-contract@1",
      publicState: Object.freeze([
        "latitude", "longitude", "distance", "tilt", "azimuth",
      ]),
      nativeInternalStateFromDecompilation:
        GOOGLE_EARTH_PRO_MARS_ORACLE.renderer.camera.stateTuple,
      nativeSaveImageViewport: firstSky.viewport,
      shaderRayBasis: Object.freeze({
        viewDir: firstSky.uniforms.view_dir,
        viewRight: firstSky.uniforms.view_right,
        viewUp: firstSky.uniforms.view_up,
        viewportCrop: firstSky.uniforms.viewport_crop,
        derivedHorizontalFovDegrees: horizontalFovDegrees,
        derivedVerticalFovDegrees: verticalFovDegrees,
        derivation:
          "2*atan(length(basis offset)/length(view_dir)); verified against the live sky ray shader",
      }),
      poseResponses: Object.freeze(captureEntries.map((entry) => Object.freeze({
        poseId: entry.pose.id,
        family: entry.pose.family,
        requested: entry.requestedCamera,
        observed: entry.observedCamera,
        normalizationDelta: entry.normalizationDelta,
        skyStarsToCameraMatrix: entry.off.snapshots.find(({ classification }) =>
          classification.skyMap)?.uniforms.starsToCameraMatrix,
        catalogueModelViewProjectionMatrix:
          entry.off.snapshots.find(({ classification }) =>
            classification.catalogueStars)?.uniforms
            .ig_ModelViewProjectionMatrix,
      }))),
      interaction: interactionEntries,
    }),
    skybox: Object.freeze({
      schema: "cssmars-google-earth-pro-skybox-contract@1",
      architecture: Object.freeze([
        "full-screen projected sky-map quad",
        "independent 5000-point star catalogue",
      ]),
      skyMap: Object.freeze({
        draw: pickDrawContract(firstSky),
        uniforms: firstSky.uniforms,
        sampler: firstSky.samplers.skymapTexture,
        sourceFragmentScale: 0.35,
      }),
      catalogue: Object.freeze({
        draw: pickDrawContract(firstStars),
        uniforms: firstStars.uniforms,
        sampler: firstStars.samplers.t_tex0,
        attributes: firstStars.attributes,
        sourceExposure: 40,
        drawCount: 5_000,
        recordStrideBytes: 32,
        decodedRecord:
          "position float3 at byte 0; RGB plus magnitude float4 at byte 12; trailing 4 bytes unused by the shader",
      }),
      resources: Object.freeze(resources.filter(({ role }) =>
        role === "sky-map" || role === "star-radial-response" ||
        role === "star-catalogue-buffer")),
    }),
    sun: Object.freeze({
      schema: "cssmars-google-earth-pro-sun-contract@1",
      independentObjects: Object.freeze({
        visibleBillboard: "earth::evll::SunModel",
        directionalLight: "earth::evll::SunLight",
        sameAsSkyMap: false,
      }),
      staticSourceContract: GOOGLE_EARTH_PRO_MARS_ORACLE.renderer.sun,
      pairedPoseCount: captureEntries.length,
      visibleInIsolatedCaptureCount: sunVisibleCount,
      onOnlyPrograms: Object.freeze(allOnOnlyPrograms),
      pairs: Object.freeze(pairedPrograms),
      rendererStates: Object.freeze(captureEntries.map((entry) => Object.freeze({
        poseId: entry.pose.id,
        offRevision: entry.off.control.revision,
        onRevision: entry.on.control.revision,
        onSnapshots: entry.on.snapshots,
      }))),
      resources: Object.freeze(resources.filter(({ role }) =>
        role.startsWith("sun-candidate"))),
      interpretation:
        "Sun visibility is established only by registered Sun-off/Sun-on pairs; lighting and billboard presentation remain separate components.",
    }),
  });
}

function pickDrawContract(snapshot) {
  return Object.freeze({
    program: snapshot.program,
    primitive: snapshot.primitive,
    count: snapshot.count,
    viewport: snapshot.viewport,
    blendEnabled: snapshot.blendEnabled,
    blend: snapshot.blend,
    depthTestEnabled: snapshot.depthTestEnabled,
    depthWrite: snapshot.depthWrite,
  });
}

async function materializeResources(captureEntries, pid) {
  const firstSky = captureEntries[0].off.snapshots.find(({ classification }) =>
    classification.skyMap);
  const firstStars = captureEntries[0].off.snapshots.find(({ classification }) =>
    classification.catalogueStars);
  const requested = [
    textureResource("sky-map", firstSky.samplers.skymapTexture),
    textureResource("star-radial-response", firstStars.samplers.t_tex0),
  ];
  const starAttribute = Object.values(firstStars.attributes ?? {})
    .find(({ buffer }) => buffer > 0);
  if (starAttribute !== undefined) {
    requested.push(Object.freeze({
      role: "star-catalogue-buffer",
      kind: "buffer",
      id: starAttribute.buffer,
      bytes: starAttribute.bufferBytes,
      dumpPath: starAttribute.dumpPath,
    }));
  }
  const sunCandidates = new Map();
  for (const capture of captureEntries) {
    const offTextures = textureSet(capture.off.snapshots);
    for (const texture of textureRecords(capture.on.snapshots)) {
      const key = `${texture.texture}:${texture.width}x${texture.height}`;
      if (!offTextures.has(key) && !sunCandidates.has(key)) {
        sunCandidates.set(key, Object.freeze({
          ...textureResource(`sun-candidate-${sunCandidates.size + 1}`, texture),
          observedAtPose: capture.pose.id,
        }));
      }
    }
  }
  requested.push(...sunCandidates.values());
  const priorNames = await safeDirectoryNames(priorResourceRoot);
  const runNames = await safeDirectoryNames(rawResourceRoot);
  const manifest = [];
  for (const resource of requested) {
    let sourcePath = resource.dumpPath;
    if (sourcePath === undefined || sourcePath === "") {
      const names = [...runNames, ...priorNames];
      if (resource.kind === "texture") {
        const suffix = `-${resource.id}-${resource.width}x${resource.height}.rgba`;
        const name = names.find((entry) => entry.endsWith(suffix));
        if (name !== undefined) {
          sourcePath = resolve(
            runNames.includes(name) ? rawResourceRoot : priorResourceRoot,
            name,
          );
        }
      } else {
        const suffix = `-${resource.id}-${resource.bytes}.bin`;
        const name = names.find((entry) => entry.endsWith(suffix));
        if (name !== undefined) {
          sourcePath = resolve(
            runNames.includes(name) ? rawResourceRoot : priorResourceRoot,
            name,
          );
        }
      }
    }
    if (sourcePath === undefined) {
      manifest.push(Object.freeze({ ...resource, qualification: "UNRESOLVED_BYTES" }));
      continue;
    }
    const extension = resource.kind === "texture" ? "rgba" : "bin";
    const rawPath = resolve(rawResourceRoot, `${resource.role}.${extension}`);
    if (resolve(sourcePath) !== rawPath) await copyFile(sourcePath, rawPath);
    let previewPath = null;
    if (resource.kind === "texture") {
      previewPath = resolve(resourcePreviewRoot, `${resource.role}.png`);
      await sharp(await readFile(rawPath), {
        raw: {
          width: resource.width,
          height: resource.height,
          channels: 4,
        },
      }).flip().png().toFile(previewPath);
    }
    manifest.push(Object.freeze({
      ...resource,
      sourcePath,
      rawPath,
      previewPath,
      sha256: await fileSha256(rawPath),
      qualification: "EXACT_LIVE_BOUND_GL_BYTES",
      processId: pid,
    }));
  }
  return Object.freeze(manifest);
}

function textureResource(role, texture) {
  return Object.freeze({
    role,
    kind: "texture",
    id: texture.texture,
    width: texture.width,
    height: texture.height,
    internalFormat: texture.internalFormat,
    minFilter: texture.minFilter,
    magFilter: texture.magFilter,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
    dumpPath: texture.dumpPath,
  });
}

function textureRecords(snapshots) {
  return snapshots.flatMap(({ samplers = {} }) => Object.values(samplers))
    .filter(({ texture, width, height }) => texture > 0 && width > 0 && height > 0);
}

function textureSet(snapshots) {
  return new Set(textureRecords(snapshots).map(({ texture, width, height }) =>
    `${texture}:${width}x${height}`));
}

async function compareAndRenderDifference(leftPath, rightPath, outputPath) {
  const [left, right] = await Promise.all([
    sharp(leftPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(rightPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const output = Buffer.alloc(left.data.length);
  const strongMask = new Uint8Array(left.info.width * left.info.height);
  let changedPixels = 0;
  let minX = left.info.width;
  let minY = left.info.height;
  let maxX = -1;
  let maxY = -1;
  let absoluteTotal = 0;
  for (let offset = 0, pixel = 0; offset < output.length; offset += 4, pixel += 1) {
    let maximum = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(left.data[offset + channel] - right.data[offset + channel]);
      maximum = Math.max(maximum, delta);
      absoluteTotal += delta;
      output[offset + channel] = Math.min(255, delta * 4);
    }
    output[offset + 3] = 255;
    if (maximum > 5) {
      changedPixels += 1;
      const x = pixel % left.info.width;
      const y = Math.floor(pixel / left.info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (maximum > 12) strongMask[pixel] = 1;
  }
  await sharp(output, { raw: left.info }).png().toFile(outputPath);
  const totalPixels = left.info.width * left.info.height;
  const largestChangedComponent = largestComponent(
    strongMask,
    left.info.width,
    left.info.height,
  );
  return Object.freeze({
    channelTolerance: 5,
    changedPixelsAboveTolerance: changedPixels,
    changedPixelRatioAboveTolerance: changedPixels / totalPixels,
    meanAbsoluteRgbDelta: absoluteTotal / (totalPixels * 3),
    changedBounds: changedPixels === 0 ? null : Object.freeze({
      minX, minY, maxX, maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    }),
    strongestComponentTolerance: 12,
    largestChangedComponent,
    differencePath: outputPath,
  });
}

async function createSunContactSheet(captureEntries, outputPath) {
  const selected = [...captureEntries].sort((left, right) =>
    right.sunDifference.largestChangedComponent.pixelCount -
    left.sunDifference.largestChangedComponent.pixelCount).slice(0, 4);
  const panels = selected.flatMap((entry) => [
    [entry.off.framePath, `${entry.pose.id} · SUN OFF`],
    [entry.on.framePath, `${entry.pose.id} · SUN ON`],
    [entry.sunDifference.differencePath, `${entry.pose.id} · |DIFF| ×4`],
  ]);
  const width = 720;
  const imageHeight = 365;
  const labelHeight = 48;
  const columns = 3;
  const rows = Math.ceil(panels.length / columns);
  const composites = [];
  for (let index = 0; index < panels.length; index += 1) {
    const [path, label] = panels[index];
    const left = index % columns * width;
    const top = Math.floor(index / columns) * (imageHeight + labelHeight);
    const image = await sharp(path).resize(width, imageHeight, { fit: "cover" })
      .png().toBuffer();
    composites.push({ input: image, left, top });
    composites.push({
      input: Buffer.from(`<svg width="${width}" height="${labelHeight}">
        <rect width="100%" height="100%" fill="#090909"/>
        <text x="16" y="31" fill="#f0f0f0" font-size="17" font-family="Arial">${escapeXml(label)}</text>
      </svg>`),
      left,
      top: top + imageHeight,
    });
  }
  await sharp({
    create: {
      width: width * columns,
      height: (imageHeight + labelHeight) * rows,
      channels: 4,
      background: "#000000",
    },
  }).composite(composites).png().toFile(outputPath);
}

async function readControlLog() {
  const source = await readFile(controlLogPath, "utf8");
  return source.trim().split("\n").filter(Boolean).map((line) =>
    Object.freeze(Object.fromEntries(line.split("\t").map((field) => {
      const [name, rawValue] = field.split("=");
      const value = ["revision", "pid"].includes(name)
        ? Number.parseInt(rawValue, 10)
        : ["atmosphere", "sun"].includes(name)
          ? rawValue === "1"
          : rawValue;
      return [name, value];
    }))));
}

function numericDelta(left, right) {
  return Object.freeze(Object.fromEntries(
    ["latitude", "longitude", "distance", "tilt", "azimuth"].map((key) =>
      [key, right[key] - left[key]]),
  ));
}

function vectorLength(vector) {
  return Math.hypot(...vector);
}

function largestComponent(mask, width, height) {
  const queue = new Int32Array(mask.length);
  let best = Object.freeze({ pixelCount: 0, bounds: null });
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    mask[start] = 2;
    let pixelCount = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      pixelCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const neighbor of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
        if (neighbor < 0 || neighbor >= mask.length || mask[neighbor] !== 1) {
          continue;
        }
        if ((neighbor === pixel - 1 || neighbor === pixel + 1) &&
            Math.floor(neighbor / width) !== y) {
          continue;
        }
        mask[neighbor] = 2;
        queue[tail++] = neighbor;
      }
    }
    if (pixelCount > best.pixelCount) {
      best = Object.freeze({
        pixelCount,
        bounds: Object.freeze({
          minX, minY, maxX, maxY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        }),
      });
    }
  }
  return best;
}

function auditWindows(pid) {
  return JSON.parse(execFileSync(windowAuditPath, [String(pid)], {
    encoding: "utf8",
  }));
}

function assertHeadless(audit, pid, stage) {
  if (audit.visibleWindowCount !== 0 || audit.frontmostApplication.pid === pid) {
    throw new Error(`Headless assertion failed ${stage}.`);
  }
}

function lldbSetEnvironment(name, value) {
  return `expr (int)setenv(${lldbString(name)}, ${lldbString(value)}, 1)`;
}

function lldbString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function numberArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number.parseInt(process.argv[index + 1], 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} requires a positive integer.`);
  }
  return value;
}

async function safeDirectoryNames(path) {
  try {
    return await readdir(path);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
