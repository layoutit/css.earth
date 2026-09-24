# Celestial provenance and documentation contract

For every detailed body in `OBJECTS`, explain where its data came from, what the
view means, how we processed it and what the checks prove. Use the existing
[source and prepared records](../object-provenance.md),
[AGENTS.md](../../AGENTS.md) for application rules and the
[celestial skill](../../.agents/skills/celestial-skill/SKILL.md) for preparation.

[Navigation identity and evidence](../navigation-identity.md) distinguishes
subjects, scene capability, rendering resources, dataset views and published
sources. Preserve these distinctions when changing metadata or attribution.

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
PDS4 archive compliance nor assessed ISO conformity, and does not require PDS XML labels or archive submission.

## File ownership

| File | Maintained content |
| --- | --- |
| Body `README.md` | The single account of sources and evidence described below |
| Body `NOTICE.md` and supplied license files | Required acknowledgments and reuse terms; link here instead of duplicating credits |
| [Source records](../../src/sources/) (`<id>.json`) | One shared published identity per file, with versions, citation links and evidence |
| `source/manifest.json` | Local input paths, canonical bindings, acquisition and per-input credits; tracked source records do not carry file-stability hashes |
| `object.json` and `source/preparation/` | Executable choices and exact parameters; explain their meaning without copying parameter lists |
| Body `text.json` | [Reader text](../reader-text.md): the card line, introduction and dataset text, each citing the source records it is checked against. It stays outside `source/` and provenance; `node tools/prepare/prepare-text.mts` publishes `prepared/text.json` |
| `prepared/object.json`, `prepared/page.json` | Transport and page metadata regenerated from the installed runtime; not inventoried or committed |
| `prepared/provenance.json` | Generated lineage, never committed. Layered bodies regenerate it; volumes, image layers and catalogues inventory and publish it with their baked outputs |
| Other delivery files under `prepared/` | Baked output. Published to R2 through `inventory.json`, restored by `setup:assets`, never committed; audit-only terrain reports and source-index rasters are excluded |
| `inventory.json` at the body root | Generated inventory of every baked file (public textures and `prepared/*`) used by installation and publication |
| `site/prepared-sources.json` and `site/prepared-facilities.json` | Ignored source usage and mission attribution outputs; prepare together |
| Shared guides and illustrations under `docs/` | Maintained explanations used across bodies |
| Test fixtures under `tests/`; processing code under `tools/` | Inputs and implementation used by executable checks and preparation |
| Root README and [body contributor guide](../../src/objects/README.md) | Shared installation, controls, commands and contribution workflow |

Every file under `source/` needs a manifest entry. Body packages contain data,
not private executables. Shared astronomy, artwork and sky sources keep their
existing records.

The inventory lives once, at the body root. Preparation stages a copy while it
runs and provenance reads that staged copy; nothing keeps a second copy in `prepared/`.

### Body README

Use one `README.md` per body. Show **Sources**, **Evidence** and **Known problems**
before methods: a small source table, brief results with links to original reports,
and short paragraphs.
Keep observation dates, measured-versus-modeled meaning, false color, coverage
limits, failures and unresolved problems beside their claims, outside collapsed methods.

Put long calculations and decoding steps in labeled `<details>`
sections below the overview, using short paragraphs or steps. Link existing
method notes instead of copying them. Do not create a second account, separate
SOURCE summary, EVIDENCE index or body USAGE guide.

### Investigation ledger

Record every source, route, lens or frame examined for an object in its
`investigations.json`, beside the README, including trials that failed. Each
entry says what was examined, its status (`included`, `excluded`, `unresolved`
or `deferred`), the finding, evidence links and the commit it was checked at.
An entry that is not included names what would reopen it in `revisitWhen`.
Link repository evidence at a commit or pull request; a branch link moves.

A facility keeps the same ledger in `src/facilities/<facility id>/investigations.json`,
with `facilityId` in place of `objectId`: a telescope's archive, data policy and
reduction software, and what was run from it. Every facility ledger answers the
sweep first, one entry each for `archive-access`, `data-policy` and
`reduction-software`, so facilities compare side by side. Use the facility
catalogue's id when the facility has a page record; a facility without one keeps
its ledger all the same. `node tools/investigations/report-investigations.mts --facilities` counts
the catalogue's ground facilities that have ledgers and lists the open decisions.

