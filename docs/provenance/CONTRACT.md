# Celestial provenance and documentation contract

Proposed in PR #83. Maintained by **PROVENANCE DOCUMENTATION**.

For every detailed body in `OBJECTS`, a contributor should be able to answer:
**Where did this come from? What does it mean? What did we do to it? What did we check?**

Use the existing [source and prepared records](../object-provenance.md).
Follow [AGENTS.md](../../AGENTS.md) for application rules and the
[celestial skill](../../.agents/skills/celestial-skill/SKILL.md) for preparation.

## Standards basis

This contract adapts the [PDS4 Standards Reference 1.26.0](https://pds.nasa.gov/data/pds4/documents/document_pds4_standards/1.26.0.0/StdRef_1.26.0.pdf)
(SR). The [Data Provider’s Handbook 1.26.0](https://pds.nasa.gov/data/pds4/documents/document_pds4_standards/1.26.0.0/PDS4_DPH_1.26.0.pdf)
(DPH) explains its use. Both are dated 1 April 2026; their versioned links fix the
references used here. [ESA’s Planetary Science Archive uses PDS4 too](https://www.cosmos.esa.int/web/psa/pds4-standards).

| Reference | Rule we adopt for cssEarth |
| --- | --- |
| SR §6D.2–6D.3: identifiers and versions | Preserve the provider’s product identifier and release, separately from our file hash and code revision. |
| SR §8–8A: documentation | Explain data origin, processing, meaning and limits in the body README. Keep necessary detailed records with the sources. |
| SR §7 and §8D: units and geometry | Record applicable units, coordinate frame, datum, orientation, observation time and coverage. |
| SR §8C; DPH §2.2.1: calibration and processing levels | Distinguish the provider’s processing from our calculations and display adjustments. |
| DPH §11.1–11.4: validation | Separate metadata and file checks, correct reading of the data, scientific checks and completeness of the tested result. |

The table is our adaptation. Markdown READMEs, existing manifests, SHA-256 pins,
Git revisions, reproduction comparisons and browser evidence are cssEarth choices.
This contract does not claim PDS4 archive compliance or add XML labels, formal
archive submission or a second provenance format.

A body can combine PDS3, PDS4, Earth-observation, solar and other published data.
Keep their native identifiers and metadata. Use a supplied PDS4 LIDVID, PDS3
dataset/product ID, DOI or published release identifier; do not invent a PDS
identifier for a source that has none.

## Where things go

| File | What belongs there |
| --- | --- |
| Body `README.md` | The body’s sources and evidence: selected datasets, processing, meaning, test results and known problems. |
| Existing `SOURCE.md` and notes beside the data | Detailed source surveys, field definitions and calculations referenced by the README. Keep one detailed account rather than copying it. |
| Body `NOTICE.md`, license files and manifest credits | Attribution, reuse terms and links supporting them. |
| `source/manifest.json`, recipes, `prepared/provenance.json`, `runtime-assets.json` | Exact inputs, processing steps and generated files, using the existing formats. |
| Evidence reports under `docs/` | Original test reports, screenshots and logs. Link them from the body README with their results and limits. |
| Root README and shared contributor guide | Installation, controls, preparation commands and testing instructions used across bodies. |

A body README must explain its sources and evidence without making the reader
follow a chain of index files. Describe what each view means, why its data was
chosen, what processing changed and what the checks found. Link exact manifests
and original reports for detail. Keep installation and common controls in the
shared guides; do not create per-body USAGE files. One test report can cover
several bodies. Update the affected README instead of adding another index.

Every file under `source/` must be recorded in its manifest. Put test logs and
screenshots under `docs/`, not among source data. The package test also forbids
a root `EVIDENCE.md` and private executable tools inside a body package.

## Identify and explain the sources

For new or changed inputs, record the provider, product and release, URL, file
size, hash, credits and terms in the existing manifest and acquisition recipe.
A hash identifies bytes; it does not replace the provider’s product version.
Required files must be checked in or downloadable through that recipe. Keep the
labels and metadata needed to interpret them. Read dates, units, identifiers
and processing levels from those records; do not copy them from another input.
If a label, manifest or recipe disagrees, record the disagreement and resolve it
from the source before using that fact in a scientific claim.

Say which bytes the hash identifies. If we converted an image, normalized a
response or assembled a mosaic before saving it, explain that step. If the
original download's identity is unknown, say so. There is no requirement to keep
every temporary response.

Explain the source meaning in the body README. Put lengthy field definitions
and calculations in existing source notes and link them. Cover what matters:

- Whether the view shows observations, derived measurements, a model or an
  illustration. Preserve the provider’s processing level and the system it uses,
  when supplied. An untouched download of calibrated data is still calibrated.
  Do not assign an official level to our display output without a source basis.
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

The body README summarizes the checks, results and known problems and links the
original reports. Reuse their existing locations. A new independent run can use
a descriptive dated folder under `docs/evidence/`. No extra JSON format or fixed
set of files is required.

Make three things clear:

- **What was tested:** the bodies and views, code revision, and relevant source,
  prepared and runtime records. Link existing manifests rather than copying them.
  Save any uncommitted changes and identify ignored files used by the test.
  Include relevant shared code and the files actually served to the browser;
  a port number or Git commit alone cannot identify those differences. For files
  not fixed by the recorded revision or an existing manifest, record size and hash.
- **What happened:** the command or method, selected cases, results, failures and
  checks left out. Say whether a result checks metadata/files, decoding, scientific
  meaning or application behavior; a pass in one does not establish the others.
  Record environment details that affect the result. Browser reports need the
  browser, viewport, DPR, camera, view and settings.
- **Where to inspect it:** links to original reports and the screenshots needed
  to assess the result. If a report names a working path, show where that file
  was saved for review. A Git path at a recorded revision is enough. Files stored
  elsewhere need a stable download location, byte count and hash. An ignored
  local path alone is not evidence another reviewer can retrieve.

For a small correction, add a dated result to the existing report and update the
README’s evidence section. Keep earlier outcomes intact. Do not overwrite a
failure or label an old screenshot as new.

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
settings. If the source or framing differs, explain the limit and do not claim
pixel matching. Inspect the affected views, boundaries and lighting. Use the
existing browser checks.

**An old pass describes an old version.** Keep its original revision and outcome.
To reuse it, name the new version in the README’s evidence section and show that
the dependencies relevant to the result still match. Do not add a permanent
`CURRENT` flag to an old report. Unchanged textures do not prove camera or shell
behavior after that code changes.

A passing body test is not a passing full suite. Installing runtime images does
not prove source restoration, complete Earth paging or availability of every
remote file. Report the checks actually performed and what they leave unknown.

## Update the docs with the change

Update the affected source records and credits, and explain the change in the
body README. Run the relevant checks, save the original reports and update the
README’s evidence and known problems. Fix older records needed for this work;
an unrelated edit does not require documenting a body's entire history.

Commit useful docs, source records and evidence needed for review. Keep scratch
output and repetitive logs ignored. Explain unusually large additions once in
the PR; use agreed storage when appropriate. Keep the originals needed to assess
the result, including relevant failures and partial runs. Do not remove historical
evidence until its replacement is authorized and verified. This contract does
not authorize uploads or moving stored evidence.

Write plainly. Name the dataset, processing step, test and limitation. Prefer
concrete statements over process jargon or repeated disclaimers.

For a new body or dataset, extend the same Sources, Evidence and Known problems
sections with the relevant facts. Use existing source notes for detailed methods.
Add a shared rule only when it fills a demonstrated gap; cite its standard and
section, or identify it as a cssEarth requirement. Do not repeat this standards
table in every body or add a compliance checklist to each PR.

The documentation owner fixes shared guidance and contradictions. Contributors
update their body notes and any shared instructions affected by their change;
there is no extra approval step. A new preparation operation still needs to
record its sources and outputs and have tests in the existing tools. Add new
infrastructure only when a specific tool needs it.
