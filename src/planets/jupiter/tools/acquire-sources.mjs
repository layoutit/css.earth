import { resolve } from "node:path";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import { JUPITER_SOURCE_ROOT } from "./preparation-paths.mjs";
import {
  jupiterSourceManifest,
  verifyJupiterSourceManifest,
} from "./source-manifest.mjs";

if (!process.argv.includes("--refresh")) {
  console.log(JSON.stringify(await verifyJupiterSourceManifest(), null, 2));
  process.exit(0);
}

const entriesByPath = new Map(jupiterSourceManifest().inputs.map((entry) =>
  [entry.path, entry]));
const openSpaceCommit = "56e29b54b8592084ff1fef47c2e08de0b22ce516";
const openSpaceRoot =
  `https://raw.githubusercontent.com/OpenSpace/OpenSpace/${openSpaceCommit}/` +
  "data/assets/scene/solarsystem/planets/jupiter";
const directSources = Object.freeze([
  source("presentation/navigation-marker.png",
    "https://science.nasa.gov/wp-content/uploads/2024/03/hubble-jupiter-5jan2024-stsci-01hpmmsxbevgs2hk67vyvnveg5.png"),
  source("openspace/globe.asset", `${openSpaceRoot}/globe.asset`),
  source("openspace/kernels.asset", `${openSpaceRoot}/kernels.asset`),
  source("surface/hubble-jupiter-global-map-2019.png",
    "https://assets.science.nasa.gov/content/dam/science/missions/hubble/releases/2019/08/STScI-01EVSV9A3VN7VYXN5H6Z1GDG93.tif/jcr:content/renditions/Full%20Res.png"),
  source("surface/juno-pia24239-north-pole-detail.tif",
    "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia24/pia24239/PIA24239.tif"),
  source("surface/juno-pia23808-north-polar-projection.jpg",
    "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23808/PIA23808.jpg"),
  source("surface/juno-pia23556-south-polar-cyclones.jpg",
    "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23556/PIA23556.jpg"),
  source("surface/juno-pia21382-south-pole-visible.jpg",
    "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia21/pia21382/PIA21382.jpg"),
  source("lenses/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_f275w_v1_globalmap.fits",
    "https://archive.stsci.edu/missions/hlsp/opal/cycle32/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_f275w_v1_globalmap.fits"),
  source("lenses/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_fq889n_v1_globalmap.fits",
    "https://archive.stsci.edu/missions/hlsp/opal/cycle32/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_fq889n_v1_globalmap.fits"),
  source("moons/jpl-physical-parameters.html",
    "https://ssd.jpl.nasa.gov/sats/phys_par/sep.html"),
  source("moons/jpl-mean-elements.html",
    "https://ssd.jpl.nasa.gov/sats/elem/sep.html"),
  source("moons/galilean-satellites-pia01299.jpg",
    "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia01/pia01299/PIA01299.jpg?crop=faces%2Cfocalpoint&fit=clip&h=635&w=1870"),
  source("rings/pds-jupiter-rings-table.html",
    "https://pds-rings.seti.org/jupiter/jupiter_rings_table.html"),
  source("rings/pds-pia00701.html",
    "https://pds-rings.seti.org/jupiter/galileo/PIA00701.html"),
  source("rings/pds-pia01623.html",
    "https://pds-rings.seti.org/jupiter/galileo/PIA01623.html"),
  source("rings/pia00701.jpg",
    "https://pds-rings.seti.org/jupiter/galileo/PIA00701-med.jpg"),
]);

const selectedSources = process.argv.includes("--rings-only")
  ? directSources.filter(({ path }) => path.startsWith("rings/"))
  : process.argv.includes("--polar-only")
    ? directSources.filter(({ path }) =>
      path.startsWith("surface/juno-pia"))
    : directSources;
for (const entry of selectedSources) {
  await publishSource(entry.path, await fetchBytes(entry.url, entry.path));
}
if (!process.argv.includes("--rings-only") &&
    !process.argv.includes("--polar-only")) await acquirePsgAtmosphere();
console.log(JSON.stringify(await verifyJupiterSourceManifest(), null, 2));

async function acquirePsgAtmosphere() {
  const seed = `<OBJECT-DATE>2026/08/30 12:00
<OBJECT-NAME>Jupiter
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
  const headers = { "user-agent": "cssEarth Jupiter source preparation" };
  const expandedResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!expandedResponse.ok) {
    throw new Error(`NASA PSG Jupiter configuration failed: ${expandedResponse.status}.`);
  }
  const configuration = `${(await expandedResponse.text()).trimEnd()}\n${generator}`;
  const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({
      type: "rad",
      wephm: "n",
      watm: "n",
      file: configuration,
    }),
  });
  if (!spectrumResponse.ok) {
    throw new Error(`NASA PSG Jupiter spectrum failed: ${spectrumResponse.status}.`);
  }
  await Promise.all([
    publishSource("atmosphere/psg-jupiter-20260830.cfg", Buffer.from(configuration)),
    publishSource(
      "atmosphere/psg-jupiter-r240-rif.txt",
      Buffer.from(await spectrumResponse.text()),
    ),
  ]);
}

async function fetchBytes(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "cssEarth Jupiter source preparation" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
      }
    }
  }
  throw new Error(`Jupiter source failed for ${label}`, { cause: lastError });
}

async function publishSource(path, bytes) {
  const entry = entriesByPath.get(path);
  if (!entry) throw new Error(`Jupiter acquisition path is not declared: ${path}.`);
  await publishSourceBytes({
    destination: resolve(JUPITER_SOURCE_ROOT, path),
    bytes,
    entry,
    planetName: "Jupiter",
  });
}

function source(path, url) {
  return Object.freeze({ path, url });
}
