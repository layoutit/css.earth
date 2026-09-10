import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeDestinationQuery } from "../../../site/destination-search.mts";
import { prepareCityPageGeometry } from "./page-geometry.mts";
import { pageCoordinates, prepareLocationPoint, prepareLocationCamera } from "./prepare-location.mts";
import { readWorldCoverCatalog } from "./worldcover-catalog.mts";
import { prepareWmtsCoverage } from "./wmts-coverage.mts";
import { coverageLookup } from "./prepare-wmts-tree.mts";
import { wmtsAddress } from "./wmts-page-geometry.mts";

import type { GeographicScene } from './contracts.mts';
import { parsePlacesConfig, parsePlacesManifest, parseBodyAttitude } from './source-records.mts';
export async function preparePlaces({sourceDirectory,publicDirectory,config: value,scene}: { sourceDirectory: string; publicDirectory: string; config: unknown; scene: GeographicScene }) {
const config=parsePlacesConfig(value);
const recipe=config.geographic.places;
const source=new URL(recipe.directory+'/',new URL('file://'+sourceDirectory+'/'));
const manifest = parsePlacesManifest(JSON.parse(await readFile(new URL("manifest.json", source), "utf8")));
for (const entry of manifest.inputs) {
  const bytes = await readFile(new URL(entry.path, source));
  if (bytes.length !== entry.bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
    throw new Error(`GeoNames source snapshot drifted: ${entry.path}`);
  }
}

const lines = (value: string) => value.split(/\r?\n/u).filter(line => line && !line.startsWith("#")).map(line => line.split("\t"));
const countries = new Map(lines(await readFile(new URL("countryInfo.txt", source), "utf8")).map(row => [row[0], row[4]]));
const regions = new Map(lines(await readFile(new URL("admin1CodesASCII.txt", source), "utf8")).map(row => [row[0], row[1]]));
const worldcover = await readWorldCoverCatalog({directory:new URL(recipe.coverageDirectory+'/',new URL('file://'+sourceDirectory+'/'))});
const hasTile=coverageLookup([prepareWmtsCoverage([...worldcover.entries.values()],14,{includePolar:true})]);
const rows = lines(execFileSync("unzip", ["-p", fileURLToPath(new URL("cities15000.zip", source)), "cities15000.txt"], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 }));
const places = rows.map(row => {
  if (row.length !== 19 || row[6] !== "P") throw new Error("Invalid GeoNames city record.");
  const latitude = Number(row[4]), longitude = Number(row[5]);
  const country = countries.get(row[8]) ?? row[8];
  const region = regions.get(`${row[8]}.${row[10]}`);
  const context = [...new Set([region, country].filter(Boolean))].join(", ");
  const point = prepareLocationPoint(scene, longitude, latitude);
  const coverage = Math.abs(latitude)<=85.0511287798066 && hasTile(wmtsAddress(longitude,latitude,14)) ? "detail" : "overview";
  return {
    id: row[0], name: row[1], context,
    names: [...new Set([row[1], row[2], ...row[3].split(",")].map(normalizeDestinationQuery).filter(Boolean))],
    searchContext: normalizeDestinationQuery(`${context} ${row[8]}`),
    population: Number(row[14]), latitude, longitude,
    camera: prepareLocationCamera(scene, point, coverage === "detail" ? recipe.detailZoom : recipe.overviewZoom, {body:parseBodyAttitude(scene[config.sceneBodyKey]),camera:config.camera}),
    coverage,
  };
}).sort((a, b) => b.population - a.population || Number(a.id) - Number(b.id));
if (new Set(places.map(place => place.id)).size !== places.length || places.length < 20000) throw new Error("Incomplete city catalogue.");
const catalog = { schema: "cssearth-prepared-destinations@1", source: manifest.source,
  snapshotDate: manifest.snapshotDate, qualification: manifest.qualification, places };
const bytes = Buffer.from(JSON.stringify(catalog) + "\n");
const descriptor = { url: `${config.publicBase}${config.namespace}-places.json`, bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"), count: places.length,
  sourcePage: manifest.sourcePage, license: manifest.license, snapshotDate: manifest.snapshotDate };
await mkdir(publicDirectory,{recursive:true});
await writeFile(`${publicDirectory}/${config.namespace}-places.json`, bytes);
return descriptor;
}
