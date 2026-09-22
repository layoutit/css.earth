# Chiron

Charles Kowal found Chiron in 1977 beyond Saturn, and it was the first Centaur known. It later grew a coma and was given a comet designation as well, so one body carries both names.

## Identity

JPL's Small-Body Database returns the same record for `sstr=2060` and for `sstr=95P`: designation `2060`, SPK identifier `20002060`, full name **2060 Chiron (1977 UB)**, kind `an` (numbered asteroid), alternate designations `1977 UB` (primary) and `95P` (comet), orbit class `CEN` (Centaur). cssEarth registers **one** scene for it. The names 2060 Chiron, (2060) Chiron, 1977 UB, 95P and 95P/Chiron all refer to this body. The [retained SBDB response](source/reference/sbdb.json) holds those fields.

## Sources

The view is a shape model with the shared unmapped-surface grid. Shadows default off.

| Source | Used for |
| --- | --- |
| [Braga-Ribas et al. (2023), A&A 676, A72](https://doi.org/10.1051/0004-6361/202346749) ([preprint](https://arxiv.org/abs/2308.10042)) | The adopted triaxial figure, semiaxes **126 ± 22, 109 ± 19 and 68 ± 13 km**, volume-equivalent radius **98 ± 17 km**, from the 2019 September 8 multi-chord stellar occultation. |
| [Lellouch et al. (2017), A&A 608, A45](https://doi.org/10.1051/0004-6361/201731676) | The area-equivalent radius **105 (+6 / −7) km** that the occultation fit holds fixed. This is a radiometric result, from ALMA 1.29 mm plus mid- and far-infrared data, not an occultation measurement. |
| [Marcialis and Buratti (1993), Icarus 104, 234](https://doi.org/10.1006/icar.1993.1098) | Synodic rotation period **5.917813 ± 0.000007 h**. |
| [Hainaut, Boehnhardt and Protopapa (2012), A&A 546, A115](https://doi.org/10.1051/0004-6361/201219566) (MBOSS-2) | Whole-disc colour over 34 epochs: spectral gradient **0.1 ± 1.0 % per 100 nm**, B−V **0.700 ± 0.020**, V−R **0.361 ± 0.017**, R−I **0.325 ± 0.023**. |
| [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2060) | Identity, alternate designations, discovery circumstances and orbit. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-21**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

### What the size numbers mean

Three different radii appear in the literature and they are not interchangeable.

- **Volume-equivalent radius 98 ± 17 km** (Braga-Ribas et al. 2023). This is the rendering scale, and it is the geometric mean of the adopted semiaxes.
- **Area-equivalent radius 105 (+6 / −7) km** (Lellouch et al. 2017, used as a fixed input to the occultation fit). This is the apparent disc, not the volume.
- **Diameter 218 ± 20 km** (Fornasier et al. 2013 thermophysical model). Widely quoted, but its own authors bracket Chiron at **196 to 225 km** with a geometric albedo anywhere between about 5 and 17 %, because the result depends on an adopted nucleus magnitude for an active body. It is recorded in the ledger, not adopted.
- **Diameter 166 km**, served by SBDB, traces to a 1990s occultation-chord list with no stated uncertainty. It is not used.

### Why the surface is neutral grey

MBOSS-2's spectral gradient is measured against the solar spectrum. At **0.1 ± 1.0 % per 100 nm** Chiron's reflectance is solar-coloured within its own errors, which is why it is the textbook grey Centaur. A display colour derived from these indices would be indistinguishable from neutral, and the indices mix nucleus and coma across 34 epochs of varying activity. The package therefore carries the measured indices as data and renders the shared neutral material.

## Known problems

Only the **apparent limb ellipse** is fitted from the occultation chords. The third axis follows from three assumptions stated in the paper: a Jacobi fluid-equilibrium figure at the 5.917813 h period, the true light-curve amplitude 0.16 ± 0.03 mag of Groussin et al. (2004), and a body pole assumed equal to the Ortiz et al. (2015) ring pole. The derived density 1119 ± 4 kg/m³ and mass 4.8 ± 2.3 × 10¹⁸ kg are consequences of that assumption, not measurements, and are not carried in this package.

Chiron has **no measured spin pole**. The display uses the illustrative ICRF north pole (right ascension 0°, declination +90°) with an arbitrary meridian and phase. The published ring or disk pole near ecliptic longitude 151°, latitude +20° is a pole of the *surrounding material*; the shape paper assumes the body shares it, and this display does not adopt that assumption as an orientation.

**No rings are drawn.** Chiron has published detections of confined material, most recently three coplanar rings at 273, 325 and 438 km from the 2023 September 10 occultation ([Pereira et al. 2025, ApJL 992, L19](https://doi.org/10.3847/2041-8213/ae0b6d)). Whether that material is planar rings, dust shells or jets is disputed, the structures are reported to change between the 2011, 2018, 2022 and 2023 events, and no result in this dispute has been retracted. The [ledger](investigations.json) records the disagreement and what would reopen it.

Chiron is an **active body**: coma, a 2021 outburst of at least 0.6 mag from which it had not returned to baseline by 2023, and gas detected by JWST. SBDB's absolute magnitude H = 5.54 has no stated uncertainty and is fitted to total magnitudes that include coma, so it is not a nucleus magnitude. No absolute magnitude is presented as a body fact here.

Chiron has never been resolved. At its current distance it subtends about 0.015 arcsec, far below the resolving power of any telescope, so there is no imagery to map and the grid marks unmapped terrain.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain the numerical authoring, acquisition and preparation used here; this body's input row is [centaurs/inputs.json](../../../tools/objects/source-authoring/centaurs/inputs.json). The existing terrestrial preparer and meshoptimizer turn the adopted analytical ellipsoid into retained PolyCSS native `u` raster triangles; runtime consumes the prepared result.

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through prepared provenance (`prepared/provenance.json`) and the [runtime asset inventory](runtime-assets.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
