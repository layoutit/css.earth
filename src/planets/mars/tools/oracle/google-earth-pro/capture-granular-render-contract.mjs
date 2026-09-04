import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";

import sharp from "sharp";

import { getViewInfo, saveScreenShot, setViewInfo } from "./controller.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const evidenceRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1",
);
const runRoot = resolve(process.argv[2] ?? resolve(
  evidenceRoot,
  `run-granular-${new Date().toISOString().replaceAll(/[:.]/gu, "-")}`,
));
if (!runRoot.startsWith(`${evidenceRoot}/run-`)) {
  throw new Error(`Output must be beneath ${evidenceRoot}.`);
}

const appName = "id:dev.polycss.GoogleEarthProMarsOracle";
const executablePath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/Google Earth Pro Mars Oracle.app/Contents/MacOS/Google Earth",
);
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/window-audit",
);
const hookPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/contracts/libcssmars_googleearth_contract_hook_v10.dylib",
);
const hookManifestPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/contracts/manifest-v10.json",
);
const controlRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-live-layer-matrix-v1",
);
const controlPath = resolve(controlRoot, "mode.bin");
const snapshotPath = resolve(runRoot, "renderer-components-v10.jsonl");
const uniformPath = resolve(runRoot, "active-component-uniforms-v10.tsv");
const installPath = resolve(runRoot, "hook-install-v10.tsv");
const sampleLogPath = resolve(runRoot, "samples.jsonl");
const rawRoot = resolve(runRoot, "resources-raw");
const shaderRoot = resolve(runRoot, "program-shaders");
const nativeRoot = resolve(runRoot, "native");
const sequenceRoot = resolve(runRoot, "sequences");
const oldHookDiscardRoot = resolve(runRoot, "old-hook-discard");

await Promise.all([
  mkdir(rawRoot, { recursive: true }),
  mkdir(shaderRoot, { recursive: true }),
  mkdir(nativeRoot, { recursive: true }),
  mkdir(sequenceRoot, { recursive: true }),
  mkdir(oldHookDiscardRoot, { recursive: true }),
]);

const processState = findOracleProcess();
assertHeadless(processState.pid, "before attach");
attachHook(processState.pid);

const paths = buildPathPlan();
const samples = await readCompletedSamples();
const familyIndices = new Map();
for (const sample of samples) {
  familyIndices.set(sample.requested.family, Math.max(
    familyIndices.get(sample.requested.family) ?? 0,
    sample.familyIndex,
  ));
}
for (let index = samples.length; index < paths.length; index += 1) {
  const requested = paths[index];
  const startedAt = new Date().toISOString();
  await setViewInfo({
    latitude: requested.latitude,
    longitude: requested.longitude,
    distance: requested.distance,
    tilt: requested.tilt,
    azimuth: requested.heading,
    speed: 10,
    appName,
  });
  const observed = await getViewInfo({ appName });
  const control = await setLayerControl();
  const nativeCapture = await saveScreenShot({
    path: resolve(
      nativeRoot,
      `${String(index + 1).padStart(4, "0")}-${requested.id}`,
    ),
    appName,
  });
  const familyIndex = (familyIndices.get(requested.family) ?? 0) + 1;
  familyIndices.set(requested.family, familyIndex);
  const familyFrameRoot = resolve(sequenceRoot, requested.family, "frames");
  await mkdir(familyFrameRoot, { recursive: true });
  const framePath = resolve(
    familyFrameRoot,
    `frame_${String(familyIndex).padStart(4, "0")}.png`,
  );
  await sharp(nativeCapture.path).rotate().png().toFile(framePath);
  const snapshots = await waitForSnapshots(control.revision);
  const skyMap = snapshots.find(({ classification }) => classification.skyMap);
  const catalogue = snapshots.find(({ classification }) =>
    classification.catalogueStars);
  const sun = snapshots.find(isSunDraw);
  if (skyMap === undefined || catalogue === undefined) {
    throw new Error(`Incomplete renderer sample at ${requested.id}.`);
  }
  const sample = Object.freeze({
    index: index + 1,
    familyIndex,
    startedAt,
    completedAt: new Date().toISOString(),
    requested,
    observed,
    normalizationDelta: numericDelta(requested, observed),
    control,
    nativeCapture,
    framePath,
    frameSha256: await fileSha256(framePath),
    skyMap,
    catalogue,
    sun: sun ?? null,
    sunPresentation: sun === undefined
      ? Object.freeze({ visibility: "draw-culled" })
      : await deriveSunPresentation(sun),
  });
  samples.push(sample);
  await appendFile(sampleLogPath, `${JSON.stringify(sample)}\n`);
  process.stdout.write(
    `[${index + 1}/${paths.length}] ${requested.family} ` +
      `${requested.id} sun=${sample.sunPresentation.visibility}\n`,
  );
}

