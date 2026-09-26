# WASP-12 b

## Sources

WASP-12 b transits WASP-12 every 1.09 days and is 2 Jupiter radii across. Orbit and size follow Leonardi et al. 2024's fit, the archive's default. This account was drafted from Leonardi et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 1.965 Jupiter radii from Leonardi et al. 2024 (2024A&A...686A..84L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...686A..84L/abstract): 140,481.8 km at 71,492 km per Jupiter radius. GM from the mass 1.47 Jupiter masses (Collins et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153...78C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153...78C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Leonardi et al. 2024 (2024A&A...686A..84L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL__2024): P 1.091418901 d Leonardi et al. 2024 (2024A&A...686A..84L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL__2024): a/R* derived from its semi-major axis 0.0234 au and stellar radius 1.69 solar radii; Leonardi et al. 2024 (2024A&A...686A..84L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL__2024): inclination 81.8 degrees &Ouml;ztürk & Erdem 2019 (2019MNRAS.486.2290O), via the NASA Exoplanet Archive ps table (pl_refname _OUML_ZT_UUML_RK__AMP__ERDEM_2019): e 0 Leonardi et al. 2024 (2024A&A...686A..84L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL__2024): transit mid-time 2457607.519305 BJD, taken as BJD_TDB Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** A black body at the 3,028 K dayside brightness temperature measured in secondary eclipse at 0.9 µm (López-Morales et al. 2010, dayside brightness temperature at 0.9 µm (NASA Exoplanet Archive emission table)): #ffb96f. Chosen from the archive's emission rows by rule: 1 measured of 42 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Two maps that disagree.** Bell et al. (2019, [MNRAS 489, 1995](https://doi.org/10.1093/mnras/stz2018); [arXiv:1906.04742](https://arxiv.org/abs/1906.04742)) fitted two Spitzer phase curves of WASP-12 b, taken in 2010 (program 70060) and 2013 (program 90186). Two lenses show their 3.6 µm fits, one per visit, as [phase-curve-2010.json](source/science/bell-2019/phase-curve-2010.json) and [phase-curve-2013.json](source/science/bell-2019/phase-curve-2013.json). Each is the paper's fiducial first-order sinusoid, F_p = F_day [1 + C1 (cos ψ − 1) + D1 sin ψ] with ψ counted from mid-eclipse (section 3.1), transcribed from Table A2. The Cowan & Agol (2008, [ApJ 678, L129](https://doi.org/10.1086/589232)) inversion turns each into its one map of longitude, through the [`published-phase-curve-map`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.mts) format. The 2010 map is hottest 33° east of noon; the 2013 map is hottest 14° west. The paper finds this change at 6.4σ with its fiducial pipeline and counts it as evidence that the hot spot moves. Each legend says the other visit disagrees. The palette runs from 1,000 to 3,100 K on both lenses, in false colour. Every latitude is drawn alike. The maps are drawn under the star's light like the colour lens; with shadows on, the night half is dark.

| Quantity | 2010 map | Bell et al. 2010 | 2013 map | Bell et al. 2013 |
| --- | --- | --- | --- | --- |
| Day side (sets the star's band temperature) | 2,744 K | 2,744 ± 48 K | 2,813 K | 2,813 ± 48 K |
| Night side, at mid-transit | 1,525 K | 1,510 ± 210 K | 1,757 K | 1,760 ± 97 K |
| Peak, degrees before eclipse | 32.8° | 32.6 ± 6.2° | −13.9° | −13.6 ± 3.8° |
| Hottest point on the map | 3,016 K at 32.8° east | — | 2,961 K at 13.9° west | — |
| Coldest point on the map | 1,021 K at 147.2° west | — | 1,555 K at 166.1° east | — |

**Why 3.6 µm, not 4.5 µm.** At 4.5 µm both visits show a strong second peak each orbit. Bell et al. attribute it to gas streaming off the planet along the star–planet line, not to the planet's own heat, and compute their temperatures from the first-order terms only (appendix B). A map inverted from that curve would paint the gas onto the planet. At 3.6 µm the second-order terms are not detected, and the fiducial fits are first order ([ledger](investigations.json)).

**Temperature.** The planet's intensity relative to the star's is 2J/rp², with J the Cowan & Agol map and rp the dilution-corrected radius ratio of each visit. It becomes a brightness temperature at 3.6 µm against the star's 3.6 µm brightness temperature that each row's own eclipse depth and day side imply: 6,033 K for 2010 and 6,031 K for 2013. Appendix B prints 5,800 K at 3.6 µm and 6,000 K at 4.5 µm, but the table's 3.6 µm rows do not follow 5,800 K (it gives 2,668 K for the 2010 day side, not 2,744 K); the two values appear swapped in the text. The night sides then follow within their uncertainties, as the table shows.

**Rotation.** The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked, as the paper's maps do: longitude 0 faces the star.

**No illustration.** NASA's [WASP-12b 3D Model](https://science.nasa.gov/resource/wasp-12b-3d-model/) (NASA VTAD) is egg-shaped, as the planet is stretched by its star, and its texture cannot be placed on this package's sphere without moving it by up to 19 degrees; it is not used ([ledger](investigations.json)).

## Evidence

Run of 2026-09-25 (this version): [`published-phase-curve-map.test.mts`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.test.mts) holds both maps to Table A2: the day side exactly, the night sides and peak offsets within their uncertainties, the peak equal to SPCA's −atan2(D1, C1), and the 2010 map warmer east of noon, the 2013 map west of it.

Generated 2026-09-24 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-12b.json).


## Known problems

- **The two visits disagree.** Both maps are the same paper's fits to the same camera, three years apart. Nothing here decides which is right; each lens names the other.
- **Longitude only, largest pattern only.** A first-order phase curve cannot see north and south, and nothing finer than a hemisphere is measured.
- **Brightness temperature, not temperature.** Each value is a black body with the observed 3.6 µm brightness, against a star temperature the paper's own row implies.
- **Shape.** The paper expects the planet to be stretched by its star; the maps are drawn on the package's sphere.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-12b" (revision 1374242282), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
