import {writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {prepareDestinationPacks} from "../../prepare-destination-packs.mjs";
import {normalizeDestinationQuery} from "../../../site/destination-search.mjs";
import {preparedEntityLenses} from "../../../src/platform/geographic-lens-applicability.mjs";
import {prepareLocationPoint,prepareLocationCamera} from "./prepare-location.mjs";
import {readWorldCoverCatalog} from "./worldcover-catalog.mjs";
import {prepareWmtsCoverage} from "./wmts-coverage.mjs";
import {coverageLookup} from "./prepare-wmts-tree.mjs";
import {wmtsAddress} from "./wmts-page-geometry.mjs";
import {readPlaceSources,sourceRows} from "./operations/place-sources.mjs";
import {prepareAdministrativePlaces} from "./operations/prepare-administrative-places.mjs";

export async function preparePlaceCatalog({sourceDirectory,config,scene,inventory,defaultLens,verifyOnly=false,onReceipt}) {
const recipe=config.geographic.places;
const {manifest,sources}=await readPlaceSources({directory:pathToFileURL(resolve(sourceDirectory,recipe.directory)+"/")});
if(verifyOnly)return null;
const countryRows = sourceRows(sources.get("countryInfo.txt"));
const adminRows = sourceRows(sources.get("admin1CodesASCII.txt"));
const administrative = prepareAdministrativePlaces({ countryRows, adminRows,
  records: new Map(sourceRows(sources.get("administrative-records.tsv.gz")).map(row => [row[0], row])),
  legacyCountryFeatures: JSON.parse(sources.get("ne_110m_admin_0_countries.geojson")).features,
  countryFeatures: JSON.parse(sources.get("shapes_simplified_low.json.zip")).features,
  adminFeatures: JSON.parse(sources.get("ne_10m_admin_1_states_provinces.geojson.gz")).features,
  scene, cameraOptions: {body:scene[config.sceneBodyKey],camera:config.camera} });
const { receipt } = administrative;
receipt.unresolvedCityParents = [];
const formatNumber = value => Number(value).toLocaleString("en-US");
const worldcover = await readWorldCoverCatalog({directory:pathToFileURL(resolve(sourceDirectory,recipe.coverageDirectory)+"/")});
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
  const point = prepareLocationPoint(scene, longitude, latitude);
  const coverage = Math.abs(latitude)<=85.0511287798066 && hasTile(wmtsAddress(longitude,latitude,14)) ? "detail" : "overview";
  return {
    id: row[0], kind: "city", kindLabel: "City", name: row[1], context,
    identifiers: { geonames: row[0] },
    parentId: regionEntity?.id ?? countryEntity?.id ?? config.namespace,
    facts: [{ label: "Population", value: formatNumber(row[14]) }, { label: "Coordinates", value: `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? "S" : "N"}, ${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? "W" : "E"}` }],
    names: [...new Set([row[1], row[2], ...row[3].split(",")].map(normalizeDestinationQuery).filter(Boolean))],
    searchContext: normalizeDestinationQuery(`${context} ${row[8]}`),
    population: Number(row[14]), latitude, longitude,
    camera: prepareLocationCamera(scene, point, coverage === "detail" ? recipe.detailZoom : recipe.overviewZoom, {body:scene[config.sceneBodyKey],camera:config.camera}),
    coverage,
  };
}).sort((a, b) => b.population - a.population || Number(a.id) - Number(b.id));
if (new Set(places.map(place => place.id)).size !== places.length || places.length < 20000) throw new Error("Incomplete city catalogue.");
receipt.cities = places.length;
places.push(...administrative.places);
for (const entity of places) {
  entity.lenses = preparedEntityLenses(inventory, config.namespace, entity.id);
  entity.lensIds = [defaultLens, ...entity.lenses.map(lens => lens.id)];
  entity.resources = [{label:"GeoNames",description:"Names and recorded facts · September 2026 snapshot",href:manifest.sourcePage}];
  if (entity.navigation?.source.startsWith("Natural Earth")) entity.resources.push({label:"Natural Earth",description:`${entity.kind === "admin1" ? "Region" : "Country"} navigation geometry · public domain`,href:entity.kind === "admin1" ? "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/" : "https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/"});
  entity.facts = entity.facts.map((fact,index) => ({id:`${entity.id}:${index}`, ...fact}));
}
const catalog = { schema: "cssearth-prepared-destinations@1", rootId: config.namespace, source: manifest.source,
  snapshotDate: manifest.snapshotDate, administrativeSnapshotDate: manifest.administrativeSnapshotDate,
  qualification: manifest.qualification, places };
// Keep the full join report out of browser packs; it is preparation evidence.
if (onReceipt) onReceipt(receipt);
return catalog;
}

export async function preparePlaces(context) {
 let receipt;
 const catalog=await preparePlaceCatalog({...context,onReceipt:value=>{receipt=value;}});
 const prepared=prepareDestinationPacks(catalog,context.config.publicBase);
 await mkdir(context.publicDirectory,{recursive:true});
 for(const [url,bytes] of prepared.outputs)await writeFile(resolve(context.publicDirectory,url.split("/").at(-1)),bytes);
 return {catalog:prepared.reference,assets:[...prepared.outputs.keys()],receipt:{...prepared.receipt,hierarchy:receipt}};
}
