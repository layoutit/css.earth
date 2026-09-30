# TOI-1742 b

## Sources

It is the only planet known around TOI-1742. Its orbit and size follow MacDougall et al. 2023's fit, the archive's default. The introduction is generated from Polanski et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.21099831 Jupiter radii from Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract): 15,084.7 km at 71,492 km per Jupiter radius. GM from the mass 0.03051961 Jupiter masses (Polanski et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJS..272...32P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 21.2690422 d Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): a/R* derived from its semi-major axis 0.154 au and stellar radius 1.131 solar radii; Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): inclination derived from its impact parameter 0.264781 with its a/R* 29.2794 and the orbit's e 0.3, omega 37 degrees (Winn 2010, eq. 7) Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): e 0.3 Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): omega 37 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460660.830697 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1742's measured colour (#fff2f0, the colour dataset of toi-1742 (src/objects/toi-1742/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1742's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (83, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1742b.json).

## Known problems

- **Orbit convention.** omega 37 degrees is taken as Polanski et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.3) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
