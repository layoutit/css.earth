# LHS 3844 b

## Sources

It is the only planet known around Batsũ̀. Its orbit and size follow Nagel et al. 2026's fit, the archive's default. The introduction is generated from Nagel et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.11472943 Jupiter radii from Nagel et al. 2026 (2026A&A...710A.311N), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...710A.311N/abstract): 8,202.2 km at 71,492 km per Jupiter radius. GM from the mass 0.00745685 Jupiter masses (Nagel et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026A&A...710A.311N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026A&A...710A.311N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Nagel et al. 2026 (2026A&A...710A.311N), via the NASA Exoplanet Archive ps table (pl_refname NAGEL_ET_AL_2026): P 0.462929709 d Nagel et al. 2026 (2026A&A...710A.311N), via the NASA Exoplanet Archive ps table (pl_refname NAGEL_ET_AL_2026): a/R* 7.122; Nagel et al. 2026 (2026A&A...710A.311N), via the NASA Exoplanet Archive ps table (pl_refname NAGEL_ET_AL_2026): inclination 88.9 degrees Nagel et al. 2026 (2026A&A...710A.311N), via the NASA Exoplanet Archive ps table (pl_refname NAGEL_ET_AL_2026): e 0 Nagel et al. 2026 (2026A&A...710A.311N), via the NASA Exoplanet Archive ps table (pl_refname NAGEL_ET_AL_2026): transit mid-time 2460178.83309 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by lhs-3844's measured color (#ffce77, the color dataset of lhs-3844 (src/objects/lhs-3844/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 4.5 µm from Kreidberg et al. (2019, Nature 573, 87, [arXiv:1908.06834](https://arxiv.org/abs/1908.06834)): their fit to a Spitzer IRAC 4.5 µm phase curve, 100 hours between 4 and 8 February 2019 (program 14204). The [record](source/science/kreidberg-2019/phase-curve.json) holds the paper's values cell by cell: the eclipse depth 380 ± 40 ppm, the radius ratio 0.0641 ± 0.0003, the peak-to-trough amplitude of the phase variation, 350 ± 40 ppm, and the longitude of peak brightness, −6 ± 6°. Nothing is refitted. The paper's fit is a first-degree spherical-harmonic temperature map, printed as those numbers; they are drawn as one sinusoid, which the paper's Methods say differs from its model only through the Planck function. The sinusoid becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1040 ± 40 K, implies with its eclipse depth and radius ratio (2,995 K). The false color runs from 350 to 1,100 K.

**Charts.** The orbits of Batsũ̀'s planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (102, 103, 104), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/lhs-3844b.json).

- Run of 2026-10-04: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map's night hemisphere is 580 K, inside the printed 0 to 710 K (one sigma), and its maximum falls 6° from noon, as printed.


## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **The night side is not detected.** The paper finds its brightness consistent with zero, so 45° of longitude come out with no emission in the fit and are left blank.
- **Which way the offset runs is not stated.** The paper prints the longitude of peak brightness as −6 ± 6° without saying whether east is positive. East-positive is assumed, which puts the hottest longitude 6° west of noon; the value is one sigma from zero, and the sidebar says only that it is within 6° of noon.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "LHS 3844 b" (revision 1374087489) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
