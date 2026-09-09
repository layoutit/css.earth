# Sun

Route: `/sun/`. Prepared Carrington synoptic observations and separately sourced
off-limb context use the same body contract as other detailed objects.

- [Source interpretation](SOURCE.md) and [attribution](NOTICE.md).
- [Input pins](source/manifest.json) and [authored descriptor](object.json).
- [Generated product lineage](prepared/provenance.json) and [runtime inventory](runtime-assets.json).
- [Prepared lens declarations](prepared/lenses.json) define the delivered views.
- [Shared contributor workflow](../README.md) and [documentation contract](../../../docs/provenance/CONTRACT.md).

## Evidence and open work

This entry point was checked against main `2f6f8614` on 2026-09-09. The source
record distinguishes CR2311 observations, numeric magnetic field, false-color
AIA bands and display continuation. These are not simultaneous or live images.

| Claim | Record | Scope and limits |
| --- | --- | --- |
| Observation and processing interpretation | [SOURCE](SOURCE.md) | Dataset dates and polar/limb processing are documented; independent current scientific review was not run here |
| Declared source/product lineage | [Provenance](prepared/provenance.json) | Read its basis and coverage; a declaration is not fresh source acquisition |
| Reproduction and browser behavior | [Unit test owners](../../../tests/objects/unit/sun/), [browser profile](../../../tests/objects/browser/sun/browser-profile.mjs) | These are executable check locations, not passing receipts |
| Current visual acceptance / fresh install | No current portable run indexed in this documentation pass | NOT_RUN here; no ready claim is inferred from source notes or asset count |

The old SOURCE command targeting a removed private Sun tool has been replaced
with the shared preparation route. Qualify a future change through that route
and the relevant independent/browser checks, then link its portable receipt here.
