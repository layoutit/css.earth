import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const sourcePath = resolve(import.meta.dirname, "contract-render-hook.mm");
const outputRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/contracts",
);
const hookPath = resolve(
  outputRoot,
  "libcssmars_googleearth_contract_hook_v10.dylib",
);
const manifestPath = resolve(outputRoot, "manifest-v10.json");
const appRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/Google Earth Pro Mars Oracle.app",
);
const rendererPath = resolve(
  appRoot,
  "Contents/Frameworks/libgoogleearth_pro.dylib",
);
const shaderRoot = resolve(appRoot, "Contents/Resources/shaders");

await mkdir(outputRoot, { recursive: true });
await execFileAsync("/usr/bin/xcrun", [
  "clang++",
  "-arch", "x86_64",
  "-std=c++17",
  "-fblocks",
  "-dynamiclib",
  "-framework", "Cocoa",
  "-framework", "OpenGL",
  "-mmacosx-version-min=10.15",
  "-o", hookPath,
  sourcePath,
]);
await execFileAsync("/usr/bin/codesign", [
  "--force", "--sign", "-", hookPath,
]);

const files = Object.freeze({
  source: sourcePath,
  hook: hookPath,
  renderer: rendererPath,
  starsVertexShader: resolve(shaderRoot, "stars.glslesv"),
  starsFragmentShader: resolve(shaderRoot, "stars.glslesf"),
  skyMapVertexShader: resolve(shaderRoot, "hammer_aitoff.glslesv"),
  skyMapFragmentShader: resolve(shaderRoot, "hammer_aitoff.glslesf"),
  atmosphereVertexShader: resolve(shaderRoot, "atmosphere.glslesv"),
  atmosphereFragmentShader: resolve(shaderRoot, "atmosphere.glslesf"),
  atmosphereLibrary: resolve(shaderRoot, "atmosphere.glsllib"),
});
const artifacts = Object.freeze(Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([name, path]) => {
    const bytes = await readFile(path);
    return [name, Object.freeze({
      path,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })];
  }),
)));
const manifest = Object.freeze({
  schema: "cssmars-google-earth-pro-render-contract-hook@1",
  generatedAt: new Date().toISOString(),
  architecture: "x86_64",
  application: "Google Earth Pro 7.3.7.1327 Mars patched oracle",
  rendererBinding: Object.freeze({
    importedFunctions: Object.freeze(["glDrawArrays", "glDrawElements"]),
    chaining: "late-bound wrapper preserves the previously installed layer hook",
  }),
  artifacts,
});
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: true,
  manifestPath,
  hook: artifacts.hook,
  renderer: artifacts.renderer,
}, null, 2)}\n`);
