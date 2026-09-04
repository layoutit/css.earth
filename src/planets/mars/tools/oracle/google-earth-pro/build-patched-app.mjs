import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH } from "./api-contract.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const sourceApp = resolve(
  process.env.CSSMARS_GOOGLE_EARTH_SOURCE_APP ??
    resolve(
      workspaceRoot,
      ".local/oracles/google-earth-pro/pkg-expanded-7.3.7.1327/Google_Earth_Pro.pkg/Payload/Google Earth Pro.app",
    ),
);
const targetApp = resolve(
  process.env.CSSMARS_GOOGLE_EARTH_PATCHED_APP ??
    resolve(
      workspaceRoot,
      ".local/oracles/google-earth-pro/patched/Google Earth Pro Mars Oracle.app",
    ),
);
const appDisplayName = process.env.CSSMARS_GOOGLE_EARTH_DISPLAY_NAME ??
  "Google Earth Pro Mars Oracle";
const bundleIdentifier = process.env.CSSMARS_GOOGLE_EARTH_BUNDLE_IDENTIFIER ??
  "dev.polycss.GoogleEarthProMarsOracle";
const force = process.argv.includes("--force");

await access(resolve(sourceApp, GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.target));
if (force) {
  assertSafeTarget(targetApp);
  await rm(targetApp, { recursive: true, force: true });
} else {
  try {
    await access(targetApp);
    throw new Error(
      `Patched app already exists at ${targetApp}; pass --force to rebuild that exact target.`,
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await mkdir(dirname(targetApp), { recursive: true });
await cp(sourceApp, targetApp, {
  recursive: true,
  preserveTimestamps: true,
  verbatimSymlinks: true,
});

const rendererPath = resolve(
  targetApp,
  GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.target,
);
const sourceRenderer = await readFile(rendererPath);
const sourceRendererSha256 = sha256(sourceRenderer);
if (sourceRendererSha256 !==
    GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.sourceRendererSha256) {
  throw new Error(
    `Renderer hash mismatch: expected ${GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.sourceRendererSha256}, got ${sourceRendererSha256}.`,
  );
}

for (const patch of GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.patches) {
  const expected = Buffer.from(patch.expectedHex, "hex");
  const replacement = Buffer.from(patch.replacementHex, "hex");
  const actual = sourceRenderer.subarray(
    patch.fileOffset,
    patch.fileOffset + expected.length,
  );
  if (!actual.equals(expected)) {
    throw new Error(
      `${patch.id} expected ${patch.expectedHex} at 0x${patch.fileOffset.toString(16)}, got ${actual.toString("hex")}.`,
    );
  }
  if (expected.length !== replacement.length) {
    throw new Error(`${patch.id} must be an in-place patch.`);
  }
  replacement.copy(sourceRenderer, patch.fileOffset);
}
await writeFile(rendererPath, sourceRenderer);

const infoPlist = resolve(targetApp, "Contents/Info.plist");
replacePlistValue(infoPlist, "CFBundleName", appDisplayName);
replacePlistValue(
  infoPlist,
  "CFBundleDisplayName",
  appDisplayName,
);
replacePlistValue(
  infoPlist,
  "CFBundleIdentifier",
  bundleIdentifier,
);
replacePlistValue(
  infoPlist,
  "GoogleUpdateIdentifier",
  `${bundleIdentifier}.disabled`,
);
replacePlistValue(
  infoPlist,
  "CSSMarsOraclePatchSchema",
  GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.schema,
);
replacePlistBoolean(infoPlist, "LSUIElement", true);

execFileSync("/usr/bin/xattr", ["-cr", targetApp], { stdio: "inherit" });
execFileSync("/usr/bin/codesign", [
  "--deep",
  "--force",
  "--sign",
  "-",
  targetApp,
], { stdio: "inherit" });
execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", targetApp], {
  stdio: "inherit",
});

const patchedRenderer = await readFile(rendererPath);
const manifest = Object.freeze({
  schema: GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.schema,
  qualification: "LOCAL_PATCHED_GOOGLE_RENDERER_NOT_FOR_REDISTRIBUTION",
  sourceApp,
  targetApp,
  sourceRendererSha256,
  patchedRendererSha256: sha256(patchedRenderer),
  patches: GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.patches,
  signature: "ad-hoc local signature",
});
const manifestPath = resolve(dirname(targetApp), "patch-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2)}\n`);

function replacePlistValue(plistPath, key, value) {
  execFileSync("/usr/bin/plutil", [
    "-replace",
    key,
    "-string",
    value,
    plistPath,
  ]);
}

function replacePlistBoolean(plistPath, key, value) {
  execFileSync("/usr/bin/plutil", [
    "-replace",
    key,
    "-bool",
    value ? "YES" : "NO",
    plistPath,
  ]);
}

function assertSafeTarget(path) {
  const allowedTargets = new Set([
    resolve(
      workspaceRoot,
      ".local/oracles/google-earth-pro/patched/" +
        "Google Earth Pro Mars Oracle.app",
    ),
    resolve(
      workspaceRoot,
      ".local/oracles/google-earth-pro/native-input/" +
        "Google Earth Pro Mars Native Input Oracle.app",
    ),
  ]);
  if (!allowedTargets.has(path)) {
    throw new Error(`Refusing to remove unexpected patched-app target: ${path}`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
