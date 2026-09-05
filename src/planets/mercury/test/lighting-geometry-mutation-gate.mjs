#!/usr/bin/env node

// Mutation gate for the Mercury lighting and sky geometry browser suite.
//
// The suite exists to catch renders that are self-consistent but wrong. This
// gate proves it can: each known perturbation is applied to the source, the
// affected preparation steps are re-run, the suite is run against a dev
// server, and the suite must go red on a check the mutation was expected to
// trip. Any mutation that survives fails the gate by name. Every file is
// restored afterwards, on success, failure, crash or interrupt.
//
// Usage: node src/planets/mercury/test/lighting-geometry-mutation-gate.mjs
//   [--only <id>[,<id>...]] [--port <port>] [--restore]
// The gate starts its own `astro dev` server (the suite needs the runtime's
// development diagnostics and sources served live) on --port (default 4219).
// --restore only restores a leftover backup from an interrupted run.

import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const suiteScript = resolve(projectRoot,
  "src/planets/mercury/test/lighting-geometry-browser.mjs");
const toolsDirectory = resolve(projectRoot, "src/planets/mercury/tools");
const backupRoot = resolve(projectRoot, "node_modules/.cache/mercury-geometry-mutation-gate");
const backupManifest = join(backupRoot, "manifest.json");

const arguments_ = process.argv.slice(2);
const only = readOption("--only")?.split(",") ?? null;
const port = Number(readOption("--port") ?? 4219);
const restoreOnly = arguments_.includes("--restore");

const SKY_PREPARE = ["prepare-starfield.mjs", "prepare-scene.mjs",
  "prepare-runtime-asset-manifest.mjs"];
const SUN_PREPARE = ["prepare-sky-sun.mjs", "prepare-scene.mjs",
  "prepare-runtime-asset-manifest.mjs"];

// Files the preparation steps above rewrite; snapshotted once and restored
// after every prepare-time mutation.
const PREPARED_OUTPUTS = [
  "src/planets/mercury/runtime/preparedStarfield.mjs",
  "src/planets/mercury/runtime/preparedScene.mjs",
  "src/planets/mercury/runtime/preparedSkySun.mjs",
  "src/planets/mercury/runtime-assets.json",
  ...readdirSync(resolve(projectRoot, "public/scenes/mercury"))
    .filter((name) => /^mercury-(starfield|directional-sun)/u.test(name))
    .map((name) => `public/scenes/mercury/${name}`),
];

