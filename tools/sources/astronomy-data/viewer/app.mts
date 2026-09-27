// The ledger viewer page. serve.mts strips the types and serves this file as /app.js; it reads /api/data once and
// filters in the browser, except text search, which asks the server so it reads the whole retained record.
import type { ViewerData, ViewerRow, ViewerProposal } from "./shape.mts";

type View = "proposals" | "bodies" | "records";
type Key = "source" | "target" | "decision" | "instrument" | "proposal" | "status" | "priority" | "show";
const keys: Key[] = ["source", "target", "decision", "instrument", "proposal", "status", "priority", "show"];
const recordKeys: Key[] = ["source", "target", "decision", "instrument", "proposal"];

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw Error("The page has no #" + id);
  return found;
}
const main = element("main"), facetsBox = element("facets"), drawer = element("drawer"), scrim = element("scrim");
const tabs = element("tabs"), search = element("q");
if (!(search instanceof HTMLInputElement)) throw Error("#q is not an input");

const response = await fetch("/api/data");
if (!response.ok) throw Error("The ledger server did not return its data: " + response.status);
const data: ViewerData = await response.json();
const rows = data.rows, proposals = data.proposals;
const sourceLabel = new Map(data.sources.map((s) => [s.id, s.label]));

const url = new URLSearchParams(location.search);
const state = {
  view: (["proposals", "bodies", "records"].includes(url.get("view") ?? "") ? url.get("view") : url.has("source") ? "records" : "proposals") as View,
  filters: Object.fromEntries(keys.map((k) => [k, url.get(k) ?? ""])) as Record<Key, string>,
  q: url.get("q") ?? "",
  open: url.get("open") ?? "",
  limit: 150,
  matched: null as Set<number> | null,
  searching: false,
  expanded: new Set<Key>(),
  facetText: {} as Partial<Record<Key, string>>,
};
// Old viewer links named a target as a source spelled it ("Mimas", "(4) Vesta").
state.filters.target = state.filters.target.toLowerCase().replace(/^\(\d+\)\s*/, "");
search.value = state.q;

const esc = (v: unknown) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const number = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, word: string) => number(n) + " " + word + (n === 1 ? "" : "s");
const human = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replaceAll("-", " ") : "");
const body = (token: string) => data.labels[token] ?? human(token);

type Tone = "good" | "warn" | "info" | "off";
function decisionTone(decision: string): Tone {
  if (/review|unresolved|needs|unindexed|unavailable|pilot|defect/i.test(decision)) return "warn";
  if (/candidate|proposal|qualif|strong|opportunit|addition|promising/i.test(decision)) return "good";
  if (/existing|already|alternative|reference|support|inventory|index|holding|family|catalogue|collection|derived/i.test(decision)) return "info";
  return "off";
}
function statusTone(status: string): Tone {
  return status === "shipped" ? "good" : status === "blocked" ? "warn" : status === "qualifying" || status === "in-progress" ? "info" : "off";
}
const pill = (text: string, tone: Tone) => `<span class="pill ${tone}">${esc(human(text))}</span>`;

function saveUrl() {
  const p = new URLSearchParams();
  if (state.view !== "proposals") p.set("view", state.view);
  for (const k of keys) if (state.filters[k]) p.set(k, state.filters[k]);
  if (state.q) p.set("q", state.q);
  if (state.open) p.set("open", state.open);
  history.replaceState(null, "", p.size ? "?" + p : location.pathname);
}

// ---------- filtering

