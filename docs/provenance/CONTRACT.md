# Celestial provenance and documentation contract

Proposed in PR #83. Maintained by **PROVENANCE DOCUMENTATION**.

For every detailed body in `OBJECTS`, a contributor should be able to answer:
**Where did this come from? What does it mean? What did we do to it? What did we check?**

Use the existing [source and prepared records](../object-provenance.md).
Follow [AGENTS.md](../../AGENTS.md) for application rules and the
[celestial skill](../../.agents/skills/celestial-skill/SKILL.md) for preparation.

## Where things go

| File | What belongs there |
| --- | --- |
| Body `README.md` | A short introduction, route and links. |
| Body `SOURCE.md` and linked source notes | Why we chose the data, what it means, how we changed it and its limits. |
| Body `NOTICE.md`, license files and manifest credits | Attribution, reuse terms and links supporting them. |
| `source/manifest.json`, recipes, `prepared/provenance.json`, `runtime-assets.json` | Exact inputs, processing steps and generated files, using the existing formats. |
| Evidence reports under `docs/` | What was tested, results, screenshots and remaining problems. Reuse an existing body or batch report. |
| `docs/objects/<id>/EVIDENCE.md`, if needed | Links to results when a body's evidence spans several reports. |
| `docs/objects/<id>/USAGE.md`, if needed | Detailed instructions for using that body's views. |

Keep results and detailed instructions out of body READMEs. Do not create an
empty index or a new document for every edit. One report can cover several
bodies. Keep shared methods in the skill or shared guides.

Every file under `source/` must be recorded in its manifest. Put test logs and
screenshots under `docs/`, not among source data. The package test also forbids
a root `EVIDENCE.md` and private executable tools inside a body package.

## Identify and explain the sources

For new or changed inputs, record the provider, product and release, URL, file
size, hash, credits and terms in the existing manifest and acquisition recipe.
Required files must be checked in or downloadable through that recipe. Keep the
labels and metadata needed to interpret them.

Say which bytes the hash identifies. If we converted an image, normalized a
response or assembled a mosaic before saving it, explain that step. If the
original download's identity is unknown, say so. There is no requirement to keep
every temporary response.

In SOURCE or a linked note, explain details that affect the displayed meaning:

- Whether the data is observed, derived or modeled.
- Units, coordinate frame, datum, epoch, resolution and coverage, where relevant.
- Rules for valid or missing data, corrections made upstream and our processing.
- Source uncertainty, display simplification and visual enhancement.

Keep limits that affect a viewer's interpretation in the product's dataset
description too. Link generated processing records instead of rewriting them.
For facts outside those records, such as a factsheet value or orbital assumption,
name the source field or table and show the calculation. Shared astronomy,
artwork and sky sources stay in their existing records.

Keep useful alternative datasets and the reasons for using, rejecting or leaving
them unresolved in source notes. A failed download does not show that a dataset
does not exist. Update NOTICE when credits or terms change. Link the provider's
terms, or say what remains unresolved; a publisher name or repository license
alone does not establish the input's reuse terms.

## Save enough evidence to check the result

A short Markdown note linking existing reports is usually enough. Use the
existing report location. For a new independent run, use a descriptive dated
folder under `docs/evidence/`. No extra JSON format or fixed set of files is required.

Make three things clear:

- **What was tested:** the bodies and views, code revision, and relevant source,
  prepared and runtime records. Link existing manifests rather than copying them.
  Save any uncommitted changes and identify ignored files used by the test.
  Include relevant shared code and the files actually served to the browser;
  a port number or Git commit alone cannot identify those differences. For files
  not fixed by the recorded revision or an existing manifest, record size and hash.
- **What happened:** the command or method, selected cases, results, failures and
  checks left out. Record environment details that affect the result. Browser
  reports need the browser, viewport, DPR, camera, view and settings.
- **Where to inspect it:** links to original reports and the screenshots needed
  to assess the result. If a report names a working path, show where that file
  was saved for review. A Git path at a recorded revision is enough. Files stored
  elsewhere need a stable download location, byte count and hash. An ignored
  local path alone is not evidence another reviewer can retrieve.

For a small correction, add a dated result to the existing report. Keep earlier
outcomes intact. Do not overwrite a failure or label an old screenshot as new.

## Say what the checks prove

**Reproduction needs a comparison.** State which inputs were downloaded, copied
or verified. Before a reproduction run, name the expected output inventory.
Compare regenerated files against that fixed target, exactly by default. If a
numerical or visual tolerance is needed, state its limit and where it applies
before comparing, then report the differences. Creating an inventory from the
new output alone does not prove reproduction of a previous result.

**Scientific checks need an independent reference.** Check changed scientific
meaning against source values or an independent calculation. Matching hashes or
calling the same sampler twice cannot detect a shared interpretation error.
The existing `recovered` and `prepared` labels describe how the provenance
record was made; neither proves scientific accuracy, fresh acquisition or a
passing browser check.

**Visual checks need inspected images.** Identify the reference: a source or
native capture, an earlier product image, or a reconstructed diagnostic. For a
matched comparison, save the reference, new image and diff with matching capture
settings. If the source or framing differs, explain the limit and do not claim pixel
matching. Inspect the
affected views, boundaries and lighting. Use the existing browser checks.

**An old pass describes an old version.** Keep its original revision and outcome.
To reuse it, name the new version in the maintained evidence note and show that
the dependencies relevant to the result still match. Do not add a permanent
`CURRENT` flag to an old report. Unchanged textures do not prove camera or shell
behavior after that code changes.

A passing body test is not a passing full suite. Installing runtime images does
not prove source restoration, complete Earth paging or availability of every
remote file. Report the checks actually performed and what they leave unknown.

## Update the docs with the change

Update the affected source records, explanation and credits. Run the relevant
checks, save their evidence and link it from the existing report or index.
Change README links only when needed. Fix older records needed for this work;
an unrelated edit does not require documenting a body's entire history.

Commit useful docs, source records and evidence needed for review. Keep scratch
output and repetitive logs ignored. Explain unusually large additions once in
the PR; use agreed storage when appropriate. Keep the originals needed to assess
the result, including relevant failures and partial runs. Do not remove historical
evidence until its replacement is authorized and verified. This contract does
not authorize uploads or moving stored evidence.

Write plainly. Name the dataset, processing step, test and limitation. Prefer
concrete statements over process jargon or repeated disclaimers.

The documentation owner fixes shared guidance and contradictions. Contributors
update their body notes and any shared instructions affected by their change;
there is no extra approval step. A new preparation operation still needs to
record its sources and outputs and have tests in the existing tools. Add new
infrastructure only when a specific tool needs it.
