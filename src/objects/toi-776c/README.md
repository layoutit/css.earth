# TOI-776 c

## Sources

It is one of 2 planets known around TOI-776. Its orbit and size follow Fridlund et al. 2024's fit, the archive's default. The introduction is generated from Fridlund et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.18262142 Jupiter radii from Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...684A..12F/abstract): 13,056 km at 71,492 km per Jupiter radius. GM from the mass 0.02170983 Jupiter masses (Fridlund et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...684A..12F), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...684A..12F/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 15.66534 d Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): a/R* derived from its semi-major axis 0.1001 au and stellar radius 0.547 solar radii; Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): inclination 89.49 degrees Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): e 0.089 Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): omega 7 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2459026.89405 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-776's measured color (#ffbf89, the color dataset of toi-776 (src/objects/toi-776/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-776's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (90, 100, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-776c.json).

## Known problems

- **Orbit convention.** omega 7 degrees is taken as Fridlund et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.089) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
