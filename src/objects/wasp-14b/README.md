# WASP-14 b

## Sources

It is the only planet known around WASP-14. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.38 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 98,659 km at 71,492 km per Jupiter radius. GM from the mass 8.84 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.24376639 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 6.05; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 84.32 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.083 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 252.7 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2455798.61781 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wasp-14's measured color (#ededff, the color dataset of wasp-14 (src/objects/wasp-14/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Bell et al. (2021, MNRAS 504, 3316, [arXiv:2010.00687](https://arxiv.org/abs/2010.00687)): their fit to a Spitzer IRAC 4.5 µm phase curve (program 80073), first published by Wong et al. (2015, [arXiv:1505.03158](https://arxiv.org/abs/1505.03158)) and reanalysed with fifteen others. The [record](source/science/bell-2021/phase-curve.json) holds the paper's row cell by cell: the eclipse depth 2327 +/- 69 ppm, the radius ratio 0.09561 +0.00049/-0.00052, and a first-order sinusoid, printed as its semi-amplitude, 843 +39/-41 ppm, and the offset east of its maximum, 12.4 +2.2/-2.5 degrees east. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 2401 +50/-49 K, implies with its eclipse depth and radius ratio (5,963 K). The false color runs from 1,150 to 2,550 K.

**Charts.** The orbits of WASP-14's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (50), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 1,358 K at mid-transit against the printed 1391 +56/-61 K, and its maximum falls 12.4° before eclipse, as printed. [`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) holds the printed amplitude-and-offset form to the eclipse-normalised one term for term.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-14b.json).

## Known problems

- **The map is a fit, not an image.** One Fourier series in orbital phase fixes one number per longitude; nothing is known north to south.
- **The orbit is eccentric.** With e 0.083 the planet need not keep one face to its star, so "longitude" here is the phase of the orbit, as the paper's sinusoid is.
- **Two analyses, two offsets.** Wong et al. (2015) put the same curve's maximum 6.8 ± 1.4° east, as Bell et al. convert it; the map follows Bell et al.'s 12.4°.
- **Orbit convention.** omega 252.7 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.083) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-14b" (revision 1328137126) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
