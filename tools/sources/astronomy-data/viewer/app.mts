// The ledger viewer page. serve.mts strips the types and serves this file as /app.js. It reads /api/data once and
// shows one table of every body, moons and planets nested under their system; a row opens its detail (?body=<id>).
import type { ViewerData, ViewerRow } from "./shape.mts";

const main = document.getElementById("main");
if (!main) throw Error("The page has no #main");
const response = await fetch("/api/data");
if (!response.ok) throw Error("The ledger server did not return its data: " + response.status);
const data: ViewerData = await response.json();
const sourceLabel = new Map(data.sources.map((s) => [s.id, s.label]));

const esc = (v: unknown) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const number = (n: number) => n.toLocaleString("en-US");
const human = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replaceAll("-", " ") : "");
const name = (token: string) => data.labels[token] ?? human(token);
const info = (token: string) => data.catalogue[token] ?? { kind: "", parent: "", object: "", catalogued: false };

// ---------- bodies and systems

type Entry = { token: string; rows: ViewerRow[]; children: Entry[] };
const entries = new Map<string, Entry>();
const entry = (token: string) => {
  let e = entries.get(token);
  if (!e) entries.set(token, (e = { token, rows: [], children: [] }));
  return e;
};
for (const token of Object.keys(data.catalogue)) entry(token);
for (const r of data.rows) for (const t of r.bodies) entry(t).rows.push(r);
for (const e of entries.values()) {
  const parent = info(e.token).parent;
  if (parent && parent !== e.token) entry(parent).children.push(e);
}
// Targets outside cssEarth's catalogue (lightcurve asteroids, calibration stars, solar wind) collapse
// into one "more" row per kind section.
const info0 = (t: string) => data.catalogue[t];
// Sections cssEarth's catalogue never covers list their targets directly.
const flat = new Set(["group", "environment", "sample", "calibration", "unidentified"]);
for (const e of [...entries.values()])
  if (info0(e.token) && !info0(e.token).catalogued && !info(e.token).parent && !flat.has(info(e.token).kind)) {
    const more = "more:" + info(e.token).kind;
    data.catalogue[more] ??= { kind: info(e.token).kind, parent: "", object: "", catalogued: true };
    entry(more).children.push(e);
  }
const hidden = (e: Entry) => !!info0(e.token) && !info0(e.token).catalogued && !flat.has(info(e.token).kind);
const top = [...entries.values()].filter((e) => !hidden(e) && (!info(e.token).parent || !entries.has(info(e.token).parent)));
for (const e of top) if (e.token.startsWith("more:")) data.labels[e.token] = "Not in cssEarth's catalogue";

// One column per archive.
const archives = [
  { key: "photojournal", label: "Photojournal" },
  { key: "usgs", label: "USGS maps" },
  { key: "pds", label: "PDS4 bundles" },
  { key: "umd", label: "Maryland" },
  { key: "darts", label: "DARTS" },
  { key: "opus", label: "OPUS observations" },
];
type Stats = { rows: ViewerRow[]; sources: number; archive: Record<string, number> };
function stats(rows: ViewerRow[]): Stats {
  const archive: Record<string, number> = {};
  for (const r of rows) if (archives.some((a) => a.key === r.source)) archive[r.source] = (archive[r.source] ?? 0) + (r.source === "opus" ? r.count : 1);
  return { rows, sources: new Set(rows.map((r) => r.source)).size, archive };
}
const own = new Map<Entry, Stats>([...entries.values()].map((e) => [e, stats(e.rows)]));
// A system counts each record once, though the Photojournal tags a moon's images with its planet too.
const system = new Map<Entry, Stats>(
  [...entries.values()]
    .filter((e) => e.children.length)
    .map((e) => {
      const all = [e, ...e.children];
      return [e, stats([...new Set(all.flatMap((x) => x.rows))])];
    }),
);
const statsOf = (e: Entry) => system.get(e) ?? own.get(e) ?? stats([]);

// ---------- filters and sorting, kept in the URL

