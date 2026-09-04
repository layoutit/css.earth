import { createHash } from "node:crypto";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { getViewInfo, saveScreenShot, setViewInfo } from "./controller.mjs";
import { GOOGLE_EARTH_PRO_MARS_POSES } from "./profile.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const liveRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1",
);
const runRoot = resolve(process.argv[2] ?? resolve(
  liveRoot,
  `run-sun-presentation-${new Date().toISOString().replaceAll(/[:.]/gu, "-")}`,
));
if (!runRoot.startsWith(`${liveRoot}/run-`)) {
  throw new Error(`Output must be beneath ${liveRoot}.`);
}
const rawRoot = resolve(runRoot, "resources-raw");
const nativeRoot = resolve(runRoot, "native");
const snapshotPath = resolve(runRoot, "renderer-snapshots.jsonl");
const uniformPath = resolve(runRoot, "active-uniforms.tsv");
const installPath = resolve(runRoot, "hook-install.tsv");
const hookPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/contracts/libcssmars_googleearth_contract_hook_v7.dylib",
);
const executablePath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/Google Earth Pro Mars Oracle.app/Contents/MacOS/Google Earth",
);
const controlRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-live-layer-matrix-v1",
);
const controlPath = resolve(controlRoot, "mode.bin");
const controlLogPath = resolve(controlRoot, "control.tsv");
const appName = "id:dev.polycss.GoogleEarthProMarsOracle";
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/window-audit",
);
const oldHookDiscardRoot = "/tmp/cssmars-google-earth-old-hook-discard";

await mkdir(rawRoot, { recursive: true });
await mkdir(nativeRoot, { recursive: true });
await mkdir(oldHookDiscardRoot, { recursive: true });
const processRow = findOracleProcess();
assertHeadless(processRow.pid);
execFileSync("/usr/bin/lldb", [
  "-b", "-p", String(processRow.pid),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT", oldHookDiscardRoot),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_INSTALL_LOG", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG_V7", snapshotPath),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG_V7", uniformPath),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_TEXTURE_ROOT_V7", rawRoot),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V7", installPath),
  "-o", `expr (void*)dlopen(${lldbString(hookPath)}, 2)`,
  "-o", "detach",
  "-o", "quit",
], { stdio: "inherit", maxBuffer: 4 * 1024 * 1024 });

const samples = [];
for (let index = 0; index < GOOGLE_EARTH_PRO_MARS_POSES.length; index += 1) {
  const pose = GOOGLE_EARTH_PRO_MARS_POSES[index];
  await setViewInfo({
    latitude: pose.nativeCamera.latitude,
    longitude: pose.nativeCamera.longitude,
    distance: pose.nativeCamera.rangeMeters,
    tilt: pose.nativeCamera.tilt,
    azimuth: pose.nativeCamera.heading,
    speed: 10,
    appName,
  });
  const observedCamera = await getViewInfo({ appName });
  const control = await setLayerControl();
  const capture = await saveScreenShot({
    path: resolve(nativeRoot, `${String(index + 1).padStart(4, "0")}-${pose.id}`),
    appName,
  });
  const snapshots = await waitForSnapshots(control.revision);
  const draw = snapshots.find((entry) =>
    entry.program === 6 && entry.primitive === 5 && entry.count === 4 &&
    entry.samplers?.t_tex0?.width === 128 &&
    entry.samplers?.t_tex0?.height === 128 &&
    entry.blendEnabled && entry.blend?.[0] === 770 && entry.blend?.[1] === 1);
  const presentation = draw === undefined
    ? Object.freeze({ drawn: false, inViewport: false })
    : await derivePresentation(draw);
  samples.push(Object.freeze({
    index: index + 1,
    pose,
    observedCamera,
    control,
    capture,
    presentation,
    rendererDraw: draw ?? null,
  }));
  process.stdout.write(
    `[${index + 1}/56] ${pose.id} ` +
      `drawn=${presentation.drawn} inViewport=${presentation.inViewport}\n`,
  );
}

assertHeadless(processRow.pid);
const firstDraw = samples.find(({ rendererDraw }) => rendererDraw !== null)
  ?.rendererDraw;
