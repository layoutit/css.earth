#!/usr/bin/env node
import {commandContext} from './context.mjs';
const context=commandContext();

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { publishPreparedCityAssets } from "./r2-publish.mjs";

const root = context.projectRoot;
const source = JSON.parse(await readFile(context.sourcePath("city/manifest.json"), "utf8"));
const CITY_ASSET_URLS=JSON.parse(await readFile(resolve(root,`output/${context.objectId}-city`,source.dataset,"assets.json"),"utf8"));
const cors = JSON.parse(await readFile(context.sourcePath("city/r2-cors.json"), "utf8"));
const staging = resolve(root, `.local/${context.objectId}-city-publish`, source.dataset,
  source.delivery.keyPrefix);

const report = await publishPreparedCityAssets({ source, cors, assetPath:context.assetPath,
  assetUrls: CITY_ASSET_URLS, staging, root,
  verifyOnly: context.args.includes("--verify-only"),
  dryRun: context.args.includes("--dry-run"),
  batchSize: integerArgument("--batch-size", 256, 1, 1000),
  concurrency: integerArgument("--concurrency", 2, 1, 8) });
console.log(JSON.stringify(report));

function integerArgument(name, fallback, minimum, maximum) {
  const raw = context.args.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}
