import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { workDir, get } from "./collect/client.mts";
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
  "collect",
  "sample",
  "volumes",
  "products",
  "labels",
  "review",
]) {
  const result = spawnSync(
    process.execPath,
    [import.meta.dirname + "/collect/" + script + ".mts"],
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
