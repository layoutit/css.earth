# Provenance and documentation audit — 9 September 2026

Owner: **PROVENANCE DOCUMENTATION**. This is a repository-content and workflow
audit, not scientific recertification or a fresh browser/asset qualification.

## Scope and reproducibility

The GitHub API reported private repository `layoutit/cssEarth`, default branch
`main`, at **`2f6f8614add9a5a22ef03b86a47edef631950ade`** during the audit.
The shared local checkout initially had HEAD
`c2b0bbb9d48058a5b248ee5fc1c5f4ca5b024e0a` and a large staged integration.
These are different candidates, not contradictory body counts.

The [inventory](inventory.json) read Git blobs at those two immutable commits
and captured the stage-zero index on **2026-09-09 20:31:12–20:31:23 UTC**.
Its before/after index fingerprints matched. Other agents subsequently changed
the shared checkout; this report remains about the captured candidates.
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
imports in `site/objects.mjs` supply the inventory's registry candidates; this
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
not a failed source closure when acquisition is supported.

`src/platform/source-manifest.mjs` and the shared object operations validate
identities and source closure. `tools/objects/provenance.mjs`, its recipe
bindings and `tools/object-provenance.test.mjs` establish actual product lineage.
[Prepared object provenance](../../../object-provenance.md) already makes the
recovered/prepared distinction and limits its coverage. Preserve that work.

The B7 moon records retain original report/screenshot hashes and a portable
copy map; they separate hidden-input checks from public Settings access and
preserve failed aggregate checks. Comet imagery documentation distinguishes
new-input restoration from copied old inputs and prior-atlas comparisons from
native/source parity. The asteroid archive receipts pin archives and members.
These are useful patterns to unify, not evidence to discard.

## Findings and action

**F1 — Contributor instructions contradict current ownership.**
At the audited main, `src/planets/README.md` requires private package runtimes,
Astro pages and tool suites. `tests/objects/source-closure.test.mjs` instead
requires data-only body directories and forbids those executable owners.
The root README still describes the generic migration as Mercury/Venus-only.
The package README also says `pnpm test` runs body tests, while `package.json`
excludes that separate runner. The PR replaces the stale onboarding with the
authored package layout and verified command boundaries.

**F2 — Package entry points do not track delivered work consistently.**
Only **76/404** packages have a README. Rhea's SOURCE and NOTICE omit the newly
delivered VIMS views documented under `source/vims/` and the B7 batch. SOURCE
still describes intake/qualification as pending and remote installation as
unproven, while the batch reports scoped installation and browser results.
67P's README still describes four August photographs despite the integrated
six-image mosaic. Sun SOURCE names a removed per-body reproduction script.
The PR corrects these concrete examples and pilots four body entry points.
It does not automatically recertify the remaining packages.

**F3 — Documentation delivery is dominated by raw evidence.**
At main, docs contain **133 Markdown files / 3,467,791 bytes**, **606 JSON
files / 55,448,453 bytes**, **225 PNGs / 151,848,893 bytes**, and six `.tar.gz`
archives totaling **249,850,798 bytes (238.28 MiB)**. There are also 107 logs,
52 WebPs and 52 executable scripts (`.mjs`, `.py`, `.sh`) among the docs.
The largest archive is 58,666,735 bytes. That evidence has value, but current
placement mixes reading material, working tooling and delivery payloads.
The contract introduces compact receipts, justified size thresholds and durable
artifact requirements. Existing archives remain intact until an approved,
verified replacement exists. No storage provider or retention promise is invented.

**F4 — Portable artifact identity varies between producers.**
The local-path triage found **268 Markdown/JSON files** with local references.
This is not a count of broken evidence: B7's browser index correctly maps
working paths to committed reports and hashes. Conversely, the new comet
`surface-imagery-visuals.json` points original before/after screenshots at
ignored `output/playwright/` paths, while explicitly pinning the committed
front-view comparison composites. The receipt does not map those original
frame paths to portable artifacts. Their Git paths alone cannot retrieve them.
Require original-to-delivered artifact mapping, with exact comparison roles;
do not infer availability of every original from an available composite.

**F5 — Qualification freshness is scattered across prose and custom reports.**
Evidence appears under `docs/evidence/`, body-family folders, batch-number
folders, loose JSON and archives. Reports use different top-level candidates
such as `base`, `sourceCommit`, `implementationCommit` and run-specific fields.
This does not make them invalid, but it forces each reader to reconstruct
which revision and claim a “pass” covers. At main, **395/404** prepared lineage
records have `basis: recovered`; **9** have `basis: prepared`. Neither count
establishes fresh reproduction or accepted visuals. Add a common envelope and
README pointers while preserving producer reports and their limits.

**F6 — Repeated evidence complicates navigation even when Git deduplicates it.**
The identical 4,451,366-byte B2 integrated capture report exists both as
`final/integrated-2026-09-09T03-59-04.219Z.json` and
`final/reviews/four-body/capture-report-snapshot.json`. Other identical blobs
bring redundant checked-out doc bytes to **5,968,185** at main.
Git stores identical blobs once, so this is not a claim of equal repository
object-store savings. Future indexes should reference one original; migration
must preserve historical reference meaning and links.

**F7 — Rights strings are stronger than nothing, but support is uneven.**
All required source records are present, and the existing validator checks
license/credit/redistribution text. **604/2,269 input entries** lack the optional
`licenseEvidence` field. Some may contain terms evidence elsewhere; this count
does not establish a rights violation. The contract requires an explicit terms
reference for new/changed upstream inputs or an honest unresolved disposition.
The audit did not independently verify every provider's current terms.

**F8 — The most current contributor workflow is machine-local.**
The installed celestial skill is substantially ahead of the old package README:
it understands authored recipes, independent scientific anchors, unresolved
sources, fresh-install boundaries and unbound comparisons. But it is outside Git
and does not give portable evidence or body-doc maintenance a canonical owner.
The PR commits the skill and six references under
`.agents/skills/celestial-skill/`, routes it to the shared contract, and preserves
the detailed scientific guidance. [Import identities](skill-import.json) pin the
eight original skill files before those focused edits. Historical implementation
examples retain their revision bounds; they are not new qualification claims.

## Enforcement and limits

The only tracked GitHub workflow in the audited snapshot is
`.github/workflows/universe.yml`. It selects shared universe, renderer and shell
checks; it does not enforce this new documentation/evidence envelope or execute
complete all-body scientific/browser qualification. Existing executable source,
provenance and package checks remain the authority for their respective claims.

This PR supplies the shared contract, skill, corrected onboarding, templates,
four practical entry points and the audit. The envelope remains a proposed
format until a producer and validator are integrated. Bulk evidence relocation,
full-registry documentation migration, remote storage, individual licensing
decisions and complete application qualification are not claimed as completed.

No browser was rerun and no body assets were regenerated for this documentation
change. Validation: the skill validator passed; 151 relative documentation links
passed before adding the checker usage note; the link checker rejected missing
file, missing anchor and deleted-target fixtures while accepting a valid target.
The immutable-main inventory reproduced all 22 snapshot fields exactly.
`git diff --check` passed. The final PR records the final link-check count.
These checks do not establish scientific or application qualification.
