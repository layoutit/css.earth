# Moon source-review contract

Review the frozen 484-row scope before proposing any implementation PR: 461 planet/Pluto satellites, existing Dimorphos, and 22 selected companions. This is source feasibility review, not implementation or release qualification.

Each lane owns only `<lane>-review.json` and `<lane>-review.md` in this directory. Do not edit the tracker, historical snapshot, application files, another lane's outputs, or Git state. Preserve all unrelated work. Read sources from merged implementation commit `7b289887ee03e040b981f6aaff25390d1e17ca9c` using `git show`; the main working checkout is older and dirty.

Return JSON with `lane`, `checkedOn`, `sources`, `rows`, `summary`, and `limitations`.

`sources` is an array of objects with unique `id`, `title`, `url`, `kind`, `checkedOn`, `evidence` (short paraphrase), `scope` (actual supported bodies/data), `access` (`read`, `metadata-only`, or `unresolved`). Prefer actual mission archives, research papers and released data. A reputable institution or discovery list alone does not establish shape or imagery availability. Keep inaccessible leads explicit.

Every input row must appear exactly once in `rows`, with these fields:

- `key`, `parent`, `name`, `sceneStatus` (copied from input).
- `reviewStatus`: `reviewed` only once a bounded source search yields an evidence-backed disposition. An unresolved source can remain within a completed review if the access/identity problem and its implication are explicit.
- `disposition`: `improve-existing`, `retain-existing`, `model-candidate`, `observation-candidate`, `orbit-context-only`, or `source-blocked`.
- `geometry`: available evidence and limits; separate radius estimate, measured axes, inferred shape and released mesh.
- `imagery`: useful observations/coverage/registration or the precise search boundary. Do not turn “not found in checked sources” into “does not exist.”
- `orbit`: source availability, identifiers/solution scope, and a note if runtime fit or validity is untested. Discovery astrometry is not a qualified orbit implementation.
- `supportedRepresentation`: what could honestly be displayed from reviewed evidence; do not invent a default sphere/texture to increase counts.
- `nextAction`, `blocker`, `effort`: concrete action, limiting issue and bounded judgment (`small`, `medium`, `large`, `research`, or `none`) with rationale in `effortReason`.
- `sourceIds`: linked source records that actually support this body's review. Shared sources are allowed only with explicit membership evidence in `searches`.
- `searches`: compact list of catalog lookups, designation/alias membership, queries and archive/release checks performed for that body. Grouped review is valid when the row is individually reconciled against the checked product's actual scope; unexamined bodies may not inherit claims from a family.
- `confidence`: `high`, `medium`, or `limited`, referring to this feasibility disposition, not measurement precision.

Existing packages: read their SOURCE.md and relevant content/recipe at the inspected commit, follow promising open source leads, and give an improvement or retain disposition. Do not label the entire reviewed scope “fully qualified.”

Missing packages: check at least the authoritative catalog/astrometry route and physical-observation sources relevant to their population; individually investigate promising named bodies and new source leads. Small recent discoveries can share an orbit-context disposition when their exact identifiers have been checked against discovery/physical products. Cite exact discovery notices where accessible. An orbit-only disposition remains useful review; it does not approve a fabricated scene.

The Markdown companion should summarize findings, best candidates, rejected/unresolved paths, and genuine limits. No PR, publishing, source baking, large downloads, or builds. Download only small research metadata/papers needed for the review, and use task-specific temporary files. Do not spawn further agents; the root coordinates the bounded lanes.
