#!/usr/bin/env node
import { spawn } from "node:child_process";

// Pass one explicit server URL through every existing browser gate. This lets
// isolated worktrees test their own server without touching another checkout.
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
for (const args of [
  ["site/test/object-runtime-browser.mjs", baseUrl],
  ["site/test/prepared-camera-browser.mjs", baseUrl],
  ["site/test/smoke-browser.mjs", baseUrl],
  ["site/test/planet-introduction-browser.mjs", baseUrl],
  ["site/test/object-navigation-browser.mjs", baseUrl],
  ["site/test/explorer-rail-browser.mjs", baseUrl],
  ["site/test/shell-layout-browser.mjs", baseUrl],
  ["site/test/planet-browser-conformance.mjs", baseUrl],
  ["site/test/runtime-playback-browser.mjs", baseUrl],
  ["site/test/runtime-complex-browser.mjs", baseUrl],
  ["site/test/runtime-bfcache-browser.mjs", baseUrl],
  ["tools/run-implemented-planets.mjs", "browser", baseUrl],
  ["src/planets/earth/test/selection-cards-browser.mjs", baseUrl],
]) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${args[0]} failed: ${signal ?? code}`)));
  });
}
