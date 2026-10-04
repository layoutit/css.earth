# HD 149026 b

## Sources

It is the only planet known around Ogma. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 0.74 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 52,904.1 km at 71,492 km per Jupiter radius. GM from the mass 0.38 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.8758885 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 6.8; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 84.55 degrees Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): e 0 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457217.64141 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,300 K dayside brightness temperature measured in secondary eclipse at 8 µm (Harrington et al. 2007, dayside brightness temperature at 8 µm (NASA Exoplanet Archive emission table)): #ff9b38. Chosen from the archive's emission rows by rule: 1 measured of 146 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Zhang et al. (2018, AJ 155, 83, [arXiv:1710.07642](https://arxiv.org/abs/1710.07642)): their fit to a Spitzer IRAC 4.5 µm phase curve of 8 April 2011. The [record](source/science/zhang-2018/phase-curve.json) holds the paper's column cell by cell: the eclipse depth 385 +/- 23 ppm, "the planetary flux at the center of eclipse divided by the stellar flux", the radius ratio 0.0503 +/- 0.0004, and a first-order sinusoid, printed as its amplitude, 164 +22/-24 ppm, and its phase offset, -24.3 +5.5/-4.7 degrees: negative, so the maximum comes before the centre of the eclipse and the hot spot lies 24.3 degrees east. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1649 +/- 49 K, implies with its eclipse depth and radius ratio (4,959 K). The false color runs from 700 to 1,800 K. The one thermal color the page opened on before stays as a dataset.

**Charts.** The orbits of Ogma's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (52, 78, 79), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

The page as it opens, before and after, is shown with [WASP-33 b](../wasp-33b/README.md#evidence), drawn from the same paper.

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 963 K at mid-transit against the printed 1018 +115/-116 K, and its maximum falls 24.3° before eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-149026b.json).


## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **The other band is doubted by its authors.** The paper says its 3.6 µm amplitude and offset for this planet "should be treated with skepticism due to data quality issues"; that fit puts the maximum on the other side of noon. Only the 4.5 µm fit is drawn.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 149026 b" (revision 1374219405) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
