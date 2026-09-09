# B3 — Spacecraft imagery and geologic mapping

Owner: Moons · Started 2026-09-09 · Branch: `feat/moons-spacecraft-mapping` · Base: merged B2 `ef07fac2d3208e201dafc626374b30ed4644f561`.

The user authorized the 12-target B3 proposal. Delivery remains one substantial PR after every target has a source disposition. A source-review pass is not implementation or qualification.

| Cohort | Targets | Source review |
| --- | --- | --- |
| Jupiter and new companions | Callisto, Thebe, Dactyl, Selam | Reviewed; target-specific registration work continues |
| Saturn | Hyperion, Phoebe, Aegaeon | Reviewed; target-specific registration work continues |
| Neptune and Pluto | Proteus, Nix, Hydra | Reviewed; target-specific registration work continues |
| Uranus maps carried from B2 | Titania, Miranda | Exact releases recovered and registered; both Geology views prepared |

The original [484-body review](review-2026-09-08/BODY-REVIEWS.md) remains the survey baseline. This pass resolves concrete release access, calibrated-image identity, geometry and registration requirements. Reviews and acquisition evidence live in `b3-preparation/`.

## Delivery boundary

Two new-body claims require observed shape constraints and real spacecraft imagery. Existing-body improvements must add supported observations or mapping, with their own source coverage. Unseen terrain remains missing; image alignment is qualified with source geometry and independent anchors. Runtime consumes prepared assets through the existing object contract and shared camera.

Titania and Miranda retain their exact selected 2026 GIS releases. Failure to retrieve a release leaves it unresolved. Cohort changes require an explicit scope decision before delivery.

## Qualification

All 12 targets have source dispositions in the cohort reviews. Four bodies have prepared upgrades: Titania and Miranda historical Geology, Hyperion's finer clear-filter frame and Proteus filter color. Initial automated Chrome runs passed eight body/DPR cases; visual review found that Proteus's new lens initially faced the unobserved hemisphere, and its prepared camera focus is being corrected. Callisto's published Galileo color plate passed independent landmark registration and is being integrated. Phoebe's paired 2023 shape, relative albedo and coverage diagnostics passed native numeric and sampled geometry checks and are being prepared. Final browser review, source closure, fresh installation, publication and aggregate reporting remain pending.

## Source dispositions requiring a delivery decision

| Target | Finding | Proposed disposition |
| --- | --- | --- |
| Dactyl | Encounter imagery is available, but an exact historical state and a unique frame/rotation are not qualified. | Preserve source research; defer the new scene. |
| Selam | Published shape and original Lucy frames are retained; pointing needs the published control adjustment and no current epoch state is qualified. | Preserve source research; defer the new scene. |
| Thebe | The candidate frame has no complete usable bilinear footprint and adds zero supported coverage. | Reject this candidate; retain the existing scene. |
| Aegaeon | Tiny resolved disk and a roughly 134.75° meridian disagreement prevent a defensible map. | Retain the existing ellipsoid while frame registration remains unresolved. |
| Nix | Two views support competing poses with nearly equal held-out errors and meridians about 186° apart; threshold changes switch the preferred pose. | Preserve the reproducible experiment; defer mapped imagery. |
| Hydra | Original imagery and source mesh are reviewed; no qualified per-pointing registration is completed. | Defer mapped imagery. |

These recommendations do not silently redefine the original twelve-target delivery scope. No PR is open for this batch.
