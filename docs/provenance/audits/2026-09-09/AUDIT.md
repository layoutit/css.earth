# Provenance and documentation audit — 9 September 2026

Owner: **PROVENANCE DOCUMENTATION**. The initial audit examined files and
contributor instructions. Follow-up checks are recorded below.

The initial findings below describe their recorded snapshots. The
[final review](ADVERSARIAL-REVIEW.md#complete-migration-and-final-review) records
the completed migration of all body documentation. The
[committed-file cleanup](#committed-file-cleanup) records the subsequent repository audit.

These findings led to the proposal. The [adversarial review](ADVERSARIAL-REVIEW.md)
then removed the proposed extra report format and validator. The contract now
uses existing reports and maps its rules to PDS4 Standards Reference 1.26.0 and
the corresponding handbook. The actions below describe that revised proposal.

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

## Committed-file cleanup

The follow-up inventory read commit `1f25d9e62b6fa5433f4b27a5610b0d9b22de16e1`
on 10 September 2026 UTC, using the same inventory command. Logical file sizes:

| Files | Count | Size |
| --- | ---: | ---: |
| All tracked files | 24,290 | 7,080,280,681 bytes |
| `docs/` | 1,551 | 551,378,475 bytes (525.84 MiB) |
| Six evidence archives within `docs/` | 6 | 249,850,798 bytes (238.28 MiB) |
| PNG captures within `docs/` | 308 | 221,839,102 bytes (211.56 MiB) |
| Body `prepared/` records | 7,341 | 5,698,241,152 bytes (5.31 GiB) |

The largest storage cost is prepared body data, which clean checkouts consume.
This audit does not establish that it can be removed or restored elsewhere.
The tracked tree contains no files under `output/`, `.local/`, `node_modules/`
or `dist/`. The initial sparse-worktree query reported 409 tracked files matching
ignore rules. The complete-tree check below corrects that undercount.

Changes made:

- Removed `docs/comets/evidence/103p-repeat-capture.png`: its 558,212 bytes exactly
  match [103p.png](../../../comets/evidence/103p.png), which the qualification
  report already links. No report or recipe references the repeat filename.
  The historical inventory retains both original paths.
- Removed the two forwarding-only evidence/provenance README pages and linked
  their destinations directly from the [documentation map](../../../README.md).
- Corrected the root README's architecture link and marked the three earlier
  shared-runtime documents as records of the eleven-object version.
  Their recorded results, hashes and limits remain unchanged.

The other large duplicate reports are pinned snapshots inside saved review
records. Their existing paths and bytes remain in place. All six evidence
archives match their receipts' byte counts, SHA-256 pins and member counts;
their saved mappings make original local paths retrievable from the archives.
This cleanup does not reduce Git history or restore captures absent from those
archives.

## Source tracking and restoration

At `a285ac26262d2cbdd0c085dfda2232c7b7ad239c`, **498 tracked source files matched
ignore rules**. The earlier query missed 89 paths outside the sparse checkout.
The complete check feeds every Git path to
`git check-ignore --no-index --stdin -z`.

Changes made:

- Corrected ignore rules for required models, material images, source metadata
  and inspected evidence. These files have no complete restoration operation.
  CI now rejects tracked files that match ignore rules.
- Added **125 missing source files (6,753,680 bytes)** from existing local copies.
  Every file matches its previously committed manifest size and SHA-256.
- Removed **18 raw downloads (25,871,428 bytes)** from tracking after restoring
  each into an initially absent path in a temporary directory and comparing it
  with the original Git blob. Their acquisition operations and manifest pins remain committed.
- Added nine missing download operations in Mercury, Venus, Mars and Saturn.
  Each restored the existing manifest pin. The Google Sun references remain
  ignored; their existing records still state that redistribution is unverified.
- Connected Earth's existing offline MUR mosaic restoration to the checkout
  command. A fresh reconstruction from the committed tile archive produced the
  pinned 16,384 × 8,192 PNG: 22,564,700 bytes,
  SHA-256 `eb4f6ee98ea4293de369acd709110f8970f503dcc5b523a6a9124a6f39f5a3f0`.
  This avoids committing another copy of that image.

Four Zenodo originals remain tracked because both tested download routes returned
HTTP 403. Mars's navigation image is now tracked from its pinned local copy:
its upstream URL returns different bytes. The saved originals preserve the manifest identities.

The [download receipt](source-restoration.json) contains all 22 restoration
results and the four alternate-route failures. Its `sourceRuns` names identify
the original temporary run files; their results are included in the receipt.
The [missing-source receipt](missing-source-restoration.json) records the nine
successful downloads and the changed Mars image. These checks used the recorded
revision's existing restoration code and pins.

At source-cleanup commit `89d1cb974`, the index had **zero tracked files matching
ignore rules**. All recovered
files were checked against their pins again after staging. An independent check
covered all 10,780 required entries in 408 manifests: 9,162 have tracked files,
1,617 have acquisition operations and one uses Earth's offline mosaic restore.
No entry lacks both a tracked file and a restoration definition. Twelve focused
provenance tests and three checkout-restoration tests passed. The latter check
Earth's restoration order, preservation of existing files and rejection of
wrong hashes. Regenerated provenance for the four changed bodies retains
`basis: recovered`; product and recipe records are unchanged.

These checks do not establish availability of every upstream service or rerun
full body preparation, scientific qualification or browser comparisons.

## Integration with the latest body sources

The PR then integrated main at `e54f2aa4f696ec226793510276a7716448057c37`, which
added Chariklo, Bienor and 67P's southern OSIRIS observations. The two new bodies
use the same README layout. The shared source-authoring script now preserves
those reviewed READMEs instead of recreating SOURCE files.

The complete source check now covers **410 manifests and 10,825 required entries**:
9,199 have tracked files, 1,625 have acquisition operations and one uses Earth's
offline mosaic restore. Zero tracked paths match ignore rules; no source entry
lacks both committed bytes and a restoration definition. These are availability
checks of the repository structure, not fresh downloads of every input.

The existing generators resolved Sun's merged metadata and rebuilt the minimap
for all 410 registered bodies. Twelve focused provenance tests and five minimap
tests passed against the integrated files.

For 67P, all 16 active GEO/quality observation dates were checked against their
own native labels. Eight October–November 2015 fields incorrectly repeated an
August 2014 timestamp and were corrected. The source files and their byte/hash
pins are unchanged. The regenerated provenance is marked `recovered` because
this edit did not rerun preparation. Recipe and product identities and coverage
are unchanged; the earlier prepared record and qualification reports remain in
the integrated main revision.

Final documentation checks: all 414 body accounts use README, and no body SOURCE,
USAGE or EVIDENCE account remains. All 410 required-package checks and 3,432 local
links in 483 changed Markdown files passed. The package check also rejected a
missing README.

## Integration of the remaining population packages

Main then advanced to `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`, adding 22 body
packages. Their source accounts were merged into the same README layout. Three
active Python authors now preserve reviewed READMEs instead of creating SOURCE
files; their scientific output code is unchanged.

This integration omitted 17 required context images. Existing local copies of
all 17 matched the committed manifest pins and were added: **1,162,889 bytes**.
Together with the earlier recovery, this PR restores **142 missing files
(7,916,569 bytes)**. The checkout tests now check every registered manifest for
committed inputs or an acquisition path, with Earth's tested offline restore as
the sole separate path. CI runs those tests, including a missing-context failure
case, and rejects ignored tracked files.

The complete index covers **432 manifests and 11,413 required entries**: 9,723
have committed files, 1,689 have acquisition operations and one uses Earth's
offline restore. No entries lack both paths, and zero tracked files match ignore
rules. All four checkout tests and five minimap tests pass. Sun's regenerated
provenance matches its merged manifest, and the minimap contains all 432 bodies.

All 436 body accounts use README. Package presence checks for all 432 registered
bodies and 3,699 local links in 506 changed Markdown files passed. The 22 added
READMEs passed layout checks at 1,200 and 390 pixels: source, evidence and known
problems appear first, methods start collapsed and no page overflows.
