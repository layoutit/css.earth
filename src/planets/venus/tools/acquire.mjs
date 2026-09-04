#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const manifest = JSON.parse(await readFile(resolve(sourceRoot, "manifest.json")));
const entries = new Map([
  ...manifest.inputs,
  ...manifest.documents,
].map((entry) => [entry.path, entry]));
const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
const refreshStarfield = process.argv.includes("--refresh-starfield");
const refreshStarfieldPhoto = process.argv.includes("--refresh-starfield-photo");
const previewStarfield = process.argv.find((argument) =>
  argument.startsWith("--preview-starfield="));
if ([refresh, verifyOnly, refreshStarfield, refreshStarfieldPhoto,
  Boolean(previewStarfield)]
  .filter(Boolean).length > 1) {
  throw new TypeError(
    "Venus acquisition accepts one refresh, preview, or verification mode.",
  );
}

if (refresh) {
  await Promise.all([
    acquireUrl("navigation/venus.webp",
      "https://science.nasa.gov/wp-content/uploads/2023/05/688-venus-1200-jpg.webp"),
    acquireUrl("venera/venera9.gif",
      "https://pds-geosciences.wustl.edu/venera/GIF/venera9.gif"),
    acquireUrl("venera/venera10.gif",
      "https://pds-geosciences.wustl.edu/venera/GIF/venera10.gif"),
    acquireUrl("venera/venera13.jpg",
      "https://pds-geosciences.wustl.edu/venera/JPEG/venera13.jpg"),
    acquireUrl("venera/venera14.jpg",
      "https://pds-geosciences.wustl.edu/venera/JPEG/venera14.jpg"),
    acquireUrl("surface/venus-clouds.jpg",
      "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/venus/textures/2/venus_clouds.jpg"),
    acquireOpenSpace("openspace/globe.asset",
      "data/assets/scene/solarsystem/planets/venus/globe.asset"),
    acquireOpenSpace("openspace/atmosphere.asset",
      "data/assets/scene/solarsystem/planets/venus/atmosphere.asset"),
    acquireOpenSpace("openspace/clouds.asset",
      "data/assets/scene/solarsystem/planets/venus/layers/colorlayers/clouds_magellan_combo_newyork.asset"),
    acquireOpenSpace("openspace/radar.wms",
      "data/assets/scene/solarsystem/planets/venus/layers/colorlayers/magellan_mosaic_newyork.wms"),
    acquireOpenSpace("openspace/dem.wms",
      "data/assets/scene/solarsystem/planets/venus/layers/heightlayers/magellan_newyork.wms"),
    acquireUsgsWms(
      "surface/venus-magellan-color-wms.png",
      "MAGELLAN_color",
    ),
    acquireUsgsWms(
      "surface/venus-magellan-topography-wms.png",
      "MAGELLAN_topography",
    ),
    prepareVenusStarSource(),
    acquireEsoStarfieldPhoto(),
  ]);
  await verifyPsgRefresh();
} else if (refreshStarfield) {
  await prepareVenusStarSource();
} else if (refreshStarfieldPhoto) {
  await acquireEsoStarfieldPhoto();
} else if (previewStarfield) {
  const destination = previewStarfield.slice("--preview-starfield=".length);
  if (!destination) throw new TypeError("Venus starfield preview path is empty.");
  const bytes = await prepareVenusStarSourceBytes();
  await writeFile(destination, bytes);
  console.log(JSON.stringify({
    preview: destination,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }));
}

const { verifyVenusSourceManifest } = await import("./source-manifest.mjs");
console.log(JSON.stringify(await verifyVenusSourceManifest(), null, 2));

async function acquireOpenSpace(path, repositoryPath) {
  return acquireUrl(path,
    "https://raw.githubusercontent.com/OpenSpace/OpenSpace/" +
    "56e29b54b8592084ff1fef47c2e08de0b22ce516/" + repositoryPath);
}

