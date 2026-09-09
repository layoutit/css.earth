# 67P comet

Route: `/comet-67p/`. Rosetta's two-lobed comet, shown with a measured shape,
photographic mosaics and scientific maps.

## Sources

| What is shown | Source and treatment | Limits |
| --- | --- | --- |
| Shape | ESA/RMOC MTP019 NAVCAM model, reduced from 104,192 to 1,000 triangles. The default view uses neutral gray to show the shape. | Simplified geometry; gray is an authored material, not measured surface color. |
| OSIRIS mosaic | Six calibrated orange-filter photographs from August and September 2014. Preparation approximately corrects illumination, matches brightness and selects accepted samples on the mesh. | Grayscale observed appearance, not measured albedo. Photographed shadows and seams remain. Grid marks missing or rejected imagery. |
| Albedo, spectral slope, 3.2 µm absorption and modeled ice | Rosetta VIRTIS maps from August–September 2014, with separate quantities and legends. | Registration is approximate. Missing samples and ambiguous mapping near the neck stay gridded. Modeled ice is a model result. |
| Regions | Thomas et al. (2018), SHAP7 data with 26 named regions, mapped onto the display mesh. | Boundaries are transferred between source models. |
| Geology | ESA's OSIRIS geological map: 843 paths and 2,265 feature centers across 17 studied regions. | Lines and dots are map symbols, not measured feature sizes. Coverage is incomplete. |

[SOURCE.md](SOURCE.md) records the source survey, coordinate conventions,
selection rules and calculations. The [manifest](source/manifest.json) records
the original files, URLs, sizes and hashes, including each OSIRIS image's quality
companion. [NOTICE.md](NOTICE.md) gives the credits and reuse terms.

The [recipe](source/preparation/terrestrial.json) defines processing. The
[prepared provenance](prepared/provenance.json) connects generated files to
inputs; the [runtime inventory](runtime-assets.json) identifies the shipped images.
`prepared/osiris-source-index.json` records which observation supplied each
atlas texel. The browser does not load that inspection file.

## Evidence

These are existing results. No scientific, installation or browser tests were
rerun for this documentation change.

| Check | Recorded result | Report |
| --- | --- | --- |
| Six-image OSIRIS mosaic | Accepted photographed area increased from 56.04% to 56.25% of the displayed mesh. The two added images supply about 1.76% of its area. | [Surface imagery](../../../docs/comets/SURFACE-IMAGERY.md) |
| September image registration | Maximum errors on source pixels withheld from camera fitting were 0.00190 and 0.00161 pixels. Geometry and acceptance limits stayed unchanged. | [Numerical results](../../../docs/comets/evidence/surface-imagery-qualification.json) |
| Source restoration and runtime installation | The four-comet run downloaded 16 new source files and installed 167 runtime files with matching sizes and hashes. Older source inputs were copied. | [Restoration](../../../docs/comets/evidence/surface-imagery-source-restore.json), [installation](../../../docs/comets/evidence/surface-imagery-delivery.json) |
| Browser behavior | The imagery run checked five photographic views at DPR 1 and 2. All 60 comet conformance cases passed; the renderer suite had 367 passes and nine failures. Application revision: `87ddd9680f76082eedd9915e86bda3253311b0f3`. | [Browser checks](../../../docs/comets/evidence/surface-imagery-browser.json), [conformance](../../../docs/comets/evidence/surface-imagery-conformance.json), [validation](../../../docs/comets/evidence/surface-imagery-validation.json) |
| Visual comparison | Previous and new atlases were shown on the same renderer with matching camera and lighting, alongside their absolute RGB difference. | [Images and comparison details](../../../docs/comets/SURFACE-IMAGERY.md#matched-visual-comparisons) |
| VIRTIS and geology | Separate reports describe the scientific quantities, source decoding, registration checks and remaining limits. | [VIRTIS](../../../docs/comets/67P-VIRTIS.md), [geology](../../../docs/comets/67P-GEOLOGY.md) |

The [first photographic integration](../../../docs/comets/67P-OSIRIS-INTEGRATION.md),
[four-image mosaic](../../../docs/comets/67P-OSIRIS-COVERAGE.md) and
[original comet tests](../../../docs/comets/QUALIFICATION.md) keep their earlier
results and tested versions.

## Known problems

- The September image entries in the manifest repeat an August 5 observation
  date, while the recipe lists September dates. The recipe's display description
  also still says four photographs despite listing six. Those records need correction.
- The committed comparison images are available, but some original screenshots
  are referenced only through ignored local paths.
- The browser checks changed Shadows through a hidden input. They do not prove
  that a user could open Settings. The recorded full renderer suite was not green.
- The photographs do not cover the whole comet. They retain shadows and seams;
  comparisons against earlier atlases do not establish pixel matching with native
  source photography. SOURCE lists unresolved alternative datasets.
