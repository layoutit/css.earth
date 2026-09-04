import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { OBJECTS } from "../site/objects.mjs";

export function planetTestDirectory(id, projectRoot = process.cwd()) {
  return resolve(projectRoot, "src", "planets", id, "test");
}

export async function discoverPlanetTests(
  id,
  { projectRoot = process.cwd(), readDirectory = readdir } = {},
) {
  const directory = planetTestDirectory(id, projectRoot);
  let filenames;
  try {
    filenames = await readDirectory(directory);
  } catch (cause) {
    throw new Error(`Implemented planet ${id} test directory is missing.`, { cause });
  }
  const tests = filenames
    .filter((filename) => filename.endsWith(".test.mjs"))
    .sort()
    .map((filename) => resolve(directory, filename));
  if (tests.length === 0) {
    throw new Error(`Implemented planet ${id} has no tests.`);
  }
  return tests;
}

export function planetAssembleScript(id, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "tools/compact-production-assets.mjs", projectRoot);
}

export function planetAcquireScript(id, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "tools/acquire.mjs", projectRoot);
}

export function planetPrepareScript(id, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "tools/prepare.mjs", projectRoot);
}

export function planetBrowserSmokeScript(id, projectRoot = process.cwd()) {
  return planetOwnedScript(id, "test/smoke-browser.mjs", projectRoot);
}

export async function resolvePlanetAssembly(
  id,
  { projectRoot = process.cwd(), accessFile = access } = {},
) {
  const script = planetAssembleScript(id, projectRoot);
  try {
    await accessFile(script);
  } catch (cause) {
    throw new Error(`Implemented planet ${id} assembly script is missing.`, { cause });
  }
  return script;
}

export async function resolvePlanetCommand(
  id,
  mode,
  { projectRoot = process.cwd(), accessFile = access } = {},
) {
  const resolvers = Object.freeze({
    acquire: planetAcquireScript,
    prepare: planetPrepareScript,
    browser: planetBrowserSmokeScript,
    assemble: planetAssembleScript,
  });
  const resolveScript = resolvers[mode];
  if (!resolveScript) throw new TypeError(`Unknown planet command mode: ${mode}.`);
  const script = resolveScript(id, projectRoot);
  try {
    await accessFile(script);
  } catch (cause) {
    throw new Error(`Implemented planet ${id} ${mode} script is missing.`, {
      cause,
    });
  }
  return script;
}

async function main(mode = process.argv[2]) {
  if (!new Set(["acquire", "prepare", "test", "browser", "assemble"]).has(mode)) {
    throw new TypeError(
      "Usage: node tools/run-implemented-planets.mjs " +
      "acquire|prepare|test|browser|assemble",
    );
  }

  for (const { id } of OBJECTS) {
    const argumentsList = mode === "test"
      ? ["--test", ...await discoverPlanetTests(id)]
      : [await resolvePlanetCommand(id, mode), ...process.argv.slice(3)];
    await run(process.execPath, argumentsList);
  }
}

function planetOwnedScript(id, path, projectRoot) {
  return resolve(projectRoot, "src", "planets", id, ...path.split("/"));
}

function run(command, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(
        `Implemented planet command failed with ${signal ?? `exit ${code}`}.`,
      ));
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
