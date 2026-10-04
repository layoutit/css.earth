# GJ 3929 b

## Sources

It is one of 2 planets known around GJ 3929. Its orbit and size follow Beard et al. 2022's fit, the archive's default. The introduction is generated from Beard et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.09724345 Jupiter radii from Beard et al. 2022 (2022ApJ...936...55B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022ApJ...936...55B/abstract): 6,952.1 km at 71,492 km per Jupiter radius. GM from the mass 0.00550612 Jupiter masses (Beard et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022ApJ...936...55B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022ApJ...936...55B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Beard et al. 2022 (2022ApJ...936...55B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL_2022): P 2.616235 d Beard et al. 2022 (2022ApJ...936...55B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL_2022): a/R* 16.8; Beard et al. 2022 (2022ApJ...936...55B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL_2022): inclination 88.442 degrees Beard et al. 2022 (2022ApJ...936...55B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL_2022): e 0 Beard et al. 2022 (2022ApJ...936...55B), via the NASA Exoplanet Archive ps table (pl_refname BEARD_ET_AL_2022): transit mid-time 2458956.3962 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-3929's measured color (#ffc983, the color dataset of gj-3929 (src/objects/gj-3929/source/photometry/stellar-color.json)) at the gray's own brightness.

**Rock model.** The page opens on a model set by one measurement: the 15 µm eclipse depth of Xue et al. (2025, [arXiv:2508.12516](https://arxiv.org/abs/2508.12516)), 133 to 186 ppm ([record](source/science/xue-2025/dayside-15um.json)), which the paper finds likely that of a bare rock, at the temperature of a black one. The `bare-rock-eclipse` format draws the bare rock that shows that depth ([a rock set by one eclipse depth](../../../docs/eclipse-mapping.md#a-rock-set-by-one-eclipse-depth)): no atmosphere and no heat transport, 871 K under the star (787 to 953 K across the depth's range), falling as cos^(1/4) of the angle from it, and nothing at night. The depth becomes a temperature through the JWST/MIRI.F1500W filter curve and the BT-Settl model spectrum at 3400 K, log g 5.0, the grid point nearest the star's cited values, both from the Spanish Virtual Observatory, and the radius ratio of this package, 0.0312. Only the dayside brightness is measured.

**Charts.** The orbits of GJ 3929's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (24, 25, 78), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

The page as it opens, before and after, is shown with [LHS 1140 c](../lhs-1140c/README.md#evidence), drawn the same way.

- Run of 2026-10-04: [`new-object --rock-eclipse`](../../../packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.mts) wrote the dataset from the paper's depth. The paper's dayside temperature was not an input: the uniform day side that shows the same depth here is 776 K against the printed 782 ± 79 K, which tests the filter curve, the stellar model and the radius ratio together.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-3929b.json).

## Known problems

- **A model, not a map.** One number is measured, the day side's brightness in one band. The night side is drawn dark because a bare rock's is; nobody has measured it.
- **Two visits.** The two eclipses give 177 +47/−45 and 143 +34/−35 ppm; the joint fit is the one drawn. The paper rules out carbon-dioxide-rich atmospheres thicker than 100 mbar at over 3σ.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 3929 b" (revision 1374088370) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
