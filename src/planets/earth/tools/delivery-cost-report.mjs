import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { OBJECTS } from "../../../../site/objects.mjs";
import { runtimeAssets } from "../../../../tools/runtime-assets.mjs";

const root = resolve(import.meta.dirname, "../../../.."), path = resolve(process.argv[2]);
const input = JSON.parse(await readFile(path)), assumptions = JSON.parse(await readFile(resolve(root, "docs/earth-delivery-assumptions.json")));
assert.equal(input.complete, true, "Costs require a completed delivery measurement.");
assert.ok(["maximum-observed", "cache-mix"].includes(assumptions.requestCountBasis), "Choose the request-count basis explicitly.");
const cold = input.runs.filter(run => run.cache === "cold"), warm = input.runs.filter(run => run.cache === "warm");
const groupOf = url => url.includes("earth-assets.lowpoly.cc") ? "r2" : url.includes("mapproxy.terrascope.be") ? "provider" : url.startsWith(input.base) ? "application" : "editorial";
const max = (runs, group, field) => Math.max(...runs.map(run => field === "requests" ?
  run.requests.filter(row=>row.group===group).length + run.failed.filter(row=>groupOf(row.url)===group).length :
  field === "responseBodyBytes" ? run.requests.filter(row=>row.group===group).reduce((sum,row)=>sum+Math.max(0,row.sizes?.responseBodySize??0),0) : run.summary[group][field]));
const assets = await runtimeAssets(root, OBJECTS.map(o => o.id));
const prior = JSON.parse(execFileSync("git", ["show", "105c159b:src/planets/earth/runtime-assets.json"], { cwd: root }));
const unique = new Map([...assets, ...prior.assets].map(a=>[`${a.sha256}/${a.filename}`,a]));
const storage = { geometryBytes: 25344236995, geometryPacks: 19632,
  currentAndPriorRuntimeBytes: [...unique.values()].reduce((s,a)=>s+a.bytes,0),
  qualification: "Declared current object inventories plus the retained POC inventory and one existing geometry release. This is a reproducible storage basis, not a complete live bucket inventory or invoice. Add other retained releases with additionalRetainedStorageGB." };
storage.modeledGB = (storage.geometryBytes + storage.currentAndPriorRuntimeBytes) / 1e9 + assumptions.additionalRetainedStorageGB;
const measured = Object.fromEntries(["application","r2","provider","editorial"].map(group => [group, {
  cold: { requests: max(cold,group,"requests"), responseBodyBytes: max(cold,group,"responseBodyBytes") },
  warm: { requests: max(warm,group,"requests"), responseBodyBytes: max(warm,group,"responseBodyBytes") },
}]));
const prices = assumptions.r2Standard, free = assumptions.freeTierAvailable;
const storageUSD = Math.ceil(Math.max(0,storage.modeledGB-(free?prices.freeGBMonth:0))) * prices.gbMonth;
const scenarios = [];
for (const dailySessions of assumptions.dailySessions) for (const edgeHitFraction of assumptions.edgeHitFractions) {
  const sessions = dailySessions * assumptions.daysPerMonth, mix = assumptions.coldSessionFraction;
  const requests = group => assumptions.requestCountBasis === "maximum-observed"
    ? Math.max(measured[group].cold.requests, measured[group].warm.requests)
    : measured[group].cold.requests * mix + measured[group].warm.requests * (1-mix);
  const reads = Math.ceil(sessions * requests("r2") * (1-edgeHitFraction));
  const readsUSD = Math.ceil(Math.max(0,reads-(free?prices.freeReads:0))/1e6) * prices.millionReads;
  scenarios.push({ dailySessions, sessions, edgeHitFraction, r2Reads: reads, storageUSD, readsUSD,
    r2TotalUSD: +(storageUSD+readsUSD).toFixed(3), providerRequests: Math.ceil(sessions * requests("provider")),
    clientResponseGB: sessions * Object.values(measured).reduce((s,m)=>s+m.cold.responseBodyBytes*mix+m.warm.responseBodyBytes*(1-mix),0)/1e9 });
}
const report = { measuredAt: new Date().toISOString(), measurement: path, commit: input.commit, assumptions, storage, measured, scenarios,
  qualification: "Per-session request counts include browser-cache requests and aborted attempts. The default maximum-observed basis uses the larger cold or warm count independently for each service: warm page replacement can initiate more requests. The cache-mix basis is an editable alternative; coldSessionFraction always controls the separate client-byte estimate. Response bytes exclude unavailable aborted-body lengths. Cache percentages are assumptions, not forecasts or guarantees. Pages static requests do not invoke a Worker. Provider/editorial requests are external and excluded from Cloudflare charges. Pricing excludes taxes, domain fees, other services and account-wide usage. No numeric upstream quota or monthly dollar ceiling has been established.",
  publication: { uploadedFiles: 600, uploadedBytes: 110897456, reusedFiles: 203, unchangedGeometryUploads: 0,
    marginalStorageUSDPerMonthBeforeRounding: 110897456 / 1e9 * prices.gbMonth,
    normalAtlasBeforeBytes: 6476100, normalAtlasAfterBytes: 45956184,
    observationOverviewBytes: 206548, normalAtlasDecodedBytesApprox: 381000000 },
};
const output = resolve(dirname(path), "costs.json"); await writeFile(output,JSON.stringify(report,null,2)+"\n");
const lines = ["# Earth delivery cost model", "", `Prices checked ${assumptions.checkedAt}; USD; ${assumptions.daysPerMonth}-day month.`, "",
  "| Daily sessions | Assumed CDN hits | R2 reads/month | R2 storage + reads/month | Provider requests/month |", "| ---: | ---: | ---: | ---: | ---: |",
  ...scenarios.map(s=>`| ${s.dailySessions.toLocaleString("en-US")} | ${s.edgeHitFraction*100}% | ${s.r2Reads.toLocaleString("en-US")} | $${s.r2TotalUSD.toFixed(3)} | ${s.providerRequests.toLocaleString("en-US")} |`), "",
  report.qualification, "", storage.qualification, "", `Modeled stored data: ${storage.modeledGB.toFixed(3)} GB. Each scenario repeats the measured journey; longer sessions can request more tiles. Browser and CDN caches are distinct.`, "",
  "The normal atlas increased from 6.48 MB to 45.96 MB to shorten individual image decodes; its approximately 381 MB decoded footprint is separate from the 128 MiB observation pool. The land-cover overview adds 0.207 MB. This network and memory tradeoff remains visible even when origin charges are small.", "",
  "The current release added 600 files / 110,897,456 bytes; unchanged geometry and noise images were reused. Release verification performs HEAD and GET reads. Both read/write free allowances are shared with other account usage; no account invoice is inferred from this model.", "",
  "Terrascope's service terms prohibit degrading open services through high load and provide no uninterrupted-service guarantee. The direct API avoids mirroring the raster, but anticipated sustained traffic needs an upstream capacity decision. The user has not set a monthly dollar ceiling.", "",
  ...Object.entries(assumptions.sources).map(([label,url])=>`- [${label}](${url})`), ""];
await writeFile(resolve(dirname(path),"costs.md"),lines.join("\n"));
console.log(JSON.stringify({output,storage,measured,scenarios},null,2));
