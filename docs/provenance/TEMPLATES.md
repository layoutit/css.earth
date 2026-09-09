# Contributor templates

These are authoring examples for the [contract](CONTRACT.md), not executable
schemas or passing evidence. Replace example values with actual identities.
Use existing manifest/product IDs; do not create a parallel source registry.

## Body README

```markdown
# Body name

Route: /body-id/. Brief description of the supported representation.
The prepared lens/content files remain the capability authority.

- Source interpretation: SOURCE.md, with deeper source notes linked there.
- Attribution: NOTICE.md and applicable license files.
- Input pins: source/manifest.json.
- Authored recipe: object.json and source/preparation/.
- Generated lineage: prepared/provenance.json.
- Runtime delivery inventory: runtime-assets.json.

## Evidence and open work

| Claim | Evidence and tested candidate | Scope and remaining limits |
| --- | --- | --- |
| Source restoration | Link to an actual receipt/run and revision | Which inputs were downloaded, copied or verified |
| Scientific interpretation | Link to independent anchors and review | What the checks establish and leave unresolved |
| Browser and visual result | Link to run/case IDs and review | Exact lenses, settings, DPR and shared dependencies |
| Runtime installation | Link to empty-destination receipt | What was actually installed and from where |

Do not imply that historical receipts qualify the current checkout.
List NOT_RUN or UNBOUND claims explicitly where no qualifying evidence exists.
Link useful unresolved dataset candidates from SOURCE.md.
```

Use actual relative Markdown links in the resulting README. Existing small
READMEs may retain useful domain explanation; keep status in one evidence section.

## SOURCE.md sections

Add these sections to the existing source record as relevant. Reuse deeper
interpretation documents rather than copying their tables.

| Section | Contents |
| --- | --- |
| Representation and claims | What is measured, derived, modeled or illustrative; each selected lens and changed scientific fact |
| Claim-to-source map | Manifest source IDs; source field/table/product; recipe operation or JSON Pointer; independent check |
| Interpretation | Coordinates, epoch, units, resolution, validity, calibration and display transformations |
| Candidate decisions | Exact source link, benefit, included/excluded/unresolved, reason and checked date |
| Reproduction boundary | Original bytes restored; upstream processing accepted as supplied; our reproducible conversion/preparation |
| Limitations | Coverage, uncertainty, source/display approximation and unresolved scientific questions |

Attribution belongs in NOTICE and manifest entries. Qualification dates/outcomes
belong in linked run records. After adding a new dataset, update SOURCE and NOTICE
as well as the machine manifest so that all entry points can discover it.

## Evidence envelope fields

All artifact and dependency file paths are repository-relative unless explicitly
marked as a durable external URI. Each URI declares access and retention.
Hashes are lowercase SHA-256 of exact bytes. The candidate manifest lists the
actual contributing code/data/served assets, not just the changed files.

| Field | Required meaning |
| --- | --- |
| `schema`, `runId`, `startedAt`, `finishedAt` | `cssearth-evidence-run@1`, unique run identity, UTC times |
| `scope` | Body IDs from OBJECTS, product/lens/capability IDs and exclusions |
| `producer` | Harness path/revision, contributor if known, actual commands |
| `candidate` | Tested code commit, dirty state and a path/bytes/hash dependency manifest; before/after identity |
| `environment` | Tools/platform; browser and capture conditions when applicable |
| `checks` | Stable check IDs, command/cases, outcome, exit/signal, artifact references and limitations |
| `claims` | Scientific/runtime/delivery/visual claims mapped to actual checks, with separate outcome and freshness |
| `artifacts` | Stable IDs, role, path/URI, bytes, SHA-256; archive member manifest and access/retention where applicable |
| `review` | Visual/interpretive reviewer and findings; `NOT_RUN` if absent |
| `relationships` | Reused/superseded run IDs, exact claim scope and identity proof |

Illustrative partial record (not a complete runnable example):

```json
{
  "schema": "cssearth-evidence-run@1",
  "runId": "EXAMPLE-DO-NOT-SUBMIT",
  "scope": { "objectIds": ["rhea"], "lensIds": ["infrared"] },
  "claims": [
    {
      "id": "infrared-source-interpretation",
      "outcome": "NOT_RUN",
      "freshness": "UNBOUND",
      "checks": [],
      "limitations": ["Template only; no candidate or evidence was captured."]
    }
  ],
  "artifacts": [],
  "review": { "outcome": "NOT_RUN" }
}
```

## REVIEW.md

State the supported claim first, then give the tested candidate, cases and links
to original evidence. Show useful selected images. For a matched comparison,
show reference/current/absolute diff and identify the kind of reference.
Record actual observations, failures and omissions. End with the claims that
remain open, including aggregate failures outside the focused scope.

A historical wrapper names the original producer and date; its packaging date
is separate. Missing metadata stays missing. Copying or hashing an old report
does not rerun it or change its freshness.
