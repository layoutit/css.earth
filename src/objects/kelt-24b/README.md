# KELT-24 b

## Sources

It is the only planet known around KELT-24. Its orbit and size follow Giovinazzi et al. 2024's fit, the archive's default. The introduction is generated from Giovinazzi et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 1.134 Jupiter radii from Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..118G/abstract): 81,071.9 km at 71,492 km per Jupiter radius. GM from the mass 4.59 Jupiter masses (Giovinazzi et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024AJ....168..118G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024AJ....168..118G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive ps table (pl_refname GIOVINAZZI_ET_AL__2024): P 5.55149296 d Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive ps table (pl_refname GIOVINAZZI_ET_AL__2024): a/R* 10.67; Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive ps table (pl_refname GIOVINAZZI_ET_AL__2024): inclination 89.67 degrees Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive ps table (pl_refname GIOVINAZZI_ET_AL__2024): e 0.0319 Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive ps table (pl_refname GIOVINAZZI_ET_AL__2024): omega 3 degrees Giovinazzi et al. 2024 (2024AJ....168..118G), via the NASA Exoplanet Archive ps table (pl_refname GIOVINAZZI_ET_AL__2024): transit mid-time 2459173.347426 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at the 1,391 K equilibrium temperature of Giovinazzi et al. 2024, equilibrium temperature (NASA Exoplanet Archive planetary systems table): #ff6300. Chosen by rule: 3 papers in the archive print one; the archive's default parameter set. On 120 hot Jupiters whose day side Spitzer measured, the measured temperature is within 20% of this kind of estimate for 83% (Deming et al. 2023); see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of KELT-24's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (60, 74, 75), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kelt-24b.json).

## Known problems

- **Orbit convention.** omega 3 degrees is taken as Giovinazzi et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0319) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
