#!/usr/bin/env node
import { writeFile, readFile, readdir, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
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
import { readPlaceSources, sourceRows } from "./place-sources.mjs";
import { prepareAdministrativePlaces } from "./prepare-administrative-places.mjs";
import { EARTH_PUBLIC_ROOT, EARTH_STAGING_ROOT, ensureEarthPreparationDirectories } from "./preparation-paths.mjs";

export async function preparePlaceCatalog({ verifyOnly = false, onReceipt } = {}) {
const { manifest, sources } = await readPlaceSources();
if (verifyOnly) return null;
const countryRows = sourceRows(sources.get("countryInfo.txt"));
const adminRows = sourceRows(sources.get("admin1CodesASCII.txt"));
const administrative = prepareAdministrativePlaces({ countryRows, adminRows,
  records: new Map(sourceRows(sources.get("administrative-records.tsv.gz")).map(row => [row[0], row])),
  legacyCountryFeatures: JSON.parse(sources.get("ne_110m_admin_0_countries.geojson")).features,
  countryFeatures: JSON.parse(sources.get("shapes_simplified_low.json.zip")).features,
  adminFeatures: JSON.parse(sources.get("ne_10m_admin_1_states_provinces.geojson.gz")).features,
  scene: PREPARED_EARTH_SCENE });
const { receipt } = administrative;
receipt.unresolvedCityParents = [];
const formatNumber = value => Number(value).toLocaleString("en-US");
const worldcover = await readWorldCoverCatalog();
const hasTile=coverageLookup([prepareWmtsCoverage([...worldcover.entries.values()],14,{includePolar:true})]);
const rows = sourceRows(sources.get("cities15000.zip"));
const places = rows.map(row => {
  if (row.length !== 19 || row[6] !== "P") throw new Error("Invalid GeoNames city record.");
  const latitude = Number(row[4]), longitude = Number(row[5]);
  const countryEntity = administrative.countries.get(row[8]);
  const regionEntity = administrative.admins.get(`${row[8]}.${row[10]}`);
  const country = countryEntity?.name ?? row[8];
  const region = regionEntity?.name;
  if (!countryEntity || (!regionEntity && row[10] && row[10] !== "00")) receipt.unresolvedCityParents.push({ id: row[0], countryCode: row[8], admin1Code: row[10], reason: countryEntity ? "ADM1 code absent from pinned table" : "Country code absent from pinned table" });
  const context = [...new Set([region, country].filter(Boolean))].join(", ");
  const point = prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude);
  const coverage = Math.abs(latitude)<=85.0511287798066 && hasTile(wmtsAddress(longitude,latitude,14)) ? "detail" : "overview";
  return {
    id: row[0], kind: "city", kindLabel: "City", name: row[1], context,
    identifiers: { geonames: row[0] },
    parentId: regionEntity?.id ?? countryEntity?.id ?? "earth",
    facts: [{ label: "Population", value: formatNumber(row[14]) }, { label: "Coordinates", value: `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? "S" : "N"}, ${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? "W" : "E"}` }],
    names: [...new Set([row[1], row[2], ...row[3].split(",")].map(normalizeDestinationQuery).filter(Boolean))],
    searchContext: normalizeDestinationQuery(`${context} ${row[8]}`),
    population: Number(row[14]), latitude, longitude,
    camera: prepareLocationCamera(PREPARED_EARTH_SCENE, point, coverage === "detail" ? 1024 : 8),
    coverage,
  };
}).sort((a, b) => b.population - a.population || Number(a.id) - Number(b.id));
if (new Set(places.map(place => place.id)).size !== places.length || places.length < 20000) throw new Error("Incomplete city catalogue.");
receipt.cities = places.length;
places.push(...administrative.places);
for (const entity of places) {
  entity.lenses = PREPARED_GEOGRAPHIC_LENSES.filter(entry => entry.entityIds.includes(entity.id)).map(entry => entry.lens);
  entity.lensIds = [objectControls.lenses.defaultLens, ...entity.lenses.map(lens => lens.id)];
  entity.resources = [{label:"GeoNames",description:"Names and recorded facts · September 2026 snapshot",href:manifest.sourcePage}];
  if (entity.navigation?.source.startsWith("Natural Earth")) entity.resources.push({label:"Natural Earth",description:`${entity.kind === "admin1" ? "Region" : "Country"} navigation geometry · public domain`,href:entity.kind === "admin1" ? "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/" : "https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/"});
  entity.facts = entity.facts.map((fact,index) => ({id:`${entity.id}:${index}`, ...fact}));
}
const catalog = { schema: "cssearth-prepared-destinations@1", rootId: "earth", source: manifest.source,
  snapshotDate: manifest.snapshotDate, administrativeSnapshotDate: manifest.administrativeSnapshotDate,
  qualification: manifest.qualification, places };
// Keep the full join report out of browser packs; it is preparation evidence.
if (onReceipt) onReceipt(receipt);
return catalog;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let hierarchy;
  const catalog = await preparePlaceCatalog({ verifyOnly: process.argv.includes("--verify-only"), onReceipt: value => { hierarchy = value; } });
  if (!catalog) console.log("Verified pinned GeoNames place sources.");
  else {
    const prepared = prepareDestinationPacks(catalog, "/scenes/earth/");
    await ensureEarthPreparationDirectories();
    for (const [url, bytes] of prepared.outputs) await writeFile(`${EARTH_PUBLIC_ROOT}/${url.split("/").at(-1)}`, bytes);
    await writeFile(new URL("../runtime/preparedPlaces.mjs", import.meta.url),
      `// Generated by prepare-places.mjs from pinned source records.\nexport const PREPARED_EARTH_PLACES = Object.freeze(${JSON.stringify(prepared.reference)});\nexport const PREPARED_EARTH_PLACE_ASSETS = Object.freeze(${JSON.stringify([...prepared.outputs.keys()])});\n`);
    // Keep public/ an exact current closure without deleting retired versions.
    // Only this preparer's hash-addressed destination packs can be archived.
    const archive = `${EARTH_STAGING_ROOT}/retired-destinations`;
    await mkdir(archive, { recursive: true });
    for (const filename of await readdir(EARTH_PUBLIC_ROOT)) {
      const match = /^destinations-(?:directory|search|details)-([a-f0-9]{16})\.pack$/u.exec(filename);
      if (!match || prepared.outputs.has(`/scenes/earth/${filename}`)) continue;
      const bytes = await readFile(`${EARTH_PUBLIC_ROOT}/${filename}`);
      if (!createHash("sha256").update(bytes).digest("hex").startsWith(match[1])) throw new Error(`Retired destination pack identity drifted: ${filename}`);
      let previous;
      try { previous = await readFile(`${archive}/${filename}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (previous && !previous.equals(bytes)) throw new Error(`Retired destination pack conflicts: ${filename}`);
      await rename(`${EARTH_PUBLIC_ROOT}/${filename}`, `${archive}/${filename}`);
    }
    await writeFile(`${EARTH_STAGING_ROOT}/entity-hierarchy.json`, JSON.stringify(hierarchy, null, 2));
    console.log(JSON.stringify({ ...prepared.receipt, hierarchy: { countries: hierarchy.countries, admin1: hierarchy.admin1, cities: hierarchy.cities, pointViews: hierarchy.countryPointViews.length + hierarchy.adminPointViews.length, unresolvedParents: hierarchy.unresolvedCityParents.length } }, null, 2));
  }
}
