# Asteroid investigations

Each asteroid keeps its source decisions, failed trials and reopening conditions
in `src/objects/<id>/investigations.json`. Its README explains the selected
datasets, processing, evidence and known problems. Read both before choosing
the next change. The [ledger contract](CONTRACT.md#investigation-ledger) defines
the existing format; this guide does not add a separate body registry or status
file.

## Find work and follow progress

From the repository root, using the project's Node version:

```sh
# Coverage and decision counts, derived from the descriptors that generate OBJECTS.
node tools/report-investigations.mts --classification=asteroid --summary

# Candidates with a recorded preparation or qualification prerequisite.
node tools/report-investigations.mts --classification=asteroid --status=deferred

# Evidence weaknesses; narrow to a body by searching its id instead.
node tools/report-investigations.mts --classification=asteroid --search="Versioned browser evidence"

# Read previous registration failures before repeating an image trial.
node tools/report-investigations.mts --classification=asteroid --status=excluded --search=registration

# Export the complete asteroid record, including adopted sources.
node tools/report-investigations.mts --classification=asteroid --status=included,excluded,unresolved,deferred --json
```

The report includes the finding, reopening condition, last checked revision and
evidence. Status and text filters select detail rows; the summary always counts
the entire selected population. Missing ledgers remain visible even though they
cannot supply detail rows. An unknown classification or status is an error.

| Status | What it records | How to use it |
| --- | --- | --- |
| `included` | An adopted input, reference or qualified route, with its precise role and limits. | Reuse that decision and its evidence. It does not mean the body is complete. |
| `excluded` | A rejected alternative or failed trial. | Read the failure before retrying; identify what changed. |
| `unresolved` | Missing evidence, access, definitions or an unsettled source choice. | Resolve the named uncertainty; do not describe an inaccessible product as nonexistent. |
| `deferred` | A candidate with recorded work still needed. | Check its prerequisite before starting preparation. It is not automatically ready to ship. |

After work changes a finding, update that entry, retain its id and earlier
checks, append the newly checked revision and link the actual result. Preserve
the previous failure in the finding or its pinned evidence. When one source has
different uses, give each decision its own entry: an accepted DRACO image does
not qualify LUKE, and a useful coordinate document may still be unsuitable as a
texture. Git history records the before/after decisions; adding rows alone is
not progress toward a qualified view.

## Opportunities exposed by the repository audit

These are planning leads from the records at
[`d1374f2b4`](https://github.com/layoutit/css.earth/tree/d1374f2b47d1e24d7cc08368644c1a5c9444f8f0).
Their current disposition lives in the linked ledger. None of the trials below
was run as part of the ledger migration.

| Candidate | What is already available | Remaining decision or check |
| --- | --- | --- |
| [Toutatis](../../src/objects/toutatis/investigations.json), `radial-elevation`; [Donaldjohanson](../../src/objects/donaldjohanson/investigations.json), `source-surface-elevation` | Original meshes and the shared closest-source-point scalar sampler. The old radial intersection limitation is not a missing shared capability anymore. | Qualify separate neck surfaces, distance bounds, seams and missing coverage on each body within the existing face budget. This shows model radius, not independently measured topography. |
| [Didymos](../../src/objects/didymos/investigations.json), `recorded-survey-3` | Published gravity, slope, tilt and topography fields; the relative-albedo view already uses facet correspondence. | Verify each quantity's units, density/rotation assumptions, datum, correspondence and invalid coverage. |
| [Lutetia](../../src/objects/lutetia/investigations.json), `recorded-survey-5` | The recorded shapeViewer package inspection found numerical gravity and slope samples. | Establish the scalar definitions and registration. Duplicate geometry is not a reason to discard distinct scientific fields. |
| [Gaspra](../../src/objects/gaspra/investigations.json), `recorded-survey-5` | The 2026 six-filter color/geometry cubes were examined; a single-filter SSI camera path is already used. | Bind the actual cube to the mesh and qualify band alignment, quality masks and radiance/color interpretation. The cube has no latitude/longitude backplanes. |
| [Ida](../../src/objects/ida/investigations.json), `ssi-multiband-color` | The calibrated SSI release includes seven filters and identified color sets; the green pair is qualified. | Qualify each selected band's camera and interpretation. The failed green and clear-filter batches have separate entries to prevent unchanged retries. |
| [Didymos](../../src/objects/didymos/investigations.json), `luke-photography` | The shape archive links LUKE inputs. | Bind and qualify LUKE's own cameras and detector quality. Accepted DRACO registration does not establish LUKE coverage or color. |

Some attractive improvements still depend on source acquisition rather than a
preparation trial:

| Candidate | What the recorded survey has not established |
| --- | --- |
| [1998 ML14](../../src/objects/asteroid-1998-ml14/investigations.json), `shape-solution` | The numerical reconstruction and spin/frame definitions announced in the 2016 abstract from newer radar observations. An accessible abstract alone cannot replace the older mesh. |
| [Nereus](../../src/objects/nereus/investigations.json), `updated-radar-mesh` | A numerical reconstruction from the newer 2021 observations. The radar gallery is not an optical texture. |
| [Vesta](../../src/objects/vesta/investigations.json), `recorded-survey-6` | The actual controlled-color release matching the Le Corre 2017 description. Its improved-registration claim does not identify an acquired product. |
| [Eurybates](../../src/objects/eurybates/investigations.json), `shape-solution` | The original 1,454-facet numerical reconstruction. The selected approximation is not that mesh. |

These are distinct source and qualification decisions, not a promise of a new
view per row. Check the existing recipe before reopening them: an old source
survey may predate working shared code, as happened with the source-surface
sampler and OSIRIS decoding.

## What this migration establishes

The September 2026 audit started with 310 catalogued asteroids and two ledgers.
It read their repository source sections, survey tables, recipes and known
limits, moving recorded decisions into the existing ledger format. The body
list comes from the canonical object descriptors. Full repeated DAMIT survey
sections were migrated as a group; body-specific radar and spacecraft decisions
were reviewed separately, including conflicting historical and current claims.

The newly imported `checked` date marks review of that repository record at
`d1374f2b47d1e24d7cc08368644c1a5c9444f8f0`. It does **not** claim a fresh archive
search, download, preparation, scientific qualification or browser run on that
date. Original READMEs are linked at that revision so their observations and
limits remain inspectable. Dinkinesh and Toutatis retain their earlier ledger
history. The linked Dinkinesh registration artifacts remain exploratory failures,
not acceptance of a photographic lens.

The audit also found 99 READMEs whose two earlier browser cases did not identify
a tested code revision, plus Vesta's missing dated test/browser report. Their
`versioned-view-evidence` entries make that debt searchable. They do not assert
that those bodies currently render incorrectly; a current focused check or a
sound revision binding is needed to settle the evidence gap.

Ledger coverage can reach every catalogued asteroid while archive coverage and
view qualification remain incomplete. Shape ambiguities, absent resolved
imagery and versioned-evidence gaps are different kinds of unfinished work.
Use the findings and reopening conditions to choose work, rather than treating
the unresolved count as a list of immediately implementable lenses.
