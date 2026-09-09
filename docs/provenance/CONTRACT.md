# Celestial provenance and documentation contract

Maintained by **PROVENANCE DOCUMENTATION**.

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

## File ownership

| File | Maintained content |
| --- | --- |
| Body `README.md` | One account of source selection, interpretation, our processing, evidence and known problems. |
| Body `NOTICE.md` and supplied license files | Required acknowledgments and reuse terms. The README links here instead of repeating a credits section. |
| `source/manifest.json` | Input identities, locations, byte pins, acquisition records and per-input credits, using its existing fields. |
| `object.json` and `source/preparation/` | Executable preparation choices and exact parameters. Explain their scientific meaning in the README; do not keep another parameter list. |
| `prepared/provenance.json` | Generated connections between inputs, processing and outputs. Never edit these connections by hand. |
| Root `runtime-assets.json` | Generated delivery inventory used by installation and publication. |
| Reports and images under `docs/` | Original evidence for a dated run and the version tested. The README states the result and links the report. |
| Root README and [body contributor guide](../../src/planets/README.md) | Shared installation, controls, commands and contribution workflow. |

`prepared/runtime-assets.json`, where present, is a generated copy of the staging
inventory. Provenance reads it; installation reads the root inventory. The two
must agree. Preparation writes both; agents must not maintain them independently.
See [prepared provenance](../object-provenance.md) for the machine record format.

### Body README

Use **Sources**, **Evidence** and **Known problems**, with dataset subsections as
needed. Explain what each view means, why its data was selected, what processing
changed and what the checks found. Link exact manifests and original reports.
Do not add a separate SOURCE summary, EVIDENCE index or USAGE guide.

A long decoding method, field dictionary or calculation can live in a linked
note beside its data. That note owns the method; the README explains its purpose
and consequences without copying it. Keep meaningful alternative-source choices
with the relevant dataset. Split for a substantial method, not merely to shorten
the README or create the same set of files for every body.

Every file under `source/` needs a manifest entry. Reports, screenshots and test
logs belong under `docs/`. Body packages contain data, not private executables.

### Existing bodies

New bodies use README. When substantially updating an older body's documentation,
merge useful SOURCE content into README and remove the duplicate file. Update
active links and audit paths; preserve paths and hashes inside historical reports.
The package check accepts README or legacy SOURCE so other bodies keep working.
A small unrelated correction does not require migrating the whole body.

The migrated examples are [67P](../../src/planets/comet-67p/README.md),
[Earth](../../src/planets/earth/README.md), [Sun](../../src/planets/sun/README.md)
and [Rhea](../../src/planets/rhea/README.md).

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

Record useful alternatives and why they were selected, rejected or left unresolved
with the relevant dataset. A failed download does not show that a dataset
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

Extend the existing sections when adding a dataset. Add a shared rule only when
it fills a demonstrated gap; cite its standard and
section, or identify it as a cssEarth requirement. Do not repeat this standards
table in every body or add a compliance checklist to each PR.

The documentation owner fixes shared guidance and contradictions. Contributors
update their body notes and any shared instructions affected by their change;
there is no extra approval step. A new preparation operation still needs to
record its sources and outputs and have tests in the existing tools. Add new
infrastructure only when a specific tool needs it.

## Plain language

Write for someone trying to understand the data. Each paragraph should explain
a source, a decision, a method, a result or a limitation. Delete filler that could
appear unchanged in any body's README.

- Name the dataset and the action: what we downloaded, calculated, changed or
  checked. Remove praise such as “rigorous,” “comprehensive” or “seamless.”
- Replace vague claims with evidence. “Validated” needs a named check and result;
  “reproduced” needs a comparison. If the result is unknown, say so. Never invent
  a measurement to make a sentence sound concrete.
- Keep scientific names, units, formulas and necessary technical terms. Explain
  an unfamiliar term when it matters. Remove agent-process jargon and descriptions
  of how carefully the work was carried out.
- State each explanation once. Put a limitation beside the claim it qualifies;
  avoid repeating a general disclaimer after every paragraph.

Examples using the 67P records:

| Replace | With |
| --- | --- |
| “A source-backed geometry pipeline preserves bounded fidelity.” | “We reduced the ESA shape model from 104,192 to 1,000 triangles.” |
| “The integration was successfully validated.” | “All 60 comet browser cases passed. The renderer suite had nine failures.” |
| “The imagery is not a pixel-parity oracle.” | “The photographs and browser views have different camera settings, so they cannot be compared pixel by pixel.” |

Before committing, read the changed paragraphs as an explanation to another
contributor. Rewrite sentences that sound impressive but do not say what happened.
Use this edit pass in the existing review; it needs no separate report or score.
