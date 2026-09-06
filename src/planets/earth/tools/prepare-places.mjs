#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareDestinationPacks } from "../../../../tools/prepare-destination-packs.mjs";
import { normalizeDestinationQuery } from "../../../../site/destination-search.mjs";
import { PREPARED_GEOGRAPHIC_LENSES } from "../runtime/preparedGeographicLenses.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { prepareLocationPoint, prepareLocationCamera } from "./city/prepare-location.mjs";
import { readWorldCoverCatalog } from "./city/worldcover-catalog.mjs";
import { prepareWmtsCoverage } from "./city/wmts-coverage.mjs";
import { coverageLookup } from "./city/prepare-wmts-tree.mjs";
import { wmtsAddress } from "./city/wmts-page-geometry.mjs";
import { EARTH_PUBLIC_ROOT, ensureEarthPreparationDirectories } from "./preparation-paths.mjs";

export async function preparePlaceCatalog({ verifyOnly = false } = {}) {
const source = new URL("../source/places/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", source), "utf8"));
for (const entry of manifest.inputs) {
  const bytes = await readFile(new URL(entry.path, source));
  if (bytes.length !== entry.bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
    throw new Error(`GeoNames source snapshot drifted: ${entry.path}`);
  }
}
if (verifyOnly) return null;
const lines = value => value.split(/\r?\n/u).filter(line => line && !line.startsWith("#")).map(line => line.split("\t"));
const countryRows = lines(await readFile(new URL("countryInfo.txt", source), "utf8"));
const countries = new Map(countryRows.map(row => [row[0], row[4]]));
const countryGeometry = JSON.parse(await readFile(new URL("ne_110m_admin_0_countries.geojson", source), "utf8"));
const formatNumber = value => Number(value).toLocaleString("en-US");
const countryPlaces = countryGeometry.features.flatMap(feature => {
  const properties = feature.properties;
  const row = countryRows.find(row => row[0] === properties.ISO_A2_EH);
  if (!row) return [];
  const latitude = properties.LABEL_Y, longitude = properties.LABEL_X;
  // Frame the source's principal landmass. These are navigation views, not borders.
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const bounds = polygons.map(polygon => {
    const points = polygon[0].map(([lon, lat]) => [longitude + ((lon - longitude + 540) % 360 - 180), lat]);
    return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  }).sort((a, b) => (b[2]-b[0])*(b[3]-b[1]) - (a[2]-a[0])*(a[3]-a[1]));
  const [west, south, east, north] = bounds[0];
  const span = Math.max(north - south, (east - west) * Math.cos(latitude * Math.PI / 180));
  return [{ id: `country:${row[0]}`, kind: "country", kindLabel: "Country / region", status: "Country overview · Natural Earth", name: row[4], context: properties.CONTINENT,
    identifiers: { geonames: row[16], ...(/^Q[1-9]\d*$/u.test(properties.WIKIDATAID) ? { wikidata: properties.WIKIDATAID } : {}) },
    names: [...new Set([row[4], row[0], row[1], properties.NAME_LONG, ...Object.entries(properties).filter(([key]) => key.startsWith("NAME_")).map(([,value]) => value)].filter(value => typeof value === "string").map(normalizeDestinationQuery))],
    searchContext: normalizeDestinationQuery(properties.CONTINENT), population: Number(row[7]), latitude, longitude,
    camera: prepareLocationCamera(PREPARED_EARTH_SCENE, prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude), Math.max(1.5, Math.min(64, 95 / span))),
    coverage: "overview", parentId: "earth", facts: [{label:"Capital",value:row[5] || "—"},{label:"Population",value:formatNumber(row[7])},{label:"Area",value:`${formatNumber(row[6])} km²`}],
  }];
});
const countryIds = new Set(countryPlaces.map(place => place.id));
const regions = new Map(lines(await readFile(new URL("admin1CodesASCII.txt", source), "utf8")).map(row => [row[0], row[1]]));
const worldcover = await readWorldCoverCatalog();
const hasTile=coverageLookup([prepareWmtsCoverage([...worldcover.entries.values()],14,{includePolar:true})]);
const rows = lines(execFileSync("unzip", ["-p", fileURLToPath(new URL("cities15000.zip", source)), "cities15000.txt"], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 }));
const places = rows.map(row => {
  if (row.length !== 19 || row[6] !== "P") throw new Error("Invalid GeoNames city record.");
  const latitude = Number(row[4]), longitude = Number(row[5]);
  const country = countries.get(row[8]) ?? row[8];
  const region = regions.get(`${row[8]}.${row[10]}`);
  const context = [...new Set([region, country].filter(Boolean))].join(", ");
  const point = prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude);
  const coverage = Math.abs(latitude)<=85.0511287798066 && hasTile(wmtsAddress(longitude,latitude,14)) ? "detail" : "overview";
  return {
    id: row[0], kind: "city", kindLabel: "City", name: row[1], context,
    identifiers: { geonames: row[0] },
    parentId: countryIds.has(`country:${row[8]}`) ? `country:${row[8]}` : "earth",
    facts: [{ label: "Population", value: formatNumber(row[14]) }, { label: "Coordinates", value: `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? "S" : "N"}, ${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? "W" : "E"}` }],
    names: [...new Set([row[1], row[2], ...row[3].split(",")].map(normalizeDestinationQuery).filter(Boolean))],
    searchContext: normalizeDestinationQuery(`${context} ${row[8]}`),
    population: Number(row[14]), latitude, longitude,
    camera: prepareLocationCamera(PREPARED_EARTH_SCENE, point, coverage === "detail" ? 1024 : 8),
    coverage,
  };
}).sort((a, b) => b.population - a.population || Number(a.id) - Number(b.id));
if (new Set(places.map(place => place.id)).size !== places.length || places.length < 20000) throw new Error("Incomplete city catalogue.");
places.push(...countryPlaces);
for (const entity of places) {
  entity.lenses = PREPARED_GEOGRAPHIC_LENSES.filter(entry => entry.entityIds.includes(entity.id)).map(entry => entry.lens);
  entity.lensIds = [objectControls.lenses.defaultLens, ...entity.lenses.map(lens => lens.id)];
  entity.resources = [{label:"GeoNames",description:"Names and recorded facts · September 2026 snapshot",href:manifest.sourcePage}];
  if (entity.kind === "country") entity.resources.push({label:"Natural Earth",description:"Country overview · 1:110m navigation geometry",href:"https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/"});
  entity.facts = entity.facts.map((fact,index) => ({id:`${entity.id}:${index}`, ...fact}));
}
const catalog = { schema: "cssearth-prepared-destinations@1", rootId: "earth", source: manifest.source,
  snapshotDate: manifest.snapshotDate, qualification: manifest.qualification, places };
return catalog;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const catalog = await preparePlaceCatalog({ verifyOnly: process.argv.includes("--verify-only") });
  if (!catalog) console.log("Verified pinned GeoNames place sources.");
  else {
    const prepared = prepareDestinationPacks(catalog, "/scenes/earth/");
    await ensureEarthPreparationDirectories();
    for (const [url, bytes] of prepared.outputs) await writeFile(`${EARTH_PUBLIC_ROOT}/${url.split("/").at(-1)}`, bytes);
    await writeFile(new URL("../runtime/preparedPlaces.mjs", import.meta.url),
      `// Generated by prepare-places.mjs from pinned source records.\nexport const PREPARED_EARTH_PLACES = Object.freeze(${JSON.stringify(prepared.reference)});\nexport const PREPARED_EARTH_PLACE_ASSETS = Object.freeze(${JSON.stringify([...prepared.outputs.keys()])});\n`);
    console.log(JSON.stringify(prepared.receipt, null, 2));
  }
}