Give distinct source decisions their own entries. `included` means selected for
the stated use, not that every scientific claim is qualified. Ledger coverage
counts objects with records, not objects with complete imagery or an exhaustive
source search.

Reasoning that three or more bodies reach the same way belongs in one shared
record under `data/investigations`, and an entry names it in `survey` instead of
repeating the paragraph. The record holds the subject, finding, the evidence
every body leans on and the reopen condition; the entry still states this body's
status, its own evidence and when it was checked, and may override the subject
or reopen condition. A shared record names no single body's files. A test
refuses a finding repeated across three bodies and a record no longer quoted.

The README links the ledger instead of repeating a source survey.
An entry that is not included names, among its evidence, the source outside this
repository that it examined: the archive, deposit or paper where the evidence
that would reopen it appears. That is what makes a decision reopenable rather
than a sentence nobody can act on. A test records how many decisions still name
no such source, and that count may only fall.

Read the ledger before investigating an object, starting from the open-work index
([`docs/provenance/investigation-index.md`](investigation-index.md)), which
groups every unresolved and deferred decision by what it waits on. Refresh it
with `node tools/investigations/report-investigations.mts --index --write`; a test refuses a stale copy. Reopen an excluded, unresolved or
deferred entry only when its `revisitWhen` condition is met, and say which.
`node tools/investigations/report-investigations.mts` lists every open entry across objects.
Use `--summary` for catalogue coverage and `--classification` to select an
existing object classification. Filter decisions with `--status=deferred,unresolved`
and `--search=registration`, or export with `--json`. Filters select detail rows;
summary counts cover the selected population. Counts measure recorded decisions,
not qualified views or an exhaustive source search.

When consolidating historical records, `checked` identifies the version of the
records reviewed. Preserve source decisions and original trial dates, results
and evidence. Explain the migration method and extent of manual review in the PR.
A schema or link check does not verify the finding; consolidation does not claim
a fresh archive search or repeat qualification. After a finding changes, retain
its entry id and previous checks, append the new checked revision, and preserve
the earlier result in the finding or its pinned evidence.

### Examples

Examples: [67P](../../src/objects/comet-67p/README.md),
[Earth](../../src/objects/earth/README.md), [Sun](../../src/objects/sun/README.md)
and [Rhea](../../src/objects/rhea/README.md).

## Identify and explain the sources

