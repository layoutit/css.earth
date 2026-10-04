# LTT 3780 b

## Sources

It is one of 2 planets known around LTT 3780. Its orbit and size follow Bonfanti et al. 2024's fit, the archive's default. The introduction is generated from Bonfanti et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.11820879 Jupiter radii from Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...682A..66B/abstract): 8,451 km at 71,492 km per Jupiter radius. GM from the mass 0.00774003 Jupiter masses (Bonfanti et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...682A..66B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...682A..66B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): P 0.76837931 d Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): a/R* 6.79; Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): inclination 86.1 degrees Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): e 0 Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): transit mid-time 2459606.58098 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by ltt-3780's measured color (#ffce8c, the color dataset of ltt-3780 (src/objects/ltt-3780/source/photometry/stellar-color.json)) at the gray's own brightness.

**Rock model.** The page opens on a model set by one measurement: the 15 µm eclipse depth of Allen et al. (2025, [arXiv:2508.14210](https://arxiv.org/abs/2508.14210)), 274 to 350 ppm ([record](source/science/allen-2025/dayside-15um.json)), which the paper finds consistent with the thermal emission from a bare rock surface. The `bare-rock-eclipse` format draws the bare rock that shows that depth ([a rock set by one eclipse depth](../../../docs/eclipse-mapping.md#a-rock-set-by-one-eclipse-depth)): no atmosphere and no heat transport, 1,287 K under the star (1,180 to 1,392 K across the depth's range), falling as cos^(1/4) of the angle from it, and nothing at night. The depth becomes a temperature through the JWST/MIRI.F1500W filter curve and the BT-Settl model spectrum at 3400 K, log g 5.0, the grid point nearest the star's cited values, both from the Spanish Virtual Observatory, and the radius ratio of this package, 0.0320. Only the dayside brightness is measured.

**Charts.** The orbits of LTT 3780's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (62, 89, 100), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

The page as it opens, before and after, is shown with [LHS 1140 c](../lhs-1140c/README.md#evidence), drawn the same way.

- Run of 2026-10-04: [`new-object --rock-eclipse`](../../../packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.mts) wrote the dataset from the paper's depth. The paper's dayside temperature was not an input: the uniform day side that shows the same depth here is 1,145 K against the printed 1,143 +104/−99 K, which tests the filter curve, the stellar model and the radius ratio together.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ltt-3780b.json).

## Known problems

- **A model, not a map.** One number is measured, the day side's brightness in one band. The night side is drawn dark because a bare rock's is; nobody has measured it.
- **Not every atmosphere is excluded.** The paper rules out carbon-dioxide atmospheres down to 0.01 bar; it cannot rule out one bar of pure water vapor or an oxygen atmosphere, which have no feature in the band.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
