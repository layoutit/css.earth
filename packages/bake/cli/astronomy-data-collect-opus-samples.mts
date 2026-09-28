// Entry script: node packages/bake/cli/astronomy-data-collect-opus-samples.mts. OPUS pipeline stage: two-record samples
// per instrument/target family and Cassini/Galileo/Voyager/New Horizons geometry facets, into OPUS_WORK_DIR; the shared
// client is in @cssearth/bake/sources.
import { readFile, writeFile } from "node:fs/promises";
import { array, object, string, number, get, batch, mults, workDir } from "@cssearth/bake/sources";
const families = array(
  JSON.parse(await readFile(workDir + "/families.json", "utf8")),
).map(object);
const cols = [
  "opusid",
  "mission",
  "instrument",
  "target",
  "time1",
  "time2",
  "bundleid",
  "datasetid",
  "primaryfilespec",
  "observationtype",
  "quantity",
  "greaterpixelsize",
  "lesserpixelsize",
  "wavelength1",
  "wavelength2",
];
const rows = families.flatMap((f) =>
  Object.entries(object(f.targets)).map(([target, n]) => ({
    instrument: string(f.instrument),
    target,
    count: number(n),
  })),
);
const samples: unknown[] = [];
let done = 0;
await batch(
  rows,
  async (row) => {
    const query = {
      instrument: row.instrument,
      target: row.target,
      cols: cols.join(","),
      order: "time1,opusid",
      limit: "2",
    };
    const result = object(await get("data.json", query));
    if (number(result.available) !== row.count)
      throw Error("Changed count " + row.instrument + "/" + row.target);
    const page = array(result.page).map((v) => {
      const values = array(v);
      if (values.length !== cols.length) throw Error("Wrong columns");
      return Object.fromEntries(cols.map((col, i) => [col, values[i]]));
    });
    if (page.length !== Math.min(2, row.count))
      throw Error("Wrong sample count");
    samples.push({ ...row, query, samples: page });
    if (++done % 50 === 0)
      console.log(done + "/" + rows.length + " target/instrument samples");
  },
  4,
);
samples.sort((a, b) =>
  (string(object(a).instrument) + "|" + string(object(a).target)).localeCompare(
    string(object(b).instrument) + "|" + string(object(b).target),
  ),
);
await writeFile(
  workDir + "/samples.json",
  JSON.stringify(samples, null, 2) + "\n",
);
const geometry: unknown[] = [];
await batch(
  [
    "Cassini ISS",
    "Cassini UVIS",
    "Cassini VIMS",
    "Galileo SSI",
    "New Horizons LORRI",
    "Voyager ISS",
  ],
  async (instrument) => {
    const targets = mults(
      await get("meta/mults/surfacegeometrytargetname.json", { instrument }),
    );
    geometry.push({ instrument, targets });
  },
);
await writeFile(
  workDir + "/geometry.json",
  JSON.stringify(geometry, null, 2) + "\n",
);
console.log(
  "Saved " +
    samples.length +
    " rows and " +
    geometry.length +
    " geometry facets",
);