For each new or changed input, record its path, provider, product/release, origin
URL, credits and terms in the existing manifest and acquisition recipe. Follow
[Sources authoring](../sources-catalogue.md#add-or-update-a-source) to reuse or
establish its published identity and bind the input. Preserve
native identifiers: PDS4 LIDVID, PDS3 dataset/product ID, DOI or other published
release ID. Do not invent PDS identifiers. A hash identifies bytes, not the
provider's version or our code revision. Git identifies tracked source bytes;
manifests and descriptors do not carry file-stability hashes. Missing downloads
are restored by path from the source cache or origin, without a manifest digest
comparison. Runtime inventories retain byte counts and SHA-256 for published
assets. Historical evidence, toolchain locks and untracked processing or telescope
delivery receipts retain the identities their own verification requires.

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

Use citations for papers, catalogue pages, search results and explanatory webpages.
A body never pins a paper or archive document, and never copies a table the shared bank in `src/references` holds.
SPICE kernels are never committed: a kernel bank in `src/spice` or a body's acquisition step restores each one from
its origin. `pnpm check:body-references` fails any of these in CI.
In the body README, record the values that support a claim, their units and
uncertainty, the source title and authors/year, DOI or versioned URL, and the
specific table, field or section. Explain any transcription, selection or conversion.
Keep exact values consumed by preparation in its existing data records and recipes;
link them instead of copying long tables into Markdown.

Keep original scientific inputs and native labels needed to decode them, either
in Git or through a tested restoration recipe with its origin and product identity.
If an evidence claim depends on exact bytes outside Git, retain their measured
identity with that evidence; do not turn it into a pin on an authored source file.
An acquisition parser may read HTML temporarily. Save its selected data and source
identity; the downloaded webpage does not become a permanent evidence file.
“Reference evidence” and “the website might change” are not reasons to commit a page.

Before removing a page, check code, acquisition recipes, manifests, tests and
provenance references. Preserve used numerical extracts, source identity and
extraction method. Update active references and affected delivery inventories together. Original
reports remain unchanged at their recorded Git revision. Do not replace duplicated
pages with a shared webpage archive or a blanket ignore rule.
GitHub language classification does not determine what belongs in Git.

### Interpretation

For color surfaces, follow [Source-backed surface color](../color-preparation.md).
Keep source calibration, geometric registration and display interpretation
separate. A natural-color claim requires an applicable sourced color method;
calibrated bands, three RGB channels, or an sRGB encoding cannot establish it.
Never invent missing visible measurements or tune an undocumented white balance.
Measured-band composition retains floating values until its final declared
display encoding; publisher-prepared RGB does not receive that transfer twice.

Explain the following where relevant:

- Observations, derived measurements, models or illustrations; the provider's
  processing level and classification system. An untouched calibrated download
  is still calibrated; our display output gets no official level without a source basis.
- Units, coordinate frame, datum, orientation, epoch, observation dates, resolution
  and coverage; valid/missing data, upstream corrections and our processing.
- Source uncertainty, display simplification and visual enhancement. Keep limits
  affecting viewers in the dataset's reader text in `text.json` too.

Link generated processing records. For facts outside them, such as factsheet
values or orbital assumptions, name the source field/table and show any calculation.
A published factsheet value names its source on the fact itself; preparation
refuses a fact without one, and a value no record proves is removed, not shown.
Record useful alternatives and why they were selected, rejected or unresolved;
a failed download does not establish that a dataset does not exist. Link the
provider's reuse terms or state what is unresolved: a publisher name or repository
license alone does not establish an input's terms.

## Save enough evidence to check the result

Keep evidence beside the body or shared test/tool that owns the claim, and link
it from the maintained README or guide. Keep an artifact in the current tree
while an explanation or executable check needs it. Link historical reports at
their exact Git revision, preserving their contents. Scratch captures and
repetitive logs belong in ignored `output/`.

Record:

- **Tested inputs:** bodies/views, code revision and relevant manifests. Identify
  uncommitted changes, ignored inputs and files actually served to the browser;
  record byte counts and hashes for evidence inputs not fixed by Git or a delivery
  inventory. A path-only source manifest does not establish byte identity.
- **Method and result:** command, cases, outcomes, failures and omitted checks.
  Include environment details that affect the result. Browser evidence needs
  browser version, viewport, DPR, camera, dataset and settings.
- **Inspectable evidence:** original reports and relevant images at retrievable
  locations. External files need stable download links and byte pins. A local
  port or ignored path alone cannot identify or preserve a result.

Use existing report formats; there is no required extra JSON format or file set.

## Say what the checks prove

**Reproduction needs a comparison.** Choose the expected output inventory before
running preparation. State which inputs were downloaded, copied or verified and
compare regenerated outputs against that baseline, exactly by default. Declare
any tolerance and its scope before comparing; report the differences.

**Scientific checks need an independent reference.** Compare changed quantities
with source values or an independent calculation. Hashes and repeated calls to
the same sampler cannot detect a shared interpretation error. `recovered` and
`prepared` describe how provenance was made, not scientific or visual acceptance.

**Visual checks need inspected images.** Identify the reference as an original
source/native capture, earlier output or reconstructed diagnostic. For matched
comparisons, retain reference, result and diff with matching capture settings.
Disclose different sources or framing and inspect affected views, boundaries and
lighting before making comparison claims.

**Choose a meaningful comparison before choosing a tool.** State the reference,
what visual content should agree, and what defect a difference could reveal.
Pixelmatch is conditional on that comparison; it is not a required deliverable
for every visual PR. For example, checking that an existing Monochrome view is
unchanged after adding a lens is meaningful. Comparing Monochrome with false
color, two different filters, or a photograph with an elevation map is not a
fidelity check: those datasets are supposed to look different. Do not run such
comparisons merely to produce a mismatch count.

If no meaningful matched reference exists, retain inspected source and browser
images, explain their relationship, and use the relevant calibration, coordinate
or registration checks. An A/A repeat establishes capture stability only; it
does not qualify a new surface or substitute for independent source evidence.
Run it when capture noise could affect an actual matched comparison, not as a
standalone delivery gate.

**When using Pixelmatch for matched visual evidence, use threshold `0.1`.** This
cssEarth requirement makes pixel changes inspectable and reproducible. Compare equal-sized, unscaled
captures or identical documented crops. Retain the input images, generated diff,
input hashes, Pixelmatch version, threshold, anti-aliasing setting, mismatch count
and compared pixel count beside the owning evidence. Choose settings before
comparing and disclose masks or exclusions. Keep camera, viewport, DPR, dataset,
lighting and browser fixed. If capture instability could affect the conclusion,
compare independent unchanged A/A captures first and report their differences;
comparing a file with itself does not establish stability. Inspect the diff with
both inputs. A changed-pixel count locates change; it does not measure sharpness,
scientific accuracy or improvement. Explain the visible result separately and
keep independent source/registration checks for scientific claims.

**An old pass describes an old version.** Preserve its original revision, paths,
hashes and outcome. To reuse it, identify the new revision and show that relevant
dependencies still match. Unchanged textures do not qualify a changed camera.

Separate metadata/file, decoding, scientific and application results. A body test
is not a full-suite pass; installed images do not prove source restoration or
complete remote coverage. State what remains unknown.

## Pull requests

Use [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
for titles: `<type>[optional scope][!]: <summary>`, for example
`feat(universe): add prepared galaxy layers` or `docs: clarify source credits`.
Use `!` for a breaking change.

Lead with the problem and resulting behavior. Apply the [plain-language rules](#plain-language)
throughout, and the [PDS4 content requirements](#standards-basis) to source,
processing and scientific claims. Link the affected README or guide for the
source products, interpretation, results and known problems. Update credits and
instructions in the same change.

Use the [template](../../.github/pull_request_template.md) as a starting point;
a small PR can be one paragraph and its relevant check. Remove unused prompts.
Summarize checks and limitations. GitHub records CI revisions; local and reused
evidence must identify the tested revision and relevant differences.

**Choose checks by what changed.** Run the affected tests locally; required CI
checks still apply. A new body needs its source, package and browser checks,
without automatically rerunning every body or shared suite. Broaden local checks
when shared behavior changes or a failure points beyond the package. Reuse a pass
while its code, inputs and relevant environment remain unchanged; committing or
editing prose alone does not invalidate it. For an unrelated failure, record it
once and continue the checks that can still give useful results. Report omitted
checks; do not call a focused pass a full-suite pass.

**Group checks by what they prove.** Give a check its own sentence only when its
result is evidence about this change: a test that fails on `main` and passes here,
or a measurement the change was made to move. Name the checks that merely passed on
one line. Collect unrelated failures in a table and state once that they match
`main`; do not repeat that reasoning for each row. Record a standing environment
limit, such as a runner that cannot start, in [CONTRIBUTING](../../CONTRIBUTING.md#check-your-change)
and cite it, rather than explaining it again in each PR.

Each added artifact must support a named claim, explanation or test. Explain
unusually large additions. Preserve relevant failures and replace needed links
with exact Git revision links before removing historical reports. A PR does not
need a separate completion report in `docs/`.

**Inspect PR images on GitHub.** Use a [GitHub attachment](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)
or an image committed at a fixed revision, for example
`https://github.com/layoutit/css.earth/blob/<commit>/<path>?raw=true`.
A relative link resolves against the PR URL, not the repository root, so pin a
repository link in the body to a commit as well. After publishing or editing the
PR, reload it with normal repository access and inspect every image for loading,
legibility, view and revision, and follow every link. File existence or HTTP
success alone is insufficient. Fix broken embeds and links; if required images
are unavailable, keep the PR in draft and identify what is missing.

Contributors maintain the shared guidance and update rules affected by their
changes without an extra approval step. Add a shared rule only
for a demonstrated gap, identifying its standard/section or its cssEarth purpose.
Use existing source records, preparation tools and checks.

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
