// Entry script: node packages/bake/cli/astronomy-data-collect-opus-volumes.mts. OPUS pipeline stage: one-record samples
// per instrument/bundle volume, into OPUS_WORK_DIR; the shared client is in @cssearth/bake/sources/astronomy-data.
import { readFile, writeFile } from "node:fs/promises";
import { get, batch, object, array, number, workDir } from "@cssearth/bake/sources/astronomy-data";
const html = await readFile(workDir + "/bundles.html", "utf8");
const entries = [
  ...html.matchAll(/<h3>([^<]+)<\/h3>\s*<ul>\s*<li>([^<]+)<\/li>/g),
].flatMap((m) =>
  m[2].split(/,\s*/).map((bundleid) => ({ instrument: m[1], bundleid })),
);
if (!entries.length) throw Error("No volume inventory");
const cols = [
  "opusid",
  "target",
  "bundleid",
  "datasetid",
  "primaryfilespec",
  "time1",
  "observationtype",
  "quantity",
];
const rows: unknown[] = [];
let done = 0;
await batch(
  entries,
  async (entry) => {
    const query = {
      ...entry,
      "qtype-bundleid": "matches",
      cols: cols.join(","),
      order: "time1,opusid",
      limit: "1",
    };
    const r = object(await get("data.json", query));
    const page = array(r.page).map((v) => {
      const values = array(v);
      if (values.length !== cols.length) throw Error("Wrong width");
      return Object.fromEntries(cols.map((col, i) => [col, values[i]]));
    });
    rows.push({
      ...entry,
      count: number(r.available),
      query,
      sample: page[0] ?? null,
    });
    if (++done % 100 === 0)
      console.log(done + "/" + entries.length + " instrument-volume rows");
  },
  4,
);
rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
await writeFile(
  workDir + "/volumes.json",
  JSON.stringify(
    {
      source: "https://opus.pds-rings.seti.org/opus/__help/bundles.html",
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Volume total: " +
    rows.reduce<number>((sum, r) => sum + number(object(r).count), 0),
);
