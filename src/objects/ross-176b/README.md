# Ross 176 b

## Sources

It is the only planet known around Ross 176. Its orbit and size follow Geraldía-González et al. 2025's fit, the archive's default. The introduction is generated from Geraldía-González et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.16415409 Jupiter radii from Geraldía-González et al. 2025 (2025A&A...700A.216G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...700A.216G/abstract): 11,735.7 km at 71,492 km per Jupiter radius. GM from the mass 0.01437883 Jupiter masses (Geraldía-González et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...700A.216G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...700A.216G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 5.006622 d Geraldía-González et al. 2025 (2025A&A...700A.216G), via the NASA Exoplanet Archive ps table (pl_refname GERALDIA_GONZALEZ_ET_AL_2025): a/R* derived from its semi-major axis 0.0464 au and stellar radius 0.569 solar radii; Geraldía-González et al. 2025 (2025A&A...700A.216G), via the NASA Exoplanet Archive ps table (pl_refname GERALDIA_GONZALEZ_ET_AL_2025): inclination 89.42 degrees Geraldía-González et al. 2025 (2025A&A...700A.216G), via the NASA Exoplanet Archive ps table (pl_refname GERALDIA_GONZALEZ_ET_AL_2025): e 0.25 Geraldía-González et al. 2025 (2025A&A...700A.216G), via the NASA Exoplanet Archive ps table (pl_refname GERALDIA_GONZALEZ_ET_AL_2025): omega 101 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460550.715057 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by ross-176's measured colour (#ffbf8f, the colour dataset of ross-176 (src/objects/ross-176/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Ross 176's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (76, 82, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ross-176b.json).

## Known problems

- **Orbit convention.** omega 101 degrees is taken as Geraldía-González et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.25) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