if (firstDraw === undefined) throw new Error("Default Sun billboard was never bound.");
const sunTexture = firstDraw.samplers.t_tex0;
const texturePath = await locateTextureDump(sunTexture);
const textureBytes = await readFile(texturePath);
const contract = Object.freeze({
  schema: "cssmars-google-earth-pro-sun-presentation-contract@1",
  qualification: "NATIVE_HEADLESS_DEFAULT_SUN_BILLBOARD_AND_CAMERA_SWEEP_EXTRACTED",
  generatedAt: new Date().toISOString(),
  process: Object.freeze({
    ...processRow,
    headlessVisibleWindowCount: 0,
    executablePath,
    executableSha256: await fileSha256(executablePath),
    hookPath,
    hookSha256: await fileSha256(hookPath),
  }),
  defaultPath: Object.freeze({
    improvedSunEnabled: false,
    resourceNameFromDecompilation: "sun",
    drawProgram: firstDraw.program,
    primitive: "GL_TRIANGLE_STRIP",
    vertexCount: firstDraw.count,
    blend: Object.freeze({
      enabled: firstDraw.blendEnabled,
      source: firstDraw.blend[0],
      destination: firstDraw.blend[1],
      equation: "source-alpha plus one additive destination",
    }),
    depth: Object.freeze({
      testEnabled: firstDraw.depthTestEnabled,
      writeEnabled: firstDraw.depthWrite,
    }),
    texture: Object.freeze({
      ...sunTexture,
      rawPath: texturePath,
      bytes: textureBytes.length,
      sha256: createHash("sha256").update(textureBytes).digest("hex"),
      qualification: "EXACT_LIVE_BOUND_GL_RGBA_BYTES",
    }),
  }),
  improvedPath: Object.freeze({
    resourceNameFromDecompilation: "sun3",
    enabledDuringSweep: false,
    qualification: "STATICALLY_REFERENCED_NOT_LIVE_BOUND_IN_DEFAULT_PATH",
  }),
  movement: Object.freeze({
    poseCount: samples.length,
    drawCount: samples.filter(({ presentation }) => presentation.drawn).length,
    inViewportCount: samples.filter(({ presentation }) =>
      presentation.inViewport).length,
    samples: Object.freeze(samples),
  }),
});
const contractPath = resolve(runRoot, "sun-presentation-contract.json");
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: true,
  contractPath,
  qualification: contract.qualification,
  texture: contract.defaultPath.texture,
  poseCount: contract.movement.poseCount,
  drawCount: contract.movement.drawCount,
  inViewportCount: contract.movement.inViewportCount,
}, null, 2)}\n`);

async function derivePresentation(draw) {
  const matrix = draw.uniforms.ig_ModelViewProjectionMatrix;
  const vertex = draw.attributes?.ig_Vertex;
  const vertices = vertex?.clientDumpPath
    ? decodeFloatRecords(
      await readFile(vertex.clientDumpPath),
      vertex.components,
      vertex.stride || vertex.components * 4,
    )
    : [];
  const projectedVertices = vertices.map((position) =>
    project(matrix, position));
  const finite = projectedVertices.filter((entry) =>
    entry.every(Number.isFinite));
  const center = project(matrix, [0, 0, 0]);
  const bounds = finite.length === 0 ? null : Object.freeze({
    minimumX: Math.min(...finite.map(([x]) => x)),
    maximumX: Math.max(...finite.map(([x]) => x)),
    minimumY: Math.min(...finite.map(([, y]) => y)),
    maximumY: Math.max(...finite.map(([, y]) => y)),
  });
  const inViewport = bounds !== null && bounds.maximumX >= -1 &&
    bounds.minimumX <= 1 && bounds.maximumY >= -1 && bounds.minimumY <= 1 &&
    finite.every((entry) => entry[3] > 0);
  return Object.freeze({
    drawn: true,
    inViewport,
    centerNdc: Object.freeze(center.slice(0, 3)),
    clipW: center[3],
    projectedBoundsNdc: bounds,
    projectedVerticesNdc: Object.freeze(projectedVertices),
    vertexClientBytes: vertex?.clientBytes ?? null,
    vertexClientDumpPath: vertex?.clientDumpPath ?? null,
    texcoordClientDumpPath:
      draw.attributes?.ig_MultiTexCoord0?.clientDumpPath ?? null,
  });
}

function decodeFloatRecords(bytes, components, strideBytes) {
  const records = [];
  for (let offset = 0; offset + components * 4 <= bytes.length;
    offset += strideBytes) {
    records.push(Array.from({ length: components }, (_, index) =>
      bytes.readFloatLE(offset + index * 4)));
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

async function setLayerControl() {
  const previous = await readFile(controlPath);
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
  return Object.freeze({ revision, mode: "hide-ground", atmosphere: false, sun: true });
}

async function waitForSnapshots(revision) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const source = await readFile(snapshotPath, "utf8");
      const snapshots = source.trim().split("\n").filter(Boolean)
        .map((line) => JSON.parse(line)).filter((entry) =>
          entry.revision === revision);
      if (snapshots.some(({ classification }) => classification.skyMap)) {
        return snapshots;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await new Promise((accept) => setTimeout(accept, 50));
  }
  throw new Error(`No renderer snapshot for revision ${revision}.`);
}

async function locateTextureDump(texture) {
  if (texture.dumpPath !== undefined) return texture.dumpPath;
  const names = execFileSync("/usr/bin/find", [
    liveRoot,
    "-name",
    `*-${texture.texture}-${texture.width}x${texture.height}.rgba`,
    "-print",
  ], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  if (names.length === 0) throw new Error("Exact Sun texture bytes not found.");
  return names.at(-1);
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
  if (rows.length !== 1) throw new Error(`Expected one oracle; found ${rows.length}.`);
  return Object.freeze(rows[0]);
}

function assertHeadless(pid) {
  const audit = JSON.parse(execFileSync(windowAuditPath, [String(pid)], {
    encoding: "utf8",
  }));
  if (audit.visibleWindowCount !== 0 || audit.frontmostApplication.pid === pid) {
    throw new Error("Google Earth oracle is not headless.");
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
