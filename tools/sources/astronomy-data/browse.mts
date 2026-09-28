// Entry script: node tools/sources/astronomy-data/browse.mts
/**
 * Open the ledger in Datasette, read-only, with the overview dashboard, the dark theme and the map gallery. The first
 * run installs the pinned Datasette packages into output/ledger-venv (ignored); PORT changes the port (default 8001).
 */
import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { databasePath, root } from "./model.mts";

const repo = resolve(root, "../../.."), config = resolve(root, "datasette"), venv = resolve(repo, "output/ledger-venv");
const datasette = resolve(venv, "bin/datasette");
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? result.signal}.`);
}
if (!existsSync(datasette)) {
  run("python3", ["-m", "venv", venv]);
  run(resolve(venv, "bin/pip"), ["install", "--quiet", "-r", resolve(config, "requirements.txt")]);
}
const port = process.env.PORT ?? "8001";
console.log(`Ledger: http://127.0.0.1:${port}/-/dashboards/overview`);
spawn(datasette, ["serve", "--immutable", databasePath, "--port", port,
  "--setting", "default_page_size", "200", "--setting", "max_returned_rows", "5000",
  "--setting", "sql_time_limit_ms", "5000", "--setting", "truncate_cells_html", "300",
  "--metadata", resolve(config, "metadata.json"), "--static", `assets:${config}`, "--template-dir", resolve(config, "templates")],
{ stdio: "inherit" }).once("exit", code => process.exit(code ?? 1));