// Each mutation: the source edit (find must occur exactly once), the
// preparation steps it invalidates, how to confirm the mutated code is what
// the server serves, and the checks it must trip.
export const MUTATIONS = Object.freeze([
  {
    id: "negate-view-y",
    description: "cssDirectionToViewDirection keeps y (negates the correct flip)",
    file: "src/platform/solar-view-direction.mjs",
    find: "  return [x, -y, z];",
    replace: "  return [x, y, z]; /* MUTATION negate-view-y */",
    prepare: [],
    served: { url: "/src/platform/solar-view-direction.mjs", marker: "MUTATION negate-view-y" },
    expect: /lit-direction-matches-oracle|sun-sprite-position|subsolar-latitude|lit-side-faces/u,
  },
  {
    id: "negate-view-z",
    description: "cssDirectionToViewDirection negates z (Sun mirrored through the screen)",
    file: "src/platform/solar-view-direction.mjs",
    find: "  return [x, -y, z];",
    replace: "  return [x, -y, -z]; /* MUTATION negate-view-z */",
    prepare: [],
    served: { url: "/src/platform/solar-view-direction.mjs", marker: "MUTATION negate-view-z" },
    expect: /illuminated-fraction|sun-sprite-visibility|subsolar-latitude/u,
  },
  {
    id: "light-roll-180",
    description: "material light roll offset by 180 degrees",
    file: "src/planets/mercury/runtime/presentation.mjs",
    find: "          PREPARED_MERCURY_ASSETS.lighting.baseLightAzimuthDegrees) : 0;",
    replace: "          PREPARED_MERCURY_ASSETS.lighting.baseLightAzimuthDegrees + 180) : 0; /* MUTATION light-roll-180 */",
    prepare: [],
    served: { url: "/src/planets/mercury/runtime/presentation.mjs", marker: "MUTATION light-roll-180" },
    expect: /lit-direction-matches-oracle|terminator|lit-side-faces/u,
  },
  // The sky rides the scene matrix through the prepared registration on every
  // camera path (reset, drag, flight), derived from the scene in one place:
  // a sky-only drag error (inverted yaw, scaled pitch) is impossible by
  // construction, so the mutations below attack the derivation itself.
  {
    id: "sky-legacy-presentation",
    description: "sky follows the legacy presentation path (inverted yaw, -1.7 pitch response) instead of riding the scene",
    file: "src/platform/cubic-sky-runtime.mjs",
    find: "  const currentSkyboxMatrix = () => skyRegistration\n    ? sceneMatrix.multiply(skyRegistration)\n    : skyboxMatrix;",
    replace: "  const currentSkyboxMatrix = () => skyboxMatrix; /* MUTATION sky-legacy-presentation */",
    prepare: [],
    served: { url: "/src/platform/cubic-sky-runtime.mjs", marker: "MUTATION sky-legacy-presentation" },
    expect: /drag-(right|left|down|up)-sky-moves-with-sun|sky-anchor|sky-.*band-angle/u,
  },
  {
    id: "sky-registration-order",
    description: "registration applied before the camera rotation instead of after it",
    file: "src/platform/cubic-sky-runtime.mjs",
    find: "    ? sceneMatrix.multiply(skyRegistration)",
    replace: "    ? skyRegistration.multiply(sceneMatrix) /* MUTATION sky-registration-order */",
    prepare: [],
    served: { url: "/src/platform/cubic-sky-runtime.mjs", marker: "MUTATION sky-registration-order" },
    expect: /sky-.*band-angle|sky-anchor|sky-bulge|drag-(right|left|down|up)-sky-moves-with-sun/u,
  },
  {
    id: "sky-registration-yaw-180",
    description: "prepared sky registration turned by 180 degrees about the scene's vertical",
    file: "src/platform/cubic-sky-runtime.mjs",
    find: "  const matrix = new DOMMatrix(registration);\n  if (!matrix.is2D",
    replace: "  const matrix = new DOMMatrix(registration).rotateAxisAngle(0, 1, 0, 180); /* MUTATION sky-registration-yaw-180 */\n  if (!matrix.is2D",
    prepare: [],
    served: { url: "/src/platform/cubic-sky-runtime.mjs", marker: "MUTATION sky-registration-yaw-180" },
    expect: /sky-.*band-angle|sky-anchor|sky-bulge/u,
  },
  {
    id: "mirror-panorama",
    description: "ESO panorama sampled with longitude increasing rightward (mirrored sky)",
    file: "src/platform/prepare-cubic-sky-source.mjs",
    find: "      const sourceX = (Math.PI - galacticLongitude) / (2 * Math.PI) *",
    replace: "      const sourceX = (Math.PI + galacticLongitude) / (2 * Math.PI) * /* MUTATION mirror-panorama */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /sky-anchor|sky-.*band-angle/u,
  },
  {
    id: "galactic-pole-2deg",
    description: "north galactic pole declination perturbed by +2 degrees",
    file: "src/platform/galactic-frame.mjs",
    find: "  northPoleDecDegrees: 27.12825,",
    replace: "  northPoleDecDegrees: 29.12825, /* MUTATION galactic-pole-2deg */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /sky-anchor/u,
  },
  {
    id: "drop-eso-correction",
    description: "fitted ESO panorama frame correction replaced by identity",
    file: "src/platform/eso-panorama-registration.mjs",
    find: "export const ESO_PANORAMA_REGISTRATION = fitPanoramaFrameRotation();",
    replace: "export const ESO_PANORAMA_REGISTRATION = Object.freeze({ ...fitPanoramaFrameRotation(), " +
      "matrix: Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]) }); /* MUTATION drop-eso-correction */",
    prepare: SKY_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedStarfield.mjs", changed: true },
    expect: /sky-anchor/u,
  },
  // The wheel dolly moves the eye along its axis and holds no surface
  // anchor; a controller that keeps the scale camera's anchor turns the
  // scene on every off-centre wheel event.
  {
    id: "wheel-dolly-holds-anchor",
    description: "the perspective dolly keeps the scale camera's surface anchor (off-centre wheel turns the scene)",
    file: "src/platform/prepared-wheel-zoom.mjs",
    find: "    anchor = dolly === null ? { x:event.clientX, y:event.clientY } : null;",
    replace: "    anchor = { x:event.clientX, y:event.clientY }; /* MUTATION wheel-dolly-holds-anchor */",
    prepare: [],
    served: { url: "/src/platform/prepared-wheel-zoom.mjs", marker: "MUTATION wheel-dolly-holds-anchor" },
    expect: /wheel-.*-holds-scene-rotation/u,
  },
  // The heliocentric preparation refuses a body-fixed Sun direction that
  // disagrees with the orbital facts, so the mirrored Sun is applied where
  // the lighting and the sprite take their direction from the frame.
  {
    id: "from-sun-direction",
    description: "prepared Sun direction negated (from-Sun instead of to-Sun) for the lighting and the sprite",
    file: "src/planets/mercury/tools/prepare-sky-sun.mjs",
    find: "const sceneDirection = MERCURY_PRESENTATION_FRAME.sunDirection;",
    replace: "const sceneDirection = Object.freeze(MERCURY_PRESENTATION_FRAME.sunDirection.map((value) => -value)); /* MUTATION from-sun-direction */",
    prepare: SUN_PREPARE,
    served: { url: "/src/planets/mercury/runtime/preparedSkySun.mjs", changed: true },
    expect: /sky-anchor|band-angle|lit-direction-matches-oracle|sun-sprite-position/u,
  },
]);

