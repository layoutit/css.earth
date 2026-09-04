import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import sharp from "sharp";

import { saveScreenShot, setViewInfo } from "./controller.mjs";
import { GOOGLE_EARTH_PRO_MARS_POSES } from "./profile.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const outputRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1/" +
    "run-authoritative-contract-2026-09-02",
);
const nativeRoot = resolve(outputRoot, "native-isolated-components");
const contactSheetPath = resolve(
  outputRoot,
  "native-sun-visible-four-angle-clean.png",
);
const executablePath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/" +
    "Google Earth Pro Mars Oracle.app/Contents/MacOS/Google Earth",
);
const hookPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/contracts/" +
    "libcssmars_googleearth_contract_hook_v8.dylib",
);
const appName = "id:dev.polycss.GoogleEarthProMarsOracle";
await mkdir(nativeRoot, { recursive: true });
const pid = findOracleProcess();
execFileSync("/usr/bin/lldb", [
  "-b", "-p", String(pid),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_COMPONENT_ISOLATION", "1"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_LOG_V7", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_UNIFORM_LOG_V7", "/dev/null"),
  "-o", lldbSetEnvironment("CSSMARS_ORACLE_CONTRACT_INSTALL_LOG_V7", "/dev/null"),
  "-o", `expr (void*)dlopen(${lldbString(hookPath)}, 2)`,
  "-o", "detach",
  "-o", "quit",
], { stdio: "inherit", maxBuffer: 4 * 1024 * 1024 });

const panels = [];
for (const index of [17, 18, 49, 53]) {
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
  const capture = await saveScreenShot({
    path: resolve(nativeRoot, `${String(index + 1).padStart(4, "0")}-${pose.id}`),
    appName,
  });
  panels.push(await sharp(capture.path).rotate().extract({
    left: 0,
    top: 80,
    width: 2092,
    height: 1070,
  }).resize(1046, 535).png().toBuffer());
}
await sharp({
  create: {
    width: 2092,
    height: 1070,
    channels: 4,
    background: "#000000",
  },
}).composite(panels.map((input, index) => ({
  input,
  left: index % 2 * 1046,
  top: Math.floor(index / 2) * 535,
}))).png().toFile(contactSheetPath);
process.stdout.write(`${JSON.stringify({
  ok: true,
  qualification: "NATIVE_HEADLESS_SKY_MAP_CATALOGUE_STARS_AND_DEFAULT_SUN_ONLY",
  contactSheetPath,
  poseCount: panels.length,
}, null, 2)}\n`);

function findOracleProcess() {
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,state=,command="], {
    encoding: "utf8",
  }).split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/u);
    return match !== null && match[3] === executablePath &&
      !match[2].includes("E") ? [Number(match[1])] : [];
  });
  if (rows.length !== 1) throw new Error(`Expected one oracle; found ${rows.length}.`);
  return rows[0];
}

function lldbSetEnvironment(name, value) {
  return `expr (int)setenv(${lldbString(name)}, ${lldbString(value)}, 1)`;
}

function lldbString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
