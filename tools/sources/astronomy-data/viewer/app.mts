// The ledger viewer page. serve.mts strips the types and serves this file as /app.js. It reads /api/data once and
// shows one table of every body, moons and planets nested under their system; a row opens its detail (?body=<id>).
import type { ViewerData, ViewerRow, ViewerProposal } from "./shape.mts";

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

// Decisions that name a row as a candidate or proposal input, and decisions still waiting for a reader. "Qualification
// first" is a screening note and "outside GeoTIFF candidates" a rejection, so neither counts.
const needsReview = (d: string) => /review|unresolved|needs|unindexed|unavailable/i.test(d);
const isCandidate = (d: string) => !needsReview(d) && !/outside|deferred|not-/i.test(d) && /candidate|proposal|strong|opportunit|addition|promising/i.test(d);
const rank = (d: string) => (isCandidate(d) ? 0 : needsReview(d) ? 1 : /deferred|outside|not-|older|provisional|simulation/i.test(d) ? 3 : 2);

// ---------- bodies and systems

type Entry = { token: string; rows: ViewerRow[]; proposals: ViewerProposal[]; children: Entry[] };
const entries = new Map<string, Entry>();
const entry = (token: string) => {
  let e = entries.get(token);
  if (!e) entries.set(token, (e = { token, rows: [], proposals: [], children: [] }));
  return e;
};
for (const token of Object.keys(data.catalogue)) entry(token);
for (const r of data.rows) for (const t of r.bodies) entry(t).rows.push(r);
for (const p of data.proposals) for (const t of p.bodies) entry(t).proposals.push(p);
for (const e of entries.values()) {
  const parent = info(e.token).parent;
  if (parent && parent !== e.token) entry(parent).children.push(e);
}
// Targets outside cssEarth's catalogue with no proposal (lightcurve asteroids, calibration stars, solar wind) collapse
// into one "more" row per kind section.
const info0 = (t: string) => data.catalogue[t];
for (const e of [...entries.values()])
  if (info0(e.token) && !info0(e.token).catalogued && !e.proposals.length && !info(e.token).parent) {
    const more = "more:" + info(e.token).kind;
    data.catalogue[more] ??= { kind: info(e.token).kind, parent: "", object: "", catalogued: true };
    entry(more).children.push(e);
  }
const hidden = (e: Entry) => !!info0(e.token) && !info0(e.token).catalogued && !e.proposals.length;
const top = [...entries.values()].filter((e) => !hidden(e) && (!info(e.token).parent || !entries.has(info(e.token).parent)));
for (const e of top) if (e.token.startsWith("more:")) data.labels[e.token] = "Not in cssEarth's catalogue";

type Stats = { rows: ViewerRow[]; proposals: ViewerProposal[]; review: number; sources: number };
function stats(rows: ViewerRow[], proposals: ViewerProposal[]): Stats {
  return { rows, proposals, review: rows.filter((r) => needsReview(r.decision)).length, sources: new Set(rows.map((r) => r.source)).size };
}
const own = new Map<Entry, Stats>([...entries.values()].map((e) => [e, stats(e.rows, e.proposals)]));
// A system counts each record and proposal once, though the Photojournal tags a moon's images with its planet too.
const system = new Map<Entry, Stats>(
  [...entries.values()]
    .filter((e) => e.children.length)
    .map((e) => {
      const all = [e, ...e.children];
      return [e, stats([...new Set(all.flatMap((x) => x.rows))], [...new Set(all.flatMap((x) => x.proposals))])];
    }),
);
const statsOf = (e: Entry) => system.get(e) ?? own.get(e) ?? stats([], []);

// ---------- filters and sorting, kept in the URL

