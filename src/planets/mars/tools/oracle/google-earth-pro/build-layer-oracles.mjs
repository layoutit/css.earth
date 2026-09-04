import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const sourceApp = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/" +
    "Google Earth Pro Mars Oracle.app",
);
const outputRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/layer-oracles",
);
const hookSourcePath = resolve(import.meta.dirname, "layer-render-hook.mm");
const hookPath = resolve(
  outputRoot,
  "libcssmars_googleearth_layer_hook_v3.dylib",
);
const fragmentShaderRelativePath =
  "Contents/Resources/shaders/atmosphere.glslesf";
const vertexShaderRelativePath =
  "Contents/Resources/shaders/atmosphere.glslesv";
const expectedSourceFragmentShaderSha256 =
  "bc256d14dc342c08bedad834c1bad2ea21e1b7cab9aa6aec3ab3eceec34b3be4";
const expectedSourceVertexShaderSha256 =
  "96b88589010a30cc8c19b41f8f0a29de7b8fcafe2fd592d7f3ccad27b9330874";

const variants = Object.freeze([
  Object.freeze({
    id: "textured",
    name: "Google Earth Pro Mars V7 Textured Layer Oracle",
    bundleIdentifier:
      "dev.polycss.GoogleEarthProMarsLayerOracleTexturedV7",
    patchFragmentShader(source) {
      return source;
    },
    patchVertexShader(source) {
      return source;
    },
  }),
  Object.freeze({
    id: "untextured",
    name: "Google Earth Pro Mars V7 Untextured Layer Oracle",
    bundleIdentifier:
      "dev.polycss.GoogleEarthProMarsLayerOracleUntexturedV7",
    patchFragmentShader(source) {
      return source;
    },
    patchVertexShader(source) {
      return source;
    },
  }),
  Object.freeze({
    id: "ground-hidden",
    name: "Google Earth Pro Mars V7 Background Layer Oracle",
    bundleIdentifier:
      "dev.polycss.GoogleEarthProMarsLayerOracleBackgroundV7",
    patchFragmentShader(source) {
      return source;
    },
    patchVertexShader(source) {
      return source;
    },
  }),
]);

await mkdir(outputRoot, { recursive: true });
execFileSync("/usr/bin/xcrun", [
  "clang++",
  "-arch",
  "x86_64",
  "-std=c++17",
  "-fobjc-arc",
  "-fblocks",
  "-dynamiclib",
  "-framework",
  "Cocoa",
  "-framework",
  "OpenGL",
  "-mmacosx-version-min=10.15",
  "-o",
  hookPath,
  hookSourcePath,
], { stdio: "inherit" });
execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", hookPath], {
  stdio: "inherit",
});
const hookSha256 = sha256(await readFile(hookPath));
const [sourceFragmentShaderBytes, sourceVertexShaderBytes] = await Promise.all([
  readFile(resolve(sourceApp, fragmentShaderRelativePath)),
  readFile(resolve(sourceApp, vertexShaderRelativePath)),
]);
const sourceFragmentShaderSha256 = sha256(sourceFragmentShaderBytes);
const sourceVertexShaderSha256 = sha256(sourceVertexShaderBytes);
if (sourceFragmentShaderSha256 !== expectedSourceFragmentShaderSha256) {
  throw new Error(
    "Google atmosphere fragment shader identity drifted: expected " +
      `${expectedSourceFragmentShaderSha256}, got ${sourceFragmentShaderSha256}.`,
  );
}
if (sourceVertexShaderSha256 !== expectedSourceVertexShaderSha256) {
  throw new Error(
    "Google atmosphere vertex shader identity drifted: expected " +
      `${expectedSourceVertexShaderSha256}, got ${sourceVertexShaderSha256}.`,
  );
}