type Column = { key: string; label: string; numeric: boolean; value: (e: Entry, s: Stats) => number | string; cls?: string };
// Can cssEarth show it, and what each archive holds for it.
const columns: Column[] = [
  { key: "body", label: "Body", numeric: false, value: (e) => name(e.token).toLowerCase() },
  { key: "cssearth", label: "In cssEarth", numeric: false, value: (e) => (info(e.token).object ? "yes" : ""), cls: "hide" },
  ...archives.map((a) => ({ key: a.key, label: a.label, numeric: true, value: (_: Entry, s: Stats) => s.archive[a.key] ?? 0 })),
];
const url = new URLSearchParams(location.search);
const state = {
  q: url.get("q") ?? "",
  kind: url.get("kind") ?? "",
  cssearth: url.get("cssearth") === "1",
  sort: columns.some((c) => c.key === url.get("sort")) ? (url.get("sort") ?? "photojournal") : "photojournal",
  ascending: url.get("dir") === "asc",
  expanded: new Set<string>(),
  // Only Planets opens by default.
  openKinds: new Set<string>(["planet"]),
};
function saveUrl(extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.kind) p.set("kind", state.kind);
  if (state.cssearth) p.set("cssearth", "1");
  if (state.sort !== "photojournal") p.set("sort", state.sort);
  if (state.ascending) p.set("dir", "asc");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.size ? "?" + p : "/";
}
const filtering = () => !!(state.q || state.kind || state.cssearth);
function passes(e: Entry): boolean {
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const text = (name(e.token) + " " + e.token + " " + info(e.token).kind).toLowerCase();
  return (
    words.every((w) => text.includes(w)) &&
    (!state.kind || info(e.token).kind === state.kind) &&
    (!state.cssearth || !!info(e.token).object)
  );
}
function compare(a: Entry, b: Entry, sa = statsOf(a), sb = statsOf(b)): number {
  const column = columns.find((c) => c.key === state.sort) ?? columns[2];
  const x = column.value(a, sa), y = column.value(b, sb);
  // Empty text sorts last in either direction.
  const blank = (v: number | string) => v === "";
  if (blank(x) !== blank(y)) return blank(x) ? 1 : -1;
  const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
  const dir = state.ascending ? order : -order;
  return dir || name(a.token).localeCompare(name(b.token));
}

// ---------- the table

