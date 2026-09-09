# Adversarial review of the documentation proposal

The maintainer asked for clear provenance without overengineering or unnecessary
ceremony. Two independent agents reviewed PR #83 and the changes that moved
detailed results out of READMEs. They then checked the revised instructions.

| Problem found | Change made |
| --- | --- |
| A mandatory JSON report, ten field groups, a second run document and body index repeated existing reports. | Removed. Use an existing report; add an index only when several reports need connecting. |
| Manual dependency lists repeated generated records. | Link existing manifests and reports. Record any missing revision, uncommitted changes or ignored/served file hashes needed to identify the test. |
| SOURCE had to repeat every dataset mapping, and NOTICE updates were required for every change. | Explain meaning and calculations missing from generated records. Update NOTICE when credits or terms change. |
| Fixed size thresholds and unrelated historical cleanup added paperwork. | Explain unusually large additions once. Fix older records needed for the task. |
| Preparation could be called reproduction without comparing against an expected result. | Name the expected inventory before running and compare outputs against it. State any allowed tolerance before comparing. |
| A report's permanent `CURRENT` flag would become misleading. | Keep the tested version and outcome. Explain reuse for a named new version in the maintained evidence note. |
| A hash of processed input could be mistaken for the original download's hash. | Explain conversion steps and say when the original download's identity is unknown. |

Both reviewers confirmed that their findings were addressed. After the
plain-language rewrite, a further check caught two requirements that needed
clearer wording: exact hashes for otherwise unrecorded files, and no pixel-match
claim from images with different sources or framing. Both are explicit in the
[contract](../../CONTRACT.md) and its relevant [examples](https://github.com/layoutit/cssEarth/blob/c0e73410e15e8967e757d9edba4457846e2a4884/docs/provenance/TEMPLATES.md).

The reviewers checked the instructions. They did not download sources, build
the application or run browser tests. Existing body data and results still need
the checks appropriate to each change.

The maintainer subsequently rejected the separate introduction, evidence index
and usage files as too fragmented. The current layout puts sources, processing,
results and known problems in each body README. Original reports stay under
`docs/`; detailed source notes stay beside the data. Shared usage belongs in the
repository guides. The earlier reviews did not establish that the fragmented
layout was useful.

A further read-only review checked the final standards mapping against PDS4
Standards Reference 1.26.0 and Data Provider’s Handbook 1.26.0. It found no
remaining issues in the mapping, provenance requirements or document layout.
The four examples' added dataset identifiers matched the existing source records.
This review did not run builds, preparation or browser tests.

## Consolidating the body files

A later review found that README and SOURCE still repeated source explanations.
The revised contract makes README the single account and keeps a separate method
note only for substantial decoding, field definitions or calculations. Earth,
Sun, Rhea and 67P now use that layout; their duplicate root SOURCE files and the
repeated template document have been removed.

Two reviewers checked the consolidation against the earlier documents, active
code, authored data and reports. Their concrete findings were corrected:

- Package validation and a shell test still required the SOURCE filename. The
  validator now accepts README or legacy SOURCE; the shell test uses that same
  validator. A package missing both is rejected.
- Earth's active audit and tomography instructions, three shared reports and two
  NOTICE files still pointed to removed documents. Active links now use README;
  historical paths and hashes remain attached to their original revisions.
- Earth source notes described discarded automatic cloud switching, treated
  recorded geometry publication as future work and confused the photographic
  sky with its registration catalog. README now follows the manual-selection
  test, dated publication report and ESO/HYG source records.
- Rhea's obsolete albedo exclusion was removed, while its terrain/shadow
  contamination warning was retained and checked against page 1 of the pinned
  producer assessment. Sun's AIA false-color and logarithmic display remain
  explicit.
- Earth repeated UI history, frame counts and delivery instructions. The README
  keeps the scientific methods and links the existing operational documents.
- The local-link checker missed a target added after the review base and then
  removed. It now includes working-tree deletions relative to HEAD; a temporary
  Git fixture proves this case is rejected.

The source-to-output records have distinct consumers. The exception is the
retained `prepared/runtime-assets.json` copy: all 397 pairs at `c0e73410e`
matched their root inventory blobs. Preparation writes both, provenance uses
the prepared copy and delivery uses the root copy. The contract documents that
relationship without adding another manually maintained record.

Validation for this consolidation:

- Four focused tests in `site/test/object-package-contract.test.mjs` passed,
  including README-only, SOURCE-only and missing-documentation cases in a complete
  temporary package. Corrupt assets and undeclared source files still fail.
- Required-file presence passed for all 406 `OBJECTS` entries. This was a sparse
  checkout check: materialized files were checked on disk and omitted tracked
  files against Git. It did not verify their source or runtime bytes.
- Changed local documentation links, skill validation and `git diff --check`
  passed. The link check does not verify remote URLs or scientific claims.

No body assets were regenerated and no body browser tests were run for this
consolidation. Existing scientific reports retain their original scope. The
67P date/count disagreements and Rhea's older source-catalog exclusion remain
explicit in their READMEs; their pinned records were not rewritten here.

The final read-only review found no remaining concrete blockers in these
corrections. It confirmed that Earth follows the checked records and that the
Rhea and Sun qualifications were preserved. This is a documentation review, not
new scientific, browser or deployment qualification.

## Readability revision

The maintainer rejected the long uninterrupted READMEs. The four examples now
show a compact source table, brief results and visible problems before expandable
methods in the same file. Formulas, decoding steps and source surveys remain
available without another per-body document.

The reviewer checked which caveats had to remain visible, then reviewed the
written layout. It caught malformed 67P method headings and an ambiguous
“slope” label; both were corrected. The final pass found no remaining blockers
in those corrections. False color, model meaning, coverage gaps and unresolved
checks remain visible when the methods are closed.

Local Markdown previews were inspected in a browser. The method disclosures open
correctly; the four overviews fit without horizontal overflow at desktop and
390-pixel widths in that preview. This was a document-layout check, not a body
renderer test or an assertion about GitHub's stylesheet.

## ISO 24495-1:2023 revision

The shared contract now combines PDS4 1.26.0 provenance guidance with ISO's
plain-language principles. The skill and contributor instructions reference both.
Review uses reader tasks: find a source, interpret a view, inspect evidence and
limits, and locate the record to change. No new format or approval step was added.

Two agents reviewed the shared rules and four README examples. Corrections
explain technical shorthand, name the meshes compared in Rhea's error result,
improve source and report links, and add the missing object-definition link.
The shared-rule review found no blocker. Scientific quantities, caveats and
unresolved metadata remain intact.

The maintainer's feedback about duplicated content and long pages informed the
layout. This follow-up was an agent review, not reader testing of the final wording
or a full ISO conformity assessment. The edition and public preview are linked in
the contract; the complete ISO text was not assessed.

Local rendered previews of all four READMEs were inspected again. They had no
horizontal overflow at 1,200- and 390-pixel widths with methods closed. The local
documentation check passed for 228 links across 27 changed Markdown files; skill
validation and `git diff --check` also passed. No body tests were rerun for this
wording and navigation change.
