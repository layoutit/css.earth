# HD 2685 b

## Sources

It is the only planet known around HD 2685. Its orbit and size follow Jones et al. 2019's fit, the archive's default. The introduction is generated from Jones et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 1.44 Jupiter radii from Jones et al. 2019 (2019A&A...625A..16J), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...625A..16J/abstract): 102,948.5 km at 71,492 km per Jupiter radius. GM from the mass 1.17 Jupiter masses (Jones et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019A&A...625A..16J), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019A&A...625A..16J/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.1269046 d Jones et al. 2019 (2019A&A...625A..16J), via the NASA Exoplanet Archive ps table (pl_refname JONES_ET_AL__2019): a/R* 7.6974; Jones et al. 2019 (2019A&A...625A..16J), via the NASA Exoplanet Archive ps table (pl_refname JONES_ET_AL__2019): inclination 89.252 degrees Jones et al. 2019 (2019A&A...625A..16J), via the NASA Exoplanet Archive ps table (pl_refname JONES_ET_AL__2019): e 0.091 Jones et al. 2019 (2019A&A...625A..16J), via the NASA Exoplanet Archive ps table (pl_refname JONES_ET_AL__2019): omega 184.36 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460174.637067 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at the 2,061 K equilibrium temperature of Jones et al. 2019, equilibrium temperature (NASA Exoplanet Archive planetary systems table): #ff8e1f. Chosen by rule: 1 paper in the archive prints one; the archive's default parameter set. On 120 hot Jupiters whose day side Spitzer measured, the measured temperature is within 20% of this kind of estimate for 83% (Deming et al. 2023); see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of HD 2685's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (68, 94, 95), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-2685b.json).

## Known problems

- **Orbit convention.** omega 184.36 degrees is taken as Jones et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.091) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
