import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { OBJECTS } from "../site/objects.mjs";
import { createSourceManifest, assertSourceBytes } from "../src/platform/source-manifest.mjs";
import { publishSourceBytes } from "../src/platform/source-acquisition.mjs";
import { requireGeographicLensPackage, requireGeographicLensReference } from "../src/platform/geographic-lens-contract.mjs";
import { validateRuntimeAssetManifest } from "../src/platform/runtime-asset-closure.mjs";
import { runtimeAssets, RUNTIME_ASSET_ORIGIN } from "./runtime-assets.mjs";
import { installRuntimeAssets } from "./setup.mjs";
import { planRuntimePublication, publishRuntimeAssetChanges, verifyPublicationInputs } from "./runtime-asset-publication.mjs";
import { uploadRuntimeFiles } from "./publish-runtime-assets.mjs";

const root = resolve(import.meta.dirname, ".."), hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function readDataRelease(response, expectedHash) {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Data release unavailable: HTTP ${response.status}.`);
  }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2 * 1024 ** 2) throw new Error("Data release exceeds its byte limit.");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (hash(bytes) !== expectedHash) throw new Error("Data release identity mismatch.");
  return bytes;
}
export async function verifyDatasetSource({ destination, entry, objectId, acquire = false, restore }) {
  let bytes;
  try { bytes = await readFile(destination); } catch (error) {
    if (error.code !== "ENOENT" || !acquire) throw error;
    bytes = await restore();
    await publishSourceBytes({ destination, bytes, entry, planetName: objectId });
  }
  assertSourceBytes({ bytes, entry, planetName: objectId });
}
function run(planet, args) {
  if (!/^tools\/[a-z0-9-]+\.mjs$/u.test(args[0])) throw new Error("Invalid dataset preparation command.");
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve(planet, args[0]), ...args.slice(1)], { cwd: root, stdio: "inherit" });
    child.once("error", reject); child.once("close", code => code === 0 ? accept() : reject(new Error(`Dataset preparation exited ${code}.`)));
  });
}
export function dataReleaseBytes(objectId, assets, observations) {
  const records = assets.map(({ filename, bytes, sha256 }) => ({ filename, bytes, sha256 })).sort((a,b) => a.filename.localeCompare(b.filename));
  validateRuntimeAssetManifest(objectId, { schema: `css${objectId}-runtime-assets@1`, assets: records });
  return Buffer.from(JSON.stringify({ schema: "cssearth-object-data-release@1", objectId,
    assets: records, observations: observations.toSorted((a,b) => a.id.localeCompare(b.id)) }) + "\n");
}
export function releaseInstallAssets(bytes, objectId, output) {
  const release = JSON.parse(bytes);
  if (release.schema !== "cssearth-object-data-release@1" || release.objectId !== objectId || !OBJECTS.some(object => object.id === objectId)) throw new Error("Incompatible object data release.");
  validateRuntimeAssetManifest(objectId, { schema: `css${objectId}-runtime-assets@1`, assets: release.assets });
  return release.assets.map(asset => ({ ...asset, id: objectId,
    url: `${RUNTIME_ASSET_ORIGIN}/runtime-assets/${asset.sha256}/${asset.filename}`,
    file: resolve(output, "scenes", objectId, asset.filename) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    object: { type: "string" }, dataset: { type: "string", multiple: true },
    release: { type: "string" }, output: { type: "string" }, "dry-run": { type: "boolean", default: false },
  } });
  const phase = positionals[0];
  if (positionals.length !== 1 || !["acquire", "verify", "prepare", "validate", "publish", "install"].includes(phase) ||
      !OBJECTS.some(object => object.id === values.object)) throw new Error("Use datasets.mjs acquire|verify|prepare|validate|publish|install --object=<id> [--dataset=<id>].");
  const objectId = values.object, planet = resolve(root, "src/planets", objectId);
  if (phase === "install") {
    if (!values.output || !values.release || !/^[a-f0-9]{64}$/u.test(values.release)) throw new Error("Installation needs --output=<owned-directory> and --release=<sha256>.");
    const response = await fetch(`${RUNTIME_ASSET_ORIGIN}/dataset-releases/${objectId}/${values.release}.json`, { signal: AbortSignal.timeout(30000) });
    const bytes = await readDataRelease(response, values.release);
    const result = await installRuntimeAssets(releaseInstallAssets(bytes, objectId, resolve(values.output)));
    console.log(JSON.stringify({ release: values.release, output: resolve(values.output), ...result }));
  } else {
    const config = JSON.parse(await readFile(resolve(planet, "source/observations.json")));
    if (config.schema !== "cssearth-observation-inventory@1" || config.objectId !== objectId || !Array.isArray(config.datasets) ||
        new Set(config.datasets.map(entry => entry.id)).size !== config.datasets.length ||
        config.datasets.some(entry => !/^[a-z0-9-]+$/u.test(entry.id) || !["prepared-local", "versioned-provider"].includes(entry.source?.type)) ||
        !Array.isArray(config.integration) || config.integration.some(command => !Array.isArray(command) || !command.length || command.some(arg => typeof arg !== "string"))) throw new Error("Invalid dataset inventory.");
    const selected = values.dataset?.length ? config.datasets.filter(entry => values.dataset.includes(entry.id)) : config.datasets;
    if (!selected.length || values.dataset?.some(id => !selected.some(entry => entry.id === id))) throw new Error("Unknown dataset selection.");
    const sourceRoot = resolve(planet, "source"), source = await createSourceManifest({ planetId: objectId, planetName: objectId, sourceRoot });
    const sourceEntries = new Map();
    for (const entry of selected) {
      if (!["prepared-local", "versioned-provider"].includes(entry.source?.type)) throw new Error("Dataset source type is not declared.");
      for (const input of source.inputsFor(entry.source.consumer)) sourceEntries.set(input.path, input);
      for (const path of entry.source.documents ?? []) {
        const document = source.manifest.documents.find(document => document.path === path);
        if (!document) throw new Error(`Dataset source document is unpinned: ${path}.`);
        sourceEntries.set(path, document);
      }
    }
    for (const entry of sourceEntries.values()) {
      await verifyDatasetSource({ destination: resolve(sourceRoot, entry.path), entry, objectId, acquire: phase === "acquire", restore: () => {
        // Source snapshots are checked in. Restore exactly that version without
        // reacquiring a newer mutable provider export or a worldwide raster.
        return execFileSync("git", ["show", `HEAD:src/planets/${objectId}/source/${entry.path}`], { cwd: root, maxBuffer: entry.expectedBytes + 1024 });
      } });
    }
    if (["acquire", "verify"].includes(phase)) {
      console.log(JSON.stringify({ objectId, datasets: selected.map(entry => entry.id), verifiedSourceFiles: sourceEntries.size, source: "pinned repository snapshots" }));
    } else {
      if (phase === "prepare") {
        for (const entry of selected) await run(planet, [entry.prepare]);
        for (const command of config.integration ?? []) await run(planet, command);
      }
      const assets = await runtimeAssets(root, [objectId]); await verifyPublicationInputs(assets);
      const { runtimeDefinition } = await import(pathToFileURL(resolve(planet, "runtime/definition.mjs")));
      const capacity = runtimeDefinition.pageLayers.find(layer => layer.geographic)?.plan, observations = [];
      for (const entry of config.datasets) {
        if (!/^runtime\/prepared[A-Za-z]+\.mjs$/u.test(entry.prepared)) throw new Error("Invalid dataset descriptor module.");
        const module = await import(pathToFileURL(resolve(planet, entry.prepared)));
        const descriptor = requireGeographicLensReference(module[entry.descriptorExport], `/scenes/${objectId}/`);
        const bytes = await readFile(resolve(root, `public${descriptor.package.url}`));
        if (bytes.length !== descriptor.package.bytes || hash(bytes) !== descriptor.package.sha256) throw new Error("Dataset package identity mismatch.");
        const content = requireGeographicLensPackage(JSON.parse(bytes), descriptor, entry.scope.entityIds?.[0] ?? objectId, capacity, objectId);
        observations.push({ id: entry.id, type: entry.source.type, scope: entry.scope, descriptor, source: content.source });
      }
      const bytes = dataReleaseBytes(objectId, assets, observations), id = hash(bytes);
      const directory = resolve(planet, ".prepared/data-releases"); await mkdir(directory, { recursive: true });
      const file = resolve(directory, `${id}.json`); await writeFile(file, bytes);
      const record = { release: id, file, files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) };
      if (phase === "publish") {
        if (values["dry-run"]) {
          const plan = await planRuntimePublication(assets);
          console.log(JSON.stringify({ ...record, missing: plan.missing.map(({filename,bytes,sha256}) => ({filename,bytes,sha256})), reused: plan.present.length,
            uploadBytes: plan.missing.reduce((sum, asset) => sum + asset.bytes, 0) }, null, 2));
        } else {
          const key = `dataset-releases/${objectId}/${id}.json`, url = `${RUNTIME_ASSET_ORIGIN}/${key}`;
          const result = await publishRuntimeAssetChanges(assets, { upload: uploadRuntimeFiles,
            publishRelease: async () => {
              await uploadRuntimeFiles([{ key, file, bytes: bytes.length }]);
              const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
              await readDataRelease(response, id);
            } });
          const receipt = { ...record, url, ...result, publishedAt: new Date().toISOString() };
          await writeFile(resolve(directory, `${id}.receipt.json`), JSON.stringify(receipt, null, 2) + "\n");
          console.log(JSON.stringify({ ...receipt, verified: result.verified.length }));
        }
      } else console.log(JSON.stringify(record));
    }
  }
}
