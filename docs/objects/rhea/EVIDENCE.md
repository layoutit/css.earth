# Rhea: test results and known problems

These links were checked against main `2f6f8614` on 2026-09-09. The reports
record earlier tests. None were rerun for this documentation change.

| Claim | Record | Scope and limits |
| --- | --- | --- |
| Original maps and body interpretation | [SOURCE](../../../src/planets/rhea/SOURCE.md), [VIMS interpretation](../../../src/planets/rhea/source/vims/INTERPRETATION.md) | Separates photographic, SPC and VIMS quantities; source registration and simplification remain limited |
| B2 source shape and scientific maps | [B2 delivery](../../moons/b2-preparation/final/DELIVERY.md) | Earlier tests of selected bodies; check the tested version and unfinished checks |
| B7 VIMS conversion and independent source checks | [Source review](../../moons/b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md) | Dione/Rhea original cube interpretation and Titan mapping; uses the mission's supplied data reduction |
| B7 browser/visual and installation | [Visual review](../../moons/b7-cassini-atlas/VISUAL-REVIEW.md), [integrated receipt](../../moons/b7-cassini-atlas/evidence/integration/qualification.json) | Selected views at DPR 1/2, screenshots and installation results; includes limits involving public Settings access and full-suite tests |

The B7 views are false-color infrared and a derived continuum-relative ice
absorption indicator, not ice percentage. New VIMS view details and credit are
linked from SOURCE and NOTICE.

## Source and generated files

- [Source interpretation](../../../src/planets/rhea/SOURCE.md) and [attribution](../../../src/planets/rhea/NOTICE.md).
- [Input pins](../../../src/planets/rhea/source/manifest.json) and [authored descriptor](../../../src/planets/rhea/object.json).
- [Sources and processing for each output](../../../src/planets/rhea/prepared/provenance.json) and [runtime inventory](../../../src/planets/rhea/runtime-assets.json).
- [Prepared view definitions](../../../src/planets/rhea/prepared/lenses.json) define the delivered views.
- [Shared contributor guide](../../../src/planets/README.md) and [documentation contract](../../provenance/CONTRACT.md).
