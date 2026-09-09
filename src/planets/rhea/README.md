# Rhea

Route: `/rhea/`. Cassini and Voyager imagery and scientific maps on a simplified
spacecraft-derived shape.

## Sources

| What is shown | Source and treatment | Limits |
| --- | --- | --- |
| Monochrome | USGS Cassini–Voyager mosaic (2012), 11,520 × 5,760 at about 417 m/pixel. Preparation corrects its longitude origin and marks documented zero-valued no-data. | Source shadows, seams and differences in detail remain. |
| Enhanced color | NASA/JPL PIA18438 (2014), about 400 m/pixel, using Cassini ISS observations processed by Paul Schenk. | Includes ultraviolet and infrared information; it is not human-eye color. |
| Shape and elevation | Weirich et al. (2025) SPC shape and assessment products. The source mesh is reduced to 2,000 faces. Radius samples become height through `radius * 0.001 - 763.5` km. | The 763.5 km height datum, 764.1 km photographic projection radius and 764.5 km display reference have different purposes. Missing edge strips stay missing. |
| Relative albedo | The SPC brightness product, with dimensionless values normalized around 1 and a displayed range of 0.5–1.5. | Less validated than topography; terrain and shadow effects remain. It is not calibrated reflectance. |
| Infrared and ice absorption | Scipioni and Combe's Cassini VIMS mosaic collection. Three reflectance channels provide false color; a continuum-relative calculation provides the absorption indicator. | The indicator is not ice percentage, grain size or temperature. Missing samples remain missing; subpixel registration is unresolved. |

[SOURCE.md](SOURCE.md) records source selection, projection and height calculations.
The [VIMS interpretation](source/vims/INTERPRETATION.md) gives its field definitions
and conversion limits. We use the mission's supplied mosaic reduction; we do not
reproduce that upstream reduction. [NOTICE.md](NOTICE.md) contains credits and terms.

The [manifest](source/manifest.json) records exact source files, URLs, sizes and
hashes. The [descriptor](object.json), [prepared provenance](prepared/provenance.json)
and [runtime inventory](runtime-assets.json) identify preparation and generated files.

## Evidence

These reports describe earlier tests. None were rerun for this documentation change.

| Check | Recorded result or limit | Report |
| --- | --- | --- |
| B2 shape and scientific maps | The 2,000-face mesh is closed and connected. In 8,000 sampled source-distance checks, the maximum was 5,700.82 m. Sampling does not establish a full maximum-error bound or scientific uncertainty. | [B2 delivery](../../../docs/moons/b2-preparation/final/DELIVERY.md) |
| B7 VIMS conversion | Independent checks of the Dione/Rhea source cubes and their interpretation. The mission's original reduction is accepted as supplied. | [Source review](../../../docs/moons/b7-cassini-atlas/evidence/source/SOURCE-REVIEW.md) |
| B7 browser and installation | Selected views at DPR 1 and 2, saved screenshots and installation results. The reports retain limits involving public Settings access and full-suite tests. | [Visual review](../../../docs/moons/b7-cassini-atlas/VISUAL-REVIEW.md), [integrated results](../../../docs/moons/b7-cassini-atlas/evidence/integration/qualification.json) |

## Known limits

The simplified mesh does not retain all source detail. Image seams, photographed
shadows and gaps in the numeric maps remain. The VIMS ice-absorption view must
keep its stated meaning; it cannot support a claim about ice percentage.
Check each report's tested version and unfinished checks before reusing its result.
