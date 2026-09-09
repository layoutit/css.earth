# Earth: test results and known problems

These links were checked against main `2f6f8614` on 2026-09-09. Each report
names the version it tested. No browser or installation tests were rerun here.

| Claim | Record | Scope and limits |
| --- | --- | --- |
| Surface, radiance, elevation and atmosphere interpretation | [SOURCE](../../../src/planets/earth/SOURCE.md) | Observation dates, display transfer, numeric meaning, source survey and derivation limits |
| July cloud-free surface and cloud dataset | [Cloud-free default](../../earth/cloud-free-default/README.md) | Earlier checks of selected source restoration, 179-file image installation and browser behavior; see the report for failures and checks left out |
| Elevation | [Elevation evidence](../../evidence/earth-elevation/README.md) | Check the datum, tested version and coverage recorded in that run |
| Annual night radiance | [Night lights](../../earth-night-lights.md) | Annual product and interpretation; not live light pollution or sky brightness |
| Geographic coverage and remote pages | [Global coverage](../../global-earth-coverage.md) | Check the recorded coverage and downloads; a global dataset label does not prove every page is available |

Installing runtime images does not check source restoration or complete
geographic paging. Record which remote pages were actually verified. When adding
a layer, read the dataset choices and unresolved alternatives in SOURCE.

## Source and generated files

- [Source interpretation](../../../src/planets/earth/SOURCE.md) and [attribution](../../../src/planets/earth/NOTICE.md).
- [Input pins](../../../src/planets/earth/source/manifest.json) and [authored descriptor](../../../src/planets/earth/object.json).
- [Sources and processing for each output](../../../src/planets/earth/prepared/provenance.json) and [runtime inventory](../../../src/planets/earth/runtime-assets.json).
- [Prepared view definitions](../../../src/planets/earth/prepared/lenses.json) define the delivered views.
- [Shared contributor guide](../../../src/planets/README.md) and [documentation contract](../../provenance/CONTRACT.md).
