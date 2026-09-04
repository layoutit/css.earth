import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const configPath = fileURLToPath(new URL(
  "../source/atmosphere/psg-saturn-20260829.cfg",
  import.meta.url,
));
const responsePath = fileURLToPath(new URL(
  "../source/atmosphere/psg-saturn-r240-rif.txt",
  import.meta.url,
));
if (!refresh) {
  await validateSaturnSourceGroup("spectrum");
  console.log("Saturn PSG configuration and raw response match the pinned source manifest.");
  process.exit(0);
}

const seed = `<OBJECT-DATE>2026/08/29 12:00
<OBJECT-NAME>Saturn
<GEOMETRY-REF>User`;
const generator = `<GENERATOR-RANGE1>0.35
<GENERATOR-RANGE2>1.0
<GENERATOR-RANGEUNIT>um
<GENERATOR-RESOLUTION>240
<GENERATOR-RESOLUTIONUNIT>RP
<GENERATOR-RADUNITS>rif
<GENERATOR-GAS-MODEL>Y
<GENERATOR-CONT-MODEL>Y
<GENERATOR-CONT-STELLAR>Y
<GENERATOR-TRANS-SHOW>N
<GENERATOR-TRANS-APPLY>N
<GENERATOR-LOGRAD>N
<GENERATOR-TELESCOPE>SINGLE
<GENERATOR-BEAM>1
<GENERATOR-BEAM-UNIT>diameter
<GENERATOR-DIAMTELE>1
`;
const headers = { "user-agent": "cssEarth Saturn source preparation" };
const expandedResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
  method: "POST",
  headers,
  body: new URLSearchParams({
    type: "cfg",
    wephm: "y",
    watm: "y",
    file: seed,
  }),
});
if (!expandedResponse.ok) {
  throw new Error(`NASA PSG configuration request failed: ${expandedResponse.status}.`);
}
const expanded = `${(await expandedResponse.text()).trimEnd()}\n${generator}`;
const pinnedConfig = await readFile(configPath, "utf8");
if (expanded.trimEnd() !== pinnedConfig.trimEnd()) {
  throw new Error("NASA PSG expanded Saturn configuration drifted from the pinned snapshot.");
}
const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
  method: "POST",
  headers,
  body: new URLSearchParams({
    type: "rad",
    wephm: "n",
    watm: "n",
    file: pinnedConfig,
  }),
});
if (!spectrumResponse.ok) {
  throw new Error(`NASA PSG spectrum request failed: ${spectrumResponse.status}.`);
}
const refreshedRows = spectrumRows(await spectrumResponse.text());
const pinnedRows = spectrumRows(await readFile(responsePath, "utf8"));
if (refreshedRows !== pinnedRows) {
  throw new Error("NASA PSG Saturn spectrum values drifted from the pinned raw response.");
}
console.log("NASA PSG still reproduces the pinned 253 Saturn I/F samples.");

function spectrumRows(value) {
  const rows = value.split("\n").filter((line) => /^\d/.test(line));
  if (rows.length !== 253) {
    throw new Error(`NASA PSG returned ${rows.length} samples instead of 253.`);
  }
  return rows.join("\n");
}