function recordPasses(r: ViewerRow, i: number, except?: Key): boolean {
  const f = state.filters;
  if (except !== "source" && f.source && r.source !== f.source) return false;
  if (except !== "target" && f.target && !r.bodies.includes(f.target)) return false;
  if (except !== "decision" && f.decision && r.decision !== f.decision) return false;
  if (except !== "instrument" && f.instrument && r.instrument !== f.instrument) return false;
  if (except !== "proposal" && f.proposal && !r.proposals.includes(f.proposal)) return false;
  return !state.matched || state.matched.has(i);
}
function proposalText(p: ViewerProposal): string {
  return (p.id + " " + p.title + " " + p.nextStep + " " + p.blocker + " " + p.writeup + " " + p.bodies.join(" ")).toLowerCase();
}
const proposalHaystack = new Map(proposals.map((p) => [p, proposalText(p)]));
function proposalPasses(p: ViewerProposal, except?: Key): boolean {
  const f = state.filters;
  if (except !== "status" && f.status && p.status !== f.status) return false;
  if (except !== "priority" && f.priority && String(p.priority) !== f.priority) return false;
  if (except !== "target" && f.target && !p.bodies.includes(f.target)) return false;
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const text = proposalHaystack.get(p) ?? "";
  return words.every((w) => text.includes(w));
}

// Bodies: every token a record or proposal names, with its record decisions and its proposals.
type BodyStat = { token: string; rows: number; tones: Record<Tone, number>; proposals: ViewerProposal[]; sources: Set<string> };
const bodyStats = new Map<string, BodyStat>();
const stat = (token: string) => {
  let s = bodyStats.get(token);
  if (!s) bodyStats.set(token, (s = { token, rows: 0, tones: { good: 0, warn: 0, info: 0, off: 0 }, proposals: [], sources: new Set() }));
  return s;
};
for (const r of rows)
  for (const t of r.bodies) {
    const s = stat(t);
    s.rows++;
    s.tones[decisionTone(r.decision)]++;
    s.sources.add(r.source);
  }
for (const p of proposals) for (const t of p.bodies) stat(t).proposals.push(p);

// ---------- facets

