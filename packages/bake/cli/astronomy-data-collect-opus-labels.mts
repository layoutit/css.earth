// Entry script: node packages/bake/cli/astronomy-data-collect-opus-labels.mts. OPUS pipeline stage: reads the original
// scientific PDS label/XML for each product sample, into OPUS_WORK_DIR; the shared client is in @cssearth/bake/sources.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { array, object, string, batch, workDir } from "@cssearth/bake/sources";
const products = array(
  JSON.parse(await readFile(workDir + "/products.json", "utf8")),
).map(object);
await mkdir(workDir + "/labels", { recursive: true });
const records: unknown[] = [];
await batch(products, async (p) => {
  if (!p.sample) return;
  const sample = object(p.sample),
    types = object(object(object(p.files).data)[string(sample.opusid)]);
  const candidates = Object.entries(types).filter(
    ([type]) =>
      !/(browse|diagram|index|documentation|inventory|geometry|_thumb|_medium|_full|_doc|_software|_kernels|_quality)/.test(
        type,
      ),
  );
  candidates.sort(
    ([a], [b]) =>
      Number(!/calib|best|global_0100|_atmos/.test(a)) -
      Number(!/calib|best|global_0100|_atmos/.test(b)),
  );
  const found = candidates.flatMap(([type, urls]) =>
    array(urls)
      .map(string)
      .filter((url) => /\.(lbl|xml)$/i.test(url))
      .map((url) => ({ type, url })),
  )[0];
  if (!found) throw Error("No science label " + p.id);
  const response = await fetch(found.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error("HTTP " + response.status + " " + found.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 4 * 1024 * 1024) throw Error("Unexpectedly large label");
  const file = string(p.id) + (found.url.endsWith(".xml") ? ".xml" : ".lbl");
  await writeFile(workDir + "/labels/" + file, bytes);
  records.push({
    id: p.id,
    opusid: sample.opusid,
    ...found,
    file,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    retrievedAt: new Date().toISOString(),
  });
});
await writeFile(
  workDir + "/label-receipts.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Read " + records.length + " original scientific labels");
