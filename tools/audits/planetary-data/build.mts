import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import {
  root,
  json,
  array,
  object,
  string,
  number,
  queryUrl,
  loadRows,
  tsv,
} from "./model.mts";
const opus = object(await json("evidence/opus.json")),
  prior = object(await json("evidence/previous-audits.json")),
  receipt = object(opus.receipt),
  revision = string(receipt.revision),
  rows = array(opus.rows).map(object),
  plans = array(await json("opus-proposals.json")).map(object),
  old = array(prior.proposals).map(object),
  all = [...old, ...plans];
const count = number(receipt.totalRecords),
  sum = (values: unknown[]) =>
    values.reduce<number>((s, v) => s + number(object(v).count), 0);
if (sum(rows) !== count || sum(array(opus.volumes)) !== count)
  throw Error("OPUS partitions disagree");
const byNumber = new Map(all.map((p) => [string(p.id).split("-")[0], p]));
if (byNumber.size !== all.length) throw Error("Duplicate proposal number");
for (const r of rows) {
  if (!string(r.reason).trim()) throw Error("Missing reason");
  for (const p of array(r.proposals).map(string))
    if (!byNumber.has(p)) throw Error("Dangling proposal " + p);
}
for (const p of plans)
  if (
    !rows.some((r) => array(r.proposals).includes(string(p.id).split("-")[0]))
  )
    throw Error("Orphan new proposal " + p.id);
const md = (v: unknown) =>
  String(v ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
const baseline = "https://github.com/layoutit/css.earth/blob/" + revision + "/";
await mkdir(root + "/proposals", { recursive: true });
for (const p of plans) {
  const probes = array(p.probes).map(string),
    products = array(opus.products)
      .map(object)
      .filter((v) => probes.includes(string(v.id)));
  let out = `# ${p.title}\n\nProposal ${string(p.id).split("-")[0]} · **${p.phase}** · Priority ${p.priority}\n\nCompared with [cssEarth ${revision.slice(0, 12)}](https://github.com/layoutit/css.earth/tree/${revision}) on 27 September 2026. This is proposed work, not a qualified dataset.\n\n## Problem and proposed result\n\n${p.current}\n\n${p.result}\n\nContent owners: ${array(
    p.bodies,
  )
    .map((b) => `[${b}](${baseline}src/objects/${string(b)}/README.md)`)
    .join(
      ", ",
    )}.\n\n## Evidence\n\n${p.evidence}\n\n## Work\n\n${p.work}\n\n## Limits and prior decisions\n\n${p.limit}\n\n## Acceptance\n\n${p.checks}\n\nFollow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.\n\n## Examined source products\n\n`;
  for (const v of products) {
    const s = object(v.sample),
      label = array(opus.labelReceipts)
        .map(object)
        .find((r) => r.id === v.id);
    out += `- [${s.opusid}](${queryUrl("data.json", v.query)}): ${s.observationtype}, ${s.quantity}, ${s.time1}. ${label ? `[Read native label](../evidence/labels/${label.file}) · [Original label](${label.url}).` : ""}\n`;
  }
  out +=
    "\nThe product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.\n";
  await writeFile(root + "/proposals/" + p.id + ".md", out);
}
for (const p of all) {
  const num = string(p.id).split("-")[0],
    assigned = rows.filter((r) => array(r.proposals).includes(num));
  let text = await readFile(root + "/proposals/" + p.id + ".md", "utf8");
  text = text.replace(/\n<!-- opus:start -->[\s\S]*?<!-- opus:end -->\n?/, "");
  text = text.replaceAll(
    "../proposal-coverage.json",
    "../evidence/previous-audits.json",
  );
  if (assigned.length) {
    text += `\n<!-- opus:start -->\n## OPUS extension: 27 September 2026\n\n${assigned.length} instrument/target slices connect to this work at [${revision.slice(0, 12)}](https://github.com/layoutit/css.earth/tree/${revision}). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.\n\n| Instrument | Intended target | Records | Decision |\n| --- | --- | ---: | --- |\n`;
    for (const r of assigned)
      text += `| ${md(r.instrument)} | [${md(r.target)}](${queryUrl("data.json", r.query)}) | ${r.count} | ${r.decision} |\n`;
    text +=
      "\nEvery source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).\n<!-- opus:end -->\n";
  }
  await writeFile(root + "/proposals/" + p.id + ".md", text);
}
let index = `# Data PR proposals\n\n**${all.length} proposals**: 95 retained from the PSI PDS4, USGS and individual Photojournal audits, plus ${plans.length} OPUS proposals. Qualification scopes are not ready datasets.\n\n[Audit method and current findings](../README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Prior coverage](../evidence/previous-audits.json) · [OPUS evidence](../evidence/opus.json) · [Scope](contract.md)\n\nThe first 95 retain their original revision and evidence. OPUS additions use ${revision}. Native-source overlap extends an existing proposal instead of creating a duplicate.\n\n| Proposal | Phase | Priority | OPUS target/instrument slices |\n| --- | --- | ---: | ---: |\n`;
for (const p of all)
  index += `| [${md(p.title)}](${p.id}.md) | ${p.phase} | ${p.priority} | ${rows.filter((r) => array(r.proposals).includes(string(p.id).split("-")[0])).length} |\n`;
await writeFile(root + "/proposals/README.md", index);
let report = `# OPUS catalogue review\n\n[Method, limits and baseline](README.md) · [All proposals](proposals/README.md)\n\n${rows.length} target/instrument slices partition ${count.toLocaleString("en-US")} OPUS records. Each slice has an explicit disposition and query; two earliest metadata samples per slice are retained. This is a complete catalogue partition, not an individual scientific review of every observation.\n\n| Instrument | Intended target | Records | Decision | Proposals | Reason |\n| --- | --- | ---: | --- | --- | --- |\n`;
for (const r of rows)
  report += `| ${md(r.instrument)} | [${md(r.target)}](${queryUrl("data.json", r.query)}) | ${r.count} | ${r.decision} | ${array(
    r.proposals,
  )
    .map((n) => `[${n}](proposals/${object(byNumber.get(string(n))).id}.md)`)
    .join(", ")} | ${md(r.reason)} |\n`;
await writeFile(root + "/opus-review.md", report);
const allRows = await loadRows();
// Existing Photojournal prose retains individual decisions; remove dead scratch-only links.
let photo = await readFile(root + "/photojournal-audit.md", "utf8");
photo = photo
  .replace("[Filter and export rows](photojournal.html) · ", "")
  .replace(
    "[JSON](photojournal-audit.json)",
    "[Structured decisions](evidence/previous-audits.json)",
  )
  .replace(
    "[Original decision TSV](photojournal-review.tsv)",
    "[Slice and export](README.md#slice-the-audit)",
  );
await writeFile(root + "/photojournal-audit.md", photo.trimEnd() + "\n");
console.log(
  JSON.stringify(
    {
      proposals: all.length,
      newProposals: plans.length,
      extendedPriorProposals: old.filter((p) =>
        rows.some((r) =>
          array(r.proposals).includes(string(p.id).split("-")[0]),
        ),
      ).length,
      opusSlices: rows.length,
      observations: count,
      allSliceRows: allRows.length,
      files: (await readdir(root + "/proposals")).length,
    },
    null,
    2,
  ),
);
