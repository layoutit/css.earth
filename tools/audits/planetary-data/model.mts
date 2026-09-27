import { readFile } from "node:fs/promises";
import { array, object, string, number } from "./collect/client.mts";
export { array, object, string, number };
export const root = import.meta.dirname;
export async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(root + "/" + path, "utf8"));
}
export const api = "https://opus.pds-rings.seti.org/opus/api/";
export type Row = {
  id: string;
  source: string;
  instrument: string;
  target: string;
  count: number;
  decision: string;
  reason: string;
  proposals: string[];
  url: string;
  details: unknown;
};
export function queryUrl(endpoint: string, params: unknown): string {
  return (
    api +
    endpoint +
    "?" +
    new URLSearchParams(
      Object.fromEntries(
        Object.entries(object(params)).map(([k, v]) => [k, string(v)]),
      ),
    )
  );
}
export async function loadRows(): Promise<Row[]> {
  const opus = object(await json("evidence/opus.json")),
    prior = object(await json("evidence/previous-audits.json"));
  const result: Row[] = array(opus.rows).map((value) => {
    const r = object(value);
    return {
      id: string(r.id),
      source: "opus",
      instrument: string(r.instrument),
      target: string(r.target),
      count: number(r.count),
      decision: string(r.decision),
      reason: string(r.reason),
      proposals: array(r.proposals).map(string),
      url: queryUrl("data.json", r.query),
      details: r,
    };
  });
  for (const value of array(prior.photojournal)) {
    const r = object(value);
    result.push({
      id: string(r.pia),
      source: "photojournal",
      instrument: string(r.instrument),
      target: string(r.target),
      count: 1,
      decision: string(r.decision),
      reason: string(r.reason),
      proposals: array(r.proposalIds).map((x) => string(x).split("-")[0]),
      url: string(r.page),
      details: r,
    });
  }
  for (const value of array(prior.pdsBundles)) {
    const r = object(value);
    result.push({
      id: string(r.lid),
      source: "pds",
      instrument: "",
      target: "",
      count: 1,
      decision: string(r.originalCategory),
      reason: string(r.originalAssessment),
      proposals: array(r.proposalIds).map((x) => string(x).split("-")[0]),
      url: string(r.source),
      details: r,
    });
  }
  for (const value of array(prior.usgs)) {
    const r = object(value);
    result.push({
      id: string(r.id),
      source: "usgs",
      instrument: "",
      target: string(r.target ?? ""),
      count: 1,
      decision: string(r.decision),
      reason: string(r.reason),
      proposals: array(r.proposalIds).map((x) => string(x).split("-")[0]),
      url: string(r.url),
      details: r,
    });
  }
  for (const value of array(opus.volumes)) {
    const r = object(value);
    result.push({
      id: string(r.bundleid) + " / " + string(r.instrument),
      source: "opus-volumes",
      instrument: string(r.instrument),
      target: r.sample ? string(object(r.sample).target) : "",
      count: number(r.count),
      decision: "catalogue-inventory",
      reason:
        "Exact instrument/volume query and earliest product locator retained. This inventory row does not claim scientific review of every observation in the volume.",
      proposals: [],
      url: queryUrl("data.json", r.query),
      details: r,
    });
  }
  for (const value of array(opus.geometry)) {
    const g = object(value);
    for (const [target, count] of Object.entries(object(g.targets))) {
      const params = {
        instrument: string(g.instrument),
        surfacegeometrytargetname: target,
      };
      result.push({
        id: params.instrument + " / " + target,
        source: "opus-geometry",
        instrument: params.instrument,
        target,
        count: number(count),
        decision: "geometry-index",
        reason:
          "Overlapping geometry-index membership. This may include an unresolved body or predicted position; it is not a detection, usable footprint or unique observation count. Inspect signal and geometry before inclusion.",
        proposals: [],
        url: queryUrl("data.json", params),
        details: params,
      });
    }
  }
  return result;
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
        r.target
          .toLowerCase()
          .split(/;\s*/)
          .includes(params.get("target")!.toLowerCase())) &&
      (!params.get("decision") || r.decision === params.get("decision")) &&
      (!params.get("proposal") ||
        r.proposals.includes(params.get("proposal")!)) &&
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