type Option = { value: string; label: string; count: number };
function counted(values: Iterable<string>, label: (v: string) => string): Option[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, label: label(value), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
function facet(key: Key, title: string, options: Option[], filterable = false): string {
  const text = (state.facetText[key] ?? "").toLowerCase();
  let shown = text ? options.filter((o) => o.label.toLowerCase().includes(text)) : options;
  const limit = state.expanded.has(key) || text ? 200 : 8;
  const hidden = shown.length - limit;
  shown = shown.slice(0, limit);
  const selected = state.filters[key];
  if (selected && !shown.some((o) => o.value === selected)) {
    const o = options.find((o) => o.value === selected);
    shown.unshift(o ?? { value: selected, label: selected, count: 0 });
  }
  if (!options.length) return "";
  return `<div class="facet"><h3>${esc(title)}</h3>${
    filterable && options.length > 8 ? `<input data-facet-filter="${key}" placeholder="Filter ${esc(title.toLowerCase())}" value="${esc(state.facetText[key] ?? "")}">` : ""
  }${shown
    .map(
      (o) =>
        `<button class="opt" data-act="facet" data-k="${key}" data-v="${esc(o.value)}" aria-pressed="${o.value === selected}"><span class="label" title="${esc(o.label)}">${esc(o.label)}</span><span class="n">${number(o.count)}</span></button>`,
    )
    .join("")}${hidden > 0 ? `<button class="more" data-act="more" data-k="${key}">${number(hidden)} more</button>` : ""}</div>`;
}
function renderFacets() {
  if (state.view === "records") {
    const pass = (k: Key) => rows.filter((r, i) => recordPasses(r, i, k));
    facetsBox.innerHTML =
      facet("source", "Source", counted(pass("source").map((r) => r.source), (v) => sourceLabel.get(v) ?? v)) +
      facet("decision", "Decision", counted(pass("decision").map((r) => r.decision), human), true) +
      facet("target", "Body or target", counted(pass("target").flatMap((r) => r.bodies), body), true) +
      facet("instrument", "Instrument", counted(pass("instrument").map((r) => r.instrument), (v) => v), true) +
      facet("proposal", "Proposal", counted(pass("proposal").flatMap((r) => r.proposals), (v) => "P" + v + " " + (proposals.find((p) => p.id === v)?.title ?? "")), true);
  } else if (state.view === "proposals") {
    const pass = (k: Key) => proposals.filter((p) => proposalPasses(p, k));
    facetsBox.innerHTML =
      facet("status", "Status", counted(pass("status").map((p) => p.status), human)) +
      facet("priority", "Priority", counted(pass("priority").map((p) => String(p.priority)), (v) => "Priority " + v).sort((a, b) => a.value.localeCompare(b.value))) +
      facet("target", "Body", counted(pass("target").flatMap((p) => p.bodies), body), true);
  } else {
    const withProposals = [...bodyStats.values()].filter((s) => s.proposals.length).length;
    facetsBox.innerHTML = facet("show", "Show", [
      { value: "", label: "Bodies with proposals", count: withProposals },
      { value: "all", label: "Every target named", count: bodyStats.size },
    ]);
  }
}

// ---------- views

function thumb(r: ViewerRow, cls = "thumb") {
  return r.thumbnail
    ? `<div class="${cls}"><img loading="lazy" src="${esc(r.thumbnail)}" alt=""></div>`
    : `<div class="${cls} none">${esc((sourceLabel.get(r.source) ?? r.source).split(" ")[0])}</div>`;
}
function recordItem(r: ViewerRow): string {
  const key = "r:" + r.key;
  const meta = [
    `<span>${esc(sourceLabel.get(r.source) ?? r.source)}</span>`,
    r.bodies.length ? `<span class="dot">${esc(r.bodies.map(body).join(", "))}</span>` : "",
    r.instrument ? `<span class="dot">${esc(r.instrument)}</span>` : "",
    r.size ? `<span class="dot">${esc(r.size)}</span>` : "",
    r.source.startsWith("opus") ? `<span class="dot">${plural(r.count, "record")}</span>` : "",
    r.proposals.length ? `<span class="dot">${esc(r.proposals.map((p) => "P" + p).join(" "))}</span>` : "",
  ].join("");
  return `<button class="item" data-act="open" data-v="${esc(key)}" aria-current="${state.open === key}">${thumb(r)}<div><h2>${esc(r.source === "opus" ? r.instrument + " · " + r.target : r.title)}</h2><div class="meta">${pill(r.decision, decisionTone(r.decision))}${meta}</div><p>${esc(r.reason)}</p></div></button>`;
}
function chips(pool: Key[]): string {
  return pool
    .filter((k) => state.filters[k])
    .map((k) => {
      const v = state.filters[k];
      const label = k === "source" ? sourceLabel.get(v) ?? v : k === "target" ? body(v) : k === "proposal" ? "P" + v : k === "priority" ? "Priority " + v : human(v);
      return `<span class="chip">${esc(label)}<button data-act="clear" data-k="${k}" aria-label="Remove filter">×</button></span>`;
    })
    .join("");
}
function renderRecords() {
  const found = rows.filter((r, i) => recordPasses(r, i));
  const p = new URLSearchParams();
  for (const k of recordKeys) if (state.filters[k]) p.set(k, state.filters[k]);
  if (state.q) p.set("q", state.q);
  main.innerHTML = `<div class="bar"><span class="count">${state.searching ? "Searching…" : plural(found.length, "record")}</span>${chips(recordKeys)}<span class="spacer"></span><a class="action" href="/api/export?${esc(p + (p.size ? "&" : "") + "format=tsv")}">Export TSV</a><a class="action" href="/api/export?${esc(p + (p.size ? "&" : "") + "format=json")}">Export JSON</a></div>
  <div class="note">Each source counts a different population, so totals across sources are not a count of unique datasets. A decision describes the source record; proposal status lives on the proposal.</div>
  <div class="list">${found.length ? found.slice(0, state.limit).map(recordItem).join("") : `<div class="empty">No records match.</div>`}${
    found.length > state.limit ? `<button class="show-more" data-act="show-more">Show ${number(Math.min(150, found.length - state.limit))} more of ${number(found.length - state.limit)}</button>` : ""
  }</div>`;
}
function proposalItem(p: ViewerProposal): string {
  const key = "p:" + p.id;
  return `<button class="item" data-act="open" data-v="${esc(key)}" aria-current="${state.open === key}"><span class="pid">P${esc(p.id)}</span><div><h2>${esc(p.title)}</h2><div class="meta">${pill(p.status, statusTone(p.status))}<span>${esc(p.bodies.map(body).join(", "))}</span>${
    p.rows ? `<span class="dot">${plural(p.rows, "linked record")}</span>` : ""
  }${p.prUrl ? `<span class="dot">PR linked</span>` : ""}</div><p>${esc(p.blocker ? "Blocked: " + p.blocker : p.nextStep)}</p></div></button>`;
}
function renderProposals() {
  const found = proposals.filter((p) => proposalPasses(p));
  const groups = [...new Set(found.map((p) => p.priority))].sort((a, b) => a - b);
  main.innerHTML = `<div class="bar"><span class="count">${plural(found.length, "proposal")}</span>${chips(["status", "priority", "target"])}</div>
  <div class="list">${
    found.length
      ? groups.map((g) => `<div class="group">Priority ${g}</div>` + found.filter((p) => p.priority === g).map(proposalItem).join("")).join("")
      : `<div class="empty">No proposals match.</div>`
  }</div>`;
}
function renderBodies() {
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const found = [...bodyStats.values()]
    .filter((s) => (state.filters.show === "all" || s.proposals.length) && words.every((w) => body(s.token).toLowerCase().includes(w)))
    .sort((a, b) => b.proposals.length - a.proposals.length || b.rows - a.rows);
  const split = (s: BodyStat) =>
    s.rows
      ? `<div class="split">${(["good", "warn", "info", "off"] as Tone[]).map((t) => (s.tones[t] ? `<i class="${t}" style="width:${(100 * s.tones[t]) / s.rows}%"></i>` : "")).join("")}</div>`
      : "";
  main.innerHTML = `<div class="bar"><span class="count">${number(found.length)} bodies</span><span class="spacer"></span><span class="pill good">Candidate</span><span class="pill warn">Needs review</span><span class="pill info">Existing or support</span><span class="pill off">Deferred or out of scope</span></div>
  <div class="grid">${found
    .slice(0, state.limit)
    .map(
      (s) =>
        `<button class="card" data-act="open" data-v="b:${esc(s.token)}"><h2>${esc(body(s.token))}</h2><div class="stats"><span><b>${number(s.proposals.length)}</b> proposals</span><span><b>${number(s.rows)}</b> records</span><span><b>${s.sources.size}</b> sources</span></div>${split(s)}</button>`,
    )
    .join("")}</div>${found.length > state.limit ? `<button class="show-more" data-act="show-more">Show more</button>` : ""}`;
}
function renderTabs() {
  const tab = (v: View, label: string, n: number) =>
    `<button data-act="view" data-v="${v}" aria-current="${state.view === v}">${label}<span class="n">${number(n)}</span></button>`;
  tabs.innerHTML =
    tab("proposals", "Proposals", proposals.length) +
    tab("bodies", "Bodies", [...bodyStats.values()].filter((s) => s.proposals.length).length) +
    tab("records", "Records", rows.length);
}
function render() {
  renderTabs();
  renderFacets();
  if (state.view === "records") renderRecords();
  else if (state.view === "proposals") renderProposals();
  else renderBodies();
  saveUrl();
}

// ---------- markdown, for proposal writeups and the guide

function inline(text: string): string {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
      /^https?:/.test(href) ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : label,
    );
}
function markdown(source: string): string {
  const out: string[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      i++;
      out.push(`<pre>${esc(code.join("\n"))}</pre>`);
    } else if (/^#{1,6} /.test(line)) {
      const level = line.indexOf(" ");
      out.push(level >= 4 ? `<h4>${inline(line.slice(level + 1))}</h4>` : `<h5>${inline(line.slice(level + 1))}</h5>`);
      i++;
    } else if (line.startsWith("|")) {
      const table: string[][] = [];
      for (; i < lines.length && lines[i].startsWith("|"); i++)
        if (!/^\|[\s:|-]+\|$/.test(lines[i])) table.push(lines[i].slice(1, -1).split("|").map((c) => c.trim()));
      out.push(`<table>${table.map((r, n) => `<tr>${r.map((c) => (n ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join("")}</tr>`).join("")}</table>`);
    } else if (/^\s*([-*]|\d+\.) /.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i]); i++) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.) /, "");
        for (; i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*([-*]|\d+\.) /.test(lines[i + 1]); i++) item += " " + lines[i + 1].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
    } else if (line.trim()) {
      const para: string[] = [];
      for (; i < lines.length && lines[i].trim() && !/^(#{1,6} |\||```|\s*([-*]|\d+\.) )/.test(lines[i]); i++) para.push(lines[i]);
      out.push(`<p>${inline(para.join(" "))}</p>`);
    } else i++;
  }
  return out.join("");
}

