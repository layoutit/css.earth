import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const sourcePath = resolve(import.meta.dirname, "headless-oracle.mm");
const outputRoot = resolve(
  process.env.CSSMARS_GOOGLE_EARTH_HEADLESS_ROOT ?? resolve(
    workspaceRoot,
    ".local/oracles/google-earth-pro/patched",
  ),
);
const dylibPath = resolve(outputRoot, "libcssmars_googleearth_oracle.dylib");
const appDisplayName = process.env.CSSMARS_GOOGLE_EARTH_DISPLAY_NAME ??
  "Google Earth Pro Mars Oracle";
const bundleIdentifier = process.env.CSSMARS_GOOGLE_EARTH_BUNDLE_IDENTIFIER ??
  "dev.polycss.GoogleEarthProMarsOracle";
const appPath = resolve(outputRoot, `${appDisplayName}.app`);
const embeddedDylibPath = resolve(
  appPath,
  "Contents/Frameworks/libcssmars_googleearth_oracle.dylib",
);
const executablePath = resolve(appPath, "Contents/MacOS/Google Earth");
const infoPlistPath = resolve(appPath, "Contents/Info.plist");
const googleEarthLibraryPath = resolve(
  appPath,
  "Contents/Frameworks/libgoogleearth_pro.dylib",
);
const embeddedInstallName =
  "@executable_path/../Frameworks/libcssmars_googleearth_oracle.dylib";
const windowAuditSourcePath = resolve(import.meta.dirname, "window-audit.m");
const windowAuditPath = resolve(outputRoot, "window-audit");
await mkdir(outputRoot, { recursive: true });

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

await copyFile(dylibPath, embeddedDylibPath);
const googleEarthLibraryBefore = await readFile(googleEarthLibraryPath);
const googleEarthLibraryAfterRecoveryPatch = patchBytes({
  source: googleEarthLibraryBefore,
  offset: 0x73bfe,
  expected: Buffer.from([0xe8, 0x09, 0x17, 0xd7, 0x00]),
  replacement: Buffer.from([0xb8, 0x00, 0x00, 0x40, 0x00]),
  description: "headless crash-recovery dialog Continue response",
});
const googleEarthLibraryAfter = patchBytes({
  source: googleEarthLibraryAfterRecoveryPatch,
  offset: 0x7100b,
  expected: Buffer.from([0x0f, 0x85, 0xcd, 0x00, 0x00, 0x00]),
  replacement: Buffer.from([0x90, 0x90, 0x90, 0x90, 0x90, 0x90]),
  description: "isolated cloned-app single-instance warning branch",
});
await writeFile(googleEarthLibraryPath, googleEarthLibraryAfter);
const executableBefore = await readFile(executablePath);
const executableBeforeSha256 = createHash("sha256")
  .update(executableBefore)
  .digest("hex");
const executableAfter = addDylibLoadCommand(
  executableBefore,
  embeddedInstallName,
);
await writeFile(executablePath, executableAfter);
execFileSync("/usr/bin/plutil", [
  "-replace",
  "CFBundleIdentifier",
  "-string",
  bundleIdentifier,
  infoPlistPath,
]);
execFileSync("/usr/bin/codesign", [
  "--deep",
  "--force",
  "--sign",
  "-",
  appPath,
], { stdio: "inherit" });
execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath], {
  stdio: "inherit",
});
execFileSync("/usr/bin/xcrun", [
  "clang",
  "-fobjc-arc",
  "-fblocks",
  "-framework",
  "AppKit",
  "-framework",
  "CoreGraphics",
  "-o",
  windowAuditPath,
  windowAuditSourcePath,
], { stdio: "inherit" });

const bytes = await readFile(dylibPath);
const manifest = Object.freeze({
  schema: "cssmars-google-earth-pro-headless-instrumentation@1",
  qualification: "LOCAL_INJECTED_ORACLE_CONTROLLER_NOT_FOR_REDISTRIBUTION",
  sourcePath,
  dylibPath,
  architecture: "x86_64",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  embeddedDylibPath,
  embeddedInstallName,
  bundleIdentifier,
  executableBeforeSha256,
  executableAfterSha256: createHash("sha256")
    .update(executableAfter)
    .digest("hex"),
  googleEarthLibraryPath,
  googleEarthLibraryBeforeSha256: createHash("sha256")
    .update(googleEarthLibraryBefore)
    .digest("hex"),
  googleEarthLibraryAfterSha256: createHash("sha256")
    .update(googleEarthLibraryAfter)
    .digest("hex"),
  windowAuditPath,
  behaviors: Object.freeze([
    "headless application activation policy",
    "automatic Continue response for the cloned app crash-recovery dialog",
    "single-instance warning bypass for the isolated cloned app",
    "normal Google Mars menu action dispatch",
    "explicit atmosphere and Sun toggle state",
    "JSONL menu, window, action, and readiness evidence",
    "bounded file-controlled AppKit delivery to Google's QNSView input handlers",
    "accepted-input timestamps captured at QNSView handler entry",
    "monotonic requested, posted, and returned input timestamps",
    "optional compact binary records at each NSOpenGLContext present boundary",
    "fixed-capacity motion ring drained outside the render callback",
  ]),
});
const manifestPath = resolve(outputRoot, "headless-oracle-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, manifestPath, ...manifest }, null, 2)}\n`);

function addDylibLoadCommand(source, installName) {
  if (source.includes(Buffer.from(`${installName}\0`))) return source;
  const MH_MAGIC_64 = 0xfeedfacf;
  const LC_LOAD_DYLIB = 0xc;
  if (source.readUInt32LE(0) !== MH_MAGIC_64) {
    throw new Error("Oracle executable is not a little-endian Mach-O 64 file.");
  }
  const loadCommandsOffset = 32;
  const commandCount = source.readUInt32LE(16);
  const commandsSize = source.readUInt32LE(20);
  const commandOffset = loadCommandsOffset + commandsSize;
  const nameBytes = Buffer.from(`${installName}\0`);
  const commandSize = align(24 + nameBytes.length, 8);
  const firstSectionOffset = 6264;
  if (commandOffset + commandSize > firstSectionOffset) {
    throw new Error("Mach-O header has insufficient padding for oracle dylib.");
  }
  if (source.subarray(commandOffset, commandOffset + commandSize)
    .some((value) => value !== 0)) {
    throw new Error("Mach-O load-command padding is not empty.");
  }
  const output = Buffer.from(source);
  output.writeUInt32LE(LC_LOAD_DYLIB, commandOffset);
  output.writeUInt32LE(commandSize, commandOffset + 4);
  output.writeUInt32LE(24, commandOffset + 8);
  output.writeUInt32LE(0, commandOffset + 12);
  output.writeUInt32LE(0, commandOffset + 16);
  output.writeUInt32LE(0, commandOffset + 20);
  nameBytes.copy(output, commandOffset + 24);
  output.writeUInt32LE(commandCount + 1, 16);
  output.writeUInt32LE(commandsSize + commandSize, 20);
  return output;
}

function align(value, boundary) {
  return Math.ceil(value / boundary) * boundary;
}

function patchBytes({ source, offset, expected, replacement, description }) {
  const current = source.subarray(offset, offset + replacement.length);
  if (current.equals(replacement)) return source;
  if (!current.equals(expected)) {
    throw new Error(
      `Unexpected bytes for ${description} at 0x${offset.toString(16)}: ${current.toString("hex")}.`,
    );
  }
  const output = Buffer.from(source);
  replacement.copy(output, offset);
  return output;
}
