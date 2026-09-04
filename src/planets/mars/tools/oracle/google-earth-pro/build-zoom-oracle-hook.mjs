import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const sourcePath = resolve(import.meta.dirname, "zoom-oracle-hook.mm");
const combinedSourcePath = resolve(
  import.meta.dirname,
  "combined-zoom-oracle.mm",
);
const outputRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/zoom",
);
const dylibPath = resolve(
  outputRoot,
  "libcssearth_googleearth_zoom_oracle.dylib",
);
const combinedDylibPath = resolve(
  outputRoot,
  "libcssmars_googleearth_zoom_combined.dylib",
);
await mkdir(outputRoot, { recursive: true });
execFileSync("/usr/bin/xcrun", [
  "clang++",
  "-arch",
  "x86_64",
  "-std=c++17",
  "-fblocks",
  "-dynamiclib",
  "-undefined",
  "dynamic_lookup",
  "-framework",
  "OpenGL",
  "-mmacosx-version-min=10.15",
  "-o",
  dylibPath,
  sourcePath,
], { stdio: "inherit" });
execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", dylibPath], {
  stdio: "inherit",
});
execFileSync("/usr/bin/codesign", ["--verify", "--strict", dylibPath], {
  stdio: "inherit",
});
execFileSync("/usr/bin/xcrun", [
  "clang++",
  "-arch",
  "x86_64",
  "-std=c++17",
  "-fobjc-arc",
  "-fblocks",
  "-dynamiclib",
  "-undefined",
  "dynamic_lookup",
  "-framework",
  "Cocoa",
  "-framework",
  "OpenGL",
  "-mmacosx-version-min=10.15",
  "-o",
  combinedDylibPath,
  combinedSourcePath,
  sourcePath,
], { stdio: "inherit" });
execFileSync(
  "/usr/bin/codesign",
  ["--force", "--sign", "-", combinedDylibPath],
  { stdio: "inherit" },
);
execFileSync(
  "/usr/bin/codesign",
  ["--verify", "--strict", combinedDylibPath],
  { stdio: "inherit" },
);
const bytes = await readFile(dylibPath);
const combinedBytes = await readFile(combinedDylibPath);
const manifest = Object.freeze({
  schema: "cssearth-google-earth-pro-zoom-hook@1",
  qualification: "LOCAL_INJECTED_NATIVE_INPUT_AND_PROJECTION_TRACE",
  sourcePath,
  dylibPath,
  combinedSourcePath,
  combinedDylibPath,
  architecture: "x86_64",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  combinedSha256: createHash("sha256")
    .update(combinedBytes)
    .digest("hex"),
  streams: Object.freeze([
    "Qt widget inventory",
    "timestamped QWheelEvent injection",
    "timestamped star-catalogue projection matrices",
  ]),
});
const manifestPath = resolve(outputRoot, "zoom-hook-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2)}\n`);
