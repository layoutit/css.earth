# Rhea

Route: `/rhea/`. Cassini/Voyager imagery and scientific maps are prepared onto
a simplified spacecraft-derived shape through the shared object runtime.

- [Source interpretation](SOURCE.md) and [attribution](NOTICE.md).
- [Input pins](source/manifest.json) and [authored descriptor](object.json).
- [Generated product lineage](prepared/provenance.json) and [runtime inventory](runtime-assets.json).
- [Prepared lens declarations](prepared/lenses.json) define the delivered views.
- [Shared contributor workflow](../README.md) and [documentation contract](../../../docs/provenance/CONTRACT.md).

## Evidence and open work

This entry point was checked against main `2f6f8614` on 2026-09-09. It indexes
historical evidence; it does not recertify that revision or a later checkout.

| Claim | Record | Scope and limits |
| --- | --- | --- |
| Original maps and body interpretation | [SOURCE](SOURCE.md), [VIMS interpretation](source/vims/INTERPRETATION.md) | Separates photographic, SPC and VIMS quantities; source registration and simplification remain limited |
| B2 source shape and scientific maps | [B2 delivery](../../../docs/moons/b2-preparation/final/DELIVERY.md) | Historical selected-batch evidence; use its exact candidate and incomplete gates |
| B7 VIMS conversion and independent anchors | [Source review](../../../docs/moons/b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md) | Dione/Rhea original cube interpretation and Titan mapping; upstream mission reduction is accepted as supplied |
| B7 browser/visual and installation | [Visual review](../../../docs/moons/b7-cassini-atlas/VISUAL-REVIEW.md), [integrated receipt](../../../docs/moons/b7-cassini-atlas/evidence/integration/qualification.json) | Selected views at DPR 1/2, original artifacts and delivery links; reports public Settings and aggregate limits |

The B7 views are false-color infrared and a derived continuum-relative ice
absorption indicator, not ice percentage. New VIMS view details and credit are
linked from SOURCE and NOTICE. No current full-repository qualification is claimed.
