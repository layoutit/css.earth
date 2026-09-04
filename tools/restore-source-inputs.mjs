#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import { OBJECTS } from "../site/objects.mjs";
import { publishSourceBytes } from "../src/platform/source-acquisition.mjs";
import {
  assertSourceBytes,
  createSourceManifest,
} from "../src/platform/source-manifest.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const binarySource = /\.(?:csv|fits|gif|glb|jpe?g|png|tiff?|ttf|webp)$/iu;
const directBinaryUrl = /\.(?:csv|fits|gif|glb|jpe?g|png|tiff?|ttf|webp)(?:[?#].*)?$/iu;
const specialRefreshPlanets = new Set(["mars", "mercury", "venus"]);
const fetchedBytes = new Map();

for (const { id, name } of OBJECTS) {
  const sourceRoot = resolve(projectRoot, "src", "planets", id, "source");
  const manifest = JSON.parse(await readFile(resolve(sourceRoot, "manifest.json"), "utf8"));
  const missingSpecialInputs = [];

  for (const entry of manifest.inputs.filter(({ path }) => binarySource.test(path))) {
    const destination = resolve(sourceRoot, entry.path);
    if (await exists(destination)) {
      assertSourceBytes({ entry, bytes: await readFile(destination), planetName: name });
      continue;
    }
    if (directBinaryUrl.test(entry.origin)) {
      const bytes = await fetchPinnedBytes(entry, name);
      await publishSourceBytes({ destination, bytes, entry, planetName: name });
      continue;
    }
    missingSpecialInputs.push(entry.path);
  }

  if (missingSpecialInputs.length > 0) {
    if (!specialRefreshPlanets.has(id)) {
      throw new Error(
        `${name} has no acquisition route for: ${missingSpecialInputs.join(", ")}.`,
      );
    }
    await run(process.execPath, [
      resolve(projectRoot, "src", "planets", id, "tools", "acquire.mjs"),
      "--refresh",
    ]);
  }

  const source = await createSourceManifest({ planetId: id, planetName: name, sourceRoot });
  await source.verify();
  console.log(`${name}: source inputs restored and verified`);
}

async function fetchPinnedBytes(entry, planetName) {
  if (!fetchedBytes.has(entry.expectedSha256)) {
    fetchedBytes.set(entry.expectedSha256, (async () => {
      const response = await fetch(entry.origin, {
        headers: { "user-agent": "cssEarth source restoration" },
      });
      if (!response.ok) {
        throw new Error(
          `${planetName} source request failed for ${entry.path}: ${response.status}.`,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      assertSourceBytes({ entry, bytes, planetName });
      return bytes;
    })());
  }
  return fetchedBytes.get(entry.expectedSha256);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(
        `Source restoration failed with ${signal ?? `exit ${code}`}.`,
      ));
    });
  });
}