const manifests = [];
for (const variant of variants) {
  const targetApp = resolve(outputRoot, `${variant.name}.app`);
  assertSafeTarget(targetApp);
  await rm(targetApp, { recursive: true, force: true });
  await cp(sourceApp, targetApp, {
    recursive: true,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });

  const fragmentShaderPath = resolve(targetApp, fragmentShaderRelativePath);
  const vertexShaderPath = resolve(targetApp, vertexShaderRelativePath);
  const patchedFragmentShader = variant.patchFragmentShader(
    sourceFragmentShaderBytes.toString("utf8"),
  );
  const patchedVertexShader = variant.patchVertexShader(
    sourceVertexShaderBytes.toString("utf8"),
  );
  await Promise.all([
    writeFile(fragmentShaderPath, patchedFragmentShader),
    writeFile(vertexShaderPath, patchedVertexShader),
  ]);
  const infoPlistPath = resolve(targetApp, "Contents/Info.plist");
  replacePlistString(infoPlistPath, "CFBundleName", variant.name);
  replacePlistString(infoPlistPath, "CFBundleDisplayName", variant.name);
  replacePlistString(
    infoPlistPath,
    "CFBundleIdentifier",
    variant.bundleIdentifier,
  );
  replacePlistString(
    infoPlistPath,
    "GoogleUpdateIdentifier",
    `${variant.bundleIdentifier}.disabled`,
  );
  replacePlistString(
    infoPlistPath,
    "CSSMarsOracleLayerMode",
    variant.id,
  );
  execFileSync("/usr/bin/xattr", ["-cr", targetApp], { stdio: "inherit" });
  execFileSync("/usr/bin/codesign", [
    "--deep",
    "--force",
    "--sign",
    "-",
    targetApp,
  ], { stdio: "inherit" });
  execFileSync("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    targetApp,
  ], { stdio: "inherit" });

  const [patchedFragmentShaderBytes, patchedVertexShaderBytes] =
    await Promise.all([
      readFile(fragmentShaderPath),
      readFile(vertexShaderPath),
    ]);
  manifests.push(Object.freeze({
    id: variant.id,
    qualification:
      "LOCAL_GOOGLE_RENDERER_LAYER_ORACLE_NOT_FOR_REDISTRIBUTION",
    targetApp,
    executablePath: resolve(targetApp, "Contents/MacOS/Google Earth"),
    bundleIdentifier: variant.bundleIdentifier,
    sourceApp,
    shaders: Object.freeze({
      fragment: Object.freeze({
        relativePath: fragmentShaderRelativePath,
        sourceSha256: sourceFragmentShaderSha256,
        patchedSha256: sha256(patchedFragmentShaderBytes),
        changed: !patchedFragmentShaderBytes.equals(sourceFragmentShaderBytes),
      }),
      vertex: Object.freeze({
        relativePath: vertexShaderRelativePath,
        sourceSha256: sourceVertexShaderSha256,
        patchedSha256: sha256(patchedVertexShaderBytes),
        changed: !patchedVertexShaderBytes.equals(sourceVertexShaderBytes),
      }),
    }),
    behavior: variant.id === "textured"
      ? "unaltered Google ground shader"
      : variant.id === "untextured"
        ? "draw-time white texture substitution only for programs exposing " +
          "Google's groundTexture uniform"
        : "draw suppression only for programs exposing Google's " +
          "groundTexture uniform",
  }));
}

const manifest = Object.freeze({
  schema: "cssmars-google-earth-pro-layer-oracles@1",
  qualification:
    "LOCAL_SOURCE_INFORMED_GOOGLE_RENDERER_VARIANTS_AWAITING_RUNTIME_CAPTURE",
  generatedAt: new Date().toISOString(),
  sourceApp,
  sourceFragmentShaderSha256,
  sourceVertexShaderSha256,
  hook: Object.freeze({
    sourcePath: hookSourcePath,
    path: hookPath,
    sha256: hookSha256,
    defaultBehavior: "observe nothing and preserve Google rendering",
    auditEnvironment: "CSSMARS_ORACLE_TEXTURE_MODE=audit",
    whiteGroundEnvironment: "CSSMARS_ORACLE_TEXTURE_MODE=white-ground",
    hideGroundEnvironment: "CSSMARS_ORACLE_TEXTURE_MODE=hide-ground",
    classification:
      "current linked GLSL program exposes groundTexture or skymapTexture",
    interposition:
      "late-load Mach-O indirect-symbol rebinding of glDrawArrays and " +
      "glDrawElements only inside libgoogleearth_pro.dylib; no flat namespace",
    liveModeEnvironment: "CSSMARS_ORACLE_LAYER_MODE_FILE=<32-byte file>",
    calibrationAuditEnvironment:
      "CSSMARS_ORACLE_CALIBRATION_AUDIT_LOG=<jsonl>; " +
      "CSSMARS_ORACLE_CALIBRATION_DUMP_DIR=<raw-rgba-directory>",
    calibrationMappingEnvironment:
      "CSSMARS_ORACLE_CALIBRATION_MAP=<texture-map.tsv>",
    calibrationBindingLogEnvironment:
      "CSSMARS_ORACLE_CALIBRATION_BINDING_LOG=<jsonl>",
    controlLayout:
      "bytes 0-15 mode, byte 16 atmosphere, byte 17 Sun, bytes 20-23 " +
      "little-endian revision",
  }),
  variants: Object.freeze(manifests),
});
const manifestPath = resolve(outputRoot, "manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2)}\n`);

function replacePlistString(plistPath, key, value) {
  execFileSync("/usr/bin/plutil", [
    "-replace",
    key,
    "-string",
    value,
    plistPath,
  ]);
}

function assertSafeTarget(path) {
  const relative = path.slice(outputRoot.length + 1);
  if (!path.startsWith(`${outputRoot}/`) ||
      !relative.endsWith(" Layer Oracle.app")) {
    throw new Error(`Refusing to replace unexpected layer oracle: ${path}`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