function cells(e: Entry, s: Stats, label: string): string {
  const count = (n: number) => `<td class="n">${n ? number(n) : ""}</td>`;
  return `<td>${label}</td><td class="meta hide">${info(e.token).object ? "Yes" : ""}</td>${archives.map((a) => count(s.archive[a.key] ?? 0)).join("")}`;
}
function childrenWord(e: Entry): string {
  const kinds = new Set(e.children.map((c) => info(c.token).kind));
  const word =
    e.token.startsWith("more:") ? "target" : kinds.size === 1 && kinds.has("satellite") ? "moon" : kinds.size === 1 && kinds.has("exoplanet") ? "planet" : "body";
  const n = e.children.length;
  return `${number(n)} ${word === "body" ? (n === 1 ? "body" : "bodies") : word + (n === 1 ? "" : "s")}`;
}
// Section order and headings for the kinds packages/astronomy uses; a kind missing here sorts after them.
const kindOrder = ["planet", "dwarf-planet", "satellite", "asteroid", "trans-neptunian", "comet", "interstellar", "star", "black-hole", "exoplanet", "deep-sky", "group", "environment", "sample", "calibration", "unidentified", ""];
const kindHeading: Record<string, string> = {
  planet: "Planets",
  "dwarf-planet": "Dwarf planets",
  satellite: "Moons",
  asteroid: "Asteroids",
  "trans-neptunian": "Trans-Neptunian objects",
  comet: "Comets",
  interstellar: "Interstellar objects",
  star: "Stars",
  "black-hole": "Black holes",
  exoplanet: "Exoplanets",
  "deep-sky": "Deep-sky objects and sky regions",
  group: "Groups of bodies",
  environment: "Space environment",
  sample: "Meteorites and lab samples",
  calibration: "Calibration and engineering",
  unidentified: "Unidentified names",
  "": "Unclassified",
};
const kindRank = (k: string) => (kindOrder.includes(k) ? kindOrder.indexOf(k) : kindOrder.length - 1.5);
function entryRows(e: Entry, active: boolean): string[] {
  if (!e.children.length)
    return passes(e) ? [`<tr class="link" data-body="${esc(e.token)}">${cells(e, own.get(e) ?? stats([]), esc(name(e.token)))}</tr>`] : [];
  const members = [...(e.token.startsWith("more:") ? [] : [e]), ...[...e.children].sort((a, b) => compare(a, b, own.get(a), own.get(b)))];
  const shown = active ? members.filter(passes) : members;
  if (!shown.length) return [];
  const open = active || state.expanded.has(e.token);
  const caret = `<button class="caret" data-toggle="${esc(e.token)}" aria-expanded="${open}" aria-label="Show ${esc(childrenWord(e))}">${open ? "▾" : "▸"}</button>`;
  const out = [
    `<tr class="link system" data-body="${esc(e.token)}" data-system="1">${cells(e, statsOf(e), `${caret}${esc(name(e.token))} <span class="sub-inline">${e.token.startsWith("more:") ? "" : "system · "}${esc(childrenWord(e))}</span>`)}</tr>`,
  ];
  if (open)
    for (const m of shown)
      out.push(
        `<tr class="link member" data-body="${esc(m.token)}">${cells(m, own.get(m) ?? stats([]), m === e ? esc(name(e.token)) + ' <span class="sub-inline">itself</span>' : esc(name(m.token)))}</tr>`,
      );
  return out;
}
function tableRows(): string {
  const active = filtering();
  const groups = new Map<string, Entry[]>();
  for (const e of top) {
    const kind = info(e.token).kind;
    groups.set(kind, [...(groups.get(kind) ?? []), e]);
  }
  const order = [...groups.keys()].sort((a, b) => kindRank(a) - kindRank(b) || a.localeCompare(b));
  const out: string[] = [];
  for (const kind of order) {
    const members = (groups.get(kind) ?? []).sort((a, b) => Number(a.token.startsWith("more:")) - Number(b.token.startsWith("more:")) || compare(a, b));
    const rows = members.map((e) => entryRows(e, active)).filter((r) => r.length);
    if (!rows.length) continue;
    const heading = kindHeading[kind] ?? human(kind);
    const closed = !active && !state.openKinds.has(kind);
    out.push(
      `<tr class="kind" data-kind="${esc(kind)}"><td colspan="${columns.length}"><button class="caret" aria-expanded="${!closed}">${closed ? "▸" : "▾"}</button>${esc(heading)} <span class="sub-inline">${number(rows.length)}</span></td></tr>`,
    );
    if (!closed) out.push(...rows.flat());
  }
  return out.join("");
}
function table(): string {
  const kinds = [...new Set(Object.values(data.catalogue).map((c) => c.kind).filter(Boolean))].sort();
  const header = columns
    .map((c) => {
      const sorted = state.sort === c.key;
      const arrow = sorted ? (state.ascending ? " ↑" : " ↓") : "";
      return `<th class="sortable ${c.numeric ? "n" : ""} ${c.cls ?? ""}" data-sort="${c.key}" aria-sort="${sorted ? (state.ascending ? "ascending" : "descending") : "none"}">${c.label}${arrow}</th>`;
    })
    .join("");
  const check = (key: "cssearth", label: string) =>
    `<label class="check"><input type="checkbox" data-flag="${key}"${state[key] ? " checked" : ""}> ${label}</label>`;
  return `<h1>Astronomy data ledger</h1><p class="muted">${number(data.rows.length)} source records. Sources count different populations, so record totals are not unique datasets. A system row adds up its planet and moons.</p>
  <div class="filters"><input id="filter" type="search" placeholder="Filter bodies" value="${esc(state.q)}" autocomplete="off"><select id="kind"><option value="">All kinds</option>${kinds
    .map((k) => `<option value="${esc(k)}"${state.kind === k ? " selected" : ""}>${esc(human(k))}</option>`)
    .join("")}</select>${check("cssearth", "In cssEarth")}</div>
  <table><thead><tr>${header}</tr></thead><tbody id="rows">${tableRows()}</tbody></table>`;
}

// ---------- detail