type Column = { key: string; label: string; numeric: boolean; value: (e: Entry, s: Stats) => number | string; cls?: string };
// Four columns, one question each: can cssEarth show it, is work planned, what is still unread, how much exists.
const columns: Column[] = [
  { key: "body", label: "Body", numeric: false, value: (e) => name(e.token).toLowerCase() },
  { key: "cssearth", label: "In cssEarth", numeric: false, value: (e) => (info(e.token).object ? "yes" : ""), cls: "hide" },
  { key: "proposals", label: "Proposals", numeric: true, value: (_, s) => s.proposals.length },
  { key: "review", label: "Needs review", numeric: true, value: (_, s) => s.review },
  { key: "records", label: "Records", numeric: true, value: (_, s) => s.rows.length },
];
const url = new URLSearchParams(location.search);
const state = {
  q: url.get("q") ?? "",
  kind: url.get("kind") ?? "",
  cssearth: url.get("cssearth") === "1",
  proposals: url.get("proposals") === "1",
  sort: columns.some((c) => c.key === url.get("sort")) ? (url.get("sort") ?? "proposals") : "proposals",
  ascending: url.get("dir") === "asc",
  expanded: new Set<string>(),
  closedKinds: new Set<string>(),
};
function saveUrl(extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.kind) p.set("kind", state.kind);
  if (state.cssearth) p.set("cssearth", "1");
  if (state.proposals) p.set("proposals", "1");
  if (state.sort !== "proposals") p.set("sort", state.sort);
  if (state.ascending) p.set("dir", "asc");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.size ? "?" + p : "/";
}
const filtering = () => !!(state.q || state.kind || state.cssearth || state.proposals);
function passes(e: Entry): boolean {
  const s = own.get(e) ?? stats([], []);
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const text = (name(e.token) + " " + e.token + " " + info(e.token).kind).toLowerCase();
  return (
    words.every((w) => text.includes(w)) &&
    (!state.kind || info(e.token).kind === state.kind) &&
    (!state.cssearth || !!info(e.token).object) &&
    (!state.proposals || s.proposals.length > 0)
  );
}
function compare(a: Entry, b: Entry, sa = statsOf(a), sb = statsOf(b)): number {
  const column = columns.find((c) => c.key === state.sort) ?? columns[3];
  const x = column.value(a, sa), y = column.value(b, sb);
  // Empty text and missing priorities sort last in either direction.
  const blank = (v: number | string) => v === "" || v === Infinity;
  if (blank(x) !== blank(y)) return blank(x) ? 1 : -1;
  const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
  const dir = state.ascending ? order : -order;
  return dir || name(a.token).localeCompare(name(b.token));
}

// ---------- the table

function cells(e: Entry, s: Stats, label: string): string {
  const count = (n: number) => `<td class="n">${n ? number(n) : ""}</td>`;
  return `<td>${label}</td><td class="meta hide">${info(e.token).object ? "Yes" : ""}</td>${count(s.proposals.length)}${count(s.review)}${count(s.rows.length)}`;
}
function childrenWord(e: Entry): string {
  const kinds = new Set(e.children.map((c) => info(c.token).kind));
  const word =
    e.token.startsWith("more:") ? "target" : kinds.size === 1 && kinds.has("satellite") ? "moon" : kinds.size === 1 && kinds.has("exoplanet") ? "planet" : "body";
  const n = e.children.length;
  return `${number(n)} ${word === "body" ? (n === 1 ? "body" : "bodies") : word + (n === 1 ? "" : "s")}`;
}
// Section order and headings for the kinds packages/astronomy uses; a kind missing here sorts after them.
const kindOrder = ["planet", "dwarf-planet", "satellite", "asteroid", "trans-neptunian", "comet", "interstellar", "star", "black-hole", "exoplanet", "deep-sky", "cross-body", "field", ""];
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
  "deep-sky": "Deep-sky objects",
  "cross-body": "Proposals across bodies",
  field: "Fields and phenomena",
  "": "Unclassified",
};
const kindRank = (k: string) => (kindOrder.includes(k) ? kindOrder.indexOf(k) : kindOrder.length - 1.5);
function entryRows(e: Entry, active: boolean): string[] {
  if (!e.children.length)
    return passes(e) ? [`<tr class="link" data-body="${esc(e.token)}">${cells(e, own.get(e) ?? stats([], []), esc(name(e.token)))}</tr>`] : [];
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
        `<tr class="link member" data-body="${esc(m.token)}">${cells(m, own.get(m) ?? stats([], []), m === e ? esc(name(e.token)) + ' <span class="sub-inline">itself</span>' : esc(name(m.token)))}</tr>`,
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
    const closed = !active && state.closedKinds.has(kind);
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
  const check = (key: "cssearth" | "proposals", label: string) =>
    `<label class="check"><input type="checkbox" data-flag="${key}"${state[key] ? " checked" : ""}> ${label}</label>`;
  return `<h1>Astronomy data ledger</h1><p class="muted">${number(data.proposals.length)} proposals and ${number(data.rows.length)} source records. Sources count different populations, so record totals are not unique datasets. A system row adds up its planet and moons.</p>
  <div class="filters"><input id="filter" type="search" placeholder="Filter bodies" value="${esc(state.q)}" autocomplete="off"><select id="kind"><option value="">All kinds</option>${kinds
    .map((k) => `<option value="${esc(k)}"${state.kind === k ? " selected" : ""}>${esc(human(k))}</option>`)
    .join("")}</select>${check("cssearth", "In cssEarth")}${check("proposals", "Has proposals")}</div>
  <table><thead><tr>${header}</tr></thead><tbody id="rows">${tableRows()}</tbody></table>`;
}

// ---------- detail

