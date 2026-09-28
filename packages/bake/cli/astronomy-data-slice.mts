// Entry script: node packages/bake/cli/astronomy-data-slice.mts --source=opus --target=Mimas --format=json|tsv. The
// work is in @cssearth/bake/sources.
import { loadRows, slice, tsv } from "@cssearth/bake/sources";
const params = new URLSearchParams();
for (const arg of process.argv.slice(2)) {
  const match = /^--([a-z]+)=(.*)$/.exec(arg);
  if (!match)
    throw Error("Expected --source=opus --target=Mimas --format=json|tsv");
  params.set(match[1], match[2]);
}
const format = params.get("format") ?? "json";
if (!["json", "tsv"].includes(format))
  throw Error("format must be json or tsv");
const rows = slice(await loadRows(), params);
process.stdout.write(
  format === "tsv"
    ? tsv(rows)
    : JSON.stringify({ filters: Object.fromEntries(params), rows }, null, 2) +
        "\n",
);
