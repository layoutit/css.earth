# Provenance and documentation audit — 9 September 2026

Owner: **PROVENANCE DOCUMENTATION**. This audit examines files and contributor
instructions. It does not rerun scientific, browser or installation tests.

These findings led to the proposal. The [adversarial review](ADVERSARIAL-REVIEW.md)
then removed the proposed extra report format and validator. The contract now
uses existing reports; the actions below describe that revised proposal.

## Scope and reproducibility

The GitHub API reported private repository `layoutit/cssEarth`, default branch
`main`, at **`2f6f8614add9a5a22ef03b86a47edef631950ade`** during the audit.
The shared local checkout initially had HEAD
`c2b0bbb9d48058a5b248ee5fc1c5f4ca5b024e0a` and a large staged integration.
These revisions contain different numbers of bodies.

The [inventory](inventory.json) read Git blobs at those two immutable commits
and captured the stage-zero index on **2026-09-09 20:31:12–20:31:23 UTC**.
Its before/after index fingerprints matched. Other agents subsequently changed
the shared checkout; this report describes the recorded revisions and index.
No staged data, source inputs, captures or existing evidence were changed by
the audit. Implementation uses an isolated branch from the audited main.

Reproduce the immutable-commit measurements with
`tools/audits/provenance-documentation-inventory.py --repo <checkout> --ref <commit> --output <report.json>`.
`--ref` can be repeated; `--index` inspects the index at execution time.
The saved index summary is a historical observation, not a replayable full tree:
its fingerprint does not reconstruct the old index. The two commit snapshots
remain replayable. The script reads metadata/text; it does not acquire raw sources.

All sizes below are **logical Git blob bytes at the snapshot**, not compressed
clone size, pack/history size, network transfer or memory. Static descriptor
imports in `site/objects.mjs` supply the inventory's body list; this
does not execute the registry or establish that those bodies render.

| Snapshot | Body descriptor imports / source manifests | Files under docs | Docs bytes |
| --- | ---: | ---: | ---: |
| GitHub main `2f6f8614` | 404 / 404 | 1,264 | 474,536,291 (452.55 MiB) |
| Initial local HEAD `c2b0bbb9` | 406 / 406 | 1,044 | 424,449,367 (404.79 MiB) |
| Captured index | 406 / 406 | 1,282 | 474,791,619 (452.80 MiB) |

## What already works

All 404 main-snapshot packages have SOURCE, NOTICE, source manifest, authored
descriptor, prepared provenance and runtime inventory files. The manifests
account for **2,269 inputs**, **7,986 documents** and **375 intermediates**.
Many original inputs intentionally live outside Git; absence from a Git tree is
not a missing input if the acquisition recipe can restore it.

`src/platform/source-manifest.mjs` and the shared object operations validate
required files and their hashes. `tools/objects/provenance.mjs`, its recipe
bindings and `tools/object-provenance.test.mjs` connect outputs to their sources.
[Prepared object provenance](../../../object-provenance.md) already makes the
recovered/prepared distinction and limits its coverage. Preserve that work.

The B7 moon records save report and screenshot hashes and map working files to
committed copies. They distinguish hidden-input checks from public Settings
access and keep failed full-suite results. Comet imagery documentation distinguishes
new-input restoration from copied old inputs and prior-atlas comparisons from
native/source parity. The asteroid archive receipts pin archives and members.
Use these examples when writing new reports.

## Findings and action

**F1 — Contributor instructions contradict the current package rules.**
At the audited main, `src/planets/README.md` requires private package runtimes,
Astro pages and tool suites. `tests/objects/source-closure.test.mjs` instead
requires data-only body directories and forbids those private tools and runtimes.
The root README still describes the generic migration as Mercury/Venus-only.
The package README also says `pnpm test` runs body tests, while `package.json`
excludes that separate runner. The PR corrects the package layout and explains
which tests each command runs.

**F2 — Body introductions and source notes lag behind the data.**
Only **76/404** packages have a README. Rhea's SOURCE and NOTICE omit the newly
delivered VIMS views documented under `source/vims/` and the B7 batch. SOURCE
still describes intake/qualification as pending and remote installation as
unproven, while the batch reports installation and browser checks for selected cases.
67P's README still describes four August photographs despite the integrated
six-image mosaic. Sun SOURCE names a removed per-body reproduction script.
The PR fixes these examples and puts sources, processing, evidence and known
problems together in four body READMEs. The other bodies still need their documentation checked.