async function acquireUrl(path, url) {
  const response = await fetch(url, {
    headers: { "user-agent": "cssEarth Venus source preparation" },
  });
  if (!response.ok) throw new Error(`Venus source request failed: ${url} (${response.status}).`);
  return publish(path, Buffer.from(await response.arrayBuffer()));
}

function acquireUsgsWms(path, layer) {
  const query = new URLSearchParams({
    map: "/maps/venus/venus_simp_cyl.map",
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer,
    STYLES: "",
    SRS: "EPSG:4326",
    BBOX: "-180,-90,180,90",
    WIDTH: "2048",
    HEIGHT: "1024",
    FORMAT: "image/png",
    TRANSPARENT: "FALSE",
  });
  return acquireUrl(
    path,
    `https://planetarymaps.usgs.gov/cgi-bin/mapserv?${query}`,
  );
}

async function prepareVenusStarSource() {
  const path = "stars/hyg-v41-field.json";
  return publish(path, await prepareVenusStarSourceBytes());
}

function acquireEsoStarfieldPhoto() {
  return acquireUrl(
    "stars/eso0932a.tif",
    "https://cdn.eso.org/images/original/eso0932a.tif",
  );
}

async function prepareVenusStarSourceBytes() {
  const path = "stars/hyg-v41-field.json";
  const template = JSON.parse(await readFile(resolve(sourceRoot, path), "utf8"));
  if (!["cssvenus-prepared-star-source@1",
    "cssvenus-prepared-star-cubemap-source@1"].includes(template.schema) ||
      template.source?.license !== "CC-BY-SA-4.0" ||
      typeof template.source?.sourceUrl !== "string" ||
      !/^[0-9a-f]{64}$/u.test(template.source?.sha256 ?? "")) {
    throw new TypeError("Venus HYG source template is incompatible.");
  }
  const response = await fetch(template.source.sourceUrl, {
    headers: { "user-agent": "cssEarth Venus source preparation" },
  });
  if (!response.ok) {
    throw new Error(`Venus HYG request failed: ${response.status}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== template.source.sha256) {
    throw new Error("Venus HYG catalog bytes drifted from the pinned source.");
  }
  const rows = bytes.toString("utf8").trimEnd().split("\n");
  if (rows.length - 1 !== template.source.catalogRows) {
    throw new Error("Venus HYG catalog row count drifted.");
  }
  const prepared = prepareCubemapStarField(template, rows.slice(1));
  return Buffer.from(`${JSON.stringify(prepared, null, 2)}\n`);
}

function prepareCubemapStarField(template, rows) {
  const selectedStarCount = 60_000;
  const stars = [];
  for (const row of rows) {
    const fields = parseCsvRow(row);
    if (fields[0] === "0") continue;
    const rightAscensionHours = Number(fields[7]);
    const declinationDegrees = Number(fields[8]);
    const magnitude = Number(fields[13]);
    const colorIndex = Number(fields[16]);
    if (![rightAscensionHours, declinationDegrees, magnitude].every(Number.isFinite)) {
      continue;
    }
    stars.push([
      Number(fields[0]),
      Number((rightAscensionHours * 15).toFixed(7)),
      Number(declinationDegrees.toFixed(7)),
      Number(magnitude.toFixed(3)),
      Number.isFinite(colorIndex) ? Number(colorIndex.toFixed(3)) : 0.65,
    ]);
  }
  stars.sort((left, right) => left[3] - right[3] || left[0] - right[0]);
  const selected = stars.slice(0, selectedStarCount);
  if (selected.length !== selectedStarCount) {
    throw new Error("Venus HYG catalog does not contain the prepared sky population.");
  }
  return {
    schema: "cssvenus-prepared-star-cubemap-source@1",
    source: template.source,
    projection: {
      model: "prepared-equatorial-cubemap",
      coordinateSystem: "ICRS equatorial catalog coordinates",
      centerRaDegrees: 40,
      centerDecDegrees: 7,
      faceOrder: ["front", "right", "back", "left", "top", "bottom"],
      qualification:
        "catalog-derived static full sky; orientation is illustrative because " +
        "the Venus scene has no absolute observer epoch or inertial camera orientation",
    },
    presentation: {
      faceSize: 1024,
      candidateStars: stars.length,
      selectedStars: selected.length,
      selection: "brightest apparent magnitude across the complete catalog sphere",
      brightestMagnitude: selected[0][3],
      faintestMagnitude: selected.at(-1)[3],
      pointOpacity: 0.78,
      densityGlow:
        "prepared broad galactic-plane context derived from selected ICRS positions",
    },
    starColumns: [
      "catalogId",
      "rightAscensionDegrees",
      "declinationDegrees",
      "apparentMagnitude",
      "colorIndexBv",
    ],
    stars: selected,
  };
}

function parseCsvRow(row) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

async function publish(path, bytes) {
  const entry = entries.get(path);
  if (!entry) throw new Error(`Venus acquisition path is undeclared: ${path}.`);
  return publishSourceBytes({
    destination: resolve(sourceRoot, path),
    bytes,
    entry,
    planetName: "Venus",
  });
}

async function verifyPsgRefresh() {
  const seed = `<OBJECT-DATE>2026/08/30 12:00\n<OBJECT-NAME>Venus\n<GEOMETRY-REF>User`;
  const generator = `<GENERATOR-RANGE1>0.35\n<GENERATOR-RANGE2>1.0\n<GENERATOR-RANGEUNIT>um\n<GENERATOR-RESOLUTION>240\n<GENERATOR-RESOLUTIONUNIT>RP\n<GENERATOR-RADUNITS>rif\n<GENERATOR-GAS-MODEL>Y\n<GENERATOR-CONT-MODEL>Y\n<GENERATOR-CONT-STELLAR>Y\n<GENERATOR-TRANS-SHOW>N\n<GENERATOR-TRANS-APPLY>N\n<GENERATOR-LOGRAD>N\n<GENERATOR-TELESCOPE>SINGLE\n<GENERATOR-BEAM>1\n<GENERATOR-BEAM-UNIT>diameter\n<GENERATOR-DIAMTELE>1\n`;
  const headers = { "user-agent": "cssEarth Venus source preparation" };
  const configurationResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!configurationResponse.ok) {
    throw new Error(`NASA PSG configuration request failed: ${configurationResponse.status}.`);
  }
  const generatedConfiguration = `${(await configurationResponse.text()).trimEnd()}\n${generator}`;
  const pinnedConfiguration = await readFile(
    resolve(sourceRoot, "atmosphere/psg-venus-20260830.cfg"),
    "utf8",
  );
  if (generatedConfiguration.trimEnd() !== pinnedConfiguration.trimEnd()) {
    throw new Error("NASA PSG expanded Venus configuration drifted from the pinned snapshot.");
  }
  const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({
      type: "rad",
      wephm: "n",
      watm: "n",
      file: pinnedConfiguration,
    }),
  });
  if (!spectrumResponse.ok) {
    throw new Error(`NASA PSG spectrum request failed: ${spectrumResponse.status}.`);
  }
  const currentRows = spectrumRows(await spectrumResponse.text());
  const pinnedRows = spectrumRows(await readFile(
    resolve(sourceRoot, "atmosphere/psg-venus-r240-rif.txt"),
    "utf8",
  ));
  if (currentRows !== pinnedRows) {
    throw new Error("NASA PSG Venus spectrum values drifted from the pinned raw response.");
  }
}

function spectrumRows(value) {
  const rows = value.split("\n").filter((line) => /^\d/u.test(line));
  if (rows.length !== 253) {
    throw new Error(`NASA PSG returned ${rows.length} samples instead of 253.`);
  }
  return rows.join("\n");
}
