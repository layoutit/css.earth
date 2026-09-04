import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  assertSaturnSourceBytes,
  saturnSourceManifest,
  verifySaturnSourceManifest,
} from "./source-manifest.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(objectRoot, "source/lenses");
const OPAL_ROOT =
  "https://archive.stsci.edu/missions/hlsp/opal/cycle32/saturn";

const sources = Object.freeze([
  Object.freeze({
    id: "opal-2025a-f225w",
    filename: "hlsp_opal_hst_wfc3-uvis_saturn-2025a_f225w_v1_globalmap.fits",
    url: `${OPAL_ROOT}/hlsp_opal_hst_wfc3-uvis_saturn-2025a_f225w_v1_globalmap.fits`,
    sha256: "501c88e880a65a009fea9d86b66fe4b824abc0a07a56c0f382abe593cc08f314",
  }),
  Object.freeze({
    id: "opal-2025b-f225w",
    filename: "hlsp_opal_hst_wfc3-uvis_saturn-2025b_f225w_v1_globalmap.fits",
    url: `${OPAL_ROOT}/hlsp_opal_hst_wfc3-uvis_saturn-2025b_f225w_v1_globalmap.fits`,
    sha256: "0a1e41e4f4de7bb0a026d29b303dfbcf55f902382c2e621dfd522d95881c75d3",
  }),
  Object.freeze({
    id: "opal-2025a-fq889n",
    filename: "hlsp_opal_hst_wfc3-uvis_saturn-2025a_fq889n_v1_globalmap.fits",
    url: `${OPAL_ROOT}/hlsp_opal_hst_wfc3-uvis_saturn-2025a_fq889n_v1_globalmap.fits`,
    sha256: "2913da896d5e33c292d8c7a95a699cee606067b743b0bb2cab06ce51be90af53",
  }),
  Object.freeze({
    id: "opal-2025b-fq889n",
    filename: "hlsp_opal_hst_wfc3-uvis_saturn-2025b_fq889n_v1_globalmap.fits",
    url: `${OPAL_ROOT}/hlsp_opal_hst_wfc3-uvis_saturn-2025b_fq889n_v1_globalmap.fits`,
    sha256: "709166ace6d89028ef8ab884323f0d886281054dac2378584f82ce2c5f90e459",
  }),
]);
const references = Object.freeze([
  Object.freeze({
    id: "cassini-vims-pia17469",
    url: "https://science.nasa.gov/photojournal/high-contrast-infrared-scan-of-saturn-and-its-rings/",
    instrument: "Cassini VIMS",
    wavelengthBandsMicrometers: Object.freeze([
      Object.freeze([1.19, 1.5]),
      Object.freeze([1.9, 2.1]),
      Object.freeze([4.88, 5.06]),
    ]),
    use: "thermal palette, internal-heat interpretation, and ring response reference",
  }),
  Object.freeze({
    id: "cassini-cirs-thermal-mapping",
    url: "https://science.nasa.gov/mission/cassini/spacecraft/cassini-orbiter/composite-infrared-spectrometer/",
    instrument: "Cassini CIRS",
    wavelengthRangeMicrometers: Object.freeze([7, 1000]),
    use: "atmospheric and ring temperature interpretation",
  }),
]);
const sourceManifest = saturnSourceManifest();
const entriesByPath = new Map([
  ...sourceManifest.inputs,
  ...sourceManifest.generatedIntermediates,
].map((entry) => [entry.path, entry]));

if (process.argv.includes("--verify-only")) {
  await verifySaturnSourceManifest();
  console.log("Verified the pinned Saturn observation lens sources.");
  process.exit(0);
}

await mkdir(outputRoot, { recursive: true });
for (const source of sources) await acquire(source);
await publish("lenses/manifest.json", Buffer.from(`${JSON.stringify({
    schema: "csssaturn-observation-lens-sources@1",
    sources,
    references,
  }, null, 2)}\n`));
await verifySaturnSourceManifest();
console.log(
  `Verified ${sources.length} Hubble OPAL sources and ${references.length} Cassini references.`,
);

async function acquire(source) {
  const outputPath = resolve(outputRoot, source.filename);
  const path = `lenses/${source.filename}`;
  const entry = entriesByPath.get(path);
  if (!entry || entry.expectedSha256 !== source.sha256) {
    throw new Error(`${source.id} does not match the Saturn source manifest.`);
  }
  try {
    const existing = await readFile(outputPath);
    assertSaturnSourceBytes(entry, existing);
    return;
  } catch (error) {
    if (error?.code !== "ENOENT" && !/source (?:size|hash) drifted/u.test(error.message)) {
      throw error;
    }
  }
  const response = await fetch(source.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${source.id} download failed with HTTP ${response.status}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await publish(path, bytes);
}

async function publish(path, bytes) {
  const entry = entriesByPath.get(path);
  if (!entry) throw new Error(`Saturn acquisition path is not declared: ${path}.`);
  await publishSourceBytes({
    destination: resolve(objectRoot, "source", path),
    bytes,
    entry,
    planetName: "Saturn",
  });
}