// ---------- drawer

function mini(r: ViewerRow): string {
  return `<button class="mini" data-act="open" data-v="r:${esc(r.key)}">${thumb(r)}<span>${esc(r.source === "opus" ? r.instrument + " · " + r.target : r.title)}<small>${esc(sourceLabel.get(r.source) ?? r.source)} · ${esc(human(r.decision))}</small></span></button>`;
}
function top(kicker: string) {
  return `<div class="top"><span class="kicker">${esc(kicker)}</span><button class="close" data-act="close" aria-label="Close">×</button></div>`;
}
function proposalDrawer(p: ViewerProposal): string {
  const linked = rows.filter((r) => r.proposals.includes(p.id));
  return `${top("P" + p.id + " · Priority " + p.priority)}<div class="content"><h1>${esc(p.title)}</h1><div class="chips">${pill(p.status, statusTone(p.status))}${p.bodies
    .map((b) => `<button data-act="open" data-v="b:${esc(b)}">${esc(body(b))}</button>`)
    .join("")}</div>
  <p class="lead">${esc(p.nextStep)}</p>${p.blocker ? `<div class="callout"><strong>Blocked:</strong> ${esc(p.blocker)}</div>` : ""}
  <dl><dt>Updated</dt><dd>${esc(p.updatedAt)}</dd><dt>Implementation</dt><dd>${p.prUrl ? `<a href="${esc(p.prUrl)}" target="_blank" rel="noopener">${esc(p.prUrl.replace("https://github.com/", ""))}</a>` : "No PR recorded"}</dd></dl>
  ${
    linked.length
      ? `<h4>Linked records · ${number(linked.length)}</h4>${linked.slice(0, 12).map(mini).join("")}${linked.length > 12 ? `<button class="show-more" data-act="go-records" data-k="proposal" data-v="${esc(p.id)}">Open all ${number(linked.length)} in Records</button>` : ""}`
      : ""
  }
  <div class="prose">${markdown(p.writeup)}</div></div>`;
}
function bodyDrawer(token: string): string {
  const s = bodyStats.get(token);
  if (!s) return top("Body") + `<div class="content"><p>Nothing in the ledger names ${esc(token)}.</p></div>`;
  const mine = rows.filter((r) => r.bodies.includes(token));
  const decisions = counted(mine.map((r) => r.decision), human);
  const bySource = counted(mine.map((r) => r.source), (v) => sourceLabel.get(v) ?? v);
  const pictures = mine.filter((r) => r.thumbnail && decisionTone(r.decision) !== "off").slice(0, 8);
  return `${top("Body")}<div class="content"><h1>${esc(body(token))}</h1><p class="lead">${number(s.proposals.length)} proposals and ${number(s.rows)} source records from ${s.sources.size} sources.</p>
  ${s.proposals.length ? `<h4>Proposals</h4>${s.proposals.map((p) => `<button class="mini" data-act="open" data-v="p:${esc(p.id)}"><span class="pid">P${esc(p.id)}</span><span>${esc(p.title)}<small>${esc(human(p.status))} · Priority ${p.priority}</small></span></button>`).join("")}` : ""}
  <h4>Record decisions</h4><div class="chips">${decisions.map((d) => `<button data-act="go-records" data-k="decision" data-v="${esc(d.value)}" data-body="${esc(token)}">${esc(d.label)} · ${number(d.count)}</button>`).join("")}</div>
  <h4>Sources</h4><div class="chips">${bySource.map((d) => `<button data-act="go-records" data-k="source" data-v="${esc(d.value)}" data-body="${esc(token)}">${esc(d.label)} · ${number(d.count)}</button>`).join("")}</div>
  ${pictures.length ? `<h4>Images worth a look</h4>${pictures.map(mini).join("")}` : ""}
  <button class="show-more" data-act="go-records" data-k="target" data-v="${esc(token)}">Open all ${number(s.rows)} records</button></div>`;
}
// Reasons cite PRs and pages as bare URLs.
const linkify = (text: string) =>
  esc(text).replace(/https?:\/\/[^\s)]+[^\s).,;]/g, (href) => `<a href="${href}" target="_blank" rel="noopener">${href}</a>`);
