// Entry script: node packages/bake/cli/astronomy-data-mark-map-usage.mts [--ref=origin/main] [--dry-run]. Marks the
// ledger's USGS and Photojournal maps that a cssEarth body already downloads; the work is in @cssearth/bake/sources.
/**
 * A dataset is `this product` for a body when one of its map files has the same file name as an `origin` or `url` in
 * exactly one body's source/manifest.json at the given ref. Preview images are not maps. Rows already in map_usage,
 * including the hand judgements marked `same data`, are kept.
 */
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databasePath, checkoutRoot } from "@cssearth/bake/sources";

const ref = process.argv.find(arg => arg.startsWith("--ref="))?.slice("--ref=".length) ?? "origin/main";
const dry = process.argv.includes("--dry-run");
const fileName = (url: string) => {
  try { return decodeURIComponent(basename(new URL(url).pathname)).toLowerCase(); } catch { return ""; }
};

const lines = execFileSync("git", ["grep", "-E", '"(origin|url)": "https?://', ref, "--", "src/objects/*/source/manifest.json"],
  { cwd: checkoutRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\n");
const bodiesByFile = new Map<string, Set<string>>();
for (const line of lines) {
  const match = /^[^:]+:src\/objects\/([^/]+)\/source\/manifest\.json:.*"(?:origin|url)": "([^"]+)"/.exec(line);
  if (!match) continue;
  const name = fileName(match[2]!);
  if (!name) continue;
  const bodies = bodiesByFile.get(name) ?? new Set<string>();
  bodies.add(match[1]!);
  bodiesByFile.set(name, bodies);
}

const PREVIEW = /(_1024\.jpg|_512\.jpg|^browse\.jpg|^thumb\.png)$/;
const db = new DatabaseSync(databasePath, { readOnly: dry });
db.exec("PRAGMA foreign_keys=ON");
const candidates = db.prepare(`SELECT d.source, d.id, d.details_json FROM datasets d WHERE d.source IN ('usgs','photojournal')
  AND NOT EXISTS (SELECT 1 FROM map_usage u WHERE u.source=d.source AND u.dataset_id=d.id)`).all() as
  { source: string; id: string; details_json: string }[];
const found: [string, string, string, string][] = [];
for (const { source, id, details_json } of candidates) {
  const details: unknown = JSON.parse(details_json);
  const files = typeof details === "object" && details !== null && "files" in details && Array.isArray(details.files) ? details.files : [];
  for (const file of files) {
    const url = typeof file === "object" && file !== null && "url" in file && typeof file.url === "string" ? file.url : "";
    const name = fileName(url), bodies = bodiesByFile.get(name);
    if (!name || PREVIEW.test(name) || bodies?.size !== 1) continue;
    found.push([source, id, [...bodies][0]!, basename(new URL(url).pathname)]);
    break;
  }
}
for (const [source, id, body, input] of found) console.log(`${source} ${id} -> ${body} (${input})`);
console.log(`${found.length} maps newly marked as used at ${ref}.`);
if (dry) process.exit(0);

db.exec("BEGIN");
try {
  const add = db.prepare("INSERT INTO map_usage (source, dataset_id, object_id, relation, evidence_path, input) VALUES (?,?,?,'this product',?,?)");
  for (const [source, id, body, input] of found) add.run(source, id, body, `src/objects/${body}/source/manifest.json`, input);
  db.prepare("DELETE FROM ledger_log WHERE operation = ?").run("map_usage");
  db.prepare("INSERT INTO ledger_log (at, operation, detail) VALUES (?,?,?)").run(new Date().toISOString().slice(0, 10), "map_usage",
    `map_usage 'this product' rows added where a USGS or Photojournal map file has the name of an origin in exactly one body's ` +
    `source/manifest.json at ${ref}; preview images excluded; existing rows, including hand-judged 'same data' rows, kept.`);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log("written");
