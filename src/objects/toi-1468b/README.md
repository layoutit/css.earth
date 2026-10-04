# TOI-1468 b

## Sources

It is one of 2 planets known around TOI-1468. Its orbit and size follow Meier Valdés et al. 2025's fit, the archive's default. The introduction is generated from Meier Valdés et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.12498906 Jupiter radii from Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...698A..68M/abstract): 8,935.7 km at 71,492 km per Jupiter radius. GM from the mass 0.00956491 Jupiter masses (Meier Valdés et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...698A..68M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...698A..68M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Chaturvedi et al. 2022 (2022A&A...666A.155C), via the NASA Exoplanet Archive ps table (pl_refname CHATURVEDI_ET_AL__2022): P 1.8805136 d Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): a/R* 12.2; Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): inclination 87.82 degrees Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): e 0.0099 Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): omega -170 degrees, stored as 190 Chaturvedi et al. 2022 (2022A&A...666A.155C), via the NASA Exoplanet Archive ps table (pl_refname CHATURVEDI_ET_AL__2022): transit mid-time 2458765.68079 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1468's measured color (#ffca85, the color dataset of toi-1468 (src/objects/toi-1468/source/photometry/stellar-color.json)) at the gray's own brightness.

**Rock model.** The page opens on a model set by one measurement: the 15 µm eclipse depth of Meier Valdés et al. (2025, [arXiv:2503.19772](https://arxiv.org/abs/2503.19772)), 280 to 342 ppm ([record](source/science/meier-valdes-2025/dayside-15um.json)), which the paper finds mostly consistent with no atmosphere and zero Bond albedo. The `bare-rock-eclipse` format draws the bare rock that shows that depth ([a rock set by one eclipse depth](../../../docs/eclipse-mapping.md#a-rock-set-by-one-eclipse-depth)): no atmosphere and no heat transport, 1,157 K under the star (1,082 to 1,232 K across the depth's range), falling as cos^(1/4) of the angle from it, and nothing at night. The depth becomes a temperature through the JWST/MIRI.F1500W filter curve and the BT-Settl model spectrum at 3400 K, log g 5.0, the grid point nearest the star's cited values, both from the Spanish Virtual Observatory, and the radius ratio of this package, 0.0346. Only the dayside brightness is measured.

**Charts.** The orbits of TOI-1468's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (43, 57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

The page as it opens, before and after, is shown with [LHS 1140 c](../lhs-1140c/README.md#evidence), drawn the same way.

- Run of 2026-10-04: [`new-object --rock-eclipse`](../../../packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.mts) wrote the dataset from the paper's depth. The paper's dayside temperature was not an input: the uniform day side that shows the same depth here is 1,029 K against the printed 1,024 ± 78 K, which tests the filter curve, the stellar model and the radius ratio together.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1468b.json).

## Known problems

- **A model, not a map.** One number is measured, the day side's brightness in one band. The night side is drawn dark because a bare rock's is; nobody has measured it.
- **The paper finds the rock a little hot.** It reports a surface "marginally hotter than expected" for a black rock and consistency with no atmosphere at 1.65σ; a pure carbon-dioxide or water atmosphere above one bar is ruled out at over 3σ.
- **Orbit convention.** omega -170 degrees is taken as Meier Valdés et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0099) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
