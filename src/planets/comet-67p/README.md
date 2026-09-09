# 67P comet

Open `/comet-67p/` to inspect the Rosetta nucleus. Drag and zoom use the common application camera; **Shadows** switches baked lighting. The full source interpretation and limitations are in [SOURCE.md](SOURCE.md); credits are in [NOTICE.md](NOTICE.md).

Choose **OSIRIS mosaic** for six grayscale orange-filter observations from
August and September 2014. Disk illumination is approximately normalized before preparing the shared
lighting banks. Gray grid marks missing or rejected photograph samples; the
source mesh remains complete. The default **Shape model** lens is unchanged.

**Albedo**, **Spectral slope**, **3.2 µm absorption**, and **Modeled ice** add four VIRTIS scientific views from Aug–Sep 2014. Each has its own quantity, units and false-color legend. Gray grid includes missing measurements and ambiguous angular coverage near the neck. **Shadows off** preserves numeric palette colors. The [VIRTIS record](../../../docs/comets/67P-VIRTIS.md) documents model assumptions, approximate registration, source decoding and validation.

**Regions** colors the 26 named terrain regions. **Geology** shows mapped fractures,
cliffs, terraces and feature locations across the study's 17 regions. Lines and
dots are cartographic symbols, not measured feature sizes. Grid marks unsupported
coverage or unreliable matches between the source models. Both use the current
1,000-triangle mesh and the existing lighting controls. The [geology record](../../../docs/comets/67P-GEOLOGY.md)
documents the original SHAP7/SBMT data, coordinate registration and qualification.

With a supported Node version and dependencies installed:

```sh
pnpm setup:assets --object=comet-67p
pnpm dev
```

To acquire and reproduce the object from source:

```sh
pnpm build:preparation
node tools/objects/dist/operations.js acquire comet-67p
node tools/objects/dist/prepare-authored.js comet-67p --write
node tools/prepare-navigation.mjs
node tools/prepare-object-json.mjs
```

The authored neutral PNG and derived context PNG are checked in. Acquisition follows the current manifest and recipe to restore the original OBJ,
six selected OSIRIS GEO/quality IMG pairs, NAVCAM reference, four VIRTIS table/label pairs and interpretation documents, SHAP7 region cells, ESA SBMT feature files and guide, the SHAP5 ambiguity reference, ESO panorama and Inter font and verifies their pinned hashes. `prepared/object.json` is generated at installation/build time; the prepared geometry and runtime inventory remain versioned. No other object is synthesized as a fallback.

Focused checks:

```sh
node --test tests/objects/unit/comet-67p/*.test.mjs tools/objects/terrestrial-layers/observation-mosaic.test.mjs tools/objects/terrestrial-layers/pds-scalar-map.test.mjs
pnpm test:browser http://127.0.0.1:4257 comet-67p
pnpm test:browser:conformance http://127.0.0.1:4257 comet-67p
```

The [OSIRIS coverage record](../../../docs/comets/67P-OSIRIS-COVERAGE.md)
retains the earlier four-image mosaic's source, coverage and browser evidence.
The [surface-imagery record](../../../docs/comets/SURFACE-IMAGERY.md) documents
the expanded six-image result and its scoped source, delivery and browser checks.
`prepared/osiris-source-index.json` is a hash-bound, lossless per-texel observation
raster for inspection; the browser does not load it. The original single-image
lens remains documented in the [integration record](../../../docs/comets/67P-OSIRIS-INTEGRATION.md). The original
comet delivery remains in the [shared qualification record](../../../docs/comets/QUALIFICATION.md).

## Evidence entry point

Indexed against main `2f6f8614`, 2026-09-09; no new qualification was run.

- [Source interpretation](SOURCE.md) and [attribution](NOTICE.md).
- [Input pins](source/manifest.json) and [authored descriptor](object.json).
- [Generated product lineage](prepared/provenance.json) and [runtime inventory](runtime-assets.json).
- [Prepared lens declarations](prepared/lenses.json) define the delivered views.
- [Shared contributor workflow](../README.md) and [documentation contract](../../../docs/provenance/CONTRACT.md).

The [latest indexed imagery report](../../../docs/comets/SURFACE-IMAGERY.md)
links source restoration, numerical receipts, image delivery and selected
DPR1/2 conformance. Its renderer aggregate failures and hidden-Settings scope
remain explicit. Matched triptychs show a previous atlas on the current renderer,
current atlas and absolute RGB difference; they do not claim native parity.
Original frames referenced only under ignored output paths lack a portable
mapping in that receipt; the committed composites remain available.

[VIRTIS](../../../docs/comets/67P-VIRTIS.md),
[geology](../../../docs/comets/67P-GEOLOGY.md) and
[original comet qualification](../../../docs/comets/QUALIFICATION.md) remain
historical claims with separate scope. SOURCE retains unresolved dataset
candidates. No current all-body build/browser acceptance is inferred.