if (restoreOnly) {
  restoreLeftovers();
  process.exit(0);
}
restoreLeftovers();

const selected = only
  ? MUTATIONS.filter(({ id }) => only.includes(id))
  : MUTATIONS;
if (only && selected.length !== only.length) {
  throw new Error(`Unknown mutation id in --only: ${only}`);
}

// Snapshot every file any mutation touches, plus the prepared outputs.
const backedUp = new Set();
rmSync(backupRoot, { recursive: true, force: true });
mkdirSync(backupRoot, { recursive: true });
for (const path of [...new Set([...MUTATIONS.map(({ file }) => file), ...PREPARED_OUTPUTS])]) {
  backup(path);
}
writeFileSync(backupManifest, JSON.stringify([...backedUp], null, 2));

let server = null;
let activeChild = null;
const results = [];
const restoreAll = () => {
  for (const path of backedUp) restore(path);
  if (existsSync(backupManifest)) unlinkSync(backupManifest);
};
const cleanup = () => {
  try {
    // A preparation step or suite still running would keep writing mutated
    // output after the sources are restored: stop it first and let the
    // kernel reap it before copying the originals back.
    if (activeChild !== null && activeChild.exitCode === null) {
      activeChild.kill("SIGKILL");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
    activeChild = null;
    restoreAll();
  } finally {
    server?.kill("SIGTERM");
    server = null;
  }
};
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(`\n${signal}: restoring sources.`);
    cleanup();
    process.exit(130);
  });
}
process.on("uncaughtException", (error) => {
  console.error(error);
  cleanup();
  process.exit(1);
});

try {
  server = await startDevServer(port);
  const baseUrl = server.baseUrl;
  console.log(`suite target: ${baseUrl}`);

  // The unmutated suite must be green, or the gate proves nothing.
  const baseline = await runSuite(baseUrl);
  if (!baseline.ok) {
    throw new Error(`Baseline suite is not green: ${baseline.failed.join(", ")}`);
  }
  console.log(`baseline: green (${baseline.checks.length} checks)`);
  const baselineServed = {};
  for (const { served } of selected) {
    if (served.changed) baselineServed[served.url] ??= await fetchText(baseUrl + served.url);
  }

  for (const mutation of selected) {
    const started = Date.now();
    let outcome;
    try {
      applyMutation(mutation);
      for (const step of mutation.prepare) await runPreparation(step);
      await waitForServed(baseUrl, mutation, baselineServed);
      const run = await runSuite(baseUrl);
      const tripped = run.failed.filter((id) => mutation.expect.test(id));
      const status = run.ok
        ? "SURVIVED"
        : tripped.length > 0 ? "caught" : "red-for-other-reasons";
      outcome = { id: mutation.id, status, failed: run.failed, tripped,
        crashed: run.crashed ?? null };
    } finally {
      restore(mutation.file);
      if (mutation.prepare.length > 0) for (const path of PREPARED_OUTPUTS) restore(path);
    }
    outcome.seconds = Math.round((Date.now() - started) / 1000);
    results.push(outcome);
    console.log(`${outcome.status.padEnd(22)} ${mutation.id.padEnd(28)} ` +
      `${outcome.seconds}s  tripped: ${outcome.tripped.join(", ") || "-"}`);
  }

  // Sources are back: the suite must be green again.
  await waitForServed(baseUrl, null, baselineServed);
  const final = await runSuite(baseUrl);
  if (!final.ok) {
    throw new Error(`Suite not green after restoring: ${final.failed.join(", ")}`);
  }
} finally {
  cleanup();
}

