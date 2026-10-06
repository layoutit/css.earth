# LTT 9779 b

## Sources

It is the only planet known around Uúba. Its orbit and size follow Jenkins et al. 2020's fit, the archive's default. The introduction is generated from Jenkins et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 0.4210902 Jupiter radii from Jenkins et al. 2020 (2020NatAs...4.1148J), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020NatAs...4.1148J/abstract): 30,104.6 km at 71,492 km per Jupiter radius. GM from the mass 0.09225057 Jupiter masses (Jenkins et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020NatAs...4.1148J), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020NatAs...4.1148J/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 0.7920645022 d Jenkins et al. 2020 (2020NatAs...4.1148J), via the NASA Exoplanet Archive ps table (pl_refname JENKINS_ET_AL_2020): a/R* 3.877; Jenkins et al. 2020 (2020NatAs...4.1148J), via the NASA Exoplanet Archive ps table (pl_refname JENKINS_ET_AL_2020): inclination 76.39 degrees Jenkins et al. 2020 (2020NatAs...4.1148J), via the NASA Exoplanet Archive ps table (pl_refname JENKINS_ET_AL_2020): e 0 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460933.175839 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by ltt-9779's measured color (#ffeade, the color dataset of ltt-9779 (src/objects/ltt-9779/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Crossfield et al. (2020, ApJL 903, L7, [arXiv:2010.12745](https://arxiv.org/abs/2010.12745)): their fit to a Spitzer IRAC 4.5 µm phase curve (program 14290). The [record](source/science/crossfield-2020/phase-curve.json) holds the paper's values cell by cell: the day-side flux 375 +/- 62 ppm, F_P/F_* at phase 0.5, from Dragomir et al. (2020), the radius ratio 0.0452 +/- 0.0017, and one sinusoid printed as its peak-to-valley amplitude, 358 ± 106 ppm, and the eastward shift of its maximum, −10 ± 21°. Nothing is refitted. The sinusoid becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1800 +/- 120 K, from Dragomir et al. (2020), implies with its eclipse depth and radius ratio (4,978 K). The false color runs from 400 to 1,950 K.

**Charts.** The orbits of Uúba's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (69, 96, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 724 K at mid-transit against the printed 700 +/- 430 K (below 1350 K at 2 sigma), and its maximum falls 10.0° after eclipse, as printed.

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ltt-9779b.json).


## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **The night side is barely detected.** The paper's night flux is 17 ± 123 ppm, so 59° of longitude come out with no emission in the fit and are left blank, and the offset, −10 ± 21°, is consistent with a hot spot at noon.
- **A newer phase curve exists.** JWST NIRSpec observed a full orbit (Ashtari et al. 2025, [arXiv:2510.04863](https://arxiv.org/abs/2510.04863)); its fitted phase-curve values have not been read here.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "LTT 9779 b" (revision 1375644436) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
