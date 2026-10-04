# MASCARA-1 b

## Sources

It is the only planet known around MASCARA-1. Its orbit and size follow Hooton et al. 2022's fit, the archive's default. The introduction is generated from Hooton et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 1.597 Jupiter radii from Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A..75H/abstract): 114,172.7 km at 71,492 km per Jupiter radius. GM from the mass 3.7 Jupiter masses (Talens et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017A&A...606A..73T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017A&A...606A..73T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 2.1425095 d Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): a/R* 4.1676; Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): inclination 88.45 degrees Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): e 0.00034 Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): omega -16 degrees, stored as 344 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460556.771408 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by mascara-1's measured color (#cdd9ff, the color dataset of mascara-1 (src/objects/mascara-1/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Bell et al. (2021, MNRAS 504, 3316, [arXiv:2010.00687](https://arxiv.org/abs/2010.00687)): their fit to a Spitzer IRAC 4.5 µm phase curve (program 14059), new in that paper. The [record](source/science/bell-2021/phase-curve.json) holds the paper's row cell by cell: the eclipse depth 1947 +82/-85 ppm, the radius ratio 0.07881 +0.00084/-0.00087, and a first-order sinusoid, printed as its semi-amplitude, 850 +140/-130 ppm, and the offset east of its maximum, -6 +/- 11 degrees east. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 2952 +100/-97 K, implies with its eclipse depth and radius ratio (6,692 K). The false color runs from 600 to 3,200 K.

**Charts.** The orbits of MASCARA-1's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (55, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 1,157 K at mid-transit against the printed 1300 +/- 340 K, and its maximum falls 6.0° after eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/mascara-1b.json).

## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **The offset is not significant.** −6 ± 11° is consistent with a hot spot at noon.
- **Orbit convention.** omega -16 degrees is taken as Hooton et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.00034) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
