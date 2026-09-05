#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { expectedGlobalCityFace, validateGlobalCityFaceReceipt } from "./city/global-face-receipts.mjs";
import { cityCoverageRoots, planCityCoverage } from "./city/plan-coverage.mjs";
import { readWorldCoverCatalog } from "./city/worldcover-catalog.mjs";

const root = resolve(import.meta.dirname, "../../../..");
const directory = resolve(root, "output/earth-city/global-faces");
const source = JSON.parse(await readFile(resolve(import.meta.dirname,
  "../source/city/manifest.json"), "utf8"));
const { pin, entries } = await readWorldCoverCatalog();
const expected = new Map(cityCoverageRoots().map(face => {
  const jobs = [...planCityCoverage(PREPARED_EARTH_SCENE, entries, [face])];
  const planned = expectedGlobalCityFace(face, jobs);
  return [planned.face.key, planned];
}).filter(([, face]) => face.jobs));
const receipts = new Map();
for (const filename of await readdir(directory).catch(error => error.code === "ENOENT" ? [] : Promise.reject(error))) {
  if (!/^0-\d+-\d+\.json$/u.test(filename)) throw new Error(`Unknown global city receipt: ${filename}`);
  const receipt = JSON.parse(await readFile(resolve(directory, filename), "utf8"));
  const key = filename.slice(0, -5), face = expected.get(key);
  if (!face) throw new Error(`Unexpected global city face receipt: ${key}`);
  receipts.set(key, validateGlobalCityFaceReceipt(receipt, face, source, pin.expectedSha256));
}
const missing = [...expected.keys()].filter(key => !receipts.has(key));
const nextLimitArgument = process.argv.find(argument => argument.startsWith("--next="));
const nextLimit = nextLimitArgument ? Number(nextLimitArgument.slice(7)) : 10;
if (!Number.isInteger(nextLimit) || nextLimit < 1 || nextLimit > expected.size) {
  throw new TypeError(`--next must be an integer from 1 through ${expected.size}.`);
}
if (process.argv.includes("--verify-heads")) {
  for (const receipt of receipts.values()) {
    const head = receipt.heads[0].directory;
    const response = await fetch(head.url, { method: "HEAD",
      headers: { Origin: "https://css.earth", "Accept-Encoding": "identity" } });
    if (!response.ok || Number(response.headers.get("content-length")) !== head.bytes ||
        response.headers.get("access-control-allow-origin") !== "https://css.earth") {
      throw new Error(`Published global city head is unavailable: ${receipt.face.key}`);
    }
  }
}
const plannedPages = [...expected.values()].reduce((sum, face) => sum + face.pages, 0);
const completedPages = [...receipts.values()].reduce((sum, receipt) => sum + receipt.pages, 0);
const report = { schema: "cssearth-earth-city-global-status@1", dataset: source.dataset,
  catalogSha256: pin.expectedSha256, expectedFaces: expected.size, completedFaces: receipts.size,
  missingFaces: missing.length, completedPages, plannedPages,
  plannedPageCompletionPercent: 100 * completedPages / plannedPages,
  progressQualification: "Prepared-page work completed, not measured land-area or valid-pixel coverage.",
  completedObjects: [...receipts.values()].reduce((sum, receipt) => sum + receipt.publish.objects, 0),
  completedBytes: [...receipts.values()].reduce((sum, receipt) => sum + receipt.publish.bytes, 0),
  // Smallest-first selected mostly sparse islands and coastal fragments.
  // Prefer source-dense blocks; region counts are not an area coverage metric.
  nextFacePriority: "Most planned source-backed pages first",
  nextFaces: missing.map(key => expected.get(key)).sort((a, b) => b.pages - a.pages ||
    a.face.y - b.face.y || a.face.x - b.face.x)
    .slice(0, nextLimit).map(({ face, jobs, pages }) => ({ key: face.key, jobs, pages })),
  headsVerified: process.argv.includes("--verify-heads") };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--require-complete") && missing.length) process.exitCode = 1;
