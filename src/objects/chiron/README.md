# Chiron

Charles Kowal found Chiron in 1977 beyond Saturn, and it was the first Centaur known. It later grew a coma and was given a comet designation as well, so one body carries both names. The view is a shape model with the shared unmapped-surface grid. Shadows default off.

## Identity

JPL's Small-Body Database returns the same record for `sstr=2060` and for `sstr=95P`: designation `2060`, SPK identifier `20002060`, full name **2060 Chiron (1977 UB)**, orbit class `CEN` (Centaur), with alternate designations `1977 UB` and `95P`. cssEarth registers **one** scene for it; 2060 Chiron, (2060) Chiron, 1977 UB, 95P and 95P/Chiron all refer to this body. The [retained SBDB response](source/reference/sbdb.json) holds those fields.

## Sources

| Source | Used for |
| --- | --- |
| [Braga-Ribas et al. (2023), A&A 676, A72](https://doi.org/10.1051/0004-6361/202346749) ([preprint](https://arxiv.org/abs/2308.10042)) | The adopted triaxial figure, semiaxes **126 ± 22, 109 ± 19 and 68 ± 13 km**, volume-equivalent radius **98 ± 17 km**, from the 2019 September 8 multi-chord stellar occultation. |
| [Lellouch et al. (2017), A&A 608, A45](https://doi.org/10.1051/0004-6361/201731676) | The area-equivalent radius **105 (+6 / −7) km** that the occultation fit holds fixed. This is a radiometric result, from ALMA 1.29 mm plus mid- and far-infrared data, not an occultation measurement. |
| [Marcialis and Buratti (1993), Icarus 104, 234](https://doi.org/10.1006/icar.1993.1098) | Synodic rotation period **5.917813 ± 0.000007 h**. |
| [Hainaut, Boehnhardt and Protopapa (2012), A&A 546, A115](https://doi.org/10.1051/0004-6361/201219566) (MBOSS-2) | Whole-disc colour over 34 epochs: spectral gradient **0.1 ± 1.0 % per 100 nm**, B−V **0.700 ± 0.020**, V−R **0.361 ± 0.017**, R−I **0.325 ± 0.023**. |
| [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2060) | Identity, alternate designations, discovery circumstances and orbit. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

[Measurements and assumptions](source/measurements.json) keep the numerical extraction; the [source manifest](source/manifest.json) pins the files. See [NOTICE.md](NOTICE.md) for credits and reuse terms. Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

### What the size numbers mean

The rendering scale is the volume-equivalent radius, 98 ± 17 km, the geometric mean of the adopted semiaxes. The area-equivalent radius of 105 km is the apparent disc, not the volume. The widely quoted 218 ± 20 km diameter (Fornasier et al. 2013) is not adopted: its own authors bracket Chiron at **196 to 225 km** with a geometric albedo between about 5 and 17 %, because it depends on a nucleus magnitude for an active body. The 166 km diameter served by SBDB traces to a 1990s chord list with no stated uncertainty and is not used.

### Why the surface is neutral grey

At **0.1 ± 1.0 % per 100 nm** against the solar spectrum, Chiron's reflectance is solar-coloured within its errors. A display colour from these indices would be indistinguishable from neutral, and the indices mix nucleus and coma across epochs of varying activity. The package keeps the indices as data and renders the shared neutral material.

## Processing

The [shared distant-worlds methods](../../../packages/bake/authoring/distant-worlds/README.md) explain the authoring and preparation; this body's input row is [centaurs/inputs.json](../../../packages/bake/authoring/centaurs/inputs.json). The terrestrial preparer and meshoptimizer turn the adopted ellipsoid into retained PolyCSS native `u` raster triangles. Edit source interpretation in the [measurements](source/measurements.json) and the [preparation records](source/preparation/), and trace the result through the [runtime asset inventory](inventory.json). Common installation and usage are in the [body contributor guide](../README.md).

## Known problems

Only the **apparent limb ellipse** is fitted from the occultation chords. The third axis rests on three assumptions in the paper: a Jacobi fluid-equilibrium figure at the 5.917813 h period, the light-curve amplitude 0.16 ± 0.03 mag of Groussin et al. (2004), and a body pole equal to the Ortiz et al. (2015) ring pole. The derived density 1119 ± 4 kg/m³ and mass 4.8 ± 2.3 × 10¹⁸ kg follow from those assumptions and are not carried in this package.

Chiron has **no measured spin pole**. The display uses the illustrative ICRF north pole (right ascension 0°, declination +90°) with an arbitrary meridian and phase. The published pole near ecliptic longitude 151°, latitude +20° belongs to the surrounding material, and this display does not assume the body shares it.

**No rings are drawn.** The latest detection is three coplanar rings at 273, 325 and 438 km from the 2023 September 10 occultation ([Pereira et al. 2025, ApJL 992, L19](https://doi.org/10.3847/2041-8213/ae0b6d)). Whether the material is rings, dust shells or jets is disputed, and the structures are reported to change between the 2011, 2018, 2022 and 2023 events. The ledger records the disagreement.

Chiron is an **active body**, with coma, a 2021 outburst of at least 0.6 mag and gas detected by JWST. SBDB's absolute magnitude H = 5.54 includes coma and has no stated uncertainty, so no absolute magnitude is shown as a body fact.

Chiron has never been resolved. It subtends about 0.015 arcsec, so there is no imagery to map and the grid marks unmapped terrain.
