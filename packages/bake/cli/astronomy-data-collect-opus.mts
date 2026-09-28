// Entry script: node packages/bake/cli/astronomy-data-collect-opus.mts. Collects OPUS catalogue, sample, volume,
// product, label and review data into ignored scratch output (OPUS_WORK_DIR), running the astronomy-data-collect-opus-{
// catalog,samples,volumes,products,labels,review}.mts stages in order; the shared client is in @cssearth/bake/sources/astronomy-data.
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { workDir, get } from "@cssearth/bake/sources/astronomy-data";
await mkdir(workDir, { recursive: true });
const response = await fetch(
  "https://opus.pds-rings.seti.org/opus/__help/bundles.html",
  { signal: AbortSignal.timeout(60000) },
);
if (!response.ok) throw Error("Volume inventory HTTP " + response.status);
await writeFile(workDir + "/bundles.html", await response.text());
await writeFile(
  workDir + "/fields.json",
  JSON.stringify(await get("fields.json"), null, 2) + "\n",
);
for (const script of [
  "catalog",
  "samples",
  "volumes",
  "products",
  "labels",
  "review",
]) {
  const result = spawnSync(
    process.execPath,
    [import.meta.dirname + "/astronomy-data-collect-opus-" + script + ".mts"],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(script + " failed");
}
console.log(
  "Fresh catalogue and screening results: " +
    workDir +
    ". Review them before updating committed evidence; native pixel qualification is separate.",
);