const surviving = results.filter(({ status }) => status !== "caught");
console.log(JSON.stringify({
  ok: surviving.length === 0,
  gate: "mercury-lighting-geometry-mutations",
  results,
}));
if (surviving.length > 0) {
  console.error(`MUTATION GATE FAILED: ${surviving.map(({ id, status }) =>
    `${id} (${status})`).join(", ")}`);
  process.exit(1);
}

// -----------------------------------------------------------------------

function readOption(name) {
  const index = arguments_.indexOf(name);
  return index === -1 ? null : arguments_[index + 1];
}

function backup(path) {
  const target = join(backupRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(projectRoot, path), target);
  backedUp.add(path);
}

function restore(path) {
  const source = join(backupRoot, path);
  if (!existsSync(source)) return;
  copyFileSync(source, resolve(projectRoot, path));
}

function restoreLeftovers() {
  if (!existsSync(backupManifest)) return;
  const paths = JSON.parse(readFileSync(backupManifest, "utf8"));
  console.error(`Restoring ${paths.length} files from an interrupted gate run.`);
  for (const path of paths) restore(path);
  unlinkSync(backupManifest);
}

function applyMutation(mutation) {
  const path = resolve(projectRoot, mutation.file);
  const source = readFileSync(path, "utf8");
  const occurrences = source.split(mutation.find).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `${mutation.id}: anchor found ${occurrences} times in ${mutation.file}.`,
    );
  }
  writeFileSync(path, source.replace(mutation.find, mutation.replace));
}

function runPreparation(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(toolsDirectory, script)], {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    activeChild = child;
    child.once("error", reject);
    child.once("exit", (code) => {
      activeChild = null;
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} exited with ${code}`));
    });
  });
}

function runSuite(baseUrl) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [suiteScript, baseUrl], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      activeChild = null;
      const lines = stdout.trim().split("\n");
      try {
        const report = JSON.parse(lines[lines.length - 1]);
        if (report.suite !== "mercury-lighting-geometry") throw new Error("wrong suite");
        resolvePromise(report);
      } catch {
        // A crash is red too, but not a verdict: report it as such.
        resolvePromise({ ok: false, failed: [], checks: [], crashed:
          `exit ${code}: ${stderr.slice(-600)}` });
      }
    });
  });
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

// Vite serves sources from disk; confirm the mutated (or restored) text is
// what a fresh page would load before trusting a suite result.
async function waitForServed(baseUrl, mutation, baselineServed) {
  const deadline = Date.now() + 20_000;
  const expectations = mutation
    ? [[mutation.served, false]]
    : Object.keys(baselineServed).map((url) => [{ url, changed: true }, true]);
  for (const [served, expectBaseline] of expectations) {
    for (;;) {
      const text = await fetchText(baseUrl + served.url);
      const satisfied = served.marker
        ? text.includes(served.marker)
        : expectBaseline
          ? text === baselineServed[served.url]
          : text !== baselineServed[served.url];
      if (satisfied) break;
      if (Date.now() > deadline) {
        throw new Error(`Served ${served.url} does not reflect ` +
          `${mutation ? mutation.id : "the restored sources"}.`);
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
  }
  // Give Vite's module graph a moment to settle after the file change.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
}

async function startDevServer(devPort) {
  const child = spawn("pnpm", ["exec", "astro", "dev", "--host", "127.0.0.1",
    "--port", String(devPort)], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) {
      // Astro keeps one dev server per project; when one is already up it
      // tells us where, and that server serves the same live sources.
      const running = /Dev server already running at (http:\/\/[^\s"\\]+)/u
        .exec(output);
      if (running) {
        console.log(`using the running dev server at ${running[1]}`);
        return { baseUrl: running[1], kill() {} };
      }
      throw new Error(`astro dev exited early:\n${output.slice(-1000)}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${devPort}/mercury/`);
      if (response.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill("SIGTERM");
      throw new Error(`astro dev did not come up on ${devPort}:\n${output.slice(-1000)}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return { baseUrl: `http://127.0.0.1:${devPort}`, kill: (signal) => child.kill(signal) };
}
