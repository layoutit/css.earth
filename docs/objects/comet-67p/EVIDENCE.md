# 67P comet: test results and known problems

Links checked against main `2f6f8614` on 2026-09-09. No tests were rerun here.

- [Source interpretation](../../../src/planets/comet-67p/SOURCE.md) and [attribution](../../../src/planets/comet-67p/NOTICE.md).
- [Input pins](../../../src/planets/comet-67p/source/manifest.json) and [authored descriptor](../../../src/planets/comet-67p/object.json).
- [Sources and processing for each output](../../../src/planets/comet-67p/prepared/provenance.json) and [runtime inventory](../../../src/planets/comet-67p/runtime-assets.json).
- [Prepared view definitions](../../../src/planets/comet-67p/prepared/lenses.json) define the delivered views.
- [Shared contributor guide](../../../src/planets/README.md) and [documentation contract](../../provenance/CONTRACT.md).

The [imagery report](../../comets/SURFACE-IMAGERY.md) links source restoration,
numerical checks, image installation and selected browser tests at DPR 1/2.
Read its full-suite renderer failures and limits from using hidden Settings.
The comparison images show the previous and new atlases on the same renderer,
plus their absolute RGB difference. They do not compare against native captures.
The combined comparison images are committed. Some original screenshots are
listed only at ignored local paths, with no saved location another reviewer can use.

[VIRTIS](../../comets/67P-VIRTIS.md),
[geology](../../comets/67P-GEOLOGY.md) and
[original comet qualification](../../comets/QUALIFICATION.md) remain
earlier reports with their own tested versions and limits. SOURCE lists dataset
choices still unresolved. These reports do not show that the current full build
and all-body browser tests pass.

## Earlier records

The [OSIRIS coverage record](../../comets/67P-OSIRIS-COVERAGE.md)
retains the earlier four-image mosaic's source, coverage and browser evidence.
The [surface-imagery record](../../comets/SURFACE-IMAGERY.md) documents
the expanded six-image result and the source, installation and browser checks performed.
`prepared/osiris-source-index.json` records which observation supplied each
texel, losslessly and with hashes; the browser does not load it. The original single-image
lens remains documented in the [integration record](../../comets/67P-OSIRIS-INTEGRATION.md). The original
comet delivery remains in the [shared qualification record](../../comets/QUALIFICATION.md).
