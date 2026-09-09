# Sun: test results and known problems

These links were checked against main `2f6f8614` on 2026-09-09. SOURCE explains
the CR2311 observations, magnetic field values, false-color AIA bands and how
imagery is extended for display. These images were taken at different times;
they are not live.

| Claim | Record | Scope and limits |
| --- | --- | --- |
| Observation and processing interpretation | [SOURCE](../../../src/planets/sun/SOURCE.md) | Documents dates and processing near the poles and disk edge; no new independent scientific review was run here |
| Sources and processing for each output | [Provenance](../../../src/planets/sun/prepared/provenance.json) | Describes the generated files; does not show that sources were downloaded again |
| Reproduction and browser behavior | [Unit tests](../../../tests/objects/unit/sun), [browser profile](../../../tests/objects/browser/sun/browser-profile.mjs) | Links to test code; no new passing result is recorded here |
| Visual check and fresh installation | No new run recorded here | These checks remain unverified by this documentation change |

SOURCE now points to shared preparation; its old private Sun script no longer
exists. For the next change, run the relevant scientific, preparation and browser
checks and link their saved results here.

## Source and generated files

- [Source interpretation](../../../src/planets/sun/SOURCE.md) and [attribution](../../../src/planets/sun/NOTICE.md).
- [Input pins](../../../src/planets/sun/source/manifest.json) and [authored descriptor](../../../src/planets/sun/object.json).
- [Sources and processing for each output](../../../src/planets/sun/prepared/provenance.json) and [runtime inventory](../../../src/planets/sun/runtime-assets.json).
- [Prepared view definitions](../../../src/planets/sun/prepared/lenses.json) define the delivered views.
- [Shared contributor guide](../../../src/planets/README.md) and [documentation contract](../../provenance/CONTRACT.md).
