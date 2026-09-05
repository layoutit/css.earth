#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EARTH_CITY_ASSET_URLS } from "./city/prepared-assets.mjs";
import { publishPreparedCityAssets } from "./city/r2-publish.mjs";

const root = resolve(import.meta.dirname, "../../../..");
const source = JSON.parse(await readFile(resolve(import.meta.dirname,
  "../source/city/manifest.json"), "utf8"));
const cors = JSON.parse(await readFile(resolve(import.meta.dirname,
  "../source/city/r2-cors.json"), "utf8"));
const staging = resolve(root, ".local/earth-city-publish", source.dataset,
  source.delivery.keyPrefix);

const report = await publishPreparedCityAssets({ source, cors,
  assetUrls: EARTH_CITY_ASSET_URLS, staging, root,
  verifyOnly: process.argv.includes("--verify-only"),
  dryRun: process.argv.includes("--dry-run"),
  batchSize: integerArgument("--batch-size", 256, 1, 1000),
  concurrency: integerArgument("--concurrency", 2, 1, 8) });
console.log(JSON.stringify(report));

function integerArgument(name, fallback, minimum, maximum) {
  const raw = process.argv.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}
