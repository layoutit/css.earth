import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { array, object, string, number } from "./collect/client.ts";
export { array, object, string, number };
// The checkout this module's own @cssearth/bake install sits in, independent of the caller's cwd (as
// packages/bake/src/navigation/prepare-navigation.ts and check-deploy-assets.ts resolve it).
/** The checkout this command's own package install belongs to, for other astronomy-data modules and CLI commands that
 * resolve scratch output directories the same way instead of against the caller's cwd. */
export const checkoutRoot = resolve(dirname(createRequire(import.meta.url).resolve("@cssearth/bake/package.json")), "../..");
/** The astronomy data ledger and its documents, in the checkout this command's own package install belongs to. */
export const root = resolve(checkoutRoot, "src/sources/astronomy-data");
export const databasePath = resolve(
  process.env.AUDIT_DB ?? root + "/ledger.sqlite",
);
export function openLedger(): DatabaseSync {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  db.exec("PRAGMA foreign_keys=ON");
  return db;
}
// The bodies a target field names, lowercased and without a minor-planet number ("(162173) Ryugu" is "ryugu"). The
// Photojournal tags a body with its parents too ("mars; sun"); the Sun counts only when it is the only body tagged, so
// filtering by the Sun does not return 1,965 images of the planets that orbit it. SIMBAD's star prefix ("* bet Tau") is
// dropped.
export function bodiesOf(target: string): string[] {
  const tagged = target
    .split(";")
    .map((t) => t.trim().toLowerCase().replace(/^\(\d+\)\s*/, "").replace(/^\*\s+/, ""))
    // "+6 more" ends a shortened list, and "Unspecified" or "none" says there is no target; neither names a body.
    .filter((t) => t && !/^\+\d+ mor/.test(t) && !/^'?(unspecified|unknown|none|n\/a|unk)'?$/.test(t));
  return tagged.length > 1 ? tagged.filter((t) => t !== "sun") : tagged;
}
export type Row = {
  id: string;
  source: string;
  title: string;
  instrument: string;
  target: string;
  count: number;
  decision: string;
  reason: string;
  proposals: string[];
  url: string;
  details: unknown;
};
export type Proposal = {
  id: string;
  slug: string;
  title: string;
  status: string;
  priority: number;
  next_step: string;
  blocker: string;
  pr_url: string;
  updated_at: string;
};
export function loadProposals(): Proposal[] {
  const db = openLedger();
  try {
    return db
      .prepare("SELECT * FROM proposals ORDER BY priority, CAST(id AS INTEGER)")
      .all()
      .map((r) => ({
        id: string(r.id),
        slug: string(r.slug),
        title: string(r.title),
        status: string(r.status),
        priority: number(r.priority),
        next_step: string(r.next_step),
        blocker: string(r.blocker),
        pr_url: string(r.pr_url),
        updated_at: string(r.updated_at),
      }));
  } finally {
    db.close();
  }
}
// `datasets` holds datasets; `inventory` holds the listings that repeat them (OPUS volumes and geometry, Maryland
// holdings, DARTS collections and indexes).
export function loadRows(table: "datasets" | "inventory" = "datasets"): Row[] {
  const db = openLedger();
  try {
    const joins = new Map<string, string[]>();
    const [links, column] = table === "datasets" ? ["dataset_proposals", "dataset_id"] : ["inventory_proposals", "inventory_id"];
    for (const r of db
      .prepare(
        `SELECT source, ${column} AS row_id, proposal_id FROM ${links} ORDER BY CAST(proposal_id AS INTEGER)`,
      )
      .all()) {
      const key = JSON.stringify([r.source, r.row_id]);
      const ids = joins.get(key) ?? [];
      ids.push(string(r.proposal_id));
      joins.set(key, ids);
    }
    return db
      .prepare(`SELECT * FROM ${table} ORDER BY source,id`)
      .all()
      .map((r) => ({
        id: string(r.id),
        source: string(r.source),
        title: string(r.title),
        instrument: string(r.instrument),
        target: string(r.target),
        count: number(r.record_count),
        decision: string(r.decision),
        reason: string(r.reason),
        url: string(r.url),
        proposals: joins.get(JSON.stringify([r.source, r.id])) ?? [],
        details: JSON.parse(string(r.details_json)),
      }));
  } finally {
    db.close();
  }
}
export function slice(rows: Row[], params: URLSearchParams): Row[] {
  const allowed = new Set([
    "source",
    "instrument",
    "target",
    "decision",
    "proposal",
    "q",
    "format",
  ]);
  for (const key of params.keys())
    if (!allowed.has(key)) throw Error("Unknown filter: " + key);
  const q = (params.get("q") ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return rows.filter(
    (r) =>
      (!params.get("source") || r.source === params.get("source")) &&
      (!params.get("instrument") ||
        r.instrument === params.get("instrument")) &&
      (!params.get("target") ||
        bodiesOf(r.target).includes(bodiesOf(params.get("target")!)[0])) &&
      (!params.get("decision") || r.decision === params.get("decision")) &&
      (!params.get("proposal") ||
        r.proposals.includes(String(Number(params.get("proposal"))))) &&
      q.every((word) => JSON.stringify(r).toLowerCase().includes(word)),
  );
}
export function tsv(rows: Row[]): string {
  // Spreadsheet programs can interpret leading formula characters in exported text.
  const cell = (value: unknown) => {
    let s = String(value ?? "")
      .replaceAll("\t", " ")
      .replaceAll("\n", " ")
      .replaceAll("\r", " ");
    return /^[=+@-]/.test(s) ? "'" + s : s;
  };
  return (
    "source\tid\tinstrument\ttarget\tcount\tdecision\tproposals\treason\turl\n" +
    rows
      .map((r) =>
        [
          r.source,
          r.id,
          r.instrument,
          r.target,
          r.count,
          r.decision,
          r.proposals.join(","),
          r.reason,
          r.url,
        ]
          .map(cell)
          .join("\t"),
      )
      .join("\n") +
    "\n"
  );
}
