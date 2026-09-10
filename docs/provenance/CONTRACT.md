# Celestial provenance and documentation contract

For every detailed body in `OBJECTS`, explain where its data came from, what the
view means, how we processed it and what the checks prove. Use the existing
[source and prepared records](../object-provenance.md),
[AGENTS.md](../../AGENTS.md) for application rules and the
[celestial skill](../../.agents/skills/celestial-skill/SKILL.md) for preparation.

## Standards basis

Use **PDS4 1.26.0 and ISO 24495-1:2023 together**: PDS4 guides provenance content;
ISO guides wording, organization and use by readers.

The pinned PDS4 references are the [Standards Reference 1.26.0](https://pds.nasa.gov/data/pds4/documents/document_pds4_standards/1.26.0.0/StdRef_1.26.0.pdf)
(SR) and [Data Provider’s Handbook 1.26.0](https://pds.nasa.gov/data/pds4/documents/document_pds4_standards/1.26.0.0/PDS4_DPH_1.26.0.pdf)
(DPH), both dated 1 April 2026. [ESA’s Planetary Science Archive also uses PDS4](https://www.cosmos.esa.int/web/psa/pds4-standards).

| Reference | Requirement adapted here |
| --- | --- |
| SR §6D.2–6D.3 | Product identifiers and versions, distinct from file hashes and code revisions |
| SR §8–8A | Data origin, processing, meaning, limits and supporting documentation |
| SR §7 and §8D | Units, coordinates, datum, orientation, observation time and coverage |
| SR §8C; DPH §2.2.1 | Provider calibration and processing levels, distinct from our processing |
| DPH §11.1–11.4 | Separate checks of metadata/files, decoding, scientific meaning and completeness |

Apply [ISO 24495-1:2023, first edition](https://www.iso.org/standard/78907.html),
§4 and §5.1–5.4, through [Plain language](#plain-language). Its
[public preview](https://cdn.standards.iteh.ai/samples/78907/d194fac21d6a45f38bfcfec9657f7498/ISO-24495-1-2023.pdf)
includes the principles and the start of the guidelines.

This is a cssEarth adaptation using Markdown, existing manifests, SHA-256 pins,
Git revisions, reproduction comparisons and browser evidence. It claims neither
PDS4 archive compliance nor assessed ISO conformity, and requires no XML labels,
archive submission or second provenance format.

## File ownership

| File | Maintained content |
| --- | --- |
| Body `README.md` | The single account of sources and evidence described below |
| Body `NOTICE.md` and supplied license files | Required acknowledgments and reuse terms; link here instead of duplicating credits |
| `source/manifest.json` | Input identities, locations, byte pins, acquisition records and per-input credits |
| `object.json` and `source/preparation/` | Executable choices and exact parameters; explain their meaning without copying parameter lists |
| `prepared/provenance.json` | Generated connections between inputs, processing and outputs; never edit by hand |
| `runtime-assets.json` at the body root | Generated delivery inventory used by installation and publication |
| Shared guides and illustrations under `docs/` | Maintained explanations used across bodies |
| Test fixtures under `tests/`; processing code and shared source references under `tools/` | Inputs and implementation used by executable checks and preparation; identify retained shared references in the owning guide |
| Root README and [body contributor guide](../../src/planets/README.md) | Shared installation, controls, commands and contribution workflow |

Every file under `source/` needs a manifest entry. Body packages contain data,
not private executables. Shared astronomy, artwork and sky sources keep their
existing records.

Where present, `prepared/runtime-assets.json` is the staging inventory copy read
by provenance; installation reads the inventory at the body root. Preparation writes
both and they must agree. Do not maintain them independently.

### Body README

Use one `README.md` per body. Show **Sources**, **Evidence** and **Known problems**
before methods: a small source table, brief results with links to original reports,
and short paragraphs.
Keep observation dates, measured-versus-modeled meaning, false color, coverage
limits, failures and unresolved problems beside their claims, outside collapsed methods.

Put long calculations, decoding steps and source surveys in labeled `<details>`
sections below the overview, using short paragraphs or steps. Link existing
method notes instead of copying them. Do not create a second account, separate
SOURCE summary, EVIDENCE index or body USAGE guide.

### Examples

Examples: [67P](../../src/planets/comet-67p/README.md),
[Earth](../../src/planets/earth/README.md), [Sun](../../src/planets/sun/README.md)
and [Rhea](../../src/planets/rhea/README.md).

## Identify and explain the sources

For each new or changed input, record provider, product/release, URL, byte count,
hash, credits and terms in the existing manifest and acquisition recipe. Preserve
native identifiers: PDS4 LIDVID, PDS3 dataset/product ID, DOI or other published
release ID. Do not invent PDS identifiers. A hash identifies bytes, not the
provider's version or our code revision.

Bodies may combine PDS3, PDS4, Earth-observation, solar and other published data.
Required inputs must be checked in or downloadable through their recipe. Keep
labels and metadata needed to interpret them. Read dates, units, identifiers
and processing levels from the selected input. Record disagreements between
labels, manifests and recipes, and resolve them from the source before making
a scientific claim.

Say which bytes a hash identifies. If we converted an image, normalized a response
or assembled a mosaic before pinning it, explain that step. Disclose an unknown
original download identity.
Keeping every temporary response is unnecessary.

### References and retained files

Choose what to retain by its role, not its file extension:

| Role | Keep |
| --- | --- |
| Background paper or explanatory page | A citation in the body README: title, authors/year, DOI or versioned URL, section/table and the claim it supports. |
| Input read by preparation | Exact bytes or a tested restoration route with byte count and hash, in the existing source records. This includes HTML read by a parser. |
| Evidence that a citation cannot preserve | One identifiable snapshot, with its origin and hash, at the existing shared source/tool owner or owning body; other bodies link to it. |

Before removing a snapshot, check code, acquisition recipes, manifests, tests and
provenance references. Preserve numerical extracts used by the work, their source
identity and extraction method. Update affected records and generated pins together;
keep historical reports intact at their recorded revision. Do not copy the same
archive into each body or use blanket HTML deletion or ignore rules.
GitHub language classification does not determine what evidence belongs in Git.
The [shared source references](../surface-preparation.md#shared-source-references)
show how to retain format definitions and terms without copying them per body.

### Interpretation

Explain the following where relevant:

- Observations, derived measurements, models or illustrations; the provider's
  processing level and classification system. An untouched calibrated download
  is still calibrated; our display output gets no official level without a source basis.
- Units, coordinate frame, datum, orientation, epoch, observation dates, resolution
  and coverage; valid/missing data, upstream corrections and our processing.
- Source uncertainty, display simplification and visual enhancement. Keep limits
  affecting viewers in the product's dataset description too.

Link generated processing records. For facts outside them, such as factsheet
values or orbital assumptions, name the source field/table and show any calculation.
Record useful alternatives and why they were selected, rejected or unresolved;
a failed download does not establish that a dataset does not exist. Link the
provider's reuse terms or state what is unresolved: a publisher name or repository
license alone does not establish an input's terms.

## Save enough evidence to check the result

Store new original evidence with the body or shared test/tool that owns the claim,
and link it from the existing body README or shared guide. Keep an artifact in the
current tree when a maintained explanation or test needs it. Link historical
reports at their exact Git revision; preserve their original contents there.
Keep scratch captures and repetitive logs out of `docs/`. No extra JSON format
or fixed file set is required. Record:

- **What was tested:** bodies and views, code revision, and relevant source,
  prepared and runtime records. Link manifests. Save uncommitted changes, identify
  ignored files and include relevant shared code and the files actually served
  to the browser. A commit or port alone cannot identify those differences. Record
  byte counts and hashes for files not fixed by the revision or a manifest.
- **What happened:** command or method, cases, results, failures and omitted checks.
  Distinguish metadata/file, decoding, scientific and application checks; a pass
  in one does not establish the others. Include environment details that affect
  the result. Browser reports need browser, viewport, DPR, camera, view and settings.
- **Where to inspect it:** links to original reports and screenshots needed to assess the
  result. Map working paths to retrievable copies. A Git path at the recorded
  revision suffices; external files need a stable download location, byte count
  and hash. An ignored local path alone is not retrievable evidence.

## Say what the checks prove

**Reproduction needs a comparison.** State which inputs were downloaded, copied
or verified. Choose the expected output inventory before the run and compare
regenerated files against that fixed baseline, exactly by default. Declare any numerical/visual
tolerance and its scope before comparing, then report differences. An inventory
created only from new output cannot prove reproduction of an earlier result.

**Scientific checks need an independent reference.** Compare changed scientific meaning with
source values or an independent calculation. Matching hashes or calling the same
sampler twice misses shared interpretation errors. `recovered` and `prepared`
describe how provenance was made; neither proves scientific accuracy, fresh
acquisition or passing browser checks.

**Visual checks need inspected images.** Identify the reference as a source/native
capture, earlier product image or reconstructed diagnostic. For matched comparisons,
save reference, new image and diff with matching capture settings. Explain different
sources or framing and withhold pixel-matching claims. Inspect images of affected
views, boundaries and lighting. Use the existing browser checks.

**An old pass describes an old version.** Keep its original paths, hashes, revision
and outcome. To reuse it, name the new version in the README's evidence section
and show that relevant dependencies still match. Do not mark an old report permanently `CURRENT` or use
unchanged textures to prove behavior after camera/shell changes.

A passing body test is not a full-suite pass. Runtime image installation does
not prove source restoration, complete Earth paging or every remote file's
availability. State what remains unknown.

## Pull requests

Use [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
for PR titles: `<type>[optional scope][!]: <summary>`. For example,
`feat(universe): add prepared galaxy layers` or `docs: clarify source credits`.
Use `feat` for features, `fix` for fixes and an appropriate type for other work.
Scope is optional; name the affected area when useful. Mark breaking changes with `!`.

Apply **ISO 24495-1:2023** to every PR title and description through the
[plain-language rules](#plain-language). Lead with the problem and resulting
behavior; give reviewers concrete changes, short explanations and visible limits.
For claims about sources, processing or scientific views, apply the **PDS4 1.26.0**
[content requirements adapted above](#standards-basis): identify changed products
and versions, explain processing and interpretation changes, and link the records
and evidence for the tested revision. Keep detailed provenance in its maintained
account and link it from the PR.

Update affected records, NOTICE credits/terms and the body README's explanation,
results and known problems. Extend existing sections when adding a dataset.
Run relevant checks and summarize their results in the PR. GitHub already records
CI revisions; identify the revision and relevant differences for local or reused
evidence. Link the maintained account instead of adding a PR completion report to `docs/`.

Use the [template](../../.github/pull_request_template.md) as a starting point.
Headings are optional: a small change can be one paragraph explaining the problem,
result and relevant check. Omit unused prompts. Do not add standards declarations,
N/A entries or screenshots just to fill the template.

Commit source records and the evidence needed to review the change, including
relevant failures. Each added artifact needs a named claim, explanation or test
that uses it. Explain unusually large additions in the PR. Before removing an
old report from the current tree, replace citations that still need it with
verified links to its exact Git revision. Never rewrite its failures or present
old screenshots as new.

**Check images on GitHub (cssEarth rule).** Use a
[GitHub attachment](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)
or an image committed at a fixed revision:
`https://github.com/layoutit/cssEarth/blob/<commit>/<path>?raw=true`.
Use the original attachment URL, not a temporary signed download URL.
Local paths and localhost URLs are not reviewable evidence.

After creating or editing a PR, reload its GitHub page and inspect every embedded
image with normal repository access. Confirm it loads, is readable and matches the
cited view and revision. File existence and HTTP success alone are insufficient.
Fix broken embeds before handoff; if required visual evidence is unavailable,
keep the PR in draft and say what is missing.

**PROVENANCE DOCUMENTATION** maintains shared guidance and resolves contradictions;
contributors update instructions affected by their change without an extra approval
step. Add shared rules only for demonstrated gaps, citing the standard/section or
identifying a cssEarth requirement. Do not repeat the standards table per body or
add PR compliance checklists. New preparation operations still need source/output
records and tests in existing tools; add infrastructure only for a specific tool need.

## Plain language

Write for contributors and reviewers checking or changing a body. Assume basic
repository knowledge, not familiarity with every mission or instrument. The
overview should also help viewers understand the map.

| ISO principle | Apply it here |
| --- | --- |
| Relevant (§5.1) | Keep facts needed to judge the view; remove unrelated history and generic praise. |
| Findable (§5.2) | Use the README layout above, descriptive links and dataset names in method headings. Keep limitations beside claims. |
| Understandable (§5.3) | Name the dataset, action and result. Explain unfamiliar terms; preserve necessary technical terms, units, formulas and uncertainty. State unknowns; do not invent measurements. |
| Usable (§5.4) | While drafting and after changes, check that readers can trace sources and results, understand meaning and limits, and locate the record to change. |

State each explanation once. Remove repeated disclaimers, agent-process jargon
and claims about how carefully work was done. Use short paragraphs with one subject
and bullets for separate results or decisions; avoid table cells that become
paragraphs. Replace vague “validated” claims with named checks and outcomes.

Before committing, inspect the rendered README with methods collapsed. For a new
layout or recurring confusion, involve an intended reader on a small scale and
revise from feedback.
Author and agent reviews are not reader testing; word counts and readability scores
do not establish usability. Revisit explanations when sources, behavior or feedback
change. Use the existing review, without a separate report.