function recordDrawer(r: ViewerRow): string {
  const hero = r.thumbnail ? `<img class="hero" src="${esc(r.thumbnail.replace("?w=320", "?w=1200"))}" alt="">` : "";
  return `${top(r.key)}<div class="content">${hero}<h1>${esc(r.source === "opus" ? r.instrument + " · " + r.target : r.title)}</h1><div class="chips">${pill(r.decision, decisionTone(r.decision))}${r.bodies
    .map((b) => `<button data-act="open" data-v="b:${esc(b)}">${esc(body(b))}</button>`)
    .join("")}${r.proposals.map((p) => `<button data-act="open" data-v="p:${esc(p)}">P${esc(p)}</button>`).join("")}</div>
  <p class="lead">${linkify(r.reason)}</p>
  <dl><dt>Source</dt><dd>${esc(sourceLabel.get(r.source) ?? r.source)} · <a href="${esc(r.url)}" target="_blank" rel="noopener">open original</a></dd>${r.instrument ? `<dt>Instrument</dt><dd>${esc(r.instrument)}</dd>` : ""}<dt>Target field</dt><dd>${esc(r.target || "none recorded")}</dd>${
    r.date ? `<dt>Date</dt><dd>${esc(r.date)}</dd>` : ""
  }${r.size ? `<dt>Largest file</dt><dd>${esc(r.size)}</dd>` : ""}<dt>Records</dt><dd>${number(r.count)}</dd><dt>Identifier</dt><dd><code>${esc(r.id)}</code></dd></dl>
  <div id="record-more">Reading the retained record…</div></div>`;
}
async function fillRecord(r: ViewerRow) {
  const reply = await fetch(`/api/record?source=${encodeURIComponent(r.source)}&id=${encodeURIComponent(r.id)}`);
  const box = document.getElementById("record-more");
  if (!box || state.open !== "r:" + r.key) return;
  if (!reply.ok) {
    box.textContent = "The server could not read this record: " + (await reply.text());
    return;
  }
  const full: { details: unknown } = await reply.json();
  const d = full.details && typeof full.details === "object" ? (full.details as Record<string, unknown>) : {};
  const list = Array.isArray(d.files) ? d.files.filter((f): f is Record<string, unknown> => !!f && typeof f === "object") : [];
  const files = list.length
    ? `<h4>Files · ${list.length}</h4><table class="files">${list
        .map((f) => {
          const href = typeof f.url === "string" ? f.url : "";
          const name = typeof f.name === "string" ? f.name : href.split("/").at(-1) ?? "";
          const size = typeof f.width === "number" && typeof f.height === "number" ? `${f.width} × ${f.height}` : typeof f.kind === "string" ? f.kind : "";
          const bytes = typeof f.bytes === "number" ? ` · ${(f.bytes / 1e6).toFixed(1)} MB` : "";
          return `<tr><td><a href="${esc(href)}" target="_blank" rel="noopener">${esc(name)}</a></td><td>${esc(size + bytes)}</td></tr>`;
        })
        .join("")}</table>`
    : "";
  box.innerHTML = `${files}<details><summary>Full retained record</summary><pre>${esc(JSON.stringify(full.details, null, 2))}</pre></details>`;
}
async function openDrawer() {
  const key = state.open;
  if (!key) {
    drawer.classList.remove("open");
    scrim.classList.remove("open");
    return;
  }
  const at = key.indexOf(":"), kind = key.slice(0, at), value = key.slice(at + 1);
  if (kind === "p") {
    const p = proposals.find((p) => p.id === value);
    drawer.innerHTML = p ? proposalDrawer(p) : top("Proposal") + `<div class="content">No proposal P${esc(value)}.</div>`;
  } else if (kind === "b") drawer.innerHTML = bodyDrawer(value);
  else if (kind === "r") {
    const r = rows.find((r) => r.key === value);
    drawer.innerHTML = r ? recordDrawer(r) : top("Record") + `<div class="content">No record ${esc(value)}.</div>`;
    if (r) void fillRecord(r);
  } else if (kind === "doc") {
    drawer.innerHTML = top(value) + `<div class="content prose">Reading…</div>`;
    const text = await (await fetch("/api/doc?name=" + encodeURIComponent(value))).text();
    if (state.open === key) drawer.innerHTML = top(value) + `<div class="content prose">${markdown(text)}</div>`;
  }
  drawer.scrollTop = 0;
  drawer.classList.add("open");
  scrim.classList.add("open");
}