assertHeadless(processState.pid, "after capture");
const shaderManifest = await collectShaderManifest();
const contract = await deriveGranularContract(samples, shaderManifest);
const contractPath = resolve(runRoot, "granular-render-contract.json");
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: true,
  qualification: contract.qualification,
  contractPath,
  sampleLogPath,
  sampleCount: samples.length,
  families: contract.capture.families,
  headlessVisibleWindowCount: 0,
  shaderCount: shaderManifest.length,
}, null, 2)}\n`);

function buildPathPlan() {
  const plans = [];
  const add = (family, values) => {
    for (const [familyIndex, camera] of values.entries()) {
      plans.push(Object.freeze({
        id: `${family}-${String(familyIndex + 1).padStart(3, "0")}`,
        family,
        ...camera,
      }));
    }
  };
  add("longitude-orbit-5deg", sequence(72, (index) => ({
    latitude: 0,
    longitude: -180 + index * 5,
    heading: 0,
    tilt: 0,
    distance: 7_800_000,
  })));
  add("latitude-meridian-5deg", sequence(33, (index) => ({
    latitude: -80 + index * 5,
    longitude: 67.5,
    heading: 0,
    tilt: 0,
    distance: 7_800_000,
  })));
  add("heading-orbit-15deg", sequence(24, (index) => ({
    latitude: 25,
    longitude: 67.5,
    heading: index * 15,
    tilt: 35,
    distance: 7_800_000,
  })));
  add("tilt-sweep-5deg", sequence(17, (index) => ({
    latitude: 25,
    longitude: 67.5,
    heading: 30,
    tilt: index * 5,
    distance: 7_800_000,
  })));
  add("log-zoom", sequence(18, (index) => ({
    latitude: 0,
    longitude: 67.5,
    heading: 0,
    tilt: 0,
    distance: Math.round(3_800_000 * ((20_000_000 / 3_800_000) **
      (index / 17))),
  })));
  add("coupled-diagonal", sequence(37, (index) => {
    const progress = index / 36;
    return {
      latitude: -60 + progress * 120,
      longitude: -150 + progress * 300,
      heading: progress * 360,
      tilt: 15 + Math.sin(progress * Math.PI) * 35,
      distance: 7_800_000,
    };
  }));
  return Object.freeze(plans);
}

function sequence(length, create) {
  return Array.from({ length }, (_, index) => Object.freeze(create(index)));
}

function attachHook(pid) {
  execFileSync("/usr/bin/lldb", [
    "-b", "-p", String(pid),
    "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG", "/dev/null"),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG", "/dev/null"),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT", oldHookDiscardRoot),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_INSTALL_LOG", "/dev/null"),
    "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG_V9", "/dev/null"),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG_V9", "/dev/null"),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT_V9", oldHookDiscardRoot),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_SHADER_ROOT_V9", oldHookDiscardRoot),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V9", "/dev/null"),
    "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG_V10", snapshotPath),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG_V10", uniformPath),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT_V10", rawRoot),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_SHADER_ROOT_V10", shaderRoot),
    "-o", lldbSetEnvironment(
      "CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V10", installPath),
    "-o", lldbSetEnvironment("CSSMARS_ORACLE_COMPONENT_ISOLATION", "1"),
    "-o", `expr (void*)dlopen(${lldbString(hookPath)}, 2)`,
    "-o", "detach",
    "-o", "quit",
  ], { stdio: "inherit", maxBuffer: 4 * 1024 * 1024 });
}

async function setLayerControl() {
  const previous = await readFile(controlPath);
  if (previous.length !== 32) {
    throw new Error(`Layer control must be 32 bytes; got ${previous.length}.`);
  }
  const revision = (previous.readUInt32LE(20) + 1) >>> 0 || 1;
  const bytes = Buffer.alloc(32);
  bytes.write("hide-ground", 0, 15, "utf8");
  bytes[16] = 48;
  bytes[17] = 49;
  bytes.writeUInt32LE(revision, 20);
  const descriptor = await open(controlPath, "r+");
  try {
    await descriptor.write(bytes, 0, bytes.length, 0);
    await descriptor.sync();
  } finally {
    await descriptor.close();
  }
  return Object.freeze({
    revision,
    mode: "hide-ground",
    atmosphere: false,
    sun: true,
  });
}

async function waitForSnapshots(revision) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const source = await readFile(snapshotPath, "utf8");
      const snapshots = source.trim().split("\n").filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((entry) => entry.revision === revision);
      if (snapshots.some(({ classification }) => classification.skyMap) &&
          snapshots.some(({ classification }) =>
            classification.catalogueStars)) {
        return snapshots;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await new Promise((accept) => setTimeout(accept, 50));
  }
  throw new Error(`No complete renderer snapshot for revision ${revision}.`);
}

function isSunDraw(entry) {
  return entry.program === 6 && entry.primitive === 5 && entry.count === 4 &&
    entry.samplers?.t_tex0?.width === 128 &&
    entry.samplers?.t_tex0?.height === 128 &&
    entry.blendEnabled && entry.blend?.[0] === 770 && entry.blend?.[1] === 1;
}

async function deriveSunPresentation(draw) {
  const vertex = draw.attributes?.ig_Vertex;
  const vertices = vertex?.clientDumpPath
    ? decodeFloatRecords(
      await readFile(vertex.clientDumpPath),
      vertex.components,
      vertex.stride || vertex.components * 4,
    )
    : [];
  const matrix = draw.uniforms.ig_ModelViewProjectionMatrix;
  const projected = vertices.map((position) => project(matrix, position));
  const front = projected.every((entry) => entry[3] > 0);
  const bounds = projected.length === 0 ? null : Object.freeze({
    minimumX: Math.min(...projected.map(([x]) => x)),
    maximumX: Math.max(...projected.map(([x]) => x)),
    minimumY: Math.min(...projected.map(([, y]) => y)),
    maximumY: Math.max(...projected.map(([, y]) => y)),
  });
  const intersects = front && bounds !== null && bounds.maximumX >= -1 &&
    bounds.minimumX <= 1 && bounds.maximumY >= -1 && bounds.minimumY <= 1;
  const fullyVisible = intersects && bounds.minimumX >= -1 &&
    bounds.maximumX <= 1 && bounds.minimumY >= -1 && bounds.maximumY <= 1;
  const modelView = draw.uniforms.ig_ModelViewMatrix;
  const cameraDistance = Math.hypot(modelView[12], modelView[13], modelView[14]);
  const localHalfExtent = vertices.length === 0 ? null : Math.abs(vertices[0][0]);
  return Object.freeze({
    visibility: fullyVisible ? "fully-visible" : intersects
      ? "partially-visible" : front ? "outside-viewport" : "behind-camera",
    centerNdc: Object.freeze(project(matrix, [0, 0, 0]).slice(0, 3)),
    boundsNdc: bounds,
    projectedVerticesNdc: Object.freeze(projected),
    localVertices: Object.freeze(vertices),
    cameraDistance,
    localHalfExtent,
    halfExtentPerCameraDistance: localHalfExtent / cameraDistance,
  });
}

async function deriveGranularContract(samples, shaderManifest) {
  const skySamples = samples.map(({ skyMap }) => skyMap.uniforms);
  const horizontalFovs = skySamples.map((uniforms) => 2 * Math.atan2(
    vectorLength(uniforms.view_right.slice(0, 3)),
    vectorLength(uniforms.view_dir.slice(0, 3)),
  ) * 180 / Math.PI);
  const verticalFovs = skySamples.map((uniforms) => 2 * Math.atan2(
    vectorLength(uniforms.view_up.slice(0, 3)),
    vectorLength(uniforms.view_dir.slice(0, 3)),
  ) * 180 / Math.PI);
  const orthogonality = skySamples.flatMap((uniforms) => {
    const direction = normalize(uniforms.view_dir.slice(0, 3));
    const right = normalize(uniforms.view_right.slice(0, 3));
    const up = normalize(uniforms.view_up.slice(0, 3));
    return [Math.abs(dot(direction, right)), Math.abs(dot(direction, up)),
      Math.abs(dot(right, up))];
  });
  const billboardRatios = samples.flatMap(({ sunPresentation }) =>
    Number.isFinite(sunPresentation.halfExtentPerCameraDistance)
      ? [sunPresentation.halfExtentPerCameraDistance] : []);
  const pointSizes = samples.map(({ catalogue }) =>
    catalogue.uniforms.point_size[0]);
  const first = samples[0];
  const firstSun = samples.find(({ sun }) => sun !== null)?.sun;
  if (firstSun === undefined) throw new Error("Sun was never drawn.");
  const familyCounts = Object.freeze(Object.fromEntries(
    [...new Set(samples.map(({ requested }) => requested.family))].map(
      (family) => [family, samples.filter(({ requested }) =>
        requested.family === family).length],
    ),
  ));
  return Object.freeze({
    schema: "cssmars-google-earth-pro-granular-render-contract@2",
    qualification:
      "NATIVE_HEADLESS_PARAMETRIC_CAMERA_SKYMAP_CATALOGUE_AND_SUN_TRAJECTORIES_EXTRACTED",
    generatedAt: new Date().toISOString(),
    source: Object.freeze({
      application: "Google Earth Pro Mars",
      version: "7.3.7.1327",
      architecture: "x86_64",
      executablePath,
      executableSha256: await fileSha256(executablePath),
      hookPath,
      hookSha256: await fileSha256(hookPath),
      hookManifestPath,
    }),
    capture: Object.freeze({
      headlessVisibleWindowCount: 0,
      sampleCount: samples.length,
      families: familyCounts,
      inputQualification:
        "Deterministic SetViewInfo trajectories; not native pointer-drag timing evidence.",
      viewport: Object.freeze(first.skyMap.viewport),
      sampleLogPath,
    }),
    camera: Object.freeze({
      publicState: Object.freeze([
        "latitude", "longitude", "distance", "tilt", "azimuth",
      ]),
      internalStateFromStaticAnalysis: Object.freeze([
        "latitude", "longitude", "altitude", "distance", "verticalFov",
        "heading", "tilt", "roll",
      ]),
      rayBasis: Object.freeze({
        equation:
          "dir = view_dir.xyz + view_up.xyz * ndcY + view_right.xyz * ndcX",
        normalization: "normalize after starsToCameraMatrix multiplication",
        horizontalFovDegrees: numericRange(horizontalFovs),
        verticalFovDegrees: numericRange(verticalFovs),
        maximumBasisDotError: Math.max(...orthogonality),
      }),
      trajectories: Object.freeze(samples.map((sample) => Object.freeze({
        index: sample.index,
        familyIndex: sample.familyIndex,
        requested: sample.requested,
        observed: sample.observed,
        normalizationDelta: sample.normalizationDelta,
        viewDirection: sample.skyMap.uniforms.view_dir,
        viewRight: sample.skyMap.uniforms.view_right,
        viewUp: sample.skyMap.uniforms.view_up,
        starsToCameraMatrix: sample.skyMap.uniforms.starsToCameraMatrix,
        catalogueModelViewProjectionMatrix:
          sample.catalogue.uniforms.ig_ModelViewProjectionMatrix,
      }))),
    }),
    skybox: Object.freeze({
      composition: Object.freeze([
        "full-screen plate-carree sky-map pass",
        "separate 5000-point star catalogue pass",
      ]),
      skyMap: Object.freeze({
        shaderEquation:
          "fragment NDC -> view ray -> starsToCameraMatrix -> galactic-to-equatorial plate-carree UV -> texture RGB * 0.35",
        sampler: first.skyMap.samplers.skymapTexture,
        viewportCrop: first.skyMap.uniforms.viewport_crop,
        shaderFiles: shaderManifest.filter(({ program }) =>
          program === first.skyMap.program),
      }),
      catalogue: Object.freeze({
        drawCount: first.catalogue.count,
        pointSizeRange: numericRange(pointSizes),
        vertexRecord:
          "32 bytes: position float3; RGB plus magnitude float4; 4 trailing bytes unused",
        fragmentEquation:
          "radial lookup intensity; color = RGB * magnitude * intensity; toneMap = 1 - exp(-40 * color)",
        sampler: first.catalogue.samplers.t_tex0,
        attributes: first.catalogue.attributes,
        shaderFiles: shaderManifest.filter(({ program }) =>
          program === first.catalogue.program),
      }),
      epochBinding: Object.freeze({
        matrix: "starsToCameraMatrix",
        status: "OBSERVED_LIVE_BUT_NOT_REPEATABLY_PINNED",
        note:
          "The exact native matrix is recorded at every sample; an epoch-control API remains unresolved.",
      }),
    }),
    sun: Object.freeze({
      draw: Object.freeze({
        program: firstSun.program,
        primitive: "GL_TRIANGLE_STRIP",
        vertexCount: firstSun.count,
        blend: Object.freeze({ source: "SRC_ALPHA", destination: "ONE" }),
        depthTest: firstSun.depthTestEnabled,
        depthWrite: firstSun.depthWrite,
        sampler: firstSun.samplers.t_tex0,
        shaderFiles: shaderManifest.filter(({ program }) =>
          program === firstSun.program),
      }),
      billboard: Object.freeze({
        localShape: "camera-facing square in local XY at Z=0",
        halfExtentPerCameraDistance: numericRange(billboardRatios),
        scaleLaw:
          "localHalfExtent = cameraToSunDistance * halfExtentPerCameraDistance",
        effect:
          "screen-space angular size remains nearly invariant across camera zoom",
      }),
      trajectories: Object.freeze(samples.map((sample) => Object.freeze({
        index: sample.index,
        familyIndex: sample.familyIndex,
        requested: sample.requested,
        drawCulled: sample.sun === null,
        modelViewMatrix: sample.sun?.uniforms.ig_ModelViewMatrix ?? null,
        modelViewProjectionMatrix:
          sample.sun?.uniforms.ig_ModelViewProjectionMatrix ?? null,
        directionalLight: sample.sun
          ?.uniforms["ig_LightDirectionalDirection[0]"] ?? null,
        presentation: sample.sunPresentation,
      }))),
    }),
    exactProgramShaders: shaderManifest,
    rawSamples: sampleLogPath,
  });
}

async function collectShaderManifest() {
  const entries = await readdir(shaderRoot, { withFileTypes: true });
  return Object.freeze(await Promise.all(entries.filter((entry) => entry.isFile())
    .map(async (entry) => {
      const path = resolve(shaderRoot, entry.name);
      const match = entry.name.match(/program-[^-]+-[^-]+-(\d+)-shader-(\d+)-([^.]+)\.glsl$/u);
      return Object.freeze({
        path,
        file: basename(path),
        program: match === null ? null : Number(match[1]),
        shader: match === null ? null : Number(match[2]),
        stage: match?.[3] ?? "unknown",
        bytes: (await readFile(path)).length,
        sha256: await fileSha256(path),
        qualification: "EXACT_GL_LINKED_SHADER_SOURCE",
      });
    })));
}

async function readCompletedSamples() {
  try {
    const source = await readFile(sampleLogPath, "utf8");
    return source.trim().split("\n").filter(Boolean).map((line) =>
      Object.freeze(JSON.parse(line)));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function decodeFloatRecords(bytes, components, strideBytes) {
  const records = [];
  for (let offset = 0; offset + components * 4 <= bytes.length;
    offset += strideBytes) {
    records.push(Object.freeze(Array.from({ length: components }, (_, index) =>
      bytes.readFloatLE(offset + index * 4))));
  }
  return records;
}

function project(matrix, position) {
  const input = [...position, 1];
  const clip = Array.from({ length: 4 }, (_, row) =>
    matrix[row] * input[0] + matrix[4 + row] * input[1] +
    matrix[8 + row] * input[2] + matrix[12 + row]);
  return Object.freeze([
    clip[0] / clip[3],
    clip[1] / clip[3],
    clip[2] / clip[3],
    clip[3],
  ]);
}

function numericDelta(requested, observed) {
  return Object.freeze({
    latitude: observed.latitude - requested.latitude,
    longitude: angularDelta(observed.longitude, requested.longitude),
    distance: observed.distance - requested.distance,
    tilt: observed.tilt - requested.tilt,
    heading: angularDelta(observed.azimuth, requested.heading),
  });
}

function angularDelta(actual, expected) {
  return ((actual - expected + 180) % 360 + 360) % 360 - 180;
}

function vectorLength(value) {
  return Math.hypot(...value);
}

function normalize(value) {
  const length = vectorLength(value);
  return value.map((entry) => entry / length);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function numericRange(values) {
  return Object.freeze({
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  });
}

function findOracleProcess() {
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,state=,command="], {
    encoding: "utf8",
  }).split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/u);
    return match === null || match[3] !== executablePath || match[2].includes("E")
      ? []
      : [{ pid: Number(match[1]), state: match[2] }];
  });
  if (rows.length !== 1) {
    throw new Error(`Expected one healthy headless oracle; found ${rows.length}.`);
  }
  return Object.freeze(rows[0]);
}

function assertHeadless(pid, stage) {
  const audit = JSON.parse(execFileSync(windowAuditPath, [String(pid)], {
    encoding: "utf8",
  }));
  if (audit.visibleWindowCount !== 0 || audit.frontmostApplication.pid === pid) {
    throw new Error(`Google Earth oracle is not headless at ${stage}.`);
  }
}

function lldbSetEnvironment(name, value) {
  return `expr (int)setenv(${lldbString(name)}, ${lldbString(value)}, 1)`;
}

function lldbString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