function detail(token: string, whole: boolean): string {
  const e = entries.get(token);
  const back = `<a class="back" href="${esc(saveUrl())}">← All bodies</a>`;
  if (!e) return back + `<h1>${esc(token)}</h1><p class="muted">Nothing in the ledger names this body.</p>`;
  const s = whole ? statsOf(e) : own.get(e) ?? stats([]);
  const members = whole ? [e, ...e.children] : [e];
  const bodyOf = (r: ViewerRow) => members.filter((m) => r.bodies.includes(m.token)).map((m) => name(m.token)).join(", ");
  const rows = [...s.rows].sort((x, y) => x.source.localeCompare(y.source) || x.title.localeCompare(y.title));
  const facts = [human(info(token).kind), info(token).object ? "in cssEarth as " + info(token).object : "not in cssEarth yet"].filter(Boolean).join(" · ");
  const records = `<h2>Records</h2><table><thead><tr><th class="hide"></th><th>Record</th>${whole ? "<th>Body</th>" : ""}<th>Source</th></tr></thead><tbody>${rows
    .map((r) => {
      const meta = [r.instrument, r.size, r.date].filter(Boolean).join(" · ");
      return `<tr><td class="hide">${r.thumbnail ? `<img loading="lazy" src="${esc(r.thumbnail)}" alt="">` : ""}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(
        r.source === "opus" ? r.instrument + " · " + r.target : r.title,
      )}</a>${meta ? `<div class="sub">${esc(meta)}</div>` : ""}</td>${whole ? `<td class="meta">${esc(bodyOf(r))}</td>` : ""}<td class="meta">${esc(
        sourceLabel.get(r.source) ?? r.source,
      )}</td></tr>`;
    })
    .join("")}</tbody></table>`;
  return `${back}<h1>${esc(name(token))}${whole ? " system" : ""}</h1><p class="muted">${esc(facts)}<br>${number(s.rows.length)} records from ${s.sources} sources</p>${records}`;
}

// ---------- events

function render() {
  if (!main) return;
  const p = new URLSearchParams(location.search);
  const token = p.get("body");
  main.innerHTML = token ? detail(token, p.get("system") === "1") : table();
}
function refreshRows() {
  const body = document.getElementById("rows");
  if (body) body.innerHTML = tableRows();
  history.replaceState(null, "", saveUrl());
}
main.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const back = target.closest("a.back");
  if (back instanceof HTMLAnchorElement) {
    event.preventDefault();
    history.pushState(null, "", back.href);
    render();
    return window.scrollTo(0, 0);
  }
  if (target.closest("a, input, select, label")) return;
  const toggle = target.closest<HTMLElement>("[data-toggle]");
  if (toggle?.dataset.toggle) {
    const t = toggle.dataset.toggle;
    if (state.expanded.has(t)) state.expanded.delete(t);
    else state.expanded.add(t);
    return refreshRows();
  }
  const section = target.closest<HTMLElement>("tr[data-kind]");
  if (section?.dataset.kind !== undefined) {
    const k = section.dataset.kind;
    if (state.openKinds.has(k)) state.openKinds.delete(k);
    else state.openKinds.add(k);
    return refreshRows();
  }
  const th = target.closest<HTMLElement>("th[data-sort]");
  if (th?.dataset.sort) {
    const column = columns.find((c) => c.key === th.dataset.sort);
    if (state.sort === th.dataset.sort) state.ascending = !state.ascending;
    else {
      state.sort = th.dataset.sort;
      // Numbers start from the largest, names from A.
      state.ascending = !column?.numeric;
    }
    history.replaceState(null, "", saveUrl());
    return render();
  }
  const row = target.closest<HTMLElement>("tr[data-body]");
  if (row?.dataset.body) {
    history.replaceState(null, "", saveUrl());
    history.pushState(null, "", saveUrl({ body: row.dataset.body, ...(row.dataset.system ? { system: "1" } : {}) }));
    render();
    window.scrollTo(0, 0);
  }
});
main.addEventListener("input", (event) => {
  const t = event.target;
  if (t instanceof HTMLInputElement && t.id === "filter") state.q = t.value;
  else if (t instanceof HTMLSelectElement && t.id === "kind") state.kind = t.value;
  else if (t instanceof HTMLInputElement && t.dataset.flag) {
    const flag = t.dataset.flag;
    if (flag === "cssearth") state.cssearth = t.checked;
  } else return;
  refreshRows();
});
window.addEventListener("popstate", render);
render();