function detail(token: string, whole: boolean): string {
  const e = entries.get(token);
  const back = `<a class="back" href="${esc(saveUrl())}">← All bodies</a>`;
  if (!e) return back + `<h1>${esc(token)}</h1><p class="muted">Nothing in the ledger names this body.</p>`;
  const s = whole ? statsOf(e) : own.get(e) ?? stats([], []);
  const members = whole ? [e, ...e.children] : [e];
  const bodyOf = (r: ViewerRow) => members.filter((m) => r.bodies.includes(m.token)).map((m) => name(m.token)).join(", ");
  const rows = [...s.rows].sort((x, y) => rank(x.decision) - rank(y.decision) || x.source.localeCompare(y.source) || x.title.localeCompare(y.title));
  const facts = [human(info(token).kind), info(token).object ? "in cssEarth as " + info(token).object : "not in cssEarth yet"].filter(Boolean).join(" · ");
  const proposals = s.proposals.length
    ? `<h2>Proposals</h2><table><thead><tr><th>ID</th><th>Proposal</th><th>Status</th><th class="n">Priority</th><th class="reason">Next step</th></tr></thead><tbody>${[...s.proposals]
        .sort((a, b) => a.priority - b.priority || Number(a.id) - Number(b.id))
        .map(
          (p) =>
            `<tr class="link proposal" data-proposal="${esc(p.id)}"><td class="meta">P${esc(p.id)}</td><td>${esc(p.title)}${
              p.prUrl ? ` · <a href="${esc(p.prUrl)}" target="_blank" rel="noopener">PR</a>` : ""
            }</td><td class="meta">${esc(human(p.status))}</td><td class="n">${p.priority}</td><td class="reason">${esc(
              p.blocker ? "Blocked: " + p.blocker : p.nextStep,
            )}</td></tr><tr class="writeup" data-writeup="${esc(p.id)}" hidden><td></td><td colspan="4"><pre>${esc(p.writeup)}</pre></td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  const records = `<h2>Records</h2><table><thead><tr><th class="hide"></th><th>Record</th>${whole ? "<th>Body</th>" : ""}<th>Source</th><th>Decision</th><th class="reason">Reason</th></tr></thead><tbody>${rows
    .map((r) => {
      const meta = [r.instrument, r.size, r.date].filter(Boolean).join(" · ");
      return `<tr><td class="hide">${r.thumbnail ? `<img loading="lazy" src="${esc(r.thumbnail)}" alt="">` : ""}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(
        r.source === "opus" ? r.instrument + " · " + r.target : r.title,
      )}</a>${meta ? `<div class="sub">${esc(meta)}</div>` : ""}</td>${whole ? `<td class="meta">${esc(bodyOf(r))}</td>` : ""}<td class="meta">${esc(
        sourceLabel.get(r.source) ?? r.source,
      )}</td><td class="meta">${esc(human(r.decision))}</td><td class="reason">${esc(r.reason)}</td></tr>`;
    })
    .join("")}</tbody></table>`;
  return `${back}<h1>${esc(name(token))}${whole ? " system" : ""}</h1><p class="muted">${esc(facts)}<br>${number(s.proposals.length)} proposals · ${number(
    s.rows.length,
  )} records from ${s.sources} sources</p>${proposals}${records}`;
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
    if (state.closedKinds.has(k)) state.closedKinds.delete(k);
    else state.closedKinds.add(k);
    return refreshRows();
  }
  const th = target.closest<HTMLElement>("th[data-sort]");
  if (th?.dataset.sort) {
    const column = columns.find((c) => c.key === th.dataset.sort);
    if (state.sort === th.dataset.sort) state.ascending = !state.ascending;
    else {
      state.sort = th.dataset.sort;
      // Numbers start from the largest, names from A and priorities from 1.
      state.ascending = !column?.numeric || column.key === "priority";
    }
    history.replaceState(null, "", saveUrl());
    return render();
  }
  const row = target.closest<HTMLElement>("tr[data-body], tr[data-proposal]");
  if (row?.dataset.body) {
    history.replaceState(null, "", saveUrl());
    history.pushState(null, "", saveUrl({ body: row.dataset.body, ...(row.dataset.system ? { system: "1" } : {}) }));
    render();
    window.scrollTo(0, 0);
  } else if (row?.dataset.proposal) {
    const writeup = main.querySelector<HTMLElement>(`tr[data-writeup="${CSS.escape(row.dataset.proposal)}"]`);
    if (writeup) writeup.hidden = !writeup.hidden;
  }
});
main.addEventListener("input", (event) => {
  const t = event.target;
  if (t instanceof HTMLInputElement && t.id === "filter") state.q = t.value;
  else if (t instanceof HTMLSelectElement && t.id === "kind") state.kind = t.value;
  else if (t instanceof HTMLInputElement && t.dataset.flag) {
    const flag = t.dataset.flag;
    if (flag === "cssearth" || flag === "proposals") state[flag] = t.checked;
  } else return;
  refreshRows();
});
window.addEventListener("popstate", render);
render();