**F3 — Documentation delivery is dominated by raw evidence.**
At main, docs contain **133 Markdown files / 3,467,791 bytes**, **606 JSON
files / 55,448,453 bytes**, **225 PNGs / 151,848,893 bytes**, and six `.tar.gz`
archives totaling **249,850,798 bytes (238.28 MiB)**. There are also 107 logs,
52 WebPs and 52 executable scripts (`.mjs`, `.py`, `.sh`) among the docs.
The largest archive is 58,666,735 bytes. That evidence has value, but current
placement mixes reading material, working tooling and delivery payloads.
The contract asks contributors to save the evidence needed for review and
explain unusually large additions in the PR. Existing archives stay in place
until a replacement is authorized and verified. No storage service is selected.

**F4 — Some reports do not point to saved copies of their evidence.**
The local-path search found **268 Markdown/JSON files** with local references.
This is not a count of broken evidence: B7's browser index correctly maps
working paths to committed reports and hashes. Conversely, the new comet
`surface-imagery-visuals.json` points original before/after screenshots at
ignored `output/playwright/` paths, while explicitly pinning the committed
front-view comparison composites. The receipt does not map those original
frame paths to saved copies. Those local paths cannot retrieve them from Git.
Record where the original images can be opened and what each image shows.
A saved comparison image does not mean all its original frames were saved too.

**F5 — It is hard to tell which version a passing report describes.**
Evidence appears under `docs/evidence/`, body-family folders, batch-number
folders, loose JSON and archives. Reports use different revision fields
such as `base`, `sourceCommit`, `implementationCommit` and run-specific fields.
This does not make them invalid, but it forces each reader to reconstruct
which revision and claim a “pass” covers. At main, **395/404** prepared lineage
records have `basis: recovered`; **9** have `basis: prepared`. Neither count
shows that preparation was reproduced or visuals were checked. Link existing
reports from the body docs and state what each tested. Reuse the existing file
identities and test results; no extra report format is needed.

**F6 — Repeated evidence complicates navigation even when Git deduplicates it.**
The identical 4,451,366-byte B2 integrated capture report exists both as
`final/integrated-2026-09-09T03-59-04.219Z.json` and
`final/reviews/four-body/capture-report-snapshot.json`. Other identical blobs
bring redundant checked-out doc bytes to **5,968,185** at main.
Git stores identical blobs once, so this is not a claim of equal repository
object-store savings. Future indexes should reference one original; migration
must preserve historical reference meaning and links.

**F7 — Some terms records lack a supporting reference.**
All required source records are present, and the existing validator checks
license/credit/redistribution text. **604/2,269 input entries** lack the optional
`licenseEvidence` field. Some may contain terms evidence elsewhere; this count
does not establish a rights violation. The contract requires an explicit terms
reference for new/changed upstream inputs or a statement of what remains unresolved.
The audit did not independently verify every provider's current terms.

**F8 — The current celestial skill is outside Git.**
The installed celestial skill is substantially ahead of the old package README:
it understands authored recipes, independent scientific anchors, unresolved
sources, fresh-install boundaries and unbound comparisons. But it is outside Git
and does not explain where to save test evidence or update body docs.
The PR commits the skill and six references under
`.agents/skills/celestial-skill/`, routes it to the shared contract, and preserves
the detailed scientific guidance. [Import identities](skill-import.json) pin the
eight original skill files before those focused edits. Historical implementation
examples keep the revisions where they were checked.

## Checks and unfinished work

The only tracked GitHub workflow in the audited snapshot is
`.github/workflows/universe.yml`. It selects shared universe, renderer and shell
checks. It does not check this documentation contract or run all scientific and
browser tests for every body. Keep using the existing source, provenance and
package tests for the behavior they cover.

This PR adds the contract, skill, corrected contributor guide, four body examples
and this audit. It uses existing report formats. Checking all remaining body
docs, relocating evidence and choosing remote storage are unfinished. This audit
does not resolve individual licensing questions or verify the full application.

No browser was rerun and no body assets were regenerated for this documentation
change. Validation: the skill validator passed; 151 relative documentation links
passed before adding the checker usage note; the link checker rejected missing
file, missing anchor and deleted-target fixtures while accepting a valid target.
The immutable-main inventory reproduced all 22 snapshot fields exactly.
`git diff --check` passed. The final PR records the final link-check count.
These checks cover the documentation and helpers, not the scientific data or application.
