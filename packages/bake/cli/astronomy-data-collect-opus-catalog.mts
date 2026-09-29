// Entry script: node packages/bake/cli/astronomy-data-collect-opus-catalog.mts. OPUS pipeline stage: global and
// per-instrument/target catalogue counts, into OPUS_WORK_DIR; the shared client is in @cssearth/bake/sources/astronomy-data.
import { writeFile } from "node:fs/promises";
import { get, mults, object, batch, workDir } from "@cssearth/bake/sources/astronomy-data";
const global: Record<string, unknown> = {};
await batch(["instrument", "target", "mission", "planet"], async (field) => {
  global[field] = await get("meta/mults/" + field + ".json");
});
global.count = await get("meta/result_count.json");
await writeFile(
  workDir + "/global.json",
  JSON.stringify(global, null, 2) + "\n",
);
const instruments = mults(global.instrument);
const families: unknown[] = [];
await batch(Object.entries(instruments), async ([instrument, count]) => {
  const targets = mults(await get("meta/mults/target.json", { instrument }));
  const sum = Object.values(targets).reduce((a, b) => a + b, 0);
  if (sum !== count)
    throw Error(
      "Target partition mismatch: " + instrument + " " + sum + " != " + count,
    );
  families.push({ instrument, count, targets });
  console.log(
    instrument +
      ": " +
      count +
      " observations, " +
      Object.keys(targets).length +
      " targets",
  );
});
families.sort((a, b) =>
  String(object(a).instrument).localeCompare(String(object(b).instrument)),
);
await writeFile(
  workDir + "/families.json",
  JSON.stringify(families, null, 2) + "\n",
);
console.log("Global observations: " + JSON.stringify(global.count));