// ---------- search and events

let searchTimer = 0, searchTurn = 0;
async function runSearch() {
  if (state.view !== "records" || !state.q.trim()) {
    state.matched = null;
    state.searching = false;
    return render();
  }
  const turn = ++searchTurn;
  state.searching = true;
  render();
  const reply = await fetch("/api/match?q=" + encodeURIComponent(state.q));
  if (turn !== searchTurn) return;
  const found: number[] = reply.ok ? await reply.json() : [];
  state.matched = new Set(found);
  state.searching = false;
  render();
}
search.addEventListener("input", () => {
  state.q = search.value;
  state.limit = 150;
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(runSearch, state.view === "records" ? 280 : 0);
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.facetFilter) return;
  const key = target.dataset.facetFilter as Key;
  state.facetText[key] = target.value;
  const at = target.selectionStart;
  renderFacets();
  const again = facetsBox.querySelector<HTMLInputElement>(`[data-facet-filter="${key}"]`);
  again?.focus();
  if (again && at !== null) again.setSelectionRange(at, at);
});
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-act]") : null;
  if (!target) return;
  const { act, k, v = "" } = target.dataset;
  const key = k as Key | undefined;
  if (act === "view") {
    state.view = v as View;
    state.limit = 150;
    state.facetText = {};
    state.expanded.clear();
    void runSearch();
    return;
  }
  if (act === "facet" && key) {
    state.filters[key] = state.filters[key] === v ? "" : v;
    state.limit = 150;
  } else if (act === "clear" && key) state.filters[key] = "";
  else if (act === "more" && key) state.expanded.add(key);
  else if (act === "show-more") state.limit += 150;
  else if (act === "open") {
    state.open = v;
    void openDrawer();
  } else if (act === "close") {
    state.open = "";
    void openDrawer();
  } else if (act === "go-records" && key) {
    for (const k of recordKeys) state.filters[k] = "";
    state.filters[key] = v;
    if (target.dataset.body) state.filters.target = target.dataset.body;
    state.view = "records";
    state.open = "";
    state.limit = 150;
    void openDrawer();
    void runSearch();
    return;
  }
  render();
});
scrim.addEventListener("click", () => {
  state.open = "";
  void openDrawer();
  saveUrl();
});
element("guide").addEventListener("click", () => {
  state.open = "doc:README.md";
  void openDrawer();
  saveUrl();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.open) {
    state.open = "";
    void openDrawer();
    render();
  } else if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});

await runSearch();
void openDrawer();
