# Galatea

## Sources

- Its semiaxes are **102 × 92 × 72 km**, from Karkoschka (2003), *Sizes, shapes, and albedos of the inner satellites of Neptune*, Icarus 162, 400–407, [DOI](https://doi.org/10.1016/S0019-1035(03)00002-2).

## Evidence

- The first 20 results and full metadata for the four inspected observations are pinned in [source/survey/](source/survey/); their original calibrated products remain available through the per-observation PDS file endpoints.

- Independent radial intersections in 2,000 equal-area directions compared with the analytic ellipsoid differ by 0.876 km mean, 1.607 km at the 95th percentile, and 2.513 km maximum sampled error. These are display approximation errors, distinct from uncertainty in the source measurements; the simplifier setting is not a maximum radial-error bound.

## Known problems

- The smooth ellipsoid interpolates those three measurements; it contains no measured craters or local elevation.

- All surface texels are unavailable. The existing preparation recipe marks its constant source material as no-data and paints cssEarth's standard neutral grid.

- The pole and rotation follow that pinned IAU/NAIF PCK; aligning the long ellipsoid axis toward Neptune is a synchronous model assumption, not a resolved cartographic control network.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="galatea-sources-and-interpretation"></a>

Galatea has one **Shape model** dataset. The paper's abstract states the triaxial dimensions explicitly.

`source/measurements.json` records the exact analytic radial formula, units, sampling, source citation and material. `source/shape/ellipsoid.tab` samples that formula every 5°. The reference radius is 88 km, approximately the 87.75 km volume-equivalent radius of these axes. The older 79 km spherical value in `pck00011.tpc` is not used as the body's shape.

Surface, minimap, thumbnail and companion portrait share this interpretation. Flood lighting and the optional Shadows mode describe the same geometry. There is no photographed terminator to remove, no separate atmosphere, no invented visible color, and no elevation lens for this three-axis model.

## Dataset survey

Surveyed 2026-09-07 beyond the first press image:

| Candidate | Disposition |
| --- | --- |
| [PDS Voyager ISS original GEOMED frames](https://pds-rings.seti.org/voyager/iss/) | Original C1135055, C1144523, C1144537 and C1145807 were downloaded and decoded. C1135055 is the finest observation in the OPUS Galatea-geometry inventory: 18.66229 km per original detector pixel, 15.36 s exposure, 13.079° phase. The geometrically corrected image shows an elongated streak rather than independently registered terrain. The other candidates are coarser, at about 134° phase, with 15.36–61.44 s exposures. Excluded from surface mapping: a static perspective projection would turn motion smear into invented features. |
| [Karkoschka 2003 Voyager reanalysis](https://doi.org/10.1016/S0019-1035(03)00002-2) | Included for measured ellipsoid axes. A measured shape fit is useful even when its contributing photographs do not support a surface texture. Full publisher text was unavailable during this pass; only the explicitly published abstract dimensions are used, without guessed uncertainties or unseen terrain. |
| [PDS Stooke shape-model release](https://sbn.psi.edu/pds/resource/stkshape.html) | Release contents were checked: Neptune models cover Larissa and Proteus, not Galatea. No Galatea detailed mesh was substituted. |
| [Keck NIRC2 near-infrared photometry, 2024](https://doi.org/10.1016/j.icarus.2024.116004) | Distinct measured H-band photometry, derived by aperture integration of shifted and stacked moon images. Useful for integrated reflectivity, not a spatially resolved color or composition surface. Excluded as a surface lens. |
| USGS/LPI mapped products | No registered Galatea cartographic, topographic or geological surface product was located in this survey. This is a search outcome, not a claim that no other observations exist. |

OPUS intended-target searches omit Galatea because those archival frames targeted Neptune/rings. The relevant inventory uses `surfacegeometrytargetlist=Galatea`, sorted by `SURFACEGEOgalatea_centerresolution1`. C1135055 geometric correction resamples the original detector grid to 1000 × 1000 pixels; that does not increase independent resolution.

## Preparation and restoration

The existing radial-terrain preparer starts from 5,040 sampled triangles and uses meshoptimizer to target 480 native PolyCSS `u` raster triangles within a 1,500 m simplifier error setting. Its estimated simplifier error is 1.484 km. No body-specific runtime is introduced.

`source/manifest.json` pins the authored radius table, material, scientific metadata, title font and starfield. The compact model inputs are checked in; `source/preparation/acquisition.json` restores the external font and starfield inputs.

Credits and reuse terms are in NOTICE.md and the source manifest. The grid is a no-data indicator, not an observation, albedo measurement or prediction of Galatea's appearance.

</details>
