#!/usr/bin/env node
// Mutation gate for the catalogue sky browser suite: each known perturbation
// of the layer under test (applied by the suite itself at mount, see
// catalog-sky-mutations.mjs) must turn the suite red on a check
// the mutation was designed to trip, and the unmutated suite must be green.
// Any mutation that survives fails the gate by name.
//
// Usage: node src/planets/mercury/test/catalog-sky-mutation-gate.mjs [baseUrl]
//   [--only <id>[,<id>...]]
// Runs against a dev server already serving the site (the suite needs the
// runtime's development diagnostics and the sources served live).

import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { CATALOG_SKY_MUTATIONS as MUTATIONS } from "./catalog-sky-mutations.mjs";

const baseUrl = process.argv.find((argument) => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex === -1 ? null : process.argv[onlyIndex + 1].split(",");
const suite = resolve(import.meta.dirname, "catalog-sky-browser.mjs");

const results = [];
const baseline = await runSuite([]);
results.push({ mutation: null, ok: baseline.ok, failed: baseline.failed });
if (!baseline.ok) console.error(`baseline suite failed: ${baseline.failed.join(", ")}`);
for (const [id, { trips }] of Object.entries(MUTATIONS)) {
  if (only !== null && !only.includes(id)) continue;
  const report = await runSuite(["--mutation", id]);
  const tripped = report.failed.filter((check) => check.startsWith(trips));
  const survived = report.ok || tripped.length === 0;
  results.push({ mutation: id, trips, ok: report.ok, tripped: tripped.length, failed: report.failed.length, survived });
  console.error(`${survived ? "SURVIVED" : "killed"} ${id}: ${tripped.length} of ${report.failed.length} failures on ${trips}*`);
}
const survivors = results.filter((entry) => entry.mutation !== null && entry.survived).map((entry) => entry.mutation);
const ok = baseline.ok && survivors.length === 0;
process.stdout.write(`${JSON.stringify({ gate: "mercury-catalog-sky-mutations", ok, survivors, results })}\n`);
process.exit(ok ? 0 : 1);

function runSuite(extra) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [suite, baseUrl, ...extra], { stdio: ["ignore", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.once("error", reject);
    child.once("exit", () => {
      const lines = stdout.trim().split("\n");
      try {
        resolvePromise(JSON.parse(lines[lines.length - 1]));
      } catch (error) {
        reject(new Error(`The suite printed no report (${extra.join(" ")}): ${error.message}`));
      }
    });
  });
}
